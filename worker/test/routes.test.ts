import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { app } from "../src/index";

// Drive real route handlers through Hono with the live D1 binding. Hono's
// app.request(path, init, env) runs the full middleware + handler stack.
const E = env as any;

// Routes that touch the DB assume a clean slate; wipe between tests.
beforeEach(async () => {
  await E.DB.batch([
    E.DB.prepare("DELETE FROM interactions"),
    E.DB.prepare("DELETE FROM trees"),
    E.DB.prepare("DELETE FROM estimates"),
    E.DB.prepare("DELETE FROM contacts"),
  ]);
});

async function createEstimate(): Promise<{ estimate_id: string; share_token: string }> {
  const res = await app.request("/api/estimate", { method: "POST" }, E);
  expect(res.status).toBe(200);
  return res.json();
}

describe("GET /api/config", () => {
  it("returns public config from env vars", async () => {
    const res = await app.request("/api/config", {}, E);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.company_name).toBe("Dynamic Tree Service");
    expect(body.turnstile_required).toBe(false); // no TURNSTILE_SECRET in test env
    expect(body.bundle_tiers).toEqual([
      { min_trees: 2, pct: 5 },
      { min_trees: 3, pct: 10 },
    ]);
  });
});

describe("POST /api/estimate + GET /api/estimate/:id", () => {
  it("creates a draft estimate and reads it back", async () => {
    const { estimate_id, share_token } = await createEstimate();
    expect(estimate_id).toBeTruthy();
    expect(share_token).toBeTruthy();

    const res = await app.request(`/api/estimate/${estimate_id}`, {}, E);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.estimate.status).toBe("draft");
    expect(body.trees).toEqual([]);
    expect(body.contact).toBeNull();
  });

  it("404s for an unknown estimate id", async () => {
    const res = await app.request("/api/estimate/does-not-exist", {}, E);
    expect(res.status).toBe(404);
  });

  it("resolves an estimate by its share token", async () => {
    const { estimate_id, share_token } = await createEstimate();
    const res = await app.request(`/api/estimate/by-token/${share_token}`, {}, E);
    expect(res.status).toBe(200);
    expect((await res.json()).estimate.id).toBe(estimate_id);
  });
});

describe("POST /api/estimate/:id/contact", () => {
  async function postContact(id: string, body: Record<string, unknown>) {
    return app.request(
      `/api/estimate/${id}/contact`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      E,
    );
  }

  it("rejects missing required fields", async () => {
    const { estimate_id } = await createEstimate();
    const res = await postContact(estimate_id, { name: "Jane" }); // no email/phone
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/required/i);
  });

  it("rejects an invalid email", async () => {
    const { estimate_id } = await createEstimate();
    const res = await postContact(estimate_id, { name: "Jane", email: "not-an-email", phone: "555-1234" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid email/i);
  });

  it("stores a contact, normalizes the email, and advances estimate status", async () => {
    const { estimate_id } = await createEstimate();
    const res = await postContact(estimate_id, {
      name: "Jane Doe",
      email: "  JANE@Example.com ",
      phone: "555-1234",
      address: "1 Main St",
    });
    expect(res.status).toBe(200);
    const { ok, contact_id } = await res.json();
    expect(ok).toBe(true);
    expect(contact_id).toBeTruthy();

    const view = await (await app.request(`/api/estimate/${estimate_id}`, {}, E)).json();
    expect(view.estimate.status).toBe("contact_provided");
    expect(view.contact.email).toBe("jane@example.com"); // trimmed + lowercased
    expect(view.contact.name).toBe("Jane Doe");
  });

  it("caps an over-long name at 120 characters", async () => {
    const { estimate_id } = await createEstimate();
    await postContact(estimate_id, { name: "a".repeat(200), email: "a@b.com", phone: "555-0000" });
    const view = await (await app.request(`/api/estimate/${estimate_id}`, {}, E)).json();
    expect(view.contact.name).toHaveLength(120);
  });

  it("reuses the same contact across estimates (upsert by email/phone)", async () => {
    const first = await createEstimate();
    const second = await createEstimate();
    const r1 = await (await postContact(first.estimate_id, { name: "Jane", email: "jane@x.com", phone: "555-1" })).json();
    const r2 = await (await postContact(second.estimate_id, { name: "Jane", email: "jane@x.com", phone: "555-1" })).json();
    expect(r2.contact_id).toBe(r1.contact_id);
  });
});

describe("admin auth (requireAdmin)", () => {
  it("401s without an Authorization header", async () => {
    const res = await app.request("/api/admin/leads", {}, E);
    expect(res.status).toBe(401);
  });

  it("401s with the wrong token", async () => {
    const res = await app.request("/api/admin/leads", { headers: { Authorization: "Bearer wrong" } }, E);
    expect(res.status).toBe(401);
  });

  it("200s with the correct bearer token", async () => {
    const res = await app.request(
      "/api/admin/leads",
      { headers: { Authorization: "Bearer test-admin-token" } },
      E,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray((await res.json()).leads)).toBe(true);
  });
});
