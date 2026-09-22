import {createProject,record,currentRound,allRecords,reviewRecord,nextRound,validateProject} from './workspace-core.js';
import {planTransfer,addTransfer,advanceTransfer,exportTransfer} from './workspace-transfer-core.js';
import {readNativeFile,planNativeImport,applyNativeImport} from './workspace-import-core.js';
import {recordSetting} from './workspace-setting-core.js';
export async function buildPublicReplay(data,lang='zh',stage=5,{onStage}={}){
 if(!Number.isInteger(stage)||stage<0||stage>5||data.schema!=='delib-public-replay-source/v1'||data.records.length!==6)throw new Error('Invalid replay');
 const L=(zh,en)=>lang==='en'?en:zh;
 const p=createProject({title:L('公開資料演練 · vTaiwan UberX','Public-data rehearsal · vTaiwan UberX'),audience:L('歷史公開意見；未重建個人身分或出席名單','Historical public statements; no reconstructed identities or attendance'),goal:L('以六則公開意見練習跨工具交接；後續皆為教學演練，不是歷史決議','Rehearse handoffs with six public statements; later steps are teaching scenarios, not historical decisions'),deadline:'2026-10-01',language:lang});
 p.simulated=true;p.replay={id:'vtaiwan-uberx',revision:data.revision};
 const r=currentRound(p);r.title=L('演練第 1 輪 · 保留分歧','Rehearsal round 1 · retain differences');
 for(const s of data.records){
  const a=record('statement',s.text,{tool:'public-polis',id:`vtaiwan.uberx/${s.id}`});
  a.sourceEvidence={revision:data.revision,originalId:s.id,timestamp:s.timestamp,moderated:s.moderated,origin:'unknown: seed or participant not recorded',license:data.license};
  r.artifacts.push(a);r.inputs.push(a.id);
  r.artifacts.push(record('method-result',L(`歷史欄位：意見 ${s.id}，同意 ${s.agree}、不同意 ${s.disagree}。未提供略過數或群組支持；不推定共識。`,`Historical fields for statement ${s.id}: ${s.agree} agree, ${s.disagree} disagree. Pass counts and group support not supplied here; no consensus inferred.`),{tool:'public-polis-counts',id:`vtaiwan.uberx/${s.id}`},[a.id],{methodData:{agree:s.agree,disagree:s.disagree,pass:null,groupSupport:null,originalId:s.id,revision:data.revision}}));
 }
 const sources=allRecords(p).filter(a=>a.kind==='statement'),files={};
 const capture=n=>{if(onStage){const copy=structuredClone(p);copy.view.tab='flow';onStage(n,{project:validateProject(copy),files:structuredClone(files)});}};capture(0);
 if(stage>=1){
  const transfer=addTransfer(p,planTransfer(p,{tool:'tttc'}));advanceTransfer(transfer,'exported');files.tttc=exportTransfer(transfer);capture(1);
  if(stage>=2){
   const groups=[[7,8],[3,4],[12,17]],texts=[L('【教學歸納】保障與納稅：分別保留保險及營業地納稅的主張。','[Teaching synthesis] Protection and tax: retain insurance and local-tax claims separately.'),L('【教學歸納】服務彈性：討論尖峰價格與跨平台派遣。','[Teaching synthesis] Service flexibility: discuss peak pricing and multi-platform dispatch.'),L('【教學歸納】平台定位有分歧：資訊媒合與人力派遣是不同理解。','[Teaching synthesis] Conflicting platform definitions: information matching versus worker dispatch.')];
   const tree={reportId:'uberx-rehearsal',tree:{topics:[{name:'Teaching example',subtopics:[{name:'Not historical analysis',claims:groups.map((ids,i)=>({id:`teaching-${i}`,text:texts[i],quotes:ids.map(id=>{const s=sources.find(a=>a.source.id===`vtaiwan.uberx/${id}`);return {commentId:s.id,text:s.text};})}))}]}]}};
   files.tttcResult=tree;
   applyNativeImport(p,planNativeImport(p,await readNativeFile(JSON.stringify(tree),{tool:'tttc',simulated:true}),{transferId:transfer.id}));capture(2);
  }
 }
 if(stage>=3){
  for(const a of allRecords(p).filter(a=>a.kind==='theme')){reviewRecord(p,a.id,{reviewer:L('演練主持人（非原發言者）','Practice facilitator (not the original speaker)')});recordSetting(p,a.id,{setting:'in-person',by:'Delib teaching scenario',note:L('假設的實體覆核環節；不是歷史活動紀錄。','Hypothetical in-person review, not a historical event.')});}
  const transfer=addTransfer(p,planTransfer(p,{tool:'reply'}));advanceTransfer(transfer,'exported');files.reply=exportTransfer(transfer);capture(3);
  if(stage>=4){
   const reply={loopId:'uberx-rehearsal',questions:sources.map((s,i)=>({qid:`q${i}`,text:s.text,sourceId:s.id})),loopbacks:sources.map((s,i)=>({qid:`q${i}`,reply:L(`【演練草稿，非政府回覆】意見 ${data.records[i].id} 已列入待討論事項。需由有權回覆者釐清適用範圍、責任與期限；尚無承諾。`,`[Practice draft, not a government response] Statement ${data.records[i].id} remains for discussion. An authorized responder must clarify scope, responsibility and dates; no commitment is recorded.`)}))};
   files.replyResult=reply;applyNativeImport(p,planNativeImport(p,await readNativeFile(JSON.stringify(reply),{tool:'reply',simulated:true}),{transferId:transfer.id}));capture(4);
  }
 }
 if(stage>=5)nextRound(p,{reason:L('【演練】平台定位未解；保險、稅務與價格仍需證據及有權者回覆。','[Practice] Platform definitions remain unresolved; insurance, tax and pricing need evidence and authorized responses.'),owner:L('待指定的演練主持人','Practice facilitator to be assigned'),date:'2026-10-01',phase:'learn'});
 p.view.tab='flow';if(stage>=5)capture(5);return {project:validateProject(p),files};
}

export async function buildPublicReplaySequence(data,lang='zh'){const sequence=[];await buildPublicReplay(data,lang,5,{onStage:(n,snapshot)=>sequence[n]=snapshot});return sequence;}
