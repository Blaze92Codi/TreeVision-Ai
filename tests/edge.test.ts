import { submissionRecord } from "../supabase/functions/_shared/intake.ts";
import { analysisRequest, image, readJson, RequestError, requireStaff, text, consumeBudget } from "../supabase/functions/_shared/security.ts";
function assert(value: unknown) { if (!value) throw new Error("Assertion failed"); }
async function denied(fn: () => unknown, status: number) {
  try { await fn(); } catch (e) { assert(e instanceof RequestError && e.status === status); return; }
  throw new Error("Expected rejection");
}
Deno.test('streamed JSON limits and malformed input fail before handling', async () => {
  await denied(() => readJson(new Request('https://local', {method:'POST',body:'12345',headers:{'content-type':'application/json'}}),4),413);
  await denied(() => readJson(new Request('https://local', {method:'POST',body:'[]',headers:{'content-type':'application/json'}}),10),400);
  await denied(() => readJson(new Request('https://local', {method:'POST',body:'{}'}),10),415);
});
Deno.test('photos and analysis reject URL fetching, arbitrary paid options and oversized prompts', async () => {
  await denied(() => image('https://internal/secret'),400);
  await denied(() => image('data:image/png;base64,YWJj'),400);
  await denied(() => text('x'.repeat(501),500),400);
  const photo = {type:'image',source:{type:'base64',media_type:'image/jpeg',data:'/9j/AA=='}};
  const payload = analysisRequest({ model:'expensive',max_tokens:100000,tools:[{}],messages:[{role:'user',content:[photo,{type:'text',text:'Assess tree'}]}]});
  assert(payload.model === 'claude-sonnet-4-5' && payload.max_tokens === 2000 && !('tools' in payload));
  await denied(() => analysisRequest({messages:[{role:'system',content:[]}]}),400);
});
Deno.test('JWT verification and staff membership are both mandatory; client metadata grants nothing', async () => {
  const req = new Request('https://local',{headers:{Authorization:'Bearer arbitrary'}});
  const unauth = {auth:{getUser:()=>({data:{user:null},error:true})}};
  await denied(() => requireStaff(req, unauth as any),401);
  const fake = (member: boolean) => ({auth:{getUser:()=>({data:{user:{id:'x',user_metadata:{role:'staff'}}}})},
    from:()=>({select:()=>({eq:()=>({maybeSingle:()=>({data:member?{user_id:'x'}:null})})})})});
  await denied(() => requireStaff(req, fake(false) as any),403);
  assert((await requireStaff(req, fake(true) as any)).id === 'x');
  await denied(() => requireStaff(new Request('https://local'),fake(true) as any),401);
});
Deno.test('unavailable or exhausted durable limiter fails closed', async () => {
  await denied(() => consumeBudget({rpc:()=>({data:false})} as any,'analyze'),429);
  await denied(() => consumeBudget({rpc:()=>({error:true})} as any,'analyze'),503);
});

Deno.test('public intake preserves valid submission and strips forged staff fields and external photo URLs', async () => {
  const {record,photo}=submissionRecord({analysis:{common_name:'Oak',quote_low:100,quote_high:200},
    contact:{name:'Customer',email:'customer@example.com'},service:'Trim',
    status:'approved',approved_by:'Admin',approved_quote_low:1,manager_notes:'Forged',
    photo_url:'https://attacker.example/customer.jpg'});
  assert(record.status==='pending' && record.customer_name==='Customer' && photo===null);
  assert(!('approved_by' in record) && !('approved_quote_low' in record) && !('manager_notes' in record) && !('photo_url' in record));
  await denied(()=>submissionRecord({analysis:{quote_low:-1},contact:{name:'Customer'}}),400);
  await denied(()=>submissionRecord({analysis:{quote_low:100,quote_high:50},contact:{name:'Customer'}}),400);
  await denied(()=>submissionRecord({analysis:{},contact:{name:'Customer',email:'invalid'}}),400);
  await denied(()=>submissionRecord({analysis:{annotations:new Array(101)},contact:{name:'Customer'}}),400);
  await denied(()=>submissionRecord({analysis:{},contact:{name:'Customer'},photo:'https://internal/secret'}),400);
});
