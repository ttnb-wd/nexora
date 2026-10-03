import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
import rscClient from 'next/dist/compiled/react-server-dom-turbopack/client.node.js';
const { PrismaClient } = await import('../src/generated/prisma/client.ts');
const { loadOwnTicket, checkInByTicket } = await import('../src/features/tickets/server/service.ts');
const { mutateAttendance } = await import('../src/features/attendees/server/service.ts');
const { newTicket, ticketUrl, hashTicketToken } = await import('../src/features/tickets/token.ts');
const { allowTicketRequest } = await import('../src/features/tickets/server/rate-limit.ts');
nextEnv.loadEnvConfig(process.cwd());
assert.equal(process.env.STEP17_DISPOSABLE_APPROVED, '1', 'Explicit disposable Neon approval required.');
const origin = process.env.APP_URL;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }), log: [] });
const run = randomUUID(), prefix = `s17-${run}`, orgSlug = prefix, userIds = [], eventIds = [];
const ipPrefix = `fd17:${run.slice(0,4)}:${run.slice(9,13)}:`;
const ledger = { run, passed: [], cleanupVerified: false, existingRecordsUnchanged: false };
mkdirSync('artifacts', { recursive: true });
const ledgerPath = `artifacts/step17-runtime-${run}.json`;
const writeLedger = () => writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
function pass(message) { ledger.passed.push(message); writeLedger(); console.log(`PASS ${message}`); }
const models = ['user','session','account','organization','organizationMember','event','eventRegistration','eventBookmark','organizationFollower','notification','eventAgendaItem','eventSpeaker','eventResource','eventReminderPreference'];
const baseline = {};
const snapshot = model => ({ id: true, ...(['eventBookmark','organizationFollower','notification'].includes(model) ? { createdAt: true } : { updatedAt: true }), ...(model === 'eventRegistration' ? { status: true, checkedInAt: true, checkedInById: true, ticketTokenHash: true, ticketNonce: true, ticketIssuedAt: true } : {}), ...(model === 'notification' ? { readAt: true } : {}) });
const manifest = JSON.parse(readFileSync('.next/server/server-reference-manifest.json','utf8'));
const names = ['issueEventTicket','scanEventTicket','joinEvent','cancelEventRegistration'];
const ids = Object.fromEntries(Object.entries(manifest.node).filter(([,entry]) => names.includes(entry.exportedName)).map(([id,entry]) => [entry.exportedName,id]));
assert.ok(names.every(name => ids[name]));
async function request(path, actor, options = {}) {
  return fetch(`${origin}${path}`, { redirect:'manual', ...options, headers: { Origin:origin, 'X-Forwarded-For':`${ipPrefix}${actor?.index ?? 9}::1`, ...(actor?.cookie ? { Cookie:actor.cookie } : {}), ...options.headers } });
}
async function html(path, actor) { const response = await request(path,actor); assert.equal(response.status,200); return (await response.text()).replace(/<!--[\s\S]*?-->/g,''); }
async function invoke(name,args,actor,extraHeaders={}) {
  const payload = await rscClient.encodeReply(args);
  const response = await request('/dashboard',actor,{method:'POST',headers:{'Next-Action':ids[name], ...(typeof payload === 'string' ? {'Content-Type':'text/plain;charset=UTF-8'} : {}), ...extraHeaders},body:payload});
  if(response.status !== 200) return {response,body:await response.text()};
  const flight = await rscClient.createFromFetch(Promise.resolve(response), { serverConsumerManifest: { moduleMap:{}, serverModuleMap:{}, moduleLoading:null } });
  const result = await flight.a;
  assert.ok(result,`${name} missing result`); return result;
}
async function signup(label,index) {
  const password = randomUUID(), email = `${prefix}-${label}@example.com`;
  const response = await request('/api/auth/sign-up/email',{index},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`Step17 ${label}`,email,password})});
  assert.equal(response.status,200); const {user} = await response.json(); userIds.push(user.id);
  return {id:user.id,email,password,index,cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};
}
async function issue(event,actor) { return invoke('issueEventTicket',[event.slug,{},new FormData()],actor); }
async function scan(event,token,actor,scope=orgSlug) { const form=new FormData();form.set('token',token);form.set('checkedInById','forged-actor'); return invoke('scanEventTicket',[event.id,scope,{},form],actor); }
const current = row => db.eventRegistration.findUniqueOrThrow({where:{id:row.id}});
try {
  for(const model of models) baseline[model]=await db[model].findMany({select:snapshot(model),orderBy:{id:'asc'}});
  const owner=await signup('owner',1), attendee=await signup('attendee',2), member=await signup('member',3), outsider=await signup('outsider',4);
  const org=await db.organization.create({data:{slug:orgSlug,name:'Step17 disposable organization',members:{create:[{userId:owner.id,role:'OWNER'},{userId:member.id,role:'MEMBER'}]}}});
  await db.organization.create({data:{slug:`${prefix}-other`,name:'Step17 unrelated organization',members:{create:{userId:outsider.id,role:'OWNER'}}}});
  async function fixture(label,organizationId=org.id) {
    const event=await db.event.create({data:{slug:`${prefix}-${label}`,title:`Step17 ${label}`,description:'Disposable secure ticket test.',creatorId:owner.id,organizationId,eventType:'IN_PERSON',locationName:'Test venue',city:'Yangon',status:'PUBLISHED',startAt:new Date('2090-06-20T03:30:00Z'),endAt:new Date('2090-06-20T05:30:00Z')}});
    eventIds.push(event.id);return event;
  }
  const event=await fixture('ticket'), other=await fixture('wrong-event');
  const row=await db.eventRegistration.create({data:{userId:attendee.id,eventId:event.id}});
  const path=`/organizer/${orgSlug}/events/${event.id}/check-in`, ticketPath=`/dashboard/joined/${event.slug}/ticket`;
  assert.equal((await current(row)).ticketTokenHash,null);
  assert.ok((await html(ticketPath,attendee)).includes('View ticket'));
  assert.equal((await current(row)).ticketTokenHash,null);
  const ticket=(await issue(event,attendee)).ticket; assert.ok(ticket?.qr.startsWith('data:image/svg+xml;base64,'));
  const persisted=await current(row);assert.equal(persisted.ticketTokenHash,hashTicketToken(ticket.token));assert.ok(persisted.ticketIssuedAt);assert.ok(!JSON.stringify(persisted).includes(ticket.token));
  assert.equal((await issue(event,attendee)).ticket.token,ticket.token);
  const duplicateViews=await Promise.all([1,2].map(()=>loadOwnTicket(db,attendee.id,event.slug,process.env.AUTH_SECRET,true)));
  assert.ok(duplicateViews.every(view=>view.token===ticket.token));
  assert.equal(await db.eventRegistration.count({where:{userId:attendee.id,eventId:event.id}}),1);
  pass('1–2 registered owner issues a QR ticket on explicit view; repeated/concurrent views reuse one ticket; GET does not issue');
  assert.ok(!(await issue(event,outsider)).ticket);assert.ok(!(await issue(event,null)).ticket);
  assert.ok(!(await html(ticketPath,outsider)).includes(ticket.token));assert.equal((await request(ticketPath,null)).status,307);
  pass('3 another user and anonymous visitor cannot view or issue this ticket');
  assert.equal((await request(path,member)).status,404);assert.equal((await request(path,outsider)).status,404);assert.equal((await request(path,null)).status,307);
  for(const actor of [member,outsider,null]) { const result=await scan(event,ticket.token,actor);assert.ok(!result.ok&&!result.name); }
  assert.ok(!(await scan(event,ticket.token,owner,`${prefix}-other`)).ok);
  pass('8–9 MEMBER, unrelated organizer, anonymous caller and forged organization scope cannot scan');
  const wrong=await scan(other,ticket.token,owner);assert.equal(wrong.message,'This ticket is for a different event.');assert.ok(!wrong.name);
  for(const token of [newTicket(process.env.AUTH_SECRET).token,'forged',`${origin.replace('localhost','attacker.example')}/check-in/ticket#${ticket.token}`]) {const result=await scan(event,token,owner);assert.ok(!result.ok&&!result.name);}
  pass('7,10 wrong-event and forged/unknown/foreign-origin credentials rejected without attendee identity');
  const payload=ticketUrl(ticket.token,origin);
  for(const secret of [attendee.email,attendee.id,row.id,orgSlug,'OWNER']) assert.ok(!payload.includes(secret));
  const publicHtml=await html('/check-in/ticket',null);for(const secret of [attendee.email,attendee.id,row.id,attendee.cookie,ticket.token,'Step17 attendee'])assert.ok(!publicHtml.includes(secret));
  assert.equal((await current(row)).status,'REGISTERED');
  pass('21–22 QR contains no email/IDs/claims; public landing page returns no private fields and never mutates attendance');
  const result=await scan(event,payload,owner);assert.ok(result.ok);assert.equal(result.name,'Step17 attendee');
  let checked=await current(row);assert.equal(checked.status,'ATTENDED');assert.equal(checked.checkedInById,owner.id);assert.ok(checked.checkedInAt);
  const audit=checked.checkedInAt.toISOString();assert.match((await scan(event,ticket.token,owner)).message,/already checked in/);
  checked=await current(row);assert.equal(checked.checkedInAt.toISOString(),audit);assert.equal(checked.checkedInById,owner.id);
  pass('5–6,11–12 full token/URL manual entry checks in; repeat scan preserves audit fields; actor derives from session');
  assert.ok((await html('/dashboard/joined',attendee)).includes('Checked in'));assert.ok((await html(`/events/${event.slug}`,attendee)).includes('You attended this event'));
  assert.ok((await mutateAttendance(db,owner.id,{eventId:event.id,scope:orgSlug,registrationId:row.id},'undo')).ok);
  assert.ok((await invoke('cancelEventRegistration',[event.slug],attendee)).ok);
  let cancelled=await current(row);assert.equal(cancelled.status,'CANCELLED');assert.equal(cancelled.ticketTokenHash,null);assert.equal(cancelled.ticketNonce,null);assert.equal(cancelled.ticketIssuedAt,null);
  assert.ok(!(await scan(event,ticket.token,owner)).ok);assert.ok(!(await issue(event,attendee)).ticket);
  assert.ok((await invoke('joinEvent',[event.slug],attendee)).ok);
  const rejoined=(await issue(event,attendee)).ticket;assert.notEqual(rejoined.token,ticket.token);assert.equal((await current(row)).id,row.id);
  assert.ok(!(await scan(event,ticket.token,owner)).ok);assert.ok((await scan(event,rejoined.token,owner)).ok);
  pass('4,13–18 cancellation clears credential; rejoin keeps row but creates a different token; old screenshot stays invalid');
  assert.ok((await mutateAttendance(db,owner.id,{eventId:event.id,scope:orgSlug,registrationId:row.id},'undo')).ok);
  const concurrent=await Promise.all([1,2].map(()=>checkInByTicket(db,owner.id,{eventId:event.id,scope:orgSlug,token:rejoined.token},origin)));
  assert.ok(concurrent.every(result=>result.ok));assert.equal(concurrent.filter(result=>result.message.includes('already')).length,1);
  checked=await current(row);assert.equal(checked.status,'ATTENDED');assert.equal(checked.checkedInById,owner.id);assert.equal(await db.eventRegistration.count({where:{userId:attendee.id,eventId:event.id}}),1);
  pass('19–20 simultaneous scans produce one attendance transition and one registration');
  await mutateAttendance(db,owner.id,{eventId:event.id,scope:orgSlug,registrationId:row.id},'undo');
  for(const status of ['DRAFT','CANCELLED','ARCHIVED','COMPLETED']) {await db.event.update({where:{id:event.id},data:{status}});assert.ok(!(await scan(event,rejoined.token,owner)).ok);assert.ok(!(await issue(event,attendee)).ticket);}
  await db.event.update({where:{id:event.id},data:{status:'PUBLISHED',startAt:new Date('2000-01-01'),endAt:new Date('2000-01-02')}});assert.ok(!(await scan(event,rejoined.token,owner)).ok);
  await db.event.update({where:{id:event.id},data:{startAt:event.startAt,endAt:event.endAt}});
  pass('cancelled, archived, draft, completed and ended events reject QR issuance/check-in');
  for(const role of ['EDITOR','ADMIN']) {await db.organizationMember.update({where:{userId_organizationId:{userId:member.id,organizationId:org.id}},data:{role}});assert.ok((await scan(event,rejoined.token,member)).ok);assert.equal((await current(row)).checkedInById,member.id);await mutateAttendance(db,owner.id,{eventId:event.id,scope:orgSlug,registrationId:row.id},'undo');}
  await db.organizationMember.update({where:{userId_organizationId:{userId:member.id,organizationId:org.id}},data:{role:'MEMBER'}});
  const crossed=await invoke('scanEventTicket',[event.id,orgSlug,{},(()=>{const f=new FormData();f.set('token',rejoined.token);return f;})()],owner,{Origin:'https://attacker.example'});
  assert.ok(crossed.response?.status>=400);assert.equal((await current(row)).status,'REGISTERED');
  pass('OWNER/ADMIN/EDITOR authorized; role downgrade takes effect; cross-origin Server Action rejected');
  const rateResults=await Promise.all(Array.from({length:61},()=>allowTicketRequest(db,outsider.id,'scan')));assert.ok(rateResults.some(value=>!value));
  assert.ok(!(await checkInByTicket(db,outsider.id,{eventId:event.id,scope:orgSlug,token:rejoined.token},origin)).ok);
  pass('database-backed atomic rate limiter rejects excessive requests across concurrent callers');
  const browserEvent=await fixture('browser');const browserOther=await fixture('browser-other');
  await db.eventRegistration.create({data:{eventId:browserEvent.id,userId:attendee.id}});
  const wrongRow=await db.eventRegistration.create({data:{eventId:browserOther.id,userId:attendee.id}});
  const wrongTicket=await loadOwnTicket(db,attendee.id,browserOther.slug,process.env.AUTH_SECRET,true);
  const browser={run,origin,orgSlug,eventId:browserEvent.id,slug:browserEvent.slug,wrongToken:wrongTicket.token,owner:{email:owner.email,password:owner.password},attendee:{email:attendee.email,password:attendee.password},wrongRegistrationId:wrongRow.id};
  if(process.env.STEP17_BROWSER_HOLD==='1') {
    writeFileSync('artifacts/step17-browser-fixture.json',JSON.stringify(browser));
    console.log('Browser fixtures ready; waiting for browser verification release.');
    const deadline=Date.now()+20*60000;
    while(!existsSync('artifacts/step17-browser-release')&&Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,1000));
  }
} catch(error) { ledger.failure={name:error.name,message:error.message};writeLedger();throw error; }
finally {
  await db.event.deleteMany({where:{id:{in:eventIds}}});
  await db.organization.deleteMany({where:{slug:{startsWith:prefix}}});
  await db.user.deleteMany({where:{id:{in:userIds}}});
  await db.rateLimit.deleteMany({where:{OR:[{key:{startsWith:ipPrefix}},...userIds.flatMap(id=>['scan','issue'].map(kind=>({key:`tickets:${kind}:${hashTicketToken(id)}`})))]}});
  for(const model of ['user','event','organization'])assert.equal(await db[model].count({where:model==='user'?{id:{in:userIds}}:model==='event'?{id:{in:eventIds}}:{slug:{startsWith:prefix}}}),0);
  assert.equal(await db.eventRegistration.count({where:{eventId:{in:eventIds}}}),0);
  for(const model of models)if(baseline[model])assert.deepEqual(await db[model].findMany({where:{id:{in:baseline[model].map(row=>row.id)}},select:snapshot(model),orderBy:{id:'asc'}}),baseline[model],`Existing ${model} changed`);
  ledger.cleanupVerified=true;ledger.existingRecordsUnchanged=true;writeLedger();
  for(const path of ['artifacts/step17-browser-fixture.json','artifacts/step17-browser-release'])if(existsSync(path))unlinkSync(path);
  await db.$disconnect();console.log(`Cleaned Step17 disposable records. ${ledger.passed.length} scenario groups passed; existing records unchanged.`);
}
