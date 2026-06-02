# TreeVision AI

AI-powered tree-service estimator. Customers photograph trees on their property; Claude vision returns species, height/DBH, condition, risk, and a price range; the customer captures contact info and books on Calendly. The operator gets emailed every lead and manages them in a built-in dashboard.

**Live:** https://treevision.firefighter2501.workers.dev

## Stack

- **Frontend** — static HTML/JS in [`web/`](web/), served by the Worker
- **Backend** — Cloudflare Workers + D1 + R2 in [`worker/`](worker/)
- **AI** — Anthropic Claude (vision)
- **Email** — Resend
- **Booking** — Calendly (webhook-driven)
- **SMS follow-ups** — Twilio (optional)

## Layout

```
web/
  index.html      # customer estimator (the landing page)
  admin.html      # operator dashboard (ADMIN_TOKEN sign-in)
  accuracy.html   # AI accuracy harness (ADMIN_TOKEN sign-in)
worker/           # Cloudflare Worker — see worker/README.md for full details
```

## Deploy

Push to `main` → GitHub Actions deploys the Worker (see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).
Local: `cd worker && npm run deploy`.

See [`worker/README.md`](worker/README.md) for architecture, API surface, and configuration. See [`TASKS.md`](TASKS.md) for what's still in flight.
