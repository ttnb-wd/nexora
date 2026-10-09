import './support/application-loader.mjs';
import './support/mock-resend.mjs';
import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, realpathSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';
assert.equal(process.env.STEP22_DISPOSABLE_APPROVED,'1','Disposable Step 22 fixtures must be approved.');
nextEnv.loadEnvConfig(process.cwd(),true);
Object.assign(process.env,{RESEND_API_KEY:'re_mock_step22_only',EMAIL_FROM:'Nexora <hello@sending.nexora.invalid>',EMAIL_REPLY_TO:'support@nexora.invalid',PUBLIC_APP_URL:'https://nexora-runtime.invalid'});
const {getDb}=await import('../src/lib/db.ts'); const db=getDb();
const {createAndEmailInvitation,deliverIssuedInvitation}=await import('../src/features/organizations/team/delivery.ts');
const {inviteTeamMember,invitationPreview,respondToInvitation}=await import('../src/features/organizations/team/service.ts');
const {hashInvitationToken}=await import('../src/features/organizations/team/token.ts');
const {allowTeamRequest}=await import('../src/features/organizations/team/rate-limit.ts');
const run=randomUUID(),prefix=`s22-${run}`,root=`artifacts/step22/${run}`,origin='http://127.0.0.1:3005',ip=`fd22:${run.slice(0,4)}:${run.slice(9,13)}:`;
mkdirSync(root,{recursive:true});
const ledger={passed:[],realEmailSent:false,cleanupVerified:false,existingRecordsUnchanged:false};
const pass=message=>{ledger.passed.push(message);writeFileSync(`${root}/runtime.json`,JSON.stringify(ledger,null,2));console.log('PASS '+message);};
const users=[],secrets=[],mailbox=[];let org,server,chrome,logs='',baseline,status=200;
const localFetch=globalThis.fetch;
globalThis.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url??input);
 if(url.hostname==='api.resend.com') { const body=JSON.parse(options.body); assert.equal(url.href,'https://api.resend.com/emails'); mailbox.push(body); return new Response(JSON.stringify(status===200?{id:randomUUID()}:{message:'Mocked private provider error'}),{status}); }
 return localFetch(input,options);
};
async function fingerprint(){const tables=await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;const result={};for(const{tablename}of tables){const name='"'+tablename.replaceAll('"','""')+'"';const[row]=await db.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t."id")::text,'[]')) AS digest FROM ${name} t`);result[tablename]=row;}return result;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const request=(path,options={})=>fetch(origin+path,{...options,headers:{Origin:origin,'X-Forwarded-For':`${ip}1::1`,...options.headers},signal:AbortSignal.timeout(65000)});
async function signup(label){const email=`${prefix}-${label}@example.test`,password=randomBytes(24).toString('hex');const res=await request('/api/auth/sign-up/email',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':`${ip}${users.length+1}::1`},body:JSON.stringify({name:`Step22 ${label}`,email,password})});assert.equal(res.status,200);const{user}=await res.json();users.push(user.id);const cookie=res.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');secrets.push(password,cookie);return{...user,password,cookie};}
const tokenFromMail=()=>{const token=mailbox.at(-1).text.match(/\/invitations\/([A-Za-z0-9_-]{43})/)[1];secrets.push(token);return token;};
const lookup=token=>db.organizationInvitation.findUniqueOrThrow({where:{tokenHash:hashInvitationToken(token)}});
async function child(args,fixture){return new Promise((done,reject)=>{const proc=spawn(process.execPath,args,{windowsHide:true,env:{...process.env,NODE_OPTIONS:args.some(arg=>arg.endsWith('-browser.mjs'))?'':process.env.NODE_OPTIONS,APP_URL:origin}});let out='';proc.stdout.on('data',x=>out+=x);proc.stderr.on('data',x=>out+=x);proc.on('error',reject);proc.on('close',code=>done({code,out}));proc.stdin.end(JSON.stringify(fixture));});}
try{
 baseline=await fingerprint();
 server=spawn(process.execPath,['--import','./tests/support/mock-resend.mjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3005'],{windowsHide:true,env:{...process.env,NODE_ENV:'production',APP_URL:origin,RESEND_API_KEY:''}});server.stdout.on('data',x=>logs+=x);server.stderr.on('data',x=>logs+=x);
 for(let i=0;i<80;i++){if(server.exitCode!==null)throw new Error('Test server failed');try{if((await request('/sign-in')).status===200)break;}catch{}await sleep(250);}
 const owner=await signup('owner'),recipient=await signup('recipient'),browserRecipient=await signup('browser-recipient'),outsider=await signup('outsider');
 org=await db.organization.create({data:{slug:prefix,name:'Step22 <unsafe> & organization',members:{create:{userId:owner.id,role:'OWNER'}}}});
 const issue=async(email,role='MEMBER',replaceId)=>createAndEmailInvitation(db,owner.id,org.slug,{email,role},replaceId);
 const sent=await issue(recipient.email);assert.equal(sent.delivery,'sent');assert.ok(!sent.link);
 const old=tokenFromMail(),row=await lookup(old);assert.ok(row.emailSentAt);assert.ok(row.emailProviderMessageId);assert.equal(row.emailSendAttempts,1);assert.deepEqual(mailbox.at(-1).to,[recipient.email]);
 assert.ok(mailbox.at(-1).html.includes('&lt;unsafe&gt; &amp; organization'));pass('Neon creation invokes mocked official SDK; recipient, escaped HTML/text and delivery metadata verified');
 const before=mailbox.length;await assert.rejects(()=>createAndEmailInvitation(db,outsider.id,org.slug,{email:recipient.email,role:'MEMBER'},row.id));assert.equal(mailbox.length,before);
 await assert.rejects(()=>issue(recipient.email,'MEMBER',row.id),/one minute/);pass('Unauthorized reissue and persistent one-minute cooldown blocked');
 await db.organizationInvitation.update({where:{id:row.id},data:{createdAt:new Date(0)}});
 status=401;const failed=await issue(recipient.email,'MEMBER',row.id);assert.equal(failed.delivery,'failed');const renewed=tokenFromMail(),renewedRow=await lookup(renewed);assert.equal(renewedRow.emailFailureCategory,'authentication');assert.equal(renewedRow.revokedAt,null);assert.ok(failed.link.endsWith(renewed));assert.equal((await invitationPreview(db,old)).state,'revoked');assert.equal((await invitationPreview(db,renewed)).state,'active');
 await assert.rejects(()=>respondToInvitation(db,recipient.id,old,'accept'),/revoked/);await assert.rejects(()=>respondToInvitation(db,outsider.id,renewed,'accept'),/different account/);await respondToInvitation(db,recipient.id,renewed,'accept');assert.equal(await db.organizationMember.count({where:{userId:recipient.id,organizationId:org.id}}),1);pass('Reissue rotates hash, permanently invalidates old token; provider failure preserves new link and email-match acceptance');
 for(const terminal of ['expired','revoked','accepted','declined']){const issued=await inviteTeamMember(db,owner.id,org.slug,{email:`${prefix}-${terminal}@example.test`,role:'MEMBER'});secrets.push(issued.token);await db.organizationInvitation.update({where:{id:issued.id},data:terminal==='expired'?{expiresAt:new Date(0)}:{[terminal+'At']:new Date()}});const prior=mailbox.length;await assert.rejects(()=>deliverIssuedInvitation(db,owner.id,org.slug,issued,process.env.PUBLIC_APP_URL));assert.equal(mailbox.length,prior);}
 pass('Expired, revoked, accepted and declined invitations cannot reach email provider');
 for(let i=0;i<5;i++)assert.equal(await allowTeamRequest(db,`${prefix}-rate`,'email-recipient'),true);assert.equal(await allowTeamRequest(db,`${prefix}-rate`,'email-recipient'),false);pass('Shared PostgreSQL email recipient rate limit enforced');
 status=200;const emailed=await issue(browserRecipient.email,'EDITOR');assert.equal(emailed.delivery,'sent');const browserToken=tokenFromMail();const mail=mailbox.at(-1);assert.ok(mail.text.includes(process.env.PUBLIC_APP_URL+'/invitations/'+browserToken));
 const anonymous=await(await request('/invitations/'+browserToken)).text();assert.ok(anonymous.includes('Sign in to accept invitation'));assert.ok(!anonymous.includes(browserRecipient.email));assert.ok(!anonymous.includes(row.emailProviderMessageId));pass('Emailed token supports anonymous preview without recipient/provider disclosure');
 const privateRows=JSON.stringify(await db.organizationInvitation.findMany({where:{organizationId:org.id}}));for(const token of secrets.filter(x=>/^[A-Za-z0-9_-]{43}$/.test(x)))assert.ok(!privateRows.includes(token));
 if(process.env.STEP22_SKIP_BROWSER!=='1') {
 chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-extensions','--remote-debugging-port=9338',`--user-data-dir=${resolve(root,'chrome-profile')}`,'about:blank'],{windowsHide:true});
 for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:9338/json/version')).ok)break;}catch{}await sleep(250);}
 const browser=await child(['tests/transactional-email-browser.mjs'],{origin,root,slug:org.slug,owner,recipient:browserRecipient,token:browserToken,ip});assert.ok(!secrets.some(secret=>browser.out.includes(secret)),'Browser output contains a private credential');writeFileSync(`${root}/browser.log`,browser.out);assert.equal(browser.code,0,'Step22 browser failed; inspect private artifact');console.log(browser.out.trim());
 assert.equal(await db.organizationMember.count({where:{userId:browserRecipient.id,organizationId:org.id,role:'EDITOR'}}),1);pass('Mock-emailed CTA → sign-in → accept creates one EDITOR membership in Neon');
 } else {
  await respondToInvitation(db,browserRecipient.id,browserToken,'accept');
  assert.equal(await db.organizationMember.count({where:{userId:browserRecipient.id,organizationId:org.id,role:'EDITOR'}}),1);pass('Mock-emailed invitation accepts through the supported service in Neon; browser suite skipped');
 }
 ledger.ok=true;
}catch(error){ledger.failure=error.message;process.exitCode=1;console.error('Step22 runtime failed: '+error.message);}
finally{
 for(const proc of [chrome,server])if(proc&&proc.exitCode===null){proc.kill();await Promise.race([new Promise(r=>proc.once('exit',r)),sleep(3000)]);}
 try{
  if(org){const rows=await db.organizationInvitation.findMany({where:{organizationId:org.id},select:{email:true}});await db.rateLimit.deleteMany({where:{key:{in:[`team:email-org:${hashInvitationToken(org.id)}`,...rows.map(row=>`team:email-recipient:${hashInvitationToken(JSON.stringify([org.id,row.email]))}`)]}}});await db.organization.delete({where:{id:org.id}});}
  const recovered=await db.user.findMany({where:{email:{startsWith:prefix}},select:{id:true}});const ids=[...new Set([...users,...recovered.map(x=>x.id)])];await db.user.deleteMany({where:{id:{in:ids}}});await db.rateLimit.deleteMany({where:{OR:[{key:{startsWith:ip}},{key:{in:[...ids.flatMap(id=>['invite','respond','verify'].map(kind=>`team:${kind}:${hashInvitationToken(id)}`)),`team:email-recipient:${hashInvitationToken(prefix+'-rate')}`,`team:verify:${hashInvitationToken(ip+'1::1')}`,`team:verify:${hashInvitationToken(ip+'98::1')}`]}}]}});
  assert.equal(await db.user.count({where:{email:{startsWith:prefix}}}),0);assert.equal(await db.organization.count({where:{slug:prefix}}),0);ledger.cleanupVerified=true;
  const after=await fingerprint();for(const[table,value]of Object.entries(baseline??{}))if(table!=='RateLimit')assert.deepEqual(after[table],value);ledger.existingRecordsUnchanged=true;
  assert.ok(!secrets.some(secret=>logs.includes(secret)));assert.ok(!logs.includes(process.env.RESEND_API_KEY));writeFileSync(`${root}/server.log`,logs);pass('Disposable fixtures cleaned; existing business-table fingerprints unchanged; no key/token in logs');
  const profile=resolve(root,'chrome-profile');if(existsSync(profile)){const actual=realpathSync(profile);assert.ok(actual.startsWith(resolve(root)+sep));rmSync(actual,{recursive:true,force:true,maxRetries:8,retryDelay:250});}
 }catch(error){ledger.cleanupFailure=error.message;process.exitCode=1;}
 writeFileSync(`${root}/runtime.json`,JSON.stringify(ledger,null,2));await db.$disconnect();globalThis.fetch=localFetch;console.log('Step22 report: '+root+'/runtime.json');
}
