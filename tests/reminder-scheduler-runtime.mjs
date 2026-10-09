import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import nextEnv from '@next/env';
import rscClient from 'next/dist/compiled/react-server-dom-turbopack/client.node.js';
import { getIP } from 'better-auth/api';

assert.equal(process.env.STEP19_DISPOSABLE_APPROVED, '1', 'Explicit Step 19 disposable-data approval required.');
nextEnv.loadEnvConfig(process.cwd(), true);
const { getDb } = await import('../src/lib/db.ts');
const { selectDueReminders, processDueReminders, reminderDeliveryKey, reminderMessage } = await import('../src/features/events/reminders/scheduler.ts');
const { handleReminderJob } = await import('../src/features/events/reminders/job-request.ts');
const { lifecycleKey } = await import('../src/features/auth/server/lifecycle-rate-limit.ts');
const db = getDb(), run = randomUUID(), prefix = `step19-runtime-test-${run}`;
const origin = 'http://127.0.0.1:3003', secret = randomBytes(32).toString('hex');
const ip = `fd19:${run.slice(0,4)}:${run.slice(9,13)}:${run.slice(14,18)}::1`;
const ratePrefix = `fd19:${run.slice(0,4)}:${run.slice(9,13)}:${run.slice(14,18)}:`;
const outputRoot = `artifacts/step19/real-world-${run}`;
mkdirSync(outputRoot, { recursive: true });
const ledger = { run, prefix, passed: [], created: {}, fixtures: [], executions: [], cleanupVerified: false, existingRecordsUnchanged: false, schemaUnchanged: false };
const eventIds = [], userIds = [], preferenceIds = [], registrationIds = [], sensitive = [secret];
let server, logs = '', actor, stage = 'preflight', baseline, schemaBefore;
const save = () => writeFileSync(`${outputRoot}/ledger.json`, JSON.stringify(ledger, null, 2));
const pass = label => { ledger.passed.push(label); save(); console.log(`PASS ${label}`); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const quoteIdentifier = name => `"${name.replaceAll('"', '""')}"`;
async function fingerprint() {
  const tables = await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const result = {};
  for (const { tablename } of tables) {
    // Identifiers come exclusively from PostgreSQL's catalog, and are quoted.
    const [row] = await db.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t."id")::text, '[]')) AS digest FROM ${quoteIdentifier(tablename)} t`);
    result[tablename] = row;
  }
  return result; // Aggregate hashes only: no private business fields leave PostgreSQL.
}
async function schemaFingerprint() {
  const columns = await db.$queryRaw`SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`;
  const indexes = await db.$queryRaw`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname`;
  const constraints = await db.$queryRaw`SELECT c.conname, pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' ORDER BY c.conname`;
  return createHash('sha256').update(JSON.stringify({ columns, indexes, constraints })).digest('hex');
}
async function safetyGuard() {
  // The production job has no targeting option. Refuse testing if it could touch
  // a non-fixture reminder now or within the next 90 minutes.
  const rows = await db.$queryRaw`
    SELECT p."id" FROM "EventReminderPreference" p JOIN "Event" e ON e."id" = p."eventId"
    JOIN "EventRegistration" r ON r."eventId" = e."id" AND r."userId" = p."userId"
    WHERE p."enabled" AND e."status" = 'PUBLISHED' AND r."status" = 'REGISTERED'
      AND e."startAt" > clock_timestamp() AND p."reminderMinutes" IN (15,30,60,1440)
      AND e."startAt" - p."reminderMinutes" * INTERVAL '1 minute' <= clock_timestamp() + INTERVAL '90 minutes'
      AND e."slug" NOT LIKE ${`${prefix}%`}
      AND NOT EXISTS (SELECT 1 FROM "Notification" n WHERE n."dedupeKey" = 'reminder:' || p."id" || ':' || ((EXTRACT(EPOCH FROM e."startAt")*1000)::bigint)::text)
    LIMIT 1`;
  assert.equal(rows.length, 0, 'Business reminders could become due: refusing global job execution.');
}
async function request(path, options = {}, authenticated = false) {
  return fetch(`${origin}${path}`, { ...options, headers: { Origin: origin, 'X-Forwarded-For': ip, ...(authenticated ? { Cookie: actor.cookie } : {}), ...options.headers }, signal: AbortSignal.timeout(65000) });
}
async function job(header = `Bearer ${secret}`, expected = 200, cron = false) {
  await safetyGuard();
  const response = await request(cron ? '/api/cron/reminders' : '/api/internal/reminders/run', { method: cron ? 'GET' : 'POST', headers: header ? { Authorization: header } : {} });
  const body = await response.text();
  for (const value of sensitive) assert.ok(!body.includes(value), 'Private data in job response');
  assert.equal(response.status, expected);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = JSON.parse(body);
  ledger.lastJobResponse = { status: response.status, result }; save();
  if (expected === 200) {
    assert.deepEqual(Object.keys(result).sort(), ['delivered','failed','processed','skipped']);
    assert.ok(result.processed <= 50); assert.equal(result.failed, 0);
    assert.equal(result.processed, result.delivered + result.skipped + result.failed);
    ledger.executions.push(result); save();
  }
  return result;
}
async function fixture(label, minutes = 15, kind = 'due') {
  const [{ now }] = await db.$queryRaw`SELECT clock_timestamp() AS "now"`;
  const startAt = new Date(now.getTime() + (kind === 'past' ? -180 : kind === 'pending' ? 120 : minutes - 3) * 60000);
  const event = await db.event.create({ data: { slug: `${prefix}-${label}`, title: `${prefix} ${label}`, creatorId: actor.id, status: 'PUBLISHED', eventType: 'ONLINE', timezone: 'Asia/Yangon', startAt, endAt: new Date(startAt.getTime() + 3600000) } });
  eventIds.push(event.id); save();
  const registration = await db.eventRegistration.create({ data: { userId: actor.id, eventId: event.id, status: 'REGISTERED' } });
  registrationIds.push(registration.id); save();
  const preference = await db.eventReminderPreference.create({ data: { userId: actor.id, eventId: event.id, enabled: kind !== 'disabled', reminderMinutes: minutes } });
  preferenceIds.push(preference.id);
  const item = { label, event, registration, preference };
  ledger.fixtures.push({ label, eventId: event.id, slug: event.slug, registrationId: registration.id, preferenceId: preference.id, reminderMinutes: minutes, kind }); save();
  if (kind === 'cancel-registration') await db.eventRegistration.update({ where: { id: registration.id }, data: { status: 'CANCELLED' } });
  if (kind === 'cancel-event') await db.event.update({ where: { id: event.id }, data: { status: 'CANCELLED' } });
  return item;
}
async function notifications(item) { return db.notification.findMany({ where: { dedupeKey: reminderDeliveryKey(item.preference.id, item.event.startAt) } }); }
async function reschedule(item, at) {
  const startAt = at ?? new Date(Date.now() + (item.preference.reminderMinutes - 3) * 60000);
  item.event = await db.event.update({ where: { id: item.event.id }, data: { startAt, endAt: new Date(startAt.getTime() + 3600000) } });
}
async function html(path) { const res = await request(path, {}, true); assert.equal(res.status, 200); return res.text(); }
async function childCommand(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env: { ...process.env, NODE_OPTIONS: '', ...env }, windowsHide: true });
    let stdout = '', stderr = ''; child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
  });
}
try {
  await safetyGuard(); baseline = await fingerprint(); schemaBefore = await schemaFingerprint();
  ledger.baseline = baseline; ledger.schemaBefore = schemaBefore; save();
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3003'], {
    env: { ...process.env, APP_URL: origin, PUBLIC_APP_URL: ' ', CRON_SECRET: secret, NODE_ENV: 'production' }, windowsHide: true,
  });
  server.stdout.on('data', data => { logs += data; }); server.stderr.on('data', data => { logs += data; });
  for (let i = 0; i < 40; i++) {
    if (server.exitCode !== null) throw new Error('Dedicated server failed to start');
    try { if ((await request('/api/internal/reminders/run')).status === 405) break; } catch { /* readiness */ }
    await sleep(250);
  }
  stage = 'signup';
  const email = `${prefix}@example.test`, password = randomBytes(24).toString('hex'); sensitive.push(email, password);
  const signup = await request('/api/auth/sign-up/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: prefix, email, password }) });
  assert.equal(signup.status, 200);
  const { user } = await signup.json(); userIds.push(user.id); save();
  const cookie = signup.headers.getSetCookie().map(value => value.split(';')[0]).join('; '); sensitive.push(cookie);
  actor = { id: user.id, cookie };
  for (const { token } of await db.session.findMany({ where: { userId: user.id }, select: { token: true } })) sensitive.push(token);
  stage = 'eligibility fixtures';
  const due = []; for (const minutes of [15,30,60,1440]) due.push(await fixture(`due-${minutes}`, minutes));
  const blocked = []; for (const kind of ['pending','disabled','cancel-registration','cancel-event','past']) blocked.push(await fixture(kind, 15, kind));
  assert.equal(await db.notification.count({ where: { userId: actor.id } }), 0);
  stage = 'security';
  const prior = await db.notification.count();
  await job(null, 401); await job('Bearer deliberately-wrong', 401);
  await job(null, 401, true); await job('Bearer deliberately-wrong', 401, true);
  assert.equal(await db.notification.count(), prior); pass('missing/wrong secret rejected without mutation');
  stage = 'four durations';
  assert.equal((await job()).delivered, 4);
  for (const item of due) {
    const rows = await notifications(item); assert.equal(rows.length, 1);
    const n = rows[0]; assert.equal(n.userId, actor.id); assert.equal(n.type, 'EVENT_REMINDER'); assert.equal(n.title, 'Event starts soon');
    assert.equal(n.message, reminderMessage(item.event.title, item.preference.reminderMinutes)); assert.equal(n.href, `/events/${item.event.slug}`); assert.equal(n.readAt, null);
  }
  for (const item of blocked) assert.equal((await notifications(item)).length, 0);
  assert.equal((await db.eventReminderPreference.findUniqueOrThrow({ where: { id: blocked[0].preference.id } })).enabled, true);
  pass('15/30/60/1440 due deliveries, recipient/type/href/content and five ineligible cases');
  stage = 'duplicates'; assert.equal((await job()).delivered, 0); for (const item of due) assert.equal((await notifications(item)).length, 1); pass('repeat execution leaves exactly one notification per occurrence');
  stage = 'notification integration';
  const inbox = await html('/dashboard/notifications'); assert.ok(inbox.includes('Notifications, 4 unread'));
  for (const item of due) { assert.ok(inbox.includes(item.event.title)); assert.ok(inbox.includes(`/events/${item.event.slug}`)); }
  assert.ok((await html(`/events/${due[0].event.slug}`)).includes(due[0].event.title));
  const manifest = JSON.parse(readFileSync('.next/server/server-reference-manifest.json', 'utf8'));
  const [actionId] = Object.entries(manifest.node).find(([, entry]) => entry.exportedName === 'markNotificationRead');
  const [delivered] = await notifications(due[0]); const payload = await rscClient.encodeReply([delivered.id]);
  const marked = await request('/dashboard/notifications', { method: 'POST', headers: { 'Next-Action': actionId, 'Content-Type': 'text/plain;charset=UTF-8' }, body: payload }, true);
  assert.equal(marked.status, 200); await marked.text();
  assert.ok((await db.notification.findUniqueOrThrow({ where: { id: delivered.id } })).readAt);
  assert.ok((await html('/dashboard/notifications')).includes('Notifications, 3 unread')); pass('real inbox list, header unread 4 to 3, authenticated mark-read action and event link');
  stage = 'concurrent executions'; ledger.concurrency = [];
  for (let round = 0; round < 3; round++) {
    await reschedule(due[0]);
    let unlock, locked; const gate = new Promise(resolve => { unlock = resolve; }); const ready = new Promise(resolve => { locked = resolve; });
    const holder = db.$transaction(async tx => { await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${due[0].event.id} FOR UPDATE`; locked(); await gate; }, { timeout: 10000 });
    await ready;
    let results;
    try { const executions = Promise.all([job(), job()]); await sleep(1500); unlock(); results = await executions; } finally { unlock(); await holder; }
    assert.equal(results.reduce((sum, r) => sum + r.delivered, 0), 1);
    assert.equal(results.reduce((sum, r) => sum + r.processed, 0), 2);
    assert.equal((await notifications(due[0])).length, 1); ledger.concurrency.push(results); save();
  }
  pass('three overlapping HTTP execution pairs: one delivery and one duplicate skip each');
  stage = 'Vercel cron adapter'; await reschedule(due[0]);
  const cron = await job(`Bearer ${secret}`, 200, true); assert.equal(cron.delivered, 1);
  assert.equal((await job(`Bearer ${secret}`, 200, true)).delivered, 0);
  assert.equal((await job()).delivered, 0); assert.equal((await notifications(due[0])).length, 1);
  const cronBefore = await db.notification.count();
  const targeting = await request('/api/cron/reminders?userId=other&now=2099-01-01', { headers: { Authorization: `Bearer ${secret}` } });
  assert.equal(targeting.status, 400); await targeting.text();
  const head = await request('/api/cron/reminders', { method: 'HEAD', headers: { Authorization: `Bearer ${secret}` } });
  assert.equal(head.status, 405); assert.equal(await db.notification.count(), cronBefore);
  ledger.cron = cron; pass('real GET cron auth/delivery/repeat, shared POST dedupe, query rejection and non-mutating HEAD');
  stage = 'local runner'; await reschedule(due[1]); await safetyGuard();
  const runner = await childCommand(['scripts/run-reminders.mjs'], { APP_URL: origin, PUBLIC_APP_URL: ' ', CRON_SECRET: secret });
  assert.equal(runner.code, 0); const runnerResult = JSON.parse(runner.stdout.trim()); assert.equal(runnerResult.delivered, 1);
  for (const value of sensitive) assert.ok(!runner.stdout.includes(value) && !runner.stderr.includes(value));
  assert.equal((await notifications(due[1])).length, 1); ledger.runner = runnerResult; pass('existing local runner delivers through the real shared endpoint');
  stage = 'batch';
  const batch = [...due]; const at = Date.now();
  // The deployed cron shares Neon. Publish the entire disposable batch together
  // so it cannot consume partially constructed fixtures before ordering checks.
  await db.eventReminderPreference.updateMany({ where: { id: { in: due.map(item => item.preference.id) } }, data: { enabled: false } });
  for (const item of due) await reschedule(item, new Date(at + (item.preference.reminderMinutes - 3) * 60000));
  for (let i = 0; i < 47; i++) batch.push(await fixture(`batch-${String(i).padStart(2,'0')}`, 15, 'disabled'));
  const expected = batch.slice().sort((a,b) => (a.event.startAt - a.preference.reminderMinutes*60000) - (b.event.startAt - b.preference.reminderMinutes*60000) || (a.preference.id < b.preference.id ? -1 : 1));
  await db.$transaction(async tx => {
    await tx.eventReminderPreference.updateMany({ where: { id: { in: batch.map(item => item.preference.id) } }, data: { enabled: true } });
    const selected = await selectDueReminders(tx); assert.equal(selected.length, 50); assert.deepEqual(selected.map(x => x.id), expected.slice(0,50).map(x => x.preference.id));
  });
  const keys = batch.map(item => reminderDeliveryKey(item.preference.id, item.event.startAt));
  const persisted = () => db.notification.count({ where: { dedupeKey: { in: keys } } });
  const first = await job(); assert.ok(first.delivered >= 0 && first.delivered <= 50); assert.ok(await persisted() >= first.delivered);
  const batches = [first]; for (let i = 0; i < 4 && await persisted() < 51; i++) batches.push(await job());
  assert.equal(await persisted(), 51); for (const item of batch) assert.equal((await notifications(item)).length, 1);
  assert.ok(batches.every(result => result.processed <= 50 && result.failed === 0));
  const localDeliveries = batches.reduce((sum,result) => sum + result.delivered, 0); assert.ok(localDeliveries <= 51);
  ledger.batches = batches; ledger.overlappingWorkerDeliveries = 51 - localDeliveries; pass('51 due reminders: deterministic 50-row selection, bounded executions, exactly-once drain with overlapping workers');
  stage = 'failure safety'; await reschedule(due[2]); await reschedule(due[3]); await safetyGuard();
  const badKey = reminderDeliveryKey(due[2].preference.id, due[2].event.startAt);
  const faultDb = { $queryRaw: db.$queryRaw.bind(db), $transaction: (fn, options) => db.$transaction(tx => fn(new Proxy(tx, { get(target,key) {
    if (key === 'notification') return { createMany: async args => {
      if (args.data[0].dedupeKey === badKey) await tx.$queryRaw`SELECT 1 / 0`;
      return tx.notification.createMany(args);
    } };
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  } })), options) };
  const failureResponse = await handleReminderJob(new Request(`${origin}/api/internal/reminders/run`, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } }), secret, () => processDueReminders(faultDb));
  assert.equal(failureResponse.status, 503); const failure = await failureResponse.json(); assert.deepEqual(failure, { processed: 2, delivered: 1, skipped: 0, failed: 1 });
  assert.equal((await notifications(due[2])).length, 0); assert.equal((await notifications(due[3])).length, 1);
  ledger.failureSafety = failure; assert.equal((await job()).delivered, 1); pass('controlled real transaction failure rolls back only its candidate; safe 503 counts and successful retry');
  for (const item of blocked) assert.equal((await notifications(item)).length, 0);
  pass('ineligible reminders remain undelivered after all execution rounds');
} catch {
  ledger.failedStage = stage; process.exitCode = 1; console.error(`Step 19 runtime verification failed during ${stage}; see ledger.`);
} finally {
  if (server && server.exitCode === null) { server.kill(); await Promise.race([new Promise(resolve => server.once('exit',resolve)), sleep(3000)]); }
  try {
    // Recover any user created just before a response/recording error. Restrict
    // recovery to this run's exact unique name and email, never generic prefixes.
    const ownUsers = await db.user.findMany({ where: { name: prefix, email: `${prefix}@example.test` }, select: { id: true } });
    for (const row of ownUsers) if (!userIds.includes(row.id)) userIds.push(row.id);
    const ownedEvents = await db.event.findMany({ where: { creatorId: { in: userIds }, slug: { startsWith: prefix } }, select: { id: true } });
    for (const row of ownedEvents) if (!eventIds.includes(row.id)) eventIds.push(row.id);
    ledger.created = {
      users: await db.user.count({ where: { id: { in: userIds } } }),
      accounts: await db.account.count({ where: { userId: { in: userIds } } }), sessions: await db.session.count({ where: { userId: { in: userIds } } }),
      organizations: 0, memberships: 0, events: eventIds.length,
      registrations: await db.eventRegistration.count({ where: { eventId: { in: eventIds } } }),
      reminderPreferences: await db.eventReminderPreference.count({ where: { eventId: { in: eventIds } } }),
      notifications: await db.notification.count({ where: { userId: { in: userIds } } }), rateLimitRows: await db.rateLimit.count({ where: { key: { startsWith: ratePrefix } } }),
    };
    ledger.recordIds = { users: userIds, events: eventIds, registrations: registrationIds, reminderPreferences: preferenceIds,
      notifications: (await db.notification.findMany({ where: { userId: { in: userIds } }, select: { id:true } })).map(x => x.id),
      accounts: (await db.account.findMany({ where: { userId: { in: userIds } }, select: { id:true } })).map(x => x.id),
      sessions: (await db.session.findMany({ where: { userId: { in: userIds } }, select: { id:true } })).map(x => x.id),
      rateLimits: (await db.rateLimit.findMany({ where: { key: { startsWith: ratePrefix } }, select: { id:true } })).map(x => x.id) };
    save();
    await db.event.deleteMany({ where: { id: { in: eventIds }, creatorId: { in: userIds }, slug: { startsWith: prefix } } });
    await db.user.deleteMany({ where: { id: { in: userIds }, name: prefix, email: `${prefix}@example.test` } });
    await db.rateLimit.deleteMany({ where: { id: { in: ledger.recordIds.rateLimits }, key: { startsWith: ratePrefix } } });
    // Step 23 added HMAC lifecycle buckets alongside Better Auth's IP buckets.
    // Delete only this disposable identity, even when a preloader verified it.
    const normalizedIp = getIP(new Request(origin, { headers: { 'X-Forwarded-For': ip } }), {}) || ip;
    const lifecycleKeys = [lifecycleKey(`${prefix}@example.test`, 'signup-cooldown'), lifecycleKey(`${prefix}@example.test`, 'signup-hour'), lifecycleKey(ip, 'email-ip'), lifecycleKey(normalizedIp, 'email-ip')];
    await db.rateLimit.deleteMany({ where: { key: { in: lifecycleKeys } } });
    assert.equal(await db.rateLimit.count({ where: { key: { in: lifecycleKeys } } }), 0);
    for (const model of ['eventRegistration','eventReminderPreference']) assert.equal(await db[model].count({ where: { eventId: { in: eventIds } } }), 0);
    for (const model of ['session','account','notification']) assert.equal(await db[model].count({ where: { userId: { in: userIds } } }), 0);
    assert.equal(await db.user.count({ where: { name: { startsWith: prefix } } }), 0);
    assert.equal(await db.event.count({ where: { slug: { startsWith: prefix } } }), 0);
    assert.equal(await db.organization.count({ where: { name: { startsWith: prefix } } }), 0);
    assert.equal(await db.rateLimit.count({ where: { key: { startsWith: ratePrefix } } }), 0);
    ledger.cleanupVerified = true; ledger.cleaned = { ...ledger.created }; save();
    if (baseline) {
      ledger.after = await fingerprint();
      // Ordinary authentication requests update/expire shared temporary limiter
      // counters. Match every business table exactly; fixture limiters above
      // still have explicit zero-row cleanup assertions.
      for (const [table, before] of Object.entries(baseline)) if (table !== 'RateLimit') assert.deepEqual(ledger.after[table], before);
      ledger.rateLimitMaintenance = 'Ephemeral authentication counters excluded from business-table comparison; own limiter cleanup verified separately.';
      ledger.existingRecordsUnchanged = true;
    }
    if (schemaBefore) { ledger.schemaAfter = await schemaFingerprint(); assert.equal(ledger.schemaAfter, schemaBefore); ledger.schemaUnchanged = true; }
    const leaked = sensitive.some(value => value && logs.includes(value)); ledger.privacyLogsPassed = !leaked; assert.equal(leaked, false, 'Sensitive data detected in server logs');
    writeFileSync(`${outputRoot}/server.log`, logs); save();
    pass('cleanup complete; all business-table hashes/counts and schema fingerprints match baseline; own limiter rows removed; logs private-data-free');
  } catch {
    ledger.cleanupOrSafetyFailure = true; save(); process.exitCode = 1; console.error('Cleanup/safety verification needs attention; inspect the ledger.');
  } finally { await db.$disconnect(); }
}
