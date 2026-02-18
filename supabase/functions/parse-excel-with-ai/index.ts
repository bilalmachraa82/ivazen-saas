/**
 * Parse Excel with AI - Gemini-powered Excel parsing
 * Handles both invoice lists AND summary/apuramento files
 * v1.0.0
 */

import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_API_KEY = Deno.env.get("AI_API_KEY");

// System prompt for Excel analysis
const EXCEL_ANALYSIS_PROMPT = `Você é um assistente especializado em análise de ficheiros Excel portugueses de contabilidade.

Analise os dados fornecidos e determine:
1. O TIPO de ficheiro:
   - "invoice_list": Lista de facturas linha a linha (tem NIFs por linha, datas, valores individuais)
   - "summary": Apuramento/Resumo de IVA (totais agregados sem NIFs por linha)
   - "modelo10": Retenções na fonte (tem NIFs de beneficiários e valores de retenção)

2. Se for "summary" (apuramento), extraia os TOTAIS:
   - iva_dedutivel: IVA dedutível total
   - iva_liquidado: IVA liquidado total
   - base_tributavel: Base tributável total
   - saldo_iva: Saldo (liquidado - dedutível)

3. Se for "invoice_list", mapeie as colunas para os campos internos:
   - nif, supplier_name, document_date, document_number, total_amount
   - base_standard (23%), vat_standard (23%)
   - base_intermediate (13%), vat_intermediate (13%)
   - base_reduced (6%), vat_reduced (6%)
   - base_exempt (0%)

4. Se for "modelo10", mapeie:
   - beneficiary_nif, beneficiary_name, gross_amount, withholding_amount, withholding_rate

Responda APENAS com a função tool_call, nunca com texto livre.`;

// Tool definition for structured output
const EXCEL_ANALYSIS_TOOL = {
  type: "function",
  function: {
    name: "analyze_excel",
    description: "Analisa e extrai dados de um ficheiro Excel de contabilidade",
    parameters: {
      type: "object",
      properties: {
        file_type: {
          type: "string",
          enum: ["invoice_list", "summary", "modelo10"],
          description: "Tipo de ficheiro detectado",
        },
        confidence: {
          type: "number",
          description: "Confiança na detecção (0.0 a 1.0)",
        },
        summary_totals: {
          type: "object",
          description: "Totais extraídos se for tipo summary",
          properties: {
            iva_dedutivel: { type: "number" },
            iva_liquidado: { type: "number" },
            base_tributavel: { type: "number" },
            saldo_iva: { type: "number" },
            periodo: { type: "string" },
          },
        },
        column_mapping: {
          type: "object",
          description: "Mapeamento de colunas se for invoice_list/modelo10",
          additionalProperties: { type: "string" },
        },
        extracted_records: {
          type: "array",
          description: "Registos extraídos (máximo 100)",
          items: {
            type: "object",
            properties: {
              nif: { type: "string" },
              name: { type: "string" },
              date: { type: "string" },
              document_number: { type: "string" },
              total_amount: { type: "number" },
              base_standard: { type: "number" },
              vat_standard: { type: "number" },
              base_intermediate: { type: "number" },
              vat_intermediate: { type: "number" },
              base_reduced: { type: "number" },
              vat_reduced: { type: "number" },
              base_exempt: { type: "number" },
              gross_amount: { type: "number" },
              withholding_amount: { type: "number" },
              withholding_rate: { type: "number" },
            },
          },
        },
        warnings: {
          type: "array",
          items: { type: "string" },
          description: "Avisos sobre problemas encontrados",
        },
      },
      required: ["file_type", "confidence"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileBase64, fileName } = await req.json();

    if (!fileBase64) {
      return new Response(
        JSON.stringify({ error: "fileBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!AI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode base64 to buffer
    const binaryString = atob(fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Parse Excel
    const workbook = XLSX.read(bytes, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Get raw data as array of arrays
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
    
    if (!rawData || rawData.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Ficheiro Excel vazio ou formato não suportado" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare sample for AI (first 30 rows, all columns)
    const sampleRows = rawData.slice(0, 30);
    const sampleData = {
      fileName: fileName || "unknown.xlsx",
      sheetName,
      totalRows: rawData.length,
      columns: rawData[0]?.length || 0,
      sample: sampleRows.map((row, i) => ({
        row: i + 1,
        data: row,
      })),
    };

    console.log(`Processing Excel: ${fileName}, ${rawData.length} rows, ${sampleRows.length} sample rows`);

    // Call Gemini for analysis
    const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: EXCEL_ANALYSIS_PROMPT },
          { 
            role: "user", 
            content: `Analise este ficheiro Excel e extraia os dados:\n\n${JSON.stringify(sampleData, null, 2)}`
          },
        ],
        tools: [EXCEL_ANALYSIS_TOOL],
        tool_choice: { type: "function", function: { name: "analyze_excel" } },
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required for AI features" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    
    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(aiData));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "AI não conseguiu analisar o ficheiro",
          debug: aiData,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;
    try {
      result = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse tool call arguments:", toolCall.function.arguments);
      throw new Error("Invalid AI response format");
    }

    console.log(`AI Analysis result: type=${result.file_type}, confidence=${result.confidence}`);

    return new Response(
      JSON.stringify({
        success: true,
        fileType: result.file_type,
        confidence: result.confidence,
        summaryTotals: result.summary_totals || null,
        columnMapping: result.column_mapping || null,
        records: result.extracted_records || [],
        warnings: result.warnings || [],
        totalRowsInFile: rawData.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("parse-excel-with-ai error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Erro ao processar Excel" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
