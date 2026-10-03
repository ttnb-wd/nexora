import './support/typescript-loader.mjs';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return {url:'data:text/javascript,export%20default%20{}',shortCircuit:true};
  if (specifier === '@/lib/db') return {url:'data:text/javascript,export%20const%20getDb%20%3D%20()%20%3D%3E%20globalThis.step11Db',shortCircuit:true};
  if (specifier.startsWith('@/')) {
    const path = new URL(`../src/${specifier.slice(2)}.ts`,import.meta.url);
    if (existsSync(path)) return nextResolve(path.href,context);
  }
  return nextResolve(specifier,context);
}});
const { mapPublicOrganization, publicOrganizationSelect } = await import('../src/features/organizations/server/public-organization-mapper.ts');
const queries = await import('../src/features/organizations/server/public-organization-queries.ts');
const raw = {name:'Real Research Organization',slug:'real-research',shortName:null,description:'Authored description',industry:'Research',city:null,region:'Myanmar',website:'https://example.com',visualTheme:null,logoVariant:null};
const keys = ['name','slug','shortName','description','industry','city','region','website','visualTheme','logoVariant'].sort();
test('organization allowlist and mapper cannot serialize extra private fields', () => {
 assert.deepEqual(Object.keys(publicOrganizationSelect).sort(),keys);
 const dto=mapPublicOrganization({...raw,id:'private-org-id',members:[{userId:'private-user',role:'OWNER'}],accounts:[{password:'secret'}]});
 assert.deepEqual(Object.keys(dto).sort(),keys);
 assert.ok(!JSON.stringify(dto).includes('private') && !JSON.stringify(dto).includes('secret'));
 assert.equal(dto.industry,'Research'); assert.equal(dto.shortName,'RRO');
 assert.equal(dto.region,'Myanmar'); assert.equal(dto.visualTheme,'violet'); assert.equal(dto.logoVariant,'asterisk');
});
test('unsafe websites and unsupported artwork never cross into clickable UI', () => {
 for(const website of ['javascript:alert(1)','data:text/html,test','https://user:password@example.com','ftp://example.com']) assert.equal(mapPublicOrganization({...raw,website}).website,null);
 assert.equal(mapPublicOrganization({...raw,website:'https://example.com/path'}).website,'https://example.com/path');
 const dto=mapPublicOrganization({...raw,visualTheme:'unknown',logoVariant:'unknown',description:null});
 assert.equal(dto.description,''); assert.equal(dto.logoVariant,'asterisk');
});
test('organization queries select only public fields and do not swallow database failures', async () => {
 globalThis.step11Db={organization:{findMany:async(args)=>{assert.deepEqual(args.select,publicOrganizationSelect);return [raw]},findUnique:async(args)=>{assert.deepEqual(args.select,publicOrganizationSelect);assert.deepEqual(args.where,{slug:'real-research'});return raw}}};
 assert.equal((await queries.getPublicOrganizations())[0].slug,'real-research');
 assert.equal((await queries.getPublicOrganizationBySlug('real-research')).name,raw.name);
 globalThis.step11Db.organization.findMany=async()=>{throw new Error('private Prisma failure')};
 await assert.rejects(queries.getPublicOrganizations());
 globalThis.step11Db.organization.findUnique=async()=>null;
 assert.equal(await queries.getPublicOrganizationBySlug('unknown'),null);
});
test('organization event queries scope ownership, statuses and dates at the database boundary', async () => {
 const calls=[];globalThis.step11Db={event:{findMany:async(args)=>{calls.push(args);return []}}};
 const now=new Date('2030-01-01');
 await queries.getOrganizationUpcomingEvents('real-research',now);
 await queries.getOrganizationPastEvents('real-research',now);
 assert.deepEqual(calls[0].where,{organization:{slug:'real-research'},status:'PUBLISHED',startAt:{gte:now}});
 assert.deepEqual(calls[1].where,{organization:{slug:'real-research'},OR:[{status:'COMPLETED'},{status:'PUBLISHED',startAt:{lt:now}}]});
 assert.deepEqual(calls[1].orderBy,[{startAt:'desc'},{slug:'asc'}]);
 for(const {select} of calls) {
  assert.ok(!select.creatorId && !select.organizationId);
  assert.deepEqual(select.creator,{select:{name:true}});
  assert.ok(!select.organization.select.members && !select.organization.select.id);
 }
});
test('trending uses each ranking criterion and deterministic no-event/empty fallback', async () => {
 const now=new Date('2030-01-01');
 const row=(slug,dates,total)=>({...raw,slug,events:dates.map(date=>({startAt:new Date(date)})),_count:{events:total}});
 const a=row('a',['2030-05-01'],10), b=row('b',['2030-03-01','2030-04-01'],2), c=row('c',['2030-02-01','2030-03-01'],3), d=row('d',['2030-01-02','2030-03-01'],3);
 for(const [rows,winner] of [[[a,b],'b'],[[b,c],'c'],[[c,d],'d'],[[row('z',[],0),row('a',[],0)],'a'],[[],null]]) {
  globalThis.step11Db={organization:{findMany:async(args)=>{assert.equal(args.select._count.select.events.where.status,'PUBLISHED');assert.deepEqual(args.select.events.where,{status:'PUBLISHED',startAt:{gte:now}});return rows}},event:{findMany:async(args)=>{assert.deepEqual(args.where,{organization:{slug:winner},status:'PUBLISHED',startAt:{gte:now}});return []}}};
  const result=await queries.getTrendingOrganization(now);assert.equal(result?.organization.slug ?? null,winner);
  if(result) assert.deepEqual(Object.keys(result.organization).sort(),keys);
 }
});
test('related organizations use stored industry and never invent topics', async () => {
 globalThis.step11Db={organization:{findMany:async(args)=>{assert.deepEqual(args.where,{slug:{not:raw.slug},industry:'Research'});assert.equal(args.take,3);return []}}};
 assert.deepEqual(await queries.getRelatedOrganizations(mapPublicOrganization(raw)),[]);
 assert.deepEqual(await queries.getRelatedOrganizations(mapPublicOrganization({...raw,industry:null})),[]);
});
