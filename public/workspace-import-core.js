// Local, source-preserving imports. File observations never imply remote delivery.
import { importExchange, validateExchange, EXCHANGE_SCHEMA } from './exchange-core.js';
export const IMPORT_SCHEMA = 'delib-workspace-import/v1';
const all = p => p.rounds.flatMap(r => r.artifacts);
const current = p => p.rounds.find(r => r.id === p.view.roundId);
const fail = message => { throw new Error(message); };
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const text = (s,max=200) => typeof s === 'string' && !!s.trim() && s.length <= max;
const sourceKinds = new Set(['statement','answer','opinion','testimony','question']);
export async function readNativeFile(raw,{tool,filename='source.json',simulated=false}={}) {
  if(new TextEncoder().encode(raw).length>3*1024*1024)fail('檔案上限 3 MiB / File limit: 3 MiB');
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  const fileSha256 = Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  const input = tool==='csv'?raw:JSON.parse(raw);
  if(tool==='exchange'&&input?.schema!==EXCHANGE_SCHEMA)fail('請選擇 Delib exchange 檔案 / Choose a Delib exchange file');
  return {fileSha256,bundle:importExchange(input,{tool,filename,sha256:fileSha256,simulated})};
}
function linksFor(p,bundle,transferId) {
  if(!transferId)return [];
  const t=p.transfers?.find(t=>t.id===transferId);
  if(!t||t.roundId!==current(p).id||!t.history.some(h=>['exported','received'].includes(h.state)))fail('請選擇本輪已匯出的交接 / Choose an exported handoff from this round');
  if(bundle.sources.length!==1||bundle.sources[0].tool!==t.tool)fail('檔案與交接工具不符 / File and handoff tools differ');
  const links=[];
  if(t.tool==='tttc')for(const e of bundle.externalSources){
    const source=t.inputs.find(a=>a.id===e.originalId);
    const quotes=bundle.records.filter(r=>r.relations.some(edge=>edge.ref===e.id));
    if(!source||!quotes.length||quotes.some(q=>q.kind!=='quote'||!source.text.includes(q.text)))fail('引文 ID 或文字不符；未接回 / Quote ID or text mismatch; not reconnected');
    links.push({recordId:e.id,workspaceId:source.id});
  }
  if(t.tool==='reply')for(const q of bundle.records.filter(r=>r.kind==='question')){
    const source=t.inputs.find(a=>a.id===q.fields.sourceId);
    if(!source||source.text!==q.text)fail('回覆問題 ID 或原文不符 / Reply question ID or text mismatch');
    links.push({recordId:q.id,workspaceId:source.id});
  }
  if(!links.length)fail('檔案沒有可對照的來源 / No source references to match');
  return links;
}
function projectRecords(entry) {
  const b=entry.bundle,ids=new Map(entry.mappings.map(m=>[m.recordId,m.workspaceId]));
  const links=new Map(entry.sourceLinks.map(m=>[m.recordId,m.workspaceId]));
  const lookup=new Map(b.records.map(r=>[r.id,r])),done=new Set(),ordered=[];
  const walk=r=>{if(done.has(r.id))return;done.add(r.id);for(const e of r.relations)if(lookup.has(e.ref))walk(lookup.get(e.ref));ordered.push(r);};
  b.records.forEach(walk);
  const blocked=new Set(b.externalSources.filter(e=>!links.has(e.id)).map(e=>e.id));
  const result=[];
  for(const r of ordered){
    if(['withdrawn','needs-review'].includes(r.status)||(['theme','reply','quote'].includes(r.kind)&&!r.relations.length)||r.relations.some(e=>blocked.has(e.ref)))blocked.add(r.id);
    const quarantined=blocked.has(r.id),linked=links.has(r.id);
    const eligible=!quarantined&&!linked&&r.origin==='participant'&&r.transferEligible&&sourceKinds.has(r.kind);
    const kind=quarantined?'method-result':linked?'quote':eligible?(r.kind==='question'?'question':'statement'):
      ['theme','proposal','reply','quote'].includes(r.kind)?r.kind:'method-result';
    const relations=r.relations.filter(e=>ids.has(e.ref)||links.has(e.ref)).map(e=>({ref:ids.get(e.ref)||links.get(e.ref),type:e.type==='quotes'?'derived':e.type}));
    if(linked)relations.push({ref:links.get(r.id),type:'derived'});
    result.push({id:ids.get(r.id),kind,text:r.text,source:{tool:'native-import',id:`${entry.id}/${ids.get(r.id)}`},derivedFrom:[...new Set(relations.map(e=>e.ref))],relations,participantRef:null,supersedes:null,
      review:{checked:false,reviewer:'',at:null,quoteConfirmed:false},nativeRef:{importId:entry.id,recordId:r.id},eligible,quarantined});
  }
  return result;
}
export function compareImports(previous,bundle) {
  if(!previous)return null;
  const old=new Map(previous.bundle.records.map(r=>[r.id,r])),next=new Map(bundle.records.map(r=>[r.id,r]));
  return {previousId:previous.id,added:bundle.records.filter(r=>!old.has(r.id)).map(r=>r.id),changed:bundle.records.filter(r=>old.has(r.id)&&!equal(old.get(r.id),r)).map(r=>r.id),absent:previous.bundle.records.filter(r=>!next.has(r.id)).map(r=>r.id),unchanged:bundle.records.filter(r=>equal(old.get(r.id),r)).length};
}
export function planNativeImport(p,{bundle,fileSha256},{transferId=null}={}) {
  validateExchange(bundle);
  if(bundle.simulated!==p.simulated)fail('模擬與真實議題不可混用 / Fictional and real issues must stay separate');
  if(!bundle.records.length)fail('檔案沒有可匯入紀錄 / No records to import');
  if(!/^[a-f0-9]{64}$/.test(fileSha256||''))fail('Missing file SHA-256');
  const scope=b=>b.sources.map(s=>s.id).sort().join('\n');
  // Export timestamps alone do not create another copy of the same source package.
  const content=b=>JSON.stringify([b.sources,b.records,b.externalSources,b.tombstones]);
  const imports=p.imports||[],duplicate=imports.find(i=>i.roundId===current(p).id&&i.transferId===transferId&&content(i.bundle)===content(bundle));
  if(duplicate)fail('這份資料已匯入本輪 / This data is already in this round');
  const previous=imports.filter(i=>scope(i.bundle)===scope(bundle)).at(-1);
  const entry={schema:IMPORT_SCHEMA,id:crypto.randomUUID(),roundId:current(p).id,importedAt:new Date().toISOString(),fileSha256,bundle:structuredClone(bundle),transferId,
    mappings:bundle.records.map(r=>({recordId:r.id,workspaceId:crypto.randomUUID()})),sourceLinks:linksFor(p,bundle,transferId)};
  const records=projectRecords(entry);
  const plan={projectId:p.id,base:JSON.stringify(p),entry,records,comparison:compareImports(previous,bundle)};
  const trial=structuredClone(p);applyNativeImport(trial,plan); // Capacity and mapping failures occur before confirmation.
  const restricted=nativeRestrictions(trial);for(const a of records)if(restricted.withdrawn.has(a.id)){a.eligible=false;a.quarantined=true;}
  return plan;
}
export function applyNativeImport(p,plan) {
  if(p.id!==plan.projectId||JSON.stringify(p)!==plan.base)fail('議題已變更，請重新預覽 / Issue changed; preview again');
  const draft=structuredClone(p),entry=structuredClone(plan.entry),r=current(draft);
  (draft.imports??=[]).push(entry);
  const projected=projectRecords(entry);
  r.artifacts.push(...projected.map(({eligible,quarantined,...a})=>a));
  r.inputs.push(...projected.filter(a=>a.eligible).map(a=>a.id));
  if(all(draft).length>5000||new TextEncoder().encode(JSON.stringify(draft)).length>6*1024*1024)fail('工作區容量不足，未匯入 / Workspace capacity exceeded; nothing imported');
  validateNativeImports(draft);
  Object.assign(p,draft);
  return entry;
}
export function validateNativeImports(p) {
  const imports=p.imports??[],records=all(p),byId=new Map(records.map(a=>[a.id,a]));
  if(!Array.isArray(imports)||imports.length>150)fail('Invalid native imports');
  const seen=new Set(),mapped=new Set();
  for(const i of imports){
    if(!i||i.schema!==IMPORT_SCHEMA||!text(i.id,120)||seen.has(i.id)||!p.rounds.some(r=>r.id===i.roundId)||!Number.isFinite(Date.parse(i.importedAt))||!/^[a-f0-9]{64}$/.test(i.fileSha256)||!Array.isArray(i.mappings)||!Array.isArray(i.sourceLinks)||!(i.transferId===null||text(i.transferId,120)))fail('Invalid native import');
    if(Object.keys(i).some(k=>!['schema','id','roundId','importedAt','fileSha256','bundle','transferId','mappings','sourceLinks'].includes(k)))fail('Unexpected native import fields');
    seen.add(i.id);validateExchange(i.bundle);
    if(i.bundle.simulated!==p.simulated||i.mappings.length!==i.bundle.records.length||new Set(i.mappings.map(m=>m.recordId)).size!==i.mappings.length)fail('Invalid native mapping');
    const sourceScope={...p,view:{...p.view,roundId:i.roundId}};
    if(!equal(i.sourceLinks,linksFor(sourceScope,i.bundle,i.transferId)))fail('Invalid native source links');
    for(const m of i.mappings)if(!i.bundle.records.some(r=>r.id===m.recordId)||!text(m.workspaceId,120)||mapped.has(m.workspaceId))fail('Invalid native record mapping');else mapped.add(m.workspaceId);
    for(const expected of projectRecords(i)){
      const actual=byId.get(expected.id);
      if(!actual||!p.rounds.find(r=>r.id===i.roundId).artifacts.some(a=>a.id===actual.id)||actual.participantRef!==null||actual.supersedes!==null)fail('Missing native record');
      for(const key of ['kind','text','source','derivedFrom','relations','nativeRef'])if(!equal(actual[key],expected[key]))fail('Native snapshot changed; create an explicit revision');
      if(!expected.eligible&&p.rounds.some(r=>r.inputs.includes(actual.id))&&['statement','question','feedback'].includes(actual.kind))fail('Method data cannot become source text');
    }
  }
  for(const a of records)if((a.nativeRef||a.source.tool==='native-import')&&!mapped.has(a.id))fail('Missing native snapshot');
}
export function nativeRecordDetails(p,a) {
  const entry=p.imports?.find(i=>i.id===a.nativeRef?.importId);
  if(!entry)return null;
  const native=entry.bundle.records.find(r=>r.id===a.nativeRef.recordId);
  const state=projectRecords(entry).find(r=>r.id===a.id);
  return {entry,native,quarantined:state.quarantined};
}
// A later file is a new observation, not an automatic edit of an older record.
// Explicit withdrawals remain restrictive across every local import and derivative.
export function nativeRestrictions(p) {
  const newest=new Map(),withdrawnKeys=new Set(),records=all(p),older=new Set(),withdrawn=new Set();
  for(const i of p.imports||[])for(const m of i.mappings){
    newest.set(m.recordId,m.workspaceId);
    const r=i.bundle.records.find(r=>r.id===m.recordId);
    if(['withdrawn','needs-review'].includes(r.status))withdrawnKeys.add(m.recordId);
  }
  for(const a of records)if(a.nativeRef){
    if(newest.get(a.nativeRef.recordId)!==a.id)older.add(a.id);
    if(withdrawnKeys.has(a.nativeRef.recordId))withdrawn.add(a.id);
  }
  let changed=true;while(changed){changed=false;for(const a of records)if(!withdrawn.has(a.id)&&a.derivedFrom.some(id=>withdrawn.has(id))){withdrawn.add(a.id);changed=true;}}
  return {older,withdrawn};
}
