import { describe, it, expect, beforeEach } from "vitest";
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { app } from "../src/index";

const E = env as any;
const SIGNING_KEY = "test-calendly-key"; // matches vitest.config miniflare binding

beforeEach(async () => {
  await E.DB.batch([
    E.DB.prepare("DELETE FROM interactions"),
    E.DB.prepare("DELETE FROM bookings"),
    E.DB.prepare("DELETE FROM trees"),
    E.DB.prepare("DELETE FROM estimates"),
    E.DB.prepare("DELETE FROM contacts"),
  ]);
});

// Produce the "t=<ts>,v1=<hmac>" header Calendly sends, over `${ts}.${rawBody}`.
async function sign(rawBody: string, ts = Math.floor(Date.now() / 1000)): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SIGNING_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${rawBody}`));
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
  return `t=${ts},v1=${hex}`;
}

// The operator-email branch reads the request origin via executionCtx, so pass
// a real one and flush deferred work before asserting.
async function post(rawBody: string, sigHeader: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (sigHeader) headers["calendly-webhook-signature"] = sigHeader;
  const ctx = createExecutionContext();
  const res = await app.request("/api/webhooks/calendly", { method: "POST", headers, body: rawBody }, E, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe("POST /api/webhooks/calendly", () => {
  it("rejects a request with a bad/missing signature", async () => {
    const raw = JSON.stringify({ event: "invitee.created" });
    expect((await post(raw, null)).status).toBe(401);
    expect((await post(raw, "t=1,v1=deadbeef")).status).toBe(401);
  });

  it("acknowledges but ignores non-booking events", async () => {
    const raw = JSON.stringify({ event: "invitee.canceled" });
    const res = await post(raw, await sign(raw));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, ignored: "invitee.canceled" });
  });

  it("records a booking and marks the estimate booked", async () => {
    // Seed a contact + submitted estimate the booking will attach to.
    await E.DB.prepare("INSERT INTO contacts (id, name, email, phone) VALUES ('c1','Jane','jane@x.com','555-1')").run();
    await E.DB.prepare(
      "INSERT INTO estimates (id, contact_id, status, share_token) VALUES ('est1','c1','submitted','tok1')"
    ).run();

    const raw = JSON.stringify({
      event: "invitee.created",
      payload: {
        event: "https://api.calendly.com/scheduled_events/EV",
        uri: "https://api.calendly.com/scheduled_events/EV/invitees/IN",
        name: "Jane Doe",
        email: "jane@x.com",
        tracking: { utm_content: "est1" },
        scheduled_event: { start_time: "2026-06-10T15:00:00.000Z" },
        questions_and_answers: [{ question: "Phone", answer: "555-1" }],
      },
    });

    const res = await post(raw, await sign(raw));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.estimate_id).toBe("est1");
    expect(body.booking_id).toBeTruthy();

    // Booking row persisted with the scheduled time, estimate flipped to booked.
    const booking = await E.DB.prepare("SELECT * FROM bookings WHERE estimate_id = 'est1'").first();
    expect(booking.scheduled_for).toBe("2026-06-10T15:00:00.000Z");
    expect(booking.contact_id).toBe("c1");

    const est = await E.DB.prepare("SELECT status FROM estimates WHERE id = 'est1'").first<{ status: string }>();
    expect(est?.status).toBe("booked");

    // A system interaction is logged against the contact.
    const interaction = await E.DB.prepare(
      "SELECT body FROM interactions WHERE contact_id = 'c1' AND channel = 'system'"
    ).first<{ body: string }>();
    expect(interaction?.body).toMatch(/Booked Calendly slot/);
  });

  it("rejects a malformed JSON body after the signature passes", async () => {
    const raw = "{ not json";
    const res = await post(raw, await sign(raw));
    expect(res.status).toBe(400);
  });
});
