// Run existing disposable regression suites with isolated auth rate-limit keys.
import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
const { PrismaClient } = await import('../src/generated/prisma/client.ts');
nextEnv.loadEnvConfig(process.cwd());
assert.ok(process.env.STEP14_DISPOSABLE_APPROVED==='1'||process.env.STEP15_DISPOSABLE_APPROVED==='1'||process.env.STEP16_DISPOSABLE_APPROVED==='1','Disposable runtime approval required.');
const suites=['organization-runtime.mjs','event-runtime.mjs','public-event-runtime.mjs','public-organization-runtime.mjs','public-organization-readonly.mjs','participation-runtime.mjs','participation-readonly.mjs','follow-notification-runtime.mjs'];
const suite=process.argv[2];assert.ok(suites.includes(suite));
const run=randomUUID().replaceAll('-','');
const ip=`fd14:${run.slice(0,4)}:${run.slice(4,8)}:${run.slice(8,12)}::1`;
const ratePrefix=`fd14:${run.slice(0,4)}:${run.slice(4,8)}:${run.slice(8,12)}:0000:0000:0000:0000|`;
const originalFetch=globalThis.fetch;
globalThis.fetch=(url,options={})=>{
  const headers=new Headers(options.headers);
  if(!headers.has('X-Forwarded-For')) headers.set('X-Forwarded-For',ip);
  return originalFetch(url,{...options,headers});
};
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL}),log:[]});
try { await import(`./${suite}`); }
finally {
  globalThis.fetch=originalFetch;
  await db.rateLimit.deleteMany({where:{key:{startsWith:ratePrefix}}});
  assert.equal(await db.rateLimit.count({where:{key:{startsWith:ratePrefix}}}),0);
  await db.$disconnect();
}
