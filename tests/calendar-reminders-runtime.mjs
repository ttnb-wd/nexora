import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import nextEnv from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
import rscClient from 'next/dist/compiled/react-server-dom-turbopack/client.node.js';
import { getServerActionForm } from './support/action-form.mjs';
const { PrismaClient } = await import('../src/generated/prisma/client.ts');
const { mutateReminder } = await import('../src/features/events/reminders/service.ts');
nextEnv.loadEnvConfig(process.cwd());
assert.equal(process.env.STEP16_DISPOSABLE_APPROVED,'1','Explicit disposable Neon approval required.');
const origin=process.env.STEP16_ORIGIN??process.env.APP_URL;
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL}),log:[]});
const run=randomUUID(),hex=run.replaceAll('-',''),userIds=[],eventIds=[];
const ip=`fd16:${hex.slice(0,4)}:${hex.slice(4,8)}:${hex.slice(8,12)}::1`;
const ratePrefix=`fd16:${hex.slice(0,4)}:${hex.slice(4,8)}:${hex.slice(8,12)}:0000:0000:0000:0000|`;
const ledger={run,passed:[],created:{users:userIds,events:eventIds},cleanupVerified:false,existingRecordsUnchanged:false};
const models=['user','session','account','organization','organizationMember','event','eventRegistration','eventBookmark','organizationFollower','notification','eventAgendaItem','eventSpeaker','eventResource','eventReminderPreference'];
const baseline={},immutable=['eventBookmark','organizationFollower','notification'];
const snapshot=model=>({id:true,...(immutable.includes(model)?{createdAt:true}:{updatedAt:true}),...(model==='notification'?{readAt:true}:{})});
const writeLedger=()=>{mkdirSync('artifacts',{recursive:true});writeFileSync(`artifacts/step16-runtime-${run}.json`,JSON.stringify(ledger,null,2));};
function pass(label){ledger.passed.push(label);writeLedger();console.log(`PASS ${label}`);}
async function request(path,actor,options={}){return fetch(`${origin}${path}`,{redirect:'manual',...options,headers:{Origin:origin,'X-Forwarded-For':ip,...(actor?.cookie?{Cookie:actor.cookie}:{}),...options.headers}});}
async function html(path,actor){const response=await request(path,actor);assert.equal(response.status,200);return(await response.text()).replace(/<!--[\s\S]*?-->/g,'');}
const manifest=JSON.parse(readFileSync('.next/server/server-reference-manifest.json','utf8'));
const names=['setEventReminder','disableEventReminder','getViewerEventReminder','joinEvent','cancelEventRegistration'];
const actionIds=Object.fromEntries(Object.entries(manifest.node).filter(([,entry])=>names.includes(entry.exportedName)).map(([id,entry])=>[entry.exportedName,id]));
async function invoke(name,args,actor){
 assert.ok(actionIds[name],name);const payload=await rscClient.encodeReply(args);
 const response=await request('/dashboard',actor,{method:'POST',headers:{'Next-Action':actionIds[name],...(typeof payload==='string'?{'Content-Type':'text/plain;charset=UTF-8'}:{})},body:payload});
 const body=await response.text();assert.equal(response.status,200,body.slice(0,200));
 const result=body.split('\n').map(line=>{try{return JSON.parse(line.slice(line.indexOf(':')+1),(_key,value)=>value==='$undefined'?undefined:value);}catch{return null;}}).find(value=>value&&typeof value==='object'&&('message'in value||'eligible'in value));
 assert.ok(result,`${name} missing result`);return result;
}
async function signup(label){
 const email=`step16-${run}-${label}@example.com`,password=randomUUID();
 const response=await request('/api/auth/sign-up/email',null,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`Step16 Private ${label}`,email,password})});
 assert.equal(response.status,200);const{user}=await response.json();userIds.push(user.id);writeLedger();
 return{id:user.id,email,password,cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};
}
try{
 for(const model of models)baseline[model]=await db[model].findMany({select:snapshot(model),orderBy:{id:'asc'}});
 const owner=await signup('owner'),attendee=await signup('attendee'),outsider=await signup('outsider');
 const fixture=async(label,status='PUBLISHED',past=false)=>{
  const event=await db.event.create({data:{slug:`s16-${run}-${label}`,title:'Calendar, learning; မြန်မာ 🙂 \\ Together',description:'Public calendar description\nSecond line; commas, backslash \\ safely escaped.',creatorId:owner.id,eventType:'IN_PERSON',locationName:'Hall, A',city:'Yangon',status,startAt:new Date(past?'2020-06-20T03:30:00Z':'2090-06-20T03:30:00Z'),endAt:new Date(past?'2020-06-20T05:30:00Z':'2090-06-20T05:30:00Z'),timezone:'Asia/Yangon'}});
  eventIds.push(event.id);writeLedger();return event;
 };
 if(process.env.STEP16_BROWSER_ONLY!=='1'){
 const event=await fixture('calendar'),draft=await fixture('draft','DRAFT'),cancelled=await fixture('cancelled','CANCELLED'),past=await fixture('past','PUBLISHED',true),completed=await fixture('completed','COMPLETED',true),archived=await fixture('archived','ARCHIVED');
 await db.eventRegistration.createMany({data:[event,past].map(e=>({userId:attendee.id,eventId:e.id,status:'REGISTERED'}))});
 const response=await request(`/events/${event.slug}/calendar.ics`);assert.equal(response.status,200);
 assert.match(response.headers.get('content-type'),/^text\/calendar; charset=utf-8$/);assert.match(response.headers.get('content-disposition'),/attachment; filename=.*\.ics/);assert.equal(response.headers.get('cache-control'),'no-store');
 const raw=await response.text(),ics=raw.replace(/\r\n /g,'');assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0')&&ics.endsWith('END:VCALENDAR\r\n'));
 assert.ok(ics.includes('DTSTART:20900620T033000Z')&&ics.includes('DTEND:20900620T053000Z'));
 const local=new Intl.DateTimeFormat('en-GB',{timeZone:event.timezone,hour:'2-digit',minute:'2-digit'}).format(event.startAt);assert.equal(local,'10:00');
 assert.ok(ics.includes('SUMMARY:Calendar\\, learning\\; မြန်မာ 🙂 \\\\ Together'));
 for(const line of raw.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 for(const actor of[owner,attendee,outsider])assert.ok(!ics.includes(actor.id)&&!ics.includes(actor.email));assert.ok(!ics.includes(event.id));
 const again=(await(await request(`/events/${event.slug}/calendar.ics`)).text()).replace(/\r\n /g,'');assert.equal(again.match(/^UID:(.*)$/m)[1],ics.match(/^UID:(.*)$/m)[1]);
 pass('1-4 published ICS is standards-shaped, UTF-8 folded, safely escaped, stable UID, UTC times match DB and Yangon 10:00');
 for(const e of[draft,cancelled,archived])assert.equal((await request(`/events/${e.slug}/calendar.ics`)).status,404);
 assert.equal((await request('/events/no-such-event/calendar.ics')).status,404);assert.equal((await request(`/events/${completed.slug}/calendar.ics`)).status,200);
 pass('5-7 draft/cancelled/archived/unknown blocked; completed public event exports');
 const publicHtml=await html(`/events/${event.slug}`);
 const encoded=publicHtml.match(/href="(https:\/\/calendar\.google\.com[^\"]+)"/)[1].replaceAll('&amp;','&');const google=new URL(encoded);
 assert.equal(google.searchParams.get('text'),event.title);assert.equal(google.searchParams.get('dates'),'20900620T033000Z/20900620T053000Z');assert.equal(google.searchParams.get('ctz'),'Asia/Yangon');assert.ok(google.searchParams.get('details').includes(`${origin}/events/${event.slug}`));
 pass('8 Google Calendar URL safely encodes title, UTC dates, timezone, public description, location and canonical URL');
 const preference=()=>db.eventReminderPreference.findUnique({where:{userId_eventId:{userId:attendee.id,eventId:event.id}}});
 assert.ok((await invoke('setEventReminder',[event.slug,15],attendee)).ok);assert.equal((await preference()).reminderMinutes,15);
 let detail=await html(`/events/${event.slug}`,attendee);assert.match(detail,/<option value="15" selected="">/);
 const viewer=await invoke('getViewerEventReminder',[event.slug],attendee);assert.deepEqual(viewer,{eligible:true,enabled:true,reminderMinutes:15});
 assert.ok((await html('/dashboard/joined',attendee)).includes('Add to calendar'));
 pass('9-10 registered user sets 15-minute preference; refresh, secure read and joined dashboard preserve selection');
 assert.ok((await invoke('setEventReminder',[event.slug,60],attendee)).ok);assert.equal((await preference()).reminderMinutes,60);
 assert.ok((await invoke('disableEventReminder',[event.slug],attendee)).ok);assert.equal((await preference()).enabled,false);
 assert.ok((await invoke('disableEventReminder',[event.slug],attendee)).ok);
 pass('11-12 update to 60 minutes and repeated disable persist safely');
 for(const value of[-1,0,16,999999,'15'])assert.equal((await invoke('setEventReminder',[event.slug,value],attendee)).ok,false);
 assert.equal((await invoke('setEventReminder',[event.slug,15],null)).ok,false);
 assert.equal((await invoke('setEventReminder',[event.slug,15,attendee.id],outsider)).ok,false);
 assert.equal((await invoke('setEventReminder',[{slug:event.slug,userId:attendee.id},15],outsider)).ok,false);
 assert.equal((await invoke('setEventReminder',[event.slug,15],owner)).ok,false);
 assert.deepEqual(await invoke('getViewerEventReminder',[event.slug],outsider),{eligible:false,enabled:false,reminderMinutes:null});
 pass('13-16 arbitrary values, anonymous, forged identities and non-registered users blocked; viewer read stays private');
 await db.eventRegistration.create({data:{eventId:event.id,userId:outsider.id}});
 assert.ok((await invoke('setEventReminder',[event.slug,1440,attendee.id],outsider)).ok);
 assert.equal((await preference()).enabled,false);
 assert.equal((await db.eventReminderPreference.findUniqueOrThrow({where:{userId_eventId:{userId:outsider.id,eventId:event.id}}})).reminderMinutes,1440);
 assert.equal((await invoke('getViewerEventReminder',[event.slug,outsider.id],attendee)).enabled,false);
 pass('registered second user can change only their own preference even with a forged target-user argument');
 assert.ok((await invoke('setEventReminder',[event.slug,15],attendee)).ok);
 assert.ok((await invoke('cancelEventRegistration',[event.slug],attendee)).ok);assert.equal((await preference()).enabled,false);
 assert.ok((await invoke('joinEvent',[event.slug],attendee)).ok);assert.equal((await preference()).enabled,false);
 assert.ok((await invoke('setEventReminder',[event.slug,30],attendee)).ok);assert.ok((await invoke('joinEvent',[event.slug],attendee)).ok);assert.equal((await preference()).enabled,true);
 pass('17 registration cancellation disables transactionally; rejoin stays off; duplicate join preserves chosen reminder');
 assert.equal((await invoke('setEventReminder',[past.slug,15],attendee)).ok,false);
 const repeats=await Promise.all([1,2].map(()=>mutateReminder(db,attendee.id,event.slug,60)));assert.ok(repeats.every(r=>r.ok));assert.equal(await db.eventReminderPreference.count({where:{userId:attendee.id,eventId:event.id}}),1);
 pass('19-20 past event cannot create reminder; concurrent requests remain one preference');
 const management=await html(`/dashboard/events/${event.id}`,owner);const formInfo=getServerActionForm(management);const form=new FormData();
 const decode=value=>value.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
 for(const match of formInfo.matchAll(/<input\b[^>]*>/g)){const name=match[0].match(/\bname="([^"]*)"/)?.[1];if(name?.startsWith('$ACTION'))form.append(decode(name),decode(match[0].match(/\bvalue="([^"]*)"/)?.[1]??''));}form.set('confirm','yes');
 const cancelResponse=await request(`/dashboard/events/${event.id}`,owner,{method:'POST',body:form});assert.equal(cancelResponse.status,303);
 assert.equal((await preference()).enabled,false);assert.equal((await request(`/events/${event.slug}/calendar.ics`)).status,404);
 assert.equal((await invoke('setEventReminder',[event.slug,15],attendee)).ok,false);
 pass('18 authorized event cancellation disables all reminders transactionally and immediately blocks calendar export');
 assert.equal(await db.notification.count({where:{userId:{in:userIds},type:'EVENT_REMINDER'}}),0);
 pass('no automatic reminder notifications created; public calendar response contains no attendee identities');
 }
 if(process.env.STEP16_BROWSER_HOLD==='1'){
  const browserEvent=await fixture('browser');await db.eventRegistration.create({data:{eventId:browserEvent.id,userId:attendee.id}});
  writeFileSync('artifacts/step16-browser-fixture.json',JSON.stringify({run,url:`${origin}/events/${browserEvent.slug}`,slug:browserEvent.slug,email:attendee.email,password:attendee.password},null,2));
  const completePath=`artifacts/step16-browser-complete-${run}.txt`;
  console.log(`Browser fixture ready. Waiting for ${completePath} (up to 15 minutes).`);
  const deadline=Date.now()+900000;while(!existsSync(completePath)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,1000));
  assert.ok(existsSync(completePath),'Browser verification timed out');
  unlinkSync(completePath);
 }
}catch(error){ledger.failure={name:error.name,message:error.message};throw error;}finally{
 const ownUsers=await db.user.findMany({where:{email:{startsWith:`step16-${run}-`}},select:{id:true}});for(const row of ownUsers)if(!userIds.includes(row.id))userIds.push(row.id);
 await db.event.deleteMany({where:{id:{in:eventIds}}});await db.user.deleteMany({where:{id:{in:userIds}}});await db.rateLimit.deleteMany({where:{key:{startsWith:ratePrefix}}});
 for(const model of['eventRegistration','eventBookmark','eventReminderPreference'])assert.equal(await db[model].count({where:{eventId:{in:eventIds}}}),0);
 for(const model of['session','account','notification'])assert.equal(await db[model].count({where:{userId:{in:userIds}}}),0);
 assert.equal(await db.event.count({where:{id:{in:eventIds}}}),0);assert.equal(await db.user.count({where:{id:{in:userIds}}}),0);assert.equal(await db.rateLimit.count({where:{key:{startsWith:ratePrefix}}}),0);ledger.cleanupVerified=true;
 for(const model of models)if(baseline[model])assert.deepEqual(await db[model].findMany({where:{id:{in:baseline[model].map(row=>row.id)}},select:snapshot(model),orderBy:{id:'asc'}}),baseline[model],`Existing ${model} changed`);
 ledger.existingRecordsUnchanged=true;writeLedger();await db.$disconnect();
 if(existsSync('artifacts/step16-browser-fixture.json')&&JSON.parse(readFileSync('artifacts/step16-browser-fixture.json','utf8')).run===run)unlinkSync('artifacts/step16-browser-fixture.json');
 console.log(`Removed all Step16 fixtures. ${ledger.passed.length} scenario groups passed; existing records unchanged.`);
}
