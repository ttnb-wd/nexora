import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
const { PrismaClient } = await import('../src/generated/prisma/client.ts');

nextEnv.loadEnvConfig(process.cwd());
const origin = process.env.APP_URL;
assert.ok(origin && process.env.DATABASE_URL, 'Configure APP_URL and DATABASE_URL.');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Run runtime tests against the local application only.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }), log: [] });
const run = randomUUID();
const slug = `step08-test-${run}`;
const userIds = [];
const organizationIds = [];
const results = [];
const check = (message) => { results.push(message); console.log(`PASS ${message}`); };

async function request(path, cookie = '', options = {}) {
  return fetch(`${origin}${path}`, { redirect: 'manual', ...options, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...options.headers } });
}
async function signup(label) {
  const response = await request('/api/auth/sign-up/email', '', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `Step08 Test ${label}`, email: `step08-${run}-${label}@example.com`, password: randomUUID() }) });
  assert.equal(response.status, 200, `Test account ${label} signup failed.`);
  const body = await response.json();
  userIds.push(body.user.id);
  const cookie = response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  assert.ok(cookie);
  return { id: body.user.id, cookie };
}
function decodeAttribute(value) {
  return value.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
async function submit(path, cookie, fields, actionHtml) {
  const html = actionHtml ?? await (await request(path, cookie)).text();
  const form = new FormData();
  for (const input of html.matchAll(/<input\b[^>]*>/g)) {
    const name = input[0].match(/\bname="([^"]*)"/)?.[1];
    if (name?.startsWith('$ACTION')) form.append(decodeAttribute(name), decodeAttribute(input[0].match(/\bvalue="([^"]*)"/)?.[1] ?? ''));
  }
  assert.ok([...form.keys()].length, 'Server Action fields missing.');
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return request(path, cookie, { method: 'POST', body: form });
}
try {
  const anonymous = await request('/organizer');
  assert.equal(anonymous.status, 307); assert.equal(anonymous.headers.get('location'), '/sign-in');
  check('anonymous organizer redirects to sign-in');
  const owner = await signup('owner');
  const other = await signup('other');
  const empty = await request('/organizer', owner.cookie);
  assert.equal(empty.status, 200); assert.match(await empty.text(), /Create your first organization/);
  check('authenticated empty organizer dashboard');
  const fields = { name: 'Step08 Isolated Organization', slug, industry: 'Community', city: 'Yangon', region: 'Yangon', website: 'https://example.com', role: 'ADMIN', userId: other.id, ownerId: other.id };
  const createHtml = await (await request('/organizer/create', owner.cookie)).text();
  const noAuthCreate = await submit('/organizer/create', '', fields, createHtml);
  assert.equal(noAuthCreate.status, 303); assert.equal(noAuthCreate.headers.get('location'), '/sign-in');
  assert.equal(await db.organization.count({ where: { slug } }), 0);
  check('anonymous direct create action denied');
  const created = await submit('/organizer/create', owner.cookie, fields, createHtml);
  if (created.status !== 303) {
    const html = await created.text();
    console.log('Create response:', html.match(/Something went wrong[^<]*/)?.[0] ?? html.match(/Please check[^<]*/)?.[0] ?? 'No expected redirect or form error.');
  }
  assert.equal(created.status, 303); assert.equal(created.headers.get('location'), `/organizer/${slug}`);
  const organization = await db.organization.findUniqueOrThrow({ where: { slug }, include: { members: true } });
  organizationIds.push(organization.id);
  assert.equal(organization.members.length, 1); assert.equal(organization.members[0].userId, owner.id); assert.equal(organization.members[0].role, 'OWNER');
  assert.equal(organization.shortName, null); assert.equal(organization.visualTheme, null);
  check('real Neon Organization and OWNER membership verified; forged owner/role ignored');
  const duplicate = await submit('/organizer/create', owner.cookie, fields, createHtml);
  assert.match(await duplicate.text(), /This organization URL is already taken/);
  assert.equal(await db.organization.count({ where: { slug } }), 1);
  check('duplicate slug gets friendly error without duplicate rows');
  for (const invalid of [{ slug: 'Invalid Slug' }, { slug: `${slug}-invalid`, website: 'javascript:alert(1)' }]) {
    const response = await submit('/organizer/create', owner.cookie, { ...fields, ...invalid }, createHtml);
    assert.match(await response.text(), /Please check the highlighted fields/);
    assert.equal(await db.organization.count({ where: { slug: invalid.slug } }), 0);
  }
  check('server rejects invalid slug and website');
  const dashboard = await request('/organizer', owner.cookie);
  assert.match(await dashboard.text(), /Step08 Isolated Organization/);
  assert.match(await (await request('/dashboard', owner.cookie)).text(), /Manage your organizations/);
  assert.equal((await request(`/organizer/${slug}`, owner.cookie)).status, 200);
  check('real organizer listing, owner overview, and user-dashboard shortcut');
  for (const path of [`/organizer/${slug}`, `/organizer/${slug}/settings`, '/organizer/nonexistent-step08-organization']) {
    const response = await request(path, other.cookie); const html = await response.text();
    assert.match(html, /Organization unavailable/); assert.doesNotMatch(html, /Step08 Isolated Organization/);
  }
  check('unrelated user denied overview/settings; nonexistent and inaccessible match');
  const settingsPath = `/organizer/${slug}/settings`;
  const settingsHtml = await (await request(settingsPath, owner.cookie)).text();
  const unauthorizedUpdate = await submit(settingsPath, other.cookie, { name: 'Unauthorized edit' }, settingsHtml);
  assert.equal(unauthorizedUpdate.status, 404);
  assert.equal((await db.organization.findUniqueOrThrow({ where: { slug } })).name, fields.name);
  check('replayed settings action from unrelated user denied without mutation');
  const invalidUpdate = await submit(settingsPath, owner.cookie, { name: 'Invalid edit', website: 'ftp://example.com' }, settingsHtml);
  assert.match(await invalidUpdate.text(), /Enter a valid website URL/);
  const updated = await submit(settingsPath, owner.cookie, { name: 'Step08 Updated Organization', shortName: ' Test08 ', description: 'Updated story', city: 'Mandalay', website: '', slug: 'changed-slug', userId: other.id, role: 'MEMBER' }, settingsHtml);
  assert.equal(updated.status, 303);
  const stored = await db.organization.findUniqueOrThrow({ where: { id: organization.id } });
  assert.equal(stored.name, 'Step08 Updated Organization'); assert.equal(stored.shortName, 'Test08'); assert.equal(stored.website, null); assert.equal(stored.slug, slug);
  check('owner settings persist; optional values clear; slug/role/identity cannot change');
  const membership = await db.organizationMember.create({ data: { userId: other.id, organizationId: organization.id, role: 'MEMBER' } });
  for (const role of ['MEMBER', 'EDITOR']) {
    await db.organizationMember.update({ where: { id: membership.id }, data: { role } });
    assert.equal((await request(`/organizer/${slug}`, other.cookie)).status, 200);
    assert.match(await (await request(settingsPath, other.cookie)).text(), /Organization unavailable/);
    const denied = await submit(settingsPath, other.cookie, { name: `${role} unauthorized edit` }, settingsHtml);
    assert.equal(denied.status, 404);
    assert.equal((await db.organization.findUniqueOrThrow({ where: { slug } })).name, stored.name);
  }
  check('MEMBER and EDITOR can view overview but cannot open or invoke settings');
  await db.organizationMember.update({ where: { id: membership.id }, data: { role: 'ADMIN' } });
  const adminEdit = await submit(settingsPath, other.cookie, { name: 'Step08 Admin Updated' });
  assert.equal(adminEdit.status, 303);
  assert.equal((await db.organization.findUniqueOrThrow({ where: { slug } })).name, 'Step08 Admin Updated');
  await db.organizationMember.update({ where: { id: membership.id }, data: { role: 'MEMBER' } });
  const revoked = await submit(settingsPath, other.cookie, { name: 'Revoked admin edit' }, settingsHtml);
  assert.equal(revoked.status, 404);
  check('ADMIN edit persists and a revoked admin cannot reuse a settings action');
  const rollbackSlug = `${slug}-rollback`;
  await assert.rejects(db.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name: 'Rollback fixture', slug: rollbackSlug } });
    await tx.organizationMember.create({ data: { organizationId: org.id, userId: `missing-${run}`, role: 'OWNER' } });
  }));
  assert.equal(await db.organization.count({ where: { slug: rollbackSlug } }), 0);
  check('Prisma transaction rolls organization back on membership failure');
  assert.equal((await request('/companies')).status, 200);
  assert.equal((await request('/explore')).status, 200);
  check('public mock discovery remains available');
} finally {
  // Delete only this run's exact records; no seed data or existing users are touched.
  const ownedFixtures = await db.organization.findMany({ where: { slug: { in: [slug, `${slug}-rollback`] } }, select: { id: true } });
  await db.organization.deleteMany({ where: { id: { in: [...organizationIds, ...ownedFixtures.map((org) => org.id)] } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  assert.equal(await db.organization.count({ where: { slug: { in: [slug, `${slug}-rollback`] } } }), 0);
  assert.equal(await db.user.count({ where: { id: { in: userIds } } }), 0);
  await db.$disconnect();
  console.log(`Removed isolated runtime fixtures. ${results.length} scenarios passed.`);
}
