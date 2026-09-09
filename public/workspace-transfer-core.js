// Delib-specific mapping, not a Metagov ontology or remote publication protocol.
import { tttcRowsToCsv, parseTttcCsv } from './tttc-csv-core.js';
import { openParticipation, roundFollowups, latest } from './facilitation-core.js';
export const TRANSFER_SCHEMA = 'delib-workspace-transfer/v1';
export const transferStates = ['prepared','exported','submitted','received','completed','reconnected','uncertain','failed'];
const transitions = {prepared:['exported','submitted'],exported:[],submitted:['received','uncertain','failed'],received:['completed','failed'],completed:['reconnected'],reconnected:[],uncertain:[],failed:[]};
const all = p => p.rounds.flatMap(r => r.artifacts);
const round = p => p.rounds.find(r => r.id === p.view.roundId);
const date = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
const text = (v,max=12000) => typeof v === 'string' && !!v.trim() && v.length <= max;
const snapshot = a => ({id:a.id,kind:a.kind,text:a.text,source:{tool:a.source.tool,id:a.source.id},reviewed:a.review.checked,relations:structuredClone(a.relations),supersedes:a.supersedes});
export function transferCandidates(p) {
  const r=round(p),records=all(p),old=new Set(records.map(a=>a.supersedes).filter(Boolean)),scope=new Set([...r.inputs,...r.artifacts.map(a=>a.id)]);
  const active=records.filter(a=>scope.has(a.id)&&!old.has(a.id));
  return {sources:active.filter(a=>r.inputs.includes(a.id)&&['statement','question','feedback'].includes(a.kind)),context:active.filter(a=>['theme','proposal'].includes(a.kind)&&a.review.checked)};
}
export function planTransfer(p,{tool='tttc',refs,contextRefs}={}) {
  if(!['tttc','reply'].includes(tool))throw new Error('不支援這個目的地 / Unsupported destination');
  const candidates=transferCandidates(p),choose=(items,ids)=>{
    const keys=ids??items.map(a=>a.id);
    if(new Set(keys).size!==keys.length||keys.some(id=>!items.some(a=>a.id===id)))throw new Error('來源已變更，請重新選擇 / Sources changed; select again');
    return keys.map(id=>snapshot(items.find(a=>a.id===id)));
  };
  const inputs=choose(candidates.sources,refs),context=tool==='reply'?choose(candidates.context,contextRefs):[];
  if(!inputs.length)throw new Error('請選擇至少一則原話 / Select at least one source');
  if(inputs.length>(tool==='reply'?400:600)||inputs.some(a=>a.text.length>2000))throw new Error('超過目的工具限制，不自動截斷 / Destination limit exceeded; no truncation');
  if(tool==='reply'&&!context.length)throw new Error('請先檢查至少一筆主題 / Review at least one theme first');
  const positions=context.map(a=>a.text).join('\n\n');
  if(positions.length>6000)throw new Error('參考主題超過 6,000 字 / Context exceeds 6,000 characters');
  return {schema:TRANSFER_SCHEMA,mappingVersion:'workspace-text/1',roundId:round(p).id,tool,simulated:p.simulated,
    context:{title:p.title,goal:p.goal,audience:p.audience,deadline:p.deadline,language:p.language},inputs,annotations:context};
}
export function transferCsv(plan){return tttcRowsToCsv(plan.inputs.map(a=>({id:a.id,interview:'',comment:a.text})));}
export function assertCurrentPlan(p,plan) {
  if(p.simulated!==plan.simulated||round(p).id!==plan.roundId||JSON.stringify(planTransfer(p,{tool:plan.tool,refs:plan.inputs.map(a=>a.id),contextRefs:plan.annotations.map(a=>a.id)}))!==JSON.stringify(plan))throw new Error('交接內容已變更，請重新預覽 / Handoff changed; preview again');
}
export function addTransfer(p,plan,{id=crypto.randomUUID(),at=new Date().toISOString()}={}) {
  assertCurrentPlan(p,plan);
  if((p.transfers||[]).some(t=>t.id===id))throw new Error('Duplicate transfer');
  const t={...structuredClone(plan),id,private:true,history:[{state:'prepared',at}],outputRefs:[]};
  (p.transfers??=[]).push(t);return t;
}
export function advanceTransfer(t,state,{at=new Date().toISOString(),activityId,outputRefs}={}) {
  const prev=t.history.at(-1);
  if(!transitions[prev.state]?.includes(state)||!date(at)||Date.parse(at)<Date.parse(prev.at))throw new Error('Invalid transfer transition');
  if(state==='received'&&!/^[a-z0-9]{10}$/.test(activityId||''))throw new Error('Missing destination receipt');
  if(state==='reconnected'&&(!Array.isArray(outputRefs)||!outputRefs.length))throw new Error('Missing reconnected records');
  t.history.push({state,at});if(activityId)t.activityId=activityId;if(outputRefs)t.outputRefs=[...new Set(outputRefs)];
}
export function observeTransfer(p,tool,connection,status) {
  if(!connection.transferId)return; // No retroactive success claims for legacy activities.
  const t=p.transfers?.find(t=>t.id===connection.transferId);if(!t)return;
  const state=t.history.at(-1).state;
  if(status==='reviewed'&&['received','completed'].includes(state)) {
    const outputs=all(p).filter(a=>a.source.tool===tool&&a.source.id.startsWith(`${connection.id}/`)).map(a=>a.id);
    if(state==='received')advanceTransfer(t,'completed');
    advanceTransfer(t,'reconnected',{outputRefs:outputs});
  } else if(['failed','deleted'].includes(status)&&state==='received')advanceTransfer(t,'failed');
}
export function exportTransfer(t){
  // This is a private companion; source ownership and identity remain in the private project.
  const bundled=new Set([...t.inputs,...t.annotations].map(a=>a.id));
  const externalRefs=[...new Set([...t.inputs,...t.annotations].flatMap(a=>a.relations.map(e=>e.ref)).filter(id=>!bundled.has(id)))];
  return {schema:'delib-workspace-transfer-export/v1',private:true,simulated:t.simulated,transfer:structuredClone(t),externalRefs,destinationPayload:{csv:transferCsv(t),...(t.tool==='reply'?{positions:t.annotations.map(a=>a.text).join('\n\n')}:{})},destinationReads:{sourceColumns:['id','interview (empty)','comment'],context:t.tool==='reply'?'Reviewed theme text in positions':'None'},
    staysLocal:['audience','deadline','source provenance','relations','review status','dispositions','commitments','participation gaps'],excluded:['participant identity','credentials','votes'],
    notice:'CSV export is not delivery. The companion is not automatically read by the destination. No consent, consensus or remote deletion is inferred.'};
}
export function sourceWarnings(plan){return parseTttcCsv({text:transferCsv(plan),label:'handoff'}).warnings;}
export function validateTransfers(p) {
  if(p.transfers===undefined){if(p.rounds.some(r=>Object.values(r.connections).some(c=>c.transferId)))throw new Error('Missing transfer history');return;}
  if(!Array.isArray(p.transfers)||p.transfers.length>300)throw new Error('Invalid transfer history');
  const ids=new Set(),records=new Map(all(p).map(a=>[a.id,a]));
  for(const t of p.transfers) {
    const r=p.rounds.find(r=>r.id===t.roundId);
    if(!t||t.schema!==TRANSFER_SCHEMA||t.mappingVersion!=='workspace-text/1'||!text(t.id,120)||ids.has(t.id)||!r||t.private!==true||t.simulated!==p.simulated||!['tttc','reply'].includes(t.tool)||!t.context||!text(t.context.title,120)||!text(t.context.goal,1000)||typeof t.context.audience!=='string'||typeof t.context.deadline!=='string'||!['en','zh'].includes(t.context.language))throw new Error('Invalid transfer');
    ids.add(t.id);
    const allowed=['schema','mappingVersion','roundId','tool','simulated','context','inputs','annotations','id','private','history','outputRefs','activityId'];
    if(Object.keys(t).some(k=>!allowed.includes(k))||Object.keys(t.context).some(k=>!['title','goal','audience','deadline','language'].includes(k)))throw new Error('Unexpected transfer fields');
    if(!Array.isArray(t.inputs)||!t.inputs.length||t.inputs.length>(t.tool==='reply'?400:600)||!Array.isArray(t.annotations)||t.annotations.length>5000||!Array.isArray(t.outputRefs)||t.outputRefs.some(id=>!records.has(id)))throw new Error('Invalid transfer references');
    const seen=new Set();
    for(const [items,kinds] of [[t.inputs,['statement','question','feedback']],[t.annotations,['theme','proposal']]])for(const s of items){
      const a=records.get(s.id);
      if(!a||seen.has(s.id)||!kinds.includes(s.kind)||s.kind!==a.kind||!text(s.text,items===t.inputs?2000:12000)||s.text!==a.text||JSON.stringify(s.source)!==JSON.stringify(a.source)||JSON.stringify(s.relations)!==JSON.stringify(a.relations)||s.supersedes!==a.supersedes||typeof s.reviewed!=='boolean'||Object.keys(s).some(k=>!['id','kind','text','source','reviewed','relations','supersedes'].includes(k)))throw new Error('Invalid transfer snapshot');
      seen.add(s.id);
    }
    if(t.annotations.map(a=>a.text).join('\n\n').length>6000)throw new Error('Context limit exceeded');
    if((t.tool==='tttc'&&t.annotations.length)||(t.tool==='reply'&&(!t.annotations.length||t.annotations.some(a=>!a.reviewed))))throw new Error('Invalid transfer context');
    if(!Array.isArray(t.history)||!t.history.length||t.history.length>8||t.history[0].state!=='prepared')throw new Error('Invalid transfer states');
    t.history.forEach((h,i)=>{if(Object.keys(h).some(k=>!['state','at'].includes(k))||!date(h.at)||(i&&(!transitions[t.history[i-1].state]?.includes(h.state)||Date.parse(h.at)<Date.parse(t.history[i-1].at))))throw new Error('Invalid transfer transition');});
    if(t.history.some(h=>h.state==='received')&&!/^[a-z0-9]{10}$/.test(t.activityId||''))throw new Error('Missing receipt');
    if(t.history.at(-1).state==='reconnected'&&!t.outputRefs.length)throw new Error('Missing result references');
    if(t.outputRefs.some(id=>{const a=records.get(id);return a.source.tool!==t.tool||!a.source.id.startsWith(`${t.activityId}/`)||!a.derivedFrom.some(ref=>t.inputs.some(s=>s.id===ref));}))throw new Error('Result provenance mismatch');
    if(t.history.some(h=>h.state==='exported')&&t.history.length!==2)throw new Error('Export is not delivery');
  }
  for(const r of p.rounds)for(const [tool,c] of Object.entries(r.connections))if(c.transferId){const t=p.transfers.find(t=>t.id===c.transferId);if(!t||t.roundId!==r.id||t.tool!==tool||t.activityId!==c.id||JSON.stringify(c.inputRefs)!==JSON.stringify(t.inputs.map(a=>a.id))||JSON.stringify(c.contextRefs)!==JSON.stringify(t.annotations.map(a=>a.id)))throw new Error('Transfer connection mismatch');}
}
export function nextStepAdvice(p){
  const r=round(p),gaps=openParticipation(r),open=roundFollowups(p,r);
  if(gaps.length)return {phase:'recruit',kind:'participation',count:gaps.length,refs:gaps.map(g=>g.id)};
  const unchecked=open.filter(a=>!a.review.checked);if(unchecked.length)return {phase:'learn',kind:'review',count:unchecked.length,refs:unchecked.map(a=>a.id)};
  const commitments=open.filter(a=>latest(a.commitments)&&latest(a.commitments).status!=='closed');if(commitments.length)return {phase:'respond',kind:'commitment',count:commitments.length,refs:commitments.map(a=>a.id)};
  return {phase:'deliberate',kind:'open',count:open.length,refs:open.map(a=>a.id)};
}

export function recoverInterruptedTransfers(p){let changed=false;for(const t of p.transfers||[])if(t.history.at(-1).state==='submitted'){advanceTransfer(t,'uncertain');changed=true;}return changed;}

export function validateVoiceTransfers(data){
  if(data.transfers===undefined)return;
  if(!Array.isArray(data.transfers)||data.transfers.length>300)throw new Error('Invalid voice transfers');
  const refs=new Set(data.records.map(a=>a.id)),ids=new Set();
  for(const t of data.transfers){if(!t||!text(t.id,120)||ids.has(t.id)||!['tttc','reply'].includes(t.tool)||!Array.isArray(t.recordRefs)||!t.recordRefs.length||t.recordRefs.some(id=>!refs.has(id))||!Array.isArray(t.history)||!t.history.length||t.history.length>8||t.history[0].state!=='prepared'||Object.keys(t).some(k=>!['id','tool','history','recordRefs'].includes(k)))throw new Error('Invalid voice transfer');ids.add(t.id);t.history.forEach((h,i)=>{if(!date(h.at)||!transferStates.includes(h.state)||(i&&!transitions[t.history[i-1].state]?.includes(h.state)))throw new Error('Invalid voice transfer state');});}
}
