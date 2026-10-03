import { corsHeaders, methodResponse, readJson, analysisRequest, consumeBudget, serverClient, responseError, RequestError } from "../_shared/security.ts";

Deno.serve(async req => {
  const early = methodResponse(req); if (early) return early;
  try {
    const body = analysisRequest(await readJson(req, 12 * 1024 * 1024));
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) throw new Error("Server configuration unavailable");
    await consumeBudget(serverClient(), "analyze");
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: AbortSignal.timeout(60000),
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!upstream.ok) { await upstream.body?.cancel(); throw new RequestError(502, "Analysis unavailable"); }
    return new Response(await upstream.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) { return responseError(err); }
});
