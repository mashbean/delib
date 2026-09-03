# Data boundaries

Updated: 2026-09-03（內容自 README 搬入，逐工具的邊界說明以此為準）

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

自 0.2.0 起的補充：

- 公開成果收據的 `source.reportUrl` 只接受 Pocket Polis 公開成果頁路徑
  （`/r/<10 碼>`）；Power Ranker 的 `aggregateUrl` 必須位於本站。
- 營運者可用 `OPERATOR_TOKEN_SHA256` 下架濫用的公開頁；伺服器只保存雜湊。
- production 有每 IP 限流；被限流時回 429 與 `Retry-After`。
- 頁面瀏覽統計使用 Cloudflare Web Analytics（zone 注入、不用 cookie、不辨識個人）。

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
  [`/integrations/pocket-polis-data`](https://delib.mashbean.net/integrations/pocket-polis-data)：
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
