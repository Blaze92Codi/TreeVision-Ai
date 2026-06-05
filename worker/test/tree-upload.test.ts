import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { env, fetchMock } from "cloudflare:test";
import { app } from "../src/index";

const E = env as any;

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

beforeEach(async () => {
  await E.DB.batch([
    E.DB.prepare("DELETE FROM trees"),
    E.DB.prepare("DELETE FROM estimates"),
    E.DB.prepare("DELETE FROM rate_limits"),
  ]);
});

const analysis = {
  is_tree: true,
  common_name: "White Oak",
  latin_name: "Quercus alba",
  est_height_ft: "40-50 ft",
  est_dbh_in: "18-22 in",
  crown_spread_ft: "30-40 ft",
  condition: "Good",
  isa_risk_rating: "Low",
  recommended_service: "Trimming & Pruning",
  recommended_pkg_key: "trim",
  annotations: [{ type: "trim", label: "Shape canopy", bbox: [0.1, 0.1, 0.3, 0.3] }],
};

function mockAnthropic() {
  fetchMock
    .get("https://api.anthropic.com")
    .intercept({ path: "/v1/messages", method: "POST" })
    .reply(200, { content: [{ type: "text", text: JSON.stringify(analysis) }] });
}

async function newEstimate(): Promise<string> {
  return (await (await app.request("/api/estimate", { method: "POST" }, E)).json()).estimate_id;
}

function uploadForm(file?: File): FormData {
  const fd = new FormData();
  if (file) fd.append("photo", file);
  return fd;
}

function postTree(estimateId: string, fd: FormData) {
  // Don't set Content-Type — the runtime adds the multipart boundary itself.
  return app.request(`/api/estimate/${estimateId}/tree`, { method: "POST", body: fd }, E);
}

const jpeg = (type = "image/jpeg") => new File([new Uint8Array([1, 2, 3, 4])], "tree.jpg", { type });

describe("POST /api/estimate/:id/tree — validation", () => {
  it("404s for an unknown estimate", async () => {
    expect((await postTree("nope", uploadForm(jpeg()))).status).toBe(404);
  });

  it("400s when no photo is attached", async () => {
    const id = await newEstimate();
    const res = await postTree(id, uploadForm());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/missing photo/i);
  });

  it("415s for an unsupported image type", async () => {
    const id = await newEstimate();
    const res = await postTree(id, uploadForm(jpeg("image/gif")));
    expect(res.status).toBe(415);
  });

  it("400s when the estimate is already locked", async () => {
    const id = await newEstimate();
    await E.DB.prepare("UPDATE estimates SET status='submitted' WHERE id=?").bind(id).run();
    const res = await postTree(id, uploadForm(jpeg()));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/locked/i);
  });
});

describe("POST /api/estimate/:id/tree — happy path", () => {
  it("analyzes the photo, prices it, stores the row, and uploads to R2", async () => {
    const id = await newEstimate();
    mockAnthropic();

    const res = await postTree(id, uploadForm(jpeg()));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Response shape: shaped tree + price table + recomputed totals.
    expect(body.tree.species).toBe("White Oak");
    expect(body.tree.selected_pkg).toBe("trim");
    expect(body.tree.quote_low).toBeGreaterThan(0);
    expect(body.prices.removal).toBeTruthy();
    expect(body.totals.total_low).toBe(body.tree.quote_low);
    // ai_raw must not leak to the client.
    expect(body.tree.ai_raw).toBeUndefined();

    // Row persisted, and the photo actually landed in R2 at the stored key.
    const row = await E.DB.prepare("SELECT photo_key, species FROM trees WHERE estimate_id=?").bind(id).first<{ photo_key: string; species: string }>();
    expect(row?.species).toBe("White Oak");
    // head() returns metadata only — no body stream to dispose, which keeps the
    // pool's isolated-storage teardown happy.
    const obj = await E.PHOTOS.head(row!.photo_key);
    expect(obj).not.toBeNull();
    expect(obj!.size).toBeGreaterThan(0);
  });
});
