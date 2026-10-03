import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
const { PrismaClient } = await import('../src/generated/prisma/client.ts');
assert.equal(process.env.NEXORA_DISPOSABLE_APPROVED,'1','Explicit disposable Neon approval required.');
nextEnv.loadEnvConfig(process.cwd());
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
      const output=execFileSync(process.execPath,['--import','./tests/support/runtime-isolation.mjs',`tests/${suite}.mjs`],{env,encoding:'utf8',timeout:300000,windowsHide:true});
      writeFileSync(`${reportRoot}/${reportPrefix}-${suite}.log`,output);
      const count=output.split('\n').filter(line=>line.startsWith('PASS')).length;
      summary.push({suite,ok:true,passGroups:count});console.log(`PASS ${suite}: ${count} scenario groups`);
    } catch(error) {
      writeFileSync(`${reportRoot}/${reportPrefix}-${suite}.log`,`${error.stdout??''}\n${error.stderr??''}`);
      summary.push({suite,ok:false});console.log(`FAIL ${suite}; see artifact log`);
    } finally { await db.rateLimit.deleteMany({where:{key:{startsWith:ratePrefix}}}); }
    writeFileSync(`${reportRoot}/${reportPrefix}-summary.json`,JSON.stringify(summary,null,2));
  }
} finally {await db.$disconnect();}
assert.ok(summary.every(result=>result.ok),'One or more runtime suites failed; inspect artifacts.');
