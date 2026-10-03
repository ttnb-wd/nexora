import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd(), true);
const { getDb } = await import('../src/lib/db.ts');
const { selectDueReminders, reminderDeliveryKey } = await import('../src/features/events/reminders/scheduler.ts');
const db = getDb();
try {
  // Enforce read-only at PostgreSQL, including all diagnostic queries.
  const report = await db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const before = await tx.notification.count();
    const candidates = await selectDueReminders(tx);
    assert.ok(candidates.length <= 50);
    const plan = await selectDueReminders({ $queryRaw: (strings, ...values) => {
      const parts = Array.from(strings); parts[0] = 'EXPLAIN (FORMAT JSON) ' + parts[0];
      parts.raw = Array.from(parts); return tx.$queryRaw(parts, ...values);
    } });
    const [{ sqlKey }] = await tx.$queryRaw`SELECT 'reminder:fixture:' || ((EXTRACT(EPOCH FROM TIMESTAMPTZ '2026-10-03T03:30:00.123Z') * 1000)::bigint)::text AS "sqlKey"`;
    assert.equal(sqlKey, reminderDeliveryKey('fixture', new Date('2026-10-03T03:30:00.123Z')));
    assert.equal(await tx.notification.count(), before);
    return { readOnly: true, boundedQueryPassed: true, keyParityPassed: true, notificationCountUnchanged: true, candidateCount: candidates.length, plan };
  }, { isolationLevel: 'RepeatableRead', timeout: 30000 });
  mkdirSync('artifacts/step19', { recursive: true });
  writeFileSync('artifacts/step19/readonly-query.json', JSON.stringify(report, null, 2));
  console.log('PASS read-only Neon: due SQL, 50-row bound, EXPLAIN, millisecond key parity and unchanged notifications');
} finally { await db.$disconnect(); }
