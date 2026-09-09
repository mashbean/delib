// Dated acceptance snapshots. These are not live uptime or blanket conformance claims.
export function interopEvidenceView(lang) {
  const L=(zh,en)=>lang==='en'?en:zh;
  return `<details class="interop-evidence"><summary>${L('互通驗證到哪裡？','What has been verified?')} · 2026-09-09</summary><ul>
  <li><strong>Form → TTTC → Reply</strong> — ${L('正式服務以 3 則虛構原話完成分析、回覆與第二輪接回；測試活動已清理。','Production synthetic test: 3 sources, analysis, replies and round-two lineage. Test activities deleted.')}</li>
  <li><strong>Proposals → Delib</strong> — ${L('正式 archive.json 保留原案、修正理由、採納版本及回應；測試空間已清理。','Production archive.json retained the original, amendment rationale, accepted version and response. Test space deleted.')}</li>
  <li><strong>Polis → Delib</strong> — ${L('只讀公開匯出，保留 2,923 筆投票回應；未驗證反向匯入或重新分群。','Read-only public export preserved 2,923 vote responses. Reverse import and re-clustering were not tested.')}</li>
  <li><strong>Sensemaker → Delib</strong> — ${L('依公開程式碼核對並測試結果 JSON；尚未做遠端分析驗收。摘要待人工審閱，沒有逐筆來源關聯。','Result JSON checked against public source code and local fixtures. No remote analysis acceptance; summaries need review and lack structured source links.')}</li>
  </ul><p>${L('其他工具維持格式測試狀態；這些驗證不代表全部工具可雙向交換。','Other tools remain at format-test status. These checks do not establish bidirectional support for every tool.')} <a href="/data/adapter-matrix.json" target="_blank" rel="noopener">${L('格式與限制','Formats and limits')} ↗</a> · <a href="/data/interop-evidence.json" target="_blank" rel="noopener">${L('驗收紀錄','Acceptance evidence')} ↗</a></p></details>`;
}
