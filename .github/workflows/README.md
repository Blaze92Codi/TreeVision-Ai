# GitHub Actions — Auto-deploy

This workflow ships the Worker + static assets to Cloudflare on every push to `main` that touches `worker/`, `web/`, or the workflow itself.

## One-time setup

### 1. Do a manual deploy first

Run the initial deploy locally so D1 + R2 are provisioned and secrets are set:

```bash
cd worker
npm install
npx wrangler login
npm run db:create                  # paste the printed id into wrangler.toml
npm run r2:create
npm run db:migrate:remote
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ADMIN_TOKEN
# (other secrets as you wire them — see worker/README.md)
npm run deploy
```

After this, the project exists on Cloudflare and you can let CI take over.

### 2. Create a Cloudflare API token

In the [Cloudflare dashboard](https://dash.cloudflare.com/profile/api-tokens) → API Tokens → Create Token → Edit Cloudflare Workers template.

Scopes the token needs:
- **Account → Workers Scripts** — Edit
- **Account → Workers KV Storage** — Edit (Wrangler uses this internally)
- **Account → Workers R2 Storage** — Edit
- **Account → D1** — Edit
- **Account → Account Settings** — Read

Save the token string.

### 3. Find your Cloudflare Account ID

In the Cloudflare dashboard, the right sidebar of any zone or the URL of your account shows the ID. Copy it.

### 4. Add both to GitHub repo secrets

In the GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

| Name | Value |
|---|---|
| `CF_API_TOKEN` | The token from step 2 |
| `CF_ACCOUNT_ID` | The account ID from step 3 |

### 5. Test it

Make a small change to `worker/src/index.ts` or `web/index.html`, commit to `main`, and watch the Actions tab. The workflow type-checks, applies any pending D1 migrations, then deploys.

You can also trigger manually from the Actions tab via "Run workflow".

## What this workflow does

1. **Path-filtered** — only runs when worker/web/workflow files change. Doc-only commits don't redeploy.
2. **Concurrency-controlled** — if you push twice quickly, the second deploy waits for the first to finish rather than racing.
3. **Type-checks before deploy** — a TypeScript error fails the build before anything ships.
4. **Migrations applied automatically** — any new `migrations/*.sql` files apply to D1 before the worker rolls out.
5. **Posts a summary** to the GitHub Actions run with the commit SHA.

## What it does NOT do

- **Doesn't manage secrets.** Wrangler secrets (`ANTHROPIC_API_KEY`, etc.) are set once via `wrangler secret put` and persist on Cloudflare. The CI token only deploys — it doesn't rotate secrets.
- **Doesn't run tests.** There are no tests yet. Add a step here if you add a test suite.
- **Doesn't deploy preview branches.** Only `main` deploys to production. If you want PR previews, add a separate job using `wrangler deploy --env preview` with a per-branch name.
