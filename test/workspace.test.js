import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {createProject,validateProject,projectFromDemo,currentRound,allRecords,activeRecords,addSources,roundSources,sourcesCsv,acceptTttc,acceptReply,reviewRecord,reviseRecord,nextRound,traceVoice,compareRounds} from '../public/workspace-core.js';
import {parseTttcCsv} from '../public/tttc-csv-core.js';
import {participationUrl} from '../public/experience.js';
const setup=()=>createProject({title:'School street',audience:'Residents and caregivers',goal:'Test accessible drop-off',deadline:'2026-12-01',language:'en'});
const csv='id,interview,comment\na,p1,Wheelchair drop-off must remain accessible\nb,p2,Please keep deliveries possible';
describe('a complete repeatable workspace handoff',()=>{
 it('accepts native and in-site participation links while retaining safe activity queries',()=>{
  const stations=JSON.parse(fs.readFileSync('public/data/tool-stations.json','utf8'));
  expect(participationUrl('https://form.mashbean.net/f/abcdefghij',stations,'https://delib.mashbean.net','en')).toBe('https://delib.mashbean.net/form/f/abcdefghij?lang=en');
  expect(participationUrl('https://delib.mashbean.net/form/f/abcdefghij?from=invite',stations,'https://delib.mashbean.net','zh')).toBe('https://delib.mashbean.net/form/f/abcdefghij?from=invite&lang=zh');
  for(const url of ['https://form.mashbean.net/h/abcdefghij','https://form.mashbean.net/f/abcdefghij#admin=secret','https://form.mashbean.net/f/abcdefghij?adminToken=secret','https://unknown.example/f/abcdefghij'])expect(()=>participationUrl(url,stations,'https://delib.mashbean.net','en')).toThrow();
 });
 it('preserves exact source IDs through Form → TTTC → Reply → next round, with human review',()=>{
  const p=setup();addSources(p,csv,'form-abcdefghij');const refs=roundSources(p).map(a=>a.id),sent=parseTttcCsv({text:sourcesCsv(p,refs),label:'handoff'}).rows;
  expect(sent.map(x=>x.id)).toEqual(refs);expect(sent.every(x=>x.interview==='')).toBe(true);
  const tttc={id:'abcdefghij',inputRefs:refs,contextRefs:[]};
  const result={progress:{status:'ready'},tree:{topics:[{name:'Access',subtopics:[{name:'Drop-off',claims:[{id:'claim1',text:'Keep accessible drop-off',quotes:[{commentId:refs[0],text:'Wheelchair drop-off must remain accessible'}]}]}]}]}};
  expect(acceptTttc(p,result,tttc)).toBe(true);const theme=currentRound(p).artifacts.at(-1);expect(theme.review.checked).toBe(false);expect(theme.derivedFrom).toEqual([refs[0]]);
  reviewRecord(p,theme.id,{reviewer:'Facilitator',quoteConfirmed:true});
  const connection={id:'klmnopqrst',inputRefs:refs,contextRefs:[theme.id]};
  expect(acceptReply(p,{progress:{status:'ready'},receipt:{questions:[{qid:'q1',sourceId:refs[0]}],loopbacks:[{qid:'q1',reply:'We will test an accessible drop-off bay.'}]}},connection)).toBe(true);
  const reply=currentRound(p).artifacts.at(-1);expect(reply.review.checked).toBe(false);expect(reply.relations).toEqual([{ref:refs[0],type:'responds'},{ref:theme.id,type:'context'}]);
  expect(traceVoice(p,refs[0]).map(a=>a.id)).toEqual([refs[0],theme.id,reply.id]);
  nextRound(p,{reason:'Check the bay with wheelchair users',owner:'Access team',date:'2026-12-10',phase:'deliberate'});expect(currentRound(p).step).toBe(1);expect(currentRound(p).inputs).toContain(reply.id);expect(p.rounds[0].next.owner).toBe('Access team');expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
 });
 it('is idempotent for service result refresh and retains source revisions',()=>{
  const p=setup();addSources(p,csv,'same');const first=allRecords(p)[0];expect(addSources(p,csv,'same').added).toHaveLength(0);
  addSources(p,csv.replace('remain accessible','be widened'),'same');expect(allRecords(p)).toHaveLength(3);expect(activeRecords(p)).toHaveLength(2);expect(allRecords(p).at(-1).supersedes).toBe(first.id);expect(first.text).toContain('remain accessible');
  const refs=roundSources(p).map(a=>a.id),c={id:'abcdefghij',inputRefs:refs,contextRefs:[]},r={progress:{status:'ready'},tree:{topics:[{name:'T',subtopics:[{name:'S',claims:[{id:'c',text:'A claim',quotes:[{commentId:refs[0]}]}]}]}]}};
  acceptTttc(p,r,c);acceptTttc(p,r,c);expect(allRecords(p).filter(a=>a.kind==='theme')).toHaveLength(1);
 });
 it('does not re-send source rows removed from a refreshed Form, while retaining the local archive',()=>{
  const p=setup();addSources(p,csv,'same');addSources(p,'id,interview,comment\nb,p2,Please keep deliveries possible','same',{reconcile:true});expect(roundSources(p)).toHaveLength(1);expect(allRecords(p)).toHaveLength(2);
 });
 it('rejects unknown model references transactionally instead of inventing provenance',()=>{
  const p=setup();addSources(p,csv,'a');const count=allRecords(p).length,refs=roundSources(p).map(a=>a.id);
  expect(()=>acceptTttc(p,{progress:{status:'ready'},tree:{topics:[{subtopics:[{claims:[{id:'a',text:'Valid claim',quotes:[{commentId:refs[0]}]},{id:'b',text:'Invalid',quotes:[{commentId:'missing'}]}]}]}]}},{id:'abcdefghij',inputRefs:refs})).toThrow(/Unmatched/);expect(allRecords(p)).toHaveLength(count);
  expect(()=>acceptReply(p,{progress:{status:'ready'},receipt:{questions:[{qid:'x',sourceId:'missing'}],loopbacks:[{qid:'x',reply:'x'}]}},{id:'abcdefghij',inputRefs:refs})).toThrow(/mismatch/);
 });
 it('records revisions and human review separately from speaker confirmation',()=>{
  const p=setup();addSources(p,csv,'a');const a=allRecords(p)[0];reviewRecord(p,a.id,{reviewer:'Host'});expect(a.review.quoteConfirmed).toBe(false);const b=reviseRecord(p,a.id,'Wider drop-off area','Editor');expect(a.text).toContain('Wheelchair');expect(b.review.checked).toBe(false);expect(b.relations).toEqual([{ref:a.id,type:'revises'}]);expect(p.events.map(e=>e.type)).toEqual(['review','revision']);
 });
 it('restores the bilingual fictional example without allowing inferred real-person matching',()=>{
  const b=JSON.parse(fs.readFileSync('public/data/flow-demo.json','utf8'));for(const lang of ['zh','en']){const p=projectFromDemo(b,lang);expect(allRecords(p)).toHaveLength(99);p.view.roundId=p.rounds[1].id;expect(compareRounds(p).newSources.length).toBeGreaterThan(0);p.simulated=false;expect(compareRounds(p).joined).toBeNull();expect(validateProject(p)).toBe(p);}
 });
 it('rejects broken sources, future references and management credentials in imported backups',()=>{
  const p=setup();addSources(p,csv,'a');const a=allRecords(p)[0];a.derivedFrom=['future'];expect(()=>validateProject(p)).toThrow(/provenance/);a.derivedFrom=[];p.token='not-a-project-field';expect(()=>validateProject(p)).toThrow(/credentials/);
 });
});
