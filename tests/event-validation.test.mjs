import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
const { createEventSchema, eventBasicInfoSchema, eventRegistrationSchema, eventDataFromInput } = await import('../src/features/events/management-schemas.ts');
const { zonedDateTimeToUtc, utcToLocalInputs } = await import('../src/features/events/timezone.ts');
const valid = { title: 'Test gathering', slug: 'test-gathering', description: 'A useful test gathering for the community.', category: 'Community', eventType: 'IN_PERSON', organizationId: '', startDate: '2030-06-20', startTime: '10:00', endDate: '2030-06-20', endTime: '12:00', timezone: 'Asia/Yangon', locationName: 'Community hall', city: 'Yangon', region: '', onlineUrl: '', capacity: '', registrationDeadline: '' };

test('composed schemas trim text and strip identity and lifecycle fields', () => {
  const parsed = createEventSchema.parse({ ...valid, title: '  Test gathering  ', creatorId: 'other', role: 'OWNER', status: 'PUBLISHED' });
  assert.equal(parsed.title, valid.title); assert.equal(parsed.organizationId, null); assert.equal(parsed.capacity, null);
  for (const key of ['creatorId', 'role', 'status']) assert.equal(key in parsed, false);
  assert.equal(eventBasicInfoSchema.safeParse(valid).success, true);
});
test('slug, description, category, and event type validation', () => {
  for (const change of [{ slug: 'AB C' }, { slug: '-test' }, { slug: 'test--event' }, { slug: 'a'.repeat(81) }, { title: ' ' }, { description: '' }, { category: 'Unrecognized' }, { eventType: 'REMOTE' }]) assert.equal(createEventSchema.safeParse({ ...valid, ...change }).success, false);
});
test('rejects invalid dates, missing explicit timezone, and reversed schedule', () => {
  for (const change of [{ timezone: '' }, { timezone: 'Mars/Olympus' }, { startDate: '2030-02-30' }, { startTime: '25:10' }, { endTime: '09:00' }, { endTime: '10:00' }]) assert.equal(createEventSchema.safeParse({ ...valid, ...change }).success, false);
});
test('converts explicit half-hour and quarter-hour timezones to UTC and round-trips', () => {
  assert.equal(zonedDateTimeToUtc('2030-06-20', '10:00', 'Asia/Yangon').toISOString(), '2030-06-20T03:30:00.000Z');
  assert.equal(zonedDateTimeToUtc('2030-06-20', '10:00', 'Asia/Kathmandu').toISOString(), '2030-06-20T04:15:00.000Z');
  assert.deepEqual(utcToLocalInputs(new Date('2030-06-20T03:30:00Z'), 'Asia/Yangon'), { date: '2030-06-20', time: '10:00' });
  const stored = eventDataFromInput(createEventSchema.parse(valid));
  assert.equal(stored.startAt.toISOString(), '2030-06-20T03:30:00.000Z'); assert.equal(stored.timezone, 'Asia/Yangon');
});
test('rejects missing and ambiguous daylight-saving wall times', () => {
  assert.throws(() => zonedDateTimeToUtc('2030-03-10', '02:30', 'America/New_York'), /does not exist/);
  assert.throws(() => zonedDateTimeToUtc('2030-11-03', '01:30', 'America/New_York'), /occurs twice/);
  assert.equal(zonedDateTimeToUtc('2030-11-03', '03:30', 'America/New_York').toISOString(), '2030-11-03T08:30:00.000Z');
});
test('validates venue and URL requirements by event type, clearing irrelevant fields', () => {
  assert.equal(createEventSchema.safeParse({ ...valid, locationName: '' }).success, false);
  assert.equal(createEventSchema.safeParse({ ...valid, eventType: 'ONLINE', onlineUrl: '' }).success, false);
  assert.equal(createEventSchema.safeParse({ ...valid, eventType: 'HYBRID', onlineUrl: 'https://example.com/join' }).success, true);
  for (const onlineUrl of ['javascript:alert(1)', 'ftp://example.com', 'https://user:password@example.com']) assert.equal(createEventSchema.safeParse({ ...valid, eventType: 'ONLINE', onlineUrl }).success, false);
  const stored = eventDataFromInput(createEventSchema.parse({ ...valid, eventType: 'ONLINE', onlineUrl: 'https://example.com' }));
  assert.equal(stored.locationName, null); assert.equal(stored.city, null);
});
test('capacity bounds and deadlines obey the explicit event timezone', () => {
  for (const capacity of ['0', '-1', '1.5', '2147483648', 'Infinity']) assert.equal(eventRegistrationSchema.safeParse({ capacity }).success, false);
  assert.equal(createEventSchema.safeParse({ ...valid, capacity: '25', registrationDeadline: '2030-06-20T10:00' }).success, true);
  assert.equal(createEventSchema.safeParse({ ...valid, registrationDeadline: '2030-06-20T10:01' }).success, false);
  assert.equal(createEventSchema.safeParse({ ...valid, registrationDeadline: '2030-06-20T09:00Textra' }).success, false);
  assert.equal(eventDataFromInput(createEventSchema.parse({ ...valid, registrationDeadline: '2030-06-20T09:00' })).registrationDeadline.toISOString(), '2030-06-20T02:30:00.000Z');
});
