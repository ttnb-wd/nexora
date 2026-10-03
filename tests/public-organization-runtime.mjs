import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
const { PrismaClient } = await import('../src/generated/prisma/client.ts');
nextEnv.loadEnvConfig(process.cwd());
const origin = process.env.STEP11_ORIGIN ?? process.env.APP_URL;
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
const orgSlugs = [];
try {
  const existing = await db.organization.findFirst({ select: { slug: true, name: true }, orderBy: { slug: 'asc' } });
  assert.ok(existing, 'An existing real organization is required.');
  assert.ok((await (await request('/companies')).text()).includes(`/companies/${existing.slug}`));
  assert.equal((await request(`/companies/${existing.slug}`)).status, 200);
  pass(`existing Neon organization ${existing.slug} appears in directory and profile`);
  const signup = await request('/api/auth/sign-up/email', '', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Step11 Individual Organizer', email: `step11-${run}@example.com`, password: randomUUID() }) });
  assert.equal(signup.status, 200);
  userId = (await signup.json()).user.id;
  const cookie = signup.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  const orgSlug = `s11-${run}`; orgSlugs.push(orgSlug);
  const org = await db.organization.create({ data: { slug: orgSlug, name: 'Step11 Real Organization with a Longer Public Name', description: 'Real Neon organization description for discovery, profile, and organizer identity verification.', industry: 'Research & Education', city: 'Mandalay', region: 'Myanmar', website: 'https://example.com', members: { create: { userId, role: 'OWNER' } } } });
  orgId = org.id;
  const eventBase = { description: 'Real test event.', category: 'Community', startAt: new Date('2030-06-20T03:30:00Z'), endAt: new Date('2030-06-20T05:30:00Z'), timezone: 'Asia/Yangon', eventType: 'ONLINE', creatorId: userId, organizationId: orgId };
  for (const [label, status, past] of [['upcoming', 'PUBLISHED', false], ['past', 'PUBLISHED', true], ['completed', 'COMPLETED', true], ['draft', 'DRAFT', false], ['cancelled', 'CANCELLED', false], ['archived', 'ARCHIVED', true], ['individual', 'PUBLISHED', false]]) {
    const slug = `s11-${run}-${label}`; slugs.push(slug);
    await db.event.create({ data: { ...eventBase, slug, title: `Step11 ${label} gathering`, status, ...(past ? { startAt: new Date('2020-01-01'), endAt: new Date('2020-01-02') } : {}), ...(label === 'individual' ? { organizationId: null } : {}) } });
  }
  const html = await (await request(`/companies/${orgSlug}`)).text();
  for (const label of ['upcoming', 'past', 'completed']) assert.ok(html.includes(`/events/s11-${run}-${label}`));
  for (const label of ['draft', 'cancelled', 'archived', 'individual']) assert.ok(!html.includes(`/events/s11-${run}-${label}`));
  assert.ok(!html.includes('Fictional team') && !html.includes('id="topics"') && !html.includes('id="team"'));
  assert.ok(html.includes('https://example.com') && html.includes('Research &amp; Education'));
  pass('profile identity, website, upcoming/past/completed visibility, hidden forbidden statuses and missing sections');
  const detail = await (await request(`/events/s11-${run}-upcoming`)).text();
  assert.ok(detail.includes(`/companies/${orgSlug}`) && detail.includes(org.description));
  const individual = await (await request(`/events/s11-${run}-individual`)).text();
  // Related event cards can legitimately link to this organization; inspect the actual organizer section.
  const individualOrganizer = individual.match(/<section\b[^>]*\bid="organizer"[^>]*>[\s\S]*?<\/section>/)?.[0];
  assert.ok(individualOrganizer?.includes('Step11 Individual Organizer') && !individualOrganizer.includes(`/companies/${orgSlug}`));
  for (const page of [html, detail, individual, await (await request('/companies')).text()]) {
    for (const secret of [userId, orgId, `step11-${run}@example.com`, '"members"', '"creatorId"', '"userId"', '"accounts"']) assert.ok(!page.includes(secret), `Private field leaked: ${secret}`);
  }
  pass('event/profile reciprocal links and individual display-name-only privacy');
  const companies = await (await request('/companies')).text();
  assert.match(companies, /1(?:<!-- -->)? upcoming/);
  assert.ok(companies.indexOf(org.name) < companies.indexOf('id="discover-organizations-title"'));
  pass('trending selected from real activity and spotlight links to next event');
  assert.equal((await request(`/companies/unknown-${run}`)).status, 404);
  const update = await submit(`/organizer/${orgSlug}/settings`, cookie, { name: 'Step11 Updated Organization', shortName: 'S11', description: 'Settings edit is immediately public.', industry: 'Research & Education', city: 'Yangon', region: 'Myanmar', website: 'https://example.com' });
  assert.equal(update.status, 303);
  for (const path of ['/companies', `/companies/${orgSlug}`, `/events/s11-${run}-upcoming`, '/', '/explore']) assert.ok((await (await request(path)).text()).includes('Step11 Updated Organization'), `Stale identity: ${path}`);
  pass('authorized settings edit refreshes directory, profile, event detail, homepage, and Explore without restart');
  if (process.env.STEP11_BROWSER_HOLD === '1') {
    console.log(`BROWSER_READY ${origin}/companies/${orgSlug}`);
    await new Promise((resolve) => process.stdin.once('data', resolve));
  }
} finally {
  await db.event.deleteMany({ where: { slug: { in: slugs } } });
  await db.organization.deleteMany({ where: { slug: { in: orgSlugs } } });
  if (userId) await db.user.delete({ where: { id: userId } });
  assert.equal(await db.event.count({ where: { slug: { in: slugs } } }), 0);
  assert.equal(await db.organization.count({ where: { slug: { in: orgSlugs } } }), 0);
  await db.$disconnect();
  console.log('Removed isolated Step11 fixtures; existing organization unchanged.');
}
