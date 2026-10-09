import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import nextEnv from '@next/env';
assert.equal(process.env.STEP25_DISPOSABLE_APPROVED,'1','Step 25 disposable Neon approval required.');
nextEnv.loadEnvConfig(process.cwd(),true);
const {getDb}=await import('../src/lib/db.ts'),db=getDb();
const {parseSearchParams}=await import('../src/features/search/params.ts');
const queries=await import('../src/features/search/server/queries.ts');
const {Prisma}=await import('../src/generated/prisma/client.ts');
const {GET}=await import('../src/app/api/search/suggestions/route.ts');
const run=randomUUID(),prefix='s25-'+run,term='nxs25'+run.replaceAll('-',''),root='artifacts/step25/'+run;
mkdirSync(root,{recursive:true});
const report={run,passed:[],cleanupVerified:false,existingRecordsUnchanged:false,plans:[]};
const pass=label=>{report.passed.push(label);console.log('PASS '+label);};
const eventSlugs=[],orgSlugs=[],users=[],privateValues=[];let baseline;
const now=new Date(),future=new Date(now.getTime()+86400000*20),past=new Date(now.getTime()-86400000*20);
const params=raw=>parseSearchParams({q:term,...raw});
const eventSearch=(raw={})=>queries.searchEvents(params(raw),now);
async function fingerprint(){
 const result={};for(const{tablename}of await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`){
  const name='"'+tablename.replaceAll('"','""')+'"';
  const[row]=await db.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t."id")::text,'[]')) AS digest FROM ${name} t`);result[tablename]=row;
 }return result;
}
let user,org,unrelated;
async function makeEvent(label,extra={}){
 const slug=prefix+'-'+label;eventSlugs.push(slug);
 const event=await db.event.create({data:{slug,title:'Independent '+label,description:'Public fixture description',category:'Design',eventType:'IN_PERSON',status:'PUBLISHED',startAt:future,endAt:new Date(future.getTime()+3600000),timezone:'Asia/Yangon',city:'Yangon',locationName:'Discovery Hall',creatorId:user.id,...extra}});
 privateValues.push(event.id);return event;
}
try{
 baseline=await fingerprint();
 const [extension]=await db.$queryRaw`SELECT name,installed_version AS version FROM pg_available_extensions WHERE name='pg_trgm'`;assert.ok(extension?.version);report.extension=extension;pass('Neon pg_trgm installed and available');
 user=await db.user.create({data:{name:'Private account '+term,email:prefix+'@example.test',emailVerified:true,verificationRequired:false}});users.push(user.id);privateValues.push(user.id,user.email);
 orgSlugs.push(prefix+'-org',prefix+'-unrelated');
 org=await db.organization.create({data:{slug:orgSlugs[0],name:term+' Studio',shortName:'Short'+term,description:term+' research collective',industry:term+' creativity',city:'Yangon',region:'Myanmar'}});
 unrelated=await db.organization.create({data:{slug:orgSlugs[1],name:'Unrelated fixture company',description:'No matching content'}});privateValues.push(org.id,unrelated.id);
 const exact=await makeEvent('exact',{title:term}),prefixEvent=await makeEvent('prefix',{title:term+' Design Systems Summit'}),partial=await makeEvent('partial',{title:'A '+term+' Design Workshop'}),category=await makeEvent('category',{category:term+' topic'}),organization=await makeEvent('organization',{organizationId:org.id}),description=await makeEvent('description',{description:term+' authored long description'}),location=await makeEvent('location',{city:term+' City'});
 const short=await makeEvent('short',{shortDescription:term+' short public summary'});
 const draft=await makeEvent('draft',{title:term+' Private Draft',status:'DRAFT'}),cancelled=await makeEvent('cancelled',{title:term+' Cancelled',status:'CANCELLED'}),archived=await makeEvent('archived',{title:term+' Archived',status:'ARCHIVED'});
 const completed=await makeEvent('completed',{title:term+' Completed',status:'COMPLETED',startAt:past,endAt:new Date(past.getTime()+3600000)}),pastPublished=await makeEvent('past',{title:term+' Past',startAt:past,endAt:new Date(past.getTime()+3600000)}),online=await makeEvent('online',{title:term+' Online',eventType:'ONLINE'});
 for(let i=0;i<18;i++)await makeEvent('page-'+String(i).padStart(2,'0'),{title:term+' Page '+String(i).padStart(2,'0')});
 const speaker=await db.eventSpeaker.create({data:{eventId:exact.id,name:term+' Speaker',role:term+' Designer',company:term+' Speaker Company',bio:term+' bio',sortOrder:0}});
 for(const event of [draft,cancelled,archived])await db.eventSpeaker.create({data:{eventId:event.id,name:term+' Hidden Speaker',role:term+' Designer',company:term+' Speaker Company',sortOrder:0}});
 privateValues.push(speaker.id);
 let result=await eventSearch();
 assert.equal(result.results[0].slug,exact.slug);pass('1 Exact event title ranks first');
 assert.ok((await eventSearch({q:term+' Design'})).results.some(e=>e.slug===prefixEvent.slug));pass('2 Prefix title match');
 assert.ok((await eventSearch({q:term.slice(0,-4)})).results.some(e=>e.slug===exact.slug));assert.ok((await eventSearch({q:'desig'})).total>=3);pass('3 Case-insensitive practical partial matching including desig');
 assert.ok((await eventSearch({q:term+' topic'})).results.some(e=>e.slug===category.slug));pass('4 Stored category text match');
 assert.ok((await eventSearch({q:org.name})).results.some(e=>e.slug===organization.slug));pass('5 Organization-name event match');
 assert.ok((await eventSearch({q:term+' short public'})).results.some(e=>e.slug===short.slug));pass('Short descriptions are searchable without truncating query content');
 result=await eventSearch({date:'all'});let seen=[];for(let page=1;page<=result.pages;page++)seen.push(...(await eventSearch({date:'all',page:String(page)})).results.map(e=>e.slug));
 assert.ok(!seen.includes(draft.slug));pass('6 Draft excluded');assert.ok(!seen.includes(cancelled.slug)&&!seen.includes(archived.slug));pass('7 Cancelled and archived/private-ineligible events excluded');
 assert.deepEqual((await eventSearch()).results.map(e=>e.slug),(await eventSearch()).results.map(e=>e.slug));
 assert.ok(seen.indexOf(exact.slug)<seen.indexOf(prefixEvent.slug)&&seen.indexOf(partial.slug)<seen.indexOf(category.slug)&&seen.indexOf(category.slug)<seen.indexOf(organization.slug)&&seen.indexOf(organization.slug)<seen.indexOf(description.slug));pass('8 Relevance deterministic across pages; title/category/organization/description priorities');
 const upcoming=await eventSearch();assert.ok(!upcoming.results.some(e=>[completed.slug,pastPublished.slug].includes(e.slug)));assert.ok(seen.includes(completed.slug)&&seen.includes(pastPublished.slug));pass('9 Upcoming excludes past and completed; all includes both public statuses');
 result=await eventSearch({eventType:'ONLINE'});assert.deepEqual(result.results.map(e=>e.slug),[online.slug]);pass('10 Event type filtering');
 let organizations=await queries.searchOrganizations(params());assert.ok(organizations.results.some(o=>o.slug===org.slug));pass('11 Organization name matches');
 for(const q of [term+' research',term+' creativity','Short'+term])assert.ok((await queries.searchOrganizations(params({q}))).results.some(o=>o.slug===org.slug));pass('12 Organization description, industry, and short name match');
 assert.ok(!organizations.results.some(o=>o.slug===unrelated.slug));pass('13 Unrelated organization excluded');
 let speakers=await queries.searchSpeakers(params(),now);assert.deepEqual(speakers.results.map(s=>s.eventSlug),[exact.slug]);pass('14 Speaker name match with event context');
 for(const q of [term+' Designer',term+' Speaker Company',term+' bio'])assert.equal((await queries.searchSpeakers(params({q}),now)).results.length,1);pass('15 Speaker role, company, and bio matching');
 assert.equal(speakers.total,1);pass('16 Speakers attached to non-public events excluded');
 const first=await eventSearch(),second=await eventSearch({page:'2'});assert.deepEqual(first.results.map(e=>e.slug),(await eventSearch()).results.map(e=>e.slug));pass('17 Stable page boundaries');
 assert.equal(new Set(seen).size,seen.length);assert.ok(!first.results.some(e=>second.results.some(other=>other.slug===e.slug)));pass('18 No duplicate page results');assert.equal(first.results.length,12);await assert.rejects(()=>queries.searchEvents(params(),now,13));pass('19 Result limits enforced at server boundary');
 const suggestions=await queries.getSearchSuggestions(term);assert.ok(suggestions.length<=7);assert.ok(suggestions.some(s=>s.type==='Event')&&suggestions.some(s=>s.type==='Organization')&&suggestions.some(s=>s.type==='Speaker'));
 const serialized=JSON.stringify([first,organizations,speakers,suggestions]);assert.ok(!privateValues.some(value=>serialized.includes(value)));assert.ok(!serialized.includes('@example.test'));pass('20 No email/internal database IDs in public DTOs or suggestions');
 assert.equal((await queries.searchOrganizations(params({q:user.email}))).total,0);assert.equal((await queries.searchSpeakers(params({q:user.name}),now)).total,0);assert.equal((await eventSearch({q:user.email})).total,0);assert.equal((await eventSearch({q:user.name})).total,0);pass('21 Private user account fields not searchable; no attendee/user entity search');
 await assert.rejects(()=>queries.getSearchSuggestions('x'.repeat(101)));let response=await GET(new Request('http://localhost/api/search/suggestions?q='+'x'.repeat(101)));assert.equal(response.status,400);response=await GET(new Request('http://localhost/api/search/suggestions?q=a&q=b'));assert.equal(response.status,400);pass('22 Pathological long and repeated queries rejected');
 assert.deepEqual(await queries.getSearchSuggestions(''),[]);assert.deepEqual(await queries.getSearchSuggestions('a'),[]);assert.equal((await eventSearch({q:'a'})).total,0);assert.equal((await queries.searchOrganizations(params({q:''}))).total,0);pass('23 Empty/one-character queries handled safely; no empty autocomplete scans');
 assert.equal((await eventSearch({q:'%_\\'})).total,0);assert.equal((await eventSearch({q:"'; DROP TABLE users; --"})).total,0);pass('Wildcard and SQL-looking input remain literal bound parameters');
 assert.ok((await eventSearch({category:term+' topic'})).results.every(e=>e.slug===category.slug));assert.ok((await eventSearch({location:term+' City'})).results.some(e=>e.slug===location.slug));pass('Category and location filters use real stored fields');
 const topics=await queries.getPopularTopics(now,term);assert.ok(topics.some(t=>t.category===term+' topic'&&t.count===1));pass('Popular/matching topics derived from upcoming published events');
 const soonest=await eventSearch({date:'all',sort:'soonest'});assert.equal(soonest.results[0].status,'completed');const newest=await eventSearch({sort:'newest'});assert.ok(newest.results[0].slug.includes('page-'));pass('Soonest/newest supported with stable slug ties');
 response=await GET(new Request('http://localhost/api/search/suggestions?q='+term));assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');const endpointBody=await response.text();assert.ok(!privateValues.some(value=>endpointBody.includes(value)));pass('Public suggestions endpoint works anonymously and is never cached');
 // Catalog and EXPLAIN are read-only. Do not disable sequential scans in measured plans.
 report.indexes=await db.$queryRaw`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND indexname IN ('Event_public_search_trgm_idx','Organization_public_search_trgm_idx','Organization_name_search_trgm_idx','EventSpeaker_public_search_trgm_idx','Event_category_status_startAt_idx') ORDER BY indexname`;
 assert.equal(report.indexes.length,5);
 // Capture EXPLAIN for the actual application SQL, not a reconstructed query.
 const originalTransaction=db.$transaction.bind(db);
 db.$transaction=(work,options)=>originalTransaction(async tx=>work(new Proxy(tx,{get(target,property){
  if(property==='$queryRaw')return async(sql,...values)=>{
   const plan=await target.$queryRaw(Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`);
   report.plans.push({parameterizedSql:sql.sql,plan});return target.$queryRaw(sql,...values);
  };
  const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value;
 }})),options);
 try{await eventSearch();await queries.searchOrganizations(params());await queries.searchSpeakers(params(),now);await queries.getPopularTopics(now,term);}finally{db.$transaction=originalTransaction;}
 assert.equal(report.plans.length,7);
 pass('24 Migration indexes present and real Neon EXPLAIN ANALYZE captured');
}finally{
 await db.event.deleteMany({where:{slug:{in:eventSlugs}}});await db.organization.deleteMany({where:{slug:{in:orgSlugs}}});await db.user.deleteMany({where:{id:{in:users}}});
 assert.equal(await db.event.count({where:{slug:{in:eventSlugs}}}),0);assert.equal(await db.organization.count({where:{slug:{in:orgSlugs}}}),0);assert.equal(await db.user.count({where:{id:{in:users}}}),0);report.cleanupVerified=true;
 if(baseline){assert.deepEqual(await fingerprint(),baseline);report.existingRecordsUnchanged=true;}
 writeFileSync(root+'/runtime.json',JSON.stringify(report,null,2));await db.$disconnect();console.log('CLEANUP verified; existing records unchanged. Report '+root+'/runtime.json');
}
