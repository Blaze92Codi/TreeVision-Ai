import { describe, it, expect } from "vitest";
import { buildOperatorLeadEmail, buildFollowUpSms, buildLeadSms } from "../src/notify";
import type { Bindings } from "../src/types";

// notify.ts pulls only a few string vars off the env for these builders; cast a
// minimal object rather than constructing real D1/R2 bindings.
const env = {
  COMPANY_NAME: "TreeVision",
  OPERATOR_EMAIL: "ops@treevision.test",
  OPERATOR_PHONE: "555-0000",
  FROM_EMAIL: "hello@treevision.test",
} as unknown as Bindings;

const estimate = {
  id: "abcdef1234567890",
  total_low: 825,
  total_high: 2275,
  trees: [
    { id: "t1", species: "White Oak", selected_pkg: "Trimming", quote_low: 200, quote_high: 550 },
    { id: "t2", species: "Maple", selected_pkg: "Removal", quote_low: 625, quote_high: 1725 },
  ],
};

const contact = {
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "555-1234",
  address: "1 Main St",
};

describe("buildOperatorLeadEmail (HTML escaping)", () => {
  it("escapes customer-supplied name and address to prevent HTML injection", () => {
    const msg = buildOperatorLeadEmail(
      env,
      estimate,
      { ...contact, name: "<script>alert(1)</script>", address: `"><a href="http://evil">x</a>` },
      "https://app.test",
    );
    // The raw markup must never appear in the email body.
    expect(msg.html).not.toContain("<script>alert(1)</script>");
    expect(msg.html).not.toContain('<a href="http://evil">');
    // Escaped equivalents should be present instead.
    expect(msg.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(msg.html).toContain("&quot;");
  });

  it("formats money and addresses the email to the operator", () => {
    const msg = buildOperatorLeadEmail(env, estimate, contact, "https://app.test");
    expect(msg.to).toBe("ops@treevision.test");
    expect(msg.replyTo).toBe("jane@example.com");
    // fmtMoney adds the $ and thousands separator.
    expect(msg.html).toContain("$825");
    expect(msg.html).toContain("$2,275");
  });

  it("includes preferred times when provided", () => {
    const msg = buildOperatorLeadEmail(env, estimate, contact, "https://app.test", "Weekday mornings");
    expect(msg.html).toContain("Weekday mornings");
  });
});

describe("buildFollowUpSms", () => {
  it("greets by first name and includes the price range and resume link", () => {
    const sms = buildFollowUpSms(env, contact, estimate, "https://app.test/?token=xyz");
    expect(sms).toContain("Hi Jane,");
    expect(sms).toContain("TreeVision");
    expect(sms).toContain("$825–$2,275");
    expect(sms).toContain("https://app.test/?token=xyz");
  });

  it("falls back to 'there' when the contact has no name", () => {
    const sms = buildFollowUpSms(env, { ...contact, name: null }, estimate, "https://app.test");
    expect(sms).toContain("Hi there,");
  });

  it("renders missing totals as an em dash", () => {
    const sms = buildFollowUpSms(env, contact, { ...estimate, total_low: null as any, total_high: null as any }, "https://app.test");
    expect(sms).toContain("—–—");
  });
});

describe("buildLeadSms", () => {
  it("pluralises the tree count and lists phone + preferred times", () => {
    const sms = buildLeadSms(contact, estimate, "Weekends");
    expect(sms).toContain("🌳 New lead: Jane Doe");
    expect(sms).toContain("2 trees, $825–$2,275");
    expect(sms).toContain("📞 555-1234");
    expect(sms).toContain("Prefers: Weekends");
  });

  it("uses the singular 'tree' for a one-tree estimate and omits empty lines", () => {
    const single = { ...estimate, trees: [estimate.trees[0]] };
    const sms = buildLeadSms({ ...contact, phone: null }, single);
    expect(sms).toContain("1 tree, ");
    expect(sms).not.toContain("📞");
    expect(sms).not.toContain("Prefers:");
  });
});
