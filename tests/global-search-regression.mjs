import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import nextEnv from '@next/env';
assert.equal(process.env.STEP25_DISPOSABLE_APPROVED,'1');
nextEnv.loadEnvConfig(process.cwd(),true);
const {getDb}=await import('../src/lib/db.ts'),db=getDb(),root='artifacts/step25/regression-'+randomUUID();mkdirSync(root,{recursive:true});
const report={suites:[],existingBusinessRecordsUnchanged:false};
const env={...process.env,NEXORA_DISPOSABLE_APPROVED:'1',NEXORA_AUTH_EMAIL_MOCK:'1',NODE_OPTIONS:'--import=./tests/support/mock-auth-email.mjs --import=./tests/support/verified-regression-users.mjs',STEP18_DISPOSABLE_APPROVED:'1',STEP19_DISPOSABLE_APPROVED:'1',STEP20_DISPOSABLE_APPROVED:'1',STEP21_DISPOSABLE_APPROVED:'1',STEP22_DISPOSABLE_APPROVED:'1',STEP23_DISPOSABLE_APPROVED:'1',STEP24_DISPOSABLE_APPROVED:'1',STEP18_BROWSER_HOLD:'0',STEP17_BROWSER_HOLD:'0'};
const suites=['all-runtime-suite','reminder-scheduler-runtime','post-event-runtime','organization-team-runtime','transactional-email-runtime','auth-lifecycle-runtime','account-settings-runtime'];
const selected=process.argv.slice(2);assert.ok(selected.every(suite=>suites.includes(suite)),'Unknown regression suite.');
async function fingerprint(){const result={};for(const{tablename}of await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`){if(tablename==='RateLimit')continue;const name='"'+tablename.replaceAll('"','""')+'"';const[row]=await db.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t."id")::text,'[]')) AS digest FROM ${name} t`);result[tablename]=row;}return result;}
const baseline=await fingerprint();
try{
 for(const suite of selected.length?selected:suites){
  console.log('RUN '+suite);
  const result=await new Promise((done,reject)=>{const child=spawn(process.execPath,['tests/'+suite+'.mjs'],{windowsHide:true,env});let output='';const timer=setTimeout(()=>{child.kill();reject(new Error('Regression timed out: '+suite));},1200000);child.stdout.on('data',data=>{output+=data;for(const line of data.toString().split('\n'))if(/^(PASS|FAIL|RUN|Step.*report)/u.test(line))console.log(line);});child.stderr.on('data',data=>output+=data);child.on('error',reject);child.on('close',code=>{clearTimeout(timer);done({code,output});});});
  writeFileSync(root+'/'+suite+'.log',result.output);report.suites.push({suite,ok:result.code===0,passGroups:result.output.split('\n').filter(line=>line.startsWith('PASS')).length});
  writeFileSync(root+'/regression.json',JSON.stringify(report,null,2));
 }
}finally{
 assert.deepEqual(await fingerprint(),baseline);report.existingBusinessRecordsUnchanged=true;writeFileSync(root+'/regression.json',JSON.stringify(report,null,2));await db.$disconnect();console.log('Regression report '+root+'/regression.json');
}
assert.ok(report.suites.every(suite=>suite.ok),'Inspect failed regression logs.');
