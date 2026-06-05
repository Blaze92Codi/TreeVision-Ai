import { defineConfig } from "vitest/config";

// Plain Node environment is sufficient for the pure-logic modules under test
// (pricing, calendly, notify). Node 22 exposes the Web Crypto API on the global
// `crypto` object, which is all calendly's HMAC verification needs. Tests that
// require live D1/R2 bindings (ratelimit, route handlers) should later move to
// @cloudflare/vitest-pool-workers.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
