# TreeVision AI — v2

Self-guided property walk-through estimator with a CRM, automated follow-ups, and an operator dashboard. Runs on Cloudflare Workers + D1 + R2, ~$0/mo at low volume.

## What's in the box

**Customer surface** ([../web/index.html](../web/index.html))
- Landing → photograph each tree on the property → AI assessment with annotated overlay → bundled estimate cart → contact capture → Calendly booking
- Save-and-resume via share token (works without an account)
- Bundle discounts: 5% off 2 trees, 10% off 3+
- HEIC support, in-browser resize to 1568px

**Operator surface** ([../web/admin.html](../web/admin.html))
- Tabbed Leads + Contacts views
- Estimate detail with all trees, contact info, booking, final-price entry
- Contact detail with estimate history + full activity log (SMS, email, system events)

**Backend** (`worker/`)
- One Worker. Three storage primitives: D1 (SQLite), R2 (photos), Workers Cron.
- Email via Resend, SMS via Twilio (both optional — system degrades gracefully).

## Architecture

```
                     ┌─────────────────────┐
   Customer  ──────▶ │   Worker /api/*     │ ──▶ Anthropic Claude (vision + annotations)
                     │   (Hono)            │
                     │                     │ ──▶ D1: contacts, estimates, trees,
                     │                     │           bookings, interactions
                     │                     │ ──▶ R2: tree photos
                     │                     │ ──▶ Resend: customer + operator emails
                     │                     │ ──▶ Twilio: follow-up SMS (cron)
                     └─────────┬───────────┘
                               │
   Calendly webhook  ──────────┤
                               │
   Cron (hourly)    ───────────┘   sends 48h follow-ups for un-booked estimates
```

## Data model

```
contacts (one per household)
   ├── estimates (one per property walk-through session)
   │     └── trees (each photographed tree + AI analysis + selected service)
   │     └── booking (one per estimate, once Calendly fires)
   └── interactions (every SMS, email, system event)
```

## API surface

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/config` | Public config (company, calendly URL, bundle tiers) |
| POST | `/api/estimate` | Create a new estimate session |
| GET  | `/api/estimate/:id` | Full estimate (trees + contact) |
| GET  | `/api/estimate/by-token/:token` | Resume by share token |
| POST | `/api/estimate/:id/tree` | Upload photo → AI analysis → add to estimate |
| PATCH| `/api/estimate/:id/tree/:tid` | Update selected service / label |
| DELETE| `/api/estimate/:id/tree/:tid` | Remove tree |
| POST | `/api/estimate/:id/contact` | Capture name/email/phone/address |
| POST | `/api/estimate/:id/submit` | Lock + email customer copy |
| GET  | `/api/tree-photo/:id` | Photo proxy from R2 |
| POST | `/api/webhooks/calendly` | `invitee.created` → creates booking, emails operator |
| GET  | `/api/admin/leads` | All estimates (bearer auth) |
| GET  | `/api/admin/contacts` | All contacts with rollup (bearer auth) |
| GET  | `/api/admin/contact/:id` | Contact + estimates + interactions (bearer auth) |
| GET  | `/api/admin/estimate/:id` | Estimate detail (bearer auth) |
| POST | `/api/admin/booking/:id/final-price` | Record post-visit final (bearer auth) |
| POST | `/api/admin/run-followups` | Manually trigger the follow-up cron (bearer auth) |

## First-time deploy

```bash
cd worker
npm install
npx wrangler login
```

### 1. Create D1 and R2

```bash
npm run db:create
# → copy the printed database_id into wrangler.toml under [[d1_databases]]

npm run r2:create

npm run db:migrate:remote
```

### 2. Set secrets

```bash
# Required
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ADMIN_TOKEN                    # any strong random string
npx wrangler secret put RESEND_API_KEY                 # https://resend.com — free tier covers 3k emails/mo
npx wrangler secret put CALENDLY_WEBHOOK_SIGNING_KEY   # from Calendly webhook config (requires paid plan)

# Optional
npx wrangler secret put TURNSTILE_SECRET               # Cloudflare Turnstile — skip to disable bot-check
npx wrangler secret put TWILIO_ACCOUNT_SID             # required for follow-up SMS
npx wrangler secret put TWILIO_AUTH_TOKEN              # required for follow-up SMS
```

### 3. Edit non-secret config in `wrangler.toml`

Under `[vars]`:

| Var | What |
|---|---|
| `COMPANY_NAME` | Shown to customers and on emails |
| `OPERATOR_EMAIL` | Where booking notifications go |
| `OPERATOR_PHONE` | "Call us" fallback shown on landing + scheduling |
| `FROM_EMAIL` | **Must be a domain you've verified in Resend** |
| `CALENDLY_URL` | Your Calendly event URL |
| `ISA_CERT` | Shown in disclaimers |
| `PUBLIC_BASE_URL` | Used in resume links and emails. Set after first deploy. |
| `TWILIO_FROM_NUMBER` | E.164 format, e.g. `+15551234567` |
| `ALLOWED_ORIGINS` | `*` or comma-separated origins |
| `RATE_LIMIT_PER_HOUR`, `RATE_LIMIT_PER_DAY` | Per-IP limits on photo uploads |

### 4. Deploy

```bash
npm run deploy
```

This deploys the Worker *and* serves `../web/*` as the static front-end from the same hostname.

### 5. Configure Calendly webhook

Calendly → Integrations → Webhooks → Create:
- URL: `https://<your-worker>/api/webhooks/calendly`
- Events: `invitee.created`
- Signing key: same string you set as `CALENDLY_WEBHOOK_SIGNING_KEY`

> **Note:** Calendly webhooks require a paid plan (Standard or higher). Free/Personal Calendly plans cannot fire webhooks.

### 6. Configure Resend domain

In Resend → Domains, add your `FROM_EMAIL` domain and follow the DNS instructions (SPF, DKIM, optionally DMARC). Until DNS is set, emails will silently fail and only appear in `wrangler tail`.

### 7. (Optional) Turnstile

If `TURNSTILE_SECRET` is set, you'll also want to add a site key on the client side. Edit `web/index.html` and set:

```html
<script>window.TURNSTILE_SITE_KEY = "0xYOUR_SITE_KEY";</script>
```

before the main `<script>` block.

## Local development

```bash
npm run db:migrate:local
npm run dev          # wrangler dev on :8787, serves /api/* + ../web/*
```

Set `.dev.vars` for local secrets:

```
ANTHROPIC_API_KEY=sk-ant-...
ADMIN_TOKEN=local-test
RESEND_API_KEY=re_...
CALENDLY_WEBHOOK_SIGNING_KEY=local-test
```

Then hit `http://localhost:8787/` in a browser.

## Pricing model

[src/pricing.ts](src/pricing.ts) is the single source of truth. Three layers:

- **Base prices** per service (trim/removal/stump/treatment)
- **Height multiplier** based on AI estimate (0.7× to 2.4×)
- **Risk multiplier** applied only to removal (1.0× to 1.5×)
- **Bundle discount** at the estimate level: 5% off 2 trees, 10% off 3+

Edit and redeploy — no DB migration needed.

## Closing the feedback loop

After each on-site visit, operator records actual price via the dashboard (or curl):

```bash
curl -X POST https://<worker>/api/admin/booking/<booking_id>/final-price \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"final_price": 2400, "notes": "Larger than estimated, extra debris haul"}'
```

The `quotes` ↔ `final_price` pair is your accuracy dataset. Use it to:
- Audit AI accuracy: `SELECT AVG((b.final_price - (e.total_low+e.total_high)/2)/((e.total_low+e.total_high)/2)) FROM bookings b JOIN estimates e ON e.id=b.estimate_id WHERE b.final_price IS NOT NULL`
- Tune `BASE` prices and multipliers in `src/pricing.ts`
- Eventually fine-tune the Claude prompt with examples

## Cron: follow-up SMS

`wrangler.toml` configures `crons = ["0 * * * *"]` — runs hourly. In each run, the Worker:

1. Finds estimates in `submitted` status with a phone number and `submitted_at <= now - 48 hours`
2. That have **no** prior `sms_out` interaction
3. Sends a friendly nudge SMS via Twilio
4. Logs the interaction so it doesn't re-send

Trigger manually for testing: `POST /api/admin/run-followups` with the admin bearer.

## Cost back-of-envelope

At 500 quotes/day (each estimate ≈ 1.5 trees average → ~750 vision calls/day):
- Anthropic Sonnet 4.5: ~$0.03/call × 750 = **$22/day**
- Workers: free tier
- D1: free tier (under 5M reads/day, 100k writes/day)
- R2: ~$0.01/day after free 10 GB
- Resend: free for 3k emails/mo, then $20/mo for 50k
- Twilio: $0.0075 per SMS sent

Total ≈ $25/day, almost entirely Anthropic.

## What's still manual

- No A/B testing of prompt or pricing
- No customer-facing way to share an estimate link via email (only "copy link")
- No inbound SMS handling — replies to follow-ups are not surfaced
- No multi-photo per tree (one photo per tree for now)
- No satellite/parcel cross-check
