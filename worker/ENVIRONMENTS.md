# Environments & Sandbox

Two fully separate copies of the app, each with its own URL, database, and photo storage.

| | **Beta (production)** | **Sandbox** |
|---|---|---|
| Worker | `treevision` | `treevision-sandbox` |
| URL | `treevision.<sub>.workers.dev` | `treevision-sandbox.<sub>.workers.dev` |
| D1 database | `treevision` | `treevision-sandbox` |
| R2 bucket | `treevision-photos` | `treevision-sandbox-photos` |
| Git branch | `beta` | `main` |
| Who uses it | Beta testers | You + dev, experimenting |

Beta's data is **never** touched by sandbox work — separate database and bucket.

## One-time sandbox setup

Run these once to create the sandbox's own resources:

```bash
cd worker

# 1. Create the sandbox database — copy the printed id into wrangler.toml
#    under [[env.sandbox.d1_databases]] → database_id
npm run db:create:sandbox

# 2. Create the sandbox photo bucket
npm run r2:create:sandbox

# 3. Apply the schema to the sandbox database
npm run db:migrate:sandbox

# 4. Set the sandbox's own secrets (separate from production)
npx wrangler secret put ANTHROPIC_API_KEY --env sandbox
npx wrangler secret put ADMIN_TOKEN --env sandbox
npx wrangler secret put RESEND_API_KEY --env sandbox          # optional
# (add others as needed: CALENDLY_WEBHOOK_SIGNING_KEY, TWILIO_*, TURNSTILE_SECRET)

# 5. First sandbox deploy
npm run deploy:sandbox
```

You'll get back `https://treevision-sandbox.<sub>.workers.dev`.

## Day-to-day workflow (two tracks)

**Develop on `main`, deploy to sandbox:**
```bash
git checkout main
# ... make changes ...
npm run deploy:sandbox     # test at the sandbox URL — beta is untouched
git add -A && git commit -m "..."
```

**Promote a proven change to beta (production):**
```bash
git checkout beta
git merge main             # bring the proven changes into beta
npm run deploy             # ships to production — beta testers get it
git checkout main          # go back to dev
```

This keeps beta frozen on known-good code while you build freely on `main`/sandbox.
Beta only changes the moment you run `npm run deploy` from the `beta` branch.

## Quick reference

| Action | Beta (production) | Sandbox |
|---|---|---|
| Deploy | `npm run deploy` | `npm run deploy:sandbox` |
| Migrate DB | `npm run db:migrate:remote` | `npm run db:migrate:sandbox` |
| Live logs | `npm run tail` | `npm run tail:sandbox` |
| Branch | `beta` | `main` |

## Notes

- Cloudflare environments do **not** inherit bindings/vars, so `[env.sandbox]` in
  `wrangler.toml` redeclares everything. If you add a binding or var to production,
  add it to the sandbox block too.
- Secrets are per-environment: `wrangler secret put X` (production) vs
  `wrangler secret put X --env sandbox`.
- The GitHub Action (`.github/workflows/deploy.yml`) deploys **production** on push
  to `main`. If you want it to deploy sandbox instead (and only promote beta
  manually), change its branch filter to `beta` — or add a second job for sandbox.
