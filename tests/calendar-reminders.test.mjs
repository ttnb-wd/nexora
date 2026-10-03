import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
const calendar = await import('../src/features/events/calendar/calendar.ts');
const { mutateReminder, readViewerReminder } = await import('../src/features/events/reminders/service.ts');
const event = { id:'private-internal-id', slug:'calendar-event', title:'Meet, learn; together\\again\nBEGIN:VEVENT', description:'A description\r\nATTENDEE:private@example.com', shortDescription:null, locationName:'Hall, A', city:'Yangon', region:null, eventType:'HYBRID', startAt:new Date('2090-06-20T03:30:00Z'), endAt:new Date('2090-06-20T05:30:00Z'), timezone:'Asia/Yangon' };
test('ICS UTC instants, stable opaque UID, mandatory fields, CRLF and escaped text prevent injection',()=>{
 const a=calendar.buildIcsEvent(event,'https://nexora.example',new Date('2026-10-03T00:00:00Z'));
 const lines=a.replace(/\r\n /g,'').split('\r\n');
 assert.ok(lines.includes('DTSTART:20900620T033000Z')&&lines.includes('DTEND:20900620T053000Z'));
 assert.ok(lines.includes('DTSTAMP:20261003T000000Z'));
 assert.ok(lines.includes('SUMMARY:Meet\\, learn\\; together\\\\again\\nBEGIN:VEVENT'));
 assert.equal(lines.filter(line=>line==='BEGIN:VEVENT').length,1);
 assert.ok(!lines.some(line=>line.startsWith('ATTENDEE:')));
 assert.ok(a.endsWith('END:VCALENDAR\r\n')&&!a.includes(event.id));
 const uid=lines.find(line=>line.startsWith('UID:'));
 assert.equal(calendar.buildIcsEvent({...event,title:'Edited',slug:'edited-event'},'https://nexora.example').replace(/\r\n /g,'').split('\r\n').find(line=>line.startsWith('UID:')),uid);
 assert.ok(lines.includes('URL:https://nexora.example/events/calendar-event'));
 assert.ok(lines.some(line=>line.startsWith('LOCATION:Hall\\, A\\, Yangon')));
 assert.throws(()=>calendar.buildIcsEvent({...event,endAt:event.startAt},'https://nexora.example'));
});
test('UTF-8 folding respects 75 octets and preserves non-ASCII code points',()=>{
 const text='SUMMARY:'+('မြန်မာ🙂'.repeat(40));const folded=calendar.foldIcsLine(text);
 assert.ok(folded.includes('\r\n '));for(const line of folded.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 assert.equal(folded.replace(/\r\n /g,''),text);assert.ok(!folded.includes('\ufffd'));
});
test('Google Calendar safely encodes public fields, UTC dates and named timezone',()=>{
 const url=new URL(calendar.buildGoogleCalendarUrl(event,'https://nexora.example'));
 assert.equal(url.origin,'https://calendar.google.com');assert.equal(url.searchParams.get('text'),event.title);
 assert.equal(url.searchParams.get('dates'),'20900620T033000Z/20900620T053000Z');assert.equal(url.searchParams.get('ctz'),'Asia/Yangon');
 assert.ok(url.searchParams.get('details').includes('https://nexora.example/events/calendar-event'));
 assert.equal(calendar.buildCalendarLocation({...event,eventType:'ONLINE',onlineUrl:'https://private.example/secret'}),'Online event');
});
test('UTC exports preserve DST crossings without constructing local display timestamps',()=>{
 const dst={...event,timezone:'America/New_York',startAt:new Date('2027-03-14T06:30:00Z'),endAt:new Date('2027-03-14T07:30:00Z')};
 const ics=calendar.buildIcsEvent(dst,'https://nexora.example');assert.ok(ics.includes('DTSTART:20270314T063000Z')&&ics.includes('DTEND:20270314T073000Z'));
 assert.equal(new URL(calendar.buildGoogleCalendarUrl(dst,'https://nexora.example')).searchParams.get('ctz'),'America/New_York');
});
function setup(){
 const record={id:'event-id',status:'PUBLISHED',startAt:new Date('2090-01-01')},registrations=new Map([['alice','REGISTERED']]),preferences=new Map(),calls=[];
 let tail=Promise.resolve();
 const tx={$queryRaw:async(strings,...values)=>calls.push({sql:strings.join('?'),values}),event:{findUnique:async({select})=>{
  if(!record)return null;
  const userId=select.registrations?.where.userId;
  return {...record,...(userId?{registrations:registrations.has(userId)?[{status:registrations.get(userId)}]:[],reminderPreferences:preferences.has(userId)?[preferences.get(userId)]:[]}: {})};
 }},eventRegistration:{findUnique:async({where})=>{calls.push(where);const status=registrations.get(where.userId_eventId.userId);return status?{status}:null;}},eventReminderPreference:{
  upsert:async({where,create,update})=>{calls.push(where);const key=where.userId_eventId.userId;preferences.set(key,preferences.has(key)?{...preferences.get(key),...update}:create);},
  updateMany:async({where,data})=>{calls.push(where);if(preferences.has(where.userId))Object.assign(preferences.get(where.userId),data);return {count:1};},
 }};
 return {record,registrations,preferences,calls,db:{...tx,$transaction:async(fn)=>{const previous=tail;let finish;tail=new Promise(resolve=>finish=resolve);await previous;try{return await fn(tx);}finally{finish();}}}};
}
test('reminder creation, update, persistence, disable and concurrent requests are idempotent and user-scoped',async()=>{
 const s=setup();assert.equal((await mutateReminder(s.db,'alice','calendar-event',15)).ok,true);
 assert.deepEqual(await readViewerReminder(s.db,'alice','calendar-event'),{eligible:true,enabled:true,reminderMinutes:15});
 assert.ok((await mutateReminder(s.db,'alice','calendar-event',60)).ok);
 assert.equal(s.preferences.get('alice').reminderMinutes,60);
 assert.ok((await Promise.all([1,2].map(()=>mutateReminder(s.db,'alice','calendar-event',30)))).every(r=>r.ok));assert.equal(s.preferences.size,1);
 assert.ok((await mutateReminder(s.db,'alice','calendar-event',null,true)).ok);assert.ok((await mutateReminder(s.db,'alice','calendar-event',null,true)).ok);
 assert.deepEqual(await readViewerReminder(s.db,'alice','calendar-event'),{eligible:true,enabled:false,reminderMinutes:null});
 assert.ok(s.calls.filter(call=>call.sql).every(call=>call.sql.includes('FOR UPDATE')));
});
test('allowlist, unauthenticated, forged identity, non-registration, lifecycle and past events are blocked',async()=>{
 const s=setup();for(const minutes of [0,-15,16,1e9,'15',null,{userId:'alice'}])assert.equal((await mutateReminder(s.db,'alice','calendar-event',minutes)).ok,false);
 assert.equal((await mutateReminder(s.db,null,'calendar-event',15)).ok,false);
 assert.equal((await mutateReminder(s.db,'bob','calendar-event',15)).ok,false);
 assert.equal((await mutateReminder(s.db,'alice',{slug:'calendar-event',userId:'bob'},15)).ok,false);
 for(const status of ['ATTENDED','CANCELLED','WAITLISTED','NO_SHOW']){s.registrations.set('alice',status);assert.equal((await mutateReminder(s.db,'alice','calendar-event',15)).ok,false);}
 s.registrations.set('alice','REGISTERED');for(const status of ['DRAFT','CANCELLED','ARCHIVED','COMPLETED']){s.record.status=status;assert.equal((await mutateReminder(s.db,'alice','calendar-event',15)).ok,false);}
 s.record.status='PUBLISHED';s.record.startAt=new Date('2020-01-01');assert.equal((await mutateReminder(s.db,'alice','calendar-event',15)).ok,false);assert.equal(s.preferences.size,0);
 assert.equal((await readViewerReminder(s.db,'bob','calendar-event')).enabled,false);
});
