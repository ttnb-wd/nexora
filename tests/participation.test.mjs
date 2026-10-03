import './support/typescript-loader.mjs';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='server-only')return {url:'data:text/javascript,export%20default%20{}',shortCircuit:true};
 const stubs={ '@/lib/db':'export const getDb=()=>globalThis.participationDb', '@/features/auth/server/session':'export const getCurrentUser=async()=>globalThis.participationUser; export const requireUser=async()=>{if(!globalThis.participationUser)throw Error("Sign in");return globalThis.participationUser}', '@/features/events/server/authorization':'export const requireEventAccess=async(id,scope)=>{globalThis.accessCalls.push({id,scope}); if(!globalThis.allowManager)throw Error("Denied");return {event:{id}}}' };
 if(stubs[specifier])return {url:`data:text/javascript,${encodeURIComponent(stubs[specifier])}`,shortCircuit:true};
 if(specifier.startsWith('@/')) {const path=new URL(`../src/${specifier.slice(2)}.ts`,import.meta.url);if(existsSync(path))return nextResolve(path.href,context);}
 return nextResolve(specifier,context);
}});
const service=await import('../src/features/participation/server/service.ts');
const rules=await import('../src/features/participation/rules.ts');
function setup(overrides={}) {
 const event={id:'event-internal',title:'Real event',slug:'real-event',status:'PUBLISHED',startAt:new Date('2090-01-01'),endAt:new Date('2090-01-02'),capacity:1,registrationDeadline:null,...overrides};
 const registrations=new Map(),bookmarks=new Map(),calls=[];
 let release=Promise.resolve();
 const key=(where)=>`${where.userId}:${where.eventId}`;
 const tx={
  notification:{create:async({data})=>data},
  $queryRaw:async(strings,...values)=>{calls.push({sql:strings.join('?'),values})},
  event:{findUnique:async()=>event},
  eventRegistration:{
   findUnique:async({where})=>registrations.get(key(where.userId_eventId))??null,
   count:async({where})=>[...registrations.values()].filter(r=>r.eventId===where.eventId&&(typeof where.status==='string'?r.status===where.status:where.status.in.includes(r.status))).length,
   upsert:async({where,create,update})=>{const k=key(where.userId_eventId);const row=registrations.has(k)?{...registrations.get(k),...update}:create;registrations.set(k,row);return row},
   updateMany:async({where,data})=>{const k=key(where);const row=registrations.get(k);if(row&&row.status===where.status){registrations.set(k,{...row,...data});return {count:1}}return {count:0}},
  },
  eventBookmark:{upsert:async({where,create})=>{bookmarks.set(key(where.userId_eventId),create);return create},deleteMany:async({where})=>({count:Number(bookmarks.delete(key(where)))})},
 };
 globalThis.participationUser={id:'alice'};
 globalThis.participationDb={...tx,$transaction:async(callback,options)=>{
  assert.equal(options.isolationLevel,'ReadCommitted');
  const previous=release;let finish;release=new Promise(resolve=>{finish=resolve});await previous;
  try{return await callback(tx)}finally{finish()}
 }};
 return {event,registrations,bookmarks,calls};
}
test('untrusted identity input and unsafe return paths cannot select a user or redirect externally',async()=>{
 setup();globalThis.participationUser=null;
 const result=await service.mutateParticipation('real-event','join');assert.equal(result.ok,false);assert.equal(result.signIn,'/sign-in?returnTo=%2Fevents%2Freal-event');
 for(const input of [{slug:'real-event',userId:'alice'},'x',"evil' OR 1=1",'../private'])assert.equal((await service.mutateParticipation(input,'join')).ok,false);
 for(const path of ['https://example.com','//evil.test','/events/foo?returnTo=https://evil.test','/dashboard/admin','/events/%2f%2fevil'])assert.equal(rules.eventReturnPath(path),'/dashboard');
 assert.equal(rules.eventReturnPath('/events/real-event'),'/events/real-event');
});
test('join is idempotent, cancel repeatable, rejoin reuses the same row',async()=>{
 const state=setup();
 assert.equal((await service.mutateParticipation('real-event','join')).ok,true);
 assert.equal((await service.mutateParticipation('real-event','join')).ok,true);
 assert.equal(state.registrations.size,1);
 assert.equal((await service.mutateParticipation('real-event','cancel')).ok,true);
 assert.equal((await service.mutateParticipation('real-event','cancel')).ok,true);
 assert.equal(state.registrations.get('alice:event-internal').status,'CANCELLED');
 assert.equal((await service.mutateParticipation('real-event','join')).ok,true);assert.equal(state.registrations.size,1);
 assert.ok(state.calls.every(call=>call.sql.includes('FOR UPDATE')&&call.values[0]==='real-event'));
});
test('full events refuse new users; unlimited capacity and released seats allow joins',async()=>{
 const state=setup();await service.mutateParticipation('real-event','join');
 globalThis.participationUser={id:'bob'};
 assert.equal((await service.mutateParticipation('real-event','join')).message,'This event is full.');
 assert.equal(state.registrations.size,1);
 globalThis.participationUser={id:'alice'};await service.mutateParticipation('real-event','cancel');
 globalThis.participationUser={id:'bob'};assert.equal((await service.mutateParticipation('real-event','join')).ok,true);
 setup({capacity:null});assert.equal((await service.mutateParticipation('real-event','join')).ok,true);
});
test('session user cannot cancel or unsave another user and duplicate saves do not duplicate rows',async()=>{
 const state=setup();await service.mutateParticipation('real-event','join');await service.mutateParticipation('real-event','save');await service.mutateParticipation('real-event','save');assert.equal(state.bookmarks.size,1);
 globalThis.participationUser={id:'bob'};await service.mutateParticipation('real-event','cancel');await service.mutateParticipation('real-event','unsave');
 assert.equal(state.registrations.get('alice:event-internal').status,'REGISTERED');assert.equal(state.bookmarks.size,1);
 globalThis.participationUser={id:'alice'};await service.mutateParticipation('real-event','unsave');await service.mutateParticipation('real-event','unsave');assert.equal(state.bookmarks.size,0);
});
test('lifecycle, start/end time, server deadline and missing event block joins',async()=>{
 for(const status of ['DRAFT','CANCELLED','ARCHIVED','COMPLETED']){const state=setup({status});assert.equal((await service.mutateParticipation('real-event','join')).ok,false);assert.equal(state.registrations.size,0)}
 for(const override of [{startAt:new Date('2020-01-01')},{endAt:new Date('2020-01-01')},{registrationDeadline:new Date('2020-01-01')}]) {setup(override);assert.equal((await service.mutateParticipation('real-event','join')).ok,false)}
 setup();globalThis.participationDb.event.findUnique=async()=>null;assert.equal((await service.mutateParticipation('real-event','join')).message,'This event is no longer available.');
});
test('hidden-event cancellation and unsave preserve history; completed events can stay saved',async()=>{
 const state=setup();await service.mutateParticipation('real-event','join');await service.mutateParticipation('real-event','save');state.event.status='CANCELLED';
 assert.equal((await service.mutateParticipation('real-event','join')).ok,false);
 await service.mutateParticipation('real-event','cancel');await service.mutateParticipation('real-event','unsave');assert.equal(state.registrations.get('alice:event-internal').status,'CANCELLED');
 setup({status:'COMPLETED'});assert.equal((await service.mutateParticipation('real-event','save')).ok,true);
});
test('database exceptions never leak SQL, IDs or unique-constraint errors',async()=>{
 setup();globalThis.participationDb.$transaction=async()=>{throw Error('Prisma P2002 secret SQL userId')};const result=await service.mutateParticipation('real-event','save');assert.equal(result.ok,false);assert.ok(!JSON.stringify(result).includes('SQL')&&!JSON.stringify(result).includes('P2002'));
});
test('all personal queries constrain the session user, select status/event-only projections, and counts enforce access',async()=>{
 setup();const calls=[];
 globalThis.participationDb.eventRegistration.findFirst=async(args)=>{calls.push(args);return {status:'REGISTERED'}};
 globalThis.participationDb.eventBookmark.findFirst=async(args)=>{calls.push(args);return {createdAt:new Date()}};
 globalThis.participationDb.eventRegistration.findMany=async(args)=>{calls.push(args);return []};
 globalThis.participationDb.eventBookmark.findMany=async(args)=>{calls.push(args);return []};
 assert.equal(await service.getRegistrationForUser('real-event'),'REGISTERED');assert.equal(await service.isEventSavedByUser('real-event'),true);
 await service.getJoinedEvents();await service.getSavedEvents();await service.getBookmarkViewer();
 for(const args of calls){assert.equal(args.where.userId,'alice');assert.ok(!args.select.id&&!args.select.userId&&!args.select.eventId)}
 globalThis.accessCalls=[];globalThis.allowManager=false;await assert.rejects(service.getEventRegistrationCount('event-internal','real-org'));
 globalThis.allowManager=true;assert.equal(await service.getEventRegistrationCount('event-internal','real-org'),0);assert.equal(globalThis.accessCalls.length,2);
});
test('event detail exposes only viewer booleans and aggregate availability, with no participation record IDs',async()=>{
 const state=setup({capacity:12});
 globalThis.participationDb.event.findFirst=async(args)=>{assert.deepEqual(args.where,{slug:'real-event',status:{in:['PUBLISHED','COMPLETED']}});assert.deepEqual(args.select._count.select.registrations.where,{status:{in:['REGISTERED','ATTENDED']}});return {...state.event,_count:{registrations:5}}};
 globalThis.participationDb.eventRegistration.findFirst=async(args)=>{assert.equal(args.where.userId,'alice');assert.deepEqual(args.select,{status:true});return {status:'REGISTERED'}};
 globalThis.participationDb.eventBookmark.findFirst=async(args)=>{assert.equal(args.where.userId,'alice');assert.deepEqual(args.select,{createdAt:true});return {createdAt:new Date()}};
 const detail=await service.getEventParticipation('real-event');
 assert.deepEqual(detail,{viewer:{authenticated:true,joined:true,attended:false,saved:true},availability:{closedReason:null,spotsLeft:7}});
 assert.ok(!JSON.stringify(detail).includes('alice')&&!JSON.stringify(detail).includes('event-internal'));
});
test('attended registrations keep capacity occupied and cannot be rejoined or cancelled by the attendee',async()=>{
 const state=setup();
 state.registrations.set('alice:event-internal',{userId:'alice',eventId:state.event.id,status:'ATTENDED',checkedInAt:new Date('2026-10-03'),checkedInById:'organizer'});
 assert.equal((await service.mutateParticipation('real-event','join')).ok,false);
 assert.equal((await service.mutateParticipation('real-event','cancel')).ok,false);
 globalThis.participationUser={id:'bob'};
 assert.equal((await service.mutateParticipation('real-event','join')).message,'This event is full.');
 assert.equal(state.registrations.get('alice:event-internal').status,'ATTENDED');
});
test('personalized attended state is private to the viewer and has no audit or attendee identity fields',async()=>{
 const state=setup({capacity:1});
 globalThis.participationDb.event.findFirst=async()=>({...state.event,_count:{registrations:1}});
 globalThis.participationDb.eventRegistration.findFirst=async()=>({status:'ATTENDED'});
 globalThis.participationDb.eventBookmark.findFirst=async()=>null;
 const detail=await service.getEventParticipation('real-event');
 assert.deepEqual(detail.viewer,{authenticated:true,joined:false,attended:true,saved:false});
 assert.equal(detail.availability.spotsLeft,0);
 for(const secret of ['checkedInAt','checkedInById','userId','email','alice']) assert.ok(!JSON.stringify(detail).includes(secret));
});
