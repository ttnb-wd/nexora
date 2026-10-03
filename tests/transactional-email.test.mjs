import './support/application-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { organizationInvitationTemplate } = await import('../src/lib/email/invitation-template.ts');
const { emailConfiguration } = await import('../src/lib/email/config.ts');
const { sendTransactionalEmail } = await import('../src/lib/email/transport.ts');
const { createAndEmailInvitation, deliverIssuedInvitation, invitationDeliveryState, invitationEmailOrigin } = await import('../src/features/organizations/team/delivery.ts');
const { hashInvitationToken } = await import('../src/features/organizations/team/token.ts');
const { invitationPreview, respondToInvitation, inviteTeamMember } = await import('../src/features/organizations/team/service.ts');
const { allowTeamRequest } = await import('../src/features/organizations/team/rate-limit.ts');

// No network requests can leave this test process, even if .env contains live keys.
const requests = [], logs = [];
let network = async () => new Response(JSON.stringify({ id: 'mock-message-id' }), { status: 200 });
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => { requests.push({ url, options }); return network(url, options); };
const realInfo = console.info, realWarn = console.warn, realError = console.error;
console.info = console.warn = console.error = (...values) => logs.push(values);
const originalEnv = { ...process.env };
Object.assign(process.env, { NODE_ENV: 'test', RESEND_API_KEY: 're_test_secret_not_real', EMAIL_FROM: 'Nexora <hello@sending.example.test>', EMAIL_REPLY_TO: 'support@example.test', PUBLIC_APP_URL: 'https://app.example.test' });
test.after(() => { globalThis.fetch = realFetch; console.info = realInfo; console.warn = realWarn; console.error = realError; for (const name of Object.keys(process.env)) if (!(name in originalEnv)) delete process.env[name]; Object.assign(process.env, originalEnv); });

function memoryDb(role = 'OWNER') {
  let sequence = 0;
  const rows = new Map(), rates = new Map(), memberships = [];
  const db = {
    rows, rates, memberships, actorRole: role,
    $transaction: async work => { const backup = structuredClone([...rows]); try { return await work(db); } catch (e) { rows.clear(); for (const [id,row] of backup) rows.set(id,row); throw e; } },
    $queryRaw: async (strings, ...values) => {
      const sql = strings.join('?');
      if (sql.includes('clock_timestamp')) return [{ now: new Date() }];
      if (sql.includes('INSERT INTO "RateLimit"')) { const key = values[1], now = Number(values[2]), cutoff = Number(values[3]); const prior = rates.get(key); const row = !prior || prior.time <= cutoff ? { count: 1, time: now } : { ...prior, count: prior.count + 1 }; rates.set(key, row); return [row]; }
      return [{ id: 'org' }];
    },
    organization: { findUnique: async () => ({ id: 'org' }) },
    user: { findUnique: async () => ({ email: 'recipient@example.test' }) },
    organizationMember: {
      findUnique: async ({ where }) => where.userId_organizationId.userId === 'actor' ? (db.actorRole ? { role: db.actorRole } : null) : memberships.find(m => m.userId === where.userId_organizationId.userId) ?? null,
      findFirst: async () => null,
      create: async ({ data }) => { memberships.push(data); return data; },
    },
    organizationInvitation: {
      findFirst: async ({ where }) => {
        if (where.organization && !['OWNER','ADMIN'].includes(db.actorRole)) return null;
        return [...rows.values()].find(row => Object.entries(where).every(([key,value]) => key === 'organization' || (key === 'expiresAt' ? row.expiresAt <= value.lte : row[key] === value))) ?? null;
      },
      findUnique: async ({ where }) => [...rows.values()].find(row => Object.entries(where).every(([key,value]) => row[key] === value)) ?? null,
      findUniqueOrThrow: async options => { const row = await db.organizationInvitation.findUnique(options); assert.ok(row); return row; },
      create: async ({ data }) => { const row = { id: 'inv-' + ++sequence, acceptedAt: null, declinedAt: null, revokedAt: null, emailSentAt: null, emailLastAttemptAt: null, emailSendAttempts: 0, emailFailureCategory: null, createdAt: new Date(), ...data, organization: { name: '<script>alert(1)</script> & Team', slug: 'team' }, invitedBy: { name: '<b>Owner</b>' } }; rows.set(row.id,row); return row; },
      update: async ({ where, data }) => { const row = rows.get(where.id); assert.ok(row); for (const [key,value] of Object.entries(data)) row[key] = value?.increment ? row[key] + value.increment : value; return row; },
      updateMany: async ({ where, data }) => { for (const row of rows.values()) if (row.organizationId === where.organizationId && row.email === where.email && !row.revokedAt && !row.acceptedAt && !row.declinedAt && row.expiresAt <= where.expiresAt.lte) Object.assign(row,data); },
    },
  };
  return db;
}
const input = { email: 'recipient@example.test', role: 'MEMBER' };
const token = 'a'.repeat(43), url = `https://app.example.test/invitations/${token}`;
const message = { to: input.email, subject: 'Invitation', html: '<p>Invite</p>', text: 'Invite', idempotencyKey: 'mock-key' };

test('invitation creation calls the official Resend SDK with correct recipient, subject, secure URL and text', async () => {
  const db = memoryDb(); const start = requests.length;
  const result = await createAndEmailInvitation(db, 'actor', 'team', input);
  assert.equal(result.delivery, 'sent'); assert.equal('link' in result, false);
  const request = requests[start], body = JSON.parse(request.options.body);
  assert.equal(request.url, 'https://api.resend.com/emails'); assert.deepEqual(body.to, [input.email]);
  assert.equal(body.subject, 'You’re invited to join <script>alert(1)</script> & Team on Nexora');
  assert.equal(body.from, process.env.EMAIL_FROM); assert.equal(body.reply_to, process.env.EMAIL_REPLY_TO);
  const emailedToken = body.text.match(/\/invitations\/([A-Za-z0-9_-]{43})/)[1];
  assert.ok(body.html.includes(`https://app.example.test/invitations/${emailedToken}`));
  const row = [...db.rows.values()][0]; assert.equal(row.tokenHash, hashInvitationToken(emailedToken));
  assert.equal(row.emailProviderMessageId, 'mock-message-id'); assert.ok(row.emailSentAt); assert.ok(row.emailLastAttemptAt); assert.equal(row.emailSendAttempts, 1);
  assert.ok(!JSON.stringify(row).includes(emailedToken)); assert.equal(invitationDeliveryState(row,new Date()),'Sent');
  assert.equal(new Headers(request.options.headers).get('Idempotency-Key'), `organization-invitation/${row.id}`);
});
test('HTML escapes every dynamic field, removes subject line breaks and provides readable plain text', () => {
  const template = organizationInvitationTemplate({ organizationName: '<img src=x onerror=alert(1)>\r\nInjected', inviterName: '<b>"Owner" & friend</b>', role: '<script>', expiresAt: new Date('2090-01-01'), invitationUrl: url });
  assert.ok(!template.html.includes('<img')); assert.ok(!template.html.includes('<script>')); assert.ok(!template.html.includes('<b>'));
  assert.ok(template.html.includes('&lt;img')); assert.ok(template.html.includes('&quot;Owner&quot; &amp; friend'));
  assert.ok(template.text.includes(url)); assert.ok(template.text.includes('2090-01-01 00:00 UTC')); assert.ok(template.text.includes('Do not forward'));
  assert.ok(!/[\r\n]/.test(template.subject)); assert.ok(!template.html.includes('<img'));
  assert.throws(() => organizationInvitationTemplate({ organizationName: 'Team', role: 'MEMBER', expiresAt: new Date(), invitationUrl: 'javascript:alert(1)' }));
});
for (const [status, category] of [[401,'authentication'],[403,'domain'],[429,'rate_limit'],[422,'recipient'],[500,'provider']]) {
  test(`provider ${status} becomes safe ${category} failure while preserving valid invitation`, async () => {
    network = async () => new Response(JSON.stringify({ message: `${input.email} ${process.env.RESEND_API_KEY} raw sensitive provider response` }), { status });
    const db = memoryDb(), result = await createAndEmailInvitation(db,'actor','team',input);
    assert.equal(result.ok,true); assert.equal(result.delivery,'failed'); assert.ok(result.link);
    const row = [...db.rows.values()][0]; assert.equal(row.emailFailureCategory,category); assert.equal(row.emailSentAt,null); assert.equal(row.revokedAt,null); assert.equal(row.emailSendAttempts,1);
    assert.equal((await invitationPreview(db,new URL(result.link).pathname.split('/').pop())).state,'active');
    assert.ok(!JSON.stringify(result).includes(input.email)); assert.ok(!JSON.stringify(result).includes(process.env.RESEND_API_KEY));
    network = async () => new Response(JSON.stringify({ id: 'mock-message-id' }));
  });
}
test('missing configuration is typed, does not contact provider and retains Copy Link', async () => {
  const key = process.env.RESEND_API_KEY; delete process.env.RESEND_API_KEY;
  try { const before = requests.length; assert.deepEqual(await sendTransactionalEmail(message),{ok:false,category:'configuration'}); const result = await createAndEmailInvitation(memoryDb(),'actor','team',input); assert.equal(result.delivery,'failed'); assert.ok(result.link); assert.equal(requests.length,before); } finally { process.env.RESEND_API_KEY=key; }
});
test('production requires explicit HTTPS PUBLIC_APP_URL and custom EMAIL_FROM, with no auth-origin fallback', () => {
  assert.equal(emailConfiguration({ RESEND_API_KEY:'test',EMAIL_FROM:'Nexora <onboarding@resend.dev>',NODE_ENV:'production' }),null);
  assert.equal(emailConfiguration({ RESEND_API_KEY:'test',EMAIL_FROM:'Nexora\r\n<hi@domain.com>' }),null);
  assert.equal(emailConfiguration({ RESEND_API_KEY:'test',EMAIL_FROM:'hi@domain.com',EMAIL_REPLY_TO:'invalid' }),null);
  const nodeEnv=process.env.NODE_ENV, origin=process.env.PUBLIC_APP_URL;
  try { process.env.NODE_ENV='production'; for(const value of ['', 'http://localhost:3000','https://user:pass@app.test','https://app.test/path']) { process.env.PUBLIC_APP_URL=value; assert.throws(invitationEmailOrigin); } process.env.PUBLIC_APP_URL='https://app.example.test'; assert.equal(invitationEmailOrigin(),process.env.PUBLIC_APP_URL); } finally { process.env.NODE_ENV=nodeEnv; process.env.PUBLIC_APP_URL=origin; }
});
test('timeout aborts transport and returns promptly even when the mocked provider ignores abort', async () => {
  network = async () => new Promise(() => {});
  const start=Date.now(); const result=await sendTransactionalEmail(message,20);
  assert.deepEqual(result,{ok:false,category:'timeout'}); assert.ok(Date.now()-start<1000); assert.ok(requests.at(-1).options.signal.aborted);
  network = async () => { throw new Error('Sensitive network error'); };
  assert.deepEqual(await sendTransactionalEmail(message),{ok:false,category:'provider'});
  network = async () => new Response(JSON.stringify({id:'mock-message-id'}));
});
test('unauthorized sending/reissue and ADMIN escalation are blocked without provider calls', async () => {
  const db=memoryDb(); const issued=await inviteTeamMember(db,'actor','team',input); db.rows.get(issued.id).createdAt=new Date(0);
  const before=requests.length;
  await assert.rejects(()=>createAndEmailInvitation(db,'actor','team',input,''),/unavailable/);
  for(const role of [null,'MEMBER','EDITOR']) { db.actorRole=role; await assert.rejects(()=>createAndEmailInvitation(db,'actor','team',input,issued.id)); await assert.rejects(()=>deliverIssuedInvitation(db,'actor','team',issued,'https://app.example.test')); }
  db.actorRole='ADMIN'; db.rows.get(issued.id).role='ADMIN'; await assert.rejects(()=>createAndEmailInvitation(db,'actor','team',input,issued.id));
  assert.equal(requests.length,before); assert.equal(db.rows.get(issued.id).revokedAt,null);
});
for(const state of ['expired','revoked','accepted','declined']) test(`${state} invitation cannot send or reissue`,async()=>{
  const db=memoryDb(), issued=await inviteTeamMember(db,'actor','team',input), row=db.rows.get(issued.id); row.createdAt=new Date(0);
  if(state==='expired') row.expiresAt=new Date(0); else row[state+'At']=new Date();
  const before=requests.length; await assert.rejects(()=>deliverIssuedInvitation(db,'actor','team',issued,'https://app.example.test')); await assert.rejects(()=>createAndEmailInvitation(db,'actor','team',input,issued.id)); assert.equal(requests.length,before);
});
test('reissue permanently revokes old token, resets expiry and emails a new valid token that can accept',async()=>{
  const db=memoryDb(), old=await inviteTeamMember(db,'actor','team',input); const prior=db.rows.get(old.id); prior.createdAt=new Date(0); prior.expiresAt=new Date(Date.now()+100000);
  const result=await createAndEmailInvitation(db,'actor','team',{email:'attacker@example.test',role:'ADMIN'},old.id);
  assert.equal(result.delivery,'sent'); const body=JSON.parse(requests.at(-1).options.body), token=body.text.match(/\/invitations\/([A-Za-z0-9_-]{43})/)[1]; assert.notEqual(token,old.token); assert.deepEqual(body.to,[input.email]);
  assert.equal((await invitationPreview(db,old.token)).state,'revoked'); assert.equal((await invitationPreview(db,token)).state,'active');
  const current=[...db.rows.values()].find(x=>x.tokenHash===hashInvitationToken(token)); assert.ok(current.expiresAt>prior.expiresAt); assert.equal(current.role,'MEMBER');
  await assert.rejects(()=>respondToInvitation(db,'recipient',old.token,'accept'),/revoked/); assert.equal((await respondToInvitation(db,'recipient',token,'accept')).state,'accepted'); assert.equal(db.memberships.length,1);
});
test('reissue cooldown and duplicate-send claim block button abuse',async()=>{
  const db=memoryDb(), issued=await inviteTeamMember(db,'actor','team',input);
  await assert.rejects(()=>createAndEmailInvitation(db,'actor','team',input,issued.id),/one minute/); assert.equal(db.rows.get(issued.id).revokedAt,null);
  await deliverIssuedInvitation(db,'actor','team',issued,'https://app.example.test'); await assert.rejects(()=>deliverIssuedInvitation(db,'actor','team',issued,'https://app.example.test'));
});
test('shared actor, organization and recipient limits apply; rate-denied reissue rolls back revocation',async()=>{
  for(const [kind,max] of [['invite',30],['email-org',60],['email-recipient',5]]) { const db=memoryDb(); for(let i=0;i<max;i++) assert.equal(await allowTeamRequest(db,'identity',kind),true); assert.equal(await allowTeamRequest(db,'identity',kind),false); }
  const db=memoryDb(); for(let i=0;i<30;i++) await allowTeamRequest(db,'actor','invite'); await assert.rejects(()=>createAndEmailInvitation(db,'actor','team',input),/Too many/); assert.equal(db.rows.size,0);
  const db2=memoryDb(), issued=await inviteTeamMember(db2,'actor','team',input); db2.rows.get(issued.id).createdAt=new Date(0);
  for(let i=0;i<5;i++) await allowTeamRequest(db2,JSON.stringify(['org',input.email]),'email-recipient');
  await assert.rejects(()=>createAndEmailInvitation(db2,'actor','team',input,issued.id),/Too many/); assert.equal(db2.rows.get(issued.id).revokedAt,null);
});
test('metadata failure returns safe uncertainty with Copy Link and no automatic resend',async()=>{
  const db=memoryDb(); const update=db.organizationInvitation.update;
  db.organizationInvitation.update=async options=>{if(options.data.emailSentAt)throw new Error('DB unavailable');return update(options);};
  const before=requests.length,result=await createAndEmailInvitation(db,'actor','team',input); assert.equal(result.delivery,'unknown'); assert.ok(result.link); assert.equal(requests.length,before+1); assert.equal(db.rows.size,1);
});
test('public preview omits recipient and provider metadata; logs contain no keys, token, body, recipient',async()=>{
  const db=memoryDb(),issued=await inviteTeamMember(db,'actor','team',input); await deliverIssuedInvitation(db,'actor','team',issued,'https://app.example.test');
  assert.deepEqual(Object.keys(await invitationPreview(db,issued.token)).sort(),['expiresAt','name','role','state']);
  const serialized=JSON.stringify(logs); for(const secret of [process.env.RESEND_API_KEY,input.email,issued.token,'<script>','raw sensitive']) assert.ok(!serialized.includes(secret));
  const actions=readFileSync('src/features/organizations/team/actions.ts','utf8'); assert.ok(actions.includes('getCurrentUser()')); assert.ok(!actions.includes('resend.emails'));
  const page=readFileSync('src/app/(protected)/organizer/[organizationSlug]/team/page.tsx','utf8'); assert.ok(page.includes('allowedTeamRoles(membership.role).length ?')); assert.ok(!page.includes('emailProviderMessageId'));
});
