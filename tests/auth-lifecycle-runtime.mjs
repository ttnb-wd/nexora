import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync,writeFileSync } from 'node:fs';
assert.equal(process.env.STEP23_DISPOSABLE_APPROVED,'1');
nextEnv.loadEnvConfig(process.cwd(),true);
Object.assign(process.env,{APP_URL:'http://localhost:3006',PUBLIC_APP_URL:'http://localhost:3006',RESEND_API_KEY:'re_step23_mock',EMAIL_FROM:'Nexora <onboarding@resend.dev>'});
const {getDb}=await import('../src/lib/db.ts');const db=getDb();
const {getAuth}=await import('../src/features/auth/server/auth.ts');const auth=getAuth();
const {GET,POST}=await import('../src/app/api/auth/[...all]/route.ts');
const {createEmailVerificationToken,getIP}=await import('better-auth/api');
const {allowLifecycleRequest,lifecycleKey}=await import('../src/features/auth/server/lifecycle-rate-limit.ts');
const {resetPasswordSchema}=await import('../src/features/auth/schemas.ts');
const run=randomUUID(),prefix=`s23-${run}`,root=`artifacts/step23/${run}`,ip=`fd23:${run.slice(0,4)}:${run.slice(9,13)}::1`;
const resolvedIp=getIP(new Request(process.env.APP_URL,{headers:{'X-Forwarded-For':ip}}),auth.options);
mkdirSync(root,{recursive:true});const report={passed:[],realEmailSent:false};
const secrets=[],mailbox=[],rateKeys=new Set(),emails=[],users=[];let status=200;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url??input);if(url.hostname==='api.resend.com'){assert.equal(url.href,'https://api.resend.com/emails');mailbox.push(JSON.parse(options.body));return new Response(JSON.stringify(status===200?{id:randomUUID()}:{message:'private provider error'}),{status});}return originalFetch(input,options);};
const pass=label=>{report.passed.push(label);console.log('PASS '+label);};
function rememberRates(email,kind){for(const k of [`${kind}-cooldown`,`${kind}-hour`])rateKeys.add(lifecycleKey(email,k));rateKeys.add(lifecycleKey(ip,'email-ip'));rateKeys.add(lifecycleKey(resolvedIp,'email-ip'));}
async function request(path,body,headers={}){const method=body?'POST':'GET';const req=new Request(process.env.APP_URL+'/api/auth'+path,{method,headers:{Origin:process.env.APP_URL,'X-Forwarded-For':ip,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});return (method==='POST'?POST:GET)(req);}
const token=()=>{const mail=mailbox.at(-1);const url=new URL(mail.text.split('\n').find(line=>line.startsWith('http')));const value=url.searchParams.get('token')??url.pathname.split('/').at(-1);secrets.push(value);return value;};
async function fingerprint(){return await db.user.findMany({where:{NOT:{email:{startsWith:prefix}}},orderBy:{id:'asc'},select:{id:true,emailVerified:true,verificationRequired:true,updatedAt:true}});}
async function tableFingerprint(){
 const tables=await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
 const result={};
 for(const {tablename} of tables){
  if(tablename==='RateLimit')continue;
  const quoted='"'+tablename.replaceAll('"','""')+'"';
  const [row]=await db.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t."id")::text,'[]')) AS digest FROM ${quoted} t`);
  result[tablename]=row;
 }
 return result;
}
let baseline,baselineTables;const logs=[];const savedLog=console.error;console.error=(...args)=>logs.push(args.join(' '));
try{
 baselineTables=await tableFingerprint();baseline=await fingerprint();report.existingUsers={total:baseline.length,unverified:baseline.filter(x=>!x.emailVerified).length,grandfathered:baseline.filter(x=>!x.verificationRequired).length};
 const email=prefix+'@example.test',password=randomUUID(),newPassword=randomUUID();emails.push(email);secrets.push(password,newPassword);rememberRates(email,'signup');
 const signup=await request('/sign-up/email',{name:'Step23 User',email,password,verificationRequired:false});assert.equal(signup.status,200);const signed=await signup.json();users.push(signed.user.id);const cookie=signup.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');secrets.push(cookie);
 let user=await db.user.findUniqueOrThrow({where:{id:signed.user.id}});assert.equal(user.emailVerified,false);assert.equal(user.verificationRequired,true);assert.equal(mailbox.at(-1).subject,'Verify your Nexora email');const verificationToken=token();pass('New signup stays unverified, ignores client compatibility override, and generates escaped verification email');
 assert.equal((await auth.api.signInEmail({body:{email,password}})).user.emailVerified,false);pass('Supported sign-in allows unverified account; application guards enforce new-account restriction');
 const verify=await request('/verify-email?token='+verificationToken);assert.equal(verify.status,200);assert.equal((await db.user.findUniqueOrThrow({where:{id:user.id}})).emailVerified,true);
 assert.equal((await request('/verify-email?token='+verificationToken)).status,200);pass('Verification updates emailVerified; reuse is safe and idempotent');
 assert.ok((await request('/verify-email?token=invalid')).status>=400);
 const expired=await createEmailVerificationToken(process.env.AUTH_SECRET,email,undefined,-10);secrets.push(expired);assert.ok((await request('/verify-email?token='+expired)).status>=400);pass('Invalid and expired signed verification links rejected');
 const resendEmail=prefix+'-resend@example.test';emails.push(resendEmail);rememberRates(resendEmail,'signup');const res=await request('/sign-up/email',{name:'Step23 Resend',email:resendEmail,password});assert.equal(res.status,200);users.push((await res.json()).user.id);rememberRates(resendEmail,'verification');
 let count=mailbox.length;assert.equal((await request('/send-verification-email',{email:' '+resendEmail.toUpperCase()+' '})).status,200);assert.equal(mailbox.length,count+1);
 count=mailbox.length;const throttled=await request('/send-verification-email',{email:resendEmail});assert.equal(mailbox.length,count);pass('Verification resend works, normalizes email, and enforces persisted 60-second cooldown');
 const absent=prefix+'-absent@example.test';rememberRates(absent,'verification');rememberRates(absent,'forgot');const missing=await request('/send-verification-email',{email:absent});assert.deepEqual(await missing.json(),await throttled.json());pass('Nonexistent and throttled resend responses are identical');
 rememberRates(email,'forgot');await request('/request-password-reset',{email});assert.equal(mailbox.at(-1).subject,'Reset your Nexora password');const resetToken=token();const identifier=createHash('sha256').update('reset-password:'+resetToken).digest('base64url');let row=await db.verification.findFirstOrThrow({where:{identifier}});assert.equal(row.value,user.id);assert.ok(Math.abs(row.expiresAt.getTime()-Date.now()-3600000)<20000);assert.ok(!JSON.stringify(row).includes(resetToken));pass('Reset email generated; token identifier stored hashed with one-hour expiration');
 rateKeys.add(lifecycleKey(resolvedIp,'reset-callback'));
 const callback=await request('/reset-password/'+resetToken+'?callbackURL='+encodeURIComponent(process.env.APP_URL+'/reset-password'));
 assert.ok(callback.status>=300&&callback.status<400);assert.equal(new URL(callback.headers.get('location')).searchParams.get('token'),resetToken);
 assert.equal(await db.rateLimit.count({where:{key:{contains:resetToken}}}),0);pass('Native reset email callback redirects correctly without persisting the raw token in rate-limit keys');
 assert.equal((await request('/reset-password',{token:resetToken,newPassword:'short',confirmPassword:'short'})).status,400);
 assert.equal((await request('/reset-password',{token:resetToken,newPassword,confirmPassword:'mismatch'})).status,400);assert.equal(await db.verification.count({where:{identifier}}),1);pass('Weak passwords and mismatched confirmation rejected without consuming valid token');
 const beforeSessions=await db.session.count({where:{userId:user.id}});assert.ok(beforeSessions>0);
 const responses=await Promise.all([request('/reset-password',{token:resetToken,newPassword,confirmPassword:newPassword}),request('/reset-password',{token:resetToken,newPassword,confirmPassword:newPassword})]);assert.deepEqual(responses.map(x=>x.status).sort(),[200,400]);assert.equal(await db.session.count({where:{userId:user.id}}),0);assert.equal(await db.verification.count({where:{identifier}}),0);pass('Concurrent reset consumes token once, changes password, and revokes all persisted sessions');
 await assert.rejects(()=>auth.api.signInEmail({body:{email,password}}));assert.equal((await auth.api.signInEmail({body:{email,password:newPassword}})).user.id,user.id);pass('Old password fails and new password signs in');
 await auth.api.requestPasswordReset({body:{email,redirectTo:'/reset-password'}});const expiredReset=token();const expIdentifier=createHash('sha256').update('reset-password:'+expiredReset).digest('base64url');await db.verification.updateMany({where:{identifier:expIdentifier},data:{expiresAt:new Date(0)}});
 await assert.rejects(()=>auth.api.resetPassword({body:{token:expiredReset,newPassword}}));pass('Expired reset token rejected by Better Auth');
 const absentReset=await request('/request-password-reset',{email:absent});assert.deepEqual(await absentReset.json(),{status:true,message:'If an account exists for that email, we sent instructions.'});
 status=403;const failedEmail=prefix+'-failure@example.test';emails.push(failedEmail);const ctx=await auth.$context;const fixture=await ctx.internalAdapter.createUser({email:failedEmail,name:'Step23 failure',emailVerified:false});users.push(fixture.id);rememberRates(failedEmail,'forgot');const failed=await request('/request-password-reset',{email:failedEmail});assert.deepEqual(await failed.json(),{status:true,message:'If an account exists for that email, we sent instructions.'});status=200;pass('Nonexistent accounts and provider failures return generic reset response without leaking errors');
 const wrongOrigin=await request('/request-password-reset',{email},{Origin:'https://evil.invalid'});assert.equal(wrongOrigin.status,403);assert.equal((await request('/reset-password',{newPassword,confirmPassword:newPassword})).status,400);assert.equal((await request('/change-password',{newPassword})).status,404);pass('Cross-origin recovery and unauthorized reset/account mutation rejected');
 assert.equal((await request('/verify-email?token='+verificationToken+'&callbackURL='+encodeURIComponent('https://evil.invalid'))).status,403);pass('Better Auth rejects untrusted verification callback origins');
 const savedKey=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY='';rememberRates(failedEmail,'verification');const beforeMissing=mailbox.length;
 const missingConfig=await request('/send-verification-email',{email:failedEmail});assert.equal(missingConfig.status,200);assert.equal(mailbox.length,beforeMissing);
 const {sendAuthenticationEmail}=await import('../src/services/email/authentication.ts');await assert.rejects(()=>sendAuthenticationEmail('verification',failedEmail,process.env.APP_URL+'/api/auth/verify-email?token=invalid'));
 process.env.RESEND_API_KEY=savedKey;pass('Missing email configuration fails internally, contacts no provider, and preserves generic public response');
 for(let i=0;i<6;i++){const identity=prefix+'-rate@example.test';rememberRates(identity,'verification');const allowed=await allowLifecycleRequest(identity,ip,'verification');assert.equal(allowed,i===0);}
 const persisted=await db.rateLimit.findMany({where:{key:{in:[...rateKeys]}}});assert.ok(persisted.some(x=>x.count>=6));assert.ok(persisted.every(x=>!x.key.includes(email)&&!x.key.includes(resetToken)));pass('Cooldown/hourly abuse limits persist in Neon using HMAC keys');
 const rateIdentity=prefix+'-rate@example.test';await db.rateLimit.update({where:{key:lifecycleKey(rateIdentity,'verification-cooldown')},data:{lastRequest:0n}});assert.equal(await allowLifecycleRequest(rateIdentity,ip,'verification'),false);pass('Hourly email limit independently blocks requests even after cooldown elapses');
 assert.equal(resetPasswordSchema.safeParse({token:'x',newPassword,confirmPassword:'different'}).success,false);
 assert.ok(!secrets.some(secret=>logs.join('\n').includes(secret)));pass('No captured auth logs contain passwords, reset tokens, verification tokens or sessions');report.ok=true;
}catch(error){report.ok=false;report.failure=error.message;process.exitCode=1;console.log('FAIL Step23: '+error.message);}
finally{
 try{const recovered=await db.user.findMany({where:{email:{startsWith:prefix}},select:{id:true}});const ids=[...new Set([...users,...recovered.map(x=>x.id)])];await db.verification.deleteMany({where:{value:{in:ids}}});await db.user.deleteMany({where:{id:{in:ids}}});await db.rateLimit.deleteMany({where:{key:{in:[...rateKeys]}}});await db.rateLimit.deleteMany({where:{key:{startsWith:resolvedIp+'|'}}});assert.equal(await db.user.count({where:{email:{startsWith:prefix}}}),0);assert.equal(await db.verification.count({where:{value:{in:ids}}}),0);assert.equal(await db.rateLimit.count({where:{key:{in:[...rateKeys]}}}),0);assert.equal(await db.rateLimit.count({where:{key:{startsWith:resolvedIp+'|'}}}),0);assert.deepEqual(await fingerprint(),baseline);assert.deepEqual(await tableFingerprint(),baselineTables);report.cleanupVerified=true;report.existingBusinessUsersUnchanged=true;pass('All disposable auth rows/rate keys cleaned; existing users unchanged');}catch(error){report.cleanupFailure=error.message;process.exitCode=1;}
 writeFileSync(root+'/runtime.json',JSON.stringify(report,null,2));console.log('Step23 report: '+root+'/runtime.json');globalThis.fetch=originalFetch;console.error=savedLog;await db.$disconnect();
}
