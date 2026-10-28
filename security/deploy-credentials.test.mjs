import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');

test('Cloudflare secrets are supplied only to migration and deployment steps', () => {
  // Verify the effective declaration boundary, including future job-level regressions.
  const stepsStart = workflow.indexOf('    steps:\n');
  assert.ok(stepsStart > 0, 'expected deployment steps');
  assert.doesNotMatch(workflow.slice(0, stepsStart), /secrets\.(?:CF_API_TOKEN|CF_ACCOUNT_ID)/);
  const allowed = new Set(['Apply pending D1 migrations', 'Deploy Worker + static assets']);
  const steps = workflow.slice(stepsStart).split(/^      - name: /m).slice(1);
  let credentialSteps = 0;
  for (const step of steps) {
    const name = step.slice(0, step.indexOf('\n'));
    const hasCredentials = /secrets\.(?:CF_API_TOKEN|CF_ACCOUNT_ID)/.test(step);
    assert.equal(hasCredentials, allowed.has(name), `unexpected credentials for ${name}`);
    if (hasCredentials) {
      credentialSteps++;
      assert.match(step, /\n        env:\n          CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CF_API_TOKEN \}\}/);
    }
  }
  assert.equal(credentialSteps, 2);
  assert.match(workflow, /wrangler d1 migrations apply treevision --remote/);
  assert.match(workflow, /npx wrangler deploy/);
});

test('deployment uses the verified existing Cloudflare account and D1 binding', () => {
  const config = readFileSync(new URL('../worker/wrangler.toml', import.meta.url), 'utf8');
  // Account IDs identify resources; API tokens remain secret and step-scoped.
  assert.doesNotMatch(workflow, /CLOUDFLARE_ACCOUNT_ID|CF_ACCOUNT_ID/,
    'a hidden account override must not replace the verified config target');
  assert.match(config, /^account_id = "37852b0b701c8557b26088e70725f123"$/m);
  assert.match(config, /^name = "treevision"$/m);
  const database = config.split('[[d1_databases]]')[1]?.split('[[r2_buckets]]')[0];
  assert.ok(database, 'existing D1 binding required');
  assert.match(database, /^binding = "DB"$/m);
  assert.match(database, /^database_name = "treevision"$/m);
  assert.match(database, /^database_id = "50fc63d6-157b-42a3-97dc-df3dc1186137"$/m);
});
