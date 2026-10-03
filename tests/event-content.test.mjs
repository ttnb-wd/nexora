import './support/typescript-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { getServerActionForm } from './support/action-form.mjs';
const { agendaItemSchema, eventSpeakerSchema, eventResourceSchema, agendaInputFromForm, contentEditable } = await import('../src/features/events/content-schemas.ts');
const { mapPublicEvent, publicEventDetailSelect } = await import('../src/features/events/server/public-event-mapper.ts');
const { eventAccessWhere } = await import('../src/features/events/server/authorization-rules.ts');
const agenda = { title: ' Session ', startAt: new Date('2030-06-20T03:30:00Z'), endAt: null };
test('runtime form submission isolates lifecycle actions from content forms', () => {
  const form=(id,fields='')=>`<form><input name="$ACTION_REF_${id}" value="" />${fields}</form>`;
  const lifecycle=form('publish','<input name="confirm" value="yes" />');
  assert.equal(getServerActionForm(form('agenda')+lifecycle+form('speaker')+form('resource')),lifecycle);
  assert.equal(getServerActionForm(form('wizard')),form('wizard'));
  assert.throws(()=>getServerActionForm(form('agenda')+form('resource')),/Select a specific form/);
});
test('agenda stores Dates, validates optional end and rejects invalid or canonical string timestamps', () => {
  assert.equal(agendaItemSchema.parse(agenda).title, 'Session');
  assert.equal(agendaItemSchema.parse(agenda).description, null);
  for (const changes of [{title: ''}, {title:'x'.repeat(201)}, {startAt:'2030-06-20T03:30:00Z'}, {startAt:new Date('bad')}, {endAt:agenda.startAt}, {endAt:new Date('2030-06-20T03:29:00Z')}, {locationLabel:'x'.repeat(201)}]) assert.equal(agendaItemSchema.safeParse({...agenda,...changes}).success,false);
});
test('wall-clock agenda form uses event timezone, rejects malformed and ambiguous times', () => {
  const form = new FormData(); form.set('title','Session'); form.set('startAt','2030-06-20T10:00');
  assert.equal(agendaInputFromForm(form,'Asia/Yangon').startAt.toISOString(),'2030-06-20T03:30:00.000Z');
  form.set('startAt','2030-11-03T01:30'); assert.throws(()=>agendaInputFromForm(form,'America/New_York'),/occurs twice/);
  form.set('startAt','2030-06-20T10:00Z'); assert.throws(()=>agendaInputFromForm(form,'Asia/Yangon'));
});
test('speaker lengths, empty normalization and client identity stripping', () => {
  assert.deepEqual(eventSpeakerSchema.parse({name:' Speaker ',role:' ',company:'Company',bio:'Bio',eventId:'forged',imageUrl:'https://example.com/image'}),{name:'Speaker',role:null,company:'Company',bio:'Bio'});
  for(const changes of [{name:''},{name:'x'.repeat(201)},{role:'x'.repeat(201)},{company:'x'.repeat(201)},{bio:'x'.repeat(5001)}]) assert.equal(eventSpeakerSchema.safeParse({name:'Speaker',...changes}).success,false);
});
test('resources reject unsafe schemes, credentials, bad enum and oversized inputs', () => {
  const resource={title:' Slides ',type:'SLIDES',url:'https://example.com/slides'};
  assert.equal(eventResourceSchema.parse(resource).title,'Slides');
  for(const url of ['javascript:alert(1)','data:text/html,test','file:///etc/passwd','ftp://example.com','mailto:test@example.com','https://user:pass@example.com','bad']) assert.equal(eventResourceSchema.safeParse({...resource,url}).success,false,url);
  assert.equal(eventResourceSchema.safeParse({...resource,url:'http://example.com'}).success,true);
  for(const changes of [{type:'PDF'},{title:''},{url:'https://example.com/'+ 'x'.repeat(2048)},{description:'x'.repeat(5001)}]) assert.equal(eventResourceSchema.safeParse({...resource,...changes}).success,false);
});
test('lifecycle policy allows post-completion resources only', () => {
  for(const kind of ['agenda','speaker','resource']) {
    for(const status of ['DRAFT','PUBLISHED']) assert.equal(contentEditable(status,kind),true);
    for(const status of ['CANCELLED','ARCHIVED']) assert.equal(contentEditable(status,kind),false);
    assert.equal(contentEditable('COMPLETED',kind),kind==='resource');
  }
});
test('authorization keeps creator-only individual branch and restricts organization roles', () => {
  const where=eventAccessWhere('user');
  assert.deepEqual(where.OR[0],{organizationId:null,creatorId:'user'});
  assert.deepEqual(where.OR[1].organization.members.some,{userId:'user',role:{in:['OWNER','ADMIN','EDITOR']}});
});
test('public rich DTO omits child IDs/private fields, preserves authored data and filters unsafe links', () => {
  const record={id:'event',slug:'event',title:'Event',startAt:agenda.startAt,endAt:new Date('2030-06-20T05:30:00Z'),timezone:'Asia/Yangon',eventType:'ONLINE',status:'PUBLISHED',creator:{name:'Creator'},organization:null,
    agendaItems:[{...agenda,id:'private-agenda',description:'Discussion',locationLabel:'Room A'}],speakers:[{id:'private-speaker',name:'Speaker',role:'Host',company:'Company',bio:'Author bio'}],resources:[{id:'private-resource',title:'Slides',type:'SLIDES',url:'https://example.com/slides',description:'Download'}, {title:'Unsafe',type:'LINK',url:'javascript:alert(1)'}]};
  const event=mapPublicEvent(record,new Date('2030-01-01'));
  assert.equal(event.details.agenda[0].startAt,agenda.startAt.toISOString());
  assert.match(event.details.agenda[0].time,/10:00 AM/);
  assert.equal(event.details.speakers[0].organizationName,'Company');
  assert.equal(event.details.resources.length,1);
  assert.equal(event.details.resources[0].url,'https://example.com/slides');
  for(const relation of ['agendaItems','speakers','resources']) for(const key of ['id','eventId','createdAt','updatedAt','sortOrder']) assert.ok(!(key in publicEventDetailSelect[relation].select));
  assert.ok(!JSON.stringify(event).includes('private-'));
});
