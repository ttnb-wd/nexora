import assert from 'node:assert/strict';
import test from 'node:test';
import { signInSchema, signUpSchema } from '../src/features/auth/schemas.ts';
import { authErrorMessage } from '../src/features/auth/errors.ts';
import { hashPassword, verifyPassword } from 'better-auth/crypto';

test('normalizes email/name while preserving exact password characters', () => {
  const input = signUpSchema.parse({ name: '  Test Person  ', email: '  TEST@EXAMPLE.COM  ', password: '  a long passphrase  ' });
  assert.equal(input.email, 'test@example.com');
  assert.equal(input.name, 'Test Person');
  assert.equal(input.password, '  a long passphrase  ');
});
test('rejects malformed, missing, short, and excessively long input', () => {
  const valid = { name: 'Test Person', email: 'test@example.com', password: 'a long passphrase' };
  for (const change of [{ name: '' }, { email: 'not-email' }, { password: 'short' }, { password: 'x'.repeat(129) }]) {
    assert.equal(signUpSchema.safeParse({ ...valid, ...change }).success, false);
  }
  assert.equal(signInSchema.safeParse({ email: 'test@example.com', password: '' }).success, false);
});
test('drops identity, role, and redirect values supplied by a client', () => {
  const input = signUpSchema.parse({ name: 'Test Person', email: 'test@example.com', password: 'a long passphrase', id: 'administrator', role: 'OWNER', callbackURL: 'https://untrusted.example' });
  assert.deepEqual(Object.keys(input).sort(), ['email', 'name', 'password']);
});
test('uses safe messages for duplicate email, invalid credentials, and internal failures', () => {
  assert.equal(authErrorMessage({ code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' }), 'An account with this email already exists.');
  assert.equal(authErrorMessage({ code: 'INVALID_EMAIL_OR_PASSWORD' }), 'Invalid email or password.');
  assert.equal(authErrorMessage({ code: 'P2002', status: 500 }), 'Account access is temporarily unavailable. Please try again shortly.');
});
test('Better Auth password hashing uses unique salts and rejects the wrong password', async () => {
  const password = 'a long test passphrase';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword({ hash: first, password }), true);
  assert.equal(await verifyPassword({ hash: first, password: 'wrong password' }), false);
});
