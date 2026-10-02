import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
const { PrismaClient } = await import('../src/generated/prisma/client.ts');
nextEnv.loadEnvConfig(process.cwd());
const origin = process.env.APP_URL;
assert.ok(origin && process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Use the local application for runtime testing.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }), log: [] });
const run = randomUUID();
const userIds = [];
const orgIds = [];
const eventSlugs = [];
const results = [];
function pass(message) { results.push(message); console.log(`PASS ${message}`); }
async function request(path, cookie = '', options = {}) {
  return fetch(`${origin}${path}`, { redirect: 'manual', ...options, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...options.headers } });
}
async function signup(label) {
  const response = await request('/api/auth/sign-up/email', '', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `Step09 ${label}`, email: `step09-${run}-${label}@example.com`, password: randomUUID() }) });
  assert.equal(response.status, 200, 'Fixture signup failed.');
  const { user } = await response.json(); userIds.push(user.id);
  return { id: user.id, cookie: response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ') };
}
function decode(value) { return value.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
async function submit(path, cookie, values, html) {
  html ??= await (await request(path, cookie)).text();
  const form = new FormData();
  for (const match of html.matchAll(/<input\b[^>]*>/g)) {
    const name = match[0].match(/\bname="([^"]*)"/)?.[1];
    if (name?.startsWith('$ACTION')) form.append(decode(name), decode(match[0].match(/\bvalue="([^"]*)"/)?.[1] ?? ''));
  }
  assert.ok([...form.keys()].length, 'Server Action fields missing.');
  for (const [key, value] of Object.entries(values)) form.append(key, String(value));
  return request(path, cookie, { method: 'POST', body: form });
}
async function denied(response, label) {
  const html = await response.text();
  assert.ok(response.status === 404 || html.includes('unavailable'), label);
}
function freshSlug(label) { const slug = `s09-${run}-${label}`; eventSlugs.push(slug); return slug; }
const base = { title: 'Step09 Gathering', description: 'A real isolated event for testing management.', shortDescription: 'A test gathering.', category: 'Community', eventType: 'IN_PERSON', startDate: '2030-06-20', startTime: '10:00', endDate: '2030-06-20', endTime: '12:00', timezone: 'Asia/Yangon', locationName: 'Test hall', city: 'Yangon', region: 'Yangon', onlineUrl: '', capacity: '25', registrationDeadline: '2030-06-20T09:00', intent: 'draft' };
try {
  const anonymous = await request('/create-event');
  assert.equal(anonymous.status, 307); assert.equal(anonymous.headers.get('location'), '/sign-in');
  pass('unauthenticated create-event redirects to sign-in');
  const actor = await signup('actor'); const outsider = await signup('outsider');
  const org = await db.organization.create({ data: { slug: `s09-org-${run}`, name: 'Step09 Test Organization', members: { create: { userId: actor.id, role: 'MEMBER' } } } }); orgIds.push(org.id);
  const otherOrg = await db.organization.create({ data: { slug: `s09-other-${run}`, name: 'Step09 Other Organization', members: { create: { userId: outsider.id, role: 'OWNER' } } } }); orgIds.push(otherOrg.id);
  const formHtml = await (await request('/create-event', actor.cookie)).text();
  const slug = freshSlug('organization');
  const fields = { ...base, slug, organizationId: org.id, creatorId: outsider.id, status: 'PUBLISHED', role: 'OWNER' };
  await denied(await submit('/create-event', actor.cookie, fields, formHtml), 'MEMBER must not create organization event');
  assert.equal(await db.event.count({ where: { slug } }), 0);
  pass('MEMBER organization creation denied despite forged role');
  await db.organizationMember.update({ where: { userId_organizationId: { userId: actor.id, organizationId: org.id } }, data: { role: 'EDITOR' } });
  const created = await submit('/create-event', actor.cookie, fields, formHtml);
  assert.equal(created.status, 303);
  let event = await db.event.findUniqueOrThrow({ where: { slug } });
  assert.equal(event.creatorId, actor.id); assert.equal(event.organizationId, org.id); assert.equal(event.status, 'DRAFT');
  assert.equal(event.startAt.toISOString(), '2030-06-20T03:30:00.000Z'); assert.equal(event.endAt.toISOString(), '2030-06-20T05:30:00.000Z'); assert.equal(event.timezone, 'Asia/Yangon');
  assert.equal(event.registrationDeadline.toISOString(), '2030-06-20T02:30:00.000Z'); assert.equal(event.capacity, 25);
  pass('EDITOR creates Neon draft; session creator, organization, status, UTC times and timezone verified');
  await denied(await submit('/create-event', actor.cookie, { ...fields, slug: freshSlug('forged-org'), organizationId: otherOrg.id }, formHtml), 'Forged unrelated organization denied');
  pass('forged unrelated organizationId denied');
  const duplicate = await submit('/create-event', actor.cookie, fields, formHtml);
  assert.ok((await duplicate.text()).includes('That event URL is already in use.'));
  assert.equal(await db.event.count({ where: { slug } }), 1);
  pass('duplicate event slug gives friendly error and no duplicate row');
  for (const invalid of [{ endTime: '09:00' }, { timezone: '' }, { slug: 'Invalid Slug' }, { capacity: '0' }, { registrationDeadline: '2030-06-20T10:01' }, { eventType: 'ONLINE', onlineUrl: 'javascript:alert(1)' }]) {
    const invalidSlug = invalid.slug ?? freshSlug(`invalid-${eventSlugs.length}`);
    const response = await submit('/create-event', actor.cookie, { ...fields, ...invalid, slug: invalidSlug }, formHtml);
    assert.ok((await response.text()).includes('Please check the highlighted fields.'));
    assert.equal(await db.event.count({ where: { slug: invalidSlug } }), 0);
  }
  pass('invalid dates, timezone, slug, capacity, deadline, and unsafe online URL rejected');
  const path = `/organizer/${org.slug}/events/${event.id}`;
  assert.equal(created.headers.get('location'), path);
  const list = await request(`/organizer/${org.slug}/events`, actor.cookie);
  assert.ok((await list.text()).includes('Step09 Gathering'));
  assert.equal((await request(path, actor.cookie)).status, 200);
  pass('real organization event listing and scoped management page');
  const draftHtml = await (await request(path, actor.cookie)).text();
  const editHtml = await (await request(`${path}/edit`, actor.cookie)).text();
  await denied(await request(path, outsider.cookie), 'Unrelated read denied');
  await denied(await request(`${path}/edit`, outsider.cookie), 'Unrelated edit page denied');
  await denied(await submit(`${path}/edit`, outsider.cookie, { ...fields, version: event.updatedAt.toISOString() }, editHtml), 'Replayed edit denied');
  await denied(await request(`/organizer/${otherOrg.slug}/events/${event.id}`, outsider.cookie), 'Cross-organization event route denied');
  pass('unrelated user and mismatched organization scope cannot view or edit');
  const edited = await submit(`${path}/edit`, actor.cookie, { ...fields, title: 'Step09 Updated Gathering', organizationId: otherOrg.id, status: 'CANCELLED', version: event.updatedAt.toISOString() }, editHtml);
  assert.equal(edited.status, 303);
  event = await db.event.findUniqueOrThrow({ where: { id: event.id } });
  assert.equal(event.title, 'Step09 Updated Gathering'); assert.equal(event.status, 'DRAFT'); assert.equal(event.organizationId, org.id); assert.equal(event.creatorId, actor.id);
  const staleEdit = await submit(`${path}/edit`, actor.cookie, { ...fields, version: '2000-01-01T00:00:00.000Z' }, editHtml);
  assert.ok((await staleEdit.text()).includes('changed while you were editing'));
  pass('draft edit persists; forged ownership/status ignored; stale edit blocked');
  const invalidSlug = freshSlug('invalid-draft');
  const invalidDraft = await db.event.create({ data: { slug: invalidSlug, title: 'Legacy incomplete draft', description: null, category: null, startAt: new Date('2030-06-20T03:30:00Z'), endAt: new Date('2030-06-20T05:30:00Z'), timezone: 'Asia/Yangon', eventType: 'IN_PERSON', creatorId: actor.id, organizationId: org.id } });
  const invalidPath = `/organizer/${org.slug}/events/${invalidDraft.id}`;
  const invalidPublish = await submit(invalidPath, actor.cookie, { confirm: 'yes' });
  assert.ok((await invalidPublish.text()).includes('not ready to publish'));
  assert.equal((await db.event.findUniqueOrThrow({ where: { id: invalidDraft.id } })).status, 'DRAFT');
  pass('invalid legacy draft cannot publish');
  const unconfirmed = await submit(path, actor.cookie, {}, draftHtml);
  assert.ok((await unconfirmed.text()).includes('Confirm that you want to publish'));
  const published = await submit(path, actor.cookie, { confirm: 'yes', status: 'ARCHIVED' }, draftHtml);
  assert.equal(published.status, 303); event = await db.event.findUniqueOrThrow({ where: { id: event.id } }); assert.equal(event.status, 'PUBLISHED');
  pass('confirmation required; DRAFT to PUBLISHED enforced');
  const publishedEdit = await submit(`${path}/edit`, actor.cookie, { ...fields, title: 'Step09 Published Edit', version: event.updatedAt.toISOString() });
  assert.equal(publishedEdit.status, 303);
  event = await db.event.findUniqueOrThrow({ where: { id: event.id } }); assert.equal(event.status, 'PUBLISHED');
  pass('published core edit preserves status and validation');
  const publishedHtml = await (await request(path, actor.cookie)).text();
  await db.organizationMember.update({ where: { userId_organizationId: { userId: actor.id, organizationId: org.id } }, data: { role: 'MEMBER' } });
  assert.equal((await request(path, actor.cookie)).status, 200);
  await denied(await request(`${path}/edit`, actor.cookie), 'MEMBER edit denied');
  await denied(await submit(path, actor.cookie, { confirm: 'yes' }, publishedHtml), 'MEMBER cancel action denied');
  await denied(await submit(path, actor.cookie, { confirm: 'yes' }, draftHtml), 'MEMBER publish replay denied');
  assert.equal((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status, 'PUBLISHED');
  pass('MEMBER has read-only access and cannot edit, publish, or cancel');
  await db.organizationMember.update({ where: { userId_organizationId: { userId: actor.id, organizationId: org.id } }, data: { role: 'ADMIN' } });
  const noCancelConfirmation = await submit(path, actor.cookie, {}, publishedHtml);
  assert.ok((await noCancelConfirmation.text()).includes('Confirm that you want to cancel'));
  const cancelled = await submit(path, actor.cookie, { confirm: 'yes' }, publishedHtml);
  assert.equal(cancelled.status, 303); assert.equal((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status, 'CANCELLED');
  pass('ADMIN cancellation requires confirmation; PUBLISHED to CANCELLED enforced');
  const restoreAttempt = await submit(path, actor.cookie, { confirm: 'yes' }, draftHtml);
  assert.ok((await restoreAttempt.text()).includes('Only draft events can be published'));
  const cancelledEdit = await submit(`${path}/edit`, actor.cookie, { ...fields, version: event.updatedAt.toISOString() }, editHtml);
  assert.ok((await cancelledEdit.text()).includes('read-only'));
  assert.equal((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status, 'CANCELLED');
  pass('CANCELLED cannot republish or edit, including replayed actions');
  const personalSlug = freshSlug('individual');
  const personal = await submit('/create-event', actor.cookie, { ...base, slug: personalSlug, organizationId: '', eventType: 'ONLINE', onlineUrl: 'https://example.com/join', creatorId: outsider.id, intent: 'publish' }, formHtml);
  assert.equal(personal.status, 303);
  const individual = await db.event.findUniqueOrThrow({ where: { slug: personalSlug } });
  assert.equal(individual.organizationId, null); assert.equal(individual.creatorId, actor.id); assert.equal(individual.status, 'PUBLISHED'); assert.equal(individual.locationName, null);
  const personalPath = `/dashboard/events/${individual.id}`;
  assert.equal(personal.headers.get('location'), personalPath);
  assert.ok((await (await request('/dashboard/events', actor.cookie)).text()).includes('Step09 Gathering'));
  await denied(await request(personalPath, outsider.cookie), 'Other user cannot manage personal event');
  const personalEditHtml = await (await request(`${personalPath}/edit`, actor.cookie)).text();
  await denied(await submit(`${personalPath}/edit`, outsider.cookie, { ...base, slug: personalSlug, version: individual.updatedAt.toISOString() }, personalEditHtml), 'Personal edit replay denied');
  await denied(await request(`/dashboard/events/${event.id}`, actor.cookie), 'Org event cannot appear as personal');
  pass('individual creation/direct publish and strict creator-only management');
  await db.organizationMember.update({ where: { userId_organizationId: { userId: actor.id, organizationId: org.id } }, data: { role: 'OWNER' } });
  const ownerSlug = freshSlug('owner');
  assert.equal((await submit('/create-event', actor.cookie, { ...base, slug: ownerSlug, organizationId: org.id }, formHtml)).status, 303);
  pass('OWNER also has event creation permission');
  const noAuth = await submit('/create-event', '', { ...base, slug: freshSlug('anonymous'), organizationId: '' }, formHtml);
  assert.equal(noAuth.status, 303); assert.equal(noAuth.headers.get('location'), '/sign-in');
  pass('anonymous direct create action denied');
  const publicPage = await request(`/events/${personalSlug}`); assert.equal(publicPage.status, 200);
  assert.equal((await request('/explore')).status, 200);
  pass('published individual event is publicly accessible and Explore remains available');
} finally {
  await db.event.deleteMany({ where: { slug: { in: eventSlugs } } });
  await db.organization.deleteMany({ where: { id: { in: orgIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  assert.equal(await db.event.count({ where: { slug: { in: eventSlugs } } }), 0);
  await db.$disconnect();
  console.log(`Removed isolated Neon fixtures. ${results.length} scenarios passed.`);
}
