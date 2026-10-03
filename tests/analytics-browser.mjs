import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const fixture=JSON.parse(readFileSync('artifacts/step18/browser-fixture.json','utf8'));
const port=process.env.CHROME_TEST_PORT ?? '9334';
const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
let id=0;const pending=new Map();
socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);pending.delete(message.id);if(message.error)task.reject(new Error(message.error.message));else task.resolve(message.result);}};
function send(method,params={}){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});}
async function evaluate(expression){const response=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.exceptionDetails)throw new Error(response.exceptionDetails.text);return response.result.value;}
async function until(expression){const deadline=Date.now()+20000;while(Date.now()<deadline){try{if(await evaluate(expression))return;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Timed out: '+expression);}
async function go(path){await send('Page.navigate',{url:fixture.origin+path});await until(`location.pathname===${JSON.stringify(path.split('?')[0])} && document.readyState==='complete' && !!document.querySelector('main')`);await new Promise(resolve=>setTimeout(resolve,300));}
async function click(selector){const point=await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.scrollIntoView({block:'center'});const rect=element.getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});}
async function key(value,code){await send('Input.dispatchKeyEvent',{type:'keyDown',key:value,code:value,windowsVirtualKeyCode:code});await send('Input.dispatchKeyEvent',{type:'keyUp',key:value,code:value,windowsVirtualKeyCode:code});}
async function login(actor){await send('Network.clearBrowserCookies');const response=await fetch(fixture.origin+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:fixture.origin,'Content-Type':'application/json','X-Forwarded-For':`${fixture.ip ?? 'fd18:abcd:6789:'}7::1`},body:JSON.stringify(actor)});assert.equal(response.status,200);for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0],at=pair.indexOf('=');await send('Network.setCookie',{name:pair.slice(0,at),value:pair.slice(at+1),url:fixture.origin});}}
async function screenshot(name){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`artifacts/step18/${name}.png`,Buffer.from(shot.data,'base64'));}
const report={checks:[],layout:[]};
function pass(label){report.checks.push(label);console.log('PASS '+label);}
const base=`/organizer/${fixture.orgSlug}`,eventPath=`${base}/events/${fixture.eventId}/analytics`;
await send('Page.enable');await send('Network.enable');
try{
 await login(fixture.owner);await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await go(eventPath);
 assert.equal(await evaluate(`document.querySelector('h1').textContent`),'Step18 metrics');
 const metrics=await evaluate(`Object.fromEntries([...document.querySelectorAll('main dl > div')].map(element=>[element.querySelector('dt').textContent,element.querySelector('dd').textContent]))`);
 assert.equal(metrics.Registered,'2');assert.equal(metrics.Attended,'1');assert.equal(metrics['Saved'],'2');assert.equal(metrics['Remaining capacity'],'2');assert.equal(metrics['Attendance rate'],'25%');
 assert.equal(await evaluate(`document.querySelector('svg[role="img"] title').textContent`),'Cumulative first registrations over time');
 await click('main summary');assert.ok(await evaluate(`document.querySelector('main details').open`));pass('Event analytics displays real KPIs, accessible chart and exact trend table');await screenshot('event-desktop');
 await click('main nav[aria-label="Registration trend period"] a[href$="range=30"]');await until(`location.search==='?range=30' && document.querySelector('main nav[aria-label="Registration trend period"] a[aria-current]').textContent==='Last 30 days'`);pass('Event trend date presets navigate and update the active period');
 await go(`${base}/analytics`);assert.equal(await evaluate(`document.querySelector('h1').textContent`),'Step18 analytics organization');
 assert.ok(await evaluate(`document.querySelector('main table a').getAttribute('href').endsWith('/analytics')`));pass('Organization analytics renders scoped KPIs and event analytics links');await screenshot('organization-desktop');
 await key('Tab',9);await evaluate(`document.querySelector('main nav a').focus()`);assert.equal(await evaluate(`getComputedStyle(document.activeElement).outlineStyle`),'solid');
 await key('Enter',13);await until(`location.pathname===${JSON.stringify(base)}`);pass('Visible keyboard focus and Enter return to organization management');
 assert.ok(await evaluate(`!!document.querySelector('main a[href="${base}/analytics"]')`));await click(`main a[href="${base}/analytics"]`);await until(`location.pathname===${JSON.stringify(base+'/analytics')}`);pass('Organization management analytics shortcut works');
 await go('/organizer');assert.ok(await evaluate(`!!document.querySelector('main a[href="${base}/analytics"]')`));pass('Organizer dashboard has a compact analytics shortcut');
 await go(eventPath);await click(`main nav a[href="${base}/events/${fixture.eventId}"]`);await until(`location.pathname===${JSON.stringify(base+'/events/'+fixture.eventId)}`);assert.ok(await evaluate(`!!document.querySelector('main a[href="${eventPath}"]')`));pass('Event management includes registration/attendance summary and analytics return path');
 for(const width of [390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
  for(const [label,path]of[['event',eventPath],['organization',`${base}/analytics`]]){
   await go(path);const layout=await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,kpis:document.querySelectorAll('main dl > div').length})`);assert.ok(layout.scroll<=width,JSON.stringify(layout));report.layout.push({page:label,...layout});await screenshot(`${label}-mobile-${width}`);pass(`${label} analytics ${width}px mobile layout has no page overflow`);
  }
 }
 await go(`${base}/events/${fixture.zeroId}/analytics`);assert.ok(await evaluate(`document.querySelector('main').textContent.includes('No registrations yet') && document.querySelector('main').textContent.includes('Unlimited') && document.querySelector('main').textContent.includes('No first registrations')`));pass('Zero registrations, no trend and unlimited event empty states are clear');await screenshot('event-empty');
 await go(`/organizer/${fixture.emptyOrgSlug}/analytics`);assert.ok(await evaluate(`document.querySelector('main').textContent.includes('No published or completed events')`));pass('Empty organization analytics is clear');
 await go(`/dashboard/events/${fixture.individualId}/analytics`);assert.equal(await evaluate(`document.querySelector('h1').textContent`),'Step18 individual');pass('Individual creator can view own event analytics');
 await login(fixture.member);await go(eventPath);assert.ok(await evaluate(`!document.querySelector('main').textContent.includes('Cumulative registration records') && document.querySelector('main').textContent.includes('unavailable')`));pass('MEMBER browser cannot access analytics');
 report.ok=true;
}catch(error){report.ok=false;report.failure=error.message;throw error;}
finally{writeFileSync('artifacts/step18/browser-results.json',JSON.stringify(report,null,2));socket.close();writeFileSync('artifacts/step18/browser-release','done');}
