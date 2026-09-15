const test = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { load } = require('./load-ts.cjs');

test('customer creation persists explicit consents and rejects malformed fields before writing', async () => {
  const calls=[];
  const api=load('src/app/api/v1/customers/route.ts',{
    '@/server/auth/staffAuth':{verifyStaffAuthorization:async()=>({authorized:true})},
    '@/server/db/repositories':{CustomerRepository:{create:async x=>{calls.push(x);return {id:'new'};}}},
  });
  const post=body=>api.POST(new NextRequest('https://example.test/api/v1/customers',{
    method:'POST',body:JSON.stringify(body),headers:{'content-type':'application/json'},
  }));
  assert.equal((await post({firstName:' Test ',privacyConsent:true,marketingConsent:false})).status,201);
  assert.equal(calls[0].privacyConsent,true);
  assert.equal(calls[0].marketingConsent,false);
  assert.equal((await post({firstName:'Test'})).status,201);
  assert.equal(calls[1].privacyConsent,undefined);
  for(const extra of [{privacyConsent:'true'},{marketingConsent:null},{phone:{}},{email:5},{notes:[]}]) {
    assert.equal((await post({firstName:'Test',...extra})).status,400);
  }
  assert.equal(calls.length,2);
});

test('customer search does not let PostgREST grammar or wildcards alter filters', async () => {
  let filter;
  const chain={select(){return this;},order(){return this;},or(x){filter=x;return this;},limit:async()=>({data:[],error:null})};
  const {CustomerRepository}=load('src/server/db/repositories.ts',{
    './supabaseClient':{getSupabaseAdminClient:()=>({from:()=>chain})},
  });
  await CustomerRepository.search('Mario),id.neq.0,first_name.ilike.*');
  assert.ok(!/[()*_]/.test(filter.replaceAll('first_name','firstName').replaceAll('last_name','lastName')));
  assert.equal(filter.split(',').length,3);
  await CustomerRepository.search("D'Amico");
  assert.ok(filter.includes("D'Amico"));
  await CustomerRepository.search('+39 333');
  assert.ok(filter.includes('+39 333'));
  filter=undefined;
  assert.deepEqual(await CustomerRepository.search('%_*(),'),[]);
  assert.equal(filter,undefined);
  await assert.rejects(()=>CustomerRepository.search('a'.repeat(201)),/TB_INVALID_REQUEST/);
});

test('saving an existing booking updates it and never creates a duplicate', () => {
  const {bookingSaveRequest}=load('src/lib/bookingSaveRequest.ts');
  const app={id:'10000000-0000-4000-8000-000000000001',clientId:'customer',serviceId:'service',staffId:'operator',
    clientName:'Test',clientPhone:'123',clientEmail:'',hasPrivacyConsent:false,date:'2030-09-17',startTime:'10:00',durationMinutes:30,notes:''};
  const update=bookingSaveRequest({...app,staffId:'other'},app,'key');
  assert.equal(update.method,'PATCH');
  assert.equal(update.url,`/api/v1/bookings/${app.id}`);
  assert.equal(update.body.action,'reschedule');
  assert.equal(update.body.endAt,undefined);
  const duration=bookingSaveRequest({...app,durationMinutes:45},app,'key');
  assert.equal(Date.parse(duration.body.endAt)-Date.parse(duration.body.startAt),45*60000);
  for(const change of [{clientId:'other'},{serviceId:'other'},{notes:'new'}]) {
    assert.throws(()=>bookingSaveRequest({...app,...change},app,'key'),/non sono ancora supportate/);
  }
  for(const change of [{clientName:'other'},{clientPhone:'other'},{clientEmail:'a@b.it'}]) {
    assert.equal(bookingSaveRequest({...app,...change},app,'key').method,'PATCH');
  }
  assert.throws(()=>bookingSaveRequest(app,undefined,'key'),/non più presente/);
  const create=bookingSaveRequest({...app,id:'app-123'},undefined,'stable-key');
  assert.equal(create.method,'POST');
  assert.equal(create.body.idempotencyKey,'stable-key');
});

test('timestamps reject normalized 24:00 and invalid clock components', () => {
  const {isTimestamp}=load('src/server/http/api.ts');
  for(const value of ['2030-09-17T24:00:00Z','2030-09-17T12:60:00Z','2030-09-17T12:00:60Z','2030-09-17T12:00:00+24:00']) assert.equal(isTimestamp(value),false);
  assert.equal(isTimestamp('2030-09-17T10:00:00+02:00'),true);
});
