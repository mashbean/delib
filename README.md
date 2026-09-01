# Delib · 審議拼圖

**把一場審議，拼成下一輪。**

[delib.mashbean.net](https://delib.mashbean.net) 是給非工程師、非程式專業
審議工作者的流程組裝器。回答幾個白話問題後，它會產生：

- 線下齒輪：招募、知情同意、主持、人工決策與後續責任；
- 線上齒輪：依需求推薦 Call-in、Polis、Agora Citizen Network、Talk to
  the City、OpenBook、Parti DemosX、Decidim 等開源工具；
- 一份可分享的流程成果頁、JSON 資料包與 Markdown 執行手冊；
- 可選的 AI 協作：使用者自備 OpenAI API key，或安裝 Delib skill。

推薦由公開規則計算，不由 AI 黑箱決定。AI 只協助把已選定的流程整理成
主持簡報，且不能替參與者製造共識或替主辦者作決策。

## 目前能做什麼

這是第一個可操作版本：

1. 四步需求精靈；
2. 28 個工具的可搜尋目錄與 deterministic recommendation；
3. 線下／線上流程配方；
4. 不含自由文字與個資的分享連結；
5. `delib-bundle/v1` JSON 與 Markdown runbook 下載；
6. BYOK OpenAI Responses API 協作；
7. `skills/delib/SKILL.md` 與機器可讀的
   `/.well-known/delib/SKILL.md`。
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
23. [`/deploy.html`](https://delib.mashbean.net/deploy.html) 一鍵部署中心，集中 Delib、Pocket Polis、Call-in 三個可重現配方，並誠實列出 Pol.is、Agora、TTTC、HeyForm、Harmonica 與 Parti DemosX 的維運邊界；
24. [`/feedback.html`](https://delib.mashbean.net/feedback.html) 開發者回饋迴路，以 `delib-feedback/v1` 在本機預覽 schema 缺口、轉接失敗與部署摩擦，再由使用者明確下載或開 GitHub issue；CI 會在 PR 與 main 執行完整檢查；
25. 首頁 `delib-process/v1` 八步流程圖，同時呈現招募、sortition、共同學習、審議、回覆與下一輪的人流、資料流、人工關卡和參與者／主辦者／開發者回饋迴路；
26. 首頁 `delib-tool-comparison/v1` 比較表，對照 Delib 串接、資料格式、Cloudflare 一鍵、共用主機、上游服務與開源授權，並補入 OpenDLP 與 Panelot 的 sortition 路徑。

Delib 伺服器不保存 API key 或使用者建立的流程。Power Ranker 預設仍可完全
在瀏覽器處理；只有主辦者明確選擇短期收件室時，才會保存公開題目、去連結化
pair counts 與隨機 session ID 的 SHA-256 雜湊。逐份原始判斷不落庫，資料在
24 小時或 7 天後以 Durable Object alarm 全部清除，也可由私人管理連結提前刪除。
所有排序檔仍明確標示為參與資料，不沿用「不含參與資料」的流程規劃 schema。
Power Ranker 成果收據只接受至少三份不重複 session 的去連結化群體彙整。
Pocket Polis 收據也要求至少三位實際投票者，每句公開陳述至少三份回應，且最多由
主辦者人工挑選八句；它不含參與者代號、逐筆投票、原始檔雜湊或管理 token。
兩種成果收據預設都編碼在網址 fragment，瀏覽器載入頁面時不會把它送給 Worker。
主辦者也可在成果頁另外確認公開範圍後，建立 `/r/<16 字元>` 短網址：只保存同一份
已去除個別紀錄的公開成果、主辦者說明與下一步責任，不保存匿名代碼、逐筆回應、
來源檔或管理憑證。公開副本到期時以 Durable Object alarm 全部清除；私人刪除 token
只放在管理網址的 fragment，伺服器只保存 SHA-256 雜湊。拿到公開連結的人仍可閱讀與
再次分享，因此產生前仍需人工確認。原本完全不儲存的長網址繼續作為備援。
成果接續草稿只包含主辦者已公開的解讀、限制與下一步，不含 pair counts、
陳述統計、陳述原文、個別判斷、session ID、管理連結或 credential。草稿只活在同一分頁的
`sessionStorage`，兩小時內有效且讀取一次即刪除；帶入後仍須通過目的工具原本的
欄位檢查與人工確認，才會發生外部寫入。

## 本機開發

```bash
npm install
npm run dev
```

完整檢查：

```bash
npm run check
```

## 部署到 Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mashbean/delib)

一般自架使用 `npm run deploy`，會取得獨立的 `workers.dev` 網址。官方站使用：

```bash
npm run deploy:production
```

`production` environment 才會綁定 `delib.mashbean.net`，因此 Deploy Button
不會嘗試搶用官方網域。Cloudflare 的 Deploy button 會複製 public repo、設定
Workers Builds 並部署靜態資產與兩種 SQLite Durable Object namespace（短期排序收件室、
公開成果短網址）；Delib 本體
可在 Workers Free 的額度內運作。免費方案有 Worker 與 Durable Objects 每日
限額，超過任一限額時相關操作會失敗，不會被本站自動升級成付費方案。詳見
Cloudflare 官方的
[Deploy button](https://developers.cloudflare.com/workers/platform/deploy-buttons/) 與
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/) 與
[Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)。

Deploy button 會依 `.dev.vars.example` 提示選填 `POLIS_SITE_ID`。這是
Pol.is 帳號自動產生的公開識別碼，不是密碼。填入後，自己的 Delib 部署
便可直接準備新對話網址；Cloudflare 並不建立 Pol.is 帳號或 Site ID。

## AI key 資料邊界

- key 由使用者貼入，僅保存於該分頁的 `sessionStorage`；
- key 只在按下「產生主持簡報」後，以 request header 傳給本站 Worker；
- Worker 只把單次請求轉給 OpenAI Responses API，不寫入資料庫、不記錄 key，
  並回傳 `Cache-Control: no-store`；
- 使用者可隨時按「清除 key」，關閉分頁也會清除；
- 不想讓 key 經過本站時，可以改用下載／安裝 skill 的路徑。

OpenAI 官方目前建議文字生成使用
[Responses API](https://developers.openai.com/api/docs/guides/text)。

## 直接啟用工具

- **Call-in**：使用者預覽七天保存與私人連結邊界後，Delib Worker
  代為呼叫 hosted creator。活動資料留在 Call-in；Delib 只把回傳連結
  放在該分頁的 `sessionStorage`。
- **Pocket Polis／口袋審議**：輸入標題、說明與 5–15 句起始陳述後，
  Delib 會呼叫 `polis.mashbean.net` 的公開建立 API，免登入交回參與、成果與
  私人管理連結。管理 token 只存在建立者的分頁，Delib 不保存活動內容或參與資料。
  收完後，主辦者可把 `statements.csv` 與 `votes.csv` 放入
  [`/integrations/pocket-polis-data.html`](https://delib.mashbean.net/integrations/pocket-polis-data.html)：
  欄位、匿名代碼、重複票、跨檔彙整與 SHA-256 都在瀏覽器本機處理，接著下載
  `delib-pocket-polis/v1` JSON、通用 `delib-data/v1`、TTTC CSV 或 Agora summary/comments/votes 三檔。
  匿名代碼仍可串連同一人的投票，自由文字也可能自行揭露身分，因此下載前另有人工確認。
  資料一致且至少有三位參與者時，主辦者也可挑選 1–8 句各有至少三份回應的
  已核准陳述，補上解讀、缺席聲音、決策狀態、回覆日期與責任者，產生
  [`delib-pocket-polis-receipt/v1`](https://delib.mashbean.net/schemas/delib-pocket-polis-receipt/v1.json)
  的預設 fragment-only 公開成果頁。它只公開選定陳述與同意／不同意／略過合計，不含
  匿名代碼、逐筆投票、檔案雜湊或管理 token；主辦者還須逐句確認自由文字適合公開。
  收據可再準備同一分頁、兩小時、讀取一次的 Call-in、Harmonica、TTTC 或 Pol.is
  下一步草稿，但不會把陳述原文或統計帶入目的工具。
  Repo 另提供可重跑的虛構軍購案例 pilot：`npm run pilot:pocket-polis` 會從
  公開 open-data 端點取得原始 CSV，驗證後一次產生可攜 JSON、TTTC／Agora
  匯入包、成果收據、四種 handoff 與測試報告；它不讀取私人管理 token，也不把
  產生匯入檔誤稱為已在上游服務完成匯入。Pilot 也會輸出 `portable/delib-data.json`。
  案例設定見 [`pilots/defense-budget.json`](pilots/defense-budget.json)。
  主辦者也可把 MIT 原始碼一鍵部署到自己的 Cloudflare。
  它是輕量重做、不是官方 Pol.is；防分身能力較弱，不適合單獨用於高對抗投票。
- **Pol.is**：已有對話可直接嵌入。建立模式使用公開的 Site ID 與
  page ID；第一次開啟工作區時才會在 Pol.is 建立對話。完整 Pol.is 需要
  多個 Docker 服務與 PostgreSQL；Cloudflare Containers 只有付費方案且
  不供應 PostgreSQL，因此沒有把它標成免費 Cloudflare 一鍵自架。
- **Agora Citizen Network**：貼上 ZKorum Agora 的官方公開對話網址即可
  站內嵌入。Delib 接受舊 `.network` 與現行 `.app` 分享網址，但登入、意見、
  比較與投票都直接送往 Agora。完整自架需要 PostgreSQL、Valkey 及多個
  TypeScript／Python workers；目前未驗證代建或 hosted 匯入權限。
- **HeyForm**：貼上已發布的 `heyform.net/f/...` 公開網址即可站內嵌入。
  建立表單仍在 HeyForm；Delib 不收帳密、cookie 或回答。完整自架需要
  MongoDB 與 Redis／KeyDB。
- **Talk to the City**：Delib 預填分析名稱與說明，再嵌入現行官方建立頁。
  登入、上傳、模型處理與提交都留在 TTTC；第三方登入被 iframe 阻擋時可
  用同一個預填網址在新分頁繼續。
- **Harmonica**：使用者在 Harmonica settings 產生 `hm_live_` API key，
  Delib 只在建立 session 的單次請求中轉送。建立後回傳站內參與頁與官方管理頁；
  也可改用 `harmonica-mcp` 讓自己的 Agent 在人工確認後建立。
- **Power Ranker**：輸入 3–10 個選項後可選兩條路。本機模式把題目放在 URL
  fragment，判斷與匯入檔都不送給 Worker；短期收件室則以一房一 Durable Object
  保存題目、pair counts 與 session 雜湊，不保存逐份判斷。公開群體結果至少要
  三份，24 小時或 7 天後自動清除，管理者亦可提前刪除。兩種模式都可下載
  `delib-ranking/v1` JSON／CSV與通用 `delib-data/v1`；有群體彙整後，主辦者可補上解讀、缺席聲音、
  決策狀態與下一責任者，產生 fragment-only 成果頁、JSON 與 Markdown。
  成果頁不含個別 session 或逐題判斷，模型分數也不會被標成支持率或共識證明。
  成果頁另可把最小必要的主辦者摘要帶回 Delib，預填 Call-in、Harmonica、TTTC
  或 Pol.is 的下一輪草稿。TTTC 仍須另行上傳已去識別的原始文字資料；Pol.is
  不會自動新增種子陳述；Call-in 的公開簡報網址也不會因長收據連結而被假裝填好。
- **Parti DemosX**：MIT 原始碼已列入工具與 hosting 盤點；它是 Java／Maven
  WAR 搭配 Tomcat、MySQL、Nginx 的完整市民參與平台，repository 最後更新於
  2022。導入前要先更新依賴、移除 compose 預設密碼、做安全與資料出口測試，
  因此目前不標成直接啟用或 Cloudflare 一鍵部署。

舊 MetaGov HeyForm／TTTC adaptor 仍保留為互通設計參考，但現行 hosted
登入與 API 契約已不同；本站不把未驗證的舊端點標示為可直接建立。細節與
HeyForm 目前的安全公告都列在 audit。

盤點見 [`docs/integration-audit.md`](docs/integration-audit.md)，機器可讀版本在
[`public/data/integrations.json`](public/data/integrations.json) 與
[`public/data/hosting.json`](public/data/hosting.json)，可部署配方在
[`public/data/deployments.json`](public/data/deployments.json)。Pocket Polis 與官方 Pol.is
自架的差異、帳號所有權與 release gates 見 [`docs/polis-hosting.md`](docs/polis-hosting.md)。
當前完成／未完成邊界見 [`docs/roadmap.md`](docs/roadmap.md)。

## Skill

```bash
npx --yes github:mashbean/delib install-skill
```

或直接閱讀：<https://delib.mashbean.net/.well-known/delib/SKILL.md>。

## 設計與資料原則

- 漸進揭露：第一次只做一個選擇；進階設定稍後再出現。
- Default-safe：敏感資料不建議傳到外部工具；所有 AI 輸出都需人工核可。
- Offline is part of the process：數位工具只是審議齒輪，不是整場審議。
- Receipt over vibes：成果頁要記錄誰參與、方法、限制、未解問題與下一步。
- 可攜：輸出原始資料、標準化資料、資料卡、來源與轉換紀錄。
- 可修正／可終止：AI 與工具的權限、申訴方式和 sunset 必須清楚。

來源與授權說明見 [NOTICE.md](NOTICE.md)。

## License

MIT
