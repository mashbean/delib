export const METAGOV_ROLES=['Question','Belief','Fact','Evidence','Refutation','Summary','Proposal','Decision'];
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const keys=(o,allowed)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>allowed.includes(k));
export function mappingSnapshot(a){return JSON.stringify({text:a.text,kind:a.kind,source:a.source,participantRef:a.participantRef,derivedFrom:a.derivedFrom,relations:a.relations,supersedes:a.supersedes});}
function validActor(a){return keys(a,['id','kind','label','algorithmKind','evidence','at'])&&UUID.test(a.id)&&['Participant','Host','Algorithm'].includes(a.kind)&&text(a.label,100)&&text(a.evidence,1000)&&date(a.at)&&(a.kind==='Algorithm'?text(a.algorithmKind,200):a.algorithmKind===null);}
function validMapping(e,ids){return keys(e,['role','madeBy','classifiedBy','evidence','at','snapshot'])&&METAGOV_ROLES.includes(e.role)&&ids.has(e.madeBy)&&ids.has(e.classifiedBy)&&text(e.evidence,1000)&&date(e.at)&&text(e.snapshot,200000);}
export function validateMetagovMappings(p){
 const records=p.rounds.flatMap(r=>r.artifacts),m=p.metagov;
 if(m===undefined){if(records.some(a=>a.metagovHistory!==undefined))throw new Error('Metagov actors missing');return;}
 if(!keys(m,['schema','namespace','actors'])||m.schema!=='delib-metagov-mapping/v1'||!UUID.test(m.namespace)||!Array.isArray(m.actors)||m.actors.length>1000)throw new Error('Invalid Metagov actor registry');
 const ids=new Set();for(const a of m.actors){if(!validActor(a)||ids.has(a.id))throw new Error('Invalid Metagov actor');ids.add(a.id);}
 for(const a of records)if(a.metagovHistory!==undefined){if(!Array.isArray(a.metagovHistory)||!a.metagovHistory.length||a.metagovHistory.length>20||a.metagovHistory.some(e=>!validMapping(e,ids)))throw new Error('Invalid Metagov mapping');}
}
export function addMetagovActor(p,{kind,label,algorithmKind,evidence}){
 const actor={id:crypto.randomUUID(),kind,label:label?.trim(),algorithmKind:kind==='Algorithm'?algorithmKind?.trim():null,evidence:evidence?.trim(),at:new Date().toISOString()};
 if(!validActor(actor)||(p.metagov?.actors.length||0)>=1000)throw new Error('請填寫產生者類型、代稱與依據 / Complete actor type, label and evidence');
 p.metagov??={schema:'delib-metagov-mapping/v1',namespace:crypto.randomUUID(),actors:[]};p.metagov.actors.push(actor);return actor;
}
export function recordMetagovMapping(p,id,{role,madeBy,classifiedBy,evidence,confirmed}){
 const a=p.rounds.flatMap(r=>r.artifacts).find(a=>a.id===id);if(!a)throw new Error('Unknown record');
 const entry={role,madeBy,classifiedBy,evidence:evidence?.trim(),at:new Date().toISOString(),snapshot:mappingSnapshot(a)};
 if(confirmed!==true||!validMapping(entry,new Set(p.metagov?.actors.map(a=>a.id)||[]))||(a.metagovHistory?.length||0)>=20)throw new Error('請確認角色、產生者、分類者與依據 / Confirm role, creator, classifier and evidence');
 a.metagovHistory=[...(a.metagovHistory||[]),entry];return entry;
}
export function currentMetagovMapping(a){const m=a.metagovHistory?.at(-1);return m?.snapshot===mappingSnapshot(a)?m:null;}
