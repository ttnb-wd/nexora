import './application-loader.mjs';
import nextEnv from '@next/env';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
assert.equal(process.env.STEP24_DISPOSABLE_APPROVED,'1');
nextEnv.loadEnvConfig(process.cwd(),true);
const fixture=JSON.parse(readFileSync('artifacts/step24/browser-fixture.json','utf8'));
assert.match(fixture.root,/^artifacts\/step24\/[0-9a-f-]{36}$/);
assert.equal(fixture.email,'s24-'+fixture.root.split('/').at(-1)+'-browser@example.test');
const{getDb}=await import('../../src/lib/db.ts');const db=getDb();
try{await db.user.update({where:{email:fixture.email},data:{emailVerified:false}});console.log('Disposable browser fixture set to unverified');}finally{await db.$disconnect();}
