import { describe, it, expect } from "vitest";
import { verifyCalendlySignature, extractQuoteId, extractBookingFields } from "../src/calendly";

// Produce a valid "t=<ts>,v1=<hmac>" header the way Calendly does, so we can
// test verification against real HMAC-SHA256 output rather than a fixed vector.
async function signHeader(key: string, body: string, ts: number): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(`${ts}.${body}`));
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
  return `t=${ts},v1=${hex}`;
}

const KEY = "test-signing-key";
const BODY = JSON.stringify({ event: "invitee.created" });

describe("verifyCalendlySignature", () => {
  it("accepts a correctly signed, fresh payload", async () => {
    const now = Math.floor(Date.now() / 1000);
    const header = await signHeader(KEY, BODY, now);
    expect(await verifyCalendlySignature(KEY, header, BODY)).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const now = Math.floor(Date.now() / 1000);
    const header = await signHeader(KEY, BODY, now);
    expect(await verifyCalendlySignature(KEY, header, BODY + "x")).toBe(false);
  });

  it("rejects the wrong signing key", async () => {
    const now = Math.floor(Date.now() / 1000);
    const header = await signHeader(KEY, BODY, now);
    expect(await verifyCalendlySignature("other-key", header, BODY)).toBe(false);
  });

  it("rejects replays older than 5 minutes", async () => {
    const old = Math.floor(Date.now() / 1000) - 301;
    const header = await signHeader(KEY, BODY, old);
    expect(await verifyCalendlySignature(KEY, header, BODY)).toBe(false);
  });

  it("returns false when the signing key or header is missing", async () => {
    const now = Math.floor(Date.now() / 1000);
    const header = await signHeader(KEY, BODY, now);
    expect(await verifyCalendlySignature("", header, BODY)).toBe(false);
    expect(await verifyCalendlySignature(KEY, null, BODY)).toBe(false);
  });

  it("returns false for a malformed header (missing t or v1)", async () => {
    expect(await verifyCalendlySignature(KEY, "v1=abc", BODY)).toBe(false);
    expect(await verifyCalendlySignature(KEY, "garbage", BODY)).toBe(false);
  });
});

describe("extractQuoteId", () => {
  it("prefers utm_content", () => {
    const payload = { payload: { tracking: { utm_content: "quote-123" } } };
    expect(extractQuoteId(payload)).toBe("quote-123");
  });

  it("falls back to a qid: prefixed utm_campaign", () => {
    const payload = { payload: { tracking: { utm_campaign: "qid:quote-456" } } };
    expect(extractQuoteId(payload)).toBe("quote-456");
  });

  it("returns null when no quote id is present", () => {
    expect(extractQuoteId({ payload: { tracking: {} } })).toBeNull();
    expect(extractQuoteId({})).toBeNull();
    // A utm_campaign without the qid: prefix is not treated as a quote id.
    expect(extractQuoteId({ payload: { tracking: { utm_campaign: "spring-sale" } } })).toBeNull();
  });
});

describe("extractBookingFields", () => {
  it("pulls core fields and matches phone/address questions case-insensitively", () => {
    const payload = {
      payload: {
        event: "https://api.calendly.com/scheduled_events/EV",
        uri: "https://api.calendly.com/scheduled_events/EV/invitees/IN",
        name: "Jane Doe",
        email: "jane@example.com",
        scheduled_event: { start_time: "2026-06-10T15:00:00.000Z" },
        questions_and_answers: [
          { question: "Phone Number", answer: "555-1234" },
          { question: "Property Address", answer: "1 Main St" },
          { question: "Gate code?", answer: "4242" },
        ],
      },
    };
    const f = extractBookingFields(payload);
    expect(f).toMatchObject({
      calendlyEvent: "https://api.calendly.com/scheduled_events/EV",
      calendlyUri: "https://api.calendly.com/scheduled_events/EV/invitees/IN",
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "555-1234",
      scheduledFor: "2026-06-10T15:00:00.000Z",
    });
    // Notes lead with the address, then include other Q&A, excluding phone/address.
    expect(f.notes).toBe("Address: 1 Main St\nGate code?: 4242");
  });

  it("returns all-null fields for an empty payload", () => {
    const f = extractBookingFields({});
    expect(f).toEqual({
      calendlyEvent: null,
      calendlyUri: null,
      name: null,
      email: null,
      phone: null,
      scheduledFor: null,
      notes: null,
    });
  });
});
