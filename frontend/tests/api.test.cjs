const test = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { load } = require('./load-ts.cjs');
const uuid = '10000000-0000-4000-8000-000000000001';
const payload = { customerId: uuid, operatorId: uuid, serviceId: uuid, startAt: '2030-09-17T10:00:00+02:00', idempotencyKey: 'intent-1' };
const req = (path, method='GET', body, headers={}) => new NextRequest(`https://example.com/api/v1/${path}`, {
  method, headers: { origin: 'https://example.com', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
function route(path, auth={ authorized: true }, repository={}) {
  return load(`src/app/api/v1/${path}/route.ts`, {
    '@/server/auth/staffAuth': { verifyStaffAuthorization: async () => auth },
    '@/server/db/repositories': { BookingRepository: repository },
    '@/server/domain/booking/availabilityService': { AvailabilityService: { findAvailableSlots: async () => [] } },
  });
}
test('booking/availability endpoints reject missing authentication and nonstaff', async () => {
  for (const status of [401, 403]) {
    const auth = { authorized: false, status, error: 'denied' };
    assert.equal((await route('bookings',auth).GET(req('bookings'))).status,status);
    assert.equal((await route('bookings',auth).POST(req('bookings','POST',payload))).status,status);
    assert.equal((await route('bookings/[id]',auth).PATCH(req('bookings/x','PATCH',{}),{params:Promise.resolve({id:uuid})})).status,status);
    assert.equal((await route('availability',auth).GET(req('availability'))).status,status);
  }
});
test('POST validates object, UUIDs, timezone, and mandatory stable idempotency key', async () => {
  for (const body of [null, [], {}, {...payload,customerId:'bad'}, {...payload,idempotencyKey:undefined}, {...payload,idempotencyKey:' '}, {...payload,startAt:'2030-02-30T10:00:00Z'}, {...payload,startAt:'2030-09-17T10:00:00'}]) {
    assert.equal((await route('bookings').POST(req('bookings','POST',body))).status,400,JSON.stringify(body));
  }
});
test('POST forces dashboard source, preserves key across retry, never forwards endAt', async () => {
  const calls=[];
  const api=route('bookings',undefined,{createBooking:async x => {calls.push(x);return {id:uuid};}});
  for(let n=0;n<2;n++) assert.equal((await api.POST(req('bookings','POST',{...payload,source:'manual',endAt:'2030-09-17T20:00:00Z'}))).status,201);
  assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].source,'dashboard');assert.equal(calls[0].idempotencyKey,'intent-1');assert.ok(!('endAt' in calls[0]));
});
test('central mapping handles DB conflicts, invalid input and unknown failures', async () => {
  const {errorStatus}=load('src/server/http/api.ts');
  for(const code of ['TB_INVALID_STATE','TB_IDEMPOTENCY_MISMATCH','TB_HOLD_EXPIRED','TB_BLOCKED_PERIOD','23P01']) assert.equal(errorStatus(new Error(code)),409);
  for(const code of ['TB_START_INVALID','TB_IDEMPOTENCY_REQUIRED','22P02','23514']) assert.equal(errorStatus(new Error(code)),400);
  assert.equal(errorStatus({code:'23503'}),404);assert.equal(errorStatus(new Error('TB_BOOKING_NOT_FOUND')),404);
  assert.equal(errorStatus(new Error('network unavailable')),500);
});
test('PATCH rejects inverted ranges, invalid UUID, null optional values and invalid action',async()=>{
  for(const body of [{action:'invalid'}, {action:'reschedule',startAt:payload.startAt,endAt:'2020-01-01T00:00:00Z'}, {action:'reschedule',startAt:payload.startAt,operatorId:'bad'}, {action:'reschedule',startAt:payload.startAt,endAt:null}, {action:'confirm',startAt:payload.startAt}]) {
    assert.equal((await route('bookings/[id]').PATCH(req('bookings/x','PATCH',body),{params:Promise.resolve({id:uuid})})).status,400);
  }
});
test('PATCH normal reschedule leaves endAt unspecified; conflicts are HTTP 409',async()=>{
  let call;
  const api=route('bookings/[id]',undefined,{changeBooking:async x=>{call=x;return {id:uuid};}});
  assert.equal((await api.PATCH(req('bookings/x','PATCH',{action:'reschedule',startAt:payload.startAt}),{params:Promise.resolve({id:uuid})})).status,200);
  assert.equal(call.endAt,undefined);
  const conflict=route('bookings/[id]',undefined,{changeBooking:async()=>{throw new Error('TB_INVALID_STATE');}});
  assert.equal((await conflict.PATCH(req('bookings/x','PATCH',{action:'confirm'}),{params:Promise.resolve({id:uuid})})).status,409);
});
test('availability rejects invalid calendar dates, UUIDs and fractional/partial granularity',async()=>{
  for(const suffix of ['',`?serviceId=${uuid}&date=2030-02-30`,`?serviceId=${uuid}&granularity=15foo`,`?serviceId=${uuid}&granularity=2.5`,`?serviceId=${uuid}&operatorId=nope`])
    assert.equal((await route('availability').GET(req('availability'+suffix))).status,400);
});
test('GET bookings rejects inverted ranges and bad filter UUIDs',async()=>{
  assert.equal((await route('bookings').GET(req(`bookings?startAt=${payload.startAt}&endAt=2020-01-01T00:00:00Z`))).status,400);
});
function authWith({ user={id:uuid}, membership=null, operator=null, dbError=null }={}) {
  const client={auth:{getUser:async()=>({data:{user},error:null})},from(table){
    const chain={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:table==='staff_memberships'?membership:operator,error:dbError})};return chain;
  }};
  return load('src/server/auth/staffAuth.ts',{'../db/supabaseClient':{getSupabaseAdminClient:()=>client}}).verifyStaffAuthorization;
}
test('JWT requires explicit active membership: an unrelated authenticated user is denied',async()=>{
  const result=await authWith({operator:{id:uuid,active:true}})(req('bookings','GET',undefined,{authorization:'Bearer user-jwt'}));
  assert.equal(result.authorized,false);assert.equal(result.status,403);
  assert.equal((await authWith({membership:{operator_id:uuid},operator:{id:uuid,active:true}})(req('bookings','GET',undefined,{authorization:'Bearer user-jwt'}))).authorized,true);
});
test('missing/expired JWT is 401; database lookup failure propagates',async()=>{
  assert.equal((await authWith()(req('bookings'))).status,401);
  assert.equal((await authWith({user:null})(req('bookings','GET',undefined,{authorization:'Bearer bad'}))).status,401);
  await assert.rejects(()=>authWith({dbError:new Error('database offline')})(req('bookings','GET',undefined,{authorization:'Bearer jwt'})),/database offline/);
});
test('internal secret requires bearer and operator; old shared-secret cookies never authorize',async()=>{
  process.env.INTERNAL_API_SECRET='test-secret';
  const verify=authWith({operator:{id:uuid,active:true},user:null});
  assert.equal((await verify(req('bookings','GET',undefined,{authorization:'Bearer test-secret'}))).status,403);
  assert.equal((await verify(req('bookings','GET',undefined,{authorization:'Bearer test-secret','x-operator-id':uuid}))).authorized,true);
  assert.equal((await verify(req('bookings','GET',undefined,{cookie:'tb_staff_token=test-secret'}))).authorized,false);
  delete process.env.INTERNAL_API_SECRET;
});
test('cookie-authenticated writes reject cross-origin requests',async()=>{
  const result=await authWith()(req('bookings','POST',payload,{cookie:'tb_staff_token=jwt',origin:'https://attacker.example'}));
  assert.equal(result.status,403);
});
test('session GET does not manufacture credentials or cookies',async()=>{
  process.env.INTERNAL_API_SECRET='never-expose';
  const api=load('src/app/api/v1/auth/session/route.ts',{'@/server/auth/staffAuth':{verifyStaffAuthorization:async()=>({authorized:true,operator:{id:uuid}})}});
  const response=await api.GET(req('auth/session'));
  const text=await response.text();assert.ok(!text.includes('never-expose'));assert.ok(!text.includes('token'));assert.equal(response.headers.get('set-cookie'),null);
  delete process.env.INTERNAL_API_SECRET;
});
test('repository surfaces infrastructure errors and rejects expired confirmations',async()=>{
  const failure=new Error('database offline');
  const repo=load('src/server/db/repositories.ts',{'./supabaseClient':{getSupabaseAdminClient:()=>({rpc:async()=>({data:{status:'expired'},error:null})})}});
  await assert.rejects(()=>repo.BookingRepository.changeBooking({bookingId:uuid,action:'confirm'}),/TB_HOLD_EXPIRED/);
  repo.BookingRepository.confirmHold=async()=>{throw failure;};
  await assert.rejects(()=>repo.AppointmentRepository.confirmHold(uuid),/database offline/);
  await assert.rejects(()=>repo.BookingRepository.createBooking({...payload,idempotencyKey:undefined}),/TB_IDEMPOTENCY_REQUIRED/);
});
test('password login sets only a personal HttpOnly JWT after staff authorization',async()=>{
  process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_ANON_KEY='public-key';
  let receivedKey;
  const api=load('src/app/api/v1/auth/session/route.ts',{
    '@supabase/supabase-js':{createClient:(url,key)=>{receivedKey=key;return {auth:{signInWithPassword:async()=>({data:{session:{access_token:'personal-jwt',expires_in:3600}},error:null})}};}},
    '@/server/auth/staffAuth':{verifyStaffAuthorization:async r=>{assert.equal(r.headers.get('authorization'),'Bearer personal-jwt');return {authorized:true};}},
  });
  const response=await api.POST(req('auth/session','POST',{email:'staff@example.com',password:'test-password'}));
  assert.equal(response.status,200);assert.equal(receivedKey,'public-key');
  const cookie=response.headers.get('set-cookie');assert.match(cookie,/tb_staff_token=personal-jwt/);assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=strict/i);assert.match(cookie,/Max-Age=3600/i);
  assert.ok(!(await response.text()).includes('personal-jwt'));
  delete process.env.SUPABASE_URL;delete process.env.SUPABASE_ANON_KEY;
});
test('password login refuses nonstaff and cross-origin logins without issuing cookies',async()=>{
  process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_ANON_KEY='public-key';
  const api=load('src/app/api/v1/auth/session/route.ts',{
    '@supabase/supabase-js':{createClient:()=>({auth:{signInWithPassword:async()=>({data:{session:{access_token:'outsider',expires_in:3600}},error:null})}})},
    '@/server/auth/staffAuth':{verifyStaffAuthorization:async()=>({authorized:false,status:403,error:'Staff required'})},
  });
  for(const origin of ['https://example.com','https://attacker.example']) {
    const response=await api.POST(req('auth/session','POST',{email:'outsider@example.com',password:'test'}, {origin}));
    assert.equal(response.status,403);assert.equal(response.headers.get('set-cookie'),null);
  }
  delete process.env.SUPABASE_URL;delete process.env.SUPABASE_ANON_KEY;
});
