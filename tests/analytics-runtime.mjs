import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
const { PrismaClient, Prisma } = await import('../src/generated/prisma/client.ts');
const { loadEventAnalytics, loadOrganizationAnalytics } = await import('../src/features/analytics/server/service.ts');
const { loadOwnTicket } = await import('../src/features/tickets/server/service.ts');
const { mutateAttendance } = await import('../src/features/attendees/server/service.ts');
const { mutateReminder } = await import('../src/features/events/reminders/service.ts');
nextEnv.loadEnvConfig(process.cwd());
assert.equal(process.env.STEP18_DISPOSABLE_APPROVED,'1','Explicit disposable-data approval is required.');
const origin=process.env.APP_URL;
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL}),log:[]});
const run=randomUUID(), prefix=`s18-${run}`, userIds=[], eventIds=[], orgIds=[];
const ip=`fd18:${run.slice(0,4)}:${run.slice(9,13)}:`;
const now=new Date(), ago=days=>new Date(now.getTime()-days*86400000), future=days=>new Date(now.getTime()+days*86400000);
mkdirSync('artifacts/step18',{recursive:true});
const ledger={run,passed:[],cleanupVerified:false,existingRecordsUnchanged:false};
const ledgerPath=`artifacts/step18/analytics-runtime-${run}.json`;
const pass=label=>{ledger.passed.push(label);writeFileSync(ledgerPath,JSON.stringify(ledger,null,2));console.log('PASS '+label);};
const baseline={};
const models=['user','session','account','organization','organizationMember','event','eventRegistration','eventBookmark','organizationFollower','notification','eventReminderPreference','eventAgendaItem','eventSpeaker','eventResource'];
const projection=model=>({id:true,...(['eventBookmark','organizationFollower','notification'].includes(model)?{createdAt:true}:{updatedAt:true}),...(model==='eventRegistration'?{status:true,checkedInAt:true,ticketIssuedAt:true}:{}),...(model==='notification'?{readAt:true}:{})});
async function request(path,actor,options={}) {return fetch(origin+path,{redirect:'manual',...options,headers:{Origin:origin,'X-Forwarded-For':`${ip}${actor?.index ?? 9}::1`,...(actor?.cookie?{Cookie:actor.cookie}:{}),...options.headers}});}
async function signup(label) {
 const email=`${prefix}-${label}@example.com`,password=randomUUID();
 const index=userIds.length+1;
 const response=await request('/api/auth/sign-up/email',{index},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`Step18 ${label}`,email,password})});
 assert.equal(response.status,200);const {user}=await response.json();userIds.push(user.id);
 return {id:user.id,email,password,index,cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};
}
const manifest=JSON.parse(readFileSync('.next/server/server-reference-manifest.json','utf8'));
const actionIds=Object.fromEntries(Object.entries(manifest.node).filter(([,entry])=>['joinEvent','cancelEventRegistration','saveEvent','unsaveEvent'].includes(entry.exportedName)).map(([id,entry])=>[entry.exportedName,id]));
const { default: rsc }=await import('next/dist/compiled/react-server-dom-turbopack/client.node.js');
async function action(name,slug,actor) {
 assert.ok(actionIds[name]);
 const payload=await rsc.encodeReply([slug]);
 const response=await request(`/events/${slug}`,actor,{method:'POST',headers:{'Next-Action':actionIds[name],'Content-Type':'text/plain;charset=UTF-8'},body:payload});
 assert.equal(response.status,200);
 const body=await response.text();
 const result=body.split('\n').map(line=>{try{return JSON.parse(line.slice(line.indexOf(':')+1));}catch{return null;}}).find(value=>value&&typeof value.ok==='boolean');
 assert.ok(result?.ok,`${name} failed`);return result;
}
try {
 for(const model of models) baseline[model]=await db[model].findMany({select:projection(model),orderBy:{id:'asc'}});
 const owner=await signup('owner'),member=await signup('member'),outsider=await signup('outsider'),attendee=await signup('attendee');
 const extra=await db.user.create({data:{name:'Step18 second attendee',email:`${prefix}-second@example.com`}});userIds.push(extra.id);
 const more=[];for(let index=0;index<4;index++){const user=await db.user.create({data:{name:`Step18 fixture ${index}`,email:`${prefix}-fixture-${index}@example.com`}});userIds.push(user.id);more.push(user);}
 const org=await db.organization.create({data:{slug:prefix,name:'Step18 analytics organization',members:{create:[{userId:owner.id,role:'OWNER'},{userId:member.id,role:'MEMBER'}]}}});orgIds.push(org.id);
 const other=await db.organization.create({data:{slug:`${prefix}-other`,name:'Step18 unrelated organization',members:{create:{userId:outsider.id,role:'OWNER'}}}});orgIds.push(other.id);
 const emptyOrg=await db.organization.create({data:{slug:`${prefix}-empty`,name:'Step18 empty organization',members:{create:{userId:owner.id,role:'OWNER'}}}});orgIds.push(emptyOrg.id);
 async function event(label,overrides={}){const value=await db.event.create({data:{slug:`${prefix}-${label}`,title:`Step18 ${label}`,status:'PUBLISHED',creatorId:owner.id,organizationId:org.id,startAt:future(3),endAt:future(3.2),eventType:'IN_PERSON',locationName:'Fixture Hall',city:'Yangon',timezone:'Asia/Yangon',capacity:5,...overrides}});eventIds.push(value.id);return value;}
 const main=await event('metrics'),zero=await event('zero',{capacity:null}),ended=await event('completed',{status:'COMPLETED',startAt:ago(3),endAt:ago(2.9)}),individual=await event('individual',{organizationId:null}),foreign=await event('foreign',{organizationId:other.id,creatorId:outsider.id}),draft=await event('draft',{status:'DRAFT'});
 const secondCompleted=await event('completed-second',{status:'COMPLETED',startAt:ago(5),endAt:ago(4.9)});
 await event('completed-empty',{status:'PUBLISHED',startAt:ago(10),endAt:ago(9.9)});
 const statuses=['REGISTERED','REGISTERED','ATTENDED','CANCELLED','WAITLISTED','NO_SHOW'];
 const people=[attendee,extra,...more];
 for(const [index,status] of statuses.entries()){
  await db.eventRegistration.create({data:{eventId:main.id,userId:people[index].id,status,createdAt:index<2?ago(40):ago(2),...(status==='ATTENDED'?{checkedInAt:ago(1),checkedInById:owner.id}: {})}});

 }
 await db.eventBookmark.createMany({data:[{eventId:main.id,userId:attendee.id},{eventId:main.id,userId:extra.id}]});
 await db.eventReminderPreference.createMany({data:[{eventId:main.id,userId:attendee.id,enabled:true,reminderMinutes:60},{eventId:main.id,userId:people[3].id,enabled:true,reminderMinutes:60}]});
 const ticket=await loadOwnTicket(db,attendee.id,main.slug,process.env.AUTH_SECRET,true);assert.ok(ticket);
 let data=await loadEventAnalytics(db,owner.id,main.id,org.slug,'30',now);
 assert.equal(data.totalRegistrations,6);assert.equal(data.counts.REGISTERED,2);assert.equal(data.counts.ATTENDED,1);assert.equal(data.counts.CANCELLED,1);assert.equal(data.occupied,3);assert.equal(data.remaining,2);assert.equal(data.utilization,60);assert.ok(Math.abs(data.attendanceRate-25)<1e-9);assert.equal(data.saves,2);assert.equal(data.reminders,1);assert.equal(data.tickets,1);assert.equal(data.checkIns,1);
 pass('event metrics: registrations/statuses, cancellation exclusion, attendance denominator, capacity, saves, reminders, tickets and check-ins');
 assert.equal(data.trend.points.length,1);assert.equal(data.trend.points[0].registrations,4);assert.equal(data.trend.points[0].cumulative,6);assert.equal(data.trend.timezone,'Asia/Yangon');
 data=await loadEventAnalytics(db,owner.id,main.id,org.slug,'all',now);assert.equal(data.trend.bucket,'month');assert.equal(data.trend.points.at(-1).cumulative,6);
 pass('timezone-aware daily/monthly trend, original-record dates, cancelled inclusion and filtered cumulative opening balance');
 const empty=await loadEventAnalytics(db,owner.id,zero.id,org.slug);
 assert.equal(empty.totalRegistrations,0);assert.equal(empty.attendanceRate,null);assert.equal(empty.remaining,null);assert.equal(empty.utilization,null);assert.deepEqual(empty.trend.points,[]);
 pass('zero-registration and unlimited-capacity empty states');
 await db.eventRegistration.createMany({data:[{eventId:secondCompleted.id,userId:attendee.id,status:'ATTENDED'},{eventId:ended.id,userId:attendee.id,status:'ATTENDED',checkedInAt:ago(2)},{eventId:ended.id,userId:extra.id,status:'REGISTERED'},{eventId:ended.id,userId:more[0].id,status:'CANCELLED'},{eventId:foreign.id,userId:attendee.id,status:'ATTENDED'},{eventId:draft.id,userId:extra.id,status:'REGISTERED'}]});
 await db.eventBookmark.createMany({data:[{eventId:ended.id,userId:attendee.id},{eventId:foreign.id,userId:attendee.id}]});
 await db.organizationFollower.createMany({data:[{organizationId:org.id,userId:attendee.id},{organizationId:org.id,userId:extra.id},{organizationId:other.id,userId:member.id}]});
 const organization=await loadOrganizationAnalytics(db,owner.id,org.slug,'all',now);
 assert.equal(organization.published,5);assert.equal(organization.upcoming,2);assert.equal(organization.completed,3);assert.equal(organization.totalRegistrations,10);assert.equal(organization.counts.ATTENDED,3);assert.equal(organization.saves,3);assert.equal(organization.followers,2);assert.equal(organization.averageAttendanceRate,75);assert.equal(organization.recentFollowerRegistrants,2);assert.ok(!organization.recent.some(row=>[foreign.id,individual.id,draft.id].includes(row.event.id)));
 const recent=await loadOrganizationAnalytics(db,owner.id,org.slug,'30',now);assert.equal(recent.published,3);assert.equal(recent.upcoming,0);assert.equal(recent.totalRegistrations,4);assert.equal(recent.followers,2);
 assert.equal((await loadOrganizationAnalytics(db,owner.id,emptyOrg.slug)).published,0);
 pass('organization counts, equal-weight completed-event average, date ranges, current followers and unrelated/draft/individual exclusion');
 for(const actor of [member,outsider]){
  assert.equal(await loadEventAnalytics(db,actor.id,main.id,org.slug),null);assert.equal(await loadOrganizationAnalytics(db,actor.id,org.slug),null);
  for(const path of [`/organizer/${org.slug}/analytics`,`/organizer/${org.slug}/events/${main.id}/analytics`])assert.equal((await request(path,actor)).status,404);
 }
 assert.equal(await loadEventAnalytics(db,owner.id,main.id,other.slug),null);
 assert.ok(await loadEventAnalytics(db,owner.id,individual.id,null));assert.equal(await loadEventAnalytics(db,outsider.id,individual.id,null),null);
 for(const role of ['ADMIN','EDITOR']){await db.organizationMember.update({where:{userId_organizationId:{userId:member.id,organizationId:org.id}},data:{role}});assert.ok(await loadEventAnalytics(db,member.id,main.id,org.slug));assert.ok(await loadOrganizationAnalytics(db,member.id,org.slug));}
 await db.organizationMember.update({where:{userId_organizationId:{userId:member.id,organizationId:org.id}},data:{role:'MEMBER'}});
 assert.equal(await loadEventAnalytics(db,member.id,main.id,org.slug),null);
 assert.equal((await request(`/organizer/${org.slug}/analytics`,null)).status,307);
 pass('OWNER/ADMIN/EDITOR access, MEMBER denial, individual creator access, wrong scope/outsider/anonymous rejection and immediate role downgrade');
 for(const serialized of [JSON.stringify(data),JSON.stringify(organization)])for(const value of [attendee.email,attendee.id,ticket.token,'ticketTokenHash','ticketNonce','checkedInById','password','session'])assert.ok(!serialized.includes(value));
 const html=await (await request(`/organizer/${org.slug}/events/${main.id}/analytics`,owner)).text();for(const value of [attendee.email,ticket.token,'Step18 attendee'])assert.ok(!html.includes(value));assert.ok(html.includes('Cumulative registration records'));
 pass('safe aggregate DTOs and authenticated analytics HTML contain no attendee/follower identity or credentials');
 await action('joinEvent',zero.slug,attendee);assert.equal((await loadEventAnalytics(db,owner.id,zero.id,org.slug)).occupied,1);
 await action('saveEvent',zero.slug,attendee);assert.equal((await loadEventAnalytics(db,owner.id,zero.id,org.slug)).saves,1);
 await action('unsaveEvent',zero.slug,attendee);assert.equal((await loadEventAnalytics(db,owner.id,zero.id,org.slug)).saves,0);
 await action('cancelEventRegistration',zero.slug,attendee);const cancelled=await loadEventAnalytics(db,owner.id,zero.id,org.slug);assert.equal(cancelled.occupied,0);assert.equal(cancelled.counts.CANCELLED,1);
 await action('joinEvent',zero.slug,attendee);assert.equal((await loadEventAnalytics(db,owner.id,zero.id,org.slug)).totalRegistrations,1);
 const zeroRow=await db.eventRegistration.findUniqueOrThrow({where:{userId_eventId:{userId:attendee.id,eventId:zero.id}}});
 assert.ok((await mutateAttendance(db,owner.id,{eventId:zero.id,scope:org.slug,registrationId:zeroRow.id},'check-in')).ok);
 const checked=await loadEventAnalytics(db,owner.id,zero.id,org.slug);assert.equal(checked.checkIns,1);assert.equal(checked.attendanceRate,100);
 pass('join, cancel, rejoin, save/unsave and check-in update analytics immediately without restart');
 assert.ok((await mutateReminder(db,attendee.id,main.slug,60)).ok);
 const plan=await db.$queryRaw(Prisma.sql`EXPLAIN (FORMAT JSON) SELECT "createdAt" FROM "EventRegistration" WHERE "eventId"=${main.id} AND "createdAt">=${ago(30)}`);
 ledger.indexReviewed=JSON.stringify(plan).includes('EventRegistration');
 assert.equal((await db.$queryRaw`SELECT COUNT(*)::int AS count FROM pg_indexes WHERE schemaname='public' AND indexname='EventRegistration_eventId_createdAt_idx'`)[0].count,1);
 pass('analytics index exists and PostgreSQL query plan is available');
 // Reset the empty fixture for browser empty-state checks; all mutations are disposable.
 await db.eventRegistration.deleteMany({where:{eventId:zero.id}});
 if(process.env.STEP18_BROWSER_HOLD==='1'){
  writeFileSync('artifacts/step18/browser-fixture.json',JSON.stringify({run,origin,ip,orgSlug:org.slug,eventId:main.id,zeroId:zero.id,individualId:individual.id,emptyOrgSlug:emptyOrg.slug,owner:{email:owner.email,password:owner.password},member:{email:member.email,password:member.password}}));
  console.log('Browser fixtures ready; waiting for browser verification release.');
  const deadline=Date.now()+20*60000;
  while(!existsSync('artifacts/step18/browser-release')&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,1000));
 }
} catch(error){ledger.failure={name:error.name,message:error.message};throw error;}
finally {
 await db.event.deleteMany({where:{id:{in:eventIds}}});await db.organization.deleteMany({where:{id:{in:orgIds}}});await db.user.deleteMany({where:{id:{in:userIds}}});
 await db.rateLimit.deleteMany({where:{OR:[{key:{startsWith:ip}},...userIds.flatMap(id=>['scan','issue'].map(kind=>({key:`tickets:${kind}:${createHash('sha256').update(id).digest('hex')}`})))]}});
 assert.equal(await db.event.count({where:{id:{in:eventIds}}}),0);assert.equal(await db.user.count({where:{id:{in:userIds}}}),0);assert.equal(await db.organization.count({where:{id:{in:orgIds}}}),0);
 for(const model of models)if(baseline[model])assert.deepEqual(await db[model].findMany({where:{id:{in:baseline[model].map(row=>row.id)}},select:projection(model),orderBy:{id:'asc'}}),baseline[model],`Existing ${model} changed`);
 ledger.cleanupVerified=true;ledger.existingRecordsUnchanged=true;writeFileSync(ledgerPath,JSON.stringify(ledger,null,2));
 for(const path of ['artifacts/step18/browser-fixture.json','artifacts/step18/browser-release'])if(existsSync(path))unlinkSync(path);
 await db.$disconnect();console.log(`Cleaned Step18 disposable records. ${ledger.passed.length} scenario groups passed; existing records unchanged.`);
}
