import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
const { PrismaClient } = await import('../src/generated/prisma/client.ts');
nextEnv.loadEnvConfig(process.cwd());
const origin = process.env.STEP13_ORIGIN ?? process.env.APP_URL;
assert.ok(origin && process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }), log: [] });
const run = randomUUID();
const slugs = [];
const userIds = [];
const emails = ['owner','follower','outsider'].map(label => `step13-${run}-${label.toLowerCase()}@example.com`);
// A unique IPv6 /64 keeps Better Auth's database rate-limit records isolated.
const hex = run.replaceAll('-', '');
const testIp = `fd12:${hex.slice(0,4)}:${hex.slice(4,8)}:${hex.slice(8,12)}::1`;
const ratePrefix = `fd12:${hex.slice(0,4)}:${hex.slice(4,8)}:${hex.slice(8,12)}:0000:0000:0000:0000|`;
const ledger = { run, origin, created: {}, deleted: {}, cleanupVerified: false, productionRecordsUnchanged: false, passed: [] };
const models = ['user','session','account','organization','organizationMember','event','eventRegistration','eventBookmark','organizationFollower','notification','rateLimit'];
for (const model of models) ledger.created[model] = [];
const baselineModels = ['user','session','account','organization','organizationMember','event','eventRegistration','eventBookmark','organizationFollower','notification'];
const baseline = {};
async function capture() {
 const scopedUsers = await db.user.findMany({where:{email:{in:emails}},select:{id:true}});
 for(const {id} of scopedUsers) if(!userIds.includes(id)) userIds.push(id);
 const queries = {
  user:{id:{in:userIds}}, session:{userId:{in:userIds}}, account:{userId:{in:userIds}},
  organization:{slug:slugFor('org')}, organizationMember:{userId:{in:userIds}},
  event:{slug:{in:slugs}}, eventRegistration:{userId:{in:userIds}}, eventBookmark:{userId:{in:userIds}},
  organizationFollower:{userId:{in:userIds}}, notification:{userId:{in:userIds}},
  rateLimit:{key:{startsWith:ratePrefix}},
 };
 const snapshots=await Promise.all(models.map(model=>db[model].findMany({where:queries[model],select:{id:true,...(model==='event'||model==='organization'?{slug:true}:{})}})));
 for(const [index,model] of models.entries()) {
  const rows=snapshots[index];
  for(const row of rows) if(!ledger.created[model].some(existing=>existing.id===row.id)) ledger.created[model].push(row);
 }
 writeLedger();
}
async function verifyBaseline() {
 for(const model of baselineModels) {
  const current=await db[model].findMany({where:{id:{in:baseline[model].map(row=>row.id)}},select:{id:true,...(['eventBookmark','organizationFollower','notification'].includes(model)?{createdAt:true}:{updatedAt:true}),...(model==='notification'?{readAt:true}:{})},orderBy:{id:'asc'}});
  assert.deepEqual(current,baseline[model],`Existing ${model} rows changed`);
 }
 ledger.productionRecordsUnchanged=true;
}
function writeLedger() {
 mkdirSync('artifacts',{recursive:true});
 writeFileSync(`artifacts/step13-runtime-${run}.json`,JSON.stringify(ledger,null,2));
}

function pass(label) { ledger.passed.push(label); console.log(`PASS ${label}`); }
async function request(path, cookie = '', options = {}) {
  return fetch(`${origin}${path}`, { redirect: 'manual', ...options, headers: { Origin: origin, 'X-Forwarded-For': testIp, ...(cookie ? { Cookie: cookie } : {}), ...options.headers } });
}
// Explicit approval is required before running this disposable Neon mutation workflow.
const manifest = JSON.parse(readFileSync('.next/server/server-reference-manifest.json', 'utf8'));
const actionIds = Object.fromEntries(Object.entries(manifest.node).filter(([,entry]) => ['joinEvent','cancelEventRegistration','followOrganization','unfollowOrganization','markNotificationRead','markAllNotificationsRead'].includes(entry.exportedName)).map(([id,entry])=>[entry.exportedName,id]));
const slugFor = (label) => `s13-${run}-${label}`;
async function action(name, slug, cookie = '', forged = {}) {
  const response = await request('/dashboard', cookie, { method: 'POST', headers: { 'Next-Action': actionIds[name], 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify([slug, forged]) });
  assert.equal(response.status,200,`Action ${name} HTTP status`);
  const body=await response.text();
  await capture();
  const result = body.split('\n').map(line => {
   try { return JSON.parse(line.slice(line.indexOf(':')+1)); } catch { return null; }
  }).find(value => value && typeof value.ok === 'boolean');
  assert.ok(result,`Missing result for ${name}`);
  return JSON.stringify(result);
}
async function user(label) {
 const password=randomUUID();
 const response=await request('/api/auth/sign-up/email','',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`Step13 ${label}`,email:`step13-${run}-${label}@example.com`,password})});
 assert.equal(response.status,200);
 const data=await response.json();userIds.push(data.user.id);
 return {id:data.user.id,email:data.user.email,password,cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};
}

function decode(value) {return value.replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&amp;/g,'&');}
async function submit(path,cookie,fields,html) {
 html??=await (await request(path,cookie)).text();
 const form=new FormData();
 for(const match of html.matchAll(/<input\b[^>]*>/g)) {
  const name=match[0].match(/\bname="([^"]*)"/)?.[1];
  if(name?.startsWith('$ACTION'))form.append(decode(name),decode(match[0].match(/\bvalue="([^"]*)"/)?.[1]??''));
 }
 assert.ok([...form.keys()].length,'Bound action fields missing');
 for(const [key,value] of Object.entries(fields))form.append(key,String(value));
 const response=await request(path,cookie,{method:'POST',body:form});await capture();return response;
}
async function html(path,cookie) {const response=await request(path,cookie);assert.equal(response.status,200);return response.text();}
try {
 for(const model of baselineModels)baseline[model]=await db[model].findMany({select:{id:true,...(['eventBookmark','organizationFollower','notification'].includes(model)?{createdAt:true}:{updatedAt:true}),...(model==='notification'?{readAt:true}:{})},orderBy:{id:'asc'}});
 assert.equal(await db.rateLimit.count({where:{key:{startsWith:ratePrefix}}}),0);
 console.log(`RUN ${run}`);
 const owner=await user('owner'),follower=await user('follower'),outsider=await user('outsider');
 await capture();
 const org=await db.organization.create({data:{slug:slugFor('org'),name:'Step13 Temporary Collective',industry:'Community',city:'Yangon',description:'Disposable follow and notification verification.',members:{create:{userId:owner.id,role:'OWNER'}}}});
 await capture();
 assert.match(await action('followOrganization',org.slug),/Please sign in/);pass('anonymous Follow directs to sign-in with organization return path');
 assert.match(await action('followOrganization',org.slug,follower.cookie),/"ok":true/);
 assert.equal(await db.organizationFollower.count({where:{userId:follower.id,organizationId:org.id}}),1);pass('1 authenticated Follow persists');
 await Promise.all([action('followOrganization',org.slug,follower.cookie),action('followOrganization',org.slug,follower.cookie)]);
 assert.equal(await db.organizationFollower.count({where:{userId:follower.id,organizationId:org.id}}),1);pass('2 duplicate/concurrent Follow creates one row');
 assert.match(await html(`/companies/${org.slug}`,follower.cookie),/Following/);
 const login=await request('/api/auth/sign-in/email','',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:follower.email,password:follower.password})});assert.equal(login.status,200);
 const loginCookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');await capture();assert.match(await html(`/companies/${org.slug}`,loginCookie),/Following/);pass('3 refresh and new login preserve Follow');
 assert.match(await action('unfollowOrganization',org.slug,follower.cookie),/"ok":true/);assert.equal(await db.organizationFollower.count({where:{userId:follower.id}}),0);pass('4 Unfollow removes own row');
 assert.match(await action('unfollowOrganization',org.slug,follower.cookie),/"ok":true/);pass('5 repeated Unfollow safe');
 await action('followOrganization',org.slug,follower.cookie);
 await action('unfollowOrganization',org.slug,outsider.cookie,{userId:follower.id});assert.equal(await db.organizationFollower.count({where:{userId:follower.id}}),1);pass('6 forged user ID cannot remove another Follow');
 assert.ok((await html('/dashboard/following',follower.cookie)).includes(org.name));assert.ok(!(await html('/dashboard/following',outsider.cookie)).includes(org.name));pass('7 Following dashboard is session-scoped');
 const slug=slugFor('event');slugs.push(slug);
 const event=await db.event.create({data:{slug,title:'Step13 disposable new gathering',description:'Disposable real event notification verification.',category:'Community',startAt:new Date('2090-01-01'),endAt:new Date('2090-01-02'),timezone:'Asia/Yangon',eventType:'ONLINE',onlineUrl:'https://example.com/step13',status:'DRAFT',creatorId:owner.id,organizationId:org.id}});await capture();
 const path=`/organizer/${org.slug}/events/${event.id}`,draft=await html(path,owner.cookie);
 const publication=await submit(path,owner.cookie,{confirm:'yes'},draft);assert.equal(publication.status,303);
 assert.equal(await db.notification.count({where:{userId:follower.id,type:'EVENT_PUBLISHED'}}),1);pass('8 actual publish action notifies real follower');
 assert.equal(await db.notification.count({where:{userId:{in:[owner.id,outsider.id]}}}),0);pass('9 unrelated user and nonfollowing organization owner get no publish notice');
 await submit(path,owner.cookie,{confirm:'yes'},draft);assert.equal(await db.notification.count({where:{type:'EVENT_PUBLISHED',userId:follower.id}}),1);pass('10 replayed publish does not duplicate notice');
 assert.match(await action('joinEvent',slug,follower.cookie),/"ok":true/);assert.equal(await db.notification.count({where:{userId:follower.id,type:'REGISTRATION_CONFIRMED'}}),1);pass('11 Join creates registration confirmation');
 await Promise.all([action('joinEvent',slug,follower.cookie),action('joinEvent',slug,follower.cookie)]);assert.equal(await db.notification.count({where:{userId:follower.id,type:'REGISTRATION_CONFIRMED'}}),1);pass('12 repeated/concurrent Join does not duplicate confirmation');
 await action('cancelEventRegistration',slug,follower.cookie);await action('cancelEventRegistration',slug,follower.cookie);assert.equal(await db.notification.count({where:{userId:follower.id,type:'REGISTRATION_CANCELLED'}}),1);pass('13 cancellation creates one notice, replay safe');
 await action('joinEvent',slug,follower.cookie);assert.equal(await db.notification.count({where:{userId:follower.id,type:'REGISTRATION_CONFIRMED'}}),2);pass('real rejoin creates a new confirmation');
 await action('joinEvent',slug,outsider.cookie);
 const published=await html(path,owner.cookie);assert.equal((await submit(path,owner.cookie,{confirm:'yes'},published)).status,303);
 assert.equal(await db.notification.count({where:{userId:{in:[follower.id,outsider.id]},type:'EVENT_CANCELLED'}}),2);assert.equal(await db.notification.count({where:{userId:owner.id,type:'EVENT_CANCELLED'}}),0);
 await submit(path,owner.cookie,{confirm:'yes'},published);assert.equal(await db.notification.count({where:{userId:{in:[follower.id,outsider.id]},type:'EVENT_CANCELLED'}}),2);pass('14 actual event Cancel targets active registered users once');
 const notice=await db.notification.findFirstOrThrow({where:{userId:follower.id,type:'EVENT_PUBLISHED'}});
 await action('markNotificationRead',notice.id,outsider.cookie,{userId:follower.id});assert.equal((await db.notification.findUniqueOrThrow({where:{id:notice.id}})).readAt,null);
 const foreignNotice=await db.notification.findFirstOrThrow({where:{userId:outsider.id,type:'REGISTRATION_CONFIRMED'}});
 const outsiderHtml=await html('/dashboard/notifications',outsider.cookie);assert.ok(!outsiderHtml.includes(notice.id));assert.ok(!outsiderHtml.includes('New event from '+org.name));
 const followerHtml=await html('/dashboard/notifications',follower.cookie);assert.ok(!followerHtml.includes(foreignNotice.id));pass('15 notification reads and marks cannot cross users');
 await action('markNotificationRead',notice.id,follower.cookie);const readAt=(await db.notification.findUniqueOrThrow({where:{id:notice.id}})).readAt;assert.ok(readAt);await action('markNotificationRead',notice.id,follower.cookie);assert.equal((await db.notification.findUniqueOrThrow({where:{id:notice.id}})).readAt.toISOString(),readAt.toISOString());pass('16 mark one read works and is idempotent');
 await action('markAllNotificationsRead','',follower.cookie);assert.equal(await db.notification.count({where:{userId:follower.id,readAt:null}}),0);assert.ok(await db.notification.count({where:{userId:outsider.id,readAt:null}})>0);pass('17 mark all read only changes current user');
 assert.match(await html('/dashboard',outsider.cookie),/Notifications, 2 unread/);assert.ok(!(await html('/dashboard',follower.cookie)).includes('Notifications, 1 unread'));pass('18 header unread count matches database and badge clears');
 for(const cookie of ['',follower.cookie,outsider.cookie]) {
  const publicHtml=await html(`/companies/${org.slug}`,cookie);
  for(const secret of [...userIds,...emails,notice.id,foreignNotice.id])assert.ok(!publicHtml.includes(secret),`Public privacy leak ${secret}`);
  assert.ok(!publicHtml.includes('dedupeKey'));
 }
 pass('public organization pages expose no follower identities or notification records');
 const directSlug=slugFor('direct');slugs.push(directSlug);
 const fields={title:'Step13 direct publication',slug:directSlug,description:'Disposable direct publish notification verification.',shortDescription:'',category:'Community',organizationId:org.id,eventType:'ONLINE',startDate:'2090-02-01',startTime:'10:00',endDate:'2090-02-01',endTime:'11:00',timezone:'Asia/Yangon',locationName:'',city:'',region:'',onlineUrl:'https://example.com/step13',capacity:'',registrationDeadline:'',intent:'publish'};
 assert.equal((await submit('/create-event',owner.cookie,fields)).status,303);assert.equal(await db.notification.count({where:{userId:follower.id,type:'EVENT_PUBLISHED'}}),2);pass('direct publish during event creation also notifies followers');
 // Exercise DB-unique event dedupe independently of the state-transition guard.
 const original=await db.notification.findUniqueOrThrow({where:{id:notice.id}});
 const {id:notificationId,...duplicate}=original;assert.ok(notificationId);
 assert.equal((await db.notification.createMany({data:[duplicate],skipDuplicates:true})).count,0);pass('database unique event notification key blocks duplicate insert');

 const capacitySlug=slugFor('capacity');slugs.push(capacitySlug);
 const capacityEvent=await db.event.create({data:{slug:capacitySlug,title:'Step13 capacity regression',description:'Disposable capacity regression with notification writes.',category:'Community',startAt:new Date('2090-03-01'),endAt:new Date('2090-03-02'),timezone:'Asia/Yangon',eventType:'ONLINE',onlineUrl:'https://example.com/capacity',status:'PUBLISHED',creatorId:owner.id,capacity:1}});await capture();
 const capacityResponses=await Promise.all([action('joinEvent',capacitySlug,follower.cookie),action('joinEvent',capacitySlug,outsider.cookie)]);
 assert.equal(capacityResponses.filter(body=>body.includes('"ok":true')).length,1);
 assert.equal(capacityResponses.filter(body=>body.includes('This event is full.')).length,1);
 assert.equal(await db.eventRegistration.count({where:{eventId:capacityEvent.id,status:'REGISTERED'}}),1);
 assert.equal(await db.notification.count({where:{userId:{in:[follower.id,outsider.id]},type:'REGISTRATION_CONFIRMED',href:`/events/${capacitySlug}`}}),1);
 pass('Step12 capacity concurrency remains safe with transactional notification writes');
} catch(error) { ledger.failure={name:error.name,message:error.message}; throw error; } finally {
 try {
  await capture();
  // Select and delete only exact run records; cascades remove own participation/auth rows.
  const ownOrganizations=await db.organization.findMany({where:{slug:slugFor('org')},select:{id:true}});
  await db.event.deleteMany({where:{slug:{in:slugs}}});
  await db.organization.deleteMany({where:{id:{in:ownOrganizations.map(row=>row.id)}}});
  await db.user.deleteMany({where:{id:{in:userIds},email:{in:emails}}});
  await db.rateLimit.deleteMany({where:{id:{in:ledger.created.rateLimit.map(row=>row.id)},key:{startsWith:ratePrefix}}});
  for(const model of models) {
   assert.equal(await db[model].count({where:{id:{in:ledger.created[model].map(row=>row.id)}}}),0,`Cleanup ${model}`);
   ledger.deleted[model]=ledger.created[model];
  }
  assert.equal(await db.user.count({where:{email:{in:emails}}}),0);
  assert.equal(await db.event.count({where:{slug:{in:slugs}}}),0);
  assert.equal(await db.organization.count({where:{slug:slugFor('org')}}),0);
  assert.equal(await db.eventRegistration.count({where:{userId:{in:userIds}}}),0);
  assert.equal(await db.eventBookmark.count({where:{userId:{in:userIds}}}),0);
  assert.equal(await db.session.count({where:{userId:{in:userIds}}}),0);
  assert.equal(await db.account.count({where:{userId:{in:userIds}}}),0);
  assert.equal(await db.organizationMember.count({where:{userId:{in:userIds}}}),0);
  assert.equal(await db.rateLimit.count({where:{key:{startsWith:ratePrefix}}}),0);
  ledger.cleanupVerified=true;
  await verifyBaseline();
  console.log('CLEANUP '+JSON.stringify(Object.fromEntries(models.map(model=>[model,ledger.deleted[model].length]))));
  console.log('PASS exact disposable cleanup; existing user/auth/organization/event/participation records unchanged');
 } finally { writeLedger(); await db.$disconnect(); }
}
