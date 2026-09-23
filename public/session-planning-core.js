import {saveSession} from './operations-core.js';
import {saveParticipation,validateFacilitation} from './facilitation-core.js';

const fail=(zh,en)=>{throw Error(`${zh} / ${en}`);};
const lines=v=>String(v).split('\n').map(s=>s.trim()).filter(Boolean);
export function parseAgenda(value){
  return lines(value).map(line=>{const parts=line.split('|'),minutes=parts[1]?.trim();
    if(parts.length!==2||!parts[0].trim()||!/^\d+$/.test(minutes||'')||Number(minutes)<1||Number(minutes)>240)
      fail('每行請填「活動名稱 | 1 至 240 的分鐘數」','Use “activity | minutes”, from 1 to 240, on each line');
    return {title:parts[0].trim(),minutes:Number(minutes)};
  });
}
export const parseInvitees=lines;
export function editSessionPlan(project,sessionId,input){
  const session=project.operations?.sessions.find(s=>s.id===sessionId),previous=session?.history.at(-1);
  if(!previous||previous.id!==input.expectedHistoryId)fail('場次已更新，請重新載入','Session changed; reload before editing');
  if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>2000)fail('請說明修改原因','Explain why the plan changed');
  const invitees=input.invitees||[],additionalGroups=input.additionalGroups||[];
  if(!Array.isArray(invitees)||!Array.isArray(additionalGroups)||[...invitees,...additionalGroups].some(v=>typeof v!=='string'||!v.trim()))fail('代稱與小組不能留白','Aliases and groups cannot be blank');
  const keys=previous.observations.map(v=>v.participant.trim().normalize('NFC')).concat(invitees.map(v=>v.trim().normalize('NFC')));
  if(new Set(keys).size!==keys.length)fail('新增代稱重複，請保留既有紀錄','Duplicate alias; keep the existing participant record');
  return saveSession(project,sessionId,{...previous,title:input.title,date:input.date,mode:input.mode,owner:input.owner,
    agenda:input.agenda,groups:[...new Set([...previous.groups,...additionalGroups.map(g=>g.trim())])],
    observations:[...previous.observations,...invitees.map(participant=>({participant:participant.trim(),group:previous.groups[0],invited:true,attended:false,spoke:false,voted:false,barrier:''}))],
    changeReason:input.reason,by:input.by});
}

export function findSessionSupport(project,sessionId,participant){
  let found=null;
  for(const round of project.rounds)for(const gap of round.participation||[])if(gap.sessionSource?.sessionId===sessionId&&gap.sessionSource.participant===participant)found={roundId:round.id,roundTitle:round.title,gap};
  return found;
}
export function createSessionSupport(project,sessionId,participant,input){
  if(input.confirmed!==true)fail('請確認支持措施、負責者與檢視日期','Confirm the support action, owner and review date');
  const session=project.operations?.sessions.find(s=>s.id===sessionId),entry=session?.history.at(-1),observation=entry?.observations.find(v=>v.participant===participant);
  if(findSessionSupport(project,sessionId,participant))fail('已有支持任務，請更新原任務','A support task already exists; update it instead');
  if(!entry||entry.id!==input.expectedHistoryId||!observation?.barrier.trim())fail('障礙紀錄已更新或不存在，請重新載入','Barrier changed or is missing; reload before creating support');
  const draft=structuredClone(project),gap=saveParticipation(draft,'',{status:'follow-up',group:input.group,barrier:observation.barrier,action:input.action,owner:input.owner,reviewOn:input.reviewOn,note:input.note,by:input.by});
  gap.sessionSource={sessionId,entryId:entry.id,participant};
  validateFacilitation(draft);project.rounds=draft.rounds;return gap;
}
