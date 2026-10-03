import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import nextEnv from '@next/env';
import rscClient from 'next/dist/compiled/react-server-dom-turbopack/client.node.js';
const { inviteTeamMember, respondToInvitation, revokeTeamInvitation, changeTeamRole, removeTeamMember, invitationPreview } = await import('../src/features/organizations/team/service.ts');
const { hashInvitationToken } = await import('../src/features/organizations/team/token.ts');
const { allowTeamRequest } = await import('../src/features/organizations/team/rate-limit.ts');
const { eventAccessWhere } = await import('../src/features/events/server/authorization-rules.ts');
assert.equal(process.env.STEP21_DISPOSABLE_APPROVED,'1','Disposable Step 21 write approval required.');
nextEnv.loadEnvConfig(process.cwd(),true);
const {getDb}=await import('../src/lib/db.ts');
const db=getDb(),run=randomUUID(),prefix=`s21-${run}`,origin='http://127.0.0.1:3004',root=`artifacts/step21/${run}`,ip=`fd21:${run.slice(0,4)}:${run.slice(9,13)}:`;
mkdirSync(root,{recursive:true});
const users=[],orgs=[],secrets=[],actors=[];
const ledger={run,passed:[],cleanupVerified:false,existingRecordsUnchanged:false};
let server,chrome,serverLogs='',baseline;
const save=()=>writeFileSync(`${root}/runtime.json`,JSON.stringify(ledger,null,2));
function pass(message){ledger.passed.push(message);save();console.log('PASS '+message);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fingerprint(){const tables=await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;const result={};for(const{tablename}of tables){const name='"'+tablename.replaceAll('"','""')+'"';const[row]=await db.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t."id")::text,'[]')) AS digest FROM ${name} t`);result[tablename]=row;}return result;}
async function request(path,actor,options={}){return fetch(origin+path,{redirect:'manual',...options,headers:{Origin:origin,'X-Forwarded-For':`${ip}${actor?.index??99}::1`,...(actor?.cookie?{Cookie:actor.cookie}:{}),...options.headers},signal:AbortSignal.timeout(65000)});}
async function signup(label){const email=`${prefix}-${label}@example.test`,password=randomBytes(24).toString('hex'),index=actors.length+1;const res=await request('/api/auth/sign-up/email',{index},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`Step21 ${label}`,email,password})});assert.equal(res.status,200);const{user}=await res.json();users.push(user.id);const cookie=res.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');const actor={id:user.id,name:user.name,email,password,index,cookie};actors.push(actor);secrets.push(password,cookie);return actor;}
async function invoke(name,args,actor,path='/dashboard'){const manifest=JSON.parse(readFileSync('.next/server/server-reference-manifest.json','utf8'));const entry=Object.entries(manifest.node).find(([,value])=>value.exportedName===name);assert.ok(entry);const payload=await rscClient.encodeReply(args);const res=await request(path,actor,{method:'POST',headers:{'Next-Action':entry[0],...(typeof payload==='string'?{'Content-Type':'text/plain;charset=UTF-8'}:{})},body:payload});assert.equal(res.status,200);const text=await res.text();const result=text.split('\n').map(line=>{try{return JSON.parse(line.slice(line.indexOf(':')+1));}catch{return null;}}).find(x=>x&&typeof x.message==='string');assert.ok(result);return result;}
async function child(args,input,env={}){return new Promise((done,reject)=>{const proc=spawn(process.execPath,args,{windowsHide:true,env:{...process.env,APP_URL:origin,PUBLIC_APP_URL:'https://nexora-runtime.invalid',RESEND_API_KEY:'',...env}});let stdout='',stderr='';proc.stdout.on('data',x=>stdout+=x);proc.stderr.on('data',x=>stderr+=x);proc.on('error',reject);proc.on('close',code=>done({code,stdout,stderr}));if(input)proc.stdin.end(JSON.stringify(input));});}
const form=fields=>{const f=new FormData();for(const[k,v]of Object.entries(fields))f.set(k,v);return f;};
try{
 baseline=await fingerprint();ledger.baseline=baseline;save();
 server=spawn(process.execPath,['--import','./tests/support/mock-resend.mjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3004'],{windowsHide:true,env:{...process.env,APP_URL:origin,PUBLIC_APP_URL:'https://nexora-runtime.invalid',RESEND_API_KEY:'',NODE_ENV:'production'}});server.stdout.on('data',x=>serverLogs+=x);server.stderr.on('data',x=>serverLogs+=x);
 for(let i=0;i<80;i++){if(server.exitCode!==null)throw new Error('Test server failed');try{if((await request('/sign-in')).status===200)break;}catch{}await sleep(250);}
 const owner=await signup('owner'),admin=await signup('admin'),editor=await signup('editor'),member=await signup('member'),invited=await signup('invited'),decliner=await signup('decliner'),outsider=await signup('outsider'),browserInvitee=await signup('browser-invitee');
 const org=await db.organization.create({data:{name:'Step21 disposable organization',slug:prefix}});orgs.push(org.id);
 const emptyOrg=await db.organization.create({data:{name:'Step21 starting team',slug:`${prefix}-empty`,members:{create:{userId:owner.id,role:'OWNER'}}}});orgs.push(emptyOrg.id);
 await db.organizationMember.createMany({data:[[owner,'OWNER'],[admin,'ADMIN'],[editor,'EDITOR'],[member,'MEMBER']].map(([a,role])=>({userId:a.id,organizationId:org.id,role}))});
 const membership=a=>db.organizationMember.findUniqueOrThrow({where:{userId_organizationId:{userId:a.id,organizationId:org.id}}});
 const issue=async(actor,email,role,replaceId)=>{const value=await inviteTeamMember(db,actor.id,org.slug,{email,role},replaceId);secrets.push(value.token);return value.token;};
 const lookup=token=>db.organizationInvitation.findUniqueOrThrow({where:{tokenHash:hashInvitationToken(token)}});
 const rejected=fn=>assert.rejects(fn);
 if(!process.argv.includes('--browser-only')) {
 for(const[actor,role]of [[owner,'ADMIN'],[owner,'EDITOR'],[owner,'MEMBER'],[admin,'EDITOR'],[admin,'MEMBER']])await issue(actor,`${prefix}-${actor.id}-${role}@example.test`,role);
 pass('1–5 OWNER invites ADMIN/EDITOR/MEMBER; ADMIN invites EDITOR/MEMBER');
 for(const[actor,role]of [[admin,'OWNER'],[admin,'ADMIN'],[owner,'OWNER'],[editor,'MEMBER'],[member,'MEMBER']])await rejected(()=>issue(actor,`${prefix}-forbidden@example.test`,role));
 pass('6–8 OWNER invites forbidden; ADMIN escalation, EDITOR and MEMBER denied');
 await rejected(()=>issue(owner,` ${member.email.toUpperCase()} `,'MEMBER'));
 const token=await issue(owner,` ${invited.email.toUpperCase()} `,'EDITOR');
 await rejected(()=>issue(owner,invited.email,'MEMBER'));
 await rejected(()=>issue(owner,'invalid','MEMBER'));
 pass('9–10 normalized existing-member/duplicate invitations and invalid email rejected');
 const expired=await issue(owner,`${prefix}-expired@example.test`,'MEMBER');const expiredRow=await lookup(expired);await db.organizationInvitation.update({where:{id:expiredRow.id},data:{email:outsider.email,expiresAt:new Date(0)}});
 for(const response of ['accept','decline'])await rejected(()=>respondToInvitation(db,outsider.id,expired,response));
 const replacement=await issue(owner,outsider.email,'MEMBER');assert.ok((await lookup(expired)).revokedAt);await revokeTeamInvitation(db,owner.id,org.slug,(await lookup(replacement)).id);
 await rejected(()=>respondToInvitation(db,outsider.id,replacement,'accept'));
 pass('11–12 expired accept/decline denied; replacement revokes expired link; revoked link denied');
 await assert.rejects(()=>respondToInvitation(db,outsider.id,token,'accept'),/different account/);
 const accepted=await respondToInvitation(db,invited.id,token,'accept');assert.equal(accepted.state,'accepted');assert.equal((await membership(invited)).role,'EDITOR');
 await respondToInvitation(db,invited.id,token,'accept');assert.equal(await db.organizationMember.count({where:{userId:invited.id,organizationId:org.id}}),1);
 pass('13–16 wrong email rejected; correct user accepts invited role; repeated accept is idempotent');
 const decline=await issue(owner,decliner.email,'MEMBER');await respondToInvitation(db,decliner.id,decline,'decline');await respondToInvitation(db,decliner.id,decline,'decline');assert.ok((await lookup(decline)).declinedAt);assert.equal(await db.organizationMember.count({where:{userId:decliner.id,organizationId:org.id}}),0);await rejected(()=>respondToInvitation(db,decliner.id,decline,'accept'));
 pass('17 decline is repeat-safe, terminal and creates no membership');
 const old=await issue(owner,`${prefix}-reissue@example.test`,'MEMBER');const newer=await issue(owner,`${prefix}-reissue@example.test`,'MEMBER',(await lookup(old)).id);assert.equal((await invitationPreview(db,old)).state,'revoked');assert.equal((await invitationPreview(db,newer)).state,'active');assert.notEqual(old,newer);
 pass('18 reissue keeps audit history, resets expiration and invalidates old token');
 let row=await membership(admin);await changeTeamRole(db,owner.id,org.slug,row.id,'ADMIN','EDITOR');assert.equal((await membership(admin)).role,'EDITOR');await changeTeamRole(db,owner.id,org.slug,row.id,'EDITOR','ADMIN');
 row=await membership(member);await changeTeamRole(db,owner.id,org.slug,row.id,'MEMBER','ADMIN');assert.equal((await membership(member)).role,'ADMIN');await changeTeamRole(db,owner.id,org.slug,row.id,'ADMIN','MEMBER');
 row=await membership(editor);await changeTeamRole(db,admin.id,org.slug,row.id,'EDITOR','MEMBER');assert.equal((await membership(editor)).role,'MEMBER');await changeTeamRole(db,admin.id,org.slug,row.id,'MEMBER','EDITOR');
 pass('19–21 OWNER changes ADMIN to EDITOR / MEMBER to ADMIN; ADMIN changes EDITOR to MEMBER');
 const ownerRow=await membership(owner);for(const[a,target,next]of [[admin,ownerRow,'MEMBER'],[admin,await membership(admin),'MEMBER'],[editor,await membership(member),'EDITOR'],[member,await membership(editor),'MEMBER'],[owner,await membership(member),'OWNER']])await rejected(()=>changeTeamRole(db,a.id,org.slug,target.id,target.role,next));
 pass('22–24 ADMIN cannot modify OWNER/ADMIN; EDITOR/MEMBER cannot modify roles; OWNER promotion denied');
 const event=await db.event.create({data:{slug:`${prefix}-event`,title:'Step21 retained event',organizationId:org.id,creatorId:admin.id,status:'PUBLISHED',eventType:'ONLINE',startAt:new Date('2090-01-01'),endAt:new Date('2090-01-02')}});
 const beforeEvent=await db.event.findUniqueOrThrow({where:{id:event.id}});
 await removeTeamMember(db,owner.id,org.slug,(await membership(admin)).id,'ADMIN');await removeTeamMember(db,owner.id,org.slug,(await membership(invited)).id,'EDITOR');
 await db.organizationMember.create({data:{organizationId:org.id,userId:admin.id,role:'ADMIN'}});
 await removeTeamMember(db,admin.id,org.slug,(await membership(member)).id,'MEMBER');await rejected(()=>removeTeamMember(db,admin.id,org.slug,ownerRow.id));
 await removeTeamMember(db,editor.id,org.slug);await rejected(()=>removeTeamMember(db,owner.id,org.slug));await rejected(()=>removeTeamMember(db,owner.id,org.slug,ownerRow.id));
 assert.deepEqual(await db.event.findUniqueOrThrow({where:{id:event.id}}),beforeEvent);assert.ok(await db.user.findUnique({where:{id:member.id}}));
 pass('25–29 OWNER removes ADMIN; ADMIN removes MEMBER; OWNER removal/leave blocked; non-owner self-leave preserves events and users');
 const concurrent=await issue(owner,invited.email,'MEMBER');const parallel=await Promise.all([1,2].map(()=>respondToInvitation(db,invited.id,concurrent,'accept')));assert.ok(parallel.every(x=>x.state==='accepted'));assert.equal(await db.organizationMember.count({where:{organizationId:org.id,userId:invited.id}}),1);
 pass('30 simultaneous accepts create one membership');
 const racing=await issue(owner,outsider.email,'MEMBER');const racingRow=await lookup(racing);await Promise.allSettled([respondToInvitation(db,outsider.id,racing,'accept'),revokeTeamInvitation(db,owner.id,org.slug,racingRow.id)]);const final=await lookup(racing);assert.ok(Boolean(final.acceptedAt)!==Boolean(final.revokedAt));assert.equal(await db.organizationMember.count({where:{userId:outsider.id,organizationId:org.id}}),final.acceptedAt?1:0);
 pass('31 accept/revoke race has one terminal state consistent with membership');
 const duplicateEmail=`${prefix}-race@example.test`;const races=await Promise.allSettled([1,2].map(()=>issue(owner,duplicateEmail,'MEMBER')));assert.equal(races.filter(x=>x.status==='fulfilled').length,1);assert.equal(await db.organizationInvitation.count({where:{organizationId:org.id,email:duplicateEmail,acceptedAt:null,declinedAt:null,revokedAt:null}}),1);
 pass('32 duplicate invite race creates one open invitation');
 const records=JSON.stringify(await db.organizationInvitation.findMany({where:{organizationId:org.id}}));assert.ok(secrets.filter(x=>/^[A-Za-z0-9_-]{43}$/.test(x)).every(x=>!records.includes(x)));const preview=await invitationPreview(db,newer);assert.deepEqual(Object.keys(preview).sort(),['expiresAt','name','role','state']);
 const anonHtml=await(await request('/invitations/'+newer)).text();assert.ok(anonHtml.includes('Sign in to accept invitation'));assert.ok(!anonHtml.includes(org.id));assert.ok(!anonHtml.includes(owner.id));assert.ok(!anonHtml.includes(`${prefix}-reissue@example.test`));
 pass('33–34 only hashes in Neon; invitation projection/page excludes target email and internal identities');
 assert.equal((await request(`/organizer/${org.slug}/team`,decliner)).status,404);assert.equal((await request(`/organizer/${org.slug}/team`)).status,307);
 assert.equal(await db.event.count({where:{id:event.id,...eventAccessWhere(member.id)}}),0);assert.equal((await request(`/organizer/${org.slug}/events/${event.id}`,member)).status,404);await rejected(()=>issue(member,`${prefix}-removed@example.test`,'MEMBER'));
 pass('35–36 unauthorized team access blocked; removed member loses event/team authority immediately');
 await db.organizationMember.createMany({data:[{userId:editor.id,organizationId:org.id,role:'EDITOR'},{userId:member.id,organizationId:org.id,role:'MEMBER'}]});
 const stale=await membership(editor);const updates=await Promise.allSettled(['MEMBER','ADMIN'].map(role=>changeTeamRole(db,owner.id,org.slug,stale.id,'EDITOR',role)));assert.equal(updates.filter(x=>x.status==='fulfilled').length,1);await db.organizationMember.update({where:{id:stale.id},data:{role:'EDITOR'}});
 await Promise.allSettled([changeTeamRole(db,owner.id,org.slug,stale.id,'EDITOR','MEMBER'),removeTeamMember(db,owner.id,org.slug,stale.id,'EDITOR')]);const eventual=await db.organizationMember.findUnique({where:{id:stale.id}});assert.ok(!eventual||eventual.role==='MEMBER');if(!eventual)await db.organizationMember.create({data:{userId:editor.id,organizationId:org.id,role:'EDITOR'}});else await db.organizationMember.update({where:{id:stale.id},data:{role:'EDITOR'}});
 pass('concurrent role edits reject stale expectations; remove/update race cannot resurrect a membership');
 const privileged=await issue(owner,`${prefix}-admin-only@example.test`,'ADMIN');await rejected(async()=>revokeTeamInvitation(db,admin.id,org.slug,(await lookup(privileged)).id));
 const ui=await invoke('manageOrganizationTeam',[org.slug,{},form({operation:'invite',email:`${prefix}-action@example.test`,role:'MEMBER',userId:outsider.id})],owner);assert.equal(ui.ok,true);const uiToken=new URL(ui.link).pathname.split('/').pop();secrets.push(uiToken);assert.equal((await lookup(uiToken)).invitedById,owner.id);
 const forbidden=await invoke('manageOrganizationTeam',[org.slug,{},form({operation:'invite',email:`${prefix}-denied@example.test`,role:'MEMBER'})],member);assert.ok(!forbidden.ok);
 const anonymous=await invoke('answerOrganizationInvitation',[newer,{},form({response:'accept'})],null);assert.ok(!anonymous.ok);
 pass('server actions derive actor from Better Auth; forged identity, MEMBER and anonymous action calls denied; ADMIN cannot revoke ADMIN invitations');
 const rateIdentity=`${prefix}-rate`;for(let i=0;i<30;i++)assert.equal(await allowTeamRequest(db,rateIdentity,'invite'),true);assert.equal(await allowTeamRequest(db,rateIdentity,'invite'),false);
 pass('shared database invitation creation rate limit enforces 30/hour');
 }
 const browserToken=await issue(owner,browserInvitee.email,'EDITOR');const browserDecline=await issue(owner,decliner.email,'MEMBER');
 if(process.env.STEP21_SKIP_BROWSER!=='1'){
  chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-extensions','--remote-debugging-port=9337',`--user-data-dir=${resolve(root,'chrome-profile')}`,'about:blank'],{windowsHide:true});
  for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:9337/json/version')).ok)break;}catch{}await sleep(250);}
  const result=await child(['tests/organization-team-browser.mjs'],{origin,root,slug:org.slug,emptySlug:emptyOrg.slug,ip,owner,admin,editor,member,invited:browserInvitee,decliner,token:browserToken,declineToken:browserDecline});writeFileSync(`${root}/browser.log`,result.stdout+'\n'+result.stderr);assert.equal(result.code,0,'Browser suite failed; see browser report');console.log(result.stdout.trim());pass('desktop/mobile browser suite complete');
 }
 if(process.argv.includes('--regression')){
  const suites=[['tests/all-runtime-suite.mjs',...(process.env.NEXORA_RUNTIME_SUITES?.split(',').filter(Boolean)??[])],['tests/post-event-runtime.mjs'],['tests/reminder-scheduler-runtime.mjs']];
  for(const args of suites){const result=await child(args,null,{NEXORA_DISPOSABLE_APPROVED:'1',STEP20_DISPOSABLE_APPROVED:'1',STEP20_SKIP_BROWSER:'1',STEP18_DISPOSABLE_APPROVED:'1'});writeFileSync(`${root}/${args[0].split('/').pop()}.log`,result.stdout+'\n'+result.stderr);assert.equal(result.code,0,'Existing runtime regression failed: '+args[0]);pass('existing runtime regression: '+args[0]);}
 }
 ledger.ok=true;
}catch(error){ledger.failure=error.message;save();throw error;}
finally{
 if(chrome&&chrome.exitCode===null){chrome.kill();await Promise.race([new Promise(r=>chrome.once('exit',r)),sleep(3000)]);}if(server&&server.exitCode===null){server.kill();await Promise.race([new Promise(r=>server.once('exit',r)),sleep(3000)]);}
 try{
  const invitationRows=await db.organizationInvitation.findMany({where:{organizationId:{in:orgs}},select:{tokenHash:true,email:true,organizationId:true}});
  const invitationHashes=new Set(invitationRows.map(row=>row.tokenHash));
  await db.rateLimit.deleteMany({where:{key:{in:[...orgs.map(id=>'team:email-org:'+hashInvitationToken(id)),...invitationRows.map(row=>'team:email-recipient:'+hashInvitationToken(JSON.stringify([row.organizationId,row.email]))) ]}}});
  assert.ok(![...serverLogs.matchAll(/[A-Za-z0-9_-]{43}/g)].some(match=>invitationHashes.has(hashInvitationToken(match[0]))),'Raw invitation credential in application logs');
  const recovered=await db.user.findMany({where:{email:{startsWith:prefix}},select:{id:true}});for(const row of recovered)if(!users.includes(row.id))users.push(row.id);
  await db.event.deleteMany({where:{slug:{startsWith:prefix}}});await db.organization.deleteMany({where:{id:{in:orgs}}});await db.user.deleteMany({where:{id:{in:users}}});
  const identities=[...users,`${prefix}-rate`,`${ip}99::1`,...actors.map(x=>`${ip}${x.index}::1`),`${ip}98::1`];await db.rateLimit.deleteMany({where:{OR:[{key:{startsWith:ip}},{key:{in:identities.flatMap(identity=>['invite','respond','verify'].map(kind=>`team:${kind}:${hashInvitationToken(identity)}`))}}]}});
  assert.equal(await db.organization.count({where:{id:{in:orgs}}}),0);assert.equal(await db.user.count({where:{email:{startsWith:prefix}}}),0);assert.equal(await db.organizationInvitation.count({where:{organizationId:{in:orgs}}}),0);
  const profile=resolve(root,'chrome-profile');if(existsSync(profile)){const actual=realpathSync(profile);assert.ok(actual.startsWith(resolve(root)+sep));rmSync(actual,{recursive:true,force:true,maxRetries:8,retryDelay:250});}
  ledger.cleanupVerified=true;ledger.after=await fingerprint();for(const[table,before]of Object.entries(baseline??{}))if(table!=='RateLimit')assert.deepEqual(ledger.after[table],before);ledger.existingRecordsUnchanged=true;
  assert.ok(!secrets.some(secret=>serverLogs.includes(secret)));ledger.privateLogs=true;writeFileSync(`${root}/server.log`,serverLogs);pass('cleanup verified; all existing business-table counts/hashes unchanged; raw tokens absent from server logs');
 }catch(error){ledger.cleanupFailure=error.message;process.exitCode=1;}
 save();await db.$disconnect();console.log('Step21 report: '+root+'/runtime.json');
}

