import {findSessionSupport} from './session-planning-core.js';
import {statusLabel} from './facilitation-view.js';
import {icon} from './icons.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(name,label,value='',type='text',max=100)=>`<label>${label}<input name="${name}" value="${esc(value)}" type="${type}" maxlength="${max}" required></label>`;
const area=(name,label,value='',required=true,max=2000)=>`<label>${label}<textarea name="${name}" maxlength="${max}" ${required?'required':''}>${esc(value)}</textarea></label>`;
export function sessionPlanEditor(session,lang='zh'){
  const L=(a,b)=>lang==='en'?b:a,e=session.history.at(-1);
  return `<details><summary>${icon('edit')}${L('編輯議程與邀請名單','Edit agenda and invitees')}</summary><form data-action="session-plan" data-id="${esc(session.id)}" data-version="${esc(e.id)}">
    <p>${L('保存成新版本。既有代稱、出席與回饋保留；取消邀請可在出席表取消「受邀」勾選。','Save a new version. Existing aliases, attendance and feedback remain; clear “Invited” in attendance to cancel an invitation.')}</p>
    ${field('title',L('場次名稱','Session title'),e.title,'text',200)}${field('date',L('日期','Date'),e.date,'date')}
    <label>${L('場域','Setting')}<select name="mode">${[['online',L('線上','Online')],['offline',L('實體','In person')],['hybrid',L('混合','Hybrid')]].map(([v,t])=>`<option value="${v}" ${v===e.mode?'selected':''}>${t}</option>`).join('')}</select></label>
    ${field('owner',L('主持／負責者','Facilitator / owner'),e.owner)}${area('agenda',L('議程：每行「活動名稱 | 分鐘」','Agenda: one “activity | minutes” per line'),e.agenda.map(a=>`${a.title} | ${a.minutes}`).join('\n'))}
    <p>${L('現有小組','Existing groups')}: ${e.groups.map(esc).join(', ')} · ${L('既有代稱','Existing aliases')}: ${e.observations.map(v=>esc(v.participant)).join(', ')}</p>
    <label>${L('新增小組（選填，逗號分隔）','Add groups (optional, comma-separated)')}<input name="additionalGroups" maxlength="2000"></label>
    ${area('invitees',L('新增受邀代稱（選填，每行一位）','Add invited aliases (optional, one per line)'),'',false)}
    <p class="small">${L('新代稱先歸入第一組，尚未出席；可在出席表調整小組。','New aliases start in the first group as not attended; adjust their group in attendance.')}</p>
    ${area('reason',L('修改原因','Reason for change'))}${field('by',L('登記者','Recorded by'))}<button>${icon('check')}${L('保存議程新版本','Save revised plan')}</button></form></details>`;
}

export function sessionSupportView(project,session,lang='zh'){
  const L=(a,b)=>lang==='en'?b:a,e=session.history.at(-1),barriers=e.observations.filter(v=>v.barrier.trim()||findSessionSupport(project,session.id,v.participant));
  if(!barriers.length)return '';
  return `<details><summary>${icon('people')}${L('安排參與支持','Arrange participation support')} · ${barriers.length}</summary>${barriers.map(v=>{
    const tracked=findSessionSupport(project,session.id,v.participant),h=tracked?.gap.history.at(-1);
    if(tracked)return `<article class="support-card"><strong>${esc(v.participant)}</strong><p>${esc(h.barrier)}</p><p>${L('已登記支持任務','Support task recorded')} · ${esc(statusLabel(h.status,lang))} · ${esc(tracked.roundTitle)}<br>${esc(h.action)} · ${esc(h.owner)} · ${esc(h.reviewOn)}</p><button type="button" data-support-gap="${esc(tracked.gap.id)}">${icon('arrow')}${L('查看／更新支持任務','View / update support task')}</button></article>`;
    return `<article class="support-card"><strong>${esc(v.participant)}</strong><p>${esc(v.barrier)}</p><form data-action="session-support" data-id="${esc(session.id)}" data-version="${esc(e.id)}" data-participant="${esc(v.participant)}">
      ${field('group',L('需支持的群體或代稱','Group or alias needing support'),v.participant,'text',200)}${area('action',L('具體支持措施','Concrete support action'),'',true,1000)}${field('owner',L('負責者','Owner'))}${field('reviewOn',L('檢視日期','Review date'),project.deadline||'','date')}${area('note',L('安排理由與待確認事項','Reason and items to confirm'))}${field('by',L('登記者','Recorded by'))}
      <label class="support-confirm"><input name="confirmed" type="checkbox" required>${L('我已核對措施、負責者與日期；這是主持安排，尚不代表參與者確認。','I checked the action, owner and date. This is a facilitation plan, not participant confirmation.')}</label><button>${icon('check')}${L('建立支持任務','Create support task')}</button></form></article>`;
  }).join('')}</details>`;
}

export function sessionPlanHistory(session,lang='zh'){
  const L=(a,b)=>lang==='en'?b:a;
  return `<details><summary>${icon('clock')}${L('場次版本','Session versions')} · ${session.history.length}</summary>${session.history.map((e,i)=>`<article class="support-card"><strong>${i+1} · ${esc(e.title)}</strong><p>${esc(e.by)} · ${esc(e.at)}<br>${esc(e.changeReason||e.notes)}<br><small>${L('版本代碼','Version reference')}: ${esc(e.id)}</small></p><p>${esc(e.date)} · ${esc(e.mode)} · ${esc(e.owner)}</p><ol>${e.agenda.map(a=>`<li>${esc(a.title)} · ${a.minutes} ${L('分鐘','min')}</li>`).join('')}</ol><p>${L('當時名單','Roster at this version')}: ${e.observations.map(v=>esc(v.participant)).join(', ')}</p>${e.observations.filter(v=>v.barrier.trim()).map(v=>`<p>${esc(v.participant)} · ${esc(v.barrier)}</p>`).join('')}</article>`).join('')}</details>`;
}
