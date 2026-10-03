import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const tokenApi = await import('../src/features/tickets/token.ts');
const { loadOwnTicket, checkInByTicket } = await import('../src/features/tickets/server/service.ts');
const secret = 'test-secret-that-is-at-least-thirty-two-characters';
const origin = 'https://nexora.example';

test('credentials have 256-bit output, unique random nonces, stable owner recovery and no embedded identity', () => {
  const tickets = Array.from({ length: 200 }, () => tokenApi.newTicket(secret));
  assert.equal(new Set(tickets.map(ticket => ticket.token)).size, 200);
  for (const ticket of tickets) {
    assert.match(ticket.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(Buffer.from(ticket.token, 'base64url').length, 32);
    assert.equal(tokenApi.tokenFromNonce(ticket.ticketNonce, secret), ticket.token);
    assert.notEqual(tokenApi.tokenFromNonce(ticket.ticketNonce, 'another-secret-at-least-thirty-two-characters'), ticket.token);
    assert.equal(tokenApi.hashTicketToken(ticket.token), ticket.ticketTokenHash);
    assert.notEqual(ticket.ticketNonce, ticket.token);
  }
});
test('QR credential remains in a fragment and input rejects foreign origins, paths, query strings and oversized payloads', () => {
  const { token } = tokenApi.newTicket(secret);
  const url = tokenApi.ticketUrl(token, origin);
  assert.equal(new URL(url).pathname, '/check-in/ticket');
  assert.equal(new URL(url).hash, `#${token}`);
  assert.equal(tokenApi.parseTicketToken(url, origin), token);
  assert.equal(tokenApi.parseTicketToken(` ${token} `, origin), token);
  for (const input of [null, {}, 'x'.repeat(2049), 'forged', url.replace(origin, 'https://attacker.example'), url.replace('/check-in/ticket', '/other'), `${origin}/check-in/ticket?email=private#${token}`]) assert.equal(tokenApi.parseTicketToken(input, origin), null);
});

function setup() {
  const event = { id: 'event', slug: 'event-slug', title: 'Private event', status: 'PUBLISHED', endAt: new Date('2090-01-02'), startAt: new Date('2090-01-01') };
  const row = { id: 'registration', eventId: event.id, userId: 'attendee', status: 'REGISTERED', ticketNonce: null, ticketTokenHash: null, ticketIssuedAt: null, user: { name: 'Private Attendee' }, event };
  const writes = [], identityReads = []; let authorized = true, count = 1, tail = Promise.resolve();
  const tx = {
    $queryRaw: async () => [{ count }],
    event: { findFirst: async ({ where }) => authorized && where.id === event.id && where.organization?.slug === 'organization' ? event : null },
    eventRegistration: {
      findFirst: async ({ where }) => where.userId === row.userId && where.event.slug === event.slug ? row : null,
      findUnique: async ({ where, select }) => {
        if (select.user) { identityReads.push(where); return { user: row.user }; }
        return where.ticketTokenHash && where.ticketTokenHash === row.ticketTokenHash ? { id: row.id, eventId: row.eventId, status: row.status, ticketIssuedAt: row.ticketIssuedAt } : null;
      },
      update: async ({ data }) => { writes.push(data); Object.assign(row, data); return row; },
      updateMany: async ({ where, data }) => { if (row.status !== where.status) return { count: 0 }; writes.push(data); Object.assign(row, data); return { count: 1 }; },
    },
  };
  const db = { $queryRaw: tx.$queryRaw, $transaction: async callback => { const previous = tail; let finish; tail = new Promise(resolve => { finish = resolve; }); await previous; try { return await callback(tx); } finally { finish(); } } };
  const scan = token => checkInByTicket(db, 'organizer', { eventId: event.id, scope: 'organization', token }, origin);
  return { event, row, db, writes, identityReads, scan, setAuthorized: value => { authorized = value; }, setCount: value => { count = value; } };
}
test('owner-only lazy issuance serializes duplicate views and stores no raw token; read-only view does not issue', async () => {
  const state = setup();
  assert.equal(await loadOwnTicket(state.db, 'outsider', 'event-slug', secret, true), null);
  assert.equal(await loadOwnTicket(state.db, 'attendee', 'event-slug', secret), null);
  const views = await Promise.all([1, 2].map(() => loadOwnTicket(state.db, 'attendee', 'event-slug', secret, true)));
  assert.equal(views[0].token, views[1].token); assert.equal(state.writes.length, 1);
  assert.ok(!JSON.stringify(state.writes).includes(views[0].token));
  state.row.status = 'CANCELLED'; assert.equal(await loadOwnTicket(state.db, 'attendee', 'event-slug', secret, true), null);
});
test('concurrent valid scans reuse manual attendance transition and preserve original audit data', async () => {
  const state = setup(); const ticket = await loadOwnTicket(state.db, 'attendee', 'event-slug', secret, true);
  const results = await Promise.all([1, 2].map(() => state.scan(ticket.token)));
  assert.ok(results.every(result => result.ok)); assert.match(results[1].message, /already checked in/);
  assert.equal(state.row.status, 'ATTENDED'); assert.equal(state.row.checkedInById, 'organizer'); assert.ok(state.row.checkedInAt instanceof Date);
  assert.equal(state.writes.filter(write => write.status).length, 1);
  assert.equal(results[0].name, 'Private Attendee'); assert.ok(!JSON.stringify(results).includes('registration'));
});
test('unauthorized, wrong-event, revoked, unknown, cancelled and ended tickets reveal no attendee identity', async () => {
  for (const failure of ['unauthorized', 'wrong-event', 'unknown', 'cancelled', 'revoked', 'ended', 'draft', 'archived', 'event-cancelled', 'waitlisted', 'limit']) {
    const state = setup(); const ticket = await loadOwnTicket(state.db, 'attendee', 'event-slug', secret, true);
    if (failure === 'unauthorized') state.setAuthorized(false);
    if (failure === 'wrong-event') state.row.eventId = 'another-event';
    if (failure === 'cancelled') state.row.status = 'CANCELLED';
    if (failure === 'waitlisted') state.row.status = 'WAITLISTED';
    if (failure === 'revoked') state.row.ticketTokenHash = null;
    if (failure === 'ended') state.event.endAt = new Date(0);
    if (['draft', 'archived', 'event-cancelled'].includes(failure)) state.event.status = failure === 'event-cancelled' ? 'CANCELLED' : failure.toUpperCase();
    if (failure === 'limit') state.setCount(61);
    const result = await state.scan(failure === 'unknown' ? tokenApi.newTicket(secret).token : ticket.token);
    assert.ok(!result.ok, failure); assert.ok(!result.name, failure); assert.equal(state.identityReads.length, 0, failure);
    if (failure === 'wrong-event') assert.equal(result.message, 'This ticket is for a different event.');
  }
});
test('server-key rotation replaces a ticket on explicit view; old credential remains invalid', async () => {
  const state = setup(); const old = await loadOwnTicket(state.db, 'attendee', 'event-slug', secret, true);
  const rotated = await loadOwnTicket(state.db, 'attendee', 'event-slug', 'new-key-at-least-thirty-two-characters', true);
  assert.notEqual(old.token, rotated.token); assert.ok(!(await state.scan(old.token)).ok); assert.ok((await state.scan(rotated.token)).ok);
});
test('public landing page has no private lookup and GET performs no attendance mutation', () => {
  const page = readFileSync('src/app/(public)/check-in/ticket/page.tsx', 'utf8');
  for (const privateField of ['getDb', 'getCurrentUser', 'checkedInById', 'email', 'ticketTokenHash']) assert.ok(!page.includes(privateField));
});
