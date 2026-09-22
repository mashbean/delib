import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {buildPublicReplay} from '../public/public-replay-core.js';
import {validateProject,allRecords,roundSources,traceVoice} from '../public/workspace-core.js';
import {parseTttcCsv} from '../public/tttc-csv-core.js';
import {validateExchange} from '../public/exchange-core.js';
const data=JSON.parse(readFileSync(new URL('../public/data/uberx-replay.json',import.meta.url),'utf8'));
describe('attributed public-data rehearsal',()=>{
 it.each(['zh','en'])('runs all stages through real contracts in %s without service state fabrication',async lang=>{
  const sizes=[12,12,21,21,33,34];
  for(let stage=0;stage<6;stage++){
   const {project:p,files}=await buildPublicReplay(data,lang,stage);
   expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
   expect(p.simulated).toBe(true);expect(allRecords(p)).toHaveLength(sizes[stage]);
   expect(allRecords(p).every(a=>a.participantRef===null)).toBe(true);
   for(const t of p.transfers||[])expect(t.history.map(h=>h.state)).toEqual(['prepared','exported']);
   for(const i of p.imports||[])expect(validateExchange(i.bundle)).toBe(i.bundle);
   if(files.tttc){const rows=parseTttcCsv({text:files.tttc.destinationPayload.csv}).rows;expect(rows.map(r=>r.comment)).toEqual(data.records.map(r=>r.text));expect(rows.every(r=>!r.interview)).toBe(true);}
   expect(JSON.stringify(p)).not.toMatch(/author-id|adminToken/);
   if(stage>=4){const voice=allRecords(p).find(a=>a.kind==='statement');expect(traceVoice(p,voice.id).some(a=>a.kind==='reply')).toBe(true);expect(allRecords(p).filter(a=>a.kind==='reply').every(a=>!a.review.checked&&!a.commitments)).toBe(true);}
   if(stage===5){expect(p.rounds).toHaveLength(2);expect(p.rounds[0].next.carryForwardRefs.length).toBeGreaterThan(0);}
  }
 });
 it('retains conflicting definitions and historical counts separately',async()=>{
  const {project:p}=await buildPublicReplay(data,'en',2);
  expect(data.selection).toEqual([3,4,7,8,12,17]);expect(data.sourceRows).toBe(197);
  expect(roundSources(p)).toHaveLength(6);expect(allRecords(p).filter(a=>a.source.tool==='public-polis-counts').map(a=>a.methodData.agree)).toEqual(data.records.map(r=>r.agree));expect(allRecords(p).filter(a=>a.source.tool==='public-polis-counts')).toHaveLength(6);
  const sources=allRecords(p).filter(a=>a.kind==='statement');expect(sources.map(a=>a.text)).toEqual(data.records.map(r=>r.text));
  expect(sources.every(a=>a.sourceEvidence.origin.includes('unknown'))).toBe(true);
  expect(allRecords(p).filter(a=>a.kind==='theme').some(a=>a.text.includes('Conflicting'))).toBe(true);
 });
 it('fails closed on missing source data or invalid stage',async()=>{
  await expect(buildPublicReplay({...data,records:[]},'zh',0)).rejects.toThrow();
  await expect(buildPublicReplay(data,'zh',6)).rejects.toThrow();
 });
});

it('keeps IDs stable across step downloads so separately downloaded files can reconnect',async()=>{
 const {buildPublicReplaySequence}=await import('../public/public-replay-core.js');
 const {readNativeFile,planNativeImport}=await import('../public/workspace-import-core.js');
 const sequence=await buildPublicReplaySequence(data,'en');expect(sequence).toHaveLength(6);
 expect(new Set(sequence.map(s=>s.project.id)).size).toBe(1);
 const exported=sequence[1],later=sequence[2];
 const incoming=await readNativeFile(JSON.stringify(later.files.tttcResult),{tool:'tttc',simulated:true});
 const plan=planNativeImport(exported.project,incoming,{transferId:exported.project.transfers[0].id});
 expect(plan.entry.sourceLinks).toHaveLength(6);
 const replyPlan=planNativeImport(sequence[3].project,await readNativeFile(JSON.stringify(sequence[4].files.replyResult),{tool:'reply',simulated:true}),{transferId:sequence[3].project.transfers.at(-1).id});
 expect(replyPlan.entry.sourceLinks).toHaveLength(6);
});
