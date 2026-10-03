import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const { handleReminderCron, handleReminderJob } = await import('../src/features/events/reminders/job-request.ts');
const secret = 'test-only-cron-adapter-secret-32-characters';
const request = (authorization, suffix = '', method = 'GET') => new Request(`https://nexora.example/api/cron/reminders${suffix}`, { method, headers: authorization ? { Authorization: authorization } : {} });
test('GET adapter rejects missing/wrong auth and missing server configuration before invoking processor', async () => {
  let calls = 0; const run = async () => { calls++; throw new Error('must not execute'); };
  assert.equal((await handleReminderCron(request(), secret, run)).status, 401);
  assert.equal((await handleReminderCron(request('Bearer wrong'), secret, run)).status, 401);
  assert.equal((await handleReminderCron(request(`Bearer ${secret}`), undefined, run)).status, 503);
  assert.equal((await handleReminderCron(request(`Bearer ${secret}`), 'short', run)).status, 503);
  assert.equal(calls, 0);
});
test('GET adapter propagates only safe counts; rejects selectors, time overrides, HEAD and POST', async () => {
  let calls = 0;
  const run = async () => { calls++; return { processed: 3, delivered: 2, skipped: 1, failed: 0, privateId: 'private-id', userEmail: 'private@example.test' }; };
  const response = await handleReminderCron(request(`Bearer ${secret}`), secret, run);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { processed: 3, delivered: 2, skipped: 1, failed: 0 });
  for (const suffix of ['?userId=other', '?eventId=other', '?now=2099-01-01', '?batchSize=999']) assert.equal((await handleReminderCron(request(`Bearer ${secret}`, suffix), secret, run)).status, 400);
  for (const method of ['HEAD','POST']) assert.equal((await handleReminderCron(request(`Bearer ${secret}`, '', method), secret, run)).status, 405);
  assert.equal(calls, 1);
  assert.equal((await handleReminderJob(request(`Bearer ${secret}`), secret, run)).status, 405);
  assert.equal(calls, 1); // The internal POST handler has not gained GET mutation.
});
test('processor exceptions and partial failures return safe 503 responses without private diagnostics', async () => {
  const response = await handleReminderCron(request(`Bearer ${secret}`), secret, async () => { throw new Error(`database error private@example.test ${secret}`); });
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'Scheduler unavailable' });
  const partial = await handleReminderCron(request(`Bearer ${secret}`), secret, async () => ({ processed: 2, delivered: 1, skipped: 0, failed: 1 }));
  assert.equal(partial.status, 503); assert.deepEqual(await partial.json(), { processed: 2, delivered: 1, skipped: 0, failed: 1 });
});
test('Vercel config uses five minutes and server route imports the shared core directly', () => {
  const config = JSON.parse(readFileSync('vercel.json','utf8'));
  assert.deepEqual(config.crons, [{ path: '/api/cron/reminders', schedule: '*/5 * * * *' }]);
  const route = readFileSync('src/app/api/cron/reminders/route.ts','utf8');
  assert.match(route, /import "server-only"/); assert.match(route, /processDueReminders\(getDb\(\)\)/);
  assert.match(route, /process\.env\.CRON_SECRET/); assert.match(route, /force-dynamic/);
  assert.ok(!route.includes('fetch(') && !route.includes('NEXT_PUBLIC_') && !route.includes('searchParams'));
});
