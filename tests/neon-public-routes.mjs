import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd(), true);
const origin = process.env.NEON_TEST_ORIGIN ?? process.env.APP_URL;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const { getDb } = await import('../src/lib/db.ts');
const db = getDb();
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
try {
  const event = await db.event.findFirst({ where: { status: 'PUBLISHED' }, select: { slug: true, title: true } });
  assert.ok(event, 'A real published event is required');
  const detailPath = `/events/${encodeURIComponent(event.slug)}`;
  async function check(path, status = 200) {
    const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(60_000) });
    const html = await response.text(); // Consume the entire streamed page, including metadata/errors.
    assert.equal(response.status, status, path);
    assert.ok(!/temporarily unavailable|Event unavailable|Organization unavailable|timeout exceeded|Connection terminated unexpectedly/.test(html), `Runtime failure in ${path}`);
    if (path === detailPath) {
      assert.ok(html.includes(`<title>${escape(event.title)}`), 'Published event metadata is present');
      assert.ok(html.includes(escape(event.title)), 'Real published event appears');
    }
    return html;
  }
  for (const path of ['/', '/explore', '/companies', detailPath]) await check(path);
  console.log('PASS homepage, explore, companies, event detail and metadata');
  const organization = await db.organization.findFirst({ select: { slug: true } });
  if (organization) {
    await check(`/companies/${encodeURIComponent(organization.slug)}`);
    console.log('PASS existing organization detail');
  }
  for (let i = 0; i < 20; i++) await check(detailPath);
  console.log('PASS event detail + metadata refresh 20/20');
  for (let i = 0; i < 5; i++) {
    for (const path of ['/explore', detailPath, '/companies', detailPath]) await check(path);
  }
  console.log('PASS explore -> event -> companies -> event, 5 cycles / 20 requests');
  await Promise.all(Array.from({ length: 5 }, () => check(detailPath)));
  console.log('PASS 5 concurrent event detail requests');
  await check('/events/nexora-neon-diagnostic-unknown-slug', 404);
  const unpublished = await db.event.findFirst({ where: { status: { notIn: ['PUBLISHED', 'COMPLETED'] } }, select: { slug: true } });
  if (unpublished) await check(`/events/${encodeURIComponent(unpublished.slug)}`, 404);
  console.log(`PASS unknown event 404; unpublished fixture ${unpublished ? '404 verified' : 'absent'}`);
} finally {
  await db.$disconnect(); // Diagnostic process shutdown only.
}
