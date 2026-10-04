import './support/typescript-loader.mjs';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='server-only')return {url:'data:text/javascript,export%20default%20{}',shortCircuit:true};
 const stubs={
  '@/lib/db':'export const getDb=()=>globalThis.socialDb',
  '@/features/auth/server/session':'export const getCurrentUser=async()=>globalThis.socialUser; export const getAuthorizedUser=getCurrentUser; export const requireUser=async()=>{if(!globalThis.socialUser)throw Error("Sign in");return globalThis.socialUser}',
  '@/features/events/server/authorization':'export const requireEventAccess=async()=>{throw Error("Denied")}',
 };
 if(stubs[specifier])return {url:`data:text/javascript,${encodeURIComponent(stubs[specifier])}`,shortCircuit:true};
 if(specifier.startsWith('@/')){const file=new URL(`../src/${specifier.slice(2)}.ts`,import.meta.url);if(existsSync(file))return nextResolve(file.href,context);}
 return nextResolve(specifier,context);
}});
const follows=await import('../src/features/follows/server/service.ts');
const queries=await import('../src/features/notifications/server/queries.ts');
const {markRead}=await import('../src/features/notifications/server/service.ts');
const creation=await import('../src/features/notifications/server/creation.ts');
const {safeReturnPath}=await import('../src/features/auth/return-path.ts');
const participation=await import('../src/features/participation/server/service.ts');
function setup(){
 globalThis.socialUser={id:'alice'};
 const followRows=new Map(),notifications=new Map(),calls=[];
 const org={id:'org-private',slug:'real-org',name:'Real Organization',description:'Real copy',shortName:null,industry:'Community',city:'Yangon',region:null,website:null,visualTheme:null,logoVariant:null};
 const rowKey=row=>`${row.userId}:${row.organizationId}`;
 const tx={organization:{findUnique:async()=>org},organizationFollower:{
  createMany:async({data,skipDuplicates})=>{assert.equal(skipDuplicates,true);for(const row of data)followRows.set(rowKey(row),row);return {count:1}},
  deleteMany:async({where})=>({count:Number(followRows.delete(rowKey(where)))}),
  findFirst:async(args)=>{calls.push(args);return [...followRows.values()].find(row=>row.userId===args.where.userId)??null},
  findMany:async(args)=>{calls.push(args);return [...followRows.values()].filter(row=>row.userId===args.where.userId).map(()=>({organization:org}))},
 },notification:{
  create:async({data})=>{assert.ok(!notifications.has(data.dedupeKey));notifications.set(data.dedupeKey,{id:`notice-${notifications.size}`,readAt:null,createdAt:new Date(),...data});return data},
  createMany:async({data,skipDuplicates})=>{assert.equal(skipDuplicates,true);for(const row of data)if(!notifications.has(row.dedupeKey))notifications.set(row.dedupeKey,row)},
  updateMany:async({where,data})=>{calls.push({where,data});let count=0;for(const row of notifications.values())if(row.userId===where.userId&&row.readAt===null&&(!where.id||where.id===row.id)){Object.assign(row,data);count++}return {count}},
  findMany:async(args)=>{calls.push(args);return [...notifications.values()].filter(row=>row.userId===args.where.userId)},
  count:async(args)=>{calls.push(args);return [...notifications.values()].filter(row=>row.userId===args.where.userId&&row.readAt===null).length},
 }};
 globalThis.socialDb=tx;return {tx,org,followRows,notifications,calls};
}
test('follow derives session identity, validates slug and redirects anonymously to the organization',async()=>{
 setup();globalThis.socialUser=null;
 assert.equal((await follows.mutateFollow('real-org',true)).signIn,'/sign-in?returnTo=%2Fcompanies%2Freal-org');
 for(const input of [{slug:'real-org',userId:'bob'},'../private','x',"org' SQL"]){assert.equal((await follows.mutateFollow(input,true)).ok,false);}
 assert.equal(safeReturnPath('/companies/real-org'),'/companies/real-org');
 for(const path of ['//evil.test','https://evil.test','/companies/%2f%2fevil','/companies/real-org?x=bad'])assert.equal(safeReturnPath(path),'/dashboard');
});
test('follow and unfollow are repeatable and other-user actions cannot touch a follow',async()=>{
 const state=setup();await follows.mutateFollow('real-org',true);await follows.mutateFollow('real-org',true);assert.equal(state.followRows.size,1);
 globalThis.socialUser={id:'bob'};await follows.mutateFollow('real-org',false);assert.equal(state.followRows.size,1);
 globalThis.socialUser={id:'alice'};assert.equal(await follows.isOrganizationFollowedByUser('real-org'),true);
 const viewer=await follows.getFollowViewer();assert.deepEqual(viewer.followedSlugs,['real-org']);assert.ok(!JSON.stringify(viewer).includes('alice'));
 await follows.mutateFollow('real-org',false);await follows.mutateFollow('real-org',false);assert.equal(state.followRows.size,0);
});
test('following dashboard uses an own-user public organization projection',async()=>{
 const state=setup();await follows.mutateFollow('real-org',true);const rows=await follows.getFollowedOrganizations();
 assert.equal(rows[0].name,state.org.name);assert.ok(!JSON.stringify(rows).includes('org-private'));
 const query=state.calls.at(-1);assert.equal(query.where.userId,'alice');assert.ok(!query.select.id&&!query.select.userId&&!query.select.organization.select.members&&!query.select.organization.select.followers);
});
test('follow database failures return a friendly message without raw database errors',async()=>{
 setup();globalThis.socialDb.organization.findUnique=async()=>{throw Error('Prisma SQL password')};const result=await follows.mutateFollow('real-org',true);assert.equal(result.ok,false);assert.ok(!JSON.stringify(result).includes('SQL'));
});
test('publish fanout targets actual followers only, with stable per-recipient database keys',async()=>{
 const state=setup();state.tx.event={findUniqueOrThrow:async()=>({id:'event',title:'Real gathering',slug:'real-event',organization:{name:'Real org',followers:[{userId:'alice'},{userId:'bob'}]}})};
 await creation.notifyEventPublished(state.tx,'event');await creation.notifyEventPublished(state.tx,'event');assert.equal(state.notifications.size,2);
 assert.deepEqual([...state.notifications.values()].map(row=>row.userId),['alice','bob']);assert.ok([...state.notifications.values()].every(row=>row.type==='EVENT_PUBLISHED'&&row.href==='/events/real-event'));
 state.tx.event.findUniqueOrThrow=async()=>({organization:null});await creation.notifyEventPublished(state.tx,'individual');assert.equal(state.notifications.size,2);
});
test('event cancellation queries registered users and creates stable event cancellation notices',async()=>{
 const state=setup();state.tx.event={findUniqueOrThrow:async(args)=>{assert.deepEqual(args.select.registrations.where,{status:'REGISTERED'});return {id:'event',title:'Real event',registrations:[{userId:'alice'}]}}};
 await creation.notifyEventCancelled(state.tx,'event');await creation.notifyEventCancelled(state.tx,'event');assert.equal(state.notifications.size,1);assert.equal([...state.notifications.values()][0].href,'/dashboard/joined');
});
test('mark read cannot mutate another user and repeats preserve read timestamp',async()=>{
 const state=setup();await creation.notifyRegistration(state.tx,{id:'event',title:'Real',slug:'real-event'},'alice',true);const row=[...state.notifications.values()][0];
 globalThis.socialUser={id:'bob'};await markRead(row.id);assert.equal(row.readAt,null);await markRead(undefined,true);assert.equal(row.readAt,null);
 globalThis.socialUser={id:'alice'};await markRead(row.id);const date=row.readAt;await markRead(row.id);assert.equal(row.readAt,date);assert.equal(await queries.getUnreadNotificationCount(),0);
});
test('notification queries are own-user bounded projections and unsafe href is suppressed',async()=>{
 const state=setup();await creation.notifyRegistration(state.tx,{id:'event',title:'Real',slug:'real-event'},'alice',true);
 [...state.notifications.values()][0].href='https://evil.test';const rows=await queries.getUserNotifications();assert.equal(rows[0].href,null);assert.ok(!JSON.stringify(rows).includes('alice'));assert.ok(!JSON.stringify(rows).includes('dedupeKey'));
 const query=state.calls.at(-1);assert.equal(query.take,50);assert.equal(query.where.userId,'alice');assert.ok(!query.select.userId&&!query.select.dedupeKey);
 globalThis.socialUser=null;assert.equal(await queries.getUnreadNotificationCount(),0);await assert.rejects(queries.getUserNotifications());
});
test('mark validation/auth/failures expose only friendly results',async()=>{
 setup();assert.equal((await markRead({userId:'bob'})).ok,false);globalThis.socialUser=null;assert.equal((await markRead('notice')).message,'Please sign in to continue.');
 setup();globalThis.socialDb.notification.updateMany=async()=>{throw Error('Prisma SQL internal')};const result=await markRead('notice');assert.equal(result.ok,false);assert.ok(!result.message.includes('SQL'));
});
test('registration notification failure rolls back the mutation rather than reporting success',async()=>{
 const state=setup();let row=null;let lock=false;let notificationAttempted=false;
 const event={id:'event',title:'Real event',slug:'real-event',status:'PUBLISHED',startAt:new Date('2090-01-01'),endAt:new Date('2090-01-02'),capacity:null,registrationDeadline:null};
 Object.assign(state.tx,{$queryRaw:async()=>{lock=true},event:{findUnique:async()=>event},eventRegistration:{findUnique:async()=>row,count:async()=>0,upsert:async({create})=>{row=create;return row}}});
 state.tx.eventReminderPreference={updateMany:async()=>({count:0})};
 state.tx.notification.create=async()=>{assert.ok(lock);notificationAttempted=true;throw Error('SQL notification unavailable')};
 state.tx.$transaction=async(callback)=>{const before=row;try{return await callback(state.tx)}catch(error){row=before;throw error}};
 const result=await participation.mutateParticipation('real-event','join');assert.equal(result.ok,false);assert.equal(row,null);assert.equal(notificationAttempted,true);assert.ok(!result.message.includes('SQL'));
});
