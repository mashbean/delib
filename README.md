# Delib · 審議拼圖

**把一場審議，拼成下一輪。**

[delib.mashbean.net](https://delib.mashbean.net) 是給非工程師審議工作者的流程
組裝器。回答幾個白話問題後，它會產生線下齒輪、線上工具推薦、可分享的成果頁
與 Markdown 執行手冊；也能直接在站內開起 Call-in、Pocket Polis、Power Ranker，
或連接官方 Pol.is、Agora、HeyForm、Talk to the City 與 Harmonica。

推薦由公開規則計算，不由 AI 黑箱決定。AI 只協助把已選定的流程整理成
主持簡報，且不能替參與者製造共識或替主辦者作決策。

## 現在能做什麼

- **規劃**：四步精靈、28 個工具目錄、deterministic recommendation、
  `delib-bundle/v1` JSON 與 Markdown runbook。
- **直接啟用**：免帳號代建 Call-in 與 Pocket Polis；本機或短期收件室的
  Power Ranker；官方 Pol.is、Agora、HeyForm、TTTC、Harmonica 的站內工作區。
- **資料交接**：Pocket Polis CSV 與 Power Ranker 結果只在瀏覽器處理，可輸出
  `delib-data/v1`、TTTC CSV 與 Agora 三檔匯入包。
- **成果收據**：`delib-pocket-polis-receipt/v1`、`delib-ranking-receipt/v1`
  公開成果頁，預設只放在網址片段；可選建立會到期、可刪除的 `/r/<slug>` 短網址；
  `delib-handoff/v1` 把下一步草稿帶回工具設定。Pocket Polis 收據可帶入該工具的
  AI 綜整節錄，標明模型與時間，和主辦者解讀分開。
- **迭代**：[/deploy](https://delib.mashbean.net/deploy) 部署中心、
  [/feedback](https://delib.mashbean.net/feedback) 開發者回饋、
  `npm run pilot:pocket-polis` 可重跑的虛構案例。

逐項的完成清單在 [CHANGELOG.md](CHANGELOG.md)；工具接入狀態與判斷依據在
[docs/integration-audit.md](docs/integration-audit.md)；每個工具的資料邊界在
[docs/data-boundaries.md](docs/data-boundaries.md)；當前完成／未完成邊界在
[docs/roadmap.md](docs/roadmap.md)。

## 本機開發

```bash
npm install
npm run dev
npm run check      # 語法、型別、單元與 Worker 測試、dry-run
```

## 部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mashbean/delib)

- 自架：按上面的按鈕，或 `npm run deploy`，會得到獨立的 `workers.dev` 網址。
  Deploy 按鈕只部署預設環境，不會搶用官方網域；它會依 `.dev.vars.example`
  提示選填 `POLIS_SITE_ID`（Pol.is 帳號的公開識別碼，不是密碼）。
- 官方站：GitHub `main` 經 `.github/workflows/deploy.yml` 檢查後自動部署到
  `production` 環境（需要 repo secret `CLOUDFLARE_API_TOKEN`、
  `CLOUDFLARE_ACCOUNT_ID`）；緊急時 `npm run deploy:production`。
- 部署後 `npm run smoke` 做唯讀煙霧測試；`/api/health` 會回報版本與 Git SHA。

Delib 本體可在 Workers Free 的額度內運作；靜態頁面不經 Worker，只有
`/api/*` 與 `/r/*` 會消耗 Worker 與 Durable Object 額度。監測、限流、下架與
回滾方式見 [docs/operations.md](docs/operations.md)。

## Skill

```bash
npx --yes github:mashbean/delib install-skill            # 安裝到偵測到的 ~/.codex 與 ~/.claude
npx --yes github:mashbean/delib install-skill --target claude --force
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
