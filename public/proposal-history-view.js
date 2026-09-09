const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function proposalHistoryView(bundle,record,lang) {
  const L=(zh,en)=>lang==='en'?en:zh;
  const pid=record.kind==='proposal'?record.originalId:record.fields?.proposalId;
  if(pid===undefined)return '';
  const related=bundle.records.filter(r=>r.sourceId===record.sourceId&&String(r.fields?.proposalId)===String(pid));
  const versions=related.filter(r=>r.kind==='proposal-version').sort((a,b)=>a.fields.version-b.fields.version);
  if(!versions.length)return '';
  const amendments=related.filter(r=>r.kind==='proposal-amendment');
  return `<details class="proposal-history" open><summary>${L('提案如何改變','How the proposal changed')} · ${versions.length} ${L('個版本','versions')}</summary><ol>${versions.map(v=>{
    const amendment=amendments.find(a=>a.originalId===v.fields.source);
    return `<li><strong>V${esc(v.fields.version)} · ${v.fields.version===1?L('原案','Original'):L('提案人採納修正','Amendment accepted by author')}</strong><p>${esc(v.text)}</p>${amendment?`<p><strong>${L('修正理由','Rationale')}</strong> ${esc(amendment.fields.rationale)}</p><small>${L('修正依據','Amends')} V${esc(amendment.fields.baseVersion)} · ${amendment.fields.endorsements} ${L('筆附議','endorsements')}</small>`:''}</li>`;
  }).join('')}</ol><p class="small">${L('採納不代表群體共識。回應保留在提案下，原服務未記錄回應當時的版本。','Acceptance does not establish group consensus. Responses belong to the proposal; the service does not record their version at response time.')}</p></details>`;
}
