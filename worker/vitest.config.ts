import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

// Runs the whole suite inside workerd (via Miniflare) so tests get real D1/R2
// bindings, not mocks. The pure-logic specs (pricing/calendly/notify) run here
// too — they only use standard Web APIs, which workerd provides.
export default defineWorkersConfig(async () => {
  // Apply the same D1 migrations the production database uses, so schema-dependent
  // tests (rate limiting, route handlers) exercise the real tables.
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return {
    test: {
      include: ["test/**/*.test.ts"],
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            // Hand the parsed migrations to the setup file via a test-only binding.
            // The rest are production secrets (absent from wrangler.toml) set here so
            // tests can drive the auth, webhook, and SMS paths. RESEND_API_KEY is left
            // unset on purpose so sendEmail() no-ops (no Resend calls to mock).
            bindings: {
              TEST_MIGRATIONS: migrations,
              ADMIN_TOKEN: "test-admin-token",
              CALENDLY_WEBHOOK_SIGNING_KEY: "test-calendly-key",
              TWILIO_ACCOUNT_SID: "ACtest",
              TWILIO_AUTH_TOKEN: "test-twilio-token",
              TWILIO_FROM_NUMBER: "+15550000000",
            },
          },
        },
      },
    },
  };
});
