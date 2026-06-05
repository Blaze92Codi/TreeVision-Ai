import { applyD1Migrations, env } from "cloudflare:test";

// Each test worker gets an isolated D1 instance. Apply the real migrations once
// before the suite so tables (rate_limits, estimates, contacts, …) exist.
await applyD1Migrations(env.DB, (env as any).TEST_MIGRATIONS);
