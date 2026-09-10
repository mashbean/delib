import {validateProject} from './workspace-core.js';
export const METAGOV_REVISION='e5d3312aa0da481429ef4545ac172b668ead5f55';
export const METAGOV_SOURCE=`https://github.com/metagov/ontology/blob/${METAGOV_REVISION}/ontology/data/src/lib.rs`;
const uuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
// Candidates are semantic review hints, never automatic classifications or native exports.
const roles={question:'Question',theme:'Summary',proposal:'Proposal',decision:'Decision'};
export function metagovReadiness(project){
 validateProject(project);
 const records=project.rounds.flatMap(r=>r.artifacts),groups=new Map();
 for(const a of records){const key=a.kind;if(!groups.has(key))groups.set(key,{kind:key,count:0,candidateRole:roles[key]||null});groups.get(key).count++;}
 return {
  schema:'delib-metagov-readiness/v1',target:{repository:'metagov/ontology',revision:METAGOV_REVISION,source:METAGOV_SOURCE,representation:'Rust data structs / JsonSchema; not RDF or ATProto'},
  status:'review-required',nativeExport:false,externalAcceptance:false,
  counts:{rounds:project.rounds.length,records:records.length,sourceLinks:records.reduce((n,a)=>n+a.derivedFrom.length,0),transfers:(project.transfers||[]).length,nativeArchives:(project.imports||[]).length},
  candidates:[...groups.values()],
  checks:[
   {code:'content',count:records.length,level:'candidate'},
   {code:'project-uuid',count:uuid(project.id)?0:1,level:'missing'},
   {code:'phase-uuid',count:project.rounds.filter(r=>!uuid(r.id)).length,level:'missing'},
   {code:'record-uuid',count:records.filter(a=>!uuid(a.id)).length,level:'missing'},
   {code:'generator',count:records.length,level:'missing'},
   {code:'role-classifier',count:records.length,level:'missing'},
   {code:'role-review',count:records.filter(a=>!roles[a.kind]).length,level:'review'},
   {code:'multi-parent',count:records.filter(a=>a.derivedFrom.length>1).length,level:'retain'},
   {code:'typed-links',count:records.reduce((n,a)=>n+a.relations.filter(e=>e.type!=='responds').length,0),level:'retain'},
   {code:'phase-times',count:project.rounds.length,level:'missing'},
   {code:'setting-is-not-event',count:records.filter(a=>a.settingHistory?.length).length,level:'retain'},
   {code:'native-methods',count:(project.imports||[]).length,level:'retain'},
   {code:'handoff-history',count:(project.transfers||[]).length,level:'retain'}
  ],
  boundary:'Counts and candidate mappings only. No source text, project titles, record IDs, participant identifiers, credentials or native payloads. No inferred people, role classification, consent, remote receipt or conformance.'
 };
}
