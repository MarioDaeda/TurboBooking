import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
const root=new URL('../../db/',import.meta.url);
test('SQL migrations, duration contract, ACL, idempotency, conflicts and expired holds',async()=>{
 const db=new PGlite({extensions:{btree_gist}});
 try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);');
  const files=fs.readdirSync(new URL('migrations/',root)).filter(x=>x.endsWith('.sql')).sort();
  for(const file of files) {
   try {await db.exec(fs.readFileSync(new URL('migrations/'+file,root),'utf8'));}
   catch(e){throw new Error(`Migration ${file}: ${e.message}`,{cause:e});}
  }
  const migration=fs.readFileSync(new URL('migrations/0002_turbobooking_v1_2_durate.sql',root),'utf8');
  const optional=migration.split('/* TEST FACOLTATIVO:')[1];
  await db.exec(optional.slice(optional.indexOf('BEGIN;'),optional.lastIndexOf('*/')));
  const seed=fs.readFileSync(new URL('seeds/01_seed_initial_data.sql',root),'utf8');
  await db.exec(seed);await db.exec(seed);
  assert.equal((await db.query('select count(*)::int as n from services')).rows[0].n,40);
  const signatures=await db.query("select oid::regprocedure::text as signature,proconfig from pg_proc where proname in ('tb_create_booking','tb_change_booking','tb_expire_holds')");
  assert.equal(signatures.rows.length,3);
  for(const {signature,proconfig} of signatures.rows) {
   assert.ok(proconfig.includes('search_path=""'));
   const acl=await db.query("select has_function_privilege('anon',$1,'EXECUTE') as anon,has_function_privilege('authenticated',$1,'EXECUTE') as authenticated,has_function_privilege('service_role',$1,'EXECUTE') as service_role",[signature]);
   assert.deepEqual(acl.rows[0],{anon:false,authenticated:false,service_role:true});
  }
  assert.equal((await db.query("select has_table_privilege('service_role','bookings','INSERT') as allowed")).rows[0].allowed,false);
  assert.equal((await db.query("select has_table_privilege('authenticated','staff_memberships','INSERT') as allowed")).rows[0].allowed,false);
  for (const table of ['inbound_webhooks','external_refs','notification_messages']) {
    const acl=(await db.query("select has_table_privilege('anon',$1,'SELECT') as anon,has_table_privilege('authenticated',$1,'SELECT') as authenticated,has_table_privilege('service_role',$1,'SELECT') as service_role",[table])).rows[0];
    assert.deepEqual(acl,{anon:false,authenticated:false,service_role:true});
  }
  await db.query("insert into inbound_webhooks(provider,external_id,signature_valid,payload) values('meta','evt-1',true,'{}')");
  await assert.rejects(()=>db.query("insert into inbound_webhooks(provider,external_id,signature_valid,payload) values('meta','evt-1',true,'{}')"),/inbound_webhooks_provider_external_id_key/);
  const op=(await db.query("insert into operators(name) values('Test') returning id")).rows[0].id;
  const service=(await db.query("insert into services(name,duration_minutes,price) values('Test',30,20) returning id")).rows[0].id;
  const customer=(await db.query("insert into customers(first_name) values('Test') returning id")).rows[0].id;
  await db.query("insert into working_hours(operator_id,day_of_week,start_time,end_time) values($1,2,'09:00','12:00'),($1,2,'14:00','19:00')",[op]);
  const start='2030-09-17T08:00:00Z';
  const create=(key,hold=false,at=start,notes=null)=>db.query("select tb_create_booking($1,$2,$3,$4,'dashboard',$5,$6,$7) as b",[customer,op,service,at,key,hold,notes]);
  const b=(await create('one')).rows[0].b;
  await db.query('update services set duration_minutes=60,price=100 where id=$1',[service]);
  const moved=(await db.query("select tb_change_booking($1,'reschedule','2030-09-17T09:00:00Z') as b",[b.id])).rows[0].b;
  assert.equal(Date.parse(moved.end_at)-Date.parse(moved.start_at),30*60000);assert.equal(moved.price_snapshot,20);
  assert.equal((await create('one')).rows[0].b.id,b.id);
  await assert.rejects(()=>create('one',false,start,'changed'),/TB_IDEMPOTENCY_MISMATCH/);
  await assert.rejects(()=>create(''),/TB_IDEMPOTENCY_REQUIRED/);
  await assert.rejects(()=>create('lunch',false,'2030-09-17T10:30:00Z'),/TB_OUTSIDE_WORKING_HOURS/);
  await db.query("insert into blocked_periods(operator_id,start_at,end_at) values($1,'2030-09-17T12:00:00Z','2030-09-17T13:00:00Z')",[op]);
  await assert.rejects(()=>db.query("select tb_change_booking($1,'reschedule','2030-09-17T12:00:00Z')",[b.id]),/TB_BLOCKED_PERIOD/);
  await assert.rejects(()=>create('overlap',false,'2030-09-17T09:00:00Z'),/bookings_no_operator_overlap/);
  await db.query("select tb_change_booking($1,'cancel')",[b.id]);
  await assert.rejects(()=>db.query("select tb_change_booking($1,'confirm')",[b.id]),/TB_INVALID_STATE/);
  const hold=(await create('hold',true,'2030-09-17T14:00:00Z')).rows[0].b;
  await db.query("update bookings set hold_expires_at=clock_timestamp()+interval '50 milliseconds' where id=$1",[hold.id]);
  await new Promise(r=>setTimeout(r,70));
  const expired=(await db.query("select tb_change_booking($1,'confirm') as b",[hold.id])).rows[0].b;
  assert.equal(expired.status,'expired');
  assert.equal((await create('replacement',false,'2030-09-17T14:00:00Z')).rows[0].b.status,'confirmed');
  await db.exec('SET ROLE service_role');
  assert.equal((await db.query('select tb_expire_holds() as n')).rows[0].n,0);
  await assert.rejects(()=>db.query('insert into bookings default values'),/permission denied/);
  await db.exec('RESET ROLE; SET ROLE authenticated');
  await assert.rejects(()=>db.query('select public.tb_expire_holds()'),/permission denied/);
 }finally{await db.close();}
});
