// Test-only successful authentication transport. Blocks every real Resend call.
// This preload is only used by disposable regression servers; no production code imports it.
import { randomUUID } from 'node:crypto';
if (process.argv.some(arg=>/next[\\/]dist[\\/]bin[\\/]next$/.test(arg))) {
 process.env.RESEND_API_KEY='re_disposable_auth_mock';
 process.env.EMAIL_FROM='Nexora <hello@fixtures.nexora.invalid>';
}
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url??input);
 if(url.hostname==='api.resend.com') {
  const body=JSON.parse(options.body??'{}');
  const auth=['Verify your Nexora email','Reset your Nexora password'].includes(body.subject);
  return new Response(JSON.stringify(auth?{id:randomUUID()}:{name:'validation_error',message:'Mocked email provider failure.'}),{status:auth?200:403});
 }
 return originalFetch(input,options);
};
