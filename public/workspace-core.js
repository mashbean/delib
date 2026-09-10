import {validateMetagovMappings} from './metagov-mapping-core.js';
import {validateSettings} from './workspace-setting-core.js';
import { validateNativeImports, nativeRestrictions } from './workspace-import-core.js';
import { validateTransfers } from './workspace-transfer-core.js';
import { validateFacilitation, carryParticipation, roundFollowups, saveParticipation, setCommitment, setDisposition } from './facilitation-core.js';
import { parseTttcCsv, tttcRowsToCsv } from './tttc-csv-core.js';
export const WORKSPACE_SCHEMA='https://delib.mashbean.net/schemas/delib-workspace/v1.json';
export const uid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const kinds=['statement','question','theme','proposal','reply','decision','feedback','brief','inclusion-check','method-result','quote'];
const text=(s,max=12000)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
export const allRecords=p=>p.rounds.flatMap(r=>r.artifacts);
export const activeRecords=p=>{const all=allRecords(p),old=new Set(all.map(a=>a.supersedes).filter(Boolean));return all.filter(a=>!old.has(a.id));};
export const currentRound=p=>p.rounds.find(r=>r.id===p.view.roundId)||p.rounds.at(-1);
export function createProject({title,audience,deadline,goal,language='zh'}) {
  if(!text(title,120)||!text(audience,500)||!text(goal,1000)||!/^\d{4}-\d{2}-\d{2}$/.test(deadline||''))throw new Error('請填寫議題、參與對象、目標與日期 / Complete the issue, audience, goal and date.');
  const id=uid(),roundId=uid();
  return {schema:WORKSPACE_SCHEMA,id,title,audience,deadline,goal,language,simulated:false,createdAt:now(),updatedAt:now(),view:{roundId,tab:'route',selected:'',mode:'focus'},rounds:[{id:roundId,title:language==='en'?'Round 1':'第 1 輪',step:0,artifacts:[],inputs:[],connections:{},next:null}],events:[]};
}
export function validateProject(p) {
  if(!p||p.schema!==WORKSPACE_SCHEMA||!text(p.id,120)||!text(p.title,120)||typeof p.simulated!=='boolean'||!['zh','en'].includes(p.language)||!Array.isArray(p.rounds)||!p.rounds.length||p.rounds.length>30||!Array.isArray(p.events)||p.events.length>2000||!p.view)throw new Error('Invalid workspace');
  if(JSON.stringify(p).length>6*1024*1024)throw new Error('Workspace exceeds 6 MiB');
  const ids=new Set(),rounds=new Set();let count=0;
  for(const r of p.rounds){
    if(!text(r.id,120)||rounds.has(r.id)||!text(r.title,200)||!Number.isInteger(r.step)||r.step<0||r.step>3||!Array.isArray(r.artifacts)||!Array.isArray(r.inputs)||!r.connections)throw new Error('Invalid round');rounds.add(r.id);
    for(const id of r.inputs)if(!ids.has(id)&&!r.artifacts.some(a=>a.id===id))throw new Error('Missing round input');
    for(const a of r.artifacts){
      if(++count>5000||!text(a.id,120)||ids.has(a.id)||!kinds.includes(a.kind)||!text(a.text)||!a.source||!text(a.source.tool,80)||!text(a.source.id,200)||!Array.isArray(a.derivedFrom)||a.derivedFrom.some(id=>!ids.has(id))||!Array.isArray(a.relations)||a.relations.some(e=>!a.derivedFrom.includes(e.ref)||!['derived','responds','revises','supports','opposes','context'].includes(e.type))||!a.review||typeof a.review.checked!=='boolean'||typeof a.review.quoteConfirmed!=='boolean')throw new Error('Invalid record or broken provenance');
      if(a.supersedes&&!ids.has(a.supersedes))throw new Error('Missing revision source');
      if(a.review.checked&&(!text(a.review.reviewer,100)||!text(a.review.at,50)))throw new Error('Review needs attribution');
      if(a.participantRef!==null&&!text(a.participantRef,240))throw new Error('Invalid participant reference');
      ids.add(a.id);
    }
    for(const [tool,c] of Object.entries(r.connections)){if(!['form','tttc','reply'].includes(tool)||!c||!/^[a-z0-9]{10}$/.test(c.id||'')||!Array.isArray(c.inputRefs)||c.inputRefs.some(id=>!ids.has(id))||!Array.isArray(c.contextRefs)||c.contextRefs.some(id=>!ids.has(id)))throw new Error('Invalid service connection');}
    if(r.next&&(!text(r.next.reason,1000)||!text(r.next.owner,100)||!text(r.next.date,50)||!Array.isArray(r.next.carryForwardRefs)||r.next.carryForwardRefs.some(id=>!ids.has(id))))throw new Error('Invalid next-round commitment');
  }
  if(!rounds.has(p.view.roundId)||!['route','voices','changes','participation','transfer','flow'].includes(p.view.tab))throw new Error('Invalid view');
  // Credential fields are never part of a project or backup. UI credentials live in memory.
  const forbidden=o=>{if(!o||typeof o!=='object')return false;return Object.entries(o).some(([k,v])=>/^(adminToken|token|hostUrl|manageUrl|authorization)$/i.test(k)||forbidden(v));};
  if(forbidden(p))throw new Error('Remove management credentials before importing');
  if(p.view.flowVoice!==undefined && (typeof p.view.flowVoice!=='string'||(p.view.flowVoice&&!ids.has(p.view.flowVoice))))throw new Error('Unknown flow voice');
  validateSettings(p);validateMetagovMappings(p);validateFacilitation(p);validateTransfers(p);validateNativeImports(p);return p;
}
export function record(kind,value,source,refs=[],extra={}){return {id:uid(),kind,text:value,source,derivedFrom:[...new Set(refs)],relations:[...new Set(refs)].map(ref=>({ref,type:kind==='reply'?'responds':'derived'})),participantRef:null,supersedes:null,review:{checked:false,reviewer:'',at:null,quoteConfirmed:false},...extra};}
export function addSources(p,csv,sourceId,{reconcile=false}={}){
  const parsed=parseTttcCsv({text:csv,label:sourceId});
  if(parsed.rows.length>1000)throw new Error('每輪最多匯入 1,000 則 / Up to 1,000 source rows per import.');
  const r=currentRound(p),existing=allRecords(p);const added=[];
  if(reconcile)r.inputs=r.inputs.filter(id=>!existing.some(a=>a.id===id&&a.source.tool==='form'&&a.source.id.startsWith(`${sourceId}/`)));
  // Each import is transactional; an edited source gets a new immutable revision.
  for(const row of parsed.rows){
    const prev=existing.filter(a=>a.source.tool==='form'&&a.source.id===`${sourceId}/${row.id}`).at(-1);
    if(prev?.text===row.comment){if(!r.inputs.includes(prev.id))r.inputs.push(prev.id);continue;}
    const a=record('statement',row.comment,{tool:'form',id:`${sourceId}/${row.id}`},prev?[prev.id]:[],{participantRef:row.interview?`${sourceId}/${row.interview}`:null,supersedes:prev?.id??null});
    if(prev)a.relations=[{ref:prev.id,type:'revises'}];r.artifacts.push(a);r.inputs.push(a.id);added.push(a);
  }
  return {added,warnings:parsed.warnings};
}
export function roundSources(p,r=currentRound(p)){const ids=new Set(r.inputs);const active=activeRecords(p),restricted=nativeRestrictions(p);return active.filter(a=>!restricted.older.has(a.id)&&!restricted.withdrawn.has(a.id)&&ids.has(a.id)&&['statement','question','feedback'].includes(a.kind));}
export function sourcesCsv(p,refs){const ids=new Set(refs);return tttcRowsToCsv(allRecords(p).filter(a=>ids.has(a.id)).map(a=>({id:a.id,interview:'',comment:a.text})));}
export function acceptTttc(p,result,connection){
  if(result.progress?.status!=='ready'||!result.tree?.topics)return false;
  const allowed=new Set(connection.inputRefs),existing=allRecords(p),added=[];
  for(const topic of result.tree.topics)for(const sub of topic.subtopics||[])for(const claim of sub.claims||[]){
    if((claim.quotes||[]).some(q=>typeof q.text==='string'&&!existing.some(a=>a.id===q.commentId&&a.text.includes(q.text))))throw new Error('引文與來源文字不符 / Quote differs from source');
    const source={tool:'tttc',id:`${connection.id}/${claim.id}`};if(existing.some(a=>a.source.tool===source.tool&&a.source.id===source.id))continue;
    const refs=[...new Set((claim.quotes||[]).map(q=>q.commentId))];
    if(!refs.length||refs.some(id=>!allowed.has(id)))throw new Error('分析包含無法對應的來源，未匯入。 / Unmatched analysis sources; nothing imported.');
    const a=record('theme',claim.text,source,refs);a.context=`${topic.name} / ${sub.name}`;
    added.push(a);
  }
  if(!added.length&&!existing.some(a=>a.source.tool==='tttc'&&a.source.id.startsWith(`${connection.id}/`)))throw new Error('沒有可追溯的分析結果 / No traceable claims returned.');
  currentRound(p).artifacts.push(...added);return true;
}
export function acceptReply(p,result,connection){
  if(result.progress?.status!=='ready'||!result.receipt)return false;
  const allowed=new Set(connection.inputRefs),existing=allRecords(p),added=[];
  for(const reply of result.receipt.loopbacks||[]){
    const q=result.receipt.questions.find(q=>q.qid===reply.qid);if(!q||!allowed.has(q.sourceId))throw new Error('回覆無法對應原話，未匯入。 / Reply source mismatch; nothing imported.');
    const source={tool:'reply',id:`${connection.id}/${reply.qid}`};if(existing.some(a=>a.source.tool===source.tool&&a.source.id===source.id))continue;
    // The question mapping is exact; approved themes are context, not presumed causal links.
    const refs=[q.sourceId,...(connection.contextRefs||[])];const a=record('reply',reply.reply,source,refs);
    a.relations=refs.map(ref=>({ref,type:ref===q.sourceId?'responds':'context'}));added.push(a);
  }
  if(!added.length&&!existing.some(a=>a.source.tool==='reply'&&a.source.id.startsWith(`${connection.id}/`)))throw new Error('沒有可對應的回覆 / No traceable replies returned.');
  currentRound(p).artifacts.push(...added);return true;
}
export function reviseRecord(p,id,value,reviewer){
  const previous=allRecords(p).find(a=>a.id===id);if(!previous||!text(value)||!text(reviewer,100))throw new Error('請填修訂內容與修訂者 / Enter the revision and author.');
  const next=record(previous.kind,value,{tool:'facilitator',id:uid()},[id],{supersedes:id,participantRef:previous.participantRef});next.relations=[{ref:id,type:'revises'}];
  currentRound(p).artifacts.push(next);currentRound(p).inputs=currentRound(p).inputs.map(ref=>ref===id?next.id:ref);
  p.events.push({type:'revision',recordId:next.id,by:reviewer,at:now()});return next;
}
export function reviewRecord(p,id,{reviewer,quoteConfirmed=false,checked=true}){const a=allRecords(p).find(a=>a.id===id);if(!a||!text(reviewer,100))throw new Error('請填檢查者 / Enter a reviewer.');a.review={checked,reviewer,at:now(),quoteConfirmed};p.events.push({type:checked?'review':'reopen',recordId:id,by:reviewer,at:now()});}
export function nextRound(p,{reason,owner,date,phase}){
  if(!text(reason,1000)||!text(owner,100)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!['recruit','learn','deliberate','respond'].includes(phase))throw new Error('請填下一輪缺口、負責者與日期 / Complete the next round gap, owner and date.');
  const prev=currentRound(p);if(prev!==p.rounds.at(-1))throw new Error('請從最新一輪延續 / Continue from the latest round.');
  const open=roundFollowups(p,prev);
  prev.next={reason,owner,date,phase,carryForwardRefs:open.map(a=>a.id)};
  const brief=record('brief',reason,{tool:'facilitator',id:uid()},open.map(a=>a.id));
  const r={id:uid(),title:p.language==='en'?`Round ${p.rounds.length+1}`:`第 ${p.rounds.length+1} 輪`,step:({recruit:0,learn:0,deliberate:1,respond:2})[phase],artifacts:[brief],inputs:open.map(a=>a.id),connections:{},next:null,participation:carryParticipation(prev)};
  p.rounds.push(r);p.view.roundId=r.id;p.view.tab='route';p.view.selected=brief.id;return r;
}
export function traceVoice(p,id){
  const all=allRecords(p),found=new Set([id]);let changed=true;
  while(changed){changed=false;for(const a of all)if(!found.has(a.id)&&a.derivedFrom.some(ref=>found.has(ref)&&(!a.relations.some(e=>e.ref===ref)||a.relations.some(e=>e.ref===ref&&e.type!=='context')))){found.add(a.id);changed=true;}}
  return all.filter(a=>found.has(a.id));
}
export function compareRounds(p){const r=currentRound(p),i=p.rounds.indexOf(r),prev=p.rounds[i-1];if(!prev)return null;
  const people=x=>new Set(x.artifacts.filter(a=>a.kind==='statement').map(a=>a.participantRef).filter(Boolean)),a=people(prev),b=people(r);
  return {previous:prev,newSources:r.artifacts.filter(a=>a.kind==='statement'&&!a.supersedes),revisions:r.artifacts.filter(a=>a.supersedes),open:activeRecords(p).filter(a=>(r.artifacts.some(x=>x.id===a.id)||r.inputs.includes(a.id))&&!a.review.checked),joined:p.simulated?[...b].filter(id=>!a.has(id)):null,left:p.simulated?[...a].filter(id=>!b.has(id)):null};
}
export function projectFromDemo(bundle,language='zh'){
  const loc=v=>typeof v==='object'?(v[language]||v.en):v;
  const p=createProject({title:loc(bundle.issue.title)||'Demo',audience:language==='en'?'Fictional residents':'虛構居民',deadline:'2026-12-01',goal:language==='en'?'Explore how voices shape each round.':'探索聲音如何影響每一輪。',language});p.simulated=true;
  p.rounds=bundle.rounds.map(r=>({id:r.id,title:loc(r.title),step:0,inputs:r.artifacts.filter(a=>['statement','question'].includes(a.kind)).map(a=>a.id),connections:{},next:null,artifacts:r.artifacts.map(a=>record(a.kind,loc(a.text),{tool:a.source.tool,id:a.id},a.derivedFrom,{id:a.id,participantRef:a.participantRef,review:{checked:a.reviewed,reviewer:a.reviewed?(language==='en'?'Fictional facilitator':'模擬主持人'):'',at:a.reviewed?bundle.generatedAt:null,quoteConfirmed:false}}))}));
  p.view.roundId=p.rounds[0].id;
  const en=language==='en',by=en?'Fictional facilitator':'模擬主持人',owner=en?'Fictional school contact':'模擬校方窗口';
  const gap={group:en?'Shift-working caregivers':'輪班照顧者',barrier:en?'Daytime sessions exclude shift workers':'白天場次不方便輪班者參加',action:en?'Offer an evening listening session':'另開晚間聆聽時段',note:en?'Fictional exercise: the invitation offered only daytime slots.':'示範登記：邀請原先只提供白天時段。',owner,reviewOn:'2026-12-01',by,status:'missing'};
  saveParticipation(p,'',gap);
  const source=p.rounds[0].artifacts.find(a=>a.kind==='statement');
  if(source)setDisposition(p,source.id,{status:'deferred',reason:en?'Fictional exercise: inspect the site and accessible drop-off before deciding.':'示範登記：完成現場觀察與無障礙接送檢查後，再決定方案。',owner,reviewOn:'2026-12-01',by});
  const reply=p.rounds[0].artifacts.find(a=>a.kind==='reply');
  if(reply){reviewRecord(p,reply.id,{reviewer:by});for(const status of ['confirmed','committed'])setCommitment(p,reply.id,{status,owner,reviewOn:'2026-12-01',by,note:en?'Fictional exercise: arrange a drop-off trial and review access conditions.':'示範登記：安排接送動線試辦，檢視通行與無障礙需求。',authorityConfirmed:true});}
  for(let i=1;i<p.rounds.length;i++){p.view.roundId=p.rounds[i].id;p.rounds[i].participation=carryParticipation(p.rounds[i-1]);const entry=p.rounds[i].participation[0];if(entry)saveParticipation(p,entry.id,{...gap,status:i===1?'invited':'heard',note:en?(i===1?'Fictional exercise: evening invitation prepared.':'Fictional exercise: facilitator recorded the follow-up accounts.'):(i===1?'示範登記：已準備晚間邀請。':'示範登記：主持人記錄了回訪經驗。')});}
  p.view.roundId=p.rounds[0].id;return validateProject(p);
}
