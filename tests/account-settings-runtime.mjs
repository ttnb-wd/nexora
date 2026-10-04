import './support/application-loader.mjs';
import './support/mock-auth-email.mjs';
import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
assert.equal(process.env.STEP24_DISPOSABLE_APPROVED,'1');
nextEnv.loadEnvConfig(process.cwd(),true);
Object.assign(process.env,{APP_URL:'http://localhost:3009',PUBLIC_APP_URL:'http://localhost:3009',RESEND_API_KEY:'re_step24_mock',EMAIL_FROM:'Nexora <onboarding@resend.dev>'});
const {getDb}=await import('../src/lib/db.ts'),db=getDb();
const {getAuth}=await import('../src/features/auth/server/auth.ts'),auth=getAuth();
const {GET,POST}=await import('../src/app/api/account/route.ts');
const lifecycle=await import('../src/app/api/auth/[...all]/route.ts');
const {createEmailVerificationToken,getIP}=await import('better-auth/api');
const {lifecycleKey}=await import('../src/features/auth/server/lifecycle-rate-limit.ts');
const {disconnectAccountLocks}=await import('../src/features/account/server/security-lock.ts');
const run=randomUUID(),prefix='s24-'+run,root='artifacts/step24/'+run,ip='fd24:'+run.slice(0,4)+':'+run.slice(9,13)+'::1';
const resolvedIp=getIP(new Request(process.env.APP_URL,{headers:{'X-Forwarded-For':ip}}),auth.options);
mkdirSync(root,{recursive:true});const report={passed:[],realEmailSent:false,cleanupVerified:false};const users=[],keys=new Set(),secrets=[],logs=[];let baseline;
const savedError=console.error;console.error=(...args)=>logs.push(args.join(' '));
const pass=label=>{report.passed.push(label);console.log('PASS '+label);};
function cookie(response){return response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');}
function headers(actor){return new Headers({Origin:process.env.APP_URL,Cookie:actor?.cookie??'','X-Forwarded-For':ip,'Content-Type':'application/json'});}
async function post(actor,body,extra={}){const h=headers(actor);for(const[k,v]of Object.entries(extra))h.set(k,v);return POST(new Request(process.env.APP_URL+'/api/account',{method:'POST',headers:h,body:JSON.stringify(body)}));}
async function settings(actor){const result=await GET(new Request(process.env.APP_URL+'/api/account',{headers:headers(actor)}));assert.equal(result.status,200);const text=await result.text();assert.ok(!secrets.some(secret=>text.includes(secret)));return JSON.parse(text);}
async function signup(label,verified=true,password=randomUUID()){
 const email=prefix+'-'+label+'@example.test';secrets.push(password);
 const res=await auth.api.signUpEmail({body:{name:'Step24 '+label,email,password},asResponse:true});assert.equal(res.status,200);const {user}=await res.json();users.push(user.id);
 if(verified){const token=await createEmailVerificationToken(process.env.AUTH_SECRET,email);secrets.push(token);await auth.api.verifyEmail({query:{token}});}
 const result=await auth.api.signInEmail({body:{email,password},asResponse:true});assert.equal(result.status,200);const actor={id:user.id,email,password,cookie:cookie(result)};secrets.push(actor.cookie);return actor;
}
async function login(actor,password=actor.password){const res=await auth.api.signInEmail({body:{email:actor.email,password},asResponse:true});assert.equal(res.status,200);const value={...actor,cookie:cookie(res)};secrets.push(value.cookie);return value;}
async function fingerprint(){const result={};for(const{tablename}of await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`){if(tablename==='RateLimit')continue;const name='"'+tablename.replaceAll('"','""')+'"';const[row]=await db.$queryRawUnsafe(`SELECT count(*)::int count,md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t."id")::text,'[]')) digest FROM ${name} t`);result[tablename]=row;}return result;}
try{
 baseline=await fingerprint();
 const a=await signup('owner'),b=await signup('other'),unverified=await signup('unverified',false);
 for(const actor of [a,b,unverified])for(const kind of ['password','sessions'])keys.add(lifecycleKey(actor.id,'account-'+kind+'-user'));
 for(const kind of ['password','sessions'])keys.add(lifecycleKey(resolvedIp,'account-'+kind+'-ip'));
 let res=await post(a,{action:'profile',name:'  Updated public name  '});assert.equal(res.status,200);assert.equal((await settings(a)).name,'Updated public name');pass('Own name updates through Better Auth and whitespace is trimmed');
 const repeated=await Promise.all([post(a,{action:'profile',name:'Concurrent name one'}),post(a,{action:'profile',name:'Concurrent name two'})]);assert.ok(repeated.every(response=>response.status===200));assert.ok(['Concurrent name one','Concurrent name two'].includes((await settings(a)).name));pass('Repeated profile updates remain safe with last-write-wins behavior');
 for(const name of ['','x'.repeat(81)])assert.equal((await post(a,{action:'profile',name})).status,400);pass('Empty and oversized names rejected');
 const originalB=(await settings(b)).name;assert.equal((await post(a,{action:'profile',name:'Forged',userId:b.id})).status,400);assert.equal((await settings(b)).name,originalB);assert.equal((await post(null,{action:'profile',name:'Unauthenticated'})).status,401);pass('Forged user identity and unauthenticated mutations rejected');
 assert.equal((await settings(a)).emailVerified,true);assert.equal((await settings(unverified)).emailVerified,false);assert.equal((await post(unverified,{action:'profile',name:'Self service unverified'})).status,200);pass('Verified/unverified state is accurate and unverified users retain own security self-service');
 const stale=await auth.api.getSession({headers:headers(b)});await db.session.update({where:{id:stale.session.id},data:{createdAt:new Date(Date.now()-172800000)}});assert.equal((await settings(b)).sessionsAvailable,false);assert.equal((await settings(b)).sessions.length,0);b.cookie=(await login(b)).cookie;assert.equal((await settings(b)).sessionsAvailable,true);pass('Stale session listing respects Better Auth freshness and renewed sign-in restores access');
 for(const kind of ['verification-cooldown','verification-hour'])keys.add(lifecycleKey(unverified.email,kind));keys.add(lifecycleKey(resolvedIp,'email-ip'));
 const recoveryBody={email:unverified.email};const makeRecovery=()=>new Request(process.env.APP_URL+'/api/auth/send-verification-email',{method:'POST',headers:headers(unverified),body:JSON.stringify(recoveryBody)});
 assert.equal((await lifecycle.POST(makeRecovery())).status,200);assert.equal((await lifecycle.POST(makeRecovery())).status,200);assert.ok((await db.rateLimit.findUniqueOrThrow({where:{key:lifecycleKey(unverified.email,'verification-cooldown')}})).count>=2);pass('Verification resend reuses Step23 generic responses and persisted cooldown');
 let info=await settings(a);assert.ok(info.sessions.some(s=>s.current));assert.ok(info.sessions.some(s=>!s.current));
 const persisted=await db.session.findMany({where:{userId:a.id}});for(const row of persisted)secrets.push(row.token);assert.ok(!JSON.stringify(info).includes('token'));assert.ok(info.sessions.every(s=>!('ipAddress'in s)&&!('userAgent'in s)));pass('Current/other sessions appear with sanitized metadata and no tokens/IPs');
 const foreign=(await settings(b)).sessions.find(s=>s.current);assert.equal((await post(a,{action:'revoke',sessionId:foreign.id,confirm:true})).status,200);assert.ok(await auth.api.getSession({headers:headers(b)}));pass('Foreign session identifier cannot revoke another user');
 const current=info.sessions.find(s=>s.current);assert.equal((await post(a,{action:'revoke',sessionId:current.id,confirm:true})).status,400);assert.equal((await post(a,{action:'revokeOthers',confirm:false})).status,400);pass('Current session revocation and missing confirmations rejected');
 const extra=await login(a),extraSession=await auth.api.getSession({headers:headers(extra)});
 const duplicates=await Promise.all([post(a,{action:'revoke',sessionId:extraSession.session.id,confirm:true}),post(a,{action:'revoke',sessionId:extraSession.session.id,confirm:true})]);assert.ok(duplicates.every(r=>r.status===200));assert.equal(await auth.api.getSession({headers:headers(extra)}),null);pass('Duplicate own-session revocation is idempotent and revoked cookie cannot authenticate');
 const more=await login(a);assert.equal((await post(a,{action:'revokeOthers',confirm:true})).status,200);assert.equal(await auth.api.getSession({headers:headers(more)}),null);assert.ok(await auth.api.getSession({headers:headers(a)}));pass('Revoke-all-others preserves current session and removes others');
 const newPassword=randomUUID();secrets.push(newPassword);
 assert.equal((await post(a,{action:'password',currentPassword:'wrong current password',newPassword,confirmPassword:newPassword})).status,400);
 assert.equal((await post(a,{action:'password',currentPassword:a.password,newPassword:'short',confirmPassword:'short'})).status,400);
 assert.equal((await post(a,{action:'password',currentPassword:a.password,newPassword,confirmPassword:'mismatch'})).status,400);pass('Wrong current password, weak password and mismatched confirmation rejected');
 const oldOther=await login(a);res=await post(a,{action:'password',currentPassword:a.password,newPassword,confirmPassword:newPassword});assert.equal(res.status,200);assert.deepEqual(await res.json(),{ok:true});const rotated={...a,cookie:cookie(res),password:newPassword};assert.ok(rotated.cookie);secrets.push(rotated.cookie);assert.equal(await auth.api.getSession({headers:headers(a)}),null);assert.equal(await auth.api.getSession({headers:headers(oldOther)}),null);assert.ok(await auth.api.getSession({headers:headers(rotated)}));await assert.rejects(()=>auth.api.signInEmail({body:{email:a.email,password:a.password}}));await login(rotated);pass('Password changes via Better Auth, old password fails, new password works, all old sessions revoked and replacement cookie authenticates');
 res=await post(rotated,{action:'preferences',timezone:'Asia/Yangon'});assert.equal(res.status,200);assert.equal((await settings(rotated)).timezone,'Asia/Yangon');assert.equal((await post(rotated,{action:'preferences',timezone:'+06:30'})).status,400);assert.equal((await post(rotated,{action:'preferences',timezone:''})).status,200);assert.equal((await settings(rotated)).timezone,null);pass('Optional IANA timezone persists, offsets are rejected and clearing works');
 const p2=randomUUID();secrets.push(p2);const concurrent=await Promise.all([post(rotated,{action:'password',currentPassword:newPassword,newPassword:p2,confirmPassword:p2}),post(rotated,{action:'password',currentPassword:newPassword,newPassword:p2,confirmPassword:p2})]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,401]);pass('Concurrent password submissions serialize; stale duplicate authorization is rejected');
 const latest=await login(rotated,p2);for(let i=0;i<3;i++)await post(latest,{action:'password',currentPassword:'wrong current password',newPassword:p2,confirmPassword:p2});assert.equal((await post(latest,{action:'password',currentPassword:'wrong current password',newPassword:p2,confirmPassword:p2})).status,429);pass('Password attempts are persistently limited per account and safe IP key');
 assert.equal((await post(b,{action:'profile',name:'Cross origin'},{Origin:'https://evil.invalid'})).status,403);assert.equal((await post(b,{action:'profile',name:'Cross site'},{'sec-fetch-site':'cross-site'})).status,403);pass('Cross-origin and cross-site account mutations rejected');
 const {publicEventSelect}=await import('../src/features/events/server/public-event-mapper.ts');assert.ok(!JSON.stringify(publicEventSelect).includes('email'));pass('Public event projection continues to omit creator email and security metadata');
 assert.ok(!secrets.some(value=>logs.join('\n').includes(value)));pass('Captured application logs omit passwords and auth/session tokens');
 if(process.env.STEP24_BROWSER_HOLD==='1'){
  const browser=await signup('browser',true,'Step24 disposable browser passphrase');const second=await login(browser);void second;
  keys.add(lifecycleKey(browser.id,'account-sessions-user'));
  report.browserEmail=browser.email;writeFileSync('artifacts/step24/browser-fixture.json',JSON.stringify({email:browser.email,root}));
  console.log('BROWSER_READY '+root);
  const deadline=Date.now()+900000;while(!existsSync(root+'/browser-done')&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,1000));
  assert.ok(existsSync(root+'/browser-done'),'Browser fixture timed out');
 }
 report.ok=true;
}catch{report.ok=false;report.failure='Runtime account test failed after '+(report.passed.at(-1)??'preflight');console.log('FAIL '+report.failure);process.exitCode=1;}
finally{
 try{
  const recovered=await db.user.findMany({where:{email:{startsWith:prefix}},select:{id:true}});const ids=[...new Set([...users,...recovered.map(x=>x.id)])];
  for(const id of ids)for(const kind of ['password','sessions'])keys.add(lifecycleKey(id,'account-'+kind+'-user'));
  // Browser requests originate from loopback, and only this held isolated test uses the server.
  if(process.env.STEP24_BROWSER_HOLD==='1')for(const identity of ['127.0.0.1','unknown','0000:0000:0000:0000:0000:0000:0000:0001'])for(const kind of ['password','sessions'])keys.add(lifecycleKey(identity,'account-'+kind+'-ip'));
  await db.verification.deleteMany({where:{value:{in:ids}}});await db.user.deleteMany({where:{id:{in:ids}}});await db.rateLimit.deleteMany({where:{key:{in:[...keys]}}});await db.rateLimit.deleteMany({where:{key:{startsWith:resolvedIp+'|'}}});
  assert.equal(await db.user.count({where:{email:{startsWith:prefix}}}),0);assert.equal(await db.session.count({where:{userId:{in:ids}}}),0);assert.equal(await db.account.count({where:{userId:{in:ids}}}),0);assert.equal(await db.rateLimit.count({where:{key:{in:[...keys]}}}),0);assert.deepEqual(await fingerprint(),baseline);report.cleanupVerified=true;report.existingBusinessRecordsUnchanged=true;pass('Disposable records cleaned and original business fingerprints unchanged');
 }catch{report.cleanupVerified=false;process.exitCode=1;}
 writeFileSync(root+'/runtime.json',JSON.stringify(report,null,2));console.log('Step24 report: '+root+'/runtime.json');console.error=savedError;await disconnectAccountLocks();await db.$disconnect();
}
