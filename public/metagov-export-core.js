import {validateProject} from './workspace-core.js';
import {nativeRestrictions} from './workspace-import-core.js';
import {currentMetagovMapping} from './metagov-mapping-core.js';
import {METAGOV_REVISION} from './metagov-readiness-core.js';
import validateStatement from './vendor/metagov-statement-validator.js';
const digest=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function mappedRecordId(namespace,id){const h=await digest(JSON.stringify([namespace,'statement',id]));return `${h.slice(0,8)}-${h.slice(8,12)}-8${h.slice(13,16)}-${(8+(parseInt(h[16],16)&3)).toString(16)}${h.slice(17,20)}-${h.slice(20,32)}`;}
export function exportableMetagovRecords(p){
 const all=p.rounds.flatMap(r=>r.artifacts),restrictions=nativeRestrictions(p),superseded=new Set(all.map(a=>a.supersedes).filter(Boolean));
 return all.map(a=>({record:a,status:restrictions.withdrawn.has(a.id)?'withdrawn':restrictions.older.has(a.id)||superseded.has(a.id)?'older':a.quarantined?'unresolved':['method-result','inclusion-check'].includes(a.kind)?'not-statement':!a.metagovHistory?.length?'unmapped':!currentMetagovMapping(a)?'stale':'ready'}));
}
const fingerprint=p=>digest(JSON.stringify({id:p.id,title:p.title,simulated:p.simulated,rounds:p.rounds,metagov:p.metagov,imports:p.imports,transfers:p.transfers}));
export async function prepareMetagovExport(project,refs){
 validateProject(project);const p=structuredClone(project);
 if(!Array.isArray(refs)||!refs.length||refs.length>200||new Set(refs).size!==refs.length)throw new Error('請選擇 1–200 筆紀錄 / Select 1–200 distinct records');
 const choices=exportableMetagovRecords(p),selected=refs.map(id=>choices.find(x=>x.record.id===id));
 if(selected.some(x=>!x||x.status!=='ready'))throw new Error('包含未確認、已變更、撤回或舊版紀錄 / Selection contains unconfirmed, changed, withdrawn or older records');
 const records=selected.map(x=>x.record),needed=[...new Set(records.flatMap(a=>[a.id,...a.derivedFrom]))];
 const pairs=await Promise.all(needed.map(async id=>[id,await mappedRecordId(p.metagov.namespace,id)]));const ids=new Map(pairs);
 if(new Set(ids.values()).size!==ids.size)throw new Error('UUID collision');
 const actors=new Map(p.metagov.actors.map(a=>[a.id,a]));const used=new Set();
 const generator=id=>{const a=actors.get(id);used.add(id);return a.kind==='Algorithm'?{Algorithm:{id:a.id,kind:a.algorithmKind,metadata:{}}}:{[a.kind]:a.id};};
 const notices=[],statements=records.map(a=>{
  const m=currentMetagovMapping(a),responses=a.relations.filter(r=>r.type==='responds'),target=responses.length===1&&refs.includes(responses[0].ref)?ids.get(responses[0].ref):null;
  if(a.derivedFrom.length&&(!target||a.derivedFrom.length>1||a.relations.some(r=>r.type!=='responds')))notices.push({recordId:a.id,code:'relations-in-companion',sourceLinks:a.derivedFrom.length});
  const statement={id:ids.get(a.id),content:a.text,role:m.role,made_by:generator(m.madeBy),role_classified_by:generator(m.classifiedBy),in_response_to:target};
  if(!validateStatement(statement))throw new Error(`Statement schema validation failed: ${JSON.stringify(validateStatement.errors)}`);return statement;
 });
 for(const a of records)for(const m of a.metagovHistory||[]){used.add(m.madeBy);used.add(m.classifiedBy);}
 const nativeJson=JSON.stringify(statements,null,2),nativeSha256=await digest(nativeJson);
 const companion={schema:'delib-metagov-companion/v1',targetRevision:METAGOV_REVISION,namespace:p.metagov.namespace,simulated:p.simulated,nativeSha256,externalAcceptance:false,project:{id:p.id,title:p.title},rounds:p.rounds.filter(r=>r.artifacts.some(a=>refs.includes(a.id))).map(r=>({id:r.id,title:r.title})),idMap:pairs.map(([originalId,id])=>({originalId,id,included:refs.includes(originalId)})),actors:[...used].map(id=>actors.get(id)),records:records.map(a=>structuredClone(a)),notices,limits:['Statement array is a Delib batch container, not an agreed upstream transport envelope.','Only one explicitly typed response target inside this selection can populate in_response_to. All source relationships remain here.','Related but unselected records are referenced by ID only; their text is not exported.','Native archives, phase timing, consent, commitments outside the selection and remote handoff history are not mapped into Statements. Retain the full private workspace backup.','Scoped actor codes and manual attestations do not authenticate a person or prove external acceptance.']};
 return {projectId:p.id,fingerprint:await fingerprint(p),refs:[...refs],nativeJson,companion,notices};
}
export async function assertMetagovExportCurrent(p,plan){validateProject(p);if(p.id!==plan.projectId||await fingerprint(p)!==plan.fingerprint)throw new Error('議題已變更，請重新預覽 / Issue changed; preview again');}
