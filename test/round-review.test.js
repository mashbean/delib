import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createProject,record,nextRound,validateProject,reviewRecord,reviseRecord} from '../public/workspace-core.js';
import {requestCorrection,resolveCorrection,saveSession,startProgression,advanceProgression} from '../public/operations-core.js';
import {operationsDemo} from '../public/operations-demo.js';
import {roundReview,roundReviewSuggestion,roundReviewMarkdown} from '../public/round-review-core.js';
import {roundReviewView} from '../public/round-review-view.js';
const demo=lang=>operationsDemo(JSON.parse(readFileSync(new URL('../public/data/flow-demo.json',import.meta.url))),lang);
const create=()=>createProject({title:'Test',goal:'Test',audience:'Test',deadline:'2026-12-01'});
const plan={reason:'More evidence needed',owner:'Host',date:'2026-12-01',phase:'learn'};
const by='Recorder',owner='Host',due='2026-12-01',reason='Correction needed';

it.each(['zh','en'])('summarizes real denominators and leaves the workspace untouched: %s',lang=>{
  const p=demo(lang),before=JSON.stringify(p),r=roundReview(p);
  expect(r.sessions[0].counts).toEqual({invited:3,attended:2,spoke:1,voted:2});
  expect(r.sessions[0].feedbackMissing).toBe(1);expect(r.sessions[0].scores.heard).toEqual({responses:1,mean:4});
  expect(r.sessions[0].barriers).toHaveLength(1);expect(r.corrections).toHaveLength(1);
  expect(r.progressions[0].attention).toContain('support');expect(r.progressions[0].attention).toContain('correction');
  expect(roundReviewSuggestion(r,lang).phase).toBe('recruit');expect(roundReviewSuggestion(r,lang).text.length).toBeLessThanOrEqual(1000);
  expect(roundReviewView(p,lang)).toContain('step=next');expect(roundReviewView(p,lang,{compact:true})).toContain('use-round-review');
  const md=roundReviewMarkdown(p);expect(md).toContain('輪次回顧');expect(md).toContain('Round review');expect(md).toContain(r.progressions[0].current.minorityNote);
  expect(JSON.stringify(p)).toBe(before);
});

it('keeps unknown scores missing, never converts them to zero',()=>{
  const p=demo('en'),s=p.operations.sessions[0].history.at(-1);s.evaluations[0].heard=null;s.evaluations[0].understood=null;
  const r=roundReview(p);expect(r.sessions[0].scores.heard).toEqual({responses:0,mean:null});
  expect(r.sessions[0].scores.fair).toEqual({responses:1,mean:4});expect(roundReviewView(p,'en')).toContain('No score');
});

it('does not treat a planned session as missing feedback or merge people across sessions',()=>{
  const p=demo('en'),old=p.operations.sessions[0].history[0];saveSession(p,null,{...old,by});
  const r=roundReview(p);expect(r.sessions).toHaveLength(2);expect(r.sessions[1].feedbackMissing).toBeNull();
  expect(r.sessions[1].counts.invited).toBe(3);expect(r.sessions[0].counts.invited).toBe(3);
  expect(r).not.toHaveProperty('uniqueParticipants');
});

it('does not leak later-round operations into an earlier round review or carry list',()=>{
  const p=create();const v=record('statement','Later voice',{tool:'form',id:'later'});const old=p.view.roundId;
  nextRound(p,plan);p.rounds.at(-1).artifacts.push(v);requestCorrection(p,v.id,{reason,owner,due,by});
  expect(roundReview(p).corrections).toHaveLength(1);
  const r=roundReview(p,old);expect(r.corrections).toHaveLength(0);expect(r.carryRefs).not.toContain(v.id);
});

it('carries unfinished proposal evidence even when records otherwise need no follow-up',()=>{
  const p=create(),v=record('theme','Evidence',{tool:'manual',id:'e'}),proposal=record('proposal','Option',{tool:'manual',id:'p'},[v.id]);
  p.rounds[0].artifacts.push(v,proposal);reviewRecord(p,v.id,{reviewer:by});reviewRecord(p,proposal.id,{reviewer:by});
  const g=startProgression(p,{proposalRef:proposal.id,rule:'One response and supporter',owner,quorum:1,minSupport:1,by});
  advanceProgression(p,g.id,{stage:'review',reason:'Discuss',evidenceRefs:[v.id],eligible:1,support:1,oppose:0,abstain:0,minorityNote:'No objections recorded; not consensus',by});
  const r=nextRound(p,plan);expect(r.inputs).toContain(v.id);expect(r.inputs).toContain(proposal.id);
  expect(r.artifacts[0].derivedFrom).toContain(v.id);expect(roundReview(p).progressions).toHaveLength(1);
  expect(()=>validateProject(JSON.parse(JSON.stringify(p)))).not.toThrow();
  const revision=reviseRecord(p,proposal.id,'Updated option',by);const subsequent=nextRound(p,plan);
  expect(subsequent.inputs).toContain(proposal.id);expect(subsequent.inputs).toContain(revision.id);
  expect(roundReview(p).progressions[0].attention).toContain('superseded');
});

it('refreshes correction checks after resolution and retains distinct support and review checks',()=>{
  const p=demo('en'),c=p.operations.corrections[0],g=p.operations.progressions[0];
  resolveCorrection(p,c.id,{status:'declined',reason:'Reviewed without change',by});
  reviewRecord(p,g.proposalRef,{reviewer:by,checked:false});
  const r=roundReview(p);expect(r.corrections).toHaveLength(0);expect(r.progressions[0].attention).not.toContain('correction');
  expect(r.progressions[0].attention).toContain('review');expect(r.progressions[0].attention).toContain('support');
});

it('supports legacy projects without operations without declaring completion',()=>{
  const p=create(),r=roundReview(p);expect(r.sessions).toEqual([]);expect(r.corrections).toEqual([]);
  expect(roundReviewSuggestion(r,'en').text).toContain('unresolved');expect(roundReviewView(p,'en')).toContain('No proposal progressions recorded');
  expect(()=>roundReview(p,'missing')).toThrow();
});

it('escapes untrusted text in rendered review and exported Markdown',()=>{
  const p=demo('en'),payload='<img src=x onerror=alert(1)> [click](https://example.com)';
  p.operations.sessions[0].history.at(-1).evaluations[0].note=payload;
  const html=roundReviewView(p,'en'),md=roundReviewMarkdown(p);
  expect(html).not.toContain('<img');expect(html).toContain('&lt;img');expect(md).not.toContain('[click](');expect(md).toContain('\\<img');
});
