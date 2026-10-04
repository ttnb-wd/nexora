import './support/typescript-loader.mjs';
import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';
registerHooks({resolve(specifier,context,nextResolve){
 const stubs={
  '@/lib/db':'export const getDb=()=>globalThis.attendeeDb',
  '@/features/auth/server/session':'export const getCurrentUser=async()=>globalThis.attendeeUser; export const getAuthorizedUser=getCurrentUser',
  'next/cache':'export const revalidatePath=(...args)=>globalThis.attendeeRevalidations.push(args)',
 };
 if(stubs[specifier])return {url:`data:text/javascript,${encodeURIComponent(stubs[specifier])}`,shortCircuit:true};
 return nextResolve(specifier,context);
}});
const {mutateAttendance,loadManagedAttendees,loadManagedAttendeeSummary,attendeeSelect}=await import('../src/features/attendees/server/service.ts');
const schemas=await import('../src/features/attendees/schemas.ts');
const actions=await import('../src/features/attendees/server/actions.ts');
const target={eventId:'event',scope:'organization',registrationId:'registration'};
function setup(){
 const event={id:'event',slug:'event-slug',title:'Event',status:'PUBLISHED',capacity:2,timezone:'Asia/Yangon',organization:{slug:'organization'}};
 const registrations=[{id:'registration',eventId:'event',status:'REGISTERED',createdAt:new Date('2026-10-01'),checkedInAt:null,checkedInById:null,user:{name:'Alice Attendee',email:'private@example.com'}}, {id:'other-registration',eventId:'other-event',status:'REGISTERED',createdAt:new Date('2026-10-01'),checkedInAt:null,checkedInById:null,user:{name:'Unrelated Attendee'}}];
 const calls=[];let authorized=true;let tail=Promise.resolve();
 const matching=where=>registrations.filter(row=>row.eventId===where.eventId&&(!where.id||row.id===where.id)&&(!where.status||row.status===where.status)&&(!where.user||row.user.name.toLowerCase().includes(where.user.name.contains.toLowerCase())));
 const tx={
  $queryRaw:async(strings,...values)=>{calls.push({sql:strings.join('?'),values});},
  event:{findFirst:async(args)=>{
   calls.push(args);
   assert.deepEqual(args.where.AND[0].OR[1].organization.members.some.role,{in:['OWNER','ADMIN','EDITOR']});
   return authorized && args.where.id===event.id && args.where.organization?.slug===event.organization?.slug ? event : null;
  }},
  eventRegistration:{
   findFirst:async(args)=>{calls.push(args);return matching(args.where)[0]??null;},
   updateMany:async(args)=>{calls.push(args);const found=matching(args.where);for(const row of found)Object.assign(row,args.data);return {count:found.length};},
   count:async(args)=>{calls.push(args);return matching(args.where).length;},
   groupBy:async(args)=>{calls.push(args);const grouped={};for(const row of matching(args.where))grouped[row.status]=(grouped[row.status]??0)+1;return Object.entries(grouped).map(([status,count])=>({status,_count:{_all:count}}));},
   findMany:async(args)=>{calls.push(args);return matching(args.where).slice(args.skip,args.skip+args.take).map(row=>({id:row.id,status:row.status,createdAt:row.createdAt,checkedInAt:row.checkedInAt,user:{name:row.user.name}}));},
  },
 };
 const db={$transaction:async(callback)=>{const previous=tail;let finish;tail=new Promise(resolve=>{finish=resolve});await previous;try{return await callback(tx);}finally{finish();}}};
 globalThis.attendeeDb=db;globalThis.attendeeUser={id:'organizer'};globalThis.attendeeRevalidations=[];
 return {db,event,registrations,calls,setAuthorized(value){authorized=value;}};
}
test('check-in derives organizer identity, records time and remains idempotent under concurrent requests',async()=>{
 const state=setup();
 const results=await Promise.all([1,2].map(()=>mutateAttendance(state.db,'organizer',{...target,checkedInById:'forged-user'},'check-in')));
 assert.ok(results.every(result=>result.ok));
 assert.equal(state.registrations[0].status,'ATTENDED');assert.ok(state.registrations[0].checkedInAt instanceof Date);assert.equal(state.registrations[0].checkedInById,'organizer');
 const time=state.registrations[0].checkedInAt;
 assert.equal((await mutateAttendance(state.db,'another-manager',target,'check-in')).ok,true);
 assert.equal(state.registrations[0].checkedInAt,time);assert.equal(state.registrations[0].checkedInById,'organizer');
 assert.equal(state.calls.filter(call=>call.data).length,1);
 assert.ok(state.calls.filter(call=>call.sql).every(call=>call.sql.includes('FOR UPDATE')&&call.values[0]==='event'));
});
test('undo retains registration and clears check-in audit fields; concurrent repeats are safe',async()=>{
 const state=setup();await mutateAttendance(state.db,'organizer',target,'check-in');
 const results=await Promise.all([1,2].map(()=>mutateAttendance(state.db,'organizer',target,'undo')));
 assert.ok(results.every(result=>result.ok));assert.equal(state.registrations[0].status,'REGISTERED');
 assert.equal(state.registrations[0].checkedInAt,null);assert.equal(state.registrations[0].checkedInById,null);assert.equal(state.registrations.length,2);
});
test('invalid statuses, lifecycle, foreign registration IDs and lost access cannot mutate',async()=>{
 for(const status of ['CANCELLED','WAITLISTED','NO_SHOW']) {
  const state=setup();state.registrations[0].status=status;
  for(const operation of ['check-in','undo'])assert.ok(!(await mutateAttendance(state.db,'organizer',target,operation)).ok);
  assert.equal(state.registrations[0].status,status);
 }
 for(const status of ['DRAFT','CANCELLED','ARCHIVED']){
  const state=setup();state.event.status=status;assert.ok(!(await mutateAttendance(state.db,'organizer',target,'check-in')).ok);
 }
 const state=setup();
 for(const changes of [{eventId:'other-event'},{scope:'other-org'},{registrationId:'other-registration'},{registrationId:'missing'},{eventId:''}])assert.ok(!(await mutateAttendance(state.db,'organizer',{...target,...changes},'check-in')).ok);
 state.setAuthorized(false);assert.ok(!(await mutateAttendance(state.db,'outsider',target,'check-in')).ok);
 assert.equal(state.calls.filter(call=>call.data).length,0);
});
test('private list query limits public profile selection, searches names and counts all statuses independently of filters',async()=>{
 const state=setup();
 state.registrations.push({id:'cancelled',eventId:'event',status:'CANCELLED',createdAt:new Date(),checkedInAt:null,user:{name:'Bob'}});
 await mutateAttendance(state.db,'organizer',target,'check-in');
 const data=await loadManagedAttendees(state.db,'organizer','event','organization',{q:'Alice',status:'ATTENDED',page:100});
 assert.equal(data.counts.ATTENDED,1);assert.equal(data.counts.CANCELLED,1);assert.equal(data.occupied,1);assert.equal(data.remaining,1);assert.equal(data.total,1);assert.equal(data.page,1);
 assert.equal(data.records[0].user.name,'Alice Attendee');assert.ok(!JSON.stringify(data).includes('private@example.com'));
 assert.deepEqual(attendeeSelect.user,{select:{name:true}});
 for(const key of ['userId','eventId','checkedInById','accounts','sessions','email'])assert.ok(!(key in attendeeSelect));
 state.setAuthorized(false);assert.equal(await loadManagedAttendees(state.db,'outsider','event','organization',{q:'',status:'ALL',page:1}),null);
 assert.equal(await loadManagedAttendeeSummary(state.db,'outsider','event','organization'),null);
});
test('summary keeps registered plus attended occupancy and unlimited capacity semantics',async()=>{
 const state=setup();state.registrations.push({id:'attended',eventId:'event',status:'ATTENDED',createdAt:new Date(),user:{name:'Bob'}});
 let summary=await loadManagedAttendeeSummary(state.db,'organizer','event','organization');
 assert.equal(summary.occupied,2);assert.equal(summary.remaining,0);
 state.event.capacity=null;summary=await loadManagedAttendeeSummary(state.db,'organizer','event','organization');assert.equal(summary.remaining,null);
});
test('actions require authentication and undo confirmation, ignore forged actor and invalidate private/public state',async()=>{
 const state=setup();const form=new FormData();form.set('registrationId','registration');form.set('checkedInById','forged-user');
 globalThis.attendeeUser=null;assert.match((await actions.checkInAttendee('event','organization',{},form)).message,/Sign in/);
 globalThis.attendeeUser={id:'organizer'};assert.ok(!(await actions.undoAttendeeCheckIn('event','organization',{},form)).ok);
 assert.equal((await actions.checkInAttendee('event','organization',{},form)).ok,true);assert.equal(state.registrations[0].checkedInById,'organizer');
 for(const path of ['/organizer/organization/events/event/attendees','/organizer/organization/events/event','/dashboard','/dashboard/joined','/events/event-slug'])assert.ok(globalThis.attendeeRevalidations.some(args=>args[0]===path));
 form.set('confirm','yes');assert.equal((await actions.undoAttendeeCheckIn('event','organization',{},form)).ok,true);
});
test('schemas bound search, pagination and identities; errors suppress database details',async()=>{
 assert.deepEqual(schemas.attendeeQuerySchema.parse({q:'  Alice ',page:'2'}),{q:'Alice',page:2,status:'ALL'});
 for(const input of [{q:'x'.repeat(201)},{status:'UNKNOWN'},{page:0},{page:1.1},{page:'bad'}])assert.equal(schemas.attendeeQuerySchema.safeParse(input).success,false);
 const state=setup();state.db.$transaction=async()=>{throw Error('Prisma SQL private email secret')};
 const result=await mutateAttendance(state.db,'organizer',target,'check-in');assert.ok(!result.ok);assert.ok(!JSON.stringify(result).includes('SQL')&&!JSON.stringify(result).includes('secret'));
});
