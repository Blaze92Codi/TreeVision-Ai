/**
 * Calendly webhook signature verification.
 * https://developer.calendly.com/api-docs/ZG9jOjE2OTczNDMy-webhook-signatures
 *
 * Header format: t=<timestamp>,v1=<hex-hmac-sha256>
 */
export async function verifyCalendlySignature(
  signingKey: string,
  signatureHeader: string | null,
  rawBody: string,
): Promise<boolean> {
  if (!signingKey || !signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map(p => {
      const idx = p.indexOf("=");
      return idx === -1 ? [p, ""] : [p.slice(0, idx), p.slice(idx + 1)];
    })
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  // Reject replays older than 5 minutes
  const ts = parseInt(t, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const payload = `${t}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");

  return timingSafeEqual(hex, v1);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Extracts our quote_id from Calendly payload.
 * We pass it as utm_content when redirecting to Calendly.
 */
export function extractQuoteId(payload: any): string | null {
  const tracking = payload?.payload?.tracking;
  if (tracking?.utm_content) return String(tracking.utm_content);
  // Fallbacks
  const qs = payload?.payload?.tracking?.utm_campaign;
  if (qs && typeof qs === "string" && qs.startsWith("qid:")) return qs.slice(4);
  return null;
}

export function extractBookingFields(payload: any): {
  calendlyEvent: string | null;
  calendlyUri: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  scheduledFor: string | null;
  notes: string | null;
} {
  const p = payload?.payload ?? {};
  const questions: any[] = p.questions_and_answers ?? [];

  // Calendly's "Phone" question id varies — pick any field with "phone" in question
  const phoneAnswer = questions.find(q => typeof q?.question === "string" && /phone/i.test(q.question))?.answer ?? null;
  const addressAnswer = questions.find(q => typeof q?.question === "string" && /address/i.test(q.question))?.answer ?? null;

  return {
    calendlyEvent: p?.event ?? null,
    calendlyUri:   p?.uri ?? null,
    name:          p?.name ?? null,
    email:         p?.email ?? null,
    phone:         phoneAnswer,
    scheduledFor:  p?.scheduled_event?.start_time ?? null,
    notes:         [
      addressAnswer ? `Address: ${addressAnswer}` : null,
      ...questions
        .filter(q => !/phone|address/i.test(q?.question ?? ""))
        .map(q => `${q.question}: ${q.answer}`)
    ].filter(Boolean).join("\n") || null,
  };
}
