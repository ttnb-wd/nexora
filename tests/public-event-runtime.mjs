import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
const { PrismaClient } = await import('../src/generated/prisma/client.ts');
nextEnv.loadEnvConfig(process.cwd());
const origin = process.env.STEP10_ORIGIN ?? process.env.APP_URL;
assert.ok(origin && process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }), log: [] });
const run = randomUUID();
const slugs = [];
let userId, orgId;
function pass(label) { console.log(`PASS ${label}`); }
async function request(path, cookie = '', options = {}) {
  return fetch(`${origin}${path}`, { redirect: 'manual', ...options, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...options.headers } });
}
function decode(value) { return value.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
async function submit(path, cookie, values, html) {
  html ??= await (await request(path, cookie)).text();
  const form = new FormData();
  for (const match of html.matchAll(/<input\b[^>]*>/g)) {
    const name = match[0].match(/\bname="([^"]*)"/)?.[1];
    if (name?.startsWith('$ACTION')) form.append(decode(name), decode(match[0].match(/\bvalue="([^"]*)"/)?.[1] ?? ''));
  }
  assert.ok([...form.keys()].length, `No server action in ${path}`);
  for (const [key, value] of Object.entries(values)) form.append(key, String(value));
  return request(path, cookie, { method: 'POST', body: form });
}
function fresh(label) { const slug = `s10-${run}-${label}`; slugs.push(slug); return slug; }
const base = { title: 'Step10 Public Gathering', description: 'A real Neon event for public discovery testing.', shortDescription: 'Real public event test.', category: 'Community', eventType: 'IN_PERSON', startDate: '2030-06-20', startTime: '10:00', endDate: '2030-06-20', endTime: '12:00', timezone: 'Asia/Yangon', locationName: 'Test Hall', city: 'Yangon', region: 'Yangon', onlineUrl: '', capacity: '25', registrationDeadline: '2030-06-20T09:00', intent: 'draft' };
try {
  const signup = await request('/api/auth/sign-up/email', '', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Step10 Test Organizer', email: `step10-${run}@example.com`, password: randomUUID() }) });
  assert.equal(signup.status, 200);
  userId = (await signup.json()).user.id;
  const cookie = signup.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  const org = await db.organization.create({ data: { slug: `s10-org-${run}`, name: 'Step10 Test Organization', industry: 'Community', city: 'Yangon', members: { create: { userId, role: 'OWNER' } } } });
  orgId = org.id;
  const formHtml = await (await request('/create-event', cookie)).text();
  const orgSlug = fresh('organization');
  const individualSlug = fresh('individual');
  const draftSlug = fresh('draft');
  assert.equal((await submit('/create-event', cookie, { ...base, slug: orgSlug, organizationId: org.id }, formHtml)).status, 303);
  assert.equal((await submit('/create-event', cookie, { ...base, slug: individualSlug, organizationId: '', eventType: 'ONLINE', onlineUrl: 'https://example.com/meet', intent: 'publish' }, formHtml)).status, 303);
  assert.equal((await submit('/create-event', cookie, { ...base, slug: draftSlug, organizationId: '' }, formHtml)).status, 303);
  let orgEvent = await db.event.findUniqueOrThrow({ where: { slug: orgSlug } });
  const orgPath = `/organizer/${org.slug}/events/${orgEvent.id}`;
  assert.equal((await submit(orgPath, cookie, { confirm: 'yes' })).status, 303);
  orgEvent = await db.event.findUniqueOrThrow({ where: { slug: orgSlug } });
  assert.equal(orgEvent.status, 'PUBLISHED');
  pass('organization and individual events created via normal event forms and published');
  const explore = await (await request('/explore')).text();
  const home = await (await request('/')).text();
  const detail = await request(`/events/${orgSlug}`);
  const detailHtml = await detail.text();
  const individualHtml = await (await request(`/events/${individualSlug}`)).text();
  assert.ok(explore.includes(orgSlug) && explore.includes(individualSlug) && !explore.includes(draftSlug));
  assert.ok(home.includes(orgSlug) && home.includes(individualSlug) && !home.includes(draftSlug));
  assert.equal(detail.status, 200);
  assert.ok(detailHtml.includes('Step10 Test Organization') && individualHtml.includes('Step10 Test Organizer'));
  assert.ok(!detailHtml.includes(`step10-${run}@example.com`) && !individualHtml.includes(`step10-${run}@example.com`));
  assert.ok(!detailHtml.includes(userId) && !individualHtml.includes(userId) && !detailHtml.includes(orgId));
  assert.ok(!detailHtml.includes('Illustrative speaker profiles') && !detailHtml.includes('Welcome to the studio'));
  assert.ok(detailHtml.includes(individualSlug) && !detailHtml.includes(draftSlug));
  pass('Explore, homepage, detail, organizer identity, draft invisibility, and privacy');
  assert.equal((await request(`/events/${draftSlug}`)).status, 404);
  assert.equal((await request(`/events/${draftSlug}?status=PUBLISHED&preview=true`)).status, 404);
  assert.equal((await request('/events/unknown-step10-slug')).status, 404);
  pass('draft and unknown slugs return 404');
  const editHtml = await (await request(`${orgPath}/edit`, cookie)).text();
  assert.equal((await submit(`${orgPath}/edit`, cookie, { ...base, slug: orgSlug, organizationId: org.id, title: 'Step10 Updated Gathering', version: orgEvent.updatedAt.toISOString() }, editHtml)).status, 303);
  assert.ok((await (await request(`/events/${orgSlug}`)).text()).includes('Step10 Updated Gathering'));
  assert.ok((await (await request('/explore')).text()).includes('Step10 Updated Gathering'));
  pass('published edit immediately reflected publicly');
  if (process.env.STEP10_BROWSER_HOLD === '1') {
    console.log(`BROWSER_READY ${origin}/events/${orgSlug}`);
    await new Promise((resolve) => process.stdin.once('data', resolve));
  }
  const publishedHtml = await (await request(orgPath, cookie)).text();
  assert.equal((await submit(orgPath, cookie, { confirm: 'yes' }, publishedHtml)).status, 303);
  const afterCancel = await (await request('/explore')).text();
  assert.ok(!afterCancel.includes(orgSlug) && afterCancel.includes(individualSlug));
  assert.equal((await request(`/events/${orgSlug}`)).status, 404);
  const individualDetail = await (await request(`/events/${individualSlug}`)).text();
  assert.ok(!individualDetail.includes(orgSlug));
  pass('cancelled event removed, cancelled detail 404, related events exclude draft/cancelled');
  assert.equal((await request(`/events/${orgSlug}?status=PUBLISHED&preview=true`)).status, 404);
  const archivedSlug = fresh('archived');
  const completedSlug = fresh('completed');
  const pastSlug = fresh('past');
  for (const [slug, status] of [[archivedSlug, 'ARCHIVED'], [completedSlug, 'COMPLETED'], [pastSlug, 'PUBLISHED']]) {
    await db.event.create({ data: { slug, title: `Step10 ${status} past gathering`, description: 'An isolated past-event visibility test.', category: 'Community', startAt: new Date('2020-06-20T03:30:00Z'), endAt: new Date('2020-06-20T05:30:00Z'), timezone: 'Asia/Yangon', eventType: 'ONLINE', status, creatorId: userId } });
  }
  assert.equal((await request(`/events/${archivedSlug}`)).status, 404);
  assert.equal((await request(`/events/${completedSlug}`)).status, 200);
  assert.equal((await request(`/events/${pastSlug}`)).status, 200);
  const upcoming = await (await request('/explore')).text();
  assert.ok(!upcoming.includes(archivedSlug) && !upcoming.includes(completedSlug) && !upcoming.includes(pastSlug));
  pass('archived hidden; completed and past published detail accessible without dominating discovery');
} finally {
  await db.event.deleteMany({ where: { slug: { in: slugs } } });
  if (orgId) await db.organization.delete({ where: { id: orgId } });
  if (userId) await db.user.delete({ where: { id: userId } });
  assert.equal(await db.event.count({ where: { slug: { in: slugs } } }), 0);
  await db.$disconnect();
  console.log('Removed isolated Step10 Neon fixtures.');
}
