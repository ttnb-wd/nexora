import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const { eventMetrics, statusCounts, analyticsRange, rangeStart } = await import('../src/features/analytics/metrics.ts');
const { loadEventAnalytics, loadOrganizationAnalytics } = await import('../src/features/analytics/server/service.ts');
const now = new Date('2026-10-03T06:00:00Z');
const groups = [{status:'REGISTERED',_count:{_all:3}},{status:'ATTENDED',_count:{_all:1}},{status:'CANCELLED',_count:{_all:5}}];
test('attendance and utilization exclude cancelled, waitlisted and no-show records; empty/unlimited states are explicit', () => {
 const counts = statusCounts([...groups,{status:'WAITLISTED',_count:{_all:2}},{status:'NO_SHOW',_count:{_all:2}}]);
 const metrics = eventMetrics(counts,5);
 assert.equal(metrics.totalRegistrations,13); assert.equal(metrics.occupied,4); assert.equal(metrics.attendanceRate,25); assert.equal(metrics.utilization,80); assert.equal(metrics.remaining,1);
 assert.equal(eventMetrics(counts,2).remaining,0); assert.equal(eventMetrics(counts,2).utilization,200);
 assert.equal(eventMetrics(counts,null).utilization,null); assert.equal(eventMetrics(counts,null).remaining,null);
 assert.equal(eventMetrics(statusCounts([]),5).attendanceRate,null); assert.equal(eventMetrics(statusCounts([]),5).utilization,0);
 assert.equal(eventMetrics(counts,0).utilization,null);
});
test('date presets are allowlisted and use explicit rolling boundaries', () => {
 for(const value of [undefined,'invalid',['30'],{},'all']) assert.equal(analyticsRange(value),'all');
 assert.equal(rangeStart('30',now).toISOString(),'2026-09-03T06:00:00.000Z'); assert.equal(rangeStart('all',now),null);
});
function mock(authorized=true) {
 const calls=[];
 const event={id:'event',title:'Event',slug:'event-slug',status:'PUBLISHED',capacity:5,timezone:'Asia/Yangon',startAt:now,endAt:new Date('2027-01-01'),organization:{slug:'organization',name:'Organization'}};
 const tx={
  event:{findFirst:async args=>{calls.push({authorization:args});return authorized?event:null;}, count:async args=>{calls.push({eventCount:args});return 1;},findMany:async args=>{calls.push({recent:args});return [event];}},
  organizationMember:{findFirst:async args=>{calls.push({membership:args});return authorized?{organization:{id:'org',slug:'organization',name:'Organization'}}:null;}},
  eventRegistration:{groupBy:async args=>{calls.push({group:args});return args.by.includes('eventId')?groups.map(g=>({...g,eventId:'event'})):groups;},count:async args=>{calls.push({registrationCount:args});return 1;}},
  eventBookmark:{count:async args=>{calls.push({saves:args});return 2;}},eventReminderPreference:{count:async args=>{calls.push({reminders:args});return 1;}},organizationFollower:{count:async args=>{calls.push({followers:args});return 4;}},
  $queryRaw:async query=>{calls.push({sql:query.sql,values:query.values});return query.sql.includes('AVG(rate)')?[{rate:25}]:[{date:'2026-10-01',registrations:2n,cumulative:8n}];},
 };
 return {calls,db:{$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'RepeatableRead');return fn(tx);}}};
}
test('event aggregation authorizes scope/actor before counts and binds trend parameters; returns aggregates only', async()=>{
 const {db,calls}=mock(); const data=await loadEventAnalytics(db,'actor','event','organization','30',now);
 assert.equal(data.attendanceRate,25); assert.equal(data.saves,2); assert.equal(data.reminders,1); assert.equal(data.tickets,1);assert.equal(data.checkIns,1);
 assert.deepEqual(data.trend.points,[{date:'2026-10-01',registrations:2,cumulative:8}]);
 const auth=calls[0].authorization;assert.equal(auth.where.organization.slug,'organization');assert.deepEqual(auth.where.AND[0].OR[1].organization.members.some.role.in,['OWNER','ADMIN','EDITOR']);
 const sql=calls.find(call=>call.sql);assert.ok(!sql.sql.includes('event-slug'));assert.ok(sql.values.includes('event'));assert.ok(sql.values.includes('Asia/Yangon'));assert.ok(sql.values.includes('day'));
 assert.ok(calls.find(call=>call.reminders).reminders.where.user.registrations.some.status==='REGISTERED');
 for(const value of ['email','ticketNonce','ticketTokenHash','checkedInById','userId']) assert.ok(!JSON.stringify(data).includes(value));
});
test('inaccessible event or organization stops before aggregate queries and malformed targets do not hit the database', async()=>{
 for(const kind of ['event','organization']) {
  const {db,calls}=mock(false);
  assert.equal(await (kind==='event'?loadEventAnalytics(db,'actor','event','organization'):loadOrganizationAnalytics(db,'actor','organization')),null);
  assert.equal(calls.length,1);
 }
 const {db,calls}=mock();assert.equal(await loadEventAnalytics(db,'','event',null),null);assert.equal(await loadOrganizationAnalytics(db,'actor','../organization'),null);assert.equal(calls.length,0);
});
test('organization authorization, aggregate and bounded recent-event queries stay in the same organization', async()=>{
 const {db,calls}=mock();const data=await loadOrganizationAnalytics(db,'actor','organization','30',now);
 assert.equal(data.averageAttendanceRate,25);assert.equal(data.followers,4);assert.equal(data.totalRegistrations,9);
 assert.deepEqual(calls[0].membership.where.role.in,['OWNER','ADMIN','EDITOR']);
 const scope=calls.find(call=>call.group).group.where.event;
 assert.equal(scope.organizationId,'org');assert.deepEqual(scope.status.in,['PUBLISHED','COMPLETED']);assert.equal(scope.startAt.lte,now);
 assert.equal(calls.find(call=>call.recent).recent.take,10);
 const sql=calls.find(call=>call.sql);assert.ok(sql.values.includes('org'));assert.ok(sql.sql.includes('NULLIF'));
 assert.ok(!JSON.stringify(data).includes('userId'));assert.equal(data.recent[0].utilization,80);
});
test('private analytics pages use authenticated query wrappers and dynamic rendering without tracking or public imports',()=>{
 const queries=readFileSync('src/features/analytics/server/queries.ts','utf8');assert.ok(queries.includes('requireUser()'));assert.ok(queries.includes('notFound()'));
 for(const path of ['src/app/(protected)/organizer/[organizationSlug]/analytics/page.tsx','src/app/(protected)/organizer/[organizationSlug]/events/[eventId]/analytics/page.tsx','src/app/(protected)/dashboard/events/[eventId]/analytics/page.tsx']) {
  const source=readFileSync(path,'utf8');assert.ok(source.includes('force-dynamic'));assert.ok(source.includes('index: false'));
 }
});
