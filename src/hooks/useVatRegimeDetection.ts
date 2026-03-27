import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VatDetectionResult {
  suggestedRegime: string | null;
  isViesRegistered: boolean | null;
  annualRevenue: number | null;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

const VIES_API = 'https://ec.europa.eu/taxation_customs/vies/rest-api/ms/PT/vat';
const ART53_THRESHOLD_2026 = 14500; // €14.500 threshold for Art. 53º exemption in 2026

/**
 * Hook to auto-detect VAT regime based on NIF (VIES check) and annual revenue.
 * Returns a suggestion — user always has final say.
 */
export function useVatRegimeDetection() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [result, setResult] = useState<VatDetectionResult | null>(null);

  const detectRegime = useCallback(async (
    nif: string,
    userId: string,
  ): Promise<VatDetectionResult | null> => {
    if (!nif || nif.length !== 9) {
      toast.error('NIF inválido — deve ter 9 dígitos');
      return null;
    }

    setIsDetecting(true);
    setResult(null);

    try {
      // Step 1: Check VIES registration
      let isViesRegistered: boolean | null = null;
      try {
        const viesResponse = await fetch(`${VIES_API}/${nif}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (viesResponse.ok) {
          const viesData = await viesResponse.json();
          isViesRegistered = viesData.isValid === true;
        }
      } catch {
        // VIES API can be unreliable — continue without it
        console.warn('VIES API unavailable, skipping check');
      }

      // Step 2: Calculate annual revenue from invoices
      let annualRevenue: number | null = null;
      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;

      const { data: revenueData } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('user_id', userId)
        .eq('type', 'income')
        .gte('date', `${previousYear}-01-01`)
        .lte('date', `${previousYear}-12-31`);

      if (revenueData && revenueData.length > 0) {
        annualRevenue = revenueData.reduce(
          (sum, inv) => sum + (Number(inv.total_amount) || 0),
          0,
        );
      }

      // Step 3: Determine suggestion
      let suggestedRegime: string | null = null;
      let confidence: 'high' | 'medium' | 'low' = 'low';
      let reason = '';

      if (isViesRegistered === true) {
        // Registered in VIES = definitely in normal regime
        suggestedRegime = 'normal_quarterly';
        confidence = 'high';
        reason = `NIF registado no VIES (IVA intra-comunitário activo). Regime Normal sugerido.`;
      } else if (annualRevenue !== null && annualRevenue > 0) {
        if (annualRevenue > ART53_THRESHOLD_2026) {
          suggestedRegime = 'normal_quarterly';
          confidence = 'medium';
          reason = `Facturação ${previousYear}: €${annualRevenue.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} — acima do limite Art. 53º (€${ART53_THRESHOLD_2026.toLocaleString('pt-PT')}). Regime Normal sugerido.`;
        } else {
          suggestedRegime = 'exempt_53';
          confidence = 'medium';
          reason = `Facturação ${previousYear}: €${annualRevenue.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} — abaixo do limite Art. 53º (€${ART53_THRESHOLD_2026.toLocaleString('pt-PT')}). Isenção Art. 53º sugerida.`;
        }
      } else if (isViesRegistered === false) {
        suggestedRegime = 'exempt_53';
        confidence = 'low';
        reason = 'NIF não registado no VIES e sem facturação registada. Isenção Art. 53º sugerida (reveja manualmente).';
      } else {
        confidence = 'low';
        reason = 'Não foi possível determinar o regime — VIES indisponível e sem facturação registada. Configure manualmente.';
      }

      const detection: VatDetectionResult = {
        suggestedRegime,
        isViesRegistered,
        annualRevenue,
        confidence,
        reason,
      };

      setResult(detection);
      return detection;
    } catch (error) {
      console.error('VAT regime detection error:', error);
      toast.error('Erro ao detectar regime de IVA');
      return null;
    } finally {
      setIsDetecting(false);
    }
  }, []);

  return { detectRegime, isDetecting, result };
}
