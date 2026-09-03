# Operations runbook

Updated: 2026-09-03

這份文件給維運 `delib.mashbean.net` 的人。使用者看得到的邊界在
[data-boundaries.md](data-boundaries.md)，工具接入狀態在
[integration-audit.md](integration-audit.md)。

## 一眼看懂

| 項目 | 現況 |
| --- | --- |
| 執行環境 | 一個 Cloudflare Worker（`delib`）＋ Workers Static Assets ＋ 兩個 SQLite Durable Object namespace（`RankingRoom`、`PublicReceipt`） |
| 正式網域 | `delib.mashbean.net`，只綁在 `env.production` |
| 部署路徑 | GitHub `main` → `deploy.yml`（檢查 → 部署 → 煙霧測試）；secret 未設定前，由筆電 `npm run deploy:production` |
| 健康檢查 | `GET`／`HEAD /api/health`，回傳 `version`、`build.sha`、`build.deployedAt` |
| 監測 | `uptime.yml` 每 30 分鐘跑 `scripts/smoke.mjs` 並探測 polis／call-in；失敗會寄信給 repo owner |
| 日誌 | `observability.enabled: true`、全量取樣；只記錄路徑、方法與錯誤訊息，不記錄 body 或 header |
| 限流 | production 才有：`WRITE_LIMIT` 每 IP 20 次／分鐘（所有 POST）；`SUBMIT_LIMIT` 每 IP 120 次／分鐘（排序提交）。限流服務故障時放行 |
| 依賴的上游 | `polis.mashbean.net`（Pocket Polis）、`call-in.mashbean.net`（Call-in）、`app.harmonica.chat`、`api.openai.com`；全部有 12 秒逾時（OpenAI 45 秒） |

## 日常指令

```bash
npm run check              # 語法、型別、單元與 Worker 測試、dry-run
npm run dev                # 本機 http://localhost:8787
npm run smoke -- http://127.0.0.1:8787   # 對任何部署做唯讀煙霧測試
npm run deploy:production  # 從筆電部署（會帶入 git short SHA 到 BUILD_SHA）
npm run smoke              # 對正式站做煙霧測試
```

## 讓 GitHub 自動部署

1. 在 Cloudflare 建立 API token（Workers Scripts:Edit、Workers Routes:Edit、
   Account Settings:Read）。
2. 到 GitHub repo Settings → Secrets and variables → Actions，新增
   `CLOUDFLARE_API_TOKEN` 與 `CLOUDFLARE_ACCOUNT_ID`。
3. 之後每次 push 到 `main`：`deploy.yml` 先跑 `npm run check`，再
   `wrangler deploy --env production --var BUILD_SHA:<sha>`，最後
   `scripts/smoke.mjs --expect-sha <sha>` 確認上線的就是這個 commit。
4. secret 缺少時 job 會印出 notice 並略過部署，不會讓 CI 變紅。

## 版本與變更

- `package.json` 的 `version` 會出現在 `/api/health`；改變行為的 PR 請一起
  更新版本與 `CHANGELOG.md`。
- `build.sha` 來自部署時的 `--var BUILD_SHA`；`build.versionId` 與
  `build.deployedAt` 來自 Cloudflare 的 `version_metadata` binding。

## 出事時

### 站台整個回錯誤或 1101

1. `npm run smoke` 看哪一項失敗。
2. Cloudflare dashboard → Workers → `delib` → Logs（已開啟全量記錄）；搜尋
   `delib unhandled error`。
3. 若是免費額度用盡（Workers 每日請求或 Durable Object 額度），靜態頁面現在
   不經 Worker，仍可瀏覽；只有 `/api/*` 與 `/r/*` 會失敗。等額度重置或升級方案。
4. 回滾：`git checkout <上一個 tag 或 sha> && npm run deploy:production`，
   或在 Cloudflare dashboard 的 Versions 切回上一版。

### 有人濫用公開短網址

公開成果頁 `/r/<slug>` 是匿名可建立的公開頁面。下架流程：

```bash
# 一次性設定：產生營運者秘密，只把它的 SHA-256 放進 Worker secret
OPERATOR_TOKEN=$(openssl rand -hex 32)
printf '%s' "$OPERATOR_TOKEN" | shasum -a 256 | cut -d' ' -f1 | \
  npx wrangler secret put OPERATOR_TOKEN_SHA256 --env production
# 之後下架任何 slug（本機保存 OPERATOR_TOKEN，不要寫進 repo）
curl -X DELETE https://delib.mashbean.net/api/receipts/<slug> \
  -H "Origin: https://delib.mashbean.net" -H "X-Receipt-Operator: $OPERATOR_TOKEN"
```

`/api/health` 的 `operatorTakedown` 會顯示是否已設定。目前沒有 slug 清單；若
需要，下一步是在建立時把 `slug、kind、createdAt` 寫進 KV 索引。

### 上游服務掛了

`uptime.yml` 會在 `polis.mashbean.net` 或 `call-in.mashbean.net` 回非 2xx/3xx
時失敗。Delib 本身不會壞，但「建立 Pocket Polis／Call-in」會在 12 秒後回
504，使用者看到「回應逾時」。修好上游即可，不需重新部署 Delib。

## 一鍵部署按鈕的真實狀態

`deploy.workers.cloudflare.com/?url=https://github.com/mashbean/delib` 會複製
repo、以預設環境（沒有自訂網域）部署，並依 `package.json` 的 `cloudflare.bindings`
提示 `POLIS_SITE_ID`、`POCKET_POLIS_ORIGIN`、`CALL_IN_ORIGIN`。

已驗證：`wrangler deploy --dry-run`（預設與 production）、正式站以同一份設定部署。
未驗證：用第三方 Cloudflare 帳號實際按過按鈕。做過一次後，請把日期寫進
`public/data/deployments.json` 的 `verification`。

## 第三方分析

Zone 已啟用 Cloudflare Web Analytics（自動注入 beacon）。它不用 cookie、不辨識
個人；CSP 已允許 `static.cloudflareinsights.com` 與 `cloudflareinsights.com`，
頁尾也有揭露。若要關閉，請在 Cloudflare dashboard 停用注入並同步移除
`public/_headers` 與 `src/index.ts` 裡的兩個來源。
