import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
const { PrismaClient } = await import('../src/generated/prisma/client.ts');
nextEnv.loadEnvConfig(process.cwd());
const origin = process.env.STEP12_ORIGIN ?? process.env.APP_URL;
assert.ok(origin && process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }), log: [] });
const run = randomUUID();
const slugs = [];
const userIds = [];
const emails = ['Alice','Bob'].map(label => `step12-${run}-${label.toLowerCase()}@example.com`);
// A unique IPv6 /64 keeps Better Auth's database rate-limit records isolated.
const hex = run.replaceAll('-', '');
const testIp = `fd12:${hex.slice(0,4)}:${hex.slice(4,8)}:${hex.slice(8,12)}::1`;
const ratePrefix = `fd12:${hex.slice(0,4)}:${hex.slice(4,8)}:${hex.slice(8,12)}:0000:0000:0000:0000|`;
const ledger = { run, origin, created: {}, deleted: {}, cleanupVerified: false, productionRecordsUnchanged: false, passed: [] };
const models = ['user','session','account','organization','organizationMember','event','eventRegistration','eventBookmark','rateLimit'];
for (const model of models) ledger.created[model] = [];
const baselineModels = ['user','session','account','organization','organizationMember','event','eventRegistration','eventBookmark'];
const baseline = {};
async function capture() {
 const scopedUsers = await db.user.findMany({where:{email:{in:emails}},select:{id:true}});
 for(const {id} of scopedUsers) if(!userIds.includes(id)) userIds.push(id);
 const queries = {
  user:{id:{in:userIds}}, session:{userId:{in:userIds}}, account:{userId:{in:userIds}},
  organization:{slug:slugFor('org')}, organizationMember:{userId:{in:userIds}},
  event:{slug:{in:slugs}}, eventRegistration:{userId:{in:userIds}}, eventBookmark:{userId:{in:userIds}},
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
  const current=await db[model].findMany({where:{id:{in:baseline[model].map(row=>row.id)}},select:{id:true,...(model==='eventBookmark'?{createdAt:true}:{updatedAt:true})},orderBy:{id:'asc'}});
  assert.deepEqual(current,baseline[model],`Existing ${model} rows changed`);
 }
 ledger.productionRecordsUnchanged=true;
}
function writeLedger() {
 mkdirSync('artifacts',{recursive:true});
 writeFileSync(`artifacts/step12-runtime-${run}.json`,JSON.stringify(ledger,null,2));
}

function pass(label) { ledger.passed.push(label); console.log(`PASS ${label}`); }
async function request(path, cookie = '', options = {}) {
  return fetch(`${origin}${path}`, { redirect: 'manual', ...options, headers: { Origin: origin, 'X-Forwarded-For': testIp, ...(cookie ? { Cookie: cookie } : {}), ...options.headers } });
}
// Explicit approval is required before running this disposable Neon mutation workflow.
const manifest = JSON.parse(readFileSync('.next/server/server-reference-manifest.json', 'utf8'));
const actionIds = Object.fromEntries(Object.entries(manifest.node).filter(([,entry]) => ['joinEvent','cancelEventRegistration','saveEvent','unsaveEvent'].includes(entry.exportedName)).map(([id,entry])=>[entry.exportedName,id]));
const slugFor = (label) => `s12-${run}-${label}`;
async function action(name, slug, cookie = '', forged = {}) {
  const response = await request(`/events/${slug}`, cookie, { method: 'POST', headers: { 'Next-Action': actionIds[name], 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify([slug, forged]) });
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
 const response=await request('/api/auth/sign-up/email','',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`Step12 ${label}`,email:`step12-${run}-${label}@example.com`,password:randomUUID()})});
 assert.equal(response.status,200);
 const data=await response.json();userIds.push(data.user.id);
 return {id:data.user.id,cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};
}
try {
 for(const model of baselineModels) baseline[model]=await db[model].findMany({select:{id:true,...(model==='eventBookmark'?{createdAt:true}:{updatedAt:true})},orderBy:{id:'asc'}});
 assert.equal(await db.rateLimit.count({where:{key:{startsWith:ratePrefix}}}),0);
 console.log(`RUN ${run}`);
 const alice=await user('Alice'),bob=await user('Bob');
 await capture();
 const org=await db.organization.create({data:{slug:slugFor('org'),name:'Step12 Test Organization',members:{create:{userId:alice.id,role:'OWNER'}}}});const orgId=org.id;
 const events={};
 for(const [label,status,extra] of [['main','PUBLISHED',{}],['capacity','PUBLISHED',{capacity:1}],['draft','DRAFT',{}],['cancelled','CANCELLED',{}],['archived','ARCHIVED',{}],['past','PUBLISHED',{startAt:new Date('2020-01-01'),endAt:new Date('2020-01-02')}],['completed','COMPLETED',{startAt:new Date('2020-01-01'),endAt:new Date('2020-01-02')}],['deadline','PUBLISHED',{registrationDeadline:new Date('2020-01-01')}]] ) {
  const slug=slugFor(label);slugs.push(slug);
  events[label]=await db.event.create({data:{slug,title:`Step12 ${label} event`,description:'Disposable real registration verification.',category:'Community',startAt:new Date('2090-01-01'),endAt:new Date('2090-01-02'),timezone:'Asia/Yangon',eventType:'ONLINE',status,creatorId:alice.id,organizationId:orgId,...extra}});
 }
 await capture();
 const main=events.main;
 assert.match(await action('joinEvent',main.slug),/Please sign in to continue/);pass('1 anonymous Join returns sign-in flow');
 assert.match(await action('joinEvent',main.slug,alice.cookie),/"ok":true/);
 assert.equal(await db.eventRegistration.count({where:{userId:alice.id,eventId:main.id,status:'REGISTERED'}}),1);pass('2 authenticated Join persists');
 await Promise.all([action('joinEvent',main.slug,alice.cookie),action('joinEvent',main.slug,alice.cookie)]);
 assert.equal(await db.eventRegistration.count({where:{userId:alice.id,eventId:main.id}}),1);pass('3 duplicate/concurrent same-user Join creates one row');
 const detail=await (await request(`/events/${main.slug}`,alice.cookie)).text();assert.ok(detail.includes('Joined:')&&detail.includes('Cancel registration'));pass('4 refresh preserves Joined');
 assert.match(await action('cancelEventRegistration',main.slug,alice.cookie),/"ok":true/);
 assert.equal((await db.eventRegistration.findUniqueOrThrow({where:{userId_eventId:{userId:alice.id,eventId:main.id}}})).status,'CANCELLED');pass('5 cancellation retains row');
 assert.match(await action('cancelEventRegistration',main.slug,alice.cookie),/"ok":true/);pass('6 repeated cancellation is safe');
 await action('joinEvent',main.slug,alice.cookie);
 assert.match(await action('saveEvent',main.slug,alice.cookie),/"ok":true/);pass('7 Save persists');
 await Promise.all([action('saveEvent',main.slug,alice.cookie),action('saveEvent',main.slug,alice.cookie)]);
 assert.equal(await db.eventBookmark.count({where:{userId:alice.id,eventId:main.id}}),1);pass('8 duplicate Save creates one row');
 await action('unsaveEvent',main.slug,alice.cookie);await action('unsaveEvent',main.slug,alice.cookie);assert.equal(await db.eventBookmark.count({where:{userId:alice.id,eventId:main.id}}),0);pass('9 Unsave and repeated Unsave are safe');
 await action('saveEvent',main.slug,alice.cookie);
 await action('cancelEventRegistration',main.slug,bob.cookie,{userId:alice.id});assert.equal((await db.eventRegistration.findUniqueOrThrow({where:{userId_eventId:{userId:alice.id,eventId:main.id}}})).status,'REGISTERED');pass('10 forged user ID cannot cancel another registration');
 await action('unsaveEvent',main.slug,bob.cookie,{userId:alice.id});assert.equal(await db.eventBookmark.count({where:{userId:alice.id,eventId:main.id}}),1);pass('11 forged user ID cannot unsave another bookmark');
 for(const [number,label] of [[12,'draft'],[13,'cancelled'],[14,'past'],[15,'deadline']]) {
  const result=await action('joinEvent',events[label].slug,alice.cookie);assert.match(result,/"ok":false/);assert.equal(await db.eventRegistration.count({where:{eventId:events[label].id}}),0);pass(`${number} ${label} cannot be joined`);
 }
 for(const label of ['archived','completed'])assert.match(await action('joinEvent',events[label].slug,alice.cookie),/"ok":false/);
 for(let round=1;round<=5;round++) {
  const responses=await Promise.all([action('joinEvent',events.capacity.slug,alice.cookie),action('joinEvent',events.capacity.slug,bob.cookie)]);
  assert.equal(responses.filter(body=>body.includes('"ok":true')).length,1,`capacity round ${round}: one success`);
  assert.equal(responses.filter(body=>body.includes('This event is full.')).length,1,`capacity round ${round}: one full response`);
  assert.equal(await db.eventRegistration.count({where:{eventId:events.capacity.id,status:'REGISTERED'}}),1);
  if(round<5) {
   const winner=await db.eventRegistration.findFirstOrThrow({where:{eventId:events.capacity.id,status:'REGISTERED'},select:{userId:true}});
   assert.match(await action('cancelEventRegistration',events.capacity.slug,winner.userId===alice.id?alice.cookie:bob.cookie),/"ok":true/);
   assert.equal(await db.eventRegistration.count({where:{eventId:events.capacity.id,status:'REGISTERED'}}),0);
  }
 }
 pass('16 concurrent last-seat capacity enforcement: five races, one success/one full each, cancelled seats reusable');
 assert.ok((await (await request('/dashboard/joined',alice.cookie)).text()).includes(main.title));assert.ok(!(await (await request('/dashboard/joined',bob.cookie)).text()).includes(main.title));pass('17 dashboard joined events are session-scoped');
 assert.ok((await (await request('/dashboard/saved',alice.cookie)).text()).includes(main.title));assert.ok(!(await (await request('/dashboard/saved',bob.cookie)).text()).includes(main.title));pass('18 dashboard saved events are session-scoped');
 const management=await (await request(`/organizer/${org.slug}/events/${main.id}`,alice.cookie)).text();assert.match(management,/Registrations: (?:<!-- -->)?1/);assert.ok(!(await (await request(`/organizer/${org.slug}/events/${main.id}`,bob.cookie)).text()).includes(main.title));pass('19 organizer count and authorization');
 const registration=await db.eventRegistration.findUniqueOrThrow({where:{userId_eventId:{userId:alice.id,eventId:main.id}}});const bookmark=await db.eventBookmark.findUniqueOrThrow({where:{userId_eventId:{userId:alice.id,eventId:main.id}}});
 for(const cookie of ['',alice.cookie,bob.cookie]) {
  const publicHtml=await (await request(`/events/${main.slug}`,cookie)).text();
  for(const secret of [...userIds,registration.id,bookmark.id,...emails])assert.ok(!publicHtml.includes(secret),`Privacy leak: ${secret}`);
 }
 pass('public event responses expose no participant identities or record IDs');
 await db.event.update({where:{id:main.id},data:{status:'CANCELLED'}});
 assert.equal(await db.eventRegistration.count({where:{eventId:main.id}}),1);assert.ok((await (await request('/dashboard/joined',alice.cookie)).text()).includes('Event cancelled by the organizer'));
 assert.match(await action('joinEvent',main.slug,alice.cookie),/"ok":false/);pass('organizer cancellation retains registration history and blocks Join');
 await action('saveEvent',events.completed.slug,alice.cookie);assert.equal(await db.eventBookmark.count({where:{userId:alice.id,eventId:events.completed.id}}),1);pass('completed events can remain saved');
 if(process.env.STEP12_BROWSER_HOLD==='1') {console.log(`BROWSER_READY ${origin}/events/${events.capacity.slug}`);await new Promise(resolve=>process.stdin.once('data',resolve));}
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
