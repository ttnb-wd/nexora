import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const fixture = JSON.parse(readFileSync('artifacts/step17-browser-fixture.json', 'utf8'));
const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve,reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0; const pending = new Map();
socket.onmessage = e => { const message = JSON.parse(e.data); if (message.id) { const task = pending.get(message.id); pending.delete(message.id); if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result); } };
function send(method,params={}) { return new Promise((resolve,reject) => { const key=++id; pending.set(key,{resolve,reject}); socket.send(JSON.stringify({id:key,method,params})); }); }
async function evaluate(expression) { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
async function until(expression) { const deadline=Date.now()+20000; while(Date.now()<deadline) { try { if(await evaluate(expression)) return; } catch {} await new Promise(r=>setTimeout(r,100)); } throw new Error(`Timed out: ${expression}`); }
async function go(path) { await send('Page.navigate',{url:fixture.origin+path}); await until(`location.pathname === ${JSON.stringify(path.split('?')[0].split('#')[0])} && document.readyState === 'complete' && !!document.querySelector('main')`); await new Promise(r=>setTimeout(r,700)); }
async function click(expression,touch=false) { const p=await evaluate(`(()=>{ const el=${expression}; if(!el) throw Error('Missing target'); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`); if(touch) { await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]}); await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); } else { await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p}); await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p}); } }
async function login(actor) { await send('Network.clearBrowserCookies'); const response = await fetch(fixture.origin+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:fixture.origin,'Content-Type':'application/json','X-Forwarded-For':'fd19:8888:1::1'},body:JSON.stringify(actor)}); assert.equal(response.status,200); for(const value of response.headers.getSetCookie()) { const pair=value.split(';')[0]; const at=pair.indexOf('='); await send('Network.setCookie',{name:pair.slice(0,at),value:pair.slice(at+1),url:fixture.origin}); } }
const report={checks:[],viewportResults:[]}; const pass=label=>{report.checks.push(label); console.log('PASS '+label);};
const path='/events/'+fixture.slug;
const eventAnchor=`[...document.querySelectorAll('article a')].find(a=>a.getAttribute('href')===${JSON.stringify(path)})`;
const card=`(${eventAnchor}).closest('article')`;
await send('Page.enable'); await send('Network.enable');
try {
 await login(fixture.attendee);
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 for (const [name,target] of [['body',`${card}.querySelector('p')`],['title',`${card}.querySelector('h3')`],['image',`${card}.querySelector('[aria-hidden="true"]')`]]) {
  await go('/explore'); await until(`Boolean(${eventAnchor})`); await click(target); await until(`location.pathname===${JSON.stringify(path)} && !!document.querySelector('h1')`); pass('Desktop card '+name+' click opens event detail');
 }
 assert.equal(await evaluate(`document.querySelector('nav[aria-label="Main navigation"] a[aria-current]').getAttribute('href')`),'/explore'); pass('Event detail keeps Explore navigation active');
 await click(`document.querySelector('header a[href="/explore"]')`); await until(`location.pathname==='/explore'`); pass('Back to Explore works');
 await go('/explore'); await until(`Boolean(${eventAnchor})`);
 await click(`${card}.querySelector('button[aria-pressed]')`); await until(`${card}.querySelector('button[aria-pressed]').getAttribute('aria-pressed')==='true'`); assert.equal(await evaluate('location.pathname'),'/explore'); pass('Save changes saved state without navigating');
 await click(`${card}.querySelector('summary')`); assert.equal(await evaluate(`${card}.querySelector('details').open`),true); assert.equal(await evaluate('location.pathname'),'/explore'); pass('Quick Preview stays independent');
 assert.equal(await evaluate(`document.querySelectorAll('a a, a button, button a').length`),0); pass('Explore has no nested link/button violations');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9}); await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 await evaluate(`(${eventAnchor}).focus()`); assert.equal(await evaluate(`getComputedStyle(${eventAnchor},'::after').outlineStyle`),'solid');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13}); await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13}); await until(`location.pathname===${JSON.stringify(path)}`); pass('Card Enter navigation and visible focus outline');
 const ticketPath='/dashboard/joined/'+fixture.slug+'/ticket';
 assert.ok(await evaluate(`!!document.querySelector('header a[href="${ticketPath}"]') && !!document.querySelector('header button[aria-label^="Cancel registration"]')`)); pass('View ticket sits beside Joined, Saved and Cancel registration');
 await click(`document.querySelector('header a[href="${ticketPath}"]')`); await until(`location.pathname===${JSON.stringify(ticketPath)}`);
 await click(`document.querySelector('main form button')`); await until(`!!document.querySelector('main img')`); pass('Ticket issues and displays QR');
 const token=await evaluate(`document.querySelector('main code').textContent`);
 await click(`document.querySelector('main nav a[href="${path}"]')`); await until(`location.pathname===${JSON.stringify(path)}`); pass('Ticket Back to event works');
 for(const width of [390,320]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true}); await send('Emulation.setTouchEmulationEnabled',{enabled:true});
  await go('/explore'); await until(`Boolean(${eventAnchor})`); await click(`${card}.querySelector('h3')`,true); await until(`location.pathname===${JSON.stringify(path)}`);
  const layout=await evaluate(`(()=>{const main=document.querySelector('main');const bar=main.lastElementChild;const actions=[...bar.querySelectorAll('button,a')].map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent,x:r.x,right:r.right,y:r.y,bottom:r.bottom};});return {width:innerWidth,scroll:document.documentElement.scrollWidth,actions};})()`);
  assert.ok(layout.scroll<=width,JSON.stringify(layout)); assert.ok(layout.actions.every(a=>a.x>=0&&a.right<=width&&a.bottom<=844)); assert.ok(layout.actions.some(a=>a.text==='View ticket')); assert.ok(layout.actions.some(a=>a.text==='Cancel registration'));
  report.viewportResults.push(layout); pass(`Mobile ${width}px card tap, visible wrapped actions and no horizontal overflow`);
  const shot=await send('Page.captureScreenshot',{format:'png'}); writeFileSync(`artifacts/ux-hotfix/mobile-${width}.png`,Buffer.from(shot.data,'base64'));
 }
 await send('Network.clearBrowserCookies');
 await go(`/check-in/ticket?event=${fixture.slug}#${token}`);
 assert.ok(await evaluate(`document.querySelector('h1').textContent.includes('Step17 browser')`));
 assert.ok(await evaluate(`document.querySelector('main').textContent.includes('awaiting organizer verification')`));
 assert.ok(await evaluate(`!document.querySelector('main').textContent.includes('Step17 attendee') && !document.querySelector('main a[href$="/check-in"]')`)); pass('Anonymous QR landing names public event, reports pending verification and reveals no attendee or organizer access');
 await login(fixture.owner); await go(`/check-in/ticket?event=${fixture.slug}#${token}`); assert.ok(await evaluate(`!!document.querySelector('main a[href$="/check-in"]')`)); pass('Authorized event owner gets organizer check-in link');
 report.ok=true;
} catch(error) { report.ok=false; report.failure=error.message; throw error; }
finally { writeFileSync('artifacts/ux-hotfix/browser-results.json',JSON.stringify(report,null,2)); socket.close(); writeFileSync('artifacts/step17-browser-release','done'); }
