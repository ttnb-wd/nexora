import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
const { processDueReminders, selectDueReminders, reminderDeliveryKey, reminderMessage } = await import('../src/features/events/reminders/scheduler.ts');
const { authorizedReminderJob, handleReminderJob } = await import('../src/features/events/reminders/job-request.ts');
const now = new Date('2026-10-03T03:30:00Z');
const secret = 'test-only-reminder-secret-32-characters';

// An in-memory transaction fixture, NOT a substitute for real PostgreSQL proof.
function fixture(minutes = [15, 30, 60, 1440]) {
  const preferences = minutes.map((reminderMinutes, i) => ({ id: `p${i}`, eventId: `e${i}`, userId: `u${i}`, enabled: true, reminderMinutes }));
  const events = new Map(preferences.map(p => [p.eventId, { status: 'PUBLISHED', startAt: new Date(now.getTime() + p.reminderMinutes * 60_000), title: `Event ${p.id}`, slug: `event-${p.id}`, timezone: 'America/New_York' }]));
  const registrations = new Map(preferences.map(p => [p.userId, 'REGISTERED']));
  const notifications = new Map(), sql = [];
  let tail = Promise.resolve(), beforeTransaction, fail = false;
  const tx = {
    $queryRaw: async (strings, ...values) => { sql.push({ text: strings.join('?'), values }); return strings.join('').includes('clock_timestamp') ? [{ now }] : [{ id: values[0] }]; },
    event: { findUnique: async ({ where }) => events.get(where.id) },
    eventReminderPreference: { findUnique: async ({ where }) => preferences.find(p => p.id === where.id) },
    eventRegistration: { findUnique: async ({ where }) => ({ status: registrations.get(where.userId_eventId.userId) }) },
    notification: { createMany: async ({ data, skipDuplicates }) => {
      assert.equal(skipDuplicates, true);
      if (fail) throw new Error('private SQL details must never escape');
      const item = data[0];
      if (notifications.has(item.dedupeKey)) return { count: 0 };
      notifications.set(item.dedupeKey, { ...item, readAt: null }); return { count: 1 };
    } },
  };
  const db = {
    $queryRaw: async (strings, ...values) => { sql.push({ text: strings.join('?'), values }); return preferences.filter(p => p.enabled && !notifications.has(reminderDeliveryKey(p.id, events.get(p.eventId).startAt))).slice(0, 50).map(p => ({ id: p.id, eventId: p.eventId })); },
    $transaction: async fn => {
      const previous = tail; let release; tail = new Promise(resolve => { release = resolve; }); await previous;
      try { beforeTransaction?.(); return await fn(tx); } finally { release(); }
    },
  };
  return { db, preferences, events, registrations, notifications, sql, changeBeforeTransaction: callback => { beforeTransaction = callback; }, failWrites: () => { fail = true; } };
}
test('all four configured durations create unread notifications for the correct user and event', async () => {
  const s = fixture();
  assert.deepEqual(await processDueReminders(s.db), { processed: 4, delivered: 4, skipped: 0, failed: 0 });
  for (const p of s.preferences) {
    const n = s.notifications.get(reminderDeliveryKey(p.id, s.events.get(p.eventId).startAt));
    assert.equal(n.userId, p.userId); assert.equal(n.type, 'EVENT_REMINDER'); assert.equal(n.title, 'Event starts soon');
    assert.equal(n.href, `/events/event-${p.id}`); assert.equal(n.readAt, null);
    assert.equal(n.message, reminderMessage(`Event ${p.id}`, p.reminderMinutes));
  }
  assert.equal([...s.notifications.values()].filter(n => n.readAt === null).length, 4);
  assert.match(reminderMessage('Event', 60), /1 hour/); assert.match(reminderMessage('Event', 1440), /1 day/);
});
test('repeated and overlapping jobs create one persisted occurrence per preference', async () => {
  const s = fixture(); const results = await Promise.all([processDueReminders(s.db), processDueReminders(s.db)]);
  assert.equal(results.reduce((sum, r) => sum + r.delivered, 0), 4); assert.equal(s.notifications.size, 4);
  assert.equal((await processDueReminders(s.db)).delivered, 0);
  assert.ok(s.sql.some(q => q.text.includes('FOR UPDATE')));
});
test('disabling/re-enabling or editing duration does not resurrect a delivered occurrence; reschedule is new', async () => {
  const s = fixture([15]); await processDueReminders(s.db);
  s.preferences[0].enabled = false; assert.equal((await processDueReminders(s.db)).delivered, 0);
  s.preferences[0].enabled = true; s.preferences[0].reminderMinutes = 30;
  assert.equal((await processDueReminders(s.db)).delivered, 0);
  s.events.get('e0').startAt = new Date(now.getTime() + 20 * 60_000);
  assert.equal((await processDueReminders(s.db)).delivered, 1);
});
for (const label of ['disabled', 'cancelled registration', 'cancelled event', 'past', 'not due', 'invalid duration', 'attended', 'deleted']) {
  test(`eligibility is rechecked after event lock: ${label}`, async () => {
    const s = fixture([15]);
    s.changeBeforeTransaction(() => {
      if (label === 'disabled') s.preferences[0].enabled = false;
      if (label === 'cancelled registration') s.registrations.set('u0', 'CANCELLED');
      if (label === 'cancelled event') s.events.get('e0').status = 'CANCELLED';
      if (label === 'past') s.events.get('e0').startAt = now;
      if (label === 'not due') s.events.get('e0').startAt = new Date(now.getTime() + 16 * 60_000);
      if (label === 'invalid duration') s.preferences[0].reminderMinutes = 16;
      if (label === 'attended') s.registrations.set('u0', 'ATTENDED');
      if (label === 'deleted') s.preferences.length = 0;
    });
    assert.deepEqual(await processDueReminders(s.db), { processed: 1, delivered: 0, skipped: 1, failed: 0 });
    assert.equal(s.notifications.size, 0);
  });
}
test('failure leaves no delivery record and returns only safe counts', async () => {
  const s = fixture([15]); s.failWrites();
  assert.deepEqual(await processDueReminders(s.db), { processed: 1, delivered: 0, skipped: 0, failed: 1 });
  assert.equal(s.notifications.size, 0);
});
test('due query is bounded, deterministic, indexed by time range and excludes delivered/ineligible rows', async () => {
  const s = fixture(); await selectDueReminders(s.db); const q = s.sql[0];
  for (const fragment of ['CURRENT_TIMESTAMP', "INTERVAL '1 day'", 'NOT EXISTS', '"dedupeKey"', 'ORDER BY', 'LIMIT', "'REGISTERED'", "'PUBLISHED'", 'IN (15, 30, 60, 1440)']) assert.ok(q.text.includes(fragment), fragment);
  assert.deepEqual(q.values, [50]); assert.ok(!q.text.includes('timezone'));
});
test('auth fails closed for missing, malformed, wrong and unconfigured secrets', async () => {
  for (const header of [null, 'Bearer wrong', `Basic ${secret}`, `Bearer ${secret} `, 'Bearer ' + 'x'.repeat(5000)]) assert.equal(authorizedReminderJob(header, secret), false);
  assert.equal(authorizedReminderJob(`Bearer ${secret}`, secret), true);
  for (const config of [undefined, '', 'short', ` ${secret}`]) assert.equal(authorizedReminderJob(`Bearer ${secret}`, config), false);
  let calls = 0; const run = async () => { calls++; return { processed: 0, delivered: 0, skipped: 0, failed: 0 }; };
  const request = (method = 'POST', header, suffix = '', body) => new Request(`https://nexora.example/api/internal/reminders/run${suffix}`, { method, headers: header ? { Authorization: header } : {}, ...(body ? { body } : {}) });
  assert.equal((await handleReminderJob(request(), secret, run)).status, 401);
  assert.equal((await handleReminderJob(request('POST', 'Bearer wrong'), secret, run)).status, 401);
  assert.equal((await handleReminderJob(request('POST', `Bearer ${secret}`), undefined, run)).status, 503);
  assert.equal((await handleReminderJob(request('GET', `Bearer ${secret}`), secret, run)).status, 405);
  assert.equal((await handleReminderJob(request('POST', `Bearer ${secret}`, '?userId=target'), secret, run)).status, 400);
  assert.equal((await handleReminderJob(request('POST', `Bearer ${secret}`, '', '{"eventId":"target"}'), secret, run)).status, 400);
  assert.equal(calls, 0);
  const response = await handleReminderJob(request('POST', `Bearer ${secret}`), secret, run);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(calls, 1);
  assert.deepEqual(await response.json(), { processed: 0, delivered: 0, skipped: 0, failed: 0 });
});
test('Next-style empty POST streams are accepted; streamed payload bytes remain rejected', async () => {
  let calls = 0;
  const run = async () => { calls++; return { processed: 0, delivered: 0, skipped: 0, failed: 0 }; };
  const request = bytes => new Request('https://nexora.example/api/internal/reminders/run', {
    method: 'POST', headers: { Authorization: `Bearer ${secret}` }, duplex: 'half',
    body: new ReadableStream({ start(controller) { if (bytes) controller.enqueue(new TextEncoder().encode(bytes)); controller.close(); } }),
  });
  assert.equal((await handleReminderJob(request(''), secret, run)).status, 200);
  assert.equal((await handleReminderJob(request('{"eventId":"target"}'), secret, run)).status, 400);
  assert.equal(calls, 1);
});
