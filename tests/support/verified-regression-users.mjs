// Disposable regression users exercise earlier features as verified accounts.
// Verify using Better Auth's signed token/API; never modify business users.
import './application-loader.mjs';
import { createEmailVerificationToken,getIP } from 'better-auth/api';
import { createHmac } from 'node:crypto';
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url??input);
 const response=await originalFetch(input,options);
 if(url.pathname==='/api/auth/sign-up/email'&&response.ok&&['localhost','127.0.0.1'].includes(url.hostname)) {
  const {user}=await response.clone().json();
  if(user?.id) {
   const token=await createEmailVerificationToken(process.env.AUTH_SECRET,user.email);
   const result=await originalFetch(url.origin+'/api/auth/verify-email?token='+encodeURIComponent(token),{headers:{'X-Forwarded-For':new Headers(options.headers).get('X-Forwarded-For')??'127.0.0.1'}});
   if(!result.ok)throw new Error('Regression fixture verification failed.');
   const {getDb}=await import('../../src/lib/db.ts');
   const ip=getIP(new Request(url.href,{headers:options.headers}),{})??'unknown';
   const key=(identity,kind)=>`auth-lifecycle:${kind}:${createHmac('sha256',process.env.AUTH_SECRET).update(identity).digest('hex')}`;
   await getDb().rateLimit.deleteMany({where:{key:{in:[key(user.email,'signup-cooldown'),key(user.email,'signup-hour'),key(ip,'email-ip')]}}});
  }
 }
 return response;
};
