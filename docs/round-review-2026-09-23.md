# P4–P6 continuation: round reviews / 輪次回顧

## Delivered / 本輪交付

主持工作室新增預設的「輪次回顧」分頁，串接本輪場次、參與缺口、前輪未結更正與提案。摘要可帶入下一輪草稿；主持人仍要編輯具體問題、指定負責者與日期。原有工作台備份格式不變。

The facilitation studio now opens on a round review connecting current-round sessions and participation gaps with earlier open corrections and proposals. A draft can populate next-round planning; a facilitator still edits concrete questions and assigns an owner and date. The workspace backup schema is unchanged.

- `/facilitate?lang=zh&tab=review` and `/facilitate?lang=en&tab=review`.
- `/workspace?lang=zh&view=route&step=next` opens the selected round's next-round panel; an earlier round links to its existing successor. The one-time step parameter is consumed so reload does not reset subsequent work.
- Live checks expose source corrections, superseded proposals, withdrawal impacts, missing review/evidence and response/support thresholds. Passing them does not establish authority, consensus or representativeness.
- Counts remain per session. Every rating has its own response denominator; missing scores remain unknown, not zero. Planned sessions have no missing-feedback count.
- Unfinished progressions carry their exact proposal and evidence references into the next round, even if those records were already reviewed. Superseded records remain audit references; they are not silently replaced or approved for transfer.
- Private Markdown export includes both Chinese and English labels and source-language feedback and minority-view notes. User-entered text is preserved, not machine-translated. Nothing is sent to partners or external services.

## 使用順序 / How to use

1. 在主持工作室選議題及輪次，展開「更正與責任」、「參與障礙與回饋」、「提案條件與少數意見」。／Select an issue and round, then inspect corrections, barriers/feedback and proposal conditions/minority views.
2. 場次障礙若需持續追蹤，前往「誰還缺席」記錄支持措施、責任人與日期。／Register ongoing barriers as participation tasks with support, an owner and a date.
3. 選「規劃下一輪」。在「從主持紀錄回顧本輪」選「帶入草稿，再編輯」，補充具體問題並建立下一輪。／Choose “Plan the next round”, expand the facilitation review, use the draft, edit concrete questions and create the next round.
4. 需要會前文件時，下載中英私人回顧；分享前自行刪除不宜公開的原文與代稱。／Download the private bilingual review for preparation; remove sensitive text and aliases before sharing.

## Verification / 驗證

The full local check passed 360 unit tests and 57 Worker tests (417 total), type checks and the production dry run. Nine new unit cases cover bilingual output, missing feedback, planned sessions, separate attendance counts, future-round exclusion, cross-round evidence retention, superseded references, correction resolution, legacy projects and escaped source text. The existing next-round, operation and facilitation tests remain applicable.

Browser checks used a separate fictional local issue: inspect feedback (1/2), inspect missing support and pending correction, generate a private report, open the latest round, use the draft, create round 4 with source links, and inspect English at 390px. Download generation and browser handoff are observed; actual filesystem delivery depends on the browser. No external service writes or partner outreach occurred.

新增九個單元測試案例。瀏覽器以獨立虛構議題驗證，已實際建立第 4 輪並確認來源。手機英文版無水平溢出；下載已核對產生與交付瀏覽器的狀態，不宣稱已確認使用者磁碟存檔。

## Remaining scope / 尚未完成

- 回顧是匯出當下的現況，不是凍結的歷史快照；更正與提案仍可繼續更新。／Reviews reflect current state, not frozen historical snapshots.
- 場次障礙尚不自動生成參與任務；避免把主持註記直接冒充參與者確認或正式指派。／Session barriers do not automatically become assigned tasks or participant confirmation.
- 本輪場次不與前輪場次混算。持續追蹤請建立參與缺口；跨輪去重身分與匿名前後測配對尚未加入。／Session counts are round-specific; ongoing support uses participation tasks. Cross-round deduplication and anonymous pre/post matching remain unimplemented.
- P3/P7 的 V2V、Assemblis 與 Make.org 實際可分享檔案／共同驗收仍待取得。本輪不改變外部相容宣稱。／Actual shareable partner exports and joint acceptance remain outstanding; this increment changes no external compatibility claims.
- 後續本機工作：可編輯的議程與邀請名單、明確確認後將場次障礙轉成支持任務、會前／會後問卷。／Next local work: editable agendas and invitees, explicitly confirmed barrier-to-support tasks, and pre/post questionnaires.
