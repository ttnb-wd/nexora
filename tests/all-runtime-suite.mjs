import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
const { PrismaClient } = await import('../src/generated/prisma/client.ts');
assert.equal(process.env.NEXORA_DISPOSABLE_APPROVED,'1','Explicit disposable Neon approval required.');
nextEnv.loadEnvConfig(process.cwd());
// Always use a dedicated server that cannot send real authentication emails.
const origin = 'http://127.0.0.1:3007';
Object.assign(process.env, { APP_URL: origin, PUBLIC_APP_URL: ' ', NEXORA_AUTH_EMAIL_MOCK: '1' });
const server = spawn(process.execPath, ['--import','./tests/support/mock-auth-email.mjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3007'], { windowsHide:true, env:{...process.env,NODE_ENV:'production'}, stdio:'ignore' });
try {
  let ready = false;
  for (let i=0;i<100;i++) {
    if(server.exitCode!==null) throw new Error('Mocked regression server failed to start.');
    try { ready=(await fetch(origin+'/sign-in')).ok; } catch { /* startup */ }
    if(ready)break;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert.ok(ready,'Mocked regression server did not become ready.');
} catch(error) { server.kill(); throw error; }
const db = new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL}),log:[]});
const suites = ['neon-runtime','organization-runtime','event-runtime','public-event-runtime','public-organization-runtime','participation-runtime','follow-notification-runtime','event-content-runtime','attendees-runtime','calendar-reminders-runtime','tickets-runtime','neon-public-routes','public-organization-readonly','participation-readonly','analytics-runtime'];
const reportRoot = process.env.STEP20_DISPOSABLE_APPROVED === '1' ? 'artifacts/step20' : process.env.STEP18_DISPOSABLE_APPROVED === '1' ? 'artifacts/step18' : 'artifacts';
const reportPrefix = process.env.STEP18_DISPOSABLE_APPROVED === '1' ? 'regression' : 'step17-regression';
mkdirSync(reportRoot,{recursive:true});
const selected=process.argv.slice(2);
assert.ok(selected.every(suite=>suites.includes(suite)),'Unknown runtime suite.');
const summary=selected.length && existsSync(`${reportRoot}/${reportPrefix}-summary.json`) ? JSON.parse(readFileSync(`${reportRoot}/${reportPrefix}-summary.json`,'utf8')).filter(result=>!selected.includes(result.suite)) : [];
try {
  for(const suite of selected.length ? selected : suites) {
    const hex=randomBytes(6).toString('hex');
    const ratePrefix=`fd18:${hex.slice(0,4)}:${hex.slice(4,8)}:${hex.slice(8,12)}:`;
    const env={...process.env, NEXORA_RUNTIME_IP:`${ratePrefix}:1`, STEP12_ORIGIN:process.env.APP_URL, STEP14_DISPOSABLE_APPROVED:'1',STEP15_DISPOSABLE_APPROVED:'1',STEP16_DISPOSABLE_APPROVED:'1',STEP17_DISPOSABLE_APPROVED:'1',STEP17_BROWSER_HOLD:'0',STEP18_DISPOSABLE_APPROVED:'1',STEP18_BROWSER_HOLD:'0'};
    console.log(`RUN ${suite}`);
    try {
      const output=execFileSync(process.execPath,['--import','./tests/support/mock-auth-email.mjs','--import','./tests/support/verified-regression-users.mjs','--import','./tests/support/runtime-isolation.mjs',`tests/${suite}.mjs`],{env,encoding:'utf8',timeout:300000,windowsHide:true});
      writeFileSync(`${reportRoot}/${reportPrefix}-${suite}.log`,output);
      const count=output.split('\n').filter(line=>line.startsWith('PASS')).length;
      summary.push({suite,ok:true,passGroups:count});console.log(`PASS ${suite}: ${count} scenario groups`);
    } catch(error) {
      writeFileSync(`${reportRoot}/${reportPrefix}-${suite}.log`,`${error.stdout??''}\n${error.stderr??''}`);
      summary.push({suite,ok:false});console.log(`FAIL ${suite}; see artifact log`);
    } finally { await db.rateLimit.deleteMany({where:{key:{startsWith:ratePrefix}}}); }
    writeFileSync(`${reportRoot}/${reportPrefix}-summary.json`,JSON.stringify(summary,null,2));
  }
} finally {server.kill(); await db.$disconnect();}
assert.ok(summary.every(result=>result.ok),'One or more runtime suites failed; inspect artifacts.');
