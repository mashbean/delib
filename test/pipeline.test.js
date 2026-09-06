import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getPipeline,traceArtifact,participationChange,personJourney } from '../public/pipeline-core.js';
import { getStepState,validateFlowBundle } from '../public/flow-core.js';
import { playbook } from '../public/workflow-playbook.js';
import { methods } from '../public/home-content.js';
const bundle=JSON.parse(readFileSync(new URL('../public/data/flow-demo.json',import.meta.url),'utf8'));
describe('source and people pipelines',()=>{
 it('shows exact source-derived links without turning record counts into voting weights',()=>{
  for(const round of bundle.rounds){const g=getPipeline(round);expect(Array.from({length:6},(_,i)=>g.nodes.filter(n=>n.column===i).length)).toEqual([16,4,4,4,1,2]);for(const link of g.links)expect(round.artifacts.find(a=>a.id===link.target).derivedFrom).toContain(link.source);}
  const source='demo:school-street:r1:form:p04-q1',trace=traceArtifact(bundle,source);
  expect(trace.descendants).toContain('demo:school-street:r1:tttc:theme2');
  expect(trace.descendants).toContain('demo:school-street:r1:polis:statement2');
  expect(trace.descendants.some(id=>id.includes(':r2:'))).toBe(true);
 });
 it('tracks the same person switching settings rather than assigning parallel permanent lanes',()=>{
  expect(personJourney(bundle,0,'p01').map(p=>p.mode)).toEqual(['in-person','online','in-person','online','in-person','online','in-person','online']);
  const move=participationChange(bundle,0,1);expect(move.entered).toHaveLength(8);expect(move.switched).toHaveLength(4);
  const state=getStepState(bundle,{roundId:'r1',phaseId:'recruit'});expect(state.stats.online).toBe(12);expect(state.stats.inPerson).toBe(0);
  expect(participationChange(bundle,0,6).left).toHaveLength(8);
  expect(personJourney(bundle,1,'p09').every(x=>x.mode==='absent')).toBe(true);
  const second=participationChange(bundle,1,1);
  expect(second.entered.map(p=>p.id)).toEqual(['p13','p14']);
  expect(second.left.map(p=>p.id)).toEqual(['p09','p10']);
  expect(second.switched).toHaveLength(0);
  const third=participationChange(bundle,2,3);
  expect(third.entered.map(p=>p.id)).toEqual(['p09','p10']);
  expect(third.left.map(p=>p.id)).toEqual(['p02','p08']);
 });
 it('rejects unsupported phase modes and keeps old bundles with only round modes valid',()=>{
  const copy=structuredClone(bundle);copy.rounds[0].attendance[0].phaseModes.frame='telepathy';expect(validateFlowBundle(copy).valid).toBe(false);
  for(const r of copy.rounds)for(const a of r.attendance)delete a.phaseModes;
  expect(validateFlowBundle(copy).valid).toBe(true);
 });
 it('embeds applied actions, review gates, transition reasons and method sources into every step',()=>{
  expect(playbook).toHaveLength(8);
  for(const step of playbook){for(const key of ['place','action','gate','move','maturity'])for(const language of ['zh','en'])expect(step[key][language].trim()).not.toBe('');for(const id of step.sources)expect(methods.some(m=>m.id===id)).toBe(true);}
  expect(new Set(playbook.flatMap(p=>p.sources)).size).toBe(8);
 });
});
