import {verifyMetagovFiles} from './metagov-files-core.js';
import {validateProject,allRecords} from './workspace-core.js';
import {mappingSnapshot} from './metagov-mapping-core.js';
import {exportableMetagovRecords} from './metagov-export-core.js';
export const FILE_LIMIT=20*1024*1024;
export async function inspectInteropPair(nativeText,companionText){
 if(typeof nativeText!=='string'||typeof companionText!=='string'||nativeText.length>FILE_LIMIT||companionText.length>FILE_LIMIT)throw new Error('size');
 const companion=JSON.parse(companionText),summary=await verifyMetagovFiles(nativeText,companion);
 return {summary,companion,statements:JSON.parse(nativeText),checkedAt:new Date().toISOString()};
}
// Compare a verified packet to a fresh local snapshot; never apply incoming records.
export function compareInterop(packet,project){
 validateProject(project);const c=packet.companion;
 if(c.namespace!==project.metagov?.namespace||c.simulated!==project.simulated)return {scope:'different',rows:[]};
 const records=new Map(allRecords(project).map(a=>[a.id,a])),states=new Map(exportableMetagovRecords(project).map(x=>[x.record.id,x.status]));
 const rows=c.records.map(a=>{const local=records.get(a.id),state=states.get(a.id);let status;
  if(!local)status='missing';else if(['withdrawn','older','unresolved','not-statement'].includes(state))status=state;
  else if(mappingSnapshot(a)!==mappingSnapshot(local))status='changed';
  else if(JSON.stringify(a.metagovHistory)!==JSON.stringify(local.metagovHistory)||a.metagovHistory.some(m=>[m.madeBy,m.classifiedBy].some(id=>JSON.stringify(c.actors.find(x=>x.id===id))!==JSON.stringify(project.metagov.actors.find(x=>x.id===id)))))status='attribution';
  else if(JSON.stringify(a)!==JSON.stringify(local))status='context';else status='same';
  return {id:a.id,status,incoming:a,local:local||null,revisions:allRecords(project).filter(x=>x.supersedes===a.id).map(x=>({id:x.id,text:x.text}))};
 });return {scope:'matched',projectCopy:c.project.id!==project.id,comparedAt:new Date().toISOString(),rows};
}
export function interopReport(packet,comparison){
 const counts={};if(comparison?.scope==='matched')for(const r of comparison.rows)counts[r.status]=(counts[r.status]||0)+1;
 return {schema:'delib-interop-check/v1',checkedAt:packet.checkedAt,targetRevision:packet.summary.targetRevision,simulated:packet.companion.simulated,checks:{statementSchema:true,pairedFileHash:true,idMap:true,attributionConsistency:true,sourceLinks:true},counts:{statements:packet.summary.statements,actors:packet.summary.actors,sourceLinks:packet.summary.sourceLinks},localComparison:{scope:comparison?.scope||'not-checked',basis:comparison?.demo?'fictional-memory':comparison?'local-workspace':'not-checked',projectCopy:comparison?.projectCopy||false,comparedAt:comparison?.comparedAt||null,counts},externalAcceptance:false,workspaceModified:false,boundary:'Local structural and snapshot consistency check only. No authenticated identity, external receipt, consent or consensus claim. No source text, names, IDs or file hashes are included.'};
}
