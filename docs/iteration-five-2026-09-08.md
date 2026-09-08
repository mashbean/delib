# Delib 第五輪：介面與資料交接

2026-09-08。接續 `49ddbf9` 的準備盤點；把先前未提交的主持工作功能一併完成檢查。

## 已實作

- Part 0 與 Part 1 合成滿版 3D 首頁，保留「Delib／協助審議的一站式工具」。亮色背景、霧、格線、標籤與人流配色隨主題切換；八站的資料形狀與流向可見。場域高度依模擬輪次實際 phase.mode 變化。
- 八張流程卡共用既有流程資料。常駐 IN／OUT，工具、主持、換場條件依需要切換。左右鍵、Home／End 可操作，手機使用橫向卡列與自然頁面捲動。
- 模擬工作區改為資料流程、人物旅程、步驟操作、主持練習四個頁籤。桌面限制細節區高度；小螢幕先顯示目前步驟，完整資料圖可展開。
- 14 位虛構角色各有卡牌、三輪八步旅程、原話與衍生成果連結及可下載 JSON。困難、主持支持與正向感受標為編寫情境，不當成實測情緒。此版採 icon 卡面，未生成擬真人像。
- 工具卡每頁最多六張，完整 38 項索引保留。
- 交換台改為來源 → 轉換 → 目的地，附逐筆檢查、來源雜湊、明細損失報告、下載與本機撤回。舊 CSV 多檔合併放在展開區。
- 主持工作區以專注一步為預設。意見去向、責任承諾、缺席經驗各自記錄負責人、日期、登記者與歷史；未解事項可延續三輪以上。文字檢查不等於採納或承諾。參與者收據不帶出私人補招募筆記。

## 資料契約及相容範圍

`public/data/adapter-matrix.json` 記錄來源程式版本、檔案格式、能力及缺口。

| 來源 | 本輪可用路徑 | 保留／限制 |
| --- | --- | --- |
| Form | 原生 JSON → exchange | 題型、答案原值、時間；只有指定文字題進入文字交接 |
| Harmonica | 原生 JSON → exchange | 訪談角色、前後文；訪談者提問不混入原話 |
| TTTC | report.json → exchange | 主題、引文、原始 commentId；需原 CSV 對照表與精確文字才接回來源 |
| Reply | receipt.json → exchange | 原問、回覆角色與關聯；模型回覆保持草稿 |
| Values | graph.json → exchange | 價值卡、成對圖譜、強度；經確認的整理不冒充逐字原話 |
| Budget | results.json → exchange | 預算選項、票數、分配方案；原生檔不含逐人理由 |
| Check | results.json → exchange | 題目統計；答對率不解讀成同意程度 |
| Proposals | space.json → exchange | 現行提案與版本號；原生檔缺修正案全文、回覆全文與歷史 |
| Argument | tree.json → exchange | 支持／反對關聯與強度；強度不是共識 |
| Maple | archive.json → exchange | 可見證詞、立場、修訂旗標；缺少紀錄不推定已撤回 |
| Polis／Power Ranker | 既有 delib-data 匯出 → exchange | 保留回應值、計數與成果；排除參與者串連碼並報告損失 |
| Call-in 等 | tttc.csv → exchange | 文字相容橋接；非完整簡報、反應與投票封裝 |
| Civic Talk | 公開意見 API 回應 JSON → exchange | 只轉交正常、非空意見；公開作者欄位排除，素材與 briefing 另存 |
| Sensemaker | exchange → 後端 comments JSON | 不補造 voteInfo；網頁選檔入口仍只收 CSV，尚非可直接操作的完整往返 |

`delib-exchange/v1` 是 Delib 私人伴隨封套，與既有 delib-data／rounds／workspace 各有用途。這輪用轉接器統一交換層，**沒有改寫每個獨立服務的原生匯出 API**，也未宣稱形成生態系既有標準。

本機匯入不傳送資料。來源原文仍可能識別人；排除姓名欄位不等於完整匿名化。同意與保存期限不從來源欄位推定。撤回會清除該筆原文欄位、清除受影響來源的原生保留資料、停止輸出並標記衍生成果待覆核；遠端副本與模型衍生文字仍須另行處理。

## 外部來源查核

2026-09-08 讀取官方原始碼，僅採格式互通，未複製第三方工具實作：

- [Civic Talk 公開意見與作者欄位](https://github.com/g0v/civic-talk-hono/blob/main/src/db/queries.ts)、[API 路由](https://github.com/g0v/civic-talk-hono/blob/main/src/api/routes.ts)：公開回應為 Opinion[]；被隱藏的內容不補造。
- [Sensemaker JSON parser](https://github.com/bestian/sensemaker-backend/blob/master/src/utils/parseJSON.ts)：接受 comments 陣列，voteInfo 可缺。
- [Sensemaker 網頁選檔](https://github.com/g0v/sensemaker-frontend/blob/master/src/components/CsvUploader.vue)：目前限制 CSV。
- [Sensemaker CSV 轉換程式](https://github.com/bestian/sensemaker-backend/blob/master/src/utils/csv_converter_new.ts)：存在從 moderated 推算 passes 的做法；Delib 不沿用此推算，審查狀態和跳過投票是不同概念。此檔存在不等於所有部署路徑都會執行它。
- 讀取時 Sensemaker backend 與 core repo 的授權欄位未提供明確授權，未將其程式碼納入 Delib。

## 驗證方式

- `npm run check`：場景建置、所有 JS 語法、Worker types、TypeScript、前端／Worker 測試與正式環境部署 dry-run。
- `scripts/qa-iteration-five.mjs`：亮暗 WebGL、無 WebGL 備援、流程卡鍵盤、14×3×8 旅程、320／390／1024／1440 寬度、原生 JSON 範例、雙檔下載、精確引文接回、本機撤回。攔截所有非 GET／HEAD，不建立上游活動。
- `scripts/qa-workspace.mjs`：完整 Form → TTTC → Reply fixture 往返、人工檢查、收據、重整復原、下一輪與私人備份。
- `scripts/qa-appearance.mjs`：五個主要介面、主題保存／系統偏好／鍵盤／儲存受限、SVG 匯出、手機 IN→OUT。

## 下一輪明確缺口

1. 在各服務建立版本化完整匯出：Proposals 修正與回覆歷史、Budget 逐人理由、Check 回饋、Maple 撤回事件。現在的封套只能保留實際提供的欄位。
2. Sensemaker 增加 JSON 網頁入口，並以獲授權的測試活動驗證分析結果與原始來源的完整往返。
3. 跨服務撤回需要各服務提供刪除／撤回確認與權限機制；本機 tombstone 不能替代它。
4. 人物的卡面與各步情境可繼續深化；當前感受卡為人物層級，尚未逐步編寫 336 個情緒事件。
5. 桌面細節區與人物長列表仍有局部捲動。已測瀏覽器尺寸和鍵盤，尚需真實觸控裝置、螢幕閱讀器及不同 GPU 的人工可用性回饋。

本輪本機結果：156 項前端測試、56 項 Worker 測試全部通過；三組瀏覽器驗收通過。正式站部署結果另以實際版本與公開網址讀回確認。
