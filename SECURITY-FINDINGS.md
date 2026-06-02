# Security findings — 2026-06-02

Assessment of the Supabase auth/data layer behind the TreeVision-AI portal.
Findings were verified against the **live** project (`hydlxwjtdkzcnxxukakt`), not
just the repo, because the deployed schema had drifted from the migration files.

## Summary

| # | Severity | Issue | Status in this branch |
|---|----------|-------|------------------------|
| 1 | 🔴 Critical | `anon` could read **all** customer PII from `estimates` (SELECT `USING (true)`) | Fixed in migration (needs apply) |
| 2 | 🔴 High | `anon` could INSERT `status='approved'` rows → unauthenticated `send-quote` emails them | Fixed in migration + function (needs apply/deploy) |
| 3 | 🟠 High | `analyze` callable unauthenticated → OpenAI key cost/DoS | Mitigation noted (not yet enforced) |
| 4 | 🟠 Med | `send-quote` interpolated DB fields into email HTML unescaped | Fixed in function (needs deploy) |
| 5 | 🟡 Med | Public storage bucket allowed anonymous file listing | Fixed in migration (needs apply) |
| 6 | 🟡 Med | Open sign-up; first account auto-becomes `owner` | Manual config noted |
| 7 | 🟢 Low | SECURITY DEFINER funcs callable by `anon` via RPC; mutable `search_path` | Fixed in migration (needs apply) |
| 8 | 🟢 Low | Leaked-password protection disabled | Manual config noted |

## Detail

### 1. Customer PII readable by the public anon key (CRITICAL)
Policy `anon can read own estimate by id` was defined `FOR SELECT TO anon USING (true)`.
The anon key is embedded in page source (`login.html`, `portal.js`), so anyone could
`GET /rest/v1/estimates?select=*` and dump every row. **Proven live: 9/9 rows, with
9/9 emails, phones, and addresses exposed.** The Supabase linter does *not* flag
`SELECT USING (true)` (it assumes public read is intentional), so this was invisible
to automated checks — it was found by reading `pg_policies` directly.

**Fix:** drop the anon SELECT policy. Staff read via `staff read estimates`
(authenticated owner/crew_manager); Edge Functions use the service role.

### 2. Anon status-injection → email abuse (HIGH)
`anon` INSERT policy used `WITH CHECK (true)`, so a stranger could insert a row
pre-marked `status='approved'` with an attacker-chosen `customer_email` and body
fields. All Edge Functions are `verify_jwt=false`, so `send-quote` was publicly
callable and would email that row through the verified Resend sender — an open
relay for phishing/brand-spoofing. **Verified reproducible (insert rolled back).**

**Fix:** (a) anon INSERT now pinned to `status='pending'` with approval columns
forced null; (b) `send-quote` now requires an authenticated staff caller.

### 3. Unauthenticated `analyze` (HIGH)
`analyze` (`verify_jwt=false`) runs GPT-4o on `OPENAI_API_KEY` for any caller.
**Not yet mitigated** — recommend requiring auth and/or a rate limit/captcha
before the OpenAI call. (Left as a follow-up; needs a product decision on whether
the customer-facing scan flow can require a token.)

### 4. Unescaped email template (MED) — fixed
`send-quote` now HTML-escapes every customer-controlled field and strips CR/LF
from the subject.

### 5. Public bucket listing (MED) — fixed in migration
Dropped the broad `anon` SELECT on `storage.objects` for `tree-photos`.
Public object URLs still work; anonymous *listing* no longer does.

### 6. Open sign-up (MED) — manual
`enable_signup=true`. New users get the least-privileged `crew` role (which RLS
blocks from reading estimates), and an `owner` already exists, so this is not a
live data leak — but consider disabling public sign-up and inviting staff.

### 7. Exposed SECURITY DEFINER funcs / search_path (LOW) — fixed in migration
`handle_new_user()` execute revoked from anon/authenticated; `current_user_role()`
revoked from anon (kept for authenticated, which the staff policies require);
`update_updated_at_column()` pinned to `search_path = ''`.

### 8. Leaked-password protection (LOW) — manual
Enable HaveIBeenPwned checks in Auth settings.

## How to apply

These changes are **staged in the repo only** — the live database and deployed
functions are unchanged until you run:

```bash
supabase db push                       # applies the RLS migration
supabase functions deploy send-quote   # deploys the hardened function
```

Then, in the dashboard (manual, items 6 & 8):
- Auth → enable leaked-password protection
- Auth → Email provider → consider disabling public sign-ups

After applying, re-run the security advisor and confirm `anon` can no longer read
`estimates` (e.g. `set local role anon; select count(*) from estimates;` → 0).
