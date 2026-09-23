import {nativeRestrictions} from './workspace-import-core.js';
// Local facilitator records. Authority, representative sampling and remote delivery are never inferred.
import {validDate} from './facilitation-core.js';
export const OPERATIONS_SCHEMA='delib-operations/v1';
const fail=()=>{throw Error('Invalid facilitation record, transition or source / 工作紀錄、狀態或來源不符');};
const text=(v,max=2000)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const list=(v,max=100)=>Array.isArray(v)&&v.length<=max;
const unique=v=>new Set(v).size===v.length;
const stamp=by=>({id:crypto.randomUUID(),by,at:new Date().toISOString()});
const records=p=>p.rounds.flatMap(r=>r.artifacts),ops=p=>p.operations||{schema:OPERATIONS_SCHEMA,corrections:[],sessions:[],progressions:[]};
const metadata=e=>text(e.id,120)&&text(e.by,100)&&typeof e.at==='string'&&Number.isFinite(Date.parse(e.at));
const history=(entries,check)=>{if(!list(entries,60)||!entries.length||!unique(entries.map(e=>e.id)))fail();let previous;for(const e of entries){if(!metadata(e)||(previous&&e.at<previous.at))fail();check(e,previous);previous=e;}};
const knownRefs=(refs,known,min=0)=>list(refs,100)&&refs.length>=min&&unique(refs)&&refs.every(id=>known.has(id));
function update(p,fn){const d=structuredClone(p);d.operations=structuredClone(ops(p));const result=fn(d.operations,d);validateOperations(d);p.operations=d.operations;return result;}
export function validateOperations(p){
 if(p.operations===undefined)return p;
 const o=p.operations,rr=records(p),known=new Map(rr.map(r=>[r.id,r])),rounds=new Set(p.rounds.map(r=>r.id));
 if(o.schema!==OPERATIONS_SCHEMA||!list(o.corrections)||!list(o.sessions)||!list(o.progressions)||!unique([...o.corrections,...o.sessions,...o.progressions].map(x=>x.id)))fail();
 for(const c of o.corrections){if(!text(c.id,120)||!known.has(c.recordId)||!rounds.has(c.roundId))fail();history(c.history,(e,prev)=>{if(!['requested','accepted','declined'].includes(e.status)||(!prev&&e.status!=='requested')||(prev&&prev.status!=='requested')||!text(e.reason)||!text(e.owner,100)||!validDate(e.due))fail();if(e.status==='accepted'){const r=known.get(e.replacementRef);if(!r||r.supersedes!==c.recordId)fail();}else if(e.replacementRef!==null)fail();});}
 for(const s of o.sessions){if(!text(s.id,120)||!rounds.has(s.roundId))fail();history(s.history,(e,prev)=>{
  const allowed={planned:['planned','held'],held:['held','reviewed'],reviewed:['reviewed']};if(!['planned','held','reviewed'].includes(e.status)||(!prev&&e.status!=='planned')||(prev&&!allowed[prev.status].includes(e.status))||!text(e.title,200)||!validDate(e.date)||!['online','offline','hybrid'].includes(e.mode)||!text(e.owner,100)||!text(e.notes)||!list(e.agenda,20)||!e.agenda.length||!e.agenda.every(a=>text(a.title,200)&&Number.isInteger(a.minutes)&&a.minutes>0&&a.minutes<=240)||!list(e.groups,20)||!e.groups.length||!e.groups.every(g=>text(g,100))||!unique(e.groups)||!list(e.observations,300))fail();
  if(!unique(e.observations.map(x=>x.participant)))fail();for(const v of e.observations){if(!text(v.participant,100)||!e.groups.includes(v.group)||!['invited','attended','spoke','voted'].every(k=>typeof v[k]==='boolean')||((v.spoke||v.voted)&&!v.attended)||typeof v.barrier!=='string'||v.barrier.length>1000)fail();}
  if(e.status==='planned'&&e.observations.some(v=>v.attended||v.spoke||v.voted))fail();
  if(!list(e.evaluations,300)||!unique(e.evaluations.map(v=>v.participant)))fail();for(const v of e.evaluations){if(!e.observations.some(x=>x.participant===v.participant&&x.attended)||!['heard','understood','fair'].every(k=>v[k]===null||(Number.isInteger(v[k])&&v[k]>=1&&v[k]<=5))||typeof v.note!=='string'||v.note.length>1000)fail();}
  if(e.status==='planned'&&e.evaluations.length)fail();if(e.status==='reviewed'&&!e.evaluations.length)fail();
  if(e.changeReason!==undefined&&!text(e.changeReason))fail();
 });}
 for(const g of o.progressions){if(!text(g.id,120)||!rounds.has(g.roundId)||!known.has(g.proposalRef)||known.get(g.proposalRef).kind!=='proposal'||!text(g.rule,2000)||!text(g.owner,100)||!Number.isInteger(g.quorum)||g.quorum<1||!Number.isInteger(g.minSupport)||g.minSupport<1||g.minSupport>g.quorum)fail();
  history(g.history,(e,prev)=>{const stages=['draft','review','ready','trial','reviewed'];if(!stages.includes(e.stage)||(!prev&&e.stage!=='draft')||(prev&&stages.indexOf(e.stage)!==stages.indexOf(prev.stage)+1)||!text(e.reason)||!knownRefs(e.evidenceRefs,known,e.stage==='draft'?0:1)||!['eligible','support','oppose','abstain'].every(k=>Number.isInteger(e[k])&&e[k]>=0)||e.support+e.oppose+e.abstain>e.eligible||!text(e.minorityNote))fail();
   if(['ready','trial','reviewed'].includes(e.stage)&&(e.support+e.oppose+e.abstain<g.quorum||e.support<g.minSupport||e.proposalReviewed!==true))fail();
  });
 }
 return p;
}
export function requestCorrection(p,recordId,{reason,owner,due,by}){return update(p,o=>{const c={id:crypto.randomUUID(),recordId,roundId:p.view.roundId,history:[{...stamp(by),status:'requested',reason,owner,due,replacementRef:null}]};o.corrections.push(c);return c;});}
export function resolveCorrection(p,id,{status,reason,by,replacementRef=null}){
 const resolved=update(p,o=>{const c=o.corrections.find(c=>c.id===id);if(!c||!['accepted','declined'].includes(status))fail();const prev=c.history.at(-1);c.history.push({...prev,...stamp(by),status,reason,replacementRef});return c;});
 if(status==='accepted'){const affected=new Set(correctionImpact(p,resolved.recordId).slice(1));for(const r of records(p))if(affected.has(r.id)&&r.review.checked){r.review={...r.review,checked:false,quoteConfirmed:false};p.events.push({type:'reopen',recordId:r.id,by,at:resolved.history.at(-1).at});}}
 return resolved;
}
export function saveSession(p,id,input){return update(p,o=>{let s=o.sessions.find(s=>s.id===id);if(id&&!s)fail();if(!s){s={id:crypto.randomUUID(),roundId:p.view.roundId,history:[]};o.sessions.push(s);}s.history.push({...structuredClone(input),...stamp(input.by)});return s;});}
export function sessionCounts(session){const e=session.history.at(-1);return Object.fromEntries(['invited','attended','spoke','voted'].map(k=>[k,e.observations.filter(v=>v[k]).length]));}
export function startProgression(p,{proposalRef,rule,owner,quorum,minSupport,by}){return update(p,o=>{const g={id:crypto.randomUUID(),roundId:p.view.roundId,proposalRef,rule,owner,quorum,minSupport,history:[{...stamp(by),stage:'draft',reason:rule,evidenceRefs:[],eligible:0,support:0,oppose:0,abstain:0,minorityNote:'Not yet assessed / 尚未評估'}]};o.progressions.push(g);return g;});}
export function advanceProgression(p,id,input){return update(p,o=>{const g=o.progressions.find(g=>g.id===id);if(!g)fail();const dependencies=new Set([g.proposalRef,...(input.evidenceRefs||[])]);const open=o.corrections.some(c=>c.history.at(-1).status==='requested'&&correctionImpact(p,c.recordId).some(id=>dependencies.has(id)));if(open||records(p).some(r=>r.supersedes===g.proposalRef))throw Error('Resolve corrections and use the latest proposal revision / 請處理更正並使用最新提案版本');const target=records(p).find(r=>r.id===g.proposalRef);if([...nativeRestrictions(p).withdrawn].some(id=>correctionImpact(p,id).some(ref=>dependencies.has(ref))))throw Error('Source is withdrawn / 來源已撤回');g.history.push({...structuredClone(input),proposalReviewed:target?.review.checked===true,...stamp(input.by)});return g;});}
export function correctionImpact(p,recordId){const impacted=new Set([recordId]);let changed=true;while(changed){changed=false;for(const r of records(p))if(!impacted.has(r.id)&&r.derivedFrom.some(id=>impacted.has(id))){impacted.add(r.id);changed=true;}}return [...impacted];}
