import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {operationsDemo} from '../public/operations-demo.js';
import {validateProject,nextRound} from '../public/workspace-core.js';
import {saveSession} from '../public/operations-core.js';
import {saveParticipation} from '../public/facilitation-core.js';
import {parseAgenda,editSessionPlan,createSessionSupport,findSessionSupport} from '../public/session-planning-core.js';
import {sessionSupportView,sessionPlanEditor} from '../public/session-planning-view.js';
const demo=()=>operationsDemo(JSON.parse(readFileSync(new URL('../public/data/flow-demo.json',import.meta.url))),'en');
const session=p=>p.operations.sessions[0];
const input=p=>({...session(p).history.at(-1),expectedHistoryId:session(p).history.at(-1).id,invitees:['extra-alias'],additionalGroups:['B'],reason:'Offer another route',by:'Host',agenda:parseAgenda('Shared learning | 30\nDiscussion | 45')});
const support=p=>({confirmed:true,expectedHistoryId:session(p).history.at(-1).id,group:'Night workers',action:'Offer an evening slot',owner:'Host',reviewOn:'2026-12-01',note:'Host plan, invitation not sent',by:'Recorder'});
const create=p=>createSessionSupport(p,session(p).id,'demo-night-worker',support(p));

it('edits plans as new versions, preserving observations, feedback and prior agenda',()=>{
  const p=demo(),before=structuredClone(session(p)),s=editSessionPlan(p,session(p).id,input(p)),e=s.history.at(-1);
  expect(s.history.slice(0,-1)).toEqual(before.history);expect(e.agenda[0].minutes).toBe(30);
  expect(e.evaluations).toEqual(before.history.at(-1).evaluations);expect(e.observations.slice(0,-1)).toEqual(before.history.at(-1).observations);
  expect(e.observations.at(-1)).toMatchObject({participant:'extra-alias',invited:true,attended:false,spoke:false,voted:false,group:'A'});
  expect(e.groups).toEqual(['A','B']);expect(e.changeReason).toBe('Offer another route');expect(()=>validateProject(p)).not.toThrow();
});
it.each(['Discuss | -1','Discuss | 0','Discuss | 241','Discuss | 2.5','Discuss | 5 | x','Discuss | 0x20',' | 20'])('rejects ambiguous agenda input %s',s=>expect(()=>parseAgenda(s)).toThrow());
it.each(['duplicate','stale','date','empty-reason'])('rejects invalid edits without partial saves: %s',kind=>{
  const p=demo(),i=input(p),before=JSON.stringify(p);
  if(kind==='duplicate')i.invitees=[' demo-night-worker '];if(kind==='stale')i.expectedHistoryId='old';if(kind==='date')i.date='2026-02-30';if(kind==='empty-reason')i.reason='';
  expect(()=>editSessionPlan(p,session(p).id,i)).toThrow();expect(JSON.stringify(p)).toBe(before);
});
it('creates explicitly confirmed support tied to the exact barrier version',()=>{
  const p=demo(),g=create(p);expect(g.history[0]).toMatchObject({status:'follow-up',action:'Offer an evening slot',owner:'Host'});
  expect(g.sessionSource).toEqual({sessionId:session(p).id,entryId:session(p).history.at(-1).id,participant:'demo-night-worker'});
  const before=JSON.stringify(p);expect(()=>create(p)).toThrow(/already exists/);expect(JSON.stringify(p)).toBe(before);
  expect(()=>validateProject(JSON.parse(before))).not.toThrow();
});
it.each(['unconfirmed','stale','unknown','blank-action','date'])('rejects invalid support transactionally: %s',kind=>{
  const p=demo(),i=support(p),before=JSON.stringify(p);let alias='demo-night-worker';
  if(kind==='unconfirmed')i.confirmed=false;if(kind==='stale')i.expectedHistoryId='old';if(kind==='unknown')alias='no-one';if(kind==='blank-action')i.action='';if(kind==='date')i.reviewOn='2026-02-30';
  expect(()=>createSessionSupport(p,session(p).id,alias,i)).toThrow();expect(JSON.stringify(p)).toBe(before);
});
it('retains support evidence after barrier text changes and keeps lineage across rounds',()=>{
  const p=demo(),g=create(p),origin=structuredClone(g.sessionSource),s=session(p),prev=s.history.at(-1);
  saveSession(p,s.id,{...prev,observations:prev.observations.map(v=>({...v,barrier:''})),by:'Host'});
  expect(()=>validateProject(p)).not.toThrow();expect(findSessionSupport(p,s.id,'demo-night-worker').gap.sessionSource).toEqual(origin);
  p.rounds=p.rounds.slice(0,1);nextRound(p,{reason:'Continue support',owner:'Host',date:'2026-12-01',phase:'recruit'});
  const carried=findSessionSupport(p,s.id,'demo-night-worker');expect(carried.gap.carriedFrom).toBe(g.id);expect(carried.gap.sessionSource).toEqual(origin);
  const e=carried.gap.history.at(-1);saveParticipation(p,carried.gap.id,{...e,status:'heard',note:'Follow-up recorded',by:'Host'});
  expect(()=>validateProject(JSON.parse(JSON.stringify(p)))).not.toThrow();expect(()=>create(p)).toThrow(/already exists/);
});
it.each(['session','version','barrier','lineage'])('rejects forged support sources: %s',kind=>{
  const p=demo(),g=create(p);
  if(kind==='session')g.sessionSource.sessionId='missing';if(kind==='version')g.sessionSource.entryId='missing';if(kind==='barrier')g.history[0].barrier='Invented';
  if(kind==='lineage'){p.rounds=p.rounds.slice(0,1);nextRound(p,{reason:'Continue',owner:'Host',date:'2026-12-01',phase:'recruit'});p.rounds[1].participation.find(x=>x.carriedFrom===g.id).sessionSource.entryId='missing';}
  expect(()=>validateProject(p)).toThrow();
});
it.each(['zh','en'])('renders editable and tracked support with escaped content: %s',lang=>{
  const p=demo();session(p).history.at(-1).observations[2].barrier='<img src=x onerror=alert(1)>';
  expect(sessionSupportView(p,session(p),lang)).not.toContain('<img');expect(sessionPlanEditor(session(p),lang)).toContain('data-version=');
  create(p);const html=sessionSupportView(p,session(p),lang);expect(html).toContain('data-support-gap=');expect(html).not.toContain('data-action="session-support"');
});
it('carries late support recorded in an old round without reopening resolved lineages',()=>{
  const p=demo(),g=create(p);p.view.roundId=p.rounds.at(-1).id;
  const r=nextRound(p,{reason:'Continue',owner:'Host',date:'2026-12-01',phase:'recruit'});
  expect(r.participation).toHaveLength(1);expect(r.participation[0].carriedFrom).toBe(g.id);
  expect(()=>validateProject(p)).not.toThrow();
});
it('keeps an existing support link visible when the current barrier field is empty',()=>{
  const p=demo();create(p);const s=session(p),e=s.history.at(-1);
  saveSession(p,s.id,{...e,observations:e.observations.map(v=>({...v,barrier:''})),by:'Host'});
  expect(sessionSupportView(p,session(p),'en')).toContain('data-support-gap=');
});
