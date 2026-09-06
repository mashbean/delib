import { PHASE_IDS } from './flow-core.js';

export const artifactColumn = a => ({statement:0, question:0, theme:1, proposal:2, reply:3, decision:4, feedback:5})[a.kind] ?? -1;
export function getPipeline(round) {
  const nodes=round.artifacts.filter(a=>artifactColumn(a)>=0).map(a=>({...a,column:artifactColumn(a)}));
  const ids=new Set(nodes.map(n=>n.id));
  const links=nodes.flatMap(a=>a.derivedFrom.filter(id=>ids.has(id)).map(id=>({source:id,target:a.id})));
  return {nodes,links};
}
export function traceArtifact(bundle, id) {
  const artifacts=bundle.rounds.flatMap(r=>r.artifacts),index=new Map(artifacts.map(a=>[a.id,a]));
  if(!index.has(id)) return {ancestors:[],descendants:[]};
  const walk=(start,neighbors)=>{const found=new Set(),queue=[start];while(queue.length){const key=queue.shift();for(const next of neighbors(key)){if(next!==start&&!found.has(next)){found.add(next);queue.push(next);}}}return [...found];};
  return {ancestors:walk(id,key=>index.get(key)?.derivedFrom??[]),descendants:walk(id,key=>artifacts.filter(a=>a.derivedFrom.includes(key)).map(a=>a.id))};
}
export function participationAt(round, phaseIndex) {
  if(phaseIndex<0 || phaseIndex>7)return [];
  const phase=round.phases[phaseIndex];
  return phase.participantRefs.map(id=>{const a=round.attendance.find(a=>a.participantRef===id);return {id,mode:a?.phaseModes?.[phase.id]??a?.mode};});
}
export function participationChange(bundle, roundIndex, phaseIndex) {
  const round=bundle.rounds[roundIndex],current=participationAt(round,phaseIndex);
  const previous=phaseIndex>0?participationAt(round,phaseIndex-1):roundIndex>0?participationAt(bundle.rounds[roundIndex-1],7):[];
  return {current,entered:current.filter(p=>!previous.some(x=>x.id===p.id)),left:previous.filter(p=>!current.some(x=>x.id===p.id)),switched:current.filter(p=>previous.some(x=>x.id===p.id&&x.mode!==p.mode)).map(p=>({...p,from:previous.find(x=>x.id===p.id).mode}))};
}
export function personJourney(bundle, roundIndex, id) {
  return PHASE_IDS.map((phaseId,i)=>({phaseId,mode:participationAt(bundle.rounds[roundIndex],i).find(p=>p.id===id)?.mode??'absent'}));
}
