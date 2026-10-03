import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd(), true);
for (const [name, pooled] of [['DATABASE_URL', true], ['DIRECT_URL', false]]) {
  const url = new URL(process.env[name]);
  assert.ok(url.hostname.endsWith('.neon.tech'));
  assert.equal(url.hostname.includes('-pooler'), pooled);
  console.log(`${name}: ep-***${pooled ? '-pooler' : ''}.<region>.<provider>.neon.tech; sslmode=${url.searchParams.get('sslmode')}; channel_binding=${url.searchParams.get('channel_binding')}`);
}
const { getDb } = await import('../src/lib/db.ts');
const { getPublishedEventBySlug } = await import('../src/features/events/server/public-event-queries.ts');
const db = getDb();
const runtime = globalThis.nexoraDatabaseRuntime;
if (process.env.NEON_DIAGNOSTIC_TRACE === '1') {
  for (const name of ['connect', 'acquire', 'release', 'remove']) runtime.pool.on(name, () => {
    console.log(`POOL ${name} total=${runtime.pool.totalCount} idle=${runtime.pool.idleCount} waiting=${runtime.pool.waitingCount}`);
  });
}
let tlsConnections = 0;
runtime.pool.on('connect', (client) => {
  // With PgBouncer, pg_stat_ssl describes the pooler-to-compute connection,
  // rather than this application's connection to the pooler. Inspect pg's TLS socket.
  assert.equal(client.connection.stream.encrypted, true);
  assert.equal(client.connection.stream.authorized, true);
  tlsConnections++;
});
assert.equal(runtime.client, db);
assert.equal(runtime.pool.options.connectionString, process.env.DATABASE_URL);
const reloaded = await import(`../src/lib/db.ts?reload=${Date.now()}`);
assert.equal(reloaded.getDb(), db);
assert.equal(globalThis.nexoraDatabaseRuntime, runtime);
console.log('PASS module reload reuses identical Pool/adapter/PrismaClient');
try {
  assert.equal(getDb(), db);
  const started = performance.now();
  assert.deepEqual(await db.$queryRaw`SELECT 1 AS value`, [{ value: 1 }]);
  console.log(`PASS runtime SELECT 1 (${Math.round(performance.now() - started)}ms)`);
  console.log(`PASS Event count: ${await db.event.count()}`);
  const event = await db.event.findFirst({ where: { status: 'PUBLISHED' }, select: { slug: true, title: true }, orderBy: { slug: 'asc' } });
  assert.ok(event, 'A real PUBLISHED event is required');
  assert.equal((await getPublishedEventBySlug(event.slug))?.title, event.title);
  console.log(`PASS published event ${event.slug}`);
  for (let i = 0; i < 20; i++) assert.deepEqual(await db.$queryRaw`SELECT 1 AS value`, [{ value: 1 }]);
  console.log('PASS SELECT 1 repeated 20/20');
  for (let i = 0; i < 20; i++) assert.equal((await getPublishedEventBySlug(event.slug))?.title, event.title);
  console.log('PASS published event repeated 20/20');
  await Promise.all(Array.from({ length: 20 }, async () => {
    assert.deepEqual(await db.$queryRaw`SELECT 1 AS value`, [{ value: 1 }]);
    assert.equal((await getPublishedEventBySlug(event.slug))?.title, event.title);
  }));
  console.log('PASS 20 concurrent SELECT 1 + event queries');
  assert.equal(runtime.pool.waitingCount, 0);
  assert.equal(runtime.pool.idleCount, runtime.pool.totalCount);
  assert.ok(runtime.pool.totalCount <= 5);
  console.log(`PASS pool drained: total=${runtime.pool.totalCount}, idle=${runtime.pool.idleCount}, waiting=${runtime.pool.waitingCount}`);
  assert.ok(tlsConnections > 0);
  console.log(`PASS actual runtime connections use verified TLS (${tlsConnections} sockets)`);
  assert.equal(await getPublishedEventBySlug('nexora-neon-diagnostic-unknown-slug'), null);
  const unpublished = await db.event.findFirst({ where: { status: { notIn: ['PUBLISHED', 'COMPLETED'] } }, select: { slug: true } });
  if (unpublished) assert.equal(await getPublishedEventBySlug(unpublished.slug), null);
  console.log(`PASS unknown slug returns null; unpublished fixture ${unpublished ? 'also verified hidden' : 'absent (no data written)'}`);
  if (process.env.NEON_DIAGNOSTIC_IDLE === '1') {
    console.log('Checking reconnect after 31 seconds of pool inactivity...');
    await new Promise(resolve => setTimeout(resolve, 31_000));
    assert.equal(runtime.pool.totalCount, 0);
    assert.equal((await getPublishedEventBySlug(event.slug))?.title, event.title);
    assert.equal(runtime.pool.waitingCount, 0);
    assert.equal(runtime.pool.idleCount, runtime.pool.totalCount);
    console.log('PASS idle sockets expired and published event reconnected successfully');
  }
} finally {
  // This is process shutdown only, never ordinary application request handling.
  await db.$disconnect();
}
