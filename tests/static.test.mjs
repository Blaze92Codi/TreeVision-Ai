import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import vm from 'node:vm';
test('all browser scripts parse and contain no privileged secrets or password bypass', async () => {
  for (const dir of ['..','../web']) for (const file of await readdir(dir)) {
    if (!/\.(html|js)$/.test(file)) continue;
    const source = await readFile(`${dir}/${file}`,'utf8');
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|sk-ant-[a-zA-Z0-9_-]{10,}|STAFF_PASSWORD|treecrew2026|x-api-key/);
    const scripts = file.endsWith('.js') ? [source] : [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
    for (const script of scripts) new vm.Script(script, {filename:file});
  }
});
test('both portal copies use live sessions and escape customer content', async () => {
  const root = await readFile('../portal.js','utf8');
  assert.equal(root,await readFile('../web/portal.js','utf8'));
  assert.match(root,/await staffToken\(\)/);
  assert.doesNotMatch(root,/Authorization:.*CONFIG.SUPABASE_KEY/);
  assert.match(root,/escapeHtml\(est.customer_name/);
  assert.match(root,/rpc\("is_staff"\)/);
});
test('signup and photo defaults are private; Edge Functions share bounded guards',async()=> {
  const config=await readFile('../supabase/config.toml','utf8');
  assert.equal((config.match(/enable_signup = false/g)||[]).length,2);
  assert.doesNotMatch(config,/public = true/);
  for(const name of ['analyze','save-estimate','send-quote']) {
    const source=await readFile(`../supabase/functions/${name}/index.ts`,'utf8');
    assert.match(source,/methodResponse\(req\)/); assert.match(source,/readJson\(req,/);
    assert.match(source,/consumeBudget\(/); assert.match(source,/responseError\(err\)/);
  }
  assert.match(await readFile('../supabase/functions/send-quote/index.ts','utf8'),/await requireStaff\(req, supabase\)/);
});

test('deployment operation stops at metadata check when Supabase is inactive', async () => {
  const originalFetch=globalThis.fetch;
  const originalToken=process.env.SUPABASE_ACCESS_TOKEN;
  const originalStaff=process.env.TREEVISION_STAFF_USER_ID;
  const calls=[];
  process.env.SUPABASE_ACCESS_TOKEN='test-only-placeholder';
  process.env.TREEVISION_STAFF_USER_ID='11111111-1111-4111-8111-111111111111';
  globalThis.fetch=async (url, options)=>{
    calls.push({url,method:options.method});
    return new Response(JSON.stringify({status:'INACTIVE'}),{status:200});
  };
  try {
    await assert.rejects(import('../scripts/deploy-security.mjs?paused-test'),/inactive\/unhealthy/);
    assert.equal(calls.length,1);
    assert.equal(calls[0].method,'GET');
    assert.equal(calls[0].url,'https://api.supabase.com/v1/projects/hydlxwjtdkzcnxxukakt');
  } finally {
    globalThis.fetch=originalFetch;
    if(originalToken===undefined)delete process.env.SUPABASE_ACCESS_TOKEN;else process.env.SUPABASE_ACCESS_TOKEN=originalToken;
    if(originalStaff===undefined)delete process.env.TREEVISION_STAFF_USER_ID;else process.env.TREEVISION_STAFF_USER_ID=originalStaff;
  }
});
