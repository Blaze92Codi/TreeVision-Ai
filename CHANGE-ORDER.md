# Change Order — TreeVision AI

**Date:** 2026-05-30
**Requested by:** Owner / Palmer Venture LLC

---

## CO-001 — Defer sandbox environment

**Change:** Remove the separate "sandbox" build environment for now. Run a **single app** for the owner to test first. Re-introduce the sandbox after the owner has completed initial testing.

**Reason:** Keep the setup simple during owner testing. One app, one URL, one database.

**What was reverted:**
- Removed the `[env.sandbox]` block from `worker/wrangler.toml`
- Removed the sandbox npm scripts from `worker/package.json`
- Reverted `.github/workflows/deploy.yml` to single-app deploy (push to `main` → production)
- Removed `worker/ENVIRONMENTS.md`

**Cleanup note (optional):** A sandbox D1 database (`treevision-sandbox`,
id `c3d04096-…`) was created during setup and is now unused. It's empty and free,
but to remove it entirely run:
```
npx wrangler d1 delete treevision-sandbox
```
(A `treevision-sandbox-photos` R2 bucket was *not* created, so nothing to remove there.)

**To restore later:** the sandbox config lives in git history — ask to re-add it
after the owner finishes testing.

---

## CO-002 — Operator notification recipient (testing phase)

**Change:** During testing, send operator/owner notification emails to a **single**
address — `palmerm.venturellc@gmail.com` — which Palmer forwards to Brian as needed.
This avoids needing a paid domain to start. Add `Brianro14sa@gmail.com` (comma-
separated in `OPERATOR_EMAIL`) once a sending domain is verified in Resend.

**Done:**
- `OPERATOR_EMAIL` in `worker/wrangler.toml` now lists both addresses (comma-separated).
- `sendEmail` delivers to multiple recipients.
- **Operator lead alert now fires on every estimate SUBMIT** (`buildOperatorLeadEmail`
  in `notify.ts`, called from the `/submit` handler). Previously the operator was
  only notified on a Calendly booking — so in email-only mode the owners received
  nothing. Now both owners get an email the moment a customer submits, with the
  customer's contact info, the trees, photos, and the total. The customer still
  gets their own estimate copy at the same time.

**⚠️ One step remains for delivery to actually work:**
Resend will only deliver to these two Gmail addresses once a **sending domain is
verified** in Resend. The free test sender (`onboarding@resend.dev`) only delivers
to the single email used to sign up for Resend — it cannot send to arbitrary
addresses.

To make both addresses receive mail:
1. Own a domain (e.g. `dynamictreeservice.com` or a `palmerventurellc.com`)
2. Add it in Resend → Domains, add the DNS records they provide (SPF/DKIM)
3. Change `FROM_EMAIL` in `wrangler.toml` to `quotes@<that-domain>`
4. `npm run deploy`

Until a domain is verified, operator emails to these two addresses will not be
delivered (they'll log "skipped/failed" in `wrangler tail`).

---

## Current production state

- **One app:** `treevision` → `https://treevision.firefighter2501.workers.dev`
- **Owner tests this.** No sandbox.
- Email recipients configured; awaiting Resend domain verification to deliver.
