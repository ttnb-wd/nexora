import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
const { PrismaClient } = await import('../src/generated/prisma/client.ts');
nextEnv.loadEnvConfig(process.cwd());
const origin=process.env.STEP11_ORIGIN ?? process.env.APP_URL;
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL}),log:[]});
try {
 const organization=await db.organization.findFirst({select:{name:true,slug:true,description:true,industry:true,city:true,events:{select:{slug:true,status:true,startAt:true}}},orderBy:{slug:'asc'}});
 assert.ok(organization,'Existing real organization required');
 const escape=(s)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
 const companies=await fetch(`${origin}/companies`);assert.equal(companies.status,200);
 const directory=await companies.text();
 assert.ok(directory.includes(`/companies/${organization.slug}`) && directory.includes(escape(organization.name)));
 const profile=await fetch(`${origin}/companies/${organization.slug}`);assert.equal(profile.status,200);
 const html=await profile.text();
 assert.ok(html.includes(escape(organization.name)));
 for(const field of ['description','industry','city']) if(organization[field]) assert.ok(html.includes(escape(organization[field])));
 for(const event of organization.events) {
  const publiclyVisible=['PUBLISHED','COMPLETED'].includes(event.status);
  assert.equal(html.includes(`/events/${event.slug}`),publiclyVisible);
  if(publiclyVisible) {
   const detail=await fetch(`${origin}/events/${event.slug}`);assert.equal(detail.status,200);
   assert.ok((await detail.text()).includes(`/companies/${organization.slug}`));
  }
 }
 assert.equal((await fetch(`${origin}/companies/step11-unknown-organization`)).status,404);
 assert.ok(!html.includes('id="topics"') && !html.includes('id="team"'));
 for(const privateKey of ['"members"','"userId"','"creatorId"','"accounts"','"sessions"','"password"']) assert.ok(!html.includes(privateKey) && !directory.includes(privateKey));
 console.log(`PASS existing Neon organization ${organization.slug}: directory, profile, authored fields, 404, missing sections, privacy`);
 console.log(`Linked events: ${organization.events.length}. Event visibility and settings mutations require isolated test workflow when none exist.`);
} finally {await db.$disconnect();}
