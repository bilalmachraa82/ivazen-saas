// No supabase client needed - this function only calls AI gateway, no DB access
import { evaluateEdpFallbackSanity } from './edpSanity.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Extraction prompt for invoice data
const EXTRACTION_PROMPT = `Extrai dados desta factura (Portugal ou estrangeira). Responde APENAS com JSON válido (sem markdown) neste formato:
{"supplier_nif":"123456789"|null,"supplier_vat_id":"IE3668997OH"|null,"supplier_name":"Nome"|null,"customer_nif":"987654321"|null,"document_date":"2025-01-15","document_number":"FT 2025/123"|null,"document_type":"FT"|null,"atcud":"ABCD1234"|null,"base_reduced":0,"vat_reduced":0,"base_intermediate":0,"vat_intermediate":0,"base_standard":100.00,"vat_standard":23.00,"base_exempt":0,"total_vat":23.00,"total_amount":123.00,"fiscal_region":"PT","fiscal_period":"202501","confidence":85}

Regras de identificação fiscal:
- supplier_nif = NIF/NIPC do EMITENTE/FORNECEDOR (quem emite a fatura). Devolve apenas 9 dígitos (sem espaços, pontos, nem prefixo "PT").
- supplier_vat_id = VAT ID do emitente quando NÃO for NIF PT (ex.: IE3668997OH, ES..., FR...). Em maiúsculas e sem espaços.
- customer_nif = NIF do ADQUIRENTE/CLIENTE quando existir (9 dígitos).
- Alguns documentos usam sinónimos/abreviações: "Nº Contribuinte", "Número de Contribuinte", "Contribuinte", "Nº Cont.", "N/N Cont.", "V/N Cont.", "NIPC". Usa isto para encontrar o NIF correcto do fornecedor.

REGRA CRITICA para document_date: usar SEMPRE a "Data de emissão" (ou "Data do documento") do documento.
NUNCA usar "Débito a partir de", "Data de vencimento", "Data de cobrança", "Data limite de pagamento" ou qualquer outra data bancária/administrativa.
A data de emissão é a data fiscal legal do documento. O fiscal_period deve derivar dessa mesma data (YYYYMM).

Taxas IVA: 6% (reduced), 13% (intermediate), 23% (standard), isento (exempt).
Nunca inventes valores. Se não conseguires extrair document_date ou total_amount, usa confidence:0.
Se não encontrares identificador fiscal do fornecedor (nem NIF PT nem VAT), coloca supplier_nif=null e supplier_vat_id=null e reduz a confiança (ex.: <=40).`;

// Second-pass prompt focused only on supplier tax identifiers (helps handwritten/scans)
const TAX_ID_ONLY_PROMPT = `Encontra apenas o identificador fiscal do fornecedor (emitente) nesta factura. Responde APENAS com JSON válido (sem markdown):
{"supplier_nif":"123456789"|null,"supplier_vat_id":"IE3668997OH"|null,"customer_nif":"987654321"|null}

Regras:
- supplier_nif = NIF/NIPC do EMITENTE/FORNECEDOR. Aceita variantes: NIF, NIPC, Contribuinte, Número de Contribuinte, Nº Cont., N/N Cont.
- Devolve NIF PT como 9 dígitos sem espaços/pontos; VAT estrangeiro em supplier_vat_id (maiúsculas, sem espaços).
- Não uses o NIF do cliente/adquirente como supplier_nif.`;

// Third-pass prompt focused on EDP-style utility invoices with multiple sections.
// We ask for a single TOTAL IVA for the whole document, plus optional regularization.
const EDP_VAT_COMPONENTS_PROMPT = `Analisa esta fatura EDP e extrai o TOTAL de IVA do documento COMPLETO em JSON válido (sem markdown):
{"total_iva":8.98,"regularization":null}

Regras CRÍTICAS:
- Procura o TOTAL GERAL de IVA de TODA a fatura (todas as secções somadas: Electricidade, Gás, Rede, Serviços, etc.).
- NÃO extraias de uma secção individual — usa o resumo final ou soma mental das secções ÚNICAS.
- Se a fatura tem várias páginas, considera TODAS as páginas.
- NÃO dupliques valores de blocos de resumo/subtotal que repetem secções anteriores.
- Se existir "Regularização", "Acerto" ou "Nota de crédito" com IVA separado, coloca esse valor em "regularization" e NÃO o incluas no total_iva.
- Se não conseguires determinar com confiança, devolve {"total_iva":null,"regularization":null}.`;

interface ExtractionResult {
  supplier_nif: string | null;
  supplier_vat_id?: string | null;
  supplier_name?: string | null;
  customer_nif?: string | null;
  document_date: string;
  document_number?: string | null;
  document_type?: string | null;
  atcud?: string | null;
  base_reduced?: number;
  vat_reduced?: number;
  base_intermediate?: number;
  vat_intermediate?: number;
  base_standard?: number;
  vat_standard?: number;
  base_exempt?: number;
  total_vat?: number;
  total_amount: number;
  fiscal_region?: string;
  fiscal_period?: string;
  confidence: number;
}

interface EdpVatComponentsResult {
  total_iva?: unknown;
  regularization?: unknown;
}

// ============================================================
// ARITHMETIC VALIDATION (deterministic, post-LLM)
// Principle: The invoice is the legal document. Never "correct" issuer values.
// We only flag discrepancies as warnings for OCR error detection.
// ============================================================

interface ArithmeticChecks {
  line_vat_ok: boolean;
  totals_ok: boolean;
  rates_used: Record<string, number>;
  line_deltas: Record<string, number>;
  total_delta: number;
  tolerance_line: number;
  tolerance_doc: number;
}

// VAT rates by fiscal region (Continental, Açores RA, Madeira RM)
const VAT_RATES: Record<string, { reduced: number; intermediate: number; standard: number }> = {
  'PT': { reduced: 0.06, intermediate: 0.13, standard: 0.23 },
  'PT-AC': { reduced: 0.05, intermediate: 0.09, standard: 0.18 },
  'PT-MA': { reduced: 0.05, intermediate: 0.12, standard: 0.22 },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeDocumentDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  let year = '';
  let month = '';
  let day = '';

  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    year = m[1]; month = m[2]; day = m[3];
  } else {
    m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      day = m[1]; month = m[2]; year = m[3];
    } else {
      m = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
      if (m) {
        year = m[1]; month = m[2]; day = m[3];
      } else {
        m = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (m) {
          year = m[1]; month = m[2]; day = m[3];
        }
      }
    }
  }

  if (!year || !month || !day) return null;
  const y = Number(year);
  const mo = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;

  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) return null;

  return `${year}-${month}-${day}`;
}

function deriveFiscalPeriodFromDocumentDate(documentDate: string): string {
  return documentDate.slice(0, 7).replace('-', '');
}

function isLikelyEdpInvoice(data: ExtractionResult): boolean {
  const supplierNif = (data.supplier_nif || '').replace(/\s/g, '');
  if (supplierNif === '503504564') return true;
  const supplierName = (data.supplier_name || '').toUpperCase();
  return supplierName.includes('EDP');
}

function parseCurrencyValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return round2(value);
  }
  if (typeof value !== 'string') return null;
  let cleaned = value.trim().replace(/\s+/g, '').replace(/€/g, '');
  if (!cleaned) return null;
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return round2(n);
}

function validateArithmetic(data: ExtractionResult): ArithmeticChecks {
  const region = data.fiscal_region || 'PT';
  const rates = VAT_RATES[region] || VAT_RATES['PT'];
  const TOLERANCE_LINE = 0.02;
  const TOLERANCE_DOC = 0.10;

  const baseReduced = data.base_reduced || 0;
  const baseIntermediate = data.base_intermediate || 0;
  const baseStandard = data.base_standard || 0;
  const baseExempt = data.base_exempt || 0;

  const vatReduced = data.vat_reduced || 0;
  const vatIntermediate = data.vat_intermediate || 0;
  const vatStandard = data.vat_standard || 0;

  // Calculate expected VAT per line
  const expectedReduced = round2(baseReduced * rates.reduced);
  const expectedIntermediate = round2(baseIntermediate * rates.intermediate);
  const expectedStandard = round2(baseStandard * rates.standard);

  const deltaReduced = round2(vatReduced - expectedReduced);
  const deltaIntermediate = round2(vatIntermediate - expectedIntermediate);
  const deltaStandard = round2(vatStandard - expectedStandard);

  const lineVatOk =
    (baseReduced === 0 || Math.abs(deltaReduced) <= TOLERANCE_LINE) &&
    (baseIntermediate === 0 || Math.abs(deltaIntermediate) <= TOLERANCE_LINE) &&
    (baseStandard === 0 || Math.abs(deltaStandard) <= TOLERANCE_LINE);

  // Document total check: sum of bases + total_vat ≈ total_amount
  // Allows for discounts, shipping, ISP, etc.
  const sumBases = baseReduced + baseIntermediate + baseStandard + baseExempt;
  const totalVat = data.total_vat || 0;
  const totalDelta = round2((sumBases + totalVat) - data.total_amount);
  const totalsOk = Math.abs(totalDelta) <= TOLERANCE_DOC;

  return {
    line_vat_ok: lineVatOk,
    totals_ok: totalsOk,
    rates_used: {
      reduced: rates.reduced,
      intermediate: rates.intermediate,
      standard: rates.standard,
    },
    line_deltas: {
      reduced: deltaReduced,
      intermediate: deltaIntermediate,
      standard: deltaStandard,
    },
    total_delta: totalDelta,
    tolerance_line: TOLERANCE_LINE,
    tolerance_doc: TOLERANCE_DOC,
  };
}

function parseJsonFromModel(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // Fallback: handle markdown code blocks if present
    let jsonContent = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonContent = codeBlockMatch[1].trim();
    }

    // Try to extract JSON object
    const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }
    return JSON.parse(jsonMatch[0]);
  }
}

function extractPtNifDigits(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  const noPrefix = upper.startsWith('PT') ? upper.slice(2) : upper;
  const digits = noPrefix.replace(/\D/g, '');
  return digits.length === 9 ? digits : null;
}

function isValidPortugueseNIF(nif: string): boolean {
  const clean = (nif || '').replace(/\s/g, '');
  if (!/^\d{9}$/.test(clean)) return false;

  // First digit must be one of the valid categories (AT rule)
  const validFirstDigits = ['1', '2', '3', '5', '6', '7', '8', '9'];
  if (!validFirstDigits.includes(clean[0])) return false;

  // Check digit: modulo 11 (same as src/lib/nifValidator.ts)
  const weights = [9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(clean[i], 10) * weights[i];
  }
  const remainder = sum % 11;
  const checkDigit = (remainder === 0 || remainder === 1) ? 0 : 11 - remainder;
  return checkDigit === parseInt(clean[8], 10);
}

function normalizeVatId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  if (!compact) return null;

  const normalized = compact.replace(/[^A-Z0-9]/g, '');
  if (!normalized) return null;

  // Avoid treating PT NIF as VAT.
  if (/^\d{9}$/.test(normalized)) return null;
  if (/^PT\d{9}$/.test(normalized)) return null;

  // Typical foreign VAT: 2-letter country code + alphanum
  if (!/^[A-Z]{2}[A-Z0-9]{2,}$/.test(normalized)) return null;
  return normalized;
}

async function callLovableAI(params: {
  apiKey: string;
  prompt: string;
  dataUrl: string;
  temperature?: number;
}): Promise<string> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: params.prompt },
            { type: 'image_url', image_url: { url: params.dataUrl } },
          ],
        },
      ],
      temperature: params.temperature ?? 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(`AI API error: ${response.status}`);
    // @ts-expect-error - attach extra debug fields
    err.status = response.status;
    // @ts-expect-error - attach extra debug fields
    err.body = errorText;
    throw err;
  }

  const aiData = await response.json();
  const content = aiData.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in AI response');
  return content;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[extract-invoice-data] Request received');

    // NOTE: Auth skipped intentionally. This function only calls the AI gateway
    // and returns extracted data. It does NOT access the database.
    // All DB writes happen client-side in bulkInvoiceProcessor.ts with the user's session.
    // The function has verify_jwt=false in config.toml and is called from authenticated clients only.

    // Parse request body with error handling for large payloads
    let fileData: string;
    let mimeType: string;
    try {
      const body = await req.json();
      fileData = body.fileData;
      mimeType = body.mimeType;
      const payloadSize = JSON.stringify(body).length;
      console.log('[extract-invoice-data] Payload size:', Math.round(payloadSize / 1024), 'KB');
    } catch (parseError) {
      console.error('[extract-invoice-data] Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar ficheiro. Verifique o tamanho e formato.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!fileData) {
      return new Response(
        JSON.stringify({ error: 'fileData is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate payload is not empty/truncated
    const base64Content = fileData.replace(/^data:[^;]+;base64,/, '');
    if (!base64Content || base64Content.length < 100) {
      console.error('[extract-invoice-data] Empty or truncated payload:', base64Content.length, 'chars');
      return new Response(
        JSON.stringify({ error: 'Ficheiro chegou vazio ao servidor. Tente novamente.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[extract-invoice-data] Extracting invoice data, mime:', mimeType, ', base64 size:', Math.round(base64Content.length / 1024), 'KB');

    // Use Lovable AI Gateway
    const AI_API_KEY = Deno.env.get('AI_API_KEY');
    if (!AI_API_KEY) {
      console.error('[extract-invoice-data] AI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço AI não configurado. Contacte o suporte.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[extract-invoice-data] Calling AI Gateway...');
    
    // Prepare base64 data with correct MIME type
    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const effectiveMime = mimeType || 'image/jpeg';
    const dataUrl = `data:${effectiveMime};base64,${base64Data}`;
    let content: string;
    try {
      content = await callLovableAI({
        apiKey: AI_API_KEY,
        prompt: EXTRACTION_PROMPT,
        dataUrl,
        temperature: 0.1,
      });
    } catch (error: unknown) {
      const status = (error as any)?.status as number | undefined;
      const body = (error as any)?.body as string | undefined;
      console.error('Lovable AI error:', status || 'unknown', body || error);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de pedidos excedido. Aguarde alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos AI esgotados. Contacte o administrador.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw error;
    }

    console.log('AI response:', content.substring(0, 500));

    // Parse JSON from response
    let extractedData: ExtractionResult;
    try {
      extractedData = parseJsonFromModel(content) as ExtractionResult;
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content.substring(0, 300));
      throw new Error('Invalid JSON in AI response');
    }

    // ============================================================
    // ARITHMETIC VALIDATION (post-LLM, deterministic)
    // ============================================================
    let arithmeticChecks = validateArithmetic(extractedData);
    let arithmeticValidated = arithmeticChecks.line_vat_ok && arithmeticChecks.totals_ok;
    let arithmeticCorrected = false;
    const correctedValues: Record<string, { from: number; to: number }> = {};

    if (!arithmeticChecks.line_vat_ok) {
      console.warn('Arithmetic warning (line VAT): deltas =', JSON.stringify(arithmeticChecks.line_deltas));

      // ── Auto-correction: recalculate VAT from base × rate ──
      // Safe because IVA = Base × Taxa is a deterministic fiscal rule.
      const region = extractedData.fiscal_region || 'PT';
      const rates = VAT_RATES[region] || VAT_RATES['PT'];
      const lines: { key: string; base: number; vat: number; rate: number }[] = [
        { key: 'reduced', base: extractedData.base_reduced || 0, vat: extractedData.vat_reduced || 0, rate: rates.reduced },
        { key: 'intermediate', base: extractedData.base_intermediate || 0, vat: extractedData.vat_intermediate || 0, rate: rates.intermediate },
        { key: 'standard', base: extractedData.base_standard || 0, vat: extractedData.vat_standard || 0, rate: rates.standard },
      ];

      let newTotalVat = 0;
      let anyCorrected = false;
      const correctedVats: Record<string, number> = {};

      for (const line of lines) {
        if (line.base > 0) {
          const expected = round2(line.base * line.rate);
          const delta = Math.abs(line.vat - expected);
          if (delta > 0.02) {
            // VAT is inconsistent — use calculated value
            correctedVats[line.key] = expected;
            correctedValues[`vat_${line.key}`] = { from: line.vat, to: expected };
            newTotalVat += expected;
            anyCorrected = true;
          } else {
            correctedVats[line.key] = line.vat;
            newTotalVat += line.vat;
          }
        }
      }

      if (anyCorrected) {
        // Verify: do corrected values produce a total consistent with total_amount?
        const sumBases = (extractedData.base_reduced || 0) + (extractedData.base_intermediate || 0) +
                         (extractedData.base_standard || 0) + (extractedData.base_exempt || 0);
        const newTotal = round2(sumBases + newTotalVat);
        const totalMatch = Math.abs(newTotal - extractedData.total_amount) <= 0.10;

        if (totalMatch) {
          // Apply corrections
          if (correctedValues['vat_reduced']) extractedData.vat_reduced = correctedVats['reduced'];
          if (correctedValues['vat_intermediate']) extractedData.vat_intermediate = correctedVats['intermediate'];
          if (correctedValues['vat_standard']) extractedData.vat_standard = correctedVats['standard'];
          extractedData.total_vat = round2(newTotalVat);
          extractedData.confidence = Math.max(10, (extractedData.confidence || 80) - 20);
          arithmeticCorrected = true;
          arithmeticValidated = true;
          console.log('Arithmetic auto-correction applied:', JSON.stringify(correctedValues));
        } else {
          console.warn('Auto-correction rejected: corrected total', newTotal, 'does not match document total', extractedData.total_amount);
        }
      }
    }
    if (!arithmeticChecks.totals_ok && !arithmeticCorrected) {
      console.warn('Arithmetic warning (document total): delta =', arithmeticChecks.total_delta);
    }

    const warnings: string[] = [];

    // ============================================================
    // TAX ID NORMALIZATION + SECOND PASS (handwritten/scans)
    // ============================================================
    const rawSupplierNif = extractedData.supplier_nif;
    const rawSupplierVat = extractedData.supplier_vat_id;

    let normalizedNif = extractPtNifDigits(rawSupplierNif) || extractPtNifDigits(rawSupplierVat);
    let normalizedVat = normalizeVatId(rawSupplierVat) || normalizeVatId(rawSupplierNif);

    let nifChecksumValid: boolean | null = null;
    if (normalizedNif) {
      nifChecksumValid = isValidPortugueseNIF(normalizedNif);
      if (!nifChecksumValid) {
        warnings.push('NIF portugues parece invalido (checksum) - confirmar manualmente');
      }
    }

    // Second pass if missing or ambiguous (invalid checksum and no foreign VAT).
    const needsSecondPass = (!normalizedNif && !normalizedVat) || (normalizedNif && nifChecksumValid === false && !normalizedVat);
    if (needsSecondPass) {
      try {
        const taxContent = await callLovableAI({
          apiKey: AI_API_KEY,
          prompt: TAX_ID_ONLY_PROMPT,
          dataUrl,
          temperature: 0.0,
        });
        const taxJson = parseJsonFromModel(taxContent) as Partial<ExtractionResult>;

        const secondNif = extractPtNifDigits(taxJson.supplier_nif) || extractPtNifDigits((taxJson as any).supplier_vat_id);
        const secondVat = normalizeVatId((taxJson as any).supplier_vat_id) || normalizeVatId(taxJson.supplier_nif);

        // Prefer a checksum-valid NIF when available.
        if (secondNif) {
          const secondValid = isValidPortugueseNIF(secondNif);
          if (secondValid || !normalizedNif) {
            normalizedNif = secondNif;
            nifChecksumValid = secondValid;
          }
        }
        if (secondVat && !normalizedVat) {
          normalizedVat = secondVat;
        }

        if (taxJson.customer_nif && !extractedData.customer_nif) {
          extractedData.customer_nif = taxJson.customer_nif;
        }
      } catch (err) {
        console.warn('[extract-invoice-data] Tax ID second-pass failed:', (err as any)?.status || err);
      }
    }

    extractedData.supplier_nif = normalizedNif || null;
    extractedData.supplier_vat_id = normalizedVat || null;

    if (!extractedData.supplier_nif && !extractedData.supplier_vat_id) {
      warnings.push('Identificador fiscal do fornecedor nao encontrado (guardada para revisao)');
      extractedData.confidence = Math.min(extractedData.confidence || 80, 40);
    } else if (extractedData.supplier_vat_id && !extractedData.supplier_nif) {
      warnings.push('Fornecedor estrangeiro (VAT nao PT) - confirmar dedutibilidade');
    }

    const normalizedDate = normalizeDocumentDate(extractedData.document_date);
    if (!normalizedDate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Não foi possível extrair a data do documento',
          data: extractedData,
          warnings,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    extractedData.document_date = normalizedDate;
    const derivedFiscalPeriod = deriveFiscalPeriodFromDocumentDate(normalizedDate);
    if (extractedData.fiscal_period && String(extractedData.fiscal_period).trim() !== derivedFiscalPeriod) {
      warnings.push(`Período fiscal corrigido para ${derivedFiscalPeriod} com base na data do documento`);
    }
    extractedData.fiscal_period = derivedFiscalPeriod;

    if (!extractedData.total_amount || extractedData.total_amount <= 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Não foi possível extrair o valor total',
          data: extractedData,
          warnings,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // EDP multi-section fallback:
    // Ask AI for TOTAL IVA of the full document (not section-level lines).
    // ============================================================
    if (isLikelyEdpInvoice(extractedData)) {
      try {
        const edpContent = await callLovableAI({
          apiKey: AI_API_KEY,
          prompt: EDP_VAT_COMPONENTS_PROMPT,
          dataUrl,
          temperature: 0.0,
        });
        const edpJson = parseJsonFromModel(edpContent) as EdpVatComponentsResult;

        const edpTotalIva = parseCurrencyValue(edpJson.total_iva);
        const regValue = parseCurrencyValue(edpJson.regularization);
        const regularizationAmount = (regValue !== null && regValue > 0 && regValue < 50) ? regValue : 0;

        if (edpTotalIva !== null && edpTotalIva > 0) {
          const previousTotalVat = round2(extractedData.total_vat || 0);
          const fullTotal = round2(edpTotalIva + regularizationAmount);
          const sanity = evaluateEdpFallbackSanity({ previousTotalVat, fullTotal });

          if (sanity.isSane && Math.abs(fullTotal - previousTotalVat) > 0.02) {
            extractedData.total_vat = fullTotal;
            correctedValues.total_vat = { from: previousTotalVat, to: fullTotal };
            warnings.push(`IVA EDP recalculado (${previousTotalVat.toFixed(2)} -> ${fullTotal.toFixed(2)})`);
            arithmeticCorrected = true;
          } else if (!sanity.isSane) {
            const ratioText = sanity.ratio === null ? 'n/a' : sanity.ratio.toFixed(2);
            warnings.push(`IVA EDP fallback rejeitado (${fullTotal.toFixed(2)} vs primário ${previousTotalVat.toFixed(2)}, rácio=${ratioText}, delta=${sanity.deltaAbs.toFixed(2)}) - verificar manualmente`);
          }

          if (regularizationAmount > 0) {
            warnings.push(`Regularização EDP detetada: ${regularizationAmount.toFixed(2)}€ (Campo 41) - não incluir em Campo 24`);
          }
        }
      } catch (err) {
        console.warn('[extract-invoice-data] EDP VAT-components pass failed:', (err as any)?.status || err);
      }
    }

    if (arithmeticCorrected) {
      arithmeticChecks = validateArithmetic(extractedData);
      arithmeticValidated = arithmeticChecks.line_vat_ok && arithmeticChecks.totals_ok;
    }

    // SECURITY: Don't log sensitive data (NIF, amounts)
    console.log('Extraction successful for document:', extractedData.document_number || 'unknown');
    console.log('Arithmetic validated:', arithmeticValidated);

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
        warnings: warnings.length > 0 ? warnings : undefined,
        arithmetic_checks: arithmeticChecks,
        arithmetic_validated: arithmeticValidated,
        arithmetic_corrected: arithmeticCorrected,
        corrected_values: Object.keys(correctedValues).length > 0 ? correctedValues : undefined,
        model: 'gemini-2.5-flash'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in extract-invoice-data function:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
