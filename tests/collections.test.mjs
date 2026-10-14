import './support/application-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
const {collectionNameSchema,createCollectionSchema,membershipSchema,deleteCollectionSchema,collectionPage}=await import('../src/features/collections/schemas.ts');
test('collection names trim, accept 1–60 characters, and reject blanks, oversized and control input',()=>{
 assert.equal(collectionNameSchema.parse('  Work  '),'Work');assert.equal(collectionNameSchema.parse('W'),'W');assert.equal(collectionNameSchema.parse('W'.repeat(60)).length,60);assert.equal(collectionNameSchema.parse('🌿'.repeat(60)).length,120);
 for(const name of ['', ' \t ', 'a'.repeat(61), 'Work\nList','\0bad',' '.repeat(300)])assert.equal(collectionNameSchema.safeParse(name).success,false);
 assert.equal(collectionNameSchema.parse('<script>alert(1)</script>'),'<script>alert(1)</script>');
});
test('collection mutations reject forged ownership, duplicate selection, and oversized payloads',()=>{
 assert.equal(createCollectionSchema.safeParse({name:'Work',userId:'another-user'}).success,false);
 assert.equal(membershipSchema.safeParse({slug:'design-summit',collectionIds:['one','two']}).success,true);
 for(const input of [{slug:'design-summit',collectionIds:['one','one']},{slug:'design-summit',collectionIds:Array.from({length:51},(_,i)=>'id-'+i)},{slug:'../private',collectionIds:[]},{slug:'design-summit',collectionIds:['owner/id']},{slug:'design-summit',collectionIds:[],userId:'other'}])assert.equal(membershipSchema.safeParse(input).success,false);
});
test('delete requires explicit confirmation; paging is bounded and refresh-safe',()=>{
 assert.equal(deleteCollectionSchema.safeParse({id:'abc',confirm:true}).success,true);assert.equal(deleteCollectionSchema.safeParse({id:'abc',confirm:false}).success,false);
 for(const input of [undefined,'bad',-1,Infinity,1.5])assert.equal(collectionPage(input),1);
 assert.equal(collectionPage('2'),2);assert.equal(collectionPage('10001'),10000);
});
