import './support/application-loader.mjs';
import {registerHooks} from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='@/features/auth/server/session')return{url:'data:text/javascript,export const getAuthorizedUser=async()=>globalThis.recommendationUnitUser',shortCircuit:true};
 if(specifier==='@/lib/db')return{url:'data:text/javascript,export const getDb=()=>globalThis.recommendationUnitDb',shortCircuit:true};
 return nextResolve(specifier,context);
}});
const scoring=await import('../src/features/recommendations/server/scoring.ts');
const {getRecommendedEventsForUser}=await import('../src/features/recommendations/server/queries.ts');
const now=new Date('2030-01-01T00:00:00Z');
function candidate(slug,extra={}){return{slug,startAt:new Date('2030-01-10'),category:'Design',organizationName:'Public studio',groupKey:slug,followedOrganization:false,attendedCategory:false,joinedCategory:false,savedCategory:false,previousOrganization:false,...extra};}
test('every weight and reason priority is explicit; history volume cannot multiply scores',()=>{
 const base=candidate('a',{startAt:new Date('2030-02-01')});
 for(const[key,weight]of Object.entries(scoring.recommendationWeights).filter(([key])=>key!=='nearTerm'))assert.equal(scoring.scoreRecommendationCandidate({...base,[key]:true},now).score,weight);
 const all=scoring.scoreRecommendationCandidate(candidate('all',{followedOrganization:true,attendedCategory:true,joinedCategory:true,savedCategory:true,previousOrganization:true}),now);assert.equal(all.score,155);assert.equal(all.reason,'Because you follow Public studio');
 assert.equal(scoring.scoreRecommendationCandidate(candidate('attended',{attendedCategory:true,joinedCategory:true,savedCategory:true}),now).reason,'Similar to Design events you attended');
 assert.equal(scoring.scoreRecommendationCandidate(candidate('saved',{savedCategory:true}),now).reason,'Similar to Design events you saved');
});
test('timing uses an inclusive 14-day boundary; cold-start reasons never claim personalization',()=>{
 assert.equal(scoring.scoreRecommendationCandidate(candidate('a',{startAt:new Date('2030-01-15')}),now).score,10);
 assert.equal(scoring.scoreRecommendationCandidate(candidate('a',{startAt:new Date('2030-01-15T00:00:00.001Z')}),now).score,0);
 assert.equal(scoring.scoreRecommendationCandidate(candidate('past',{startAt:new Date('2029-12-31')}),now).score,0);
 const cold=scoring.scoreRecommendationCandidate(candidate('a'),now);assert.equal(cold.personalized,false);assert.equal(cold.reason,'Upcoming event you can join');
});
test('diversity considers alternatives first, handles independent creators, and relaxes only for sparse pools',()=>{
 const rows=Array.from({length:6},(_,i)=>candidate('f'+i,{groupKey:'same-org',followedOrganization:true}));
 rows.push(...Array.from({length:5},(_,i)=>candidate('other'+i)));
 const selected=scoring.selectRecommendationCandidates(rows,now);assert.equal(selected.length,6);assert.equal(selected.filter(c=>c.groupKey==='same-org').length,2);
 assert.equal(scoring.selectRecommendationCandidates(rows.slice(0,6),now).length,6);
 assert.equal(scoring.selectRecommendationCandidates(rows.slice(0,6),now,false).length,2);
});
test('ordering is deterministic with date/slug ties and practical-horizon priority',()=>{
 const rows=[candidate('b'),candidate('a'),candidate('far',{startAt:new Date('2030-06-01'),followedOrganization:true})];
 assert.deepEqual(scoring.selectRecommendationCandidates(rows,now).map(c=>c.slug),['a','b','far']);
 assert.deepEqual(scoring.selectRecommendationCandidates(rows.toReversed(),now).map(c=>c.slug),['a','b','far']);
});
test('anonymous requests never reach the database; client identity arguments cannot select another viewer',async()=>{
 globalThis.recommendationUnitUser=null;globalThis.recommendationUnitDb={$transaction:()=>{throw Error('Database must not run')}};
 assert.equal(await getRecommendedEventsForUser({userId:'forged-other'}),null);
 globalThis.recommendationUnitUser={id:'trusted-session-user'};
 const rows=Array.from({length:6},(_,i)=>candidate('public-event-'+i));
 const calls=[];globalThis.recommendationUnitDb={$transaction:async(work)=>work({$executeRaw:async()=>0,$queryRaw:async(sql)=>{calls.push(sql);return rows;},event:{findMany:async()=>rows.map(row=>({id:'private-event-id',slug:row.slug,title:'Public event',description:null,shortDescription:null,category:'Design',locationName:null,city:null,region:null,startAt:row.startAt,endAt:new Date('2030-01-10T02:00:00Z'),timezone:'UTC',eventType:'ONLINE',status:'PUBLISHED',creator:{name:'Public organizer'},organization:null}))}})};
 const result=await getRecommendedEventsForUser({userId:'forged-other'});assert.equal(result.results.length,6);
 assert.ok(calls.every(sql=>sql.values.includes('trusted-session-user')&&!sql.values.includes('forged-other')));
 const serialized=JSON.stringify(result);for(const field of ['trusted-session-user','private-event-id','groupKey','followedOrganization','score'])assert.ok(!serialized.includes(field));
});
