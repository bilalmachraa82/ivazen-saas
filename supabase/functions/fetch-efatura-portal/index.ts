/**
 * fetch-efatura-portal Edge Function — DEPRECATED / DISABLED
 *
 * This function previously scraped the AT e-Fatura portal using session-based
 * authentication. Portal scraping is no longer used because:
 * 1. It is not a legal/supported integration method
 * 2. AT mandatory 2FA blocks automated logins
 * 3. The official SOAP/mTLS webservice (via at-connector VPS) is now the only
 *    supported method (see sync-efatura)
 *
 * This function returns 410 Gone for any request.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "https://ivazen-saas.vercel.app",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      success: false,
      error:
        "Portal scraping desativado. Use o webservice oficial AT via sync-efatura.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
