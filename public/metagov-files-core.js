import validateStatement from './vendor/metagov-statement-validator.js';
import {validateMetagovMappings,currentMetagovMapping,UUID} from './metagov-mapping-core.js';
import {mappedRecordId} from './metagov-export-core.js';
import {METAGOV_REVISION} from './metagov-readiness-core.js';
const text=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const hash=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');
export async function verifyMetagovFiles(nativeJson,c){
 const fail=()=>{throw new Error('Invalid or mismatched Metagov export files');};
 if(typeof nativeJson!=='string'||nativeJson.length>20*1024*1024||!c||JSON.stringify(c).length>20*1024*1024||c.schema!=='delib-metagov-companion/v1'||c.targetRevision!==METAGOV_REVISION||!UUID.test(c.namespace)||c.externalAcceptance!==false||!Array.isArray(c.records)||!Array.isArray(c.idMap)||!Array.isArray(c.actors)||await hash(nativeJson)!==c.nativeSha256)fail();
 if(!c.project||!text(c.project.id,120)||!text(c.project.title,120)||typeof c.simulated!=='boolean'||!Array.isArray(c.rounds)||!c.rounds.length||c.rounds.length>30||c.rounds.some(r=>!r||!text(r.id,120)||!text(r.title,200))||c.idMap.length>5000)fail();
 const statements=JSON.parse(nativeJson);if(!Array.isArray(statements)||!statements.length||statements.length>200||c.records.length!==statements.length||new Set(c.records.map(a=>a.id)).size!==c.records.length)fail();
 for(const a of c.records)if(!a||!text(a.id,120)||!text(a.text,12000)||!['statement','question','theme','proposal','reply','decision','feedback','brief','quote'].includes(a.kind)||!a.source||!text(a.source.tool,80)||!text(a.source.id,200)||!Array.isArray(a.derivedFrom)||a.derivedFrom.length>5000||a.derivedFrom.some(id=>!text(id,120))||new Set(a.derivedFrom).size!==a.derivedFrom.length||!Array.isArray(a.relations)||a.relations.length>30000||a.relations.some(e=>!e||!a.derivedFrom.includes(e.ref)||!['derived','responds','revises','supports','opposes','context'].includes(e.type)))fail();
 const needed=new Set(c.records.flatMap(a=>[a.id,...a.derivedFrom]));if(c.idMap.length!==needed.size)fail();
 validateMetagovMappings({metagov:{schema:'delib-metagov-mapping/v1',namespace:c.namespace,actors:c.actors},rounds:[{artifacts:c.records}]});
 const ids=new Map();for(const pair of c.idMap){if(!pair||!needed.has(pair.originalId)||ids.has(pair.originalId)||pair.id!==await mappedRecordId(c.namespace,pair.originalId)||pair.included!==c.records.some(a=>a.id===pair.originalId))fail();ids.set(pair.originalId,pair.id);}
 const used=new Set(c.records.flatMap(a=>(a.metagovHistory||[]).flatMap(m=>[m.madeBy,m.classifiedBy])));if(c.actors.length!==used.size||c.actors.some(a=>!used.has(a.id)))fail();
 const actors=new Map(c.actors.map(a=>[a.id,a]));const generator=id=>{const a=actors.get(id);if(!a)fail();return a.kind==='Algorithm'?{Algorithm:{id:a.id,kind:a.algorithmKind,metadata:{}}}:{[a.kind]:a.id};};
 const seen=new Set();for(let i=0;i<statements.length;i++){
  const s=statements[i],a=c.records[i],m=currentMetagovMapping(a);if(!validateStatement(s)||Object.keys(s).some(k=>!['id','content','role','made_by','role_classified_by','in_response_to'].includes(k))||seen.has(s.id)||!m||!Array.isArray(a.derivedFrom)||!Array.isArray(a.relations)||a.derivedFrom.some(ref=>!ids.has(ref))||a.relations.some(e=>!a.derivedFrom.includes(e.ref)))fail();seen.add(s.id);
  const response=a.relations.filter(e=>e.type==='responds'),expected=response.length===1&&c.records.some(r=>r.id===response[0].ref)?ids.get(response[0].ref):null;
  if(s.id!==ids.get(a.id)||s.content!==a.text||s.role!==m.role||s.in_response_to!==expected||JSON.stringify(s.made_by)!==JSON.stringify(generator(m.madeBy))||JSON.stringify(s.role_classified_by)!==JSON.stringify(generator(m.classifiedBy)))fail();
 }
 return {statements:statements.length,sourceLinks:c.records.reduce((n,a)=>n+a.derivedFrom.length,0),actors:c.actors.length,targetRevision:METAGOV_REVISION,structuralValidation:true,externalAcceptance:false};
}
