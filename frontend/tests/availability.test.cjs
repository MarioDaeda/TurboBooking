const test=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load-ts.cjs');
const id='10000000-0000-4000-8000-000000000001';
const base={serviceId:id,targetDate:'2030-09-17'};
function service(overrides={}) {
 const repositories={
  BookingRepository:{expireHolds:async()=>0,listOccupying:async()=>[]},
  ServiceRepository:{getById:async()=>({id,name:'Taglio',active:true,is_bookable_online:true,duration_minutes:30,price:25})},
  OperatorRepository:{
   listActive:async()=>[{id,name:'Staff',active:true,is_bookable_online:true}],
   listBookableOnline:async()=>[{id,name:'Staff',active:true,is_bookable_online:true}],
  },
  WorkingHoursRepository:{listActiveForDay:async()=>[{start_time:'09:00:00',end_time:'10:00:00'},{start_time:'14:00:00',end_time:'15:00:00'}]},
  BlockedPeriodRepository:{listOverlapping:async()=>[]},...overrides,
 };
 return load('src/server/domain/booking/availabilityService.ts',{'../../db/repositories':repositories}).AvailabilityService;
}
test('multiple shifts preserve lunch break',async()=>{
 const slots=await service().findAvailableSlots(base);
 assert.deepEqual(slots.map(s=>s.startsAt.slice(11,16)),['07:00','07:15','07:30','12:00','12:15','12:30']);
});
test('adjacent and overlapping shifts merge without duplicate slots',async()=>{
 const slots=await service({WorkingHoursRepository:{listActiveForDay:async()=>[
  {start_time:'09:00',end_time:'09:30'},{start_time:'09:30',end_time:'10:00'},{start_time:'09:45',end_time:'10:00'},
 ]}}).findAvailableSlots(base);assert.equal(slots.length,3);
});
test('bookings and blocked periods remove all overlapping slots',async()=>{
 const slots=await service({
  BookingRepository:{expireHolds:async()=>0,listOccupying:async()=>[{start_at:'2030-09-17T07:00:00Z',end_at:'2030-09-17T07:30:00Z'}]},
  BlockedPeriodRepository:{listOverlapping:async()=>[{start_at:'2030-09-17T12:15:00Z',end_at:'2030-09-17T13:00:00Z'}]},
 }).findAvailableSlots(base);assert.deepEqual(slots.map(s=>s.startsAt.slice(11,16)),['07:30']);
});
test('expiry failures and unknown services/operators never silently fall back',async()=>{
 await assert.rejects(()=>service({BookingRepository:{expireHolds:async()=>{throw new Error('offline');}}}).findAvailableSlots(base),/offline/);
 await assert.rejects(()=>service({ServiceRepository:{getById:async()=>null}}).findAvailableSlots(base),/TB_SERVICE_NOT_FOUND/);
 await assert.rejects(()=>service().findAvailableSlots({...base,preferredStaffId:'20000000-0000-4000-8000-000000000001'}),/TB_OPERATOR_NOT_FOUND/);
});
test('service id is mandatory and manual-only services are rejected',async()=>{
 await assert.rejects(()=>service().findAvailableSlots({targetDate:base.targetDate}),/TB_SERVICE_REQUIRED/);
 const manual=service({ServiceRepository:{getById:async()=>({id,name:'Manuale',active:true,is_bookable_online:false,duration_minutes:30,price:25})}});
 assert.ok((await manual.findAvailableSlots(base)).length > 0, 'la dashboard può vedere servizi manuali');
 await assert.rejects(()=>manual.findAvailableSlots({...base,onlineOnly:true}),/TB_SERVICE_MANUAL_ONLY/);
});
test('Rome winter/summer offsets, midnight, spring gap and autumn fold',()=>{
 const {romeLocalToUtc}=load('src/lib/romeTime.ts');
 assert.equal(romeLocalToUtc('2030-01-15','09:00').toISOString(),'2030-01-15T08:00:00.000Z');
 assert.equal(romeLocalToUtc('2030-07-15','09:00').toISOString(),'2030-07-15T07:00:00.000Z');
 assert.equal(romeLocalToUtc('2030-07-15','23:00').toISOString(),'2030-07-15T21:00:00.000Z');
 assert.equal(romeLocalToUtc('2030-07-15','00:00').toISOString(),'2030-07-14T22:00:00.000Z');
 assert.throws(()=>romeLocalToUtc('2026-03-29','02:30'),/TB_START_INVALID/);
 assert.equal(romeLocalToUtc('2026-10-25','02:30').toISOString(),'2026-10-25T01:30:00.000Z');
});
