import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const { mapPublicEvent, publicEventSelect } = await import('../src/features/events/server/public-event-mapper.ts');
const { filterEvents, initialFilters } = await import('../src/features/events/filter-events.ts');

const now = new Date('2026-10-02T12:00:00Z');
const record = { id: 'event-id', slug: 'real-gathering', title: 'A real gathering', description: 'The full organizer description.', shortDescription: 'A short introduction.', category: 'Design', locationName: 'Studio', city: 'Yangon', region: 'Yangon', startAt: new Date('2026-10-02T23:30:00Z'), endAt: new Date('2026-10-03T01:00:00Z'), timezone: 'Asia/Yangon', eventType: 'HYBRID', status: 'PUBLISHED', creator: { name: 'Creator display name' }, organization: { name: 'Real Organization', slug: 'real-organization', industry: 'Design', city: 'Yangon', region: 'Myanmar', visualTheme: null } };

test('public DTO uses event timezone, actual organizer identity, and authored descriptions', () => {
  const event = mapPublicEvent(record, now);
  assert.equal(event.date, '2026-10-03');
  assert.match(event.time, /6:00 AM/);
  assert.equal(event.startAt, record.startAt.toISOString());
  assert.equal(event.type, 'Hybrid');
  assert.equal(event.organizer.name, 'Real Organization');
  assert.equal(event.organizer.slug, 'real-organization');
  assert.equal(event.description, record.shortDescription);
  assert.deepEqual(event.details.about, [record.description]);
  assert.deepEqual(event.details.agenda, []);
  assert.deepEqual(event.details.speakers, []);
  assert.deepEqual(event.details.resources, []);
});

test('public projection and serialized DTO exclude private fields', () => {
  assert.deepEqual(publicEventSelect.creator, { select: { name: true } });
  const event = mapPublicEvent(record, now);
  for (const key of ['email', 'creatorId', 'organizationId', 'accounts', 'sessions', 'members', 'password', 'role']) {
    assert.ok(!(key in publicEventSelect), `Public database projection contains ${key}`);
    if (key !== 'organizationId') assert.ok(!(key in event), `DTO contains ${key}`);
  }
  assert.equal(event.organizationId, '');
  assert.equal(event.organizer.location, 'Yangon, Myanmar');
});

test('long authored content stays intact in About while card and artwork previews fit their existing layouts', () => {
  const description = 'A detailed event description. '.repeat(100);
  const event = mapPublicEvent({ ...record, title: 'A long event title for an important gathering with a lot of information', shortDescription: null, description }, now);
  assert.deepEqual(event.details.about, [description]);
  assert.ok(event.description.length <= 281);
  assert.ok(event.visual.headline.length <= 33);
  assert.ok(event.visual.caption.length <= 81);
});

test('individual, unknown-category, missing-description, and completed fallbacks do not fabricate content', () => {
  const event = mapPublicEvent({ ...record, category: null, organization: null, description: null, shortDescription: null, status: 'COMPLETED' }, now);
  assert.deepEqual(event.organizer, { name: record.creator.name });
  assert.equal(event.category, 'Other');
  assert.deepEqual(event.details.about, []);
  assert.equal(event.status, 'completed');
  assert.equal(event.details.availability, 'This event has ended');
  assert.equal(mapPublicEvent({ ...record, startAt: new Date('2026-10-01T23:30:00Z') }, now).status, 'completed');
});

test('filters search real organizer names and compare instants across date/month boundaries', () => {
  const first = mapPublicEvent(record, now);
  const later = mapPublicEvent({ ...record, id: 'later', title: 'Later gathering', startAt: new Date('2026-11-01T00:00:00Z') }, now);
  assert.deepEqual(filterEvents([first, later], { ...initialFilters, query: 'real organization' }, 'soonest', now).map((event) => event.id), ['event-id', 'later']);
  assert.deepEqual(filterEvents([first, later], { ...initialFilters, date: 'This week' }, 'soonest', now).map((event) => event.id), ['event-id']);
  assert.deepEqual(filterEvents([first, later], { ...initialFilters, date: 'This month' }, 'soonest', now).map((event) => event.id), ['event-id']);
  assert.deepEqual(filterEvents([first, later], { ...initialFilters, date: 'Later' }, 'soonest', now).map((event) => event.id), ['later']);
  assert.equal(filterEvents([first], { ...initialFilters, category: 'AI' }, 'recommended', now).length, 0);
  assert.equal(filterEvents([first], { ...initialFilters, type: 'Online' }, 'recommended', now).length, 0);
  assert.equal(filterEvents([first], { ...initialFilters, location: 'Mandalay' }, 'recommended', now).length, 0);
});
