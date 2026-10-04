import './application-loader.mjs';
import nextEnv from '@next/env';
import assert from 'node:assert/strict';
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {getIP} from 'better-auth/api';
assert.equal(process.env.STEP24_DISPOSABLE_APPROVED,'1');nextEnv.loadEnvConfig(process.cwd(),true);
const{getDb}=await import('../../src/lib/db.ts');const db=getDb();
const{lifecycleKey}=await import('../../src/features/auth/server/lifecycle-rate-limit.ts');
try{
 const file='artifacts/step24/browser-fixture.json';const fixture=JSON.parse(readFileSync(file,'utf8'));assert.equal(fixture.email,'s24-'+fixture.root.split('/').at(-1)+'-browser@example.test');
 const ips=[...new Set(['127.0.0.1','::1'].map(ip=>getIP(new Request('http://localhost:3009',{headers:{'X-Forwarded-For':ip}}),{})))];
 const keys=ips.flatMap(ip=>[ip+'|/sign-in/email',ip+'|/get-session',lifecycleKey(ip,'account-sessions-ip')]);
 // Only test-origin rows touched after this disposable browser fixture started.
 const cleanup=await db.rateLimit.deleteMany({where:{key:{in:keys},lastRequest:{gte:BigInt(Math.floor(statSync(file).mtimeMs))}}});
 const audit={browserRateRowsCleaned:cleanup.count,disposableUsers:await db.user.count({where:{email:{startsWith:'s24-'}}}),accountRateRows:await db.rateLimit.count({where:{key:{startsWith:'auth-lifecycle:account-'}}}),userCount:await db.user.count(),accountCount:await db.account.count(),sessionCount:await db.session.count(),verificationRows:await db.verification.count()};
 assert.equal(audit.disposableUsers,0);assert.equal(audit.accountRateRows,0);audit.ok=true;writeFileSync('artifacts/step24/final-audit.json',JSON.stringify(audit,null,2));console.log(JSON.stringify(audit));
}finally{await db.$disconnect();}
