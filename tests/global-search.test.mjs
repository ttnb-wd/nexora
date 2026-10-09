import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
const {parseSearchParams,searchPattern,searchHref,SEARCH_PAGE_SIZE,SEARCH_MAX_PAGE,SearchInputError}=await import('../src/features/search/params.ts');
test('search validation caps text, filters, duplicate params, and pagination before any database work',()=>{
 for(const raw of [{q:'x'.repeat(101)},{q:'a\0b'},{q:['design','other']},{type:'users'},{date:'tomorrow'},{eventType:'private'},{sort:'popular'},{page:'0'},{page:'101'},{page:'1e2'},{page:'1.5'},{category:'x'.repeat(81)},{location:'x'.repeat(81)}])assert.throws(()=>parseSearchParams(raw),SearchInputError);
 assert.equal(parseSearchParams({q:'x'.repeat(100)}).q.length,100);
 assert.equal(parseSearchParams({q:'  Design   Systems  '}).q,'Design Systems');
 assert.equal(SEARCH_PAGE_SIZE,12);assert.equal(SEARCH_MAX_PAGE,100);
});
test('LIKE wildcard, backslash, and SQL-looking input stay literal',()=>{
 assert.equal(searchPattern('Desig'),'%desig%');
 assert.equal(searchPattern('100%_\\'),'%100\\%\\_\\\\%');
 assert.equal(parseSearchParams({q:"'; DROP TABLE users; --"}).q,"'; DROP TABLE users; --");
});
test('all supported URL state round-trips and pagination preserves filters',()=>{
 const state=parseSearchParams({q:'Design & AI',type:'events',category:'Design',eventType:'HYBRID',date:'all',location:'Yangon',sort:'newest',page:'2'});
 const url=new URL(searchHref(state), 'https://example.test');
 assert.deepEqual(parseSearchParams(Object.fromEntries(url.searchParams)),state);
 const next=new URL(searchHref(state,{page:3},'/explore'),'https://example.test');
 assert.equal(next.pathname,'/explore');assert.equal(next.searchParams.get('q'),'Design & AI');assert.equal(next.searchParams.get('page'),'3');
 assert.equal(searchHref(parseSearchParams({})),'/search');
});
