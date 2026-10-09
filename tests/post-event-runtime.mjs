import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import nextEnv from '@next/env';
import rscClient from 'next/dist/compiled/react-server-dom-turbopack/client.node.js';
assert.equal(process.env.STEP20_DISPOSABLE_APPROVED,'1','Explicit disposable approval required.');
nextEnv.loadEnvConfig(process.cwd(),true);
const { getDb }=await import('../src/lib/db.ts');
const { completeManagedEvent,saveFeedback,loadFeedbackInsights,loadViewerFeedback }=await import('../src/features/post-event/service.ts');
const { loadEventAnalytics }=await import('../src/features/analytics/server/service.ts');
const { mutateAttendance }=await import('../src/features/attendees/server/service.ts');
const db=getDb(),run=randomUUID(),prefix=`s20-${run}`,origin='http://127.0.0.1:3003',root=`artifacts/step20/${run}`;
mkdirSync(root,{recursive:true});
const users=[],events=[],organizations=[],people=[],secrets=[],ip=`fd20:${run.slice(0,4)}:${run.slice(9,13)}:`;
let server,chrome,serverLogs='',stage='baseline',baseline;
const ledger={run,prefix,passed:[],created:{},cleanupVerified:false,existingRecordsUnchanged:false};
const save=()=>writeFileSync(`${root}/runtime.json`,JSON.stringify(ledger,null,2));
function pass(label){ledger.passed.push(label);save();console.log('PASS '+label);}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fingerprint(){
 const tables=await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
 const result={};for(const{tablename}of tables){const name='"'+tablename.replaceAll('"','""')+'"';const[row]=await db.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t."id")::text,'[]')) AS digest FROM ${name} t`);result[tablename]=row;}return result;
}
async function request(path,actor,options={}){return fetch(origin+path,{redirect:'manual',...options,headers:{Origin:origin,'X-Forwarded-For':`${ip}${actor?.index??99}::1`,...(actor?.cookie?{Cookie:actor.cookie}:{}),...options.headers},signal:AbortSignal.timeout(65000)});}
async function html(path,actor,status=200){const res=await request(path,actor);assert.equal(res.status,status);return await res.text();}
async function signup(label){
 const index=people.length+1,email=`${prefix}-${label}@example.test`,password=randomBytes(24).toString('hex');secrets.push(email,password);
 const response=await request('/api/auth/sign-up/email',{index},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`Step20 ${label}`,email,password})});
 assert.equal(response.status,200);const{user}=await response.json();users.push(user.id);save();
 const cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');secrets.push(cookie);
 const actor={id:user.id,index,cookie};people.push(actor);return actor;
}
async function fixture(label,creator,org=null,status='PUBLISHED',future=false){
 const[{now}]=await db.$queryRaw`SELECT clock_timestamp() AS "now"`;
 const startAt=new Date(now.getTime()+(future?72:-3)*3600000),endAt=new Date(startAt.getTime()+3600000);
 const e=await db.event.create({data:{slug:`${prefix}-${label}`,title:`Step20 ${label}`,creatorId:creator.id,organizationId:org?.id??null,status,eventType:'ONLINE',startAt,endAt,timezone:'Asia/Yangon',description:'Disposable post-event lifecycle verification.'}});
 events.push(e.id);save();return e;
}
async function register(event,actor,status,checkedInBy=null){return db.eventRegistration.create({data:{eventId:event.id,userId:actor.id,status,...(checkedInBy?{checkedInAt:new Date(event.startAt.getTime()+1000),checkedInById:checkedInBy.id}:{})}});}
async function invoke(name,args,actor,path='/dashboard'){
 const manifest=JSON.parse(readFileSync('.next/server/server-reference-manifest.json','utf8'));
 const [id]=Object.entries(manifest.node).find(([,entry])=>entry.exportedName===name);
 const payload=await rscClient.encodeReply(args),res=await request(path,actor,{method:'POST',headers:{'Next-Action':id,...(typeof payload==='string'?{'Content-Type':'text/plain;charset=UTF-8'}:{})},body:payload});
 const body=await res.text();assert.equal(res.status,200);
 const result=body.split('\n').map(line=>{try{return JSON.parse(line.slice(line.indexOf(':')+1));}catch{return null;}}).find(value=>value&&typeof value==='object'&&typeof value.message==='string');
 assert.ok(result,'Action response missing');return result;
}
async function runChild(args,input){return new Promise((resolveChild,reject)=>{
 const child=spawn(process.execPath,args,{windowsHide:true,env:{...process.env,NODE_OPTIONS:args.some(arg=>arg.endsWith('-browser.mjs'))?'':process.env.NODE_OPTIONS,APP_URL:origin,PUBLIC_APP_URL:' '}});let stdout='',stderr='';
 child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);child.on('error',reject);child.on('close',code=>resolveChild({code,stdout,stderr}));if(input)child.stdin.end(JSON.stringify(input));
});}
try{
 baseline=await fingerprint();ledger.baseline=baseline;save();
 const cronSecret=randomBytes(32).toString('hex');secrets.push(cronSecret);
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3003'],{windowsHide:true,env:{...process.env,APP_URL:origin,PUBLIC_APP_URL:' ',CRON_SECRET:cronSecret,NODE_ENV:'production'}});
 server.stdout.on('data',data=>serverLogs+=data);server.stderr.on('data',data=>serverLogs+=data);
 for(let i=0;i<40;i++){if(server.exitCode!==null)throw new Error('Test server failed');try{if((await request('/api/internal/reminders/run')).status===405)break;}catch{}await sleep(250);}
 stage='actors';const owner=await signup('owner'),admin=await signup('admin'),editor=await signup('editor'),member=await signup('member'),attendee=await signup('attendee'),second=await signup('second'),outsider=await signup('outsider');
 const org=await db.organization.create({data:{name:'Step20 disposable organization',slug:`${prefix}-org`,description:'Disposable Step20 verification.'}});organizations.push(org.id);save();
 await db.organizationMember.createMany({data:[[owner,'OWNER'],[admin,'ADMIN'],[editor,'EDITOR'],[member,'MEMBER']].map(([actor,role])=>({userId:actor.id,organizationId:org.id,role}))});
 const ended=await fixture('ended',owner,org),future=await fixture('future',owner,org,'PUBLISHED',true),cancelled=await fixture('cancelled',owner,org,'CANCELLED'),archived=await fixture('archived',owner,org,'ARCHIVED'),individual=await fixture('individual',owner),empty=await fixture('empty',owner,org),browserEvent=await fixture('browser',owner,org);
 const endedAttended=await register(ended,attendee,'ATTENDED',owner);await register(ended,second,'ATTENDED',owner);await register(ended,owner,'ATTENDED',owner);await register(ended,member,'REGISTERED');await register(ended,outsider,'CANCELLED');
 await register(browserEvent,attendee,'ATTENDED',owner);await register(browserEvent,member,'REGISTERED');
 await db.eventResource.createMany({data:[{eventId:ended.id,title:'Step20 public recording',type:'RECORDING',url:'https://example.com/recording',sortOrder:0},{eventId:browserEvent.id,title:'Step20 public slides',type:'SLIDES',url:'https://example.com/slides',sortOrder:0}]});
 stage='completion rules';
 for(const event of [future,cancelled,archived])assert.equal((await completeManagedEvent(db,owner.id,event.id,org.slug,true)).ok,false);
 assert.equal((await completeManagedEvent(db,owner.id,ended.id,org.slug,false)).ok,false);
 for(const actor of [member,outsider])assert.equal((await completeManagedEvent(db,actor.id,ended.id,org.slug,true)).ok,false);
 assert.equal((await completeManagedEvent(db,outsider.id,individual.id,null,true)).ok,false);
 assert.equal((await completeManagedEvent(db,owner.id,individual.id,null,true)).ok,true);
 assert.equal((await completeManagedEvent(db,admin.id,empty.id,org.slug,true)).ok,true);
 const results=await Promise.all([owner,editor].map(actor=>completeManagedEvent(db,actor.id,ended.id,org.slug,true)));assert.ok(results.every(result=>result.ok));
 assert.equal((await completeManagedEvent(db,owner.id,ended.id,org.slug,true)).ok,true);
 const states=await db.eventRegistration.findMany({where:{eventId:ended.id},select:{userId:true,status:true,checkedInAt:true,checkedInById:true}});
 for(const actor of [attendee,second,owner])assert.equal(states.find(row=>row.userId===actor.id).status,'ATTENDED');
 assert.equal(states.find(row=>row.userId===member.id).status,'NO_SHOW');assert.equal(states.find(row=>row.userId===outsider.id).status,'CANCELLED');
 assert.equal(states.find(row=>row.userId===attendee.id).checkedInById,owner.id);
 assert.equal((await mutateAttendance(db,owner.id,{eventId:ended.id,scope:org.slug,registrationId:endedAttended.id},'undo')).ok,undefined);
 pass('completion: time/status/confirmation, OWNER/ADMIN/EDITOR, individual creator, denied MEMBER/outsider, concurrent/idempotent finalization and preserved check-ins');
 stage='feedback validation';
 for(const actor of [null,member,outsider,admin])assert.equal((await saveFeedback(db,actor?.id??null,ended.slug,{rating:5})).ok,false);
 assert.equal((await saveFeedback(db,attendee.id,future.slug,{rating:5})).ok,false);
 for(const rating of [0,6,1.2,'5'])assert.equal((await saveFeedback(db,attendee.id,ended.slug,{rating})).ok,false);
 for(const comment of [' '.repeat(3),'x'.repeat(1001)])assert.equal((await saveFeedback(db,attendee.id,ended.slug,{rating:5,comment})).ok,false);
 await assert.rejects(db.eventFeedback.create({data:{eventId:ended.id,userId:attendee.id,rating:6}}));
 await register(future,attendee,'REGISTERED');assert.equal((await saveFeedback(db,attendee.id,future.slug,{rating:5})).ok,false);
 const form=new FormData();form.set('rating','5');form.set('comment','  Helpful event  ');form.set('userId',outsider.id);
 assert.equal((await invoke('saveEventFeedback',[ended.slug,{},form],attendee)).ok,true);
 assert.equal((await db.eventFeedback.findUniqueOrThrow({where:{eventId_userId:{eventId:ended.id,userId:attendee.id}}})).comment,'Helpful event');
 assert.equal(await db.eventFeedback.count({where:{eventId:ended.id,userId:outsider.id}}),0);
 await Promise.all([3,4].map(rating=>saveFeedback(db,attendee.id,ended.slug,{rating,comment:'<script>window.feedbackInjected=true</script>'})));
 assert.equal(await db.eventFeedback.count({where:{eventId:ended.id,userId:attendee.id}}),1);
 assert.equal((await saveFeedback(db,attendee.id,ended.slug,{rating:5,comment:'<script>window.feedbackInjected=true</script>'})).ok,true);
 assert.equal((await saveFeedback(db,second.id,ended.slug,{rating:3,comment:''})).ok,true);
 pass('feedback: session-derived actor, eligibility, rating/comment limits and DB rating check, trim, upsert/edit and concurrent uniqueness');
 stage='insights metrics';
 const insights=await loadFeedbackInsights(db,owner.id,ended.id,org.slug);
 assert.equal(insights.responses,2);assert.equal(insights.averageRating,4);assert.equal(insights.attended,3);assert.ok(Math.abs(insights.responseRate-200/3)<1e-9);
 assert.deepEqual(insights.distribution.map(row=>row.count),[0,0,1,0,1]);assert.equal(insights.comments.length,1);
 const analytics=await loadEventAnalytics(db,owner.id,ended.id,org.slug);assert.equal(analytics.counts.NO_SHOW,1);assert.equal(analytics.attendanceRate,75);assert.equal(analytics.feedbackResponses,2);assert.equal(analytics.averageRating,4);
 const emptyInsights=await loadFeedbackInsights(db,owner.id,empty.id,org.slug);assert.equal(emptyInsights.responses,0);assert.equal(emptyInsights.averageRating,null);assert.equal(emptyInsights.responseRate,null);assert.equal(emptyInsights.comments.length,0);
 stage='insights route authorization';for(const actor of [member,outsider]){assert.equal(await loadFeedbackInsights(db,actor.id,ended.id,org.slug),null);await html(`/organizer/${org.slug}/events/${ended.id}/feedback`,actor,404);}
 await html(`/dashboard/events/${individual.id}/feedback`,owner);await html(`/dashboard/events/${individual.id}/feedback`,outsider,404);
 stage='insights privacy';const privateHtml=await html(`/organizer/${org.slug}/events/${ended.id}/feedback`,owner);
 for(const secret of secrets)assert.ok(!privateHtml.includes(secret));
 assert.ok(privateHtml.includes('&lt;script&gt;'));assert.ok(!privateHtml.includes('<script>window.feedbackInjected'));
 const publicHtml=await html(`/events/${ended.slug}`,null);assert.ok(publicHtml.includes('Step20 public recording'));
 for(const id of [...users,ended.id])assert.ok(!publicHtml.includes(id));assert.ok(!publicHtml.includes('Helpful event'));assert.ok(!publicHtml.includes('Average rating'));
 const noShowHtml=await html(`/events/${ended.slug}`,member);assert.ok(noShowHtml.includes('Not checked in'));assert.ok(!noShowHtml.includes('name="rating"'));
 assert.equal((await loadViewerFeedback(db,attendee.id,ended.slug)).eligible,true);
 pass('analytics/distribution/response rate/no-shows, zero states, anonymous escaped comments, private access guards and public resources/privacy');
 if(process.env.STEP20_SKIP_BROWSER!=='1'){
  stage='browser';const profile=resolve(root,'chrome-profile');
  chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-extensions','--remote-debugging-port=9336',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true});
  for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:9336/json/version')).ok)break;}catch{}await sleep(250);}
  const browser=await runChild(['tests/post-event-browser.mjs'],{origin,root,ip,orgSlug:org.slug,eventId:browserEvent.id,slug:browserEvent.slug,futureId:future.id,emptyId:empty.id,owner:{cookie:owner.cookie},attendee:{cookie:attendee.cookie},noShow:{cookie:member.cookie}});
  assert.equal(browser.code,0,'Browser suite failed; see browser report');console.log(browser.stdout.trim());
  assert.equal((await db.event.findUniqueOrThrow({where:{id:browserEvent.id}})).status,'COMPLETED');
  assert.equal(await db.eventFeedback.count({where:{eventId:browserEvent.id,userId:attendee.id}}),1);
  pass('browser completion, confirmation, attendee finalization, feedback submission/edit, no-show/resources, mobile and keyboard');
  if(chrome.exitCode===null)await Promise.race([new Promise(resolveExit=>chrome.once('exit',resolveExit)),sleep(3000)]);
  const actual=realpathSync(profile);assert.ok(actual.startsWith(resolve(root)+sep));rmSync(actual,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 }
}catch(error){ledger.failedStage=stage;ledger.failure=error.name;ledger.detail=secrets.reduce((message,secret)=>message.replaceAll(secret,'[redacted]'),error.message);save();process.exitCode=1;console.error(`Step20 verification failed at ${stage}; inspect ${root}.`);}
finally{
 if(chrome&&chrome.exitCode===null)chrome.kill();if(server&&server.exitCode===null){server.kill();await Promise.race([new Promise(done=>server.once('exit',done)),sleep(3000)]);}
 try{
  const recovered=await db.user.findMany({where:{email:{startsWith:prefix}},select:{id:true}});for(const row of recovered)if(!users.includes(row.id))users.push(row.id);
  const ownedEvents=await db.event.findMany({where:{creatorId:{in:users},slug:{startsWith:prefix}},select:{id:true}});for(const row of ownedEvents)if(!events.includes(row.id))events.push(row.id);
  ledger.created={users:users.length,organizations:organizations.length,events:events.length,
   registrations:await db.eventRegistration.count({where:{eventId:{in:events}}}),feedback:await db.eventFeedback.count({where:{eventId:{in:events}}}),resources:await db.eventResource.count({where:{eventId:{in:events}}}),
   memberships:await db.organizationMember.count({where:{organizationId:{in:organizations}}}),accounts:await db.account.count({where:{userId:{in:users}}}),sessions:await db.session.count({where:{userId:{in:users}}}),notifications:await db.notification.count({where:{userId:{in:users}}}),rateLimits:await db.rateLimit.count({where:{key:{startsWith:ip}}})};
  ledger.recordIds={users,events,organizations,feedback:(await db.eventFeedback.findMany({where:{eventId:{in:events}},select:{id:true}})).map(row=>row.id)};save();
  await db.event.deleteMany({where:{id:{in:events},creatorId:{in:users},slug:{startsWith:prefix}}});
  await db.organization.deleteMany({where:{id:{in:organizations},slug:{startsWith:prefix}}});
  await db.user.deleteMany({where:{id:{in:users},email:{startsWith:prefix}}});await db.rateLimit.deleteMany({where:{key:{startsWith:ip}}});
  for(const model of ['eventRegistration','eventFeedback','eventResource'])assert.equal(await db[model].count({where:{eventId:{in:events}}}),0);
  for(const model of ['account','session','notification'])assert.equal(await db[model].count({where:{userId:{in:users}}}),0);
  assert.equal(await db.user.count({where:{email:{startsWith:prefix}}}),0);assert.equal(await db.event.count({where:{slug:{startsWith:prefix}}}),0);assert.equal(await db.organization.count({where:{slug:{startsWith:prefix}}}),0);
  ledger.cleanupVerified=true;ledger.after=await fingerprint();for(const [table,before] of Object.entries(baseline))if(table!=='RateLimit')assert.deepEqual(ledger.after[table],before);ledger.rateLimitMaintenance='Ephemeral middleware expiry excluded from business table comparison';ledger.existingRecordsUnchanged=true;
  const sessionTokens=secrets.filter(Boolean);assert.ok(!sessionTokens.some(value=>serverLogs.includes(value)));ledger.privateLogs=true;writeFileSync(`${root}/server.log`,serverLogs);save();pass('cleanup complete; all existing business-table hashes/counts unchanged and logs safe');
 }catch{ledger.cleanupOrSafetyFailure=true;save();process.exitCode=1;console.error('Step20 cleanup/safety needs attention; inspect runtime ledger.');}
 finally{await db.$disconnect();}
}
