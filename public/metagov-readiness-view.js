import {metagovReadiness,METAGOV_SOURCE} from './metagov-readiness-core.js';
const messages={
 'project-uuid':['議題 ID 需要可回查的 UUID 對照。','Project ID needs a reversible UUID map.'],
 'phase-uuid':['輪次 ID 需要可回查的 UUID 對照。','Round IDs need a reversible UUID map.'],
 content:['原文可對照 Statement.content；仍需檢查用途與同意。','Text can map to Statement.content; purpose and permission still need review.'],
 'record-uuid':['來源 ID 不是 UUID；Statement 匯出會建立私人對照表。','Source IDs are not UUIDs; Statement export creates a private reversible map.'],
 generator:['尚未明確指定產生者；不能從暱稱、工具名或檢查者推定。','Explicit creator attribution missing; do not infer it from aliases, tool names or reviewers.'],
 'role-classifier':['缺少角色分類者；不把檢查紀錄當作 role_classified_by。','Role classifier missing; review logs do not establish role_classified_by.'],
 'role-review':['沒有直接的角色候選；不能把一般原話自動當作事實或信念。','No direct role candidate; a source statement is not automatically a fact or belief.'],
 'multi-parent':['有多筆來源；單一 in_response_to 無法保留全部父節點。','Multiple sources; one in_response_to cannot retain all parents.'],
 'typed-links':['來源、脈絡、修訂等關係需要另行保留。','Provenance, context, revision and other typed links need separate preservation.'],
 'phase-times':['每輪缺少起訖時間；檢視日期不是 Phase 的時間範圍。','Round start/end times missing; a review date is not a Phase time interval.'],
 'setting-is-not-event':['場域註記不是 Event；不能補造時間或經緯度。','Setting observations are not Events; do not invent times or coordinates.'],
 'native-methods':['原生資料另行保留；投票、權重與方法欄位尚未對照驗收。','Retain native archives; votes, weights and method fields need separate mapping acceptance.'],
 'handoff-history':['交接歷程另行保留；不轉成參與事件或共識。','Retain handoff history separately; it does not establish participation or consensus.']
};
export function metagovReadinessView(project,lang){
 const L=(zh,en)=>lang==='en'?en:zh,r=metagovReadiness(project);
 return `<details class="metagov-readiness"><summary>${L('對外格式檢查 · Metagov','External format check · Metagov')}</summary><p>${L('以公開模型檢查這個議題的轉換缺口。對照草案與逐筆 Statement 匯出都可在本機檢查；尚未經對方驗收。','Check this issue against the public model. Inspect the draft crosswalk and per-record Statement exports locally; no external acceptance is claimed.')}</p><p>${r.counts.records} ${L('筆紀錄','records')} · ${r.counts.rounds} ${L('輪','rounds')} · ${r.counts.sourceLinks} ${L('條來源連線','source links')}</p><ul>${r.checks.filter(c=>c.count).map(c=>`<li><strong>${c.count}</strong> · ${L(...messages[c.code])}</li>`).join('')||`<li>${L('尚無資料可檢查。','No records to check yet.')}</li>`}</ul><p class="small">${L('候選角色須逐筆確認；缺少必填欄位時，不用假身分補齊。完整結構仍留在私人議題備份。','Candidate roles need individual review. Missing required fields are not filled with invented identities. Keep the full structure in the private workspace backup.')}</p><div class="actions"><button type="button" class="subtle" data-action="open-metagov-export">${L('準備 Statement 匯出','Prepare Statement export')}</button><button type="button" class="subtle" data-action="export-metagov-check">${L('下載檢查報告（不含原文）','Download check report (no source text)')}</button><a href="${METAGOV_SOURCE}" target="_blank" rel="noreferrer">${L('核對的模型版本','Inspected model revision')} ↗</a><a href="/data/metagov-crosswalk.json" target="_blank" rel="noreferrer">${L('欄位對照與限制','Field mappings and limits')} ↗</a></div></details>`;
}
