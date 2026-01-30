import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingInvoice?: {
    id: string;
    document_date: string;
    document_number: string | null;
    supplier_nif: string;
    total_amount: number;
    created_at: string;
  };
  reason?: string;
}

interface InvoiceIdentifiers {
  supplier_nif: string;
  document_number?: string | null;
  document_date: string;
  atcud?: string | null;
}

/**
 * Hook para verificar duplicados de facturas
 * 
 * Critérios de duplicação (por ordem de prioridade):
 * 1. ATCUD (identificador único obrigatório desde 2022)
 * 2. NIF + Número de Documento + Data
 * 
 * NOTA: Valores iguais NÃO são critério de duplicação
 * (ex: rendas mensais têm o mesmo valor mas são documentos diferentes)
 */
export function useDuplicateCheck() {
  const { user } = useAuth();
  const [isChecking, setIsChecking] = useState(false);

  /**
   * Verifica se uma factura de compra (despesa) já existe
   */
  /**
   * Verifica se uma factura de compra (despesa) já existe
   * @param identifiers - Identificadores da factura
   * @param forClientId - ID do cliente específico (para contabilistas). Se não fornecido, usa o user.id
   */
  const checkPurchaseDuplicate = async (
    identifiers: InvoiceIdentifiers,
    forClientId?: string | null
  ): Promise<DuplicateCheckResult> => {
    if (!user) {
      return { isDuplicate: false, reason: 'Utilizador não autenticado' };
    }

    // Usar o client_id específico se fornecido (caso contabilista), senão usa o user.id
    const effectiveClientId = forClientId || user.id;

    setIsChecking(true);
    try {
      // Primeira prioridade: ATCUD (identificador único)
      if (identifiers.atcud) {
        const { data: atcudMatch, error: atcudError } = await supabase
          .from('invoices')
          .select('id, document_date, document_number, supplier_nif, total_amount, created_at')
          .eq('client_id', effectiveClientId)
          .eq('atcud', identifiers.atcud)
          .maybeSingle();

        if (atcudError) {
          console.error('ATCUD check error:', atcudError);
        }

        if (atcudMatch) {
          return {
            isDuplicate: true,
            existingInvoice: atcudMatch,
            reason: `ATCUD duplicado: ${identifiers.atcud}`,
          };
        }
      }

      // Segunda prioridade: NIF + Número de Documento + Data
      // (só verifica se tiver número de documento)
      if (identifiers.document_number) {
        const { data: docMatch, error: docError } = await supabase
          .from('invoices')
          .select('id, document_date, document_number, supplier_nif, total_amount, created_at')
          .eq('client_id', effectiveClientId)
          .eq('supplier_nif', identifiers.supplier_nif)
          .eq('document_number', identifiers.document_number)
          .eq('document_date', identifiers.document_date)
          .maybeSingle();

        if (docError) {
          console.error('Document check error:', docError);
        }

        if (docMatch) {
          return {
            isDuplicate: true,
            existingInvoice: docMatch,
            reason: `Factura ${identifiers.document_number} do fornecedor ${identifiers.supplier_nif} com data ${identifiers.document_date} já existe`,
          };
        }
      }

      return { isDuplicate: false };
    } catch (error) {
      console.error('Duplicate check exception:', error);
      return { isDuplicate: false, reason: 'Erro ao verificar duplicados' };
    } finally {
      setIsChecking(false);
    }
  };

  /**
   * Verifica se uma factura de venda já existe
   * @param identifiers - Identificadores da factura
   * @param forClientId - ID do cliente específico (para contabilistas). Se não fornecido, usa o user.id
   */
  const checkSalesDuplicate = async (
    identifiers: InvoiceIdentifiers,
    forClientId?: string | null
  ): Promise<DuplicateCheckResult> => {
    if (!user) {
      return { isDuplicate: false, reason: 'Utilizador não autenticado' };
    }

    // Usar o client_id específico se fornecido (caso contabilista), senão usa o user.id
    const effectiveClientId = forClientId || user.id;

    setIsChecking(true);
    try {
      // Primeira prioridade: ATCUD
      if (identifiers.atcud) {
        const { data: atcudMatch, error: atcudError } = await supabase
          .from('sales_invoices')
          .select('id, document_date, document_number, supplier_nif, total_amount, created_at')
          .eq('client_id', effectiveClientId)
          .eq('atcud', identifiers.atcud)
          .maybeSingle();

        if (atcudError) {
          console.error('ATCUD check error:', atcudError);
        }

        if (atcudMatch) {
          return {
            isDuplicate: true,
            existingInvoice: atcudMatch,
            reason: `ATCUD duplicado: ${identifiers.atcud}`,
          };
        }
      }

      // Segunda prioridade: NIF + Número de Documento + Data
      if (identifiers.document_number) {
        const { data: docMatch, error: docError } = await supabase
          .from('sales_invoices')
          .select('id, document_date, document_number, supplier_nif, total_amount, created_at')
          .eq('client_id', effectiveClientId)
          .eq('supplier_nif', identifiers.supplier_nif)
          .eq('document_number', identifiers.document_number)
          .eq('document_date', identifiers.document_date)
          .maybeSingle();

        if (docError) {
          console.error('Document check error:', docError);
        }

        if (docMatch) {
          return {
            isDuplicate: true,
            existingInvoice: docMatch,
            reason: `Factura ${identifiers.document_number} com data ${identifiers.document_date} já existe`,
          };
        }
      }

      return { isDuplicate: false };
    } catch (error) {
      console.error('Duplicate check exception:', error);
      return { isDuplicate: false, reason: 'Erro ao verificar duplicados' };
    } finally {
      setIsChecking(false);
    }
  };

  /**
   * Verifica múltiplas facturas de uma só vez (útil para importação SAF-T)
   * Retorna lista de duplicados encontrados
   * @param invoices - Lista de facturas a verificar
   * @param forClientId - ID do cliente específico (para contabilistas). Se não fornecido, usa o user.id
   */
  const checkBulkSalesDuplicates = async (
    invoices: InvoiceIdentifiers[],
    forClientId?: string | null
  ): Promise<{ duplicates: InvoiceIdentifiers[]; unique: InvoiceIdentifiers[] }> => {
    if (!user || invoices.length === 0) {
      return { duplicates: [], unique: invoices };
    }

    // Usar o client_id específico se fornecido (caso contabilista), senão usa o user.id
    const effectiveClientId = forClientId || user.id;

    setIsChecking(true);
    try {
      // Buscar todas as vendas existentes do cliente específico
      const { data: existingSales, error } = await supabase
        .from('sales_invoices')
        .select('document_number, document_date, supplier_nif, atcud')
        .eq('client_id', effectiveClientId);

      if (error) {
        console.error('Bulk duplicate check error:', error);
        return { duplicates: [], unique: invoices };
      }

      // Criar set de chaves existentes
      const existingKeys = new Set<string>();
      const existingAtcuds = new Set<string>();

      existingSales?.forEach((inv) => {
        if (inv.atcud) {
          existingAtcuds.add(inv.atcud);
        }
        if (inv.document_number) {
          const key = `${inv.supplier_nif}|${inv.document_number}|${inv.document_date}`;
          existingKeys.add(key);
        }
      });

      const duplicates: InvoiceIdentifiers[] = [];
      const unique: InvoiceIdentifiers[] = [];

      invoices.forEach((inv) => {
        const isDuplicate =
          (inv.atcud && existingAtcuds.has(inv.atcud)) ||
          (inv.document_number &&
            existingKeys.has(`${inv.supplier_nif}|${inv.document_number}|${inv.document_date}`));

        if (isDuplicate) {
          duplicates.push(inv);
        } else {
          unique.push(inv);
        }
      });

      return { duplicates, unique };
    } catch (error) {
      console.error('Bulk duplicate check exception:', error);
      return { duplicates: [], unique: invoices };
    } finally {
      setIsChecking(false);
    }
  };

  return {
    isChecking,
    checkPurchaseDuplicate,
    checkSalesDuplicate,
    checkBulkSalesDuplicates,
  };
}
