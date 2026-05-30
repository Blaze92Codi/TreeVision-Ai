# TreeVision AI — Tasks

_Last updated: 2026-05-30_

**Live app:** https://treevision.firefighter2501.workers.dev
**Stack:** Cloudflare Workers + D1 + R2 · Resend email · single app (sandbox deferred)
**Owners:** Palmer (palmerm.venturellc@gmail.com) · Brian (Brianro14sa@gmail.com)

---

## 🔴 Active — do next

- [ ] **⭐ Run the AI accuracy test** — the make-or-break validation. Pull 8–12 past jobs where the final price is known, go to `/accuracy.html` (sign in with ADMIN_TOKEN), add photo + actual price + service for each, run. Tells you whether the core AI-estimate value prop actually holds before investing more. ~$0.03/photo.
- [ ] **Deploy latest to production** — accuracy harness + email integration + email-injection security fixes are committed locally but not deployed. Run `cd worker && npm run deploy`.
- [ ] **Set up Resend** — sign up at resend.com with **palmerm.venturellc@gmail.com** (the test sender only delivers to the signup email), then `npx wrangler secret put RESEND_API_KEY`.
- [ ] **Test the email flow** — submit an estimate using `palmerm.venturellc@gmail.com` as the customer email; confirm BOTH the "🌳 New lead" operator email and the customer estimate email arrive.

## 🟡 Next — before real customers

- [ ] **Verify a sending domain in Resend** — required to email both owners AND real customers. Then add Brian back to `OPERATOR_EMAIL` (comma-separated) and change `FROM_EMAIL` to `quotes@<domain>`. (~$10/yr for a domain if needed.)
- [ ] **Owner (Brian) tests the app** — the gating milestone before further changes.

## 🟢 Later / deferred

- [ ] **Re-introduce the sandbox environment** after the owner finishes testing (deferred per CHANGE-ORDER.md CO-001; config is in git history).
- [ ] **Custom domain** for the app (e.g. `book.dynamictreeservice.com`) instead of `*.workers.dev`.
- [ ] **Swap in the real logo PNG** (`web/logo.png`) — currently an SVG recreation.
- [ ] **Wire Calendly** — set `CALENDLY_URL` + the webhook signing key to enable online scheduling (currently email-only; requires a paid Calendly plan).
- [ ] **GitHub Actions CI** — add `CF_API_TOKEN` + `CF_ACCOUNT_ID` repo secrets to enable auto-deploy on push.
- [ ] **Optional: standalone printable/shareable estimate report** (the "both" option from the design discussion).

## ✅ Done (this build)
- v2 multi-tree property estimate flow (cart, bundle discounts, save/resume)
- Branded A–E scope-of-work report (annotated photo, Auto Assessment, pricing tiers, desktop 2-column)
- Operator dashboard (Leads + Contacts, final-price entry)
- Cloudflare Workers backend (D1, R2, hourly follow-up cron)
- Resend email integration + operator lead alert on submit + HTML-injection hardening
- Email-only flow (calling removed), clean "Estimate sent" confirmation
- Reverted to single app; documented in CHANGE-ORDER.md
