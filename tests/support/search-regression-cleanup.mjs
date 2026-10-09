import './application-loader.mjs';
import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import {getIP} from 'better-auth/api';
assert.equal(process.env.STEP25_DISPOSABLE_APPROVED,'1');
nextEnv.loadEnvConfig(process.cwd(),true);
const {getDb}=await import('../../src/lib/db.ts'),db=getDb();
const {lifecycleKey}=await import('../../src/features/auth/server/lifecycle-rate-limit.ts');
// Exact run identities only: never expire or delete unrelated rate-limit rows.
try{
 for(const argument of process.argv.slice(2)){
  const [kind,run]=argument.split('=');assert.ok(['19','20','21','22'].includes(kind));assert.match(run,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);
  const prefix=kind==='19'?'step19-runtime-test-'+run:'s'+kind+'-'+run;
  assert.equal(await db.user.count({where:{email:{startsWith:prefix}}}),0,'Fixture user must already be deleted.');
  const labels=kind==='19'?['']:kind==='20'?['owner','admin','editor','member','attendee','second','outsider']:kind==='21'?['owner','admin','editor','member','invited','decliner','outsider','browser-invitee']:['owner','recipient','browser-recipient','outsider'];
  const keys=[];
  for(let i=0;i<labels.length;i++){
   const email=prefix+(labels[i]?'-'+labels[i]:'')+'@example.test';
   keys.push(lifecycleKey(email,'signup-cooldown'),lifecycleKey(email,'signup-hour'));
   const ip=kind==='19'?`fd19:${run.slice(0,4)}:${run.slice(9,13)}:${run.slice(14,18)}::1`:`fd${kind}:${run.slice(0,4)}:${run.slice(9,13)}:${i+1}::1`;
   const normalized=getIP(new Request('http://127.0.0.1',{headers:{'X-Forwarded-For':ip}}),{});
   keys.push(lifecycleKey(ip,'email-ip'));if(normalized)keys.push(lifecycleKey(normalized,'email-ip'));
  }
  const result=await db.rateLimit.deleteMany({where:{key:{in:keys}}});assert.equal(await db.rateLimit.count({where:{key:{in:keys}}}),0);console.log('Cleaned '+result.count+' disposable Step '+kind+' lifecycle-limit keys.');
 }
}finally{await db.$disconnect();}
