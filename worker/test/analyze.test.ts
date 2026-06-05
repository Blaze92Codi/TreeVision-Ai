import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchMock } from "cloudflare:test";
import { analyzeTreePhoto } from "../src/analyze";

// Intercept all outbound fetch so the Anthropic call is mocked, not real.
beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

// Build the Anthropic Messages API response shape analyze.ts expects.
function anthropicReply(text: string) {
  return { content: [{ type: "text", text }] };
}

const validAnalysis = {
  is_tree: true,
  common_name: "White Oak",
  latin_name: "Quercus alba",
  est_height_ft: "45-55 ft",
  est_dbh_in: "18-22 in",
  crown_spread_ft: "30-40 ft",
  condition: "Good",
  isa_risk_rating: "Moderate",
  recommended_service: "Trimming & Pruning",
  recommended_pkg_key: "trim",
  annotations: [{ type: "trim", label: "Shape canopy", bbox: [0.1, 0.1, 0.3, 0.3] }],
};

function mockMessages(reply: { status: number; body: unknown }) {
  fetchMock
    .get("https://api.anthropic.com")
    .intercept({ path: "/v1/messages", method: "POST" })
    .reply(reply.status, reply.body as any);
}

describe("analyzeTreePhoto", () => {
  it("parses a valid analysis, tolerating ```json fences", async () => {
    mockMessages({ status: 200, body: anthropicReply("```json\n" + JSON.stringify(validAnalysis) + "\n```") });
    const result = await analyzeTreePhoto("key", "base64data", "image/jpeg");
    expect(result.common_name).toBe("White Oak");
    expect(result.recommended_pkg_key).toBe("trim");
  });

  it("throws a friendly error when the model says it's not a tree", async () => {
    mockMessages({ status: 200, body: anthropicReply(JSON.stringify({ ...validAnalysis, is_tree: false })) });
    await expect(analyzeTreePhoto("key", "b64", "image/jpeg")).rejects.toThrow(/no tree detected/i);
  });

  it("throws when the model output isn't valid JSON", async () => {
    mockMessages({ status: 200, body: anthropicReply("I think this is an oak tree, roughly 40ft.") });
    await expect(analyzeTreePhoto("key", "b64", "image/jpeg")).rejects.toThrow(/could not parse/i);
  });

  it("surfaces the API error message on a non-retriable failure", async () => {
    mockMessages({ status: 400, body: { error: { message: "invalid base64" } } });
    await expect(analyzeTreePhoto("key", "b64", "image/jpeg")).rejects.toThrow(/invalid base64/);
  });

  it("retries once on a 5xx and succeeds on the second attempt", async () => {
    // First attempt 500, second attempt 200 — two interceptors consumed in order.
    mockMessages({ status: 500, body: { error: { message: "overloaded" } } });
    mockMessages({ status: 200, body: anthropicReply(JSON.stringify(validAnalysis)) });
    const result = await analyzeTreePhoto("key", "b64", "image/jpeg");
    expect(result.latin_name).toBe("Quercus alba");
  });
});
