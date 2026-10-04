import './support/typescript-loader.mjs';
import {registerHooks} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
registerHooks({resolve(specifier,context,nextResolve){
 const stubs={ 'server-only':'export default {}', 'react':'export const cache=fn=>fn', 'next/headers':'export const headers=async()=>new Headers()', 'next/navigation':'export const redirect=path=>{throw Error(path)}', '@/lib/env':'export const isAuthConfigured=()=>true', './auth':'export const getAuth=()=>({api:{getSession:async()=>globalThis.policySession}})' };
 if(stubs[specifier])return {url:'data:text/javascript,'+encodeURIComponent(stubs[specifier]),shortCircuit:true};return nextResolve(specifier,context);
}});
const {getAuthorizedUser,requireUser}=await import('../src/features/auth/server/session.ts');
test('server guards deny new unverified users and preserve legacy compatibility',async()=>{
 globalThis.policySession={user:{id:'new',emailVerified:false,verificationRequired:true}};
 assert.equal(await getAuthorizedUser(),null);await assert.rejects(()=>requireUser(),/\/verify-email\?required=1/);
 globalThis.policySession={user:{id:'legacy',emailVerified:false,verificationRequired:false}};
 assert.equal((await getAuthorizedUser()).id,'legacy');assert.equal((await requireUser()).id,'legacy');
 globalThis.policySession={user:{id:'verified',emailVerified:true,verificationRequired:true}};
 assert.equal((await getAuthorizedUser()).id,'verified');
 globalThis.policySession=null;assert.equal(await getAuthorizedUser(),null);await assert.rejects(()=>requireUser(),/\/sign-in/);
});
