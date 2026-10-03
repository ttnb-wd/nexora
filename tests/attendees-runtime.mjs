import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
import rscClient from 'next/dist/compiled/react-server-dom-turbopack/client.node.js';
const { PrismaClient } = await import('../src/generated/prisma/client.ts');
const { mutateAttendance, loadManagedAttendees } = await import('../src/features/attendees/server/service.ts');
nextEnv.loadEnvConfig(process.cwd());
assert.equal(process.env.STEP15_DISPOSABLE_APPROVED,'1','Explicit disposable Neon approval required.');
const origin=process.env.STEP15_ORIGIN??process.env.APP_URL;
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL}),log:[]});
const run=randomUUID(),hex=run.replaceAll('-',''),orgSlug=`s15-${run}`,userIds=[],eventIds=[],registrationIds=[];
const attendeeName = `Step15 Private Guest ${run}`;
const emails=['owner','attendee','outsider'].map(label=>`step15-${run}-${label}@example.com`);
const ip=`fd15:${hex.slice(0,4)}:${hex.slice(4,8)}:${hex.slice(8,12)}::1`;
const ratePrefix=`fd15:${hex.slice(0,4)}:${hex.slice(4,8)}:${hex.slice(8,12)}:0000:0000:0000:0000|`;
const ledger={run,passed:[],created:{users:userIds,events:eventIds,registrations:registrationIds,organization:null},cleanupVerified:false,existingRecordsUnchanged:false};
const baseline={},models=['user','session','account','organization','organizationMember','event','eventRegistration','eventBookmark','organizationFollower','notification','eventAgendaItem','eventSpeaker','eventResource'];
const immutable=['eventBookmark','organizationFollower','notification'];
const snapshot=model=>({id:true,...(immutable.includes(model)?{createdAt:true}:{updatedAt:true}),...(model==='notification'?{readAt:true}:{}),...(model==='eventRegistration'?{status:true,checkedInAt:true,checkedInById:true}:{})});
const writeLedger=()=>{mkdirSync('artifacts',{recursive:true});writeFileSync(`artifacts/step15-runtime-${run}.json`,JSON.stringify(ledger,null,2));};
function pass(label){ledger.passed.push(label);writeLedger();console.log(`PASS ${label}`);}
async function request(path,actor,options={}){return fetch(`${origin}${path}`,{redirect:'manual',...options,headers:{Origin:origin,'X-Forwarded-For':ip,...(actor?.cookie?{Cookie:actor.cookie}:{}),...options.headers}});}
async function html(path,actor){const response=await request(path,actor);assert.equal(response.status,200);return (await response.text()).replace(/<!--[\s\S]*?-->/g,'');}
const manifest=JSON.parse(readFileSync('.next/server/server-reference-manifest.json','utf8'));
const names=['checkInAttendee','undoAttendeeCheckIn','joinEvent','cancelEventRegistration'];
const actionIds=Object.fromEntries(Object.entries(manifest.node).filter(([,entry])=>names.includes(entry.exportedName)).map(([id,entry])=>[entry.exportedName,id]));
assert.ok(names.every(name=>actionIds[name]));
async function invoke(name,args,actor){
 const payload=await rscClient.encodeReply(args);
 const response=await request('/dashboard',actor,{method:'POST',headers:{'Next-Action':actionIds[name],...(typeof payload==='string'?{'Content-Type':'text/plain;charset=UTF-8'}:{})},body:payload});
 const body=await response.text();assert.equal(response.status,200,body.slice(0,200));
 const result=body.split('\n').map(line=>{try{return JSON.parse(line.slice(line.indexOf(':')+1),(_key,value)=>value==='$undefined'?undefined:value);}catch{return null;}}).find(value=>value&&typeof value.message==='string');
 assert.ok(result,`${name} missing result`);return result;
}
async function attendance(name,event,registration,actor,scope=orgSlug,fields={}){
 const form=new FormData();form.set('registrationId',registration.id);for(const[key,value]of Object.entries(fields))form.set(key,value);
 return invoke(name,[event.id,scope,{},form],actor);
}
async function signup(label){
 const response=await request('/api/auth/sign-up/email',null,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:label==="attendee"?attendeeName:`Step15 ${label}`,email:`step15-${run}-${label}@example.com`,password:randomUUID()})});
 assert.equal(response.status,200);const{user}=await response.json();userIds.push(user.id);writeLedger();
 return{id:user.id,cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};
}
async function current(registration){return db.eventRegistration.findUniqueOrThrow({where:{id:registration.id}});}
try{
 for(const model of models)baseline[model]=await db[model].findMany({select:snapshot(model),orderBy:{id:'asc'}});
 const owner=await signup('owner'),attendee=await signup('attendee'),outsider=await signup('outsider');
 const org=await db.organization.create({data:{slug:orgSlug,name:'Step15 disposable organization',members:{create:{userId:owner.id,role:'OWNER'}}}});ledger.created.organization=org.id;writeLedger();
 const fixture=async(label,organizationId=org.id,capacity=1)=>{
  const event=await db.event.create({data:{slug:`s15-${run}-${label}`,title:`Step15 ${label} event`,description:'Disposable attendee check-in verification.',creatorId:owner.id,organizationId,eventType:'ONLINE',status:'PUBLISHED',startAt:new Date('2090-06-20T03:30:00Z'),endAt:new Date('2090-06-20T05:30:00Z'),timezone:'Asia/Yangon',capacity}});
  eventIds.push(event.id);writeLedger();return event;
 };
 const event=await fixture('attendees'),other=await fixture('other'),individual=await fixture('individual',null);
 const register=async(event,user,status='REGISTERED')=>{const row=await db.eventRegistration.create({data:{eventId:event.id,userId:user.id,status}});registrationIds.push(row.id);writeLedger();return row;};
 const registration=await register(event,attendee),cancelled=await register(event,outsider,'CANCELLED'),waitlisted=await register(event,owner,'WAITLISTED'),foreign=await register(other,attendee),personal=await register(individual,attendee);
 const path=`/organizer/${orgSlug}/events/${event.id}/attendees`,management=`/organizer/${orgSlug}/events/${event.id}`;
 let content=await html(path,owner);
 assert.ok(content.includes(attendeeName)&&content.includes('Registered')&&content.includes('Check in'));
 assert.ok(content.includes('<table')&&content.includes('scope="col"')&&content.includes('Search attendee name')&&content.includes('Registration status'));
 for(const email of emails)assert.ok(!content.includes(email));
 assert.ok((await html(management,owner)).includes('Manage attendees'));
 pass('1 authorized organizer sees real attendees, semantic table, audit state and management CTA; emails excluded');
 const anonymous=await request(path,null);assert.equal(anonymous.status,307);
 assert.equal((await request(path,outsider)).status,404);
 assert.ok(!(await attendance('checkInAttendee',event,registration,outsider)).ok);
 assert.ok(!(await attendance('checkInAttendee',event,registration,attendee)).ok);
 assert.match((await attendance('checkInAttendee',event,registration,null)).message,/Sign in/);
 pass('2 unrelated attendee/user and anonymous requests cannot open or mutate the private list');
 await db.organizationMember.create({data:{userId:outsider.id,organizationId:org.id,role:'MEMBER'}});
 assert.equal((await request(path,outsider)).status,404);
 for(const name of ['checkInAttendee','undoAttendeeCheckIn'])assert.ok(!(await attendance(name,event,registration,outsider,orgSlug,{confirm:'yes'})).ok);
 assert.ok(!(await html(management,outsider)).includes('Manage attendees'));
 pass('3 MEMBER cannot manage attendees or see the private CTA');
 await db.organizationMember.update({where:{userId_organizationId:{userId:outsider.id,organizationId:org.id}},data:{role:'EDITOR'}});
 assert.equal((await request(path,outsider)).status,200);
 assert.equal((await attendance('checkInAttendee',event,registration,outsider,orgSlug,{checkedInById:owner.id,userId:owner.id,role:'OWNER'})).ok,true);
 let checked=await current(registration);assert.equal(checked.status,'ATTENDED');assert.ok(checked.checkedInAt instanceof Date);assert.equal(checked.checkedInById,outsider.id);
 pass('4 EDITOR can manage; 5 REGISTERED -> ATTENDED stores timestamp and session-derived actor');
 const audit={at:checked.checkedInAt.toISOString(),by:checked.checkedInById};
 assert.equal((await attendance('checkInAttendee',event,registration,owner)).ok,true);
 checked=await current(registration);assert.equal(checked.checkedInAt.toISOString(),audit.at);assert.equal(checked.checkedInById,audit.by);
 pass('6 repeated check-in preserves the original audit fields');
 assert.ok((await html('/dashboard/joined',attendee)).includes('Registration: <!-- -->Attended')||(await html('/dashboard/joined',attendee)).includes('Registration: Attended'));
 assert.ok((await html('/dashboard',attendee)).includes('Attended events:'));
 const ownDetail=await html(`/events/${event.slug}`,attendee);
 assert.ok(ownDetail.includes(`Attended: ${event.title}`)&&ownDetail.includes('You attended this event'));
 assert.ok(!ownDetail.includes(`Join Event: ${event.title}`));
 assert.ok(!(await invoke('joinEvent',[event.slug],attendee)).ok);
 assert.ok(!(await invoke('cancelEventRegistration',[event.slug],attendee)).ok);
 pass('12 dashboard and personalized event show Attended; attendee cannot rejoin or cancel an attended record');
 let data=await loadManagedAttendees(db,owner.id,event.id,orgSlug,{q:'',status:'ALL',page:1});
 assert.deepEqual(data.counts,{REGISTERED:0,ATTENDED:1,CANCELLED:1,WAITLISTED:1,NO_SHOW:0});assert.equal(data.occupied,1);assert.equal(data.remaining,0);
 assert.equal((await invoke('joinEvent',[event.slug],outsider)).message,'This event is full.');
 pass('13 database summary remains accurate; 14 ATTENDED still occupies capacity and blocks another join');
 assert.ok(!(await attendance('undoAttendeeCheckIn',event,registration,owner)).ok);
 assert.equal((await current(registration)).status,'ATTENDED');
 assert.equal((await attendance('undoAttendeeCheckIn',event,registration,owner,orgSlug,{confirm:'yes'})).ok,true);
 let undone=await current(registration);assert.equal(undone.status,'REGISTERED');assert.equal(undone.checkedInAt,null);assert.equal(undone.checkedInById,null);
 assert.equal((await attendance('undoAttendeeCheckIn',event,registration,owner,orgSlug,{confirm:'yes'})).ok,true);
 pass('7 confirmed undo returns REGISTERED and clears audit fields; 8 repeated undo safe without deleting registration');
 assert.ok(!(await attendance('checkInAttendee',event,cancelled,owner)).ok);
 assert.ok(!(await attendance('checkInAttendee',event,waitlisted,owner)).ok);
 assert.equal((await current(cancelled)).status,'CANCELLED');
 pass('9 cancelled/waitlisted registrations cannot check in');
 assert.ok(!(await attendance('checkInAttendee',{id:'missing-event'},registration,owner)).ok);
 assert.ok(!(await attendance('checkInAttendee',event,registration,owner,'other-organization')).ok);
 assert.ok(!(await attendance('checkInAttendee',other,registration,owner)).ok);
 assert.ok(!(await attendance('checkInAttendee',event,foreign,owner)).ok);
 assert.equal((await request(`/dashboard/events/${event.id}/attendees`,owner)).status,404);
 pass('10 forged event/scope blocked; 11 cross-event registration ID blocked; organization route cannot be treated as individual');
 let filtered=await html(`${path}?q=pRiVaTe&status=REGISTERED`,owner);
 assert.ok(filtered.includes(attendeeName)&&!filtered.includes('Step15 outsider'));
 filtered=await html(`${path}?q=no-match-${run}`,owner);assert.ok(filtered.includes('No matching attendees'));
 filtered=await html(`${path}?status=CANCELLED`,owner);assert.ok(filtered.includes('Step15 outsider')&&!filtered.includes('Check in Step15 outsider'));
 assert.ok((await html(`${path}?page=0`,owner)).includes('Invalid filters were reset'));
 pass('server-side name search, status filters, empty results and invalid filter recovery work');
 const concurrent=await Promise.all([1,2].map(()=>mutateAttendance(db,owner.id,{eventId:event.id,scope:orgSlug,registrationId:registration.id},'check-in')));assert.ok(concurrent.every(result=>result.ok));
 checked=await current(registration);assert.equal(checked.status,'ATTENDED');
 const concurrentUndo=await Promise.all([1,2].map(()=>mutateAttendance(db,owner.id,{eventId:event.id,scope:orgSlug,registrationId:registration.id},'undo')));assert.ok(concurrentUndo.every(result=>result.ok));assert.equal((await current(registration)).status,'REGISTERED');
 pass('concurrent check-in and undo are each idempotent with the shared parent-event lock');
 assert.equal((await attendance('checkInAttendee',individual,personal,owner,null)).ok,true);
 assert.equal((await request(`/dashboard/events/${individual.id}/attendees`,owner)).status,200);
 assert.equal((await request(`/dashboard/events/${individual.id}/attendees`,outsider)).status,404);
 assert.ok(!(await attendance('undoAttendeeCheckIn',individual,personal,outsider,null,{confirm:'yes'})).ok);
 pass('16 individual creator can manage own attendees; 17 another user cannot view or mutate them');
 assert.equal((await attendance('checkInAttendee',event,registration,owner)).ok,true);
 content=await html(path,owner);assert.ok(content.includes('Undo check-in')&&content.includes(`Confirm undo for ${attendeeName}`));
 assert.ok((await html(management,owner)).includes('Attended: <!-- -->1')||(await html(management,owner)).includes('Attended: 1'));
 for(const publicPath of [`/events/${event.slug}`,`/events/${individual.slug}`,'/explore','/',`/companies/${orgSlug}`,'/companies']){
  const page=await html(publicPath,null);
  for(const secret of [attendeeName,'Step15 outsider',...emails,...registrationIds,attendee.id,outsider.id,'checkedInById','checkedInAt'])assert.ok(!page.includes(secret),`${publicPath} leaked ${secret}`);
 }
 pass('15 all public surfaces exclude attendee names, emails, registration IDs and audit data; revalidation updates management without restart');
 await db.organizationMember.update({where:{userId_organizationId:{userId:outsider.id,organizationId:org.id}},data:{role:'ADMIN'}});
 assert.equal((await attendance('undoAttendeeCheckIn',event,registration,outsider,orgSlug,{confirm:'yes'})).ok,true);
 await db.organizationMember.update({where:{userId_organizationId:{userId:outsider.id,organizationId:org.id}},data:{role:'MEMBER'}});
 assert.ok(!(await attendance('checkInAttendee',event,registration,outsider)).ok);
 pass('ADMIN attendance management works; revoked organizer actions are blocked');
 for(const status of ['DRAFT','CANCELLED','ARCHIVED']){
  await db.event.update({where:{id:other.id},data:{status}});
  assert.ok(!(await attendance('checkInAttendee',other,foreign,owner)).ok);
  assert.ok((await html(`/organizer/${orgSlug}/events/${other.id}/attendees`,owner)).includes('Attendance is read-only'));
 }
 await db.event.update({where:{id:other.id},data:{status:'COMPLETED'}});
 assert.ok(!(await attendance('checkInAttendee',other,foreign,owner)).ok);
 assert.ok(!(await attendance('undoAttendeeCheckIn',other,foreign,owner,orgSlug,{confirm:'yes'})).ok);
 pass('published attendance editable; completed/finalized and draft/cancelled/archived attendance read-only');
 // Pagination verifies a secure query cannot silently truncate totals at the first page.
 const paginated=await fixture('pagination',org.id,null),bulkUsers=[];
 for(let index=0;index<51;index++)bulkUsers.push({id:`s15-${run}-bulk-${index}`,name:`Step15 bulk ${index}`,email:`step15-${run}-bulk-${index}@example.com`});
 userIds.push(...bulkUsers.map(user=>user.id));writeLedger();
 await db.user.createMany({data:bulkUsers});
 await db.eventRegistration.createMany({data:bulkUsers.map(user=>({eventId:paginated.id,userId:user.id,status:'REGISTERED'}))});
 data=await loadManagedAttendees(db,owner.id,paginated.id,orgSlug,{q:'',status:'ALL',page:2});assert.equal(data.records.length,1);assert.equal(data.total,51);assert.equal(data.counts.REGISTERED,51);assert.equal(data.pageCount,2);assert.equal(data.remaining,null);
 assert.ok((await html(`/organizer/${orgSlug}/events/${paginated.id}/attendees?page=2`,owner)).includes('Previous page'));
 pass('50-row pagination retains accurate full-event summary and unlimited-capacity semantics');
 await db.organizationMember.create({data:{userId:bulkUsers[0].id,organizationId:org.id,role:'EDITOR'}});
 const actorDeleteRegistration=await db.eventRegistration.findUniqueOrThrow({where:{userId_eventId:{userId:bulkUsers[1].id,eventId:paginated.id}}});
 assert.equal((await mutateAttendance(db,bulkUsers[0].id,{eventId:paginated.id,scope:orgSlug,registrationId:actorDeleteRegistration.id},'check-in')).ok,true);
 const beforeActorDelete=await current(actorDeleteRegistration);
 await db.user.delete({where:{id:bulkUsers[0].id}});
 const afterActorDelete=await current(actorDeleteRegistration);
 assert.equal(afterActorDelete.status,'ATTENDED');assert.equal(afterActorDelete.checkedInById,null);assert.equal(afterActorDelete.checkedInAt.toISOString(),beforeActorDelete.checkedInAt.toISOString());
 pass('deleting a disposable check-in actor retains attendee registration and timestamp with SetNull relation');
 const raceEvent=await fixture('cancellation-race'),raceRegistration=await register(raceEvent,attendee);
 const race=await Promise.all([mutateAttendance(db,owner.id,{eventId:raceEvent.id,scope:orgSlug,registrationId:raceRegistration.id},'check-in'),invoke('cancelEventRegistration',[raceEvent.slug],attendee)]);
 const raceState=await current(raceRegistration);
 assert.equal(race.filter(result=>result.ok).length,1);assert.ok(['ATTENDED','CANCELLED'].includes(raceState.status));
 if(raceState.status==='ATTENDED')assert.ok(raceState.checkedInAt&&raceState.checkedInById===owner.id);
 else assert.equal(raceState.checkedInAt,null);
 pass('concurrent organizer check-in and attendee cancellation produce one valid transition and consistent audit fields');
 // Cancelling a registered attendee still releases the seat and rejoin reuses the same row.
 assert.equal((await invoke('cancelEventRegistration',[event.slug],attendee)).ok,true);
 assert.equal((await current(registration)).status,'CANCELLED');
 assert.equal((await invoke('joinEvent',[event.slug],attendee)).ok,true);
 assert.equal((await current(registration)).status,'REGISTERED');
 assert.equal((await current(registration)).checkedInAt,null);
 pass('existing self-cancellation/rejoin remains idempotent and reuses the registration row');
}catch(error){ledger.failure={name:error.name,message:error.message};throw error;}finally{
 const ownUsers=await db.user.findMany({where:{email:{startsWith:`step15-${run}-`}},select:{id:true}});
 for(const row of ownUsers)if(!userIds.includes(row.id))userIds.push(row.id);
 await db.event.deleteMany({where:{id:{in:eventIds}}});
 await db.organization.deleteMany({where:{slug:orgSlug}});
 await db.user.deleteMany({where:{id:{in:userIds}}});
 await db.rateLimit.deleteMany({where:{key:{startsWith:ratePrefix}}});
 for(const model of ['eventRegistration','eventBookmark'])assert.equal(await db[model].count({where:{eventId:{in:eventIds}}}),0);
 for(const model of ['session','account','organizationMember','notification'])assert.equal(await db[model].count({where:{userId:{in:userIds}}}),0);
 assert.equal(await db.user.count({where:{id:{in:userIds}}}),0);assert.equal(await db.event.count({where:{id:{in:eventIds}}}),0);assert.equal(await db.organization.count({where:{slug:orgSlug}}),0);assert.equal(await db.rateLimit.count({where:{key:{startsWith:ratePrefix}}}),0);
 ledger.cleanupVerified=true;
 for(const model of models)if(baseline[model])assert.deepEqual(await db[model].findMany({where:{id:{in:baseline[model].map(row=>row.id)}},select:snapshot(model),orderBy:{id:'asc'}}),baseline[model],`Existing ${model} changed`);
 ledger.existingRecordsUnchanged=true;writeLedger();await db.$disconnect();
 console.log(`Removed all Step15 fixtures. ${ledger.passed.length} scenarios passed; existing records unchanged.`);
}
