import { describe, it, expect, beforeEach } from "vitest";
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { app } from "../src/index";

const E = env as any;

beforeEach(async () => {
  await E.DB.batch([
    E.DB.prepare("DELETE FROM interactions"),
    E.DB.prepare("DELETE FROM trees"),
    E.DB.prepare("DELETE FROM estimates"),
    E.DB.prepare("DELETE FROM contacts"),
  ]);
});

async function newEstimate(): Promise<string> {
  const r = await (await app.request("/api/estimate", { method: "POST" }, E)).json();
  return r.estimate_id;
}

async function attachContact(estimateId: string) {
  return app.request(
    `/api/estimate/${estimateId}/contact`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Jane", email: "jane@x.com", phone: "555-1" }),
    },
    E,
  );
}

async function addTree(estimateId: string) {
  await E.DB.prepare(
    "INSERT INTO trees (id, estimate_id, photo_key, ai_raw, selected_pkg, quote_low, quote_high) VALUES (?, ?, ?, '{}', 'trim', 200, 550)"
  ).bind(crypto.randomUUID(), estimateId, `trees/${crypto.randomUUID()}.jpg`).run();
}

// The submit handler defers notifications via executionCtx.waitUntil and reads
// the request origin through it, so a real ExecutionContext must be supplied.
async function submit(estimateId: string) {
  const ctx = createExecutionContext();
  const res = await app.request(`/api/estimate/${estimateId}/submit`, { method: "POST" }, E, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe("POST /api/estimate/:id/submit", () => {
  it("404s for an unknown estimate", async () => {
    expect((await submit("nope")).status).toBe(404);
  });

  it("400s when no contact has been provided", async () => {
    const id = await newEstimate();
    const res = await submit(id);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/contact info required/i);
  });

  it("400s when the estimate has no trees", async () => {
    const id = await newEstimate();
    await attachContact(id);
    const res = await submit(id);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least one tree/i);
  });

  it("submits successfully and locks the estimate", async () => {
    const id = await newEstimate();
    await attachContact(id);
    await addTree(id);
    const res = await submit(id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: "submitted" });

    const est = await E.DB.prepare("SELECT status, submitted_at FROM estimates WHERE id = ?").bind(id).first<any>();
    expect(est.status).toBe("submitted");
    expect(est.submitted_at).toBeTruthy();
  });

  it("is idempotent — a second submit returns the existing status without erroring", async () => {
    const id = await newEstimate();
    await attachContact(id);
    await addTree(id);
    await submit(id);
    const res = await submit(id);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("submitted");
  });
});
