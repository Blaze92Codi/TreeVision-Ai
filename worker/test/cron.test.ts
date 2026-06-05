import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { env, fetchMock } from "cloudflare:test";
import { runFollowUpCron } from "../src/index";

const E = env as any;

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

beforeEach(async () => {
  await E.DB.batch([
    E.DB.prepare("DELETE FROM interactions"),
    E.DB.prepare("DELETE FROM estimates"),
    E.DB.prepare("DELETE FROM contacts"),
    E.DB.prepare("DELETE FROM app_settings"),
  ]);
});

// Twilio creds are set in vitest.config; intercept the Messages endpoint for ACtest.
function mockTwilio(status = 201) {
  fetchMock
    .get("https://api.twilio.com")
    .intercept({ path: "/2010-04-01/Accounts/ACtest/Messages.json", method: "POST" })
    .reply(status, { sid: "SM_TEST" });
}

async function setBaseUrl() {
  await E.DB.prepare("INSERT INTO app_settings (key, value) VALUES ('base_url', 'https://app.test')").run();
}

// Seed a contact + a submitted estimate `hoursAgo` in the past (default stale).
async function seedSubmitted(hoursAgo: number) {
  await E.DB.prepare("INSERT INTO contacts (id, name, email, phone) VALUES ('c1','Jane','jane@x.com','+15551234')").run();
  await E.DB.prepare(
    `INSERT INTO estimates (id, contact_id, status, share_token, total_low, total_high, submitted_at)
     VALUES ('est1','c1','submitted','tok1',200,550, datetime('now', ?))`
  ).bind(`-${hoursAgo} hours`).run();
}

describe("runFollowUpCron", () => {
  it("returns early when no absolute base URL is known", async () => {
    await seedSubmitted(50); // stale, but no base_url and PUBLIC_BASE_URL is empty
    const r = await runFollowUpCron(E);
    expect(r).toEqual({ sent: 0, skipped: 0 });
    const n = await E.DB.prepare("SELECT COUNT(*) n FROM interactions WHERE channel='sms_out'").first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it("texts a stale (>48h) submitted estimate and logs the interaction", async () => {
    await setBaseUrl();
    await seedSubmitted(50);
    mockTwilio();

    const r = await runFollowUpCron(E);
    expect(r).toEqual({ sent: 1, skipped: 0 });

    const row = await E.DB.prepare(
      "SELECT body, meta FROM interactions WHERE estimate_id='est1' AND channel='sms_out'"
    ).first<{ body: string; meta: string }>();
    expect(row?.body).toMatch(/still waiting/i);
    expect(JSON.parse(row!.meta)).toMatchObject({ sid: "SM_TEST" });
  });

  it("does not re-text an estimate that already got a follow-up", async () => {
    await setBaseUrl();
    await seedSubmitted(50);
    // Pre-existing follow-up SMS — the cron must skip this estimate (no Twilio call).
    await E.DB.prepare(
      "INSERT INTO interactions (id, contact_id, estimate_id, channel, direction, body) VALUES (?, 'c1','est1','sms_out','outbound','earlier')"
    ).bind(crypto.randomUUID()).run();

    const r = await runFollowUpCron(E);
    expect(r).toEqual({ sent: 0, skipped: 0 });
  });

  it("skips estimates submitted less than 48h ago", async () => {
    await setBaseUrl();
    await seedSubmitted(10); // too recent
    const r = await runFollowUpCron(E);
    expect(r).toEqual({ sent: 0, skipped: 0 });
  });
});
