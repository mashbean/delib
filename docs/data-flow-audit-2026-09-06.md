# Delib 資料交接與跨輪審議稽核

日期：2026-09-06。以下以本機程式碼及本機解析測試為證據；不是對每個公開服務的端到端驗收。

目前已經有可用的文字交換格式，但還沒有一個能讓所有工具原生讀寫、且不丟失語意的完整審議標準。`id,interview,comment` 讓 Form、Harmonica、Call-in、Polis 的文字可以交給 TTTC、Reply；票數、提問關係、參與同意、跨輪責任與資料刪除不能靠這三欄傳遞。本次加上 `delib-rounds/v1`，把既有 `delib-data/v1` 當成內容封套，另保留跨輪脈絡，而不把文字格式相容寫成整個流程已自動互通。

**English:** Text exchange is implemented, but full semantic interoperability is partial. The shared CSV carries source text into TTTC and Reply. It does not transfer votes, consent, identity, consensus, decision authority or deletion state. The new versioned rounds companion preserves provenance, attendance mode, review gates and next-round commitments. Local parser compatibility is verified; live multi-service orchestration is not claimed.

## 已查證的工具契約

| 工具／本機版本 | 已查證的輸入與輸出 | 可以怎麼接 | 尚未查證或會遺失的語意 |
| --- | --- | --- | --- |
| Pocket Form `8a16dbd` | `src/form-room.ts` 的 `exportTttcCsv()` 輸出 `id,interview,comment`；id 為 `pN-qN`，interview 為 alias 或 `pN`。多文字題會把題目加到文字前。`exportSeeds()` 回傳前 15 句去重文字、每句截到 280 字。另有寬表及完整 JSON。 | 文字可交給 TTTC／Reply；`seedStatements` 可作 Polis 的建立參數。 | 表單原生尚無 `delib-data/v1` 匯出。三欄 CSV 不含題目型別、同意、量表、回覆更新時間；前 15 句不保證議題平衡。既有原生截字行為，本次沒有改動。 |
| Pocket Harmonica `1696165` | `src/session-room.ts` 只匯出 participant 發言；id 為 `pN-mN`，interview 為 alias 或 `pN`。`transcripts.json` 另保留訪談者對話。`src/index.ts` 的 `analyze()` 存在 TTTC `/api/reports` POST 路徑。 | `tttc.csv` 可給 TTTC／Reply。主辦者分析動作已有呼叫 TTTC 的程式碼。 | CSV 沒有訪談者問題、完整逐字稿角色、同意或修正紀錄。本次未發出該分析 POST，不能因此宣稱正式站端到端執行成功。 |
| Call-in `6af2703` | `src/live-session.ts` 的 `exportTttcCsv()` 只取已公開提問；id 為 `question-ID`，interview 為公開暱稱加 lens；不帶 voter_id。 | 公開提問可以作 TTTC 素材或 Reply 問題池。 | CSV 沒有掌聲、支持票、私密／待審提問及完整主持紀錄。公開暱稱仍可能讓人識別身分。本次稽核時其他工作曾修改 `src/index.ts` 與契約測試；此處對照的匯出函式未更動。 |
| Pocket Polis `af19495` | `src/export.ts` 的 TTTC 輸出只帶已核准文字；`statement-N`、`host`／`pN`。`src/service.ts` 接受 `seedStatements` 最多 50 句，陳述上限 280 字。另有 statements／votes CSV。 | 用 statements＋votes 經 Delib 既有轉接器建立 `delib-data/v1`；TTTC CSV 作文字整理；種子開新一輪。 | 新一輪種子不帶舊票數、舊參與者或原有分析結果。TTTC CSV 不等於完整 Polis 資料匯出；不能把文字摘要當成 Polis 共識結果。 |
| Pocket TTTC `4aa8a00` | `src/csv.ts` 的 `parseSourceCsv()` 接受 id、comment，interview 可選。id ≤120、comment ≤2000、interview ≤200、CSV ≤3 MiB；目前 `MAX_ROWS=600`。`report.json` 與 claims CSV 保留 `commentId`／`comment_id`、引文、主題。 | 本次 3 輪 × 中英文匯出都通過這個實際原生 parser。 | 輸入解析成功不等於 AI 分析完成或引文正確。`people` 是依 interview 分組，空白時改用來源列 id，不能保證真實不重複人數。 |
| Pocket Reply `7cbf5ba` | `src/csv.ts` 的 `parseQuestionsCsv()` 接受 TTTC 三欄，也接受 question/text、name 等別名；目前預設 400 列、3 MiB。`replies.csv` 含 `qid,source_id,name,question,beat,role,reply`；`receipt.json` 保留原問與回覆。 | 本次雙語三輪都通過原生 parser；`source_id` 可回到交接 manifest 的原 id。 | 建立分析須確認以發言者名義回覆的權限。草擬回覆不是正式承諾；本次未啟動公開服務的 AI 管線。 |
| Delib `a122b74` 基底＋本次變更 | 既有 `delib-data-core.js` 已有 Pocket Polis／Power Ranker 轉接器；本次新增 rounds、CSV handoff 與 rounds→delib-data 轉接器。 | 保留文字之外的原始資料包；用 rounds 連結階段、原始來源、參與方式、待回覆事項。 | Form／Harmonica／TTTC／Reply 尚無統一的原生 rounds 匯入 API，也沒有跨服務的全域刪除或同意管理。 |

### 人數是這次最容易被誤讀的欄位

TTTC 的 `src/pipeline.ts` 用不同 `interview` 值計算來源分組；空值改為來源列 id。這有兩種相反錯誤：一人多列且 interview 為空，可能算成多人；不同工具各自產生的 `p1`，直接合併則可能被算成同一人。

新的交接工作台預設把每份檔案的暱稱映射成 `source-1:group-1` 之類代碼。同一來源內保留分組，跨來源不自行認人；畫面稱為「來源內群組」，不稱為參與人數。這避免偶然合併，仍不能證明同一暱稱就是一個人，也不能計算跨工具不重複人數。若研究需要追蹤同一位參與者，應另設事前同意、活動限定代碼與私下保管的對照，不靠文字或投票模式猜測。

`exportTttcCsv()` 的一般預設把 interview 留白；這是減少直接帶出分組的選項，不是去識別化保證。虛構範例可明確使用 `includeParticipantRefs: true`，保留已標示為模擬的角色代碼。無論哪個選項，都不要從輸出的 CSV 推算母體人數。

## 本次已實作的改善

1. **跨來源 id 不再碰撞。** 舊 `mergeTttcFiles()` 遇到重複 id 只加 `f2-`，如果原檔已存在 `f2-x`，仍會製造第二個相同 id。現在會預留所有原始 id、逐次找不重複後綴，並確保輸出不超過原生 parser 的 120 字限制。交接工作台會替所有來源加前綴。
2. **來源對照可追溯。** `/handoff` 在本機讀入 CSV、計算原始檔案位元組的 SHA-256、預覽、合併。CSV 旁的私人 JSON 保留來源檔名／雜湊、原 id、原 interview、輸出 id 與來源內代碼。重複選取內容完全相同的檔案會擋下，不會默默把證據加倍。
3. **不默默丟掉文字。** 重複句子保留但提醒；超長文字、錯誤欄位、檔內重複 id 由 parser 阻擋。CSV 的三個欄位都處理試算表公式前綴；原檔雜湊與對照表保留變換的查核路徑。
4. **目的工具限制可見。** 每檔 3 MiB、最多 20 檔，另查合併後 3 MiB 與 TTTC 600／Reply 400 列限制。超過兩個目的工具的目前容量，不提供看似可直接使用的下載；401–600 列明確提醒只有 TTTC 符合列數限制。
5. **跨輪是顯式關係。** `delib-rounds/v1` 保存有序的八步驟、previousRoundId、來源衍生關係、線上／實體出席、未回覆項目、下一階段、理由、責任人與檢視日期。匯出第 2 輪會保留第 1 輪，避免衍生來源成為斷鏈。
6. **匯出前驗證語意。** `validateFlowBundle()` 檢查來源斷鏈、未來來源、同階段循環、重複投票、未出席參與者、缺少雙語引導、未定義狀態與疑似直接識別碼。已撤回狀態不屬於本版支援集合，會拒絕匯出而非默默再分享。真實參與者連結資料只能是私人匯出。
7. **種子是新問題，不是舊民意。** 只輸出主持人已覆核且狀態為 reviewed 的方案，最多 50 句、每句 280 字；超長時要求修訂，不直接截斷。保留來源映射，但不搬票數、不搬人、不宣稱支持或同意已轉移。

## 可重播的三輪案例

`public/data/flow-demo.json` 是預先編寫、可重播的虛構青溪社區徒步街案例。14 位虛構角色輪流加入／離開，每輪 12 位；每輪有 33 件資料產物及 48 筆預設回應，合計 99 件產物、144 筆回應。每輪的 8 則 Form 意見、4 則 Call-in 問題、4 則 Harmonica 意見可匯出為 16 列來源文字。主題、草擬回覆與決定也是人工編寫的示範資料，不是對外呼叫服務的結果。

| 輪次 | 人流 | 從工具得到什麼 | 哪些事情沒有被「共識」掩蓋 | 回到哪裡 |
| --- | --- | --- | --- | --- |
| 1：聆聽與分歧 | 8 線上／4 實體 | Form＋補訪→附來源主題→4 項 Polis 候選→Reply 回覆 | 「全面禁止配送」只有 3 同意、8 不同意、1 略過；無障礙與照顧需求仍須設計。 | 招募：補邀到宅照顧者、巷弄居民。 |
| 2：補聲音與修訂 | 5 線上／7 實體 | 用現地走讀與來源提問，修訂晨間試辦、通行例外、停止條件。 | 店家平均分攤成本方案為 2 同意、9 不同意、1 略過；經費責任不能跳過。 | 共同學習：帶入模擬觀察、經費選項與修正。 |
| 3：回覆與再檢視 | 7 線上／5 實體 | 回覆追到原問，保留條件、反對理由與下一輪日期。 | 全天徒步區方案為 2 同意、9 不同意、1 略過；沒有宣稱真實交通改善。 | 第 4 輪問題定義：持續檢查巷弄影響、照顧通行與輪值負擔。 |

抽樣階段明確記錄「本例是定向邀請，未執行隨機抽樣」。來源內代碼、投票數、模擬角色比例都不能升格成代表性樣本或正式政策授權。

## 本次驗證與邊界

- `test/flow.test.js`：9 項測試，涵蓋三輪雙語引導、實際資料列計數、反對／略過保留、來源 CSV round-trip、識別碼阻擋、跨輪來源保存、斷鏈／循環／重複票、種子覆核／上限、撤回阻擋、真實／模擬標記分流、delib-data 計數轉接。
- `test/tttc-csv.test.js`：6 項測試，包括原有相容行為、新的前綴再碰撞／後續原 id 保留／120 字上限、別名來源隔離與三欄公式防護。
- `test/handoff.test.js`：5 項測試，涵蓋 SHA-256 對照、來源 id／alias 可追溯、重複檔案阻擋、隱私與缺少分組提醒、3 MiB 及兩種原生列數上限。
- 額外直接 import 本機 `tttc-serverless/src/csv.ts` 與 `pocket-reply/src/csv.ts`：3 輪 × 中英文，每份 16 列，兩個原生 parser 得到一致的 id 與文字。這項測試不寫入外部服務。
- 瀏覽器實際操作 `/handoff.html`：載入模擬資料後顯示 3 檔／48 列／36 個來源內群組，顯示重複句子提醒；中英文切換、清除、重新整理後無殘留資料。390px 手機寬度的兩個工作卡為單欄 354px，文件 scrollWidth=390，無水平溢出；console 無 error／warn。
- 本次沒有送出真實活動、呼叫任何上游 AI 分析、測試正式站管理 token、刪除遠端參與紀錄，或證明各工具已能互相匯入整份 rounds bundle。

## 下一步要實作的互通，而非目前已完成的能力

優先為 Form、Harmonica、TTTC、Reply 寫原生 JSON → `delib-data/v1` adapters，保留欄位語意與 `sourceId`。接著加入具版本的個別 adapter contract tests、withdrawal tombstones 與衍生產物失效機制，讓撤回能沿來源連結傳遞；目前只拒絕未支援的撤回資料，不假裝已從所有目的工具刪除。

跨工具參與者對照應採活動限定的明確同意，並與聯絡資訊分離。對公開成果建立單獨的人工覆核／彙整輸出，保留未採納原因與責任日期；不要把個別投票圖或私人來源對照表直接當成成果頁。需要一鍵交接時，每個接收工具應先提供可讀的資料用途／保存與公開範圍，再由使用者確認目的地；不能因同屬 `delib.mashbean.net` 系列入口就推定所有服務的資料權限相同。

**English next steps:** Add native JSON adapters and contract fixtures for Form, Harmonica, TTTC and Reply. Carry withdrawal tombstones through derivation links, establish explicit activity-scoped consent for person linking, and publish reviewed aggregates separately from linked records. A shared navigation domain does not imply a shared data permission boundary.
