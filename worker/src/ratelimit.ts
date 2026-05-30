export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode("treevision:" + ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
}

export type RateConfig = { perHour: number; perDay: number };

/**
 * Atomically increments hourly + daily counters for this IP and returns
 * whether the request is within limits.
 */
export async function checkAndRecord(
  db: D1Database,
  ipHash: string,
  cfg: RateConfig,
): Promise<{ allowed: true } | { allowed: false; reason: string; retryAfterSec: number }> {
  const now = new Date();
  const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const dayKey  = now.toISOString().slice(0, 10); // YYYY-MM-DD

  // Read existing counts
  const rows = await db
    .prepare("SELECT window_start, count FROM rate_limits WHERE ip_hash = ? AND window_start IN (?, ?)")
    .bind(ipHash, hourKey, dayKey)
    .all<{ window_start: string; count: number }>();

  const hourCount = rows.results.find(r => r.window_start === hourKey)?.count ?? 0;
  const dayCount  = rows.results.find(r => r.window_start === dayKey)?.count  ?? 0;

  if (hourCount >= cfg.perHour) {
    return { allowed: false, reason: "Hourly limit reached. Try again later.", retryAfterSec: 3600 };
  }
  if (dayCount >= cfg.perDay) {
    return { allowed: false, reason: "Daily limit reached. Try again tomorrow.", retryAfterSec: 86400 };
  }

  // Bump counters
  await db.batch([
    db.prepare(
      "INSERT INTO rate_limits (ip_hash, window_start, count) VALUES (?, ?, 1) " +
      "ON CONFLICT(ip_hash, window_start) DO UPDATE SET count = count + 1"
    ).bind(ipHash, hourKey),
    db.prepare(
      "INSERT INTO rate_limits (ip_hash, window_start, count) VALUES (?, ?, 1) " +
      "ON CONFLICT(ip_hash, window_start) DO UPDATE SET count = count + 1"
    ).bind(ipHash, dayKey),
    // Best-effort cleanup of windows older than 2 days
    db.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(
      new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10)
    ),
  ]);

  return { allowed: true };
}

export async function verifyTurnstile(secret: string, token: string, ip: string): Promise<boolean> {
  if (!secret) return true;
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  if (!res.ok) return false;
  const data: any = await res.json().catch(() => ({}));
  return !!data?.success;
}
