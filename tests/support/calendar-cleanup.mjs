// Recover a recorded disposable Step16 run if its connection failed during cleanup.
import './typescript-loader.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
const { PrismaClient } = await import('../../src/generated/prisma/client.ts');
nextEnv.loadEnvConfig(process.cwd());
assert.equal(process.env.STEP16_DISPOSABLE_APPROVED,'1');
const run=process.argv[2];assert.match(run,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const path=`artifacts/step16-runtime-${run}.json`,ledger=JSON.parse(readFileSync(path,'utf8'));assert.equal(ledger.run,run);
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL}),log:[]});
const hex=run.replaceAll('-',''),ratePrefix=`fd16:${hex.slice(0,4)}:${hex.slice(4,8)}:${hex.slice(8,12)}:0000:0000:0000:0000|`;
try{
 await db.event.deleteMany({where:{id:{in:ledger.created.events},slug:{startsWith:`s16-${run}-`}}});
 await db.user.deleteMany({where:{id:{in:ledger.created.users},email:{startsWith:`step16-${run}-`}}});
 await db.rateLimit.deleteMany({where:{key:{startsWith:ratePrefix}}});
 assert.equal(await db.event.count({where:{id:{in:ledger.created.events}}}),0);
 assert.equal(await db.user.count({where:{id:{in:ledger.created.users}}}),0);
 for(const model of['eventRegistration','eventReminderPreference','eventBookmark'])assert.equal(await db[model].count({where:{eventId:{in:ledger.created.events}}}),0);
 for(const model of['session','account','notification'])assert.equal(await db[model].count({where:{userId:{in:ledger.created.users}}}),0);
 assert.equal(await db.rateLimit.count({where:{key:{startsWith:ratePrefix}}}),0);
 ledger.cleanupVerified=true;ledger.recoveredCleanup=true;ledger.failure={message:'Neon connection closed during the repeat test run; exact fixture cleanup recovered.'};
 writeFileSync(path,JSON.stringify(ledger,null,2));console.log('Recovered exact disposable fixture cleanup. This interrupted run is not a passed test run.');
}finally{await db.$disconnect();}
