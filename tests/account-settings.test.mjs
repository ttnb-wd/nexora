import './support/application-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {accountMutationSchema}=await import('../src/features/account/schemas.ts');
const {deviceSummary}=await import('../src/features/account/session-display.ts');
const {safeReturnPath}=await import('../src/features/auth/return-path.ts');
test('settings reauthentication returns only to the explicit internal settings route',()=>{
 assert.equal(safeReturnPath('/dashboard/settings'),'/dashboard/settings');
 for(const path of ['https://evil.test/settings','//evil.test','/dashboard/settings?next=https://evil.test'])assert.equal(safeReturnPath(path),'/dashboard');
});
test('profile validates trimmed bounded names and rejects forged account/security fields',()=>{
 assert.equal(accountMutationSchema.parse({action:'profile',name:'  New name  '}).name,'New name');
 for(const name of ['',' ','x','x'.repeat(81)])assert.equal(accountMutationSchema.safeParse({action:'profile',name}).success,false);
 for(const extra of [{userId:'foreign'},{email:'changed@example.test'},{emailVerified:true},{image:'https://remote.test/a'}])assert.equal(accountMutationSchema.safeParse({action:'profile',name:'Valid name',...extra}).success,false);
});
test('password policy preserves exact characters and requires confirmation and current password',()=>{
 const input={action:'password',currentPassword:'existing password',newPassword:'  twelve characters  ',confirmPassword:'  twelve characters  '};
 assert.equal(accountMutationSchema.parse(input).newPassword,input.newPassword);
 for(const patch of [{currentPassword:''},{newPassword:'short',confirmPassword:'short'},{newPassword:'x'.repeat(129),confirmPassword:'x'.repeat(129)},{confirmPassword:'mismatch'}])assert.equal(accountMutationSchema.safeParse({...input,...patch}).success,false);
});
test('timezone preferences accept IANA names and clearing, reject offsets and unknown names',()=>{
 for(const timezone of ['Asia/Yangon','Asia/Singapore','America/New_York','UTC',''])assert.equal(accountMutationSchema.safeParse({action:'preferences',timezone}).success,true);
 for(const timezone of ['+06:30','UTC+6','not/a/timezone','x'.repeat(101)])assert.equal(accountMutationSchema.safeParse({action:'preferences',timezone}).success,false);
});
test('session revocation requires explicit confirmation; device summaries omit hostile raw metadata',()=>{
 assert.equal(accountMutationSchema.safeParse({action:'revoke',sessionId:'id',confirm:false}).success,false);
 assert.equal(accountMutationSchema.safeParse({action:'revokeOthers',confirm:true,token:'raw'}).success,false);
 assert.equal(deviceSummary('Mozilla Windows Chrome/130.0 secret-token 192.0.2.1'),'Chrome on Windows');
 assert.equal(deviceSummary('<script>alert(1)</script>'),'Browser on device');
 assert.equal(deviceSummary(null),'Unknown device');
});
