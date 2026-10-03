import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
import rscClient from 'next/dist/compiled/react-server-dom-turbopack/client.node.js';
const { PrismaClient } = await import('../src/generated/prisma/client.ts');
nextEnv.loadEnvConfig(process.cwd());
assert.equal(process.env.STEP14_DISPOSABLE_APPROVED, '1', 'Explicit disposable Neon approval required.');
const origin = process.env.STEP14_ORIGIN ?? process.env.APP_URL;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }), log: [] });
const run = randomUUID(), orgSlug = `s14-${run}`, userIds = [], eventIds = [];
const emails = ['owner','member','outsider'].map(label => `step14-${run}-${label}@example.com`);
const hex = run.replaceAll('-', '');
const ip = `fd14:${hex.slice(0,4)}:${hex.slice(4,8)}:${hex.slice(8,12)}::1`;
const ratePrefix = `fd14:${hex.slice(0,4)}:${hex.slice(4,8)}:${hex.slice(8,12)}:0000:0000:0000:0000|`;
const ledger = { run, passed: [], fixtures: { users: userIds, events: eventIds, organization: null }, cleanupVerified: false, existingRecordsUnchanged: false };
const baseline = {};
const models = ['user','session','account','organization','organizationMember','event','eventAgendaItem','eventSpeaker','eventResource','eventRegistration','eventBookmark','organizationFollower','notification'];
const immutable = ['eventBookmark','organizationFollower','notification'];
const snapshot = model => ({id:true,...(immutable.includes(model)?{createdAt:true}:{updatedAt:true}),...(model==='notification'?{readAt:true}:{})});
function writeLedger() { mkdirSync('artifacts',{recursive:true}); writeFileSync(`artifacts/step14-runtime-${run}.json`,JSON.stringify(ledger,null,2)); }
function pass(label) { ledger.passed.push(label); console.log(`PASS ${label}`); writeLedger(); }
async function request(path,cookie='',options={}) { return fetch(`${origin}${path}`,{redirect:'manual',...options,headers:{Origin:origin,'X-Forwarded-For':ip,...(cookie?{Cookie:cookie}:{}),...options.headers}}); }
const manifest = JSON.parse(readFileSync('.next/server/server-reference-manifest.json','utf8'));
const actionIds = Object.fromEntries(Object.entries(manifest.node).filter(([,entry])=> /^(create|update|delete|move)(AgendaItem|Speaker|Resource)$/.test(entry.exportedName??'')).map(([id,entry])=>[entry.exportedName,id]));
assert.equal(Object.keys(actionIds).length,12);
async function action(name,event,actor,fields={},scope=orgSlug) {
  const form = new FormData();
  for(const [key,value] of Object.entries(fields)) form.set(key,String(value));
  const bodyPayload = await rscClient.encodeReply([event.id,scope,{},form]);
  const response=await request('/dashboard',actor?.cookie??'',{method:'POST',headers:{'Next-Action':actionIds[name]},body:bodyPayload});
  const body=await response.text();
  assert.equal(response.status,200,`${name}: ${body.slice(0,200)}`);
  const result=body.split('\n').map(line=>{try{return JSON.parse(line.slice(line.indexOf(':')+1),(_key,value)=>value==='$undefined'?undefined:value);}catch{return null;}}).find(value=>value && typeof value.message==='string');
  assert.ok(result,`${name}: missing result ${body.slice(0,300)}`);
  return result;
}
async function signup(label) {
  const response=await request('/api/auth/sign-up/email','',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`Step14 ${label}`,email:`step14-${run}-${label}@example.com`,password:randomUUID()})});
  assert.equal(response.status,200);const {user}=await response.json();userIds.push(user.id);writeLedger();
  return {id:user.id,cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};
}
const definitions = {
  AgendaItem: { model:'eventAgendaItem', fields:{ title:'Persisted Agenda',description:'Agenda description',startAt:'2030-06-20T10:00',endAt:'2030-06-20T10:30',locationLabel:'Room A' }, change:{ title:'Edited Agenda' } },
  Speaker: { model:'eventSpeaker',fields:{name:'Persisted Speaker',role:'Host',company:'Speaker Company',bio:'Speaker biography'},change:{name:'Edited Speaker'} },
  Resource: {model:'eventResource',fields:{title:'Persisted Slides',type:'SLIDES',url:'https://example.com/step14-slides',description:'Resource description'},change:{title:'Edited Slides',url:'https://example.com/step14-edited'}},
};
async function rows(def,event) { return db[def.model].findMany({where:{eventId:event.id},orderBy:[{sortOrder:'asc'},{id:'asc'}]}); }
async function page(event) {const response=await request(`/events/${event.slug}`);assert.equal(response.status,200);return response.text();}
try {
  for(const model of models) baseline[model]=await db[model].findMany({select:snapshot(model),orderBy:{id:'asc'}});
  const owner=await signup('owner'), member=await signup('member'), outsider=await signup('outsider');
  const org=await db.organization.create({data:{slug:orgSlug,name:'Step14 Disposable Organization',members:{create:[{userId:owner.id,role:'OWNER'},{userId:member.id,role:'MEMBER'}]}}});
  ledger.fixtures.organization=org.id;writeLedger();
  const fixture=async(label,organizationId=org.id)=>{
    const event=await db.event.create({data:{slug:`s14-${run}-${label}`,title:`Step14 ${label}`,description:'Disposable event content runtime verification.',creatorId:owner.id,organizationId,eventType:'ONLINE',status:'PUBLISHED',startAt:new Date('2030-06-20T03:30:00Z'),endAt:new Date('2030-06-20T05:30:00Z'),timezone:'Asia/Yangon'}});
    eventIds.push(event.id);writeLedger();return event;
  };
  const event=await fixture('rich'), individual=await fixture('individual',null);
  const management=await request(`/organizer/${orgSlug}/events/${event.id}`,owner.cookie);
  assert.equal(management.status,200);const managementHtml=await management.text();
  for(const label of ['Add agenda item','Add speaker','Add resource']) assert.ok(managementHtml.includes(label));
  pass('existing management summary and all three labeled content forms render');
  assert.match((await action('createSpeaker',event,null,definitions.Speaker.fields)).message,/Sign in/);
  pass('anonymous server action requires authentication');
  for(const [suffix,def] of Object.entries(definitions)) {
    const created = await action(`create${suffix}`,event,owner,def.fields);
    assert.equal(created.ok,true,JSON.stringify(created));
    const first=(await rows(def,event))[0];
    if(suffix==='AgendaItem') assert.equal(first.startAt.toISOString(),'2030-06-20T03:30:00.000Z');
    pass(`${suffix} create persists${suffix==='AgendaItem'?' using event timezone':''}`);
    assert.equal((await action(`update${suffix}`,event,owner,{...def.fields,...def.change,itemId:first.id,version:first.updatedAt.toISOString()})).ok,true);
    assert.equal((await rows(def,event))[0][suffix==='Speaker'?'name':'title'],Object.values(def.change)[0]);
    pass(`${suffix} edit persists`);
    assert.ok(!(await action(`update${suffix}`,event,owner,{...def.fields,itemId:first.id,version:first.updatedAt.toISOString()})).ok);
    pass(`${suffix} stale edit safely rejected`);
    assert.equal((await action(`create${suffix}`,event,owner,def.fields)).ok,true);
    let current=await rows(def,event), second=current[1];
    const orderVersion=JSON.stringify(current.map(row=>row.id));
    assert.equal((await action(`move${suffix}`,event,owner,{itemId:second.id,direction:'up',orderVersion})).ok,true);
    current=await rows(def,event);assert.equal(current[0].id,second.id);assert.deepEqual(current.map(row=>row.sortOrder),[0,1]);
    pass(`${suffix} reorder persists unique deterministic positions`);
    assert.ok(!(await action(`move${suffix}`,event,owner,{itemId:second.id,direction:'down',orderVersion})).ok);
    for(const actor of [member,outsider]) {
      assert.ok(!(await action(`create${suffix}`,event,actor,def.fields)).ok);
      assert.ok(!(await action(`update${suffix}`,event,actor,{...def.fields,itemId:current[0].id,version:current[0].updatedAt.toISOString()})).ok);
      assert.ok(!(await action(`delete${suffix}`,event,actor,{itemId:current[0].id,version:current[0].updatedAt.toISOString()})).ok);
      assert.ok(!(await action(`move${suffix}`,event,actor,{itemId:current[0].id,direction:'down',orderVersion:JSON.stringify(current.map(row=>row.id))})).ok);
    }
    pass(`${suffix} MEMBER and unrelated user blocked from all four mutations`);
    assert.equal((await action(`delete${suffix}`,event,owner,{itemId:current[0].id,version:current[0].updatedAt.toISOString()})).ok,true);
    assert.equal((await rows(def,event)).length,1);
    assert.ok(!(await action(`delete${suffix}`,event,owner,{itemId:current[0].id,version:current[0].updatedAt.toISOString()})).ok);
    pass(`${suffix} delete and missing-record handling`);
    assert.equal((await action(`create${suffix}`,individual,owner,def.fields,null)).ok,true);
    const personal=(await rows(def,individual))[0];
    for(const operation of ['create','update','delete','move']) assert.ok(!(await action(`${operation}${suffix}`,individual,outsider,{...def.fields,itemId:personal.id,version:personal.updatedAt.toISOString(),direction:'up',orderVersion:JSON.stringify([personal.id])},null)).ok);
    assert.ok(!(await action(`delete${suffix}`,event,owner,{itemId:personal.id,version:personal.updatedAt.toISOString()})).ok);
    pass(`${suffix} individual creator allowed; other user and cross-event child ID blocked`);
  }
  for(const unsafe of ['javascript:alert(1)','data:text/html,test','file:///tmp/test','ftp://example.com','https://user:password@example.com']) assert.ok(!(await action('createResource',event,owner,{...definitions.Resource.fields,url:unsafe})).ok);
  assert.ok(!(await action('createAgendaItem',event,owner,{...definitions.AgendaItem.fields,endAt:'2030-06-20T09:00'})).ok);
  assert.ok(!(await action('createAgendaItem',event,owner,{...definitions.AgendaItem.fields,startAt:'2030-06-20T09:00'})).ok);
  pass('unsafe protocols/credentials, reversed times and out-of-event agenda rejected server-side');
  let html=await page(event);
  for(const text of ['Edited Agenda','Edited Speaker','Edited Slides','Speaker Company','Room A','https://example.com/step14-edited']) assert.ok(html.includes(text),`Public missing ${text}`);
  for(const model of Object.values(definitions)) for(const row of await rows(model,event)) assert.ok(!html.includes(row.id),'Public leaked child ID');
  assert.ok(!html.includes(emails[0]));
  pass('published public detail renders real agenda, speakers, resources and no child IDs/emails');
  const resource=(await rows(definitions.Resource,event))[0];
  assert.equal((await action('updateResource',event,owner,{...definitions.Resource.fields,title:'Refreshed Public Resource',itemId:resource.id,version:resource.updatedAt.toISOString()})).ok,true);
  assert.ok((await page(event)).includes('Refreshed Public Resource'));
  pass('public content changes appear immediately after server-action revalidation without restart');
  for(const role of ['ADMIN','EDITOR']) {
    await db.organizationMember.update({where:{userId_organizationId:{userId:member.id,organizationId:org.id}},data:{role}});
    for(const [suffix,def] of Object.entries(definitions)) assert.equal((await action(`create${suffix}`,event,member,def.fields)).ok,true);
    pass(`${role} can manage all content sections`);
  }
  await db.organizationMember.update({where:{userId_organizationId:{userId:member.id,organizationId:org.id}},data:{role:'MEMBER'}});
  assert.ok(!(await action('createResource',event,member,definitions.Resource.fields)).ok);
  pass('revoked editor action rejected after role changes');
  for(const status of ['DRAFT','COMPLETED','CANCELLED','ARCHIVED']) {
    await db.event.update({where:{id:event.id},data:{status}});
    for(const [suffix,def] of Object.entries(definitions)) {
      const allowed=status==='DRAFT'||(status==='COMPLETED'&&suffix==='Resource');
      assert.equal(Boolean((await action(`create${suffix}`,event,owner,def.fields)).ok),allowed,`${status} ${suffix}`);
      if(!allowed) {
        const current=await rows(def,event), row=current[0];
        for(const operation of ['update','delete','move']) assert.ok(!(await action(`${operation}${suffix}`,event,owner,{...def.fields,itemId:row.id,version:row.updatedAt.toISOString(),direction:'down',orderVersion:JSON.stringify(current.map(entry=>entry.id))})).ok);
      }
    }
    if(['DRAFT','CANCELLED','ARCHIVED'].includes(status)) assert.equal((await request(`/events/${event.slug}`)).status,404);
    else {
      assert.ok((await page(event)).includes('Persisted Slides'));
      let resources=await rows(definitions.Resource,event), row=resources.at(-1);
      assert.equal((await action('updateResource',event,owner,{...definitions.Resource.fields,title:'Post-event Published Resource',itemId:row.id,version:row.updatedAt.toISOString()})).ok,true);
      resources=await rows(definitions.Resource,event);
      assert.equal((await action('moveResource',event,owner,{itemId:row.id,direction:'up',orderVersion:JSON.stringify(resources.map(entry=>entry.id))})).ok,true);
      row=(await rows(definitions.Resource,event)).find(entry=>entry.id===row.id);
      assert.ok((await page(event)).includes('Post-event Published Resource'));
      assert.equal((await action('deleteResource',event,owner,{itemId:row.id,version:row.updatedAt.toISOString()})).ok,true);
      pass('completed resource edit, reorder, public rendering and delete remain available');
    }
    pass(`${status} editability policy and public visibility enforced`);
  }
  await db.event.update({where:{id:event.id},data:{status:'PUBLISHED'}});
  const memberHtml=await (await request(`/organizer/${orgSlug}/events/${event.id}`,member.cookie)).text();
  assert.ok(!memberHtml.includes('Add agenda item'));assert.ok(memberHtml.includes('read-only'));
  pass('MEMBER management UI renders content read-only');
  const empty=await fixture('empty');
  html=await page(empty);assert.ok(!html.includes('id="agenda"')&&!html.includes('id="speakers"')&&!html.includes('id="resources"'));
  await db.event.update({where:{id:empty.id},data:{status:'COMPLETED'}});
  assert.ok(!(await page(empty)).includes('id="resources"'));
  pass('empty upcoming and completed sections hidden');
  // Independent simultaneous requests exercise serialization in separate DB transactions.
  const { mutateEventContent } = await import('../src/features/events/server/content-service.ts');
  const makeForm=()=>{const form=new FormData();for(const[key,value]of Object.entries(definitions.Speaker.fields))form.set(key,value);return form;};
  const concurrent=await Promise.all(Array.from({length:4},()=>mutateEventContent(db,owner.id,event.id,orgSlug,'speaker','create',makeForm())));
  assert.ok(concurrent.every(result=>result.ok));
  const speakers=await rows(definitions.Speaker,event);assert.equal(new Set(speakers.map(row=>row.sortOrder)).size,speakers.length);
  const order=JSON.stringify(speakers.map(row=>row.id));
  const moveForm=()=>{const form=new FormData();form.set('itemId',speakers.at(-1).id);form.set('direction','up');form.set('orderVersion',order);return form;};
  const moves=await Promise.all([1,2].map(()=>mutateEventContent(db,owner.id,event.id,orgSlug,'speaker','move',moveForm())));
  assert.equal(moves.filter(result=>result.ok).length,1);
  pass('concurrent appends retain unique positions; stale concurrent reorder safely rejected');
} finally {
  const scopedUsers=await db.user.findMany({where:{email:{in:emails}},select:{id:true}});
  for(const row of scopedUsers) if(!userIds.includes(row.id))userIds.push(row.id);
  await db.event.deleteMany({where:{id:{in:eventIds}}});
  for(const model of ['eventAgendaItem','eventSpeaker','eventResource']) assert.equal(await db[model].count({where:{eventId:{in:eventIds}}}),0,'Event cascade cleanup failed');
  await db.organization.deleteMany({where:{slug:orgSlug}});
  await db.user.deleteMany({where:{id:{in:userIds}}});
  await db.rateLimit.deleteMany({where:{key:{startsWith:ratePrefix}}});
  assert.equal(await db.user.count({where:{email:{in:emails}}}),0);
  assert.equal(await db.organization.count({where:{slug:orgSlug}}),0);
  assert.equal(await db.event.count({where:{id:{in:eventIds}}}),0);
  assert.equal(await db.rateLimit.count({where:{key:{startsWith:ratePrefix}}}),0);
  ledger.cleanupVerified=true;
  for(const model of models) if(baseline[model]) assert.deepEqual(await db[model].findMany({where:{id:{in:baseline[model].map(row=>row.id)}},select:snapshot(model),orderBy:{id:'asc'}}),baseline[model],`Existing ${model} modified`);
  ledger.existingRecordsUnchanged=true;writeLedger();await db.$disconnect();
  console.log(`Removed all disposable Step14 fixtures; ${ledger.passed.length} scenarios passed; existing records unchanged.`);
}
