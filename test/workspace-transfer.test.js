import { voiceTrailExport } from '../public/facilitation-core.js';
import { describe,it,expect } from 'vitest';
import { createProject,addSources,currentRound,allRecords,record,reviewRecord,reviseRecord,validateProject,nextRound,acceptTttc,acceptReply,traceVoice } from '../public/workspace-core.js';
import { planTransfer,transferCsv,addTransfer,advanceTransfer,assertCurrentPlan,exportTransfer,observeTransfer,nextStepAdvice,recoverInterruptedTransfers,validateVoiceTransfers } from '../public/workspace-transfer-core.js';
const setup=()=>{const p=createProject({title:'School street',audience:'Caregivers',goal:'Keep access safe',deadline:'2026-12-01',language:'en'});addSources(p,'id,interview,comment\na,private-person,Keep accessible drop-off\nb,,Leave deliveries possible','source');return p;};
describe('versioned workspace handoffs',()=>{
 it('keeps old backups valid and exports a scoped, identity-free companion',()=>{
  const p=setup();expect(validateProject(p)).toBe(p);const plan=planTransfer(p,{refs:[allRecords(p)[0].id]});const t=addTransfer(p,plan);advanceTransfer(t,'exported');
  const out=exportTransfer(t);expect(out.transfer.inputs).toHaveLength(1);expect(out.transfer.context.audience).toBe('Caregivers');expect(JSON.stringify(out)).not.toContain('private-person');expect(out.destinationPayload.csv).toBe(transferCsv(plan));expect(out.transfer.history.at(-1).state).toBe('exported');expect(()=>advanceTransfer(t,'received',{activityId:'abcdefghij'})).toThrow();expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
 });
 it('rejects stale previews, removed sources and duplicate selection, preserving historical snapshots across revisions',()=>{
  const p=setup(),plan=planTransfer(p),t=addTransfer(p,plan);advanceTransfer(t,'exported');reviseRecord(p,plan.inputs[0].id,'Widen the accessible drop-off bay','Host');expect(()=>assertCurrentPlan(p,plan)).toThrow();expect(validateProject(p)).toBe(p);expect(t.inputs[0].text).toBe('Keep accessible drop-off');expect(()=>planTransfer(p,{refs:[plan.inputs[1].id,plan.inputs[1].id]})).toThrow();
  const fresh=planTransfer(p);p.goal='Different purpose';expect(()=>assertCurrentPlan(p,fresh)).toThrow();
 });
 it('does not pass themes to TTTC or infer reviewed themes for Reply',()=>{
  const p=setup();expect(()=>planTransfer(p,{tool:'reply'})).toThrow(/Review/);const a=record('theme','Access matters',{tool:'facilitator',id:'theme'},[allRecords(p)[0].id]);currentRound(p).artifacts.push(a);reviewRecord(p,a.id,{reviewer:'Host'});
  expect(planTransfer(p).annotations).toEqual([]);const plan=planTransfer(p,{tool:'reply'});expect(plan.annotations.map(a=>a.id)).toEqual([a.id]);reviewRecord(p,a.id,{reviewer:'Host',checked:false});expect(()=>assertCurrentPlan(p,plan)).toThrow();
 });
 it('records actual receipt and exact result references without duplicate transitions',()=>{
  const p=setup(),t=addTransfer(p,planTransfer(p));advanceTransfer(t,'submitted');advanceTransfer(t,'received',{activityId:'abcdefghij'});
  const c={id:'abcdefghij',inputRefs:t.inputs.map(a=>a.id),contextRefs:[],transferId:t.id};currentRound(p).connections.tttc=c;
  acceptTttc(p,{progress:{status:'ready'},tree:{topics:[{name:'Access',subtopics:[{name:'Access',claims:[{id:'c1',text:'Keep access',quotes:[{commentId:t.inputs[0].id}]}]}]}]}},c);
  observeTransfer(p,'tttc',c,'reviewed');observeTransfer(p,'tttc',c,'reviewed');expect(t.history.map(h=>h.state)).toEqual(['prepared','submitted','received','completed','reconnected']);expect(t.outputRefs).toEqual([allRecords(p).at(-1).id]);expect(validateProject(p)).toBe(p);
  nextRound(p,{reason:'Test the bay',owner:'Host',date:'2026-12-02',phase:'deliberate'});expect(validateProject(p)).toBe(p);
 });
 it('leaves uncertain creation explicit; polling a legacy connection never fabricates a receipt',()=>{
  const p=setup(),t=addTransfer(p,planTransfer(p));advanceTransfer(t,'submitted');advanceTransfer(t,'uncertain');expect(()=>advanceTransfer(t,'submitted')).toThrow();observeTransfer(p,'tttc',{id:'abcdefghij'},'reviewed');expect(p.transfers).toHaveLength(1);expect(validateProject(p)).toBe(p);
 });
 it('rejects tampered snapshots, connection maps and invented completion in backups',()=>{
  const p=setup(),t=addTransfer(p,planTransfer(p));t.inputs[0].text='Altered';expect(()=>validateProject(p)).toThrow(/snapshot/);t.inputs[0].text=allRecords(p)[0].text;t.history.push({state:'reconnected',at:new Date().toISOString()});expect(()=>validateProject(p)).toThrow();
 });
 it('recovers an interrupted submit without guessing remote delivery',()=>{const p=setup(),t=addTransfer(p,planTransfer(p));advanceTransfer(t,'submitted');expect(recoverInterruptedTransfers(p)).toBe(true);expect(t.history.at(-1).state).toBe('uncertain');expect(recoverInterruptedTransfers(p)).toBe(false);expect(validateProject(p)).toBe(p);});
 it('rejects undocumented identity fields in imported companions',()=>{const p=setup(),t=addTransfer(p,planTransfer(p));t.participantId='private';expect(()=>validateProject(p)).toThrow(/Unexpected/);delete t.participantId;t.context.email='private';expect(()=>validateProject(p)).toThrow(/Unexpected/);});
 it('does not accept a quote which contradicts its referenced source',()=>{const p=setup(),ids=allRecords(p).map(a=>a.id);expect(()=>acceptTttc(p,{progress:{status:'ready'},tree:{topics:[{subtopics:[{claims:[{id:'bad',text:'Summary',quotes:[{commentId:ids[0],text:'Everyone agrees to remove access'}]}]}]}]}},{id:'abcdefghij',inputRefs:ids,contextRefs:[]})).toThrow(/Quote/);expect(allRecords(p)).toHaveLength(2);});
 it('keeps a shared background theme from pulling another person’s reply into a voice trail',()=>{
  const p=setup(),refs=allRecords(p).map(a=>a.id),theme=record('theme','Shared background',{tool:'facilitator',id:'theme'},refs);currentRound(p).artifacts.push(theme);
  acceptReply(p,{progress:{status:'ready'},receipt:{questions:[{qid:'one',sourceId:refs[0]},{qid:'two',sourceId:refs[1]}],loopbacks:[{qid:'one',reply:'Your accessible bay'},{qid:'two',reply:'Your delivery window'}]}},{id:'abcdefghij',inputRefs:refs,contextRefs:[theme.id]});
  expect(traceVoice(p,refs[0]).map(a=>a.text)).toEqual(['Keep accessible drop-off','Shared background','Your accessible bay']);
 });
 it('exports participant-facing transfer progress without unrelated source snapshots',()=>{const p=setup(),t=addTransfer(p,planTransfer(p));advanceTransfer(t,'exported');const trail=voiceTrailExport(p,[allRecords(p)[0]]);expect(trail.transfers).toHaveLength(1);expect(trail.transfers[0].recordRefs).toEqual([allRecords(p)[0].id]);expect(JSON.stringify(trail.transfers)).not.toContain('Leave deliveries possible');expect(()=>validateVoiceTransfers(trail)).not.toThrow();trail.transfers[0].recordRefs.push('another-person');expect(()=>validateVoiceTransfers(trail)).toThrow();});
 it('suggests source review from evidence without marking anything complete',()=>{const p=setup(),before=JSON.stringify(p),a=nextStepAdvice(p);expect(a.phase).toBe('learn');expect(a.count).toBe(2);expect(JSON.stringify(p)).toBe(before);});
});
