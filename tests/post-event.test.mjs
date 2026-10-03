import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
const { feedbackSchema } = await import('../src/features/post-event/schemas.ts');
const { completeManagedEvent, saveFeedback, loadViewerFeedback } = await import('../src/features/post-event/service.ts');
const now = new Date('2026-10-03T08:00:00Z');
function fixture() {
 const event={id:'event',slug:'test-event',status:'PUBLISHED',endAt:new Date(now.getTime()-1000)};
 const registrations=new Map([['attended',{status:'ATTENDED',checkedInAt:now}],['registered',{status:'REGISTERED',checkedInAt:null}],['cancelled',{status:'CANCELLED',checkedInAt:null}],['legacy',{status:'REGISTERED',checkedInAt:now}]]),feedback=new Map(),locks=[];
 const tx={
  $queryRaw:async(strings,...values)=>{locks.push({sql:strings.join('?'),values});return strings.join('').includes('clock_timestamp')?[{now}]:[{id:'event'}];},
  event:{findFirst:async({where})=>where.AND[0].OR[0].creatorId==='owner'?event:null,findUnique:async()=>event,updateMany:async({data})=>{Object.assign(event,data);return{count:1};}},
  eventRegistration:{findUnique:async({where})=>registrations.get(where.userId_eventId.userId),updateMany:async({where,data})=>{let count=0;for(const row of registrations.values())if(row.status===where.status&&(where.checkedInAt===null?row.checkedInAt===null:row.checkedInAt!==null)){Object.assign(row,data);count++;}return{count};}},
  eventReminderPreference:{updateMany:async()=>({count:0})},
  eventFeedback:{upsert:async({where,create,update})=>{const key=where.eventId_userId.userId;feedback.set(key,feedback.has(key)?{...feedback.get(key),...update}:create);},findUnique:async({where})=>{const row=feedback.get(where.eventId_userId.userId);return row?{rating:row.rating,comment:row.comment}:null;}},
 };
 let tail=Promise.resolve();
 const db={$transaction:async(fn)=>{const previous=tail;let release;tail=new Promise(resolve=>{release=resolve;});await previous;try{return await fn(tx);}finally{release();}}};
 return{db,event,registrations,feedback,locks};
}
test('rating/comment validation enforces scale, bounds, whitespace and optional omission',()=>{
 for(const rating of [0,6,1.5,'5',NaN])assert.equal(feedbackSchema.safeParse({rating}).success,false);
 for(const rating of [1,2,3,4,5])assert.equal(feedbackSchema.safeParse({rating}).success,true);
 assert.equal(feedbackSchema.safeParse({rating:5,comment:'   '}).success,false);
 assert.equal(feedbackSchema.safeParse({rating:5,comment:'x'.repeat(1001)}).success,false);
 assert.equal(feedbackSchema.parse({rating:5,comment:' useful '}).comment,'useful');
 assert.equal(feedbackSchema.parse({rating:5,comment:''}).comment,'');
 assert.ok(!('userId' in feedbackSchema.parse({rating:5,userId:'forged'})));
});
test('completion finalizes unchecked registrations, preserves attended/cancelled and recorded legacy check-ins atomically',async()=>{
 const s=fixture();assert.equal((await completeManagedEvent(s.db,'owner','event',null,true)).ok,true);
 assert.equal(s.event.status,'COMPLETED');assert.equal(s.registrations.get('registered').status,'NO_SHOW');assert.equal(s.registrations.get('attended').status,'ATTENDED');assert.equal(s.registrations.get('cancelled').status,'CANCELLED');assert.equal(s.registrations.get('legacy').status,'ATTENDED');
 assert.ok(s.locks.some(x=>x.sql.includes('FOR UPDATE')));
 assert.ok((await completeManagedEvent(s.db,'owner','event',null,true)).message.includes('already'));
});
test('future, draft, cancelled, archived, missing confirmation and unauthorized completion are rejected',async()=>{
 for(const status of ['DRAFT','CANCELLED','ARCHIVED']){const s=fixture();s.event.status=status;assert.equal((await completeManagedEvent(s.db,'owner','event',null,true)).ok,false);}
 const s=fixture();s.event.endAt=new Date(now.getTime()+1);assert.equal((await completeManagedEvent(s.db,'owner','event',null,true)).ok,false);
 assert.equal((await completeManagedEvent(s.db,'owner','event',null,false)).ok,false);
 assert.equal((await completeManagedEvent(s.db,'other','event',null,true)).ok,false);
});
test('concurrent completion and feedback preserve final state and one response; edit changes the same response',async()=>{
 const s=fixture();assert.ok((await Promise.all([1,2].map(()=>completeManagedEvent(s.db,'owner','event',null,true)))).every(r=>r.ok));
 assert.ok((await Promise.all([3,5].map(rating=>saveFeedback(s.db,'attended','test-event',{rating,comment:' Feedback '})))).every(r=>r.ok));
 assert.equal(s.feedback.size,1);assert.equal(s.feedback.get('attended').comment,'Feedback');
 assert.ok((await saveFeedback(s.db,'attended','test-event',{rating:4,comment:''})).ok);assert.equal(s.feedback.get('attended').rating,4);assert.equal(s.feedback.get('attended').comment,null);
 assert.deepEqual(await loadViewerFeedback(s.db,'attended','test-event'),{eligible:true,noShow:false,feedback:{rating:4,comment:null}});
});
test('only the current attended viewer of a completed event can submit or read their response',async()=>{
 const s=fixture();assert.equal((await saveFeedback(s.db,'attended','test-event',{rating:5})).ok,false);
 s.event.status='COMPLETED';for(const actor of [null,'registered','cancelled','other'])assert.equal((await saveFeedback(s.db,actor,'test-event',{rating:5})).ok,false);
 s.registrations.get('registered').status='NO_SHOW';assert.equal((await loadViewerFeedback(s.db,'registered','test-event')).noShow,true);
 assert.deepEqual(await loadViewerFeedback(s.db,null,'test-event'),{eligible:false,noShow:false,feedback:null});
});
