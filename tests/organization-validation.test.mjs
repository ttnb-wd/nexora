import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
const { createOrganizationSchema, updateOrganizationSchema } = await import('../src/features/organizations/schemas.ts');

test('organization inputs trim text, clear blank optional fields, and reject privilege fields', () => {
  const parsed = createOrganizationSchema.parse({ name: '  Test Community  ', slug: ' test-community ', city: ' Yangon ', website: ' ', role: 'OWNER', userId: 'other', visualTheme: 'fake' });
  assert.equal(parsed.name, 'Test Community');
  assert.equal(parsed.slug, 'test-community');
  assert.equal(parsed.city, 'Yangon');
  assert.equal(parsed.website, null);
  for (const field of ['role', 'userId', 'visualTheme']) assert.equal(field in parsed, false);
});
test('rejects malformed, oversized, and reserved organization slugs', () => {
  for (const slug of ['ab', 'A-company', 'with spaces', '-leading', 'trailing-', 'double--hyphen', 'under_score', '../company', 'create', 'settings', 'a'.repeat(65)]) {
    assert.equal(createOrganizationSchema.safeParse({ name: 'Test', slug }).success, false, slug);
  }
  assert.equal(createOrganizationSchema.safeParse({ name: 'Test', slug: 'company-123' }).success, true);
});
test('rejects unsafe website schemes, malformed URLs, credentials, and oversized optional values', () => {
  for (const website of ['example.com', 'javascript:alert(1)', 'ftp://example.com', 'https://user:password@example.com', 'https://']) {
    assert.equal(updateOrganizationSchema.safeParse({ name: 'Test', website }).success, false, website);
  }
  assert.equal(updateOrganizationSchema.safeParse({ name: 'Test', website: ' https://example.com/path ' }).success, true);
  for (const change of [{ name: ' ' }, { name: 'a'.repeat(121) }, { description: 'a'.repeat(2001) }, { shortName: 'a'.repeat(41) }]) {
    assert.equal(updateOrganizationSchema.safeParse({ name: 'Test', ...change }).success, false);
  }
});
test('settings never accept slug, owner identity, role, or presentation fields', () => {
  const parsed = updateOrganizationSchema.parse({ name: 'Updated', slug: 'changed', userId: 'other', organizationId: 'other', role: 'OWNER', logoVariant: 'orbit' });
  for (const field of ['slug', 'userId', 'organizationId', 'role', 'logoVariant']) assert.equal(field in parsed, false);
});
