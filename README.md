# Delib · 審議拼圖

**把一場審議，拼成下一輪。**

[delib.mashbean.net](https://delib.mashbean.net) 是給非工程師、非程式專業
審議工作者的流程組裝器。回答幾個白話問題後，它會產生：

- 線下齒輪：招募、知情同意、主持、人工決策與後續責任；
- 線上齒輪：依需求推薦 Call-in、Polis、Talk to the City、OpenBook、
  Uncommon Ground、Decidim 等開源工具；
- 一份可分享的流程成果頁、JSON 資料包與 Markdown 執行手冊；
- 可選的 AI 協作：使用者自備 OpenAI API key，或安裝 Delib skill。

推薦由公開規則計算，不由 AI 黑箱決定。AI 只協助把已選定的流程整理成
主持簡報，且不能替參與者製造共識或替主辦者作決策。

## 目前能做什麼

這是第一個可操作版本：

1. 四步需求精靈；
2. 25 個工具的可搜尋目錄與 deterministic recommendation；
3. 線下／線上流程配方；
4. 不含自由文字與個資的分享連結；
5. `delib-bundle/v1` JSON 與 Markdown runbook 下載；
6. BYOK OpenAI Responses API 協作；
7. `skills/delib/SKILL.md` 與機器可讀的
   `/.well-known/delib/SKILL.md`。

目前不保存參與資料、API key 或使用者建立的流程。分享狀態只包含固定
選項並留在 URL；後續才會加入經明確同意的資料匯入、轉換與公開成果保存。

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
不會嘗試搶用官方網域。

## AI key 資料邊界

- key 由使用者貼入，僅保存於該分頁的 `sessionStorage`；
- key 只在按下「產生主持簡報」後，以 request header 傳給本站 Worker；
- Worker 只把單次請求轉給 OpenAI Responses API，不寫入資料庫、不記錄 key，
  並回傳 `Cache-Control: no-store`；
- 使用者可隨時按「清除 key」，關閉分頁也會清除；
- 不想讓 key 經過本站時，可以改用下載／安裝 skill 的路徑。

OpenAI 官方目前建議文字生成使用
[Responses API](https://developers.openai.com/api/docs/guides/text)。

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

