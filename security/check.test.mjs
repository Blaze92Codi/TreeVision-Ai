import {test} from 'node:test';
import assert from 'node:assert/strict';
import {credentialRule, validatePolicy} from './check.mjs';
const valid = {version:1, context:'business', county_access:false, agent_sensitive_actions_enabled:false, external_authorization_required:true, denied_means_stop:true, secrets_in_model_context:false, secrets_in_logs:false, restart_requires_owner_review:true, approved_agent_destinations:[], max_automatic_attempts:1};
test('baseline accepts only disabled unreviewed agent actions', () => assert.deepEqual(validatePolicy(valid), []));
for (const [key,value] of Object.entries({county_access:true,agent_sensitive_actions_enabled:true,external_authorization_required:false,denied_means_stop:false,secrets_in_model_context:true,secrets_in_logs:true,restart_requires_owner_review:false,approved_agent_destinations:['https://unreviewed.invalid'],max_automatic_attempts:2})) {
  test(`reject unsafe ${key}`, () => assert.ok(validatePolicy({...valid,[key]:value}).length));
}
test('detect private keys without printing value',()=>assert.equal(credentialRule('-----BEGIN '+ 'PRIVATE KEY-----'), 'private-key'));
test('detect AWS key',()=>assert.equal(credentialRule('AKIA'+'A'.repeat(16)), 'aws-access-key'));
test('detect model secret',()=>assert.equal(credentialRule('sk-'+'a'.repeat(40)), 'model-api-secret'));
test('detect Stripe secret',()=>assert.equal(credentialRule('sk_live_'+'a'.repeat(24)), 'stripe-secret'));
test('detect privileged JWT role',()=>assert.equal(credentialRule('eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.abc'), 'supabase-service-key'));
test('allow public identifiers',()=>assert.equal(credentialRule('https://example.supabase.co sb_publishable_example'), null));
