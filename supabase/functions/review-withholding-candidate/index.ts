import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "https://ivazen-saas.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INCOME_CATEGORIES = new Set(["A", "B", "D", "E", "F", "G", "H", "R"]);

interface ReviewWithholdingCandidateRequest {
  candidateId: string;
  updates: {
    beneficiary_name?: string | null;
    beneficiary_nif?: string;
    document_reference?: string;
    payment_date?: string;
    income_category?: string;
    gross_amount?: number;
    withholding_rate?: number | null;
    withholding_amount?: number;
    notes?: string | null;
  };
}

function isValidNif(value: string): boolean {
  return /^\d{9}$/.test(value);
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json() as ReviewWithholdingCandidateRequest;
    const candidateId = body.candidateId?.trim();
    const updates = body.updates || {};

    if (!candidateId) {
      return new Response(
        JSON.stringify({ error: "candidateId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from("at_withholding_candidates")
      .select("*")
      .eq("id", candidateId)
      .maybeSingle();

    if (candidateError || !candidate) {
      return new Response(
        JSON.stringify({ error: "Candidato não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const { data: accountantAccess } = await supabaseAdmin
      .from("client_accountants")
      .select("client_id")
      .eq("client_id", candidate.client_id)
      .eq("accountant_id", user.id)
      .maybeSingle();

    const hasAccess = candidate.client_id === user.id || !!adminRole || !!accountantAccess;
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: "Forbidden: no access to this client" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (candidate.status === "promoted") {
      return new Response(
        JSON.stringify({ error: "Candidatos já promovidos não podem ser editados" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nextBeneficiaryNif = (updates.beneficiary_nif ?? candidate.beneficiary_nif)?.trim();
    const nextDocumentReference = (updates.document_reference ?? candidate.document_reference)?.trim();
    const nextPaymentDate = (updates.payment_date ?? candidate.payment_date)?.trim();
    const nextIncomeCategory = (updates.income_category ?? candidate.income_category)?.trim();
    const nextGrossAmount = Number(updates.gross_amount ?? candidate.gross_amount);
    const nextWithholdingAmount = Number(updates.withholding_amount ?? candidate.withholding_amount);
    const nextWithholdingRate =
      updates.withholding_rate === null
        ? null
        : Number(updates.withholding_rate ?? candidate.withholding_rate ?? 0);

    if (!nextBeneficiaryNif || !isValidNif(nextBeneficiaryNif)) {
      return new Response(
        JSON.stringify({ error: "beneficiary_nif inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!nextDocumentReference) {
      return new Response(
        JSON.stringify({ error: "document_reference é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!nextPaymentDate || !isValidIsoDate(nextPaymentDate)) {
      return new Response(
        JSON.stringify({ error: "payment_date inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!nextIncomeCategory || !INCOME_CATEGORIES.has(nextIncomeCategory)) {
      return new Response(
        JSON.stringify({ error: "income_category inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!Number.isFinite(nextGrossAmount) || nextGrossAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "gross_amount deve ser maior que zero" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!Number.isFinite(nextWithholdingAmount) || nextWithholdingAmount < 0) {
      return new Response(
        JSON.stringify({ error: "withholding_amount inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (nextWithholdingRate !== null && (!Number.isFinite(nextWithholdingRate) || nextWithholdingRate < 0 || nextWithholdingRate > 100)) {
      return new Response(
        JSON.stringify({ error: "withholding_rate inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const changedFields: string[] = [];
    const markChanged = (field: string, before: unknown, after: unknown) => {
      if (before !== after) changedFields.push(field);
    };

    markChanged("beneficiary_nif", candidate.beneficiary_nif, nextBeneficiaryNif);
    markChanged("beneficiary_name", candidate.beneficiary_name ?? "", updates.beneficiary_name ?? candidate.beneficiary_name ?? "");
    markChanged("document_reference", candidate.document_reference, nextDocumentReference);
    markChanged("payment_date", candidate.payment_date, nextPaymentDate);
    markChanged("income_category", candidate.income_category, nextIncomeCategory);
    markChanged("gross_amount", Number(candidate.gross_amount), nextGrossAmount);
    markChanged("withholding_amount", Number(candidate.withholding_amount), nextWithholdingAmount);
    markChanged("withholding_rate", candidate.withholding_rate ?? null, nextWithholdingRate);

    const now = new Date().toISOString();
    const reviewEntry = changedFields.length > 0
      ? `[${now}] manual_review:${changedFields.join(",")}`
      : `[${now}] manual_review:no_field_changes`;

    const mergedNotes = [candidate.notes, updates.notes, reviewEntry]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join("\n");

    const rawPayload = typeof candidate.raw_payload === "object" && candidate.raw_payload !== null
      ? {
          ...(candidate.raw_payload as Record<string, unknown>),
          manual_review: {
            by: user.id,
            at: now,
            changed_fields: changedFields,
          },
        }
      : {
          manual_review: {
            by: user.id,
            at: now,
            changed_fields: changedFields,
          },
        };

    const { data: updatedCandidate, error: updateError } = await supabaseAdmin
      .from("at_withholding_candidates")
      .update({
        beneficiary_name: updates.beneficiary_name ?? candidate.beneficiary_name,
        beneficiary_nif: nextBeneficiaryNif,
        document_reference: nextDocumentReference,
        payment_date: nextPaymentDate,
        income_category: nextIncomeCategory,
        gross_amount: nextGrossAmount,
        withholding_amount: nextWithholdingAmount,
        withholding_rate: nextWithholdingRate,
        notes: mergedNotes || null,
        raw_payload: rawPayload,
        reviewed_by: user.id,
        reviewed_at: now,
        rejection_reason: null,
        status: "pending",
      })
      .eq("id", candidateId)
      .select("*")
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, candidate: updatedCandidate }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
