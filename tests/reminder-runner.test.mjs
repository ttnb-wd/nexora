import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
const secret='test-only-runner-secret-at-least-32-characters';
const execute = env => new Promise((resolve,reject) => {
 const child=spawn(process.execPath,['scripts/run-reminders.mjs'],{env:{...process.env,...env},windowsHide:true});
 let stdout='',stderr='';child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
 child.on('error',reject);child.on('close',code=>resolve({code,stdout,stderr}));
});
test('local runner calls shared endpoint without body; prints safe counts and refuses secret-bearing redirects',async()=>{
 let requests=0,targetRequests=0,redirect=false;
 const target=createServer((_req,res)=>{targetRequests++;res.end('{}');});
 await new Promise(resolve=>target.listen(0,'127.0.0.1',resolve));
 const targetOrigin=`http://127.0.0.1:${target.address().port}`;
 const server=createServer((req,res)=>{
  requests++;assert.equal(req.method,'POST');assert.equal(req.url,'/api/internal/reminders/run');assert.equal(req.headers.authorization,`Bearer ${secret}`);
  let body='';req.on('data',data=>body+=data);req.on('end',()=>{
   assert.equal(body,'');
   if(redirect){res.writeHead(307,{Location:targetOrigin});res.end();}
   else{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({processed:2,delivered:1,skipped:1,failed:0,private:'not printed'}));}
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const APP_URL=`http://127.0.0.1:${server.address().port}`;
 try {
  const success=await execute({APP_URL,CRON_SECRET:secret});assert.equal(success.code,0);
  assert.deepEqual(JSON.parse(success.stdout),{processed:2,delivered:1,skipped:1,failed:0});assert.ok(!success.stdout.includes(secret)&&!success.stdout.includes('private'));
  redirect=true;const failure=await execute({APP_URL,CRON_SECRET:secret});assert.equal(failure.code,1);assert.equal(targetRequests,0);assert.ok(!failure.stderr.includes(secret));
  const invalid=await execute({APP_URL,CRON_SECRET:'short'});assert.equal(invalid.code,1);assert.equal(requests,2);
 } finally {await Promise.all([new Promise(resolve=>server.close(resolve)),new Promise(resolve=>target.close(resolve))]);}
});
