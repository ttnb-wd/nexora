import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
const { PrismaClient } = await import('../src/generated/prisma/client.ts');
nextEnv.loadEnvConfig(process.cwd());
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL}),log:[]});
const origin = process.env.STEP12_ORIGIN;
assert.ok(origin && ['localhost','127.0.0.1'].includes(new URL(origin).hostname));
try {
 const event=await db.event.findFirst({where:{status:'PUBLISHED',startAt:{gt:new Date()}},select:{slug:true,title:true},orderBy:{startAt:'asc'}});
 const manifest=JSON.parse(readFileSync('.next/server/server-reference-manifest.json','utf8'));
 for(const name of ['joinEvent','saveEvent']) {
  const [actionId]=Object.entries(manifest.node).find(([,entry])=>entry.exportedName===name);
  const response=await fetch(`${origin}/events/runtime-unknown-event`,{method:'POST',headers:{Origin:origin,'Next-Action':actionId,'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(['runtime-unknown-event'])});
  const actionBody=await response.text();
  assert.ok(actionBody.includes('Please sign in to continue.')&&actionBody.includes('/sign-in?returnTo='));
 }
 for(const path of ['/dashboard','/dashboard/joined','/dashboard/saved']){
  const page=await fetch(`${origin}${path}`,{redirect:'manual'});assert.equal(page.status,307);assert.equal(page.headers.get('location'),'/sign-in');
 }
 const signin=await fetch(`${origin}/sign-in?returnTo=https%3A%2F%2Fevil.example`);assert.equal(signin.status,200);assert.equal(new URL(signin.url).origin,origin); const signinHtml=await signin.text(); assert.ok(signinHtml.includes('returnTo\\\":\\\"/dashboard'), 'AuthForm must receive only the sanitized dashboard return path');
 console.log('PASS anonymous Join/Save actions returns sign-in event path; private collections redirect; external return URL rejected.');
 console.log(JSON.stringify({publishedUpcomingEvent:event,registrations:await db.eventRegistration.count(),bookmarks:await db.eventBookmark.count()}));
} finally {await db.$disconnect();}
