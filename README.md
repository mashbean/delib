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
2. 27 個工具的可搜尋目錄與 deterministic recommendation；
3. 線下／線上流程配方；
4. 不含自由文字與個資的分享連結；
5. `delib-bundle/v1` JSON 與 Markdown runbook 下載；
6. BYOK OpenAI Responses API 協作；
7. `skills/delib/SKILL.md` 與機器可讀的
   `/.well-known/delib/SKILL.md`。
8. 直接在站內建立七天的 Call-in 活動，不需帳號；
9. 在站內嵌入既有 Pol.is 對話，或用 Site ID 準備自動建立工作區；
10. 在站內嵌入既有 Agora Citizen Network 公開對話；
11. 在站內嵌入已發布的 HeyForm 表單；
12. 在站內開啟 Talk to the City 官方建立流程，登入與 CSV 不經 Delib；
13. 使用 tab-only Harmonica API key 直接建立 AI 對話 session，或複製 MCP 啟動提示；
14. 使用內建 Power Ranker 完成本機成對排序，或建立 24 小時／7 天自動清除的多人結果收件室；
15. 把群體彙整接成 `delib-ranking-receipt/v1` 成果頁，分開呈現工具計算、主辦者解讀、未納入聲音、決策狀態與下一步責任；
16. 從成果頁預覽並帶入 `delib-handoff/v1` 草稿，接續 Call-in 成果回報、Harmonica 補訪、TTTC 文字整理或 Pol.is 新一輪；
17. `delib-integrations/v1` 與 `delib-hosting/v1` 盤點，加入 Agora 與 Parti DemosX，明確區分可用、共用託管、元件、研究與阻擋項目。

Delib 伺服器不保存 API key 或使用者建立的流程。Power Ranker 預設仍可完全
在瀏覽器處理；只有主辦者明確選擇短期收件室時，才會保存公開題目、去連結化
pair counts 與隨機 session ID 的 SHA-256 雜湊。逐份原始判斷不落庫，資料在
24 小時或 7 天後以 Durable Object alarm 全部清除，也可由私人管理連結提前刪除。
所有排序檔仍明確標示為參與資料，不沿用「不含參與資料」的流程規劃 schema。
成果收據只接受至少三份不重複 session 的去連結化群體彙整；公開資料編碼在網址 fragment，瀏覽器載入
頁面時不會把它送給 Worker。Delib 不另存收據，但拿到完整連結的人可以閱讀與
再次分享，因此產生前仍需人工確認。
成果接續草稿只包含主辦者已公開的解讀、限制與下一步，不含 pair counts、
個別判斷、session ID、管理連結或 credential。草稿只活在同一分頁的
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
Workers Builds 並部署靜態資產與 SQLite Durable Object namespace；Delib 本體
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
  `delib-ranking/v1` JSON／CSV；有群體彙整後，主辦者可補上解讀、缺席聲音、
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
[`public/data/hosting.json`](public/data/hosting.json)。Pol.is 共用託管的架構、
帳號所有權與 release gates 見 [`docs/polis-hosting.md`](docs/polis-hosting.md)。

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
