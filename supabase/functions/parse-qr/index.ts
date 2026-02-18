import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Portuguese QR Code fields mapping (Portaria 195/2020)
interface QRCodeData {
  // Mandatory fields
  A: string; // NIF do emitente
  B: string; // NIF do adquirente
  C: string; // País do adquirente
  D: string; // Tipo de documento
  E: string; // Estado do documento
  F: string; // Data do documento (YYYYMMDD)
  G: string; // Identificação única do documento
  H: string; // ATCUD
  
  // Tax bases and VAT
  I1?: string; // Base tributável taxa reduzida
  I2?: string; // IVA taxa reduzida
  I3?: string; // Base tributável taxa intermédia
  I4?: string; // IVA taxa intermédia
  I5?: string; // Base tributável taxa normal
  I6?: string; // IVA taxa normal
  I7?: string; // Base tributável isenta
  I8?: string; // Base tributável não sujeita
  
  // Totals
  N: string; // IVA total
  O: string; // Total do documento
  
  // Withholding
  P?: string; // Retenção na fonte
  Q?: string; // 4 hash chars
  R?: string; // Nº certificado programa
  S?: string; // Outras informações
}

// Parse QR code content into structured data
function parseQRCode(qrContent: string): QRCodeData | null {
  try {
    const fields: Record<string, string> = {};
    
    // QR code format: A:123456789*B:999999990*C:PT*D:FS*...
    const parts = qrContent.split('*');
    
    for (const part of parts) {
      const colonIndex = part.indexOf(':');
      if (colonIndex > 0) {
        const key = part.substring(0, colonIndex);
        const value = part.substring(colonIndex + 1);
        fields[key] = value;
      }
    }
    
    // Validate mandatory fields
    if (!fields.A || !fields.F || !fields.O) {
      console.log('Missing mandatory fields:', { A: fields.A, F: fields.F, O: fields.O });
      return null;
    }
    
    return fields as unknown as QRCodeData;
  } catch (error) {
    console.error('Error parsing QR code:', error);
    return null;
  }
}

// Validate Portuguese NIF
function validateNIF(nif: string): boolean {
  if (!nif || nif.length !== 9 || !/^\d{9}$/.test(nif)) {
    return false;
  }
  
  // Check first digit (valid: 1, 2, 3, 5, 6, 7, 8, 9)
  const firstDigit = parseInt(nif[0]);
  if (![1, 2, 3, 5, 6, 7, 8, 9].includes(firstDigit)) {
    return false;
  }
  
  // Calculate check digit
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(nif[i]) * (9 - i);
  }
  
  const checkDigit = 11 - (sum % 11);
  const expectedCheckDigit = checkDigit >= 10 ? 0 : checkDigit;
  
  return parseInt(nif[8]) === expectedCheckDigit;
}

// Format date from YYYYMMDD to ISO
function formatDate(dateStr: string): string {
  if (dateStr.length !== 8) return dateStr;
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

// Determine fiscal region based on tax rates
function determineFiscalRegion(data: QRCodeData): string {
  // Portugal Continental: 6%, 13%, 23%
  // Madeira: 5%, 12%, 22%
  // Açores: 4%, 9%, 18%
  
  // Check if intermediate rate exists to determine region
  if (data.I4) {
    const intermediateRate = parseFloat(data.I4) / parseFloat(data.I3 || '1') * 100;
    if (intermediateRate <= 10) return 'PT-AC';
    if (intermediateRate <= 13) return 'PT-MA';
  }
  
  if (data.I6) {
    const standardRate = parseFloat(data.I6) / parseFloat(data.I5 || '1') * 100;
    if (standardRate <= 19) return 'PT-AC';
    if (standardRate <= 22.5) return 'PT-MA';
  }
  
  return 'PT';
}

// Get fiscal period from date
function getFiscalPeriod(dateStr: string): string {
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  return `${year}${month}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { qr_content } = await req.json();
    
    if (!qr_content) {
      return new Response(
        JSON.stringify({ error: 'QR code content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing QR code:', qr_content.substring(0, 50) + '...');
    
    const qrData = parseQRCode(qr_content);
    
    if (!qrData) {
      return new Response(
        JSON.stringify({ error: 'Invalid QR code format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate supplier NIF
    // SECURITY: Do NOT expose NIF in error responses
    if (!validateNIF(qrData.A)) {
      return new Response(
        JSON.stringify({ error: 'Invalid supplier NIF format in QR code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and structure the invoice data
    const invoiceData = {
      supplier_nif: qrData.A,
      customer_nif: qrData.B || null,
      document_type: qrData.D || null,
      document_date: formatDate(qrData.F),
      document_number: qrData.G || null,
      atcud: qrData.H || null,
      
      // Tax bases
      base_reduced: qrData.I1 ? parseFloat(qrData.I1) : null,
      vat_reduced: qrData.I2 ? parseFloat(qrData.I2) : null,
      base_intermediate: qrData.I3 ? parseFloat(qrData.I3) : null,
      vat_intermediate: qrData.I4 ? parseFloat(qrData.I4) : null,
      base_standard: qrData.I5 ? parseFloat(qrData.I5) : null,
      vat_standard: qrData.I6 ? parseFloat(qrData.I6) : null,
      base_exempt: qrData.I7 ? parseFloat(qrData.I7) : null,
      
      // Totals
      total_vat: qrData.N ? parseFloat(qrData.N) : null,
      total_amount: parseFloat(qrData.O),
      
      // Derived fields
      fiscal_region: determineFiscalRegion(qrData),
      fiscal_period: getFiscalPeriod(qrData.F),
      
      // Raw data for reference
      qr_raw: qr_content,
    };

    console.log('Parsed invoice data:', JSON.stringify(invoiceData, null, 2));

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: invoiceData,
        message: 'QR code parsed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in parse-qr function:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
