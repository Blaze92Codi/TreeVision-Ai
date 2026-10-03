import { createClient } from "npm:@supabase/supabase-js@2.117.2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // public intake; never an authorization boundary
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function responseError(err: unknown): Response {
  const status = err instanceof RequestError ? err.status : 500;
  return new Response(JSON.stringify({ error: status === 500 ? "Request failed" : (err as Error).message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
export function methodResponse(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: corsHeaders });
  return null;
}
export function serverClient() {
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Server configuration unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function readJson(req: Request, limit: number): Promise<Record<string, any>> {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new RequestError(415, "Expected application/json");
  const reader = req.body?.getReader();
  if (!reader) throw new RequestError(400, "Missing body");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new RequestError(413, "Request too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || Array.isArray(body) || typeof body !== "object") throw new Error();
    return body;
  } catch { throw new RequestError(400, "Invalid JSON object"); }
}
export async function requireStaff(req: Request, client: ReturnType<typeof serverClient>) {
  const token = req.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new RequestError(401, "Staff login required");
  // getUser verifies the JWT with Auth; decoding a client-supplied JWT is insufficient.
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new RequestError(401, "Staff login required");
  const membership = await client.from("staff_members").select("user_id")
    .eq("user_id", data.user.id).maybeSingle();
  if (membership.error || !membership.data) throw new RequestError(403, "Staff access required");
  return data.user;
}
export async function consumeBudget(client: ReturnType<typeof serverClient>, action: string) {
  const { data, error } = await client.rpc("consume_intake_budget", { action_name: action });
  if (error) throw new RequestError(503, "Intake unavailable");
  if (data !== true) throw new RequestError(429, "Daily intake limit reached. Please contact our team.");
}
export function text(value: unknown, max: number, required = false): string | null {
  if (value == null && !required) return null;
  if (typeof value !== "string" || value.length > max || (required && !value.trim()))
    throw new RequestError(400, "Invalid text field");
  return value.trim() || null;
}
export function image(dataUrl: unknown): { bytes: Uint8Array; type: string; ext: string } | null {
  if (dataUrl == null) return null;
  if (typeof dataUrl !== "string") throw new RequestError(400, "Invalid photo");
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!m || m[2].length > 11200000) throw new RequestError(400, "Invalid photo");
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0)); }
  catch { throw new RequestError(400, "Invalid photo"); }
  const valid = m[1] === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : m[1] === "image/png" ? [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)
    : new TextDecoder().decode(bytes.slice(0,4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8,12)) === "WEBP";
  if (!valid || bytes.length > 8 * 1024 * 1024) throw new RequestError(400, "Invalid photo");
  return { bytes, type: m[1], ext: m[1] === "image/jpeg" ? "jpg" : m[1].slice(6) };
}
export function analysisRequest(body: Record<string, any>) {
  const content = body.messages?.[0]?.content;
  if (body.messages?.length !== 1 || body.messages[0].role !== "user" || !Array.isArray(content) || content.length !== 2)
    throw new RequestError(400, "Expected one photo and assessment prompt");
  const photo = content.find((c: any) => c.type === "image");
  const prompt = content.find((c: any) => c.type === "text");
  if (!photo || photo.source?.type !== "base64" || !image(`data:${photo.source.media_type};base64,${photo.source.data}`))
    throw new RequestError(400, "Invalid photo");
  text(prompt?.text, 16000, true);
  // Never forward arbitrary model/tool/system/stream/token options to a paid API.
  return { model: "claude-sonnet-4-5", max_tokens: 2000, messages: [{ role: "user", content }] };
}
