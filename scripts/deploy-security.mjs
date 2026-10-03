// Run ONLY after explicitly authorized reactivation. This script never restores
// a paused project, creates a branch/project, or calls a paid AI/email endpoint.
import {spawnSync} from 'node:child_process';
const ref='hydlxwjtdkzcnxxukakt';
const token=process.env.SUPABASE_ACCESS_TOKEN;
const staff=process.env.TREEVISION_STAFF_USER_ID;
if (!token || !/^[0-9a-f-]{36}$/i.test(staff || '')) throw new Error('Set SUPABASE_ACCESS_TOKEN and a verified TREEVISION_STAFF_USER_ID privately.');
async function management(path, method='GET', body) {
  const res=await fetch('https://api.supabase.com/v1/'+path, {method,
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:body?JSON.stringify(body):undefined});
  if(!res.ok) throw new Error(`Management request failed (${res.status}); no response body logged.`);
  return res.status===204?null:res.json();
}
const project=await management('projects/'+ref);
if(project.status!=='ACTIVE_HEALTHY') throw new Error('Project is inactive/unhealthy. Stopped without reactivating it.');
// Hosted Auth settings are independent of local config.toml.
await management(`projects/${ref}/config/auth`,'PATCH',{disable_signup:true,external_anonymous_users_enabled:false});
const auth=await management(`projects/${ref}/config/auth`);
if(auth.disable_signup!==true) throw new Error('Hosted signup disablement was not confirmed.');
function cli(args) {
  const result=spawnSync('supabase',args,{stdio:'inherit',shell:false});
  if(result.status!==0) throw new Error('Deployment stopped. Keep public traffic disabled until repaired.');
}
cli(['link','--project-ref',ref]);
cli(['db','push']);
// Uses the Management API SQL endpoint; allowlist only the operator-selected UUID.
const provision=await management(`projects/${ref}/database/query`,'POST',{
  query:`insert into public.staff_members(user_id) select id from auth.users where id='${staff}'::uuid on conflict do nothing; select public from storage.buckets where id='tree-photos'; select count(*)::integer as n from public.staff_members where user_id='${staff}'::uuid;`
});
if(!Array.isArray(provision) || !provision.some(r=>r.n===1))
  throw new Error('Staff provisioning was not confirmed; traffic must stay disabled.');
for(const name of ['analyze','save-estimate','send-quote']) cli(['functions','deploy',name,'--project-ref',ref,'--no-verify-jwt']);
console.log('Security deployment completed. Run activation-time access verification before enabling public traffic.');
