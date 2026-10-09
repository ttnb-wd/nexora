import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,realpathSync,rmSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import nextEnv from '@next/env';
import {hashPassword} from 'better-auth/crypto';
assert.equal(process.env.STEP25_DISPOSABLE_APPROVED,'1');
nextEnv.loadEnvConfig(process.cwd(),true);
const {getDb}=await import('../src/lib/db.ts'),db=getDb();
const run=randomUUID(),prefix='s25-browser-'+run,term='Discovery'+run.slice(0,8),root='artifacts/step25/browser-'+run,origin='http://127.0.0.1:3010',ip='fd25:'+run.slice(0,4)+':'+run.slice(9,13)+':'+run.slice(14,18)+':',profile=resolve(root,'chrome-profile');
mkdirSync(root,{recursive:true});
const report={passed:[],viewports:[],consoleErrors:[],cleanupVerified:false,existingRecordsUnchanged:false};
let server,chrome,socket,baseline,user,org,logs='';const slugs=[],userId=prefix,password=randomUUID(),email=prefix+'@example.test';
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),pass=label=>{report.passed.push(label);console.log('PASS '+label);};
async function fingerprint(){const result={};for(const{tablename}of await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`){const name='"'+tablename.replaceAll('"','""')+'"';const where=tablename==='RateLimit'?`WHERE t.key NOT LIKE '${ip}%'`:'';const[row]=await db.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t."id")::text,'[]')) AS digest FROM ${name} t ${where}`);result[tablename]=row;}return result;}
let id=0;const pending=new Map();
function send(method,params={}){return new Promise((resolveCall,reject)=>{const key=++id;pending.set(key,{resolve:resolveCall,reject});socket.send(JSON.stringify({id:key,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;}
async function until(expression){const deadline=Date.now()+45000;while(Date.now()<deadline){try{if(await evaluate(expression))return;}catch{}await sleep(150);}report.failureState=await evaluate(`({url:location.href,active:document.activeElement?.outerHTML?.slice(0,300),main:document.querySelector('main')?.innerText?.slice(0,1500)})`);await screenshot('failure');throw new Error('Timed out: '+expression+'; state '+JSON.stringify(report.failureState));}
async function go(path){await send('Page.navigate',{url:origin+path});await until(`location.pathname===${JSON.stringify(path.split('?')[0])} && document.readyState==='complete' && !!document.querySelector('main')`);await sleep(800);}
async function click(expression){const point=await evaluate(`(()=>{const el=${expression};if(!el)throw Error('Missing target');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});}
async function key(name,code,vk){await send('Input.dispatchKeyEvent',{type:'keyDown',key:name,code,windowsVirtualKeyCode:vk,...(name==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key:name,code,windowsVirtualKeyCode:vk});}
async function fill(selector,text){await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await send('Input.insertText',{text});}
async function screenshot(name){const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(root+'/'+name+'.png',Buffer.from(image.data,'base64'));}
async function viewport(width){await send('Emulation.setDeviceMetricsOverride',{width,height:width===320?740:width===390?844:1000,deviceScaleFactor:1,mobile:width<600});}
const input='main form[role="search"] input[name="q"]';
try{
 baseline=await fingerprint();
 user=await db.user.create({data:{id:userId,name:'Search Fixture Attendee',email,emailVerified:true,verificationRequired:false,accounts:{create:{providerId:'credential',accountId:userId,password:await hashPassword(password)}}}});
 org=await db.organization.create({data:{slug:prefix+'-org',name:term+' Studio',industry:'Design',city:'Yangon'}});
 for(let i=0;i<15;i++){const slug=prefix+'-'+i;slugs.push(slug);await db.event.create({data:{slug,title:term+' Design '+String(i).padStart(2,'0'),description:'Real public search browser fixture.',category:'Design',startAt:new Date(Date.now()+86400000*(10+i)),endAt:new Date(Date.now()+86400000*(10+i)+3600000),timezone:'Asia/Yangon',status:'PUBLISHED',eventType:i===0?'ONLINE':'IN_PERSON',city:'Yangon',locationName:'Search Hall',organizationId:org.id,creatorId:user.id,...(i===0?{speakers:{create:{name:term+' Speaker',role:'Designer',company:org.name,bio:'Public fixture speaker.',sortOrder:0}}}:{})}});}
 server=spawn(process.execPath,['--import','./tests/support/mock-auth-email.mjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3010'],{windowsHide:true,env:{...process.env,NODE_ENV:'production',APP_URL:origin,PUBLIC_APP_URL:' ',NEXORA_AUTH_EMAIL_MOCK:'1'}});
 server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error('Test server exited');try{if((await fetch(origin+'/sign-in')).ok)break;}catch{}await sleep(200);}
 chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-extensions','--remote-debugging-port=9340','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let targets;for(let i=0;i<100;i++){try{targets=await(await fetch('http://127.0.0.1:9340/json/list')).json();if(targets.some(t=>t.type==='page'))break;}catch{}await sleep(200);}
 socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
 socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const task=pending.get(m.id);pending.delete(m.id);if(m.error)task.reject(new Error(m.error.message));else task.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setExtraHTTPHeaders',{headers:{'X-Forwarded-For':ip+':1'}});
 await viewport(1440);await go('/');
 for(const width of [1024,1280]){await viewport(width);assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);}
 await viewport(1440);pass('Desktop header fits 1024px and 1280px without overflow');
 await fill('header form[role="search"] input[name="q"]',term);
 await until(`document.querySelectorAll('header [role="option"]').length>=4`);pass('Desktop header search debounces and groups real event, organization, and speaker suggestions');
 await key('ArrowDown','ArrowDown',40);assert.ok(await evaluate(`document.querySelector('header [role="combobox"]').getAttribute('aria-activedescendant')`));
 await key('ArrowUp','ArrowUp',38);await key('Escape','Escape',27);assert.equal(await evaluate(`document.querySelector('header [role="combobox"]').getAttribute('aria-expanded')`),'false');pass('ArrowDown, ArrowUp, Escape and active-descendant semantics work');
 await key('Enter','Enter',13);await until(`location.pathname==='/search' && new URLSearchParams(location.search).get('q')===${JSON.stringify(term)} && !!document.querySelector('#events-results')`);
 assert.equal(await evaluate(`document.querySelector('#events-results').closest('section').querySelectorAll('article').length`),3);
 assert.ok(await evaluate(`Boolean(document.querySelector('#organizations-results')&&document.querySelector('#speakers-results'))`));
 assert.equal(await evaluate(`document.querySelector('meta[name="robots"]').content`),'noindex, follow');await screenshot('desktop-all');pass('Enter opens URL-driven grouped results, initial groups bounded, and search is noindex');
 await fill(input,term);await until(`document.querySelectorAll('main [role="option"]').length>=4`);await click(`document.querySelector('main h1')`);assert.equal(await evaluate(`document.querySelector('main [role="combobox"]').getAttribute('aria-expanded')`),'false');pass('Click outside closes suggestions');
 await click(`document.querySelector('#events-results').closest('section').querySelector('header a')`);await until(`new URLSearchParams(location.search).get('type')==='events' && document.querySelectorAll('main article').length===12`);pass('View all opens full event results with pagination');
 await click(`document.querySelector('nav[aria-label="Search result pages"] a')`);await until(`new URLSearchParams(location.search).get('page')==='2' && document.querySelectorAll('main article').length===3`);pass('Next page keeps query/type URL state');
 await go('/search?q='+term+'&type=events');
 await evaluate(`document.querySelector('select[name="eventType"]').value='ONLINE'`);await click(`document.querySelector('form[aria-label="Event search filters"] button')`);await until(`new URLSearchParams(location.search).get('eventType')==='ONLINE' && document.querySelectorAll('main article').length===1`);
 await screenshot('desktop-filtered');pass('Compact event filters submit shareable URL state');
 await send('Page.reload');await until(`document.readyState==='complete'&&document.querySelectorAll('main article').length===1&&document.querySelector('select[name="eventType"]').value==='ONLINE'`);pass('Refresh preserves query and filters');
 await evaluate('history.back()');await until(`!new URLSearchParams(location.search).get('eventType')&&document.querySelectorAll('main article').length===12`);
 await evaluate('history.forward()');await until(`new URLSearchParams(location.search).get('eventType')==='ONLINE'&&document.querySelectorAll('main article').length===1`);pass('Back/forward restores query, filters, and results');
 const path='/events/'+slugs[0];
 for(const target of ['h3','p','[aria-hidden="true"]']){await go('/search?q='+term+'&type=events&eventType=ONLINE');await click(`document.querySelector('main article').querySelector(${JSON.stringify(target)})`);await until(`location.pathname===${JSON.stringify(path)}&&!!document.querySelector('[data-event-detail]')`);}pass('Desktop event card title, body, and artwork navigate to detail');
 await go('/search?q='+term);await click(`document.querySelector('#organizations-results').closest('section').querySelector('a')`);await until(`location.pathname===${JSON.stringify('/companies/'+org.slug)}&&!!document.querySelector('main h1')`);pass('Organization result opens public company profile');
 await go('/search?q='+term);await click(`document.querySelector('#speakers-results').closest('section').querySelector('a')`);await until(`location.pathname===${JSON.stringify(path)}&&location.hash==='#speakers'&&!!document.querySelector('#speakers')`);pass('Speaker result opens relevant public speaker section');
 // Anonymous suggestion selection by Enter goes directly to the selected entity.
 await go('/search');await fill(input,term);await until(`document.querySelectorAll('main [role="option"]').length>=4`);await key('ArrowDown','ArrowDown',40);await key('Enter','Enter',13);await until(`location.pathname===${JSON.stringify(path)}`);pass('Keyboard Enter activates selected suggestion without a focus trap');
 const signed=await fetch(origin+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Forwarded-For':ip+':2'},body:JSON.stringify({email,password})});assert.equal(signed.status,200);
 for(const cookie of signed.headers.getSetCookie()){const pair=cookie.split(';')[0],at=pair.indexOf('=');await send('Network.setCookie',{name:pair.slice(0,at),value:pair.slice(at+1),url:origin});}
 await go('/search?q='+term+'&type=events&eventType=ONLINE');await until(`!!document.querySelector('header summary')`);
 await click(`document.querySelector('main article button[aria-pressed]')`);await until(`document.querySelector('main article button[aria-pressed]').getAttribute('aria-pressed')==='true'`);assert.equal(await evaluate('location.pathname'),'/search');pass('Save/bookmark remains separate and does not navigate');
 await click(`document.querySelector('main article h3')`);await until(`location.pathname===${JSON.stringify(path)}&&!!document.querySelector('[data-event-detail]')`);await click(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Join Event')`);await until(`document.body.textContent.includes('Cancel registration')`);assert.equal(await db.eventRegistration.count({where:{userId,event:{slug:slugs[0]},status:'REGISTERED'}}),1);pass('Join from searched event persists normal registration');
 await click(`document.querySelector('header summary')`);assert.ok(await evaluate(`document.querySelector('header details').open`));pass('Account menu still opens');
 for(const width of [390,320]){
  await viewport(width);await go('/search?q='+term);
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
  await fill(input,term);await until(`document.querySelectorAll('main [role="option"]').length>=4`);
  const bounds=await evaluate(`(()=>{const r=document.querySelector('main [role="listbox"]').parentElement.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:innerHeight}})()`);assert.ok(bounds.left>=0&&bounds.right<=width&&bounds.top>=0&&bounds.bottom<=bounds.height);
  await screenshot('mobile-'+width+'-suggestions');await key('Escape','Escape',27);
  await click(`document.querySelector('main article h3')`);await until(`location.pathname===${JSON.stringify(path)}`);
  await go('/search?q='+term+'&type=events');assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);await screenshot('mobile-'+width+'-filters');
  const labels=await evaluate(`Array.from(document.querySelectorAll('form[aria-label="Event search filters"] label')).map(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}))`);assert.ok(labels.every(r=>r.left>=0&&r.right<=width));
  await click(`document.querySelector('button[aria-label="Open navigation"]')`);await until(`!!document.querySelector('dialog[open]')`);await fill('dialog input[name="q"]',term);await until(`document.querySelectorAll('dialog [role="option"]').length>=4`);await screenshot('mobile-'+width+'-navigation');
  const mobileBounds=await evaluate(`(()=>{const r=document.querySelector('dialog [role="listbox"]').parentElement.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:innerHeight}})()`);assert.ok(mobileBounds.left>=0&&mobileBounds.right<=width&&mobileBounds.top>=0&&mobileBounds.bottom<=mobileBounds.height);
  await key('Escape','Escape',27);assert.ok(await evaluate(`!!document.querySelector('dialog[open]')`));assert.equal(await evaluate(`document.querySelector('dialog [role="combobox"]').getAttribute('aria-expanded')`),'false');
  await key('Tab','Tab',9);assert.ok(await evaluate(`document.querySelector('dialog').contains(document.activeElement)`));
  await fill('dialog input[name="q"]',term);await key('Enter','Enter',13);await until(`location.pathname==='/search'&&!document.querySelector('dialog[open]')&&!!document.querySelector('#events-results')`);
  report.viewports.push({width,horizontalOverflow:false,suggestionsWithinViewport:true,filtersWrapped:true,cardsClickable:true,mobileSearch:true});pass(width+'px: search/suggestions, clickable cards, wrapping filters, mobile nav and focus work without overflow');
 }
 await viewport(1440);await go('/explore?q='+term+'&eventType=ONLINE');assert.equal(await evaluate(`document.querySelectorAll('main article').length`),1);assert.equal(await evaluate(`document.querySelector('select[name="eventType"]').value`),'ONLINE');assert.equal(await evaluate(`document.querySelector('meta[name="robots"]').content`),'noindex, follow');pass('Explore shares database search and URL filters; filtered URLs are noindex');
 await go('/search?q=no-matches-'+run);assert.ok(await evaluate(`document.querySelector('main').textContent.includes('No matches')`));await go('/search');assert.ok(await evaluate(`document.querySelector('main').textContent.includes('Enter at least two characters')`));pass('No-match and empty-query states show genuine discovery paths');
 assert.equal(await evaluate(`document.querySelectorAll('a a,a button,button a').length`),0);
 assert.equal(report.consoleErrors.length,0);pass('No browser runtime exceptions or nested interactive elements');
}finally{
 if(socket)socket.close();if(chrome){chrome.kill();await sleep(1000);}if(server){server.kill();await sleep(500);}
 await db.event.deleteMany({where:{slug:{in:slugs}}});if(org)await db.organization.delete({where:{id:org.id}});if(user)await db.user.delete({where:{id:user.id}});await db.rateLimit.deleteMany({where:{key:{startsWith:ip}}});
 assert.equal(await db.event.count({where:{slug:{in:slugs}}}),0);report.cleanupVerified=true;if(baseline){assert.deepEqual(await fingerprint(),baseline);report.existingRecordsUnchanged=true;}
 writeFileSync(root+'/browser.json',JSON.stringify(report,null,2));writeFileSync(root+'/server.log',logs);
 try{const actual=realpathSync(profile);assert.ok(actual.startsWith(resolve(root)+sep));rmSync(actual,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch(error){if(error.code!=='ENOENT')throw error;}
 await db.$disconnect();console.log('CLEANUP verified; existing records unchanged. Browser report '+root+'/browser.json');
}
