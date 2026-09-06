# Delib · 審議拼圖

**每一次對話，都有下一步。 / Every conversation. A next step.**

[中文版](https://delib.mashbean.net/?lang=zh) · [English](https://delib.mashbean.net/?lang=en)

Delib 把線上與實體參與、工具與資料，接成可以持續多輪的審議。新版入口提供
可旋轉的 3D 八步流程、依缺口找起點、13 個站內工具工作區與完整中英引導。
GSAP 負責進場與視角轉場；3D 圖以透視投影繪製，支援觸控、步驟按鈕、暫停與減少動態。

## 現在能做什麼

- **規劃**：從缺席聲音、證據、選項或回覆責任決定本輪起點，下載行動單。
- **直接使用**：`/form`、`/harmonica`、`/polis`、`/call-in`、`/tttc`、`/reply`、
  `/proposals`、`/argument`、`/budget`、`/rank`、`/checks`、`/values`、`/maple`。
  工作區保留工具原本的來源與資料儲存，並可將既有活動網址轉成站內入口。
- **多輪模擬**：虛構校門口安全案例涵蓋 3 輪、14 個角色；人數與票數從 fixture
  計算，可匯出輪次 JSON、TTTC CSV、人工審閱的 Polis 起始陳述。沒有實際招募或投票。
- **資料交接**：`/handoff` 在本機瀏覽器檢查、預覽與合併來源 CSV，保留來源映射、
  避免 ID 碰撞與跨來源錯認參與者；匯入目標工具前由主辦者確認。
- **Agent**：複製帶入目前規劃選擇的 prompt，或下載 `/.well-known/delib/SKILL.md`。
  此頁不收 API 金鑰；`POST /api/agent` 已回傳 410。Agent 不替人製造共識或發布決定。
- **成果**：既有 Pocket Polis 與 Power Ranker 成果收據、可到期的 `/r/<slug>`、
  管理者刪除能力與 `/feedback` 回饋流程持續保留。

Native versions focus on specific deliberative tasks, not feature parity with their
upstream inspirations. Station navigation, planning, simulation and handoffs are
bilingual; individual upstream tools retain their own localization coverage.

`delib-data/v1` currently has live-data adapters for Polis and Power Ranker, plus a
round-simulation adapter. `delib-rounds/v1` adds versioned rounds, provenance,
participation modes and explicit return points. These are Delib contracts, not an
established universal standard or automatic data synchronization across all tools.

- [Methodology and source audit](docs/methodology-research-2026-09-06.md)
- [Actual import/export contract audit](docs/data-flow-audit-2026-09-06.md)
- [Release changes](CHANGELOG.md) · [Operations](docs/operations.md)
- [Machine-readable bilingual workflow](public/data/workflow-guide.json)

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
`/api/*`、`/r/*` 與工具工作區路徑會執行 Worker；需要狀態的操作另使用 Durable Objects。監測、限流、下架與
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
