import {traceVoice} from './workspace-core.js';
import {nativeRestrictions} from './workspace-import-core.js';
export const flowStage=kind=>['statement','question','feedback','inclusion-check'].includes(kind)?0:['theme','proposal','quote','method-result'].includes(kind)?1:kind==='reply'?2:3;
export function workspaceFlow(p,{voiceId='',limit=160}={}){
 const all=p.rounds.flatMap(r=>r.artifacts),r=p.rounds.find(r=>r.id===p.view.roundId),index=new Map(all.map(a=>[a.id,a]));
 if(voiceId&&!index.has(voiceId))throw new Error('Unknown voice');
 const restricted=nativeRestrictions(p),old=new Set(all.map(a=>a.supersedes).filter(Boolean));
 const scope=voiceId?new Set(traceVoice(p,voiceId).map(a=>a.id)):new Set([...r.inputs,...r.artifacts.map(a=>a.id)]);
 const candidates=all.filter(a=>scope.has(a.id)),visible=candidates.slice(0,limit),ids=new Set(visible.map(a=>a.id));
 const nodes=visible.map(a=>({id:a.id,recordId:a.id,kind:a.kind,stage:flowStage(a.kind),roundId:p.rounds.find(r=>r.artifacts.some(x=>x.id===a.id)).id,setting:a.settingHistory?.at(-1)?.setting||'unknown',text:a.text,reviewed:a.review.checked,restricted:restricted.withdrawn.has(a.id),older:old.has(a.id)||restricted.older.has(a.id)}));
 const edges=[];
 for(const a of visible)for(const ref of a.derivedFrom)if(ids.has(ref)){
  const type=a.relations.find(e=>e.ref===ref)?.type||'derived';if(!voiceId||type!=='context')edges.push({from:ref,to:a.id,type,replay:type!=='context'&&!restricted.withdrawn.has(ref)&&!restricted.withdrawn.has(a.id)});
 }
 const transfers=(p.transfers||[]).filter(t=>voiceId?t.inputs.some(a=>scope.has(a.id)):t.roundId===r.id).map(t=>({id:t.id,tool:t.tool,state:t.history.at(-1).state,history:t.history,inputs:t.inputs.length,outputs:t.outputRefs.length}));
 for(const t of (p.transfers||[]).filter(t=>transfers.some(x=>x.id===t.id))){
  const id=`transfer:${t.id}`,state=t.history.at(-1).state;
  nodes.push({id,transferId:t.id,kind:'transfer',text:t.tool.toUpperCase(),stage:t.tool==='tttc'?.65:1.65,roundId:t.roundId,setting:'unknown',state});
  for(const a of t.inputs)if(ids.has(a.id))edges.push({from:a.id,to:id,type:state==='prepared'?'prepared':'handoff',replay:['received','completed','reconnected'].includes(state)&&!restricted.withdrawn.has(a.id)});
  if(state==='reconnected')for(const to of t.outputRefs)if(ids.has(to))edges.push({from:id,to,type:'reconnected',replay:!restricted.withdrawn.has(to)});
 }
 // Explicit round inputs are carry records, not new remote transfers.
 const carry=voiceId?p.rounds.flatMap(round=>round.inputs.filter(id=>ids.has(id)&&!round.artifacts.some(a=>a.id===id)).map(id=>({recordId:id,roundId:round.id}))):[];
 return {nodes,edges,transfers,carry,omitted:candidates.length-visible.length,rounds:p.rounds.map(r=>({id:r.id,title:r.title})),voiceId,simulated:p.simulated};
}
