# Bilingual playbook and attributed public-data rehearsal

## 中文

`/playbook?lang=zh` 將操作縮成六個任務，附第一次使用的操作路徑、換工具／場域的判斷、論文至實作的五項對照、價值與成本邊界。英文為 `/playbook?lang=en`。首頁與工作台皆提供入口。

論文全文沿用已下載並核对的 5 頁 ACM CC BY 4.0 PDF；本輪重新讀取全文，對照 §§2–6、圖 1 與現有實作。主要落點是可追溯的跨工具轉換與治理循環，而不是宣稱通過完整 Metagov ontology 驗收。下一步建議優先做來源逐筆核對、共同 fixture 往返驗收與角色／採樣／評估記錄。

公開示範使用 Computational Democracy Project `openData/vtaiwan.uberx` 的 `comments.csv` 和 `summary.csv`，固定 revision `3be5785c3f5975d31f4578ee8bbf4426d45b7bf2`，CC BY 4.0。197 則原始意見中編輯挑選 ID 3、4、7、8、12、17，展示價格、派遣、保險、稅務與相反平台定位；不是随机樣本或支持度排名。6 則原文與計數不修改，作者 ID 和逐人投票不納入。源檔日期包含 2015–2016 年，不把檔案等同單場會議。

可在本機以 `python scripts/build-public-replay.py /path/to/pinned/files` 重建 `public/data/uberx-replay.json`；JSON 保留 SHA-256、固定版本、來源、授權、選擇規則及排除欄位。英文翻譯是 Delib 新增閱讀輔助，交接保持中文原文。

六段演練使用真正的 `planTransfer`、`readNativeFile`、`planNativeImport`、`applyNativeImport`、`nextRound`。TTTC 與 Reply 結果為預先編寫的教學資料，不呼叫外部服務。實體覆核是明示假設，原發言者及政府沒有被冒充為覆核或回覆者。保留 `simulated: true` 禁止站內服務送出；來源原話由 `sourceEvidence` 標示為歷史資料，種子／參與者來源未知。

每一步可下載工作台檔；交接階段可下載 CSV、私人對照包與教學原生結果。開啟工作台先透過既有 IndexedDB store 保存，再以 sessionStorage 選定該演練，保留原有議題。保存失敗顯示錯誤並仍可下載，沒有默默當成保存成功。

低成本的說明限於免安装、減少重複建置與搬運、結果可跨輪延續；沒有虛構節省金額或百分比。另列託管／推論、招募、主持與參與支持等成本，提出同任務測量方式。

## English

`/playbook?lang=en` reduces the interface to six practical tasks, with first-use instructions, criteria for switching tools/settings, five paper-to-implementation mappings and bounded cost/value claims. The Chinese version is `/playbook?lang=zh`; both are linked from the homepage and workspace.

The full five-page, CC BY 4.0 ACM paper was reread from the verified local download. The mapping covers §§2–6 and Figure 1, emphasizing traceable transformations and recurring governance rather than claiming complete Metagov ontology acceptance. Priorities are per-reference reconciliation, partner round-trip fixtures and explicit role, sampling and evaluation records.

The public-data fixture pins Computational Democracy Project `openData/vtaiwan.uberx` to revision `3be5785c3f5975d31f4578ee8bbf4426d45b7bf2`, CC BY 4.0. IDs 3, 4, 7, 8, 12 and 17 are an editorial subset of 197 statements covering pricing, dispatch, insurance, taxation and conflicting platform definitions. Selection is neither random nor based on support ranking. Original wording and counts remain unchanged; author IDs and individual ballots are omitted. The export includes 2015–2016 records and is not represented as one meeting.

Rebuild the attributed fixture with `scripts/build-public-replay.py` and pinned input files. The generated JSON includes the hash, revision, attribution, license, selection and excluded fields. English translations are reading aids added by Delib; outgoing source text stays in Chinese.

All six stages run the actual transfer planner, native import validation/reconnection and next-round functions. Prewritten TTTC/Reply teaching outputs replace external calls. The in-person step is explicitly hypothetical. No original speaker or government is impersonated as a reviewer/responder. `simulated: true` preserves the no-service-send guard; source evidence identifies historical statements with unknown seed/participant origin.

Each stage supports workspace download and, where applicable, CSV, companion and native teaching-result downloads. Opening the workspace saves through the existing IndexedDB store and selects that rehearsal in sessionStorage without replacing other issues. Save errors leave the download path available.

Cost claims cover reduced setup, data handling and repeated reconstruction, not unmeasured monetary or percentage savings. The guide includes hosting/inference, recruitment, facilitation and participation-support costs and proposes a same-task comparison.

## Verification / 驗證

Contract tests exercise six stages in both languages, untouched source text, count separation, conflicting views, exact source reconnection, unreviewed response drafts, simulated-only lifecycle states, and open-question carry-forward. Browser and production results are recorded in the task’s final release summary. Private meeting correspondence is kept outside the public repository.

Local verification completed: 288 unit tests + 57 Worker tests; scene/schema builds, types and deployment dry run passed. CUA verified Chinese desktop/light and English desktop/dark, 390px layout without document overflow, keyboard next-step focus, opening the generated second round in the workspace, reload persistence, and both navigation-language links. Stage downloads share stable IDs within the rehearsal sequence; a dedicated test reconnects files downloaded from different stages. Historical count fields remain numeric in `methodData` and absent from outgoing text CSV.

本機驗證：288 項單元測試＋57 項 Worker 測試通過，建置／型別／部署試跑通過。浏览器驗證中英文、亮暗色、390px 無頁面橫向溢出、鍵盤下一步焦點、第二輪開啟與重載保存、首頁語言連結。演練步驟間保持相同 ID，測試確認不同步驟下載的檔案可相互接回；歷史票數以數值 `methodData` 保存且不進入文字 CSV。
