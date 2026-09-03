# Changelog

日期以正式站部署為準。每一版列出「使用者看得到的改變」與「營運者需要知道的改變」，資料邊界的變動另外標明。

## 0.2.0 — 2026-09-03

接手後的第一次整體體檢與修復。詳細盤點與改善建議見
`output/delib-takeover-2026-09-03/`（meta repo）。

### 使用者看得到

- 首頁改成「三條路 → 你的拼圖 → 直接啟用 → 工具比較 → 流程地圖」的順序；
  第一次來的人先做選擇，流程地圖變成參考資料。
- 路徑 B「我已經辦完活動或收完資料」改成真正的資料交接入口：先選手上是
  Pocket Polis CSV、Power Ranker 個人結果 JSON，或貼上本站成果網址。
- 分享成果連結後，收件人打開會直接落在推薦區並取得焦點；`/#start` 會打開精靈。
- Power Ranker 現在會出現在推薦卡與目錄的「在這裡使用」按鈕（先前因為
  activation 名稱不一致而永遠沒有按鈕）。
- 工具目錄與精靈等互動在資料載入前就能用；目錄讀不到時顯示可重試的錯誤，
  不再讓表單以 GET 送出。
- 手機版補上選單；鍵盤焦點框改成深紫色（原本的萊姆綠在白底上幾乎看不見）；
  次要文字對比提高到 AA。
- 內嵌工作區不再宣稱「已載入」，並提醒空白時改用原站開啟；Pol.is 內嵌不再把
  整個網址（含標題）當 referrer 送出。
- 成果頁與部署中心加入讀取中與失敗狀態；`/r/` 短網址找不到或到期時會看到
  白話說明，而不是一段 JSON。
- 站內連結改用不帶 `.html` 的網址，少一次轉址。
- 英文裝飾標題改為正體中文；「token」「session 雜湊」「Worker」等術語在
  使用者看得到的地方改成白話。

### 營運者需要知道

- Durable Object 不再「讀取就建表」：查詢不存在的短網址或收件室不會留下
  永久儲存；刪除時一併清除 alarm。
- 上游呼叫（Call-in、Pocket Polis、Harmonica、OpenAI）加上逾時，逾時回 504。
- Worker 加上錯誤邊界；`observability` 改為開啟並全量記錄（不記錄 body
  與 header）。
- `/api/health` 支援 HEAD，回傳版本號、Git SHA 與 Cloudflare 版本時間。
- production 環境加入每 IP 的寫入限流（建立類 20 次／分鐘，排序提交
  120 次／分鐘）；限流服務故障時放行。
- 只有 `/api/*` 與 `/r/*` 走 Worker；靜態頁面由 Workers Static Assets 直接
  提供，安全標頭改由 `public/_headers` 設定。
- 公開成果收據的來源連結只接受 Pocket Polis 公開成果頁路徑；Power Ranker
  彙整連結必須在本站；新增營運者下架權杖（`OPERATOR_TOKEN_SHA256`）。
- 新增 `scripts/smoke.mjs` 唯讀煙霧測試、`deploy.yml`（main → 檢查 →
  部署 → 煙霧測試，未設定 secret 時略過部署）、`uptime.yml`（每 30 分鐘探測）
  與 Dependabot。
- 開發者回饋改為逐欄預填 GitHub issue 表單，表單欄位對齊
  `delib-feedback/v1`；repo 建立了對應標籤。
- Skill 安裝器支援 `--target claude|codex|all` 與 `--force`。
- 部署中心把「已驗證」改成「設定已檢查」，並逐一寫明驗證到哪一步。

### 資料邊界

- CSP 允許 Cloudflare Web Analytics 的 beacon（zone 已注入，先前只是被 CSP
  擋掉並在每次載入產生錯誤）。它不用 cookie、不辨識個人；頁尾已揭露。

## 0.1.0 — 2026-09-01

第一個可操作版本。

1. 四步需求精靈；
2. 28 個工具的可搜尋目錄與 deterministic recommendation；
3. 線下／線上流程配方；
4. 不含自由文字與個資的分享連結；
5. `delib-bundle/v1` JSON 與 Markdown runbook 下載；
6. BYOK OpenAI Responses API 協作；
7. `skills/delib/SKILL.md` 與機器可讀的 `/.well-known/delib/SKILL.md`；
8. 直接在站內建立七天的 Call-in 活動，不需帳號；
9. 免登入在 `polis.mashbean.net` 代建 Pocket Polis，交回參與、成果與私人管理連結，並提供 Agent 準備提示；
10. 把 Pocket Polis 的 `statements.csv` 與 `votes.csv` 留在瀏覽器本機檢查，下載可攜 JSON、TTTC CSV 或 Agora 三檔匯入包；
11. 把 Pocket Polis 彙整接成 `delib-pocket-polis-receipt/v1` 公開成果頁，讓主辦者挑選通過門檻的陳述並補上解讀、缺席聲音、權責與下一步；
12. 在站內嵌入既有官方 Pol.is 對話，或用 Site ID 準備自動建立工作區；
13. 在站內嵌入既有 Agora Citizen Network 公開對話；
14. 在站內嵌入已發布的 HeyForm 表單；
15. 在站內開啟 Talk to the City 官方建立流程，登入與 CSV 不經 Delib；
16. 使用 tab-only Harmonica API key 直接建立 AI 對話 session，或複製 MCP 啟動提示；
17. 使用內建 Power Ranker 完成本機成對排序，或建立 24 小時／7 天自動清除的多人結果收件室；
18. 把群體彙整接成 `delib-ranking-receipt/v1` 成果頁，分開呈現工具計算、主辦者解讀、未納入聲音、決策狀態與下一步責任；
19. 從兩種成果頁預覽並帶入 `delib-handoff/v1` 草稿，接續 Call-in 成果回報、Harmonica 補訪、TTTC 文字整理或 Pol.is 新一輪；
20. `delib-integrations/v1` 與 `delib-hosting/v1` 盤點，加入 Pocket Polis、Agora 與 Parti DemosX，明確區分可用、共用託管、元件、研究與阻擋項目；
21. `delib-data/v1` 通用跨工具資料層，先提供 Pocket Polis 與 Power Ranker（個人／群體）轉接器，保留來源 schema、provenance 與匿名串連風險；
22. 成果頁可選擇建立 16 字元公開短網址，保存 30 天、1 年或 3 年；只存已去連結化公開收據，私人刪除網址的 token 只留在 `#` 後方；
23. `/deploy` 一鍵部署中心，集中 Delib、Pocket Polis、Call-in 三個可重現配方，並誠實列出 Pol.is、Agora、TTTC、HeyForm、Harmonica 與 Parti DemosX 的維運邊界；
24. `/feedback` 開發者回饋迴路，以 `delib-feedback/v1` 在本機預覽 schema 缺口、轉接失敗與部署摩擦，再由使用者明確下載或開 GitHub issue；CI 會在 PR 與 main 執行完整檢查；
25. 首頁 `delib-process/v1` 八步流程圖，以同系列 Lucide 開源 icon、紫色人流與綠色資料流呈現招募、sortition、共同學習、審議、回覆和下一輪；點選後才展開工具、人工關卡與交付成果；
26. 首頁 `delib-tool-comparison/v1` 先比較「怎麼開始」與「資料能帶去哪裡」，部署責任和授權改為按需展開；八個站內工具入口及完整 28 項目錄也採漸進揭露。
