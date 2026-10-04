import './support/application-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { authEmailTemplate } = await import('../src/lib/email/auth-template.ts');
const { emailRequestSchema, resetPasswordSchema } = await import('../src/features/auth/schemas.ts');
test('recovery validation normalizes email and preserves password policy and confirmation',()=>{
 assert.equal(emailRequestSchema.parse({email:'  TEST@example.com '}).email,'test@example.com');
 for(const newPassword of ['short','x'.repeat(129)])assert.equal(resetPasswordSchema.safeParse({token:'private',newPassword,confirmPassword:newPassword}).success,false);
 assert.equal(resetPasswordSchema.safeParse({token:'private',newPassword:'a long passphrase',confirmPassword:'different'}).success,false);
 assert.equal(resetPasswordSchema.safeParse({token:'private',newPassword:'a long passphrase',confirmPassword:'a long passphrase'}).success,true);
});
test('authentication templates escape URLs and contain transactional security copy',()=>{
 for(const kind of ['verification','reset']) {
 const mail=authEmailTemplate(kind,'https://nexora.test/api/auth/verify-email?token=a&callbackURL=%22');
 assert.ok(mail.html.includes('&amp;'));assert.ok(mail.text.includes('token=a&callbackURL='));assert.ok(mail.text.includes('ignore'));assert.ok(!mail.html.includes('<img'));assert.ok(mail.text.includes(kind==='reset'?'1 hour':'24 hours'));
 }
 assert.throws(()=>authEmailTemplate('reset','javascript:alert(1)'));
});
