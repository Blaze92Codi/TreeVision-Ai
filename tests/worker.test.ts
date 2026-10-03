import {test} from 'node:test';
import assert from 'node:assert/strict';
import workerModule from '../worker/src/index.ts';
const worker = (workerModule as any).default || workerModule;
const id='11111111-1111-4111-8111-111111111111';
const customerToken='private-customer-capability';
function env() {
  let storageReads=0;
  const settings:any = {
    ADMIN_TOKEN:'private-staff-token', ALLOWED_ORIGINS:'https://local',
    DB:{prepare:(sql:string)=>({bind(){return this;},first:async()=>
      sql.includes('FROM trees t JOIN') ? {photo_key:'private.jpg',share_token:customerToken}
      : sql.includes('FROM estimates') ? {id,share_token:customerToken,status:'draft',contact_id:null}
      : null,
      all:async()=>({results:[]}), run:async()=>({success:true})})},
    PHOTOS:{get:async()=>{ storageReads++; return {body:'photo',writeHttpMetadata:()=>{}}; }},
  };
  return {settings,reads:()=>storageReads};
}
const context:any={waitUntil(){},passThroughOnException(){}};
test('UUID knowledge does not authorize estimate reads or any estimate mutation',async()=>{
  for(const [method,suffix] of [['GET',''],['POST','/tree'],['POST','/contact'],['POST','/submit'],['PATCH','/tree/x'],['DELETE','/tree/x']]) {
    const {settings}=env();
    const response=await worker.fetch(new Request(`https://local/api/estimate/${id}${suffix}`,{method}),settings,context);
    assert.equal(response.status,403);
    const wrong=await worker.fetch(new Request(`https://local/api/estimate/${id}${suffix}`,{method,headers:{Authorization:'Bearer wrong'}}),settings,context);
    assert.equal(wrong.status,403);
  }
});
test('customer capability and staff token authorize reads; photo proxy rejects anonymous and wrong tokens before storage access',async()=>{
  for(const token of [customerToken,'private-staff-token']) {
    const {settings}=env();
    const response=await worker.fetch(new Request(`https://local/api/estimate/${id}`,{headers:{Authorization:'Bearer '+token}}),settings,context);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'no-store');
  }
  const {settings,reads}=env();
  for(const query of ['', '?token=wrong']) {
    const res=await worker.fetch(new Request(`https://local/api/tree-photo/${id}${query}`),settings,context);
    assert.equal(res.status,403); assert.equal(reads(),0);
  }
  const photo=await worker.fetch(new Request(`https://local/api/tree-photo/${id}?token=${customerToken}`),settings,context);
  assert.equal(photo.status,200); assert.equal(reads(),1);
  assert.equal(photo.headers.get('cache-control'),'no-store');
  const staff=await worker.fetch(new Request(`https://local/api/tree-photo/${id}`,{headers:{Authorization:'Bearer private-staff-token'}}),settings,context);
  assert.equal(staff.status,200);
});
test('missing admin configuration cannot grant staff access',async()=>{
  const {settings}=env();delete settings.ADMIN_TOKEN;
  const response=await worker.fetch(new Request('https://local/api/admin/leads',{headers:{Authorization:'Bearer undefined'}}),settings,context);
  assert.equal(response.status,401);
});

test('encoded estimate IDs cannot bypass authorization; preflight remains usable',async()=>{
  const {settings}=env();
  const encoded=await worker.fetch(new Request(`https://local/api/estimate/%31${id.slice(1)}`),settings,context);
  assert.equal(encoded.status,403);
  const preflight=await worker.fetch(new Request(`https://local/api/estimate/${id}/tree`,{method:'OPTIONS',headers:{Origin:'https://local','Access-Control-Request-Method':'POST'}}),settings,context);
  assert.equal(preflight.status,204);
});
