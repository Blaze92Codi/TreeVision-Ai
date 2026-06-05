import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { hashIp, checkAndRecord } from "../src/ratelimit";

// Real D1 from the Workers pool. Clear counters between tests so each starts fresh.
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM rate_limits").run();
});

describe("hashIp", () => {
  it("is deterministic and 24 hex chars (12 bytes)", async () => {
    const a = await hashIp("203.0.113.7");
    const b = await hashIp("203.0.113.7");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{24}$/);
  });

  it("differs for different IPs", async () => {
    expect(await hashIp("203.0.113.7")).not.toBe(await hashIp("203.0.113.8"));
  });
});

describe("checkAndRecord", () => {
  const cfg = { perHour: 3, perDay: 10 };

  it("allows requests under the limit and increments the counter", async () => {
    const ip = await hashIp("198.51.100.1");
    for (let i = 0; i < 3; i++) {
      const r = await checkAndRecord(env.DB, ip, cfg);
      expect(r.allowed).toBe(true);
    }
    const row = await env.DB
      .prepare("SELECT count FROM rate_limits WHERE ip_hash = ? AND window_start = ?")
      .bind(ip, new Date().toISOString().slice(0, 13))
      .first<{ count: number }>();
    expect(row?.count).toBe(3);
  });

  it("blocks once the hourly limit is reached, with a 1-hour retry", async () => {
    const ip = await hashIp("198.51.100.2");
    for (let i = 0; i < 3; i++) await checkAndRecord(env.DB, ip, cfg);
    const blocked = await checkAndRecord(env.DB, ip, cfg);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSec).toBe(3600);
      expect(blocked.reason).toMatch(/hourly/i);
    }
  });

  it("blocks on the daily limit even when the hourly limit is generous", async () => {
    const ip = await hashIp("198.51.100.3");
    const dayCfg = { perHour: 100, perDay: 2 };
    expect((await checkAndRecord(env.DB, ip, dayCfg)).allowed).toBe(true);
    expect((await checkAndRecord(env.DB, ip, dayCfg)).allowed).toBe(true);
    const blocked = await checkAndRecord(env.DB, ip, dayCfg);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSec).toBe(86400);
      expect(blocked.reason).toMatch(/daily/i);
    }
  });

  it("tracks separate IPs independently", async () => {
    const a = await hashIp("198.51.100.4");
    const b = await hashIp("198.51.100.5");
    for (let i = 0; i < 3; i++) await checkAndRecord(env.DB, a, cfg);
    // a is now exhausted; b should still be allowed.
    expect((await checkAndRecord(env.DB, a, cfg)).allowed).toBe(false);
    expect((await checkAndRecord(env.DB, b, cfg)).allowed).toBe(true);
  });
});
