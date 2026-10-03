import './support/typescript-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { resolvePublicAppUrl, isLoopbackUrl } = await import('../src/lib/public-url.ts');
const { isNavigationActive } = await import('../src/config/site.ts');
const { newTicket, ticketUrl, parseTicketToken } = await import('../src/features/tickets/token.ts');
const auth = 'http://localhost:3000';
test('public origin overrides auth origin, accepts LAN in development and requires HTTPS in production', () => {
  assert.equal(resolvePublicAppUrl(undefined, auth), auth);
  assert.equal(resolvePublicAppUrl('  ', auth), auth);
  assert.equal(resolvePublicAppUrl('http://192.168.1.50:3000/', auth), 'http://192.168.1.50:3000');
  assert.equal(resolvePublicAppUrl('https://nexora.example/', auth, true), 'https://nexora.example');
  for (const value of ['not-a-url', 'ftp://example.com', 'https://secret@example.com', 'https://example.com/path', 'https://example.com?key=secret', 'https://example.com#secret']) assert.throws(() => resolvePublicAppUrl(value, auth));
  assert.throws(() => resolvePublicAppUrl('http://192.168.1.50:3000', auth, true));
  assert.ok(isLoopbackUrl(auth)); assert.ok(isLoopbackUrl('http://127.0.0.2')); assert.ok(isLoopbackUrl('http://[::1]'));
  assert.equal(isLoopbackUrl('http://192.168.1.50:3000'), false);
});
test('LAN QR preserves opaque fragment credential and accepts only configured public/auth origins and public event context', () => {
  const origin = resolvePublicAppUrl('http://192.168.1.50:3000', auth);
  const { token } = newTicket('test-secret-that-is-at-least-thirty-two-characters');
  const url = ticketUrl(token, origin, 'public-event');
  assert.equal(new URL(url).origin, origin); assert.ok(!url.includes('localhost'));
  assert.equal(new URL(url).searchParams.get('event'), 'public-event');
  assert.equal(new URL(url).hash, `#${token}`);
  assert.equal(parseTicketToken(url, [auth, origin]), token);
  assert.equal(parseTicketToken(ticketUrl(token, auth), [auth, origin]), token);
  for (const invalid of [url.replace(origin, 'https://attacker.example'), url.replace('event=public-event', 'event=public-event&email=private'), url.replace('event=public-event', 'event=public-event&event=other'), url.replace('event=public-event', 'event=../private')]) assert.equal(parseTicketToken(invalid, [auth, origin]), null);
});
test('navigation context follows discovery and company detail without marking unrelated areas active', () => {
  for (const path of ['/explore', '/events/community-day']) assert.ok(isNavigationActive(path, '/explore'));
  for (const path of ['/companies', '/companies/community']) assert.ok(isNavigationActive(path, '/companies'));
  for (const path of ['/dashboard', '/events/community-day', '/companies-other']) assert.equal(isNavigationActive(path, '/companies'), false);
  assert.equal(isNavigationActive('/dashboard/joined', '/explore'), false);
});
