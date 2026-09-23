# Delib data contracts / 資料契約

Contract review: 2026-09-23. [Interactive checker / 互動檢查器](https://delib.mashbean.net/contracts?lang=zh). This is a Delib contract, not an ecosystem standard or partner certification.

## 三層責任 / Three layers

| 契約 / Contract | 用途 / Responsibility | 保留與限制 / Preservation and limits |
| --- | --- | --- |
| `delib-data/v1` | phases → items → responses → outcomes | 方法資料與來源；投票、成對比較與支持度不當成同一語意 / Method data with provenance; votes, comparisons and support are distinct |
| `delib-exchange/v1` | native export → adapter → records + companion | 經隱私處理的原生方法欄位、來源關係、撤回與 losses；不是逐位元原始備份 / Privacy-filtered native fields, relations, withdrawals and losses; not a byte-exact archive |
| `delib-workspace/v1` | issue → rounds → artifacts → follow-up | 議題、輪次、覆核、責任、匯入／交接歷程；私人瀏覽器工作資料 / Issue, rounds, review, responsibility and import/handoff history; private local working data |

各 Pocket 保留自己的內部模型；工具輸出經 adapter 接入共通層。`delib-rounds` 是跨輪示範與流程呈現的 companion，`delib-process` 是方法流程設定，`delib-bundle` 是工具建議配方；不是 workspace 的同義詞，也不應混送。

Pocket tools retain their internal models. Adapters bridge exports into common layers. `delib-rounds` is a cross-round demonstration/view companion, `delib-process` describes methods, and `delib-bundle` carries recommendation recipes. They are not interchangeable workspace files.

## Workspace 欄位字典 / Field dictionary

| 欄位 / Field | 意義 / Meaning |
| --- | --- |
| schema, id, title, language, simulated | 格式、議題 ID、名稱、語言及明示模擬狀態 / Format, issue identity, title, language and explicit simulation flag |
| goal, audience, deadline | 目標、對象、覆核期限；期限不能轉作 Phase 起訖 / Goal, audience and review deadline; not Phase start/end times |
| createdAt, updatedAt | ISO date-time 時間 / ISO date-time timestamps |
| rounds[].id/title/step | 輪次；step 是工作台 0–3 操作分組，不是八步審議方法的編號 / Round; step groups workspace operations 0–3, not eight method cards |
| rounds[].artifacts | 本輪建立的紀錄；跨輪來源靠 inputs 引用 / Records created in this round; inputs reference earlier work |
| rounds[].inputs | 本輪使用的已存在紀錄 ID / Existing records used in the current round |
| rounds[].connections | form/tttc/reply 的活動與輸入對應；無管理金鑰 / Activity and input mappings, without admin credentials |
| rounds[].next | reason, owner, date, carryForwardRefs；phase 可選 / Next-round reason, owner, date, carry-forward refs and optional phase |
| events | revision/review/reopen 的操作者與時間 / Attribution and time of revision/review/reopen events |
| transfers / imports | 交接觀測狀態／本機檔案匯入快照；各有子契約 / Observed handoffs / local import snapshots with separate contracts |
| view | 本機選取的輪次、分頁及紀錄；不是治理證據 / Local selection state, not governance evidence |

## Record 與關係 / Records and relationships

每筆包含 `id`, `kind`, `text`, `source:{tool,id}`, `derivedFrom`, `relations`, `participantRef`, `supersedes`, `review`。

Kinds: `statement`, `question`, `theme`, `proposal`, `reply`, `decision`, `feedback`, `brief`, `inclusion-check`, `method-result`, `quote`.

Relations: `derived`, `responds`, `revises`, `supports`, `opposes`, `context`. 一個主題可有多個來源；context 只表達背景，不能當成回覆證明。每個 relation.ref 需出現在 derivedFrom，並指向順序上已存在的紀錄，避免循環與懸空參照。

A theme may have several sources. Context is background, not proof of a response. Each relation.ref belongs in derivedFrom and points to an earlier existing record, preventing cycles and dangling references.

`supersedes` 保存修訂來源，不覆寫原話。`review` 保存 checked/reviewer/at/quoteConfirmed；覆核不等於本人同意或官方承諾。責任、處置、參與缺口各自保存歷程。`settingHistory` 的線上／實體觀測不冒充完整 Event / Location。

`supersedes` preserves revisions without overwriting source text. Review is distinct from consent and official commitment. Responsibility, disposition and participation have independent histories. Setting observations are not complete Event / Location records.

`nativeRef` 必須與 imports 的原生快照重新核對；eligible／quarantined 是匯入預覽時推導的分類，不作為持久備份中的授權欄位。`methodData` 保存方法結果，`sourceEvidence` 保存來源特有證據；兩者是可擴充物件，不表示本階段已逐工具規範完所有內部欄位。各工具的完整方法 schema 是 P2 後續工作。

Native references and projected records are checked against import snapshots. Eligibility and quarantine are derived preview classifications, not persisted authorization fields. `methodData` and `sourceEvidence` remain extensible objects: P1 does not standardize every tool-specific field; that is P2 work.

## 驗證與執行 / Validation and use

```sh
npm ci
npm run build:contracts
npm run validate:workspace -- public/fixtures/contracts/workspace-linked.json
npm run validate:workspace -- path/to/private-backup.json
```

1. 本機 AJV 編譯器檢查 JSON Schema 2020-12（所有 $ref 在 repo 內解析）。/ Compile JSON Schema 2020-12 locally; resolve all references from this repo.
2. 工作台與檢查器都使用生成的驗證器；另執行 `validateProject` 的關係、交接、原生快照與限制驗證。/ The workspace and inspector use the generated validator plus runtime graph, lifecycle, native-snapshot and restriction checks.
3. CLI 不連線、不改檔；退出碼 0 通過、1 內容不通過、2 用法／讀檔問題。最大 6 MiB UTF-8 檔案。/ Offline and read-only CLI; exit 0 valid, 1 invalid, 2 usage/file error; 6 MiB UTF-8 file limit.
4. 報告只有分類、數量與固定欄位名稱，不包含原話、議題名稱、ID、姓名、來源檔名或解析錯誤中的內容。/ Reports contain categories, counts and fixed field names only, never source text, titles, IDs, names, filenames or parser excerpts.
5. Schema 通過仍不能證明資料為真、外部已收到、具有代表性或已有同意。/ Validation does not prove truth, receipt, representativeness or consent.

## 舊版與擴充政策 / Legacy and extension policy

- 保持 v1 URL。goal/audience/deadline 在新議題建立時必填，但舊備份可缺漏，檢查器列出 missingContext，不代填。/ Keep v1 URL; new projects require context, legacy omissions are reported without fabrication.
- 已存在的欄位需符合型別及有效日期；空白、錯誤型別及不存在的日期不是「未知」。/ Present fields must be correctly typed and dated; malformed values are not unknown values.
- 舊版 review.at 可只有日期，保持其精度；不自動補時分秒。舊 connections 可缺 status，不推定成功。/ Preserve date-only legacy reviews and absent connection status; do not invent time or successful delivery.
- 未識別的附加欄位依 schema 的開放物件規則保留；不得夾帶管理憑證。需要改變既有語意、必要欄位或移除能力時，另開版本並提供明示 migration。/ Preserve allowed extensions without credentials. Breaking semantics, required fields or removals require a new version and explicit migration.
- 私人原始檔、完整 workspace 備份及轉接 companion 都應保存；CSV 只有目的站可讀的子集。/ Retain native archives, full private backups and companions; CSV is a destination-specific subset.

## 接入下一個服務 / Add the next service

先取得固定版本與可公開的虛構／授權 fixture，列欄位對照與損失，再實作 parse → normalize → validate → preview → export。至少測試多來源、撤回、修訂、錯引文、不同方法票值、非 ASCII 與超限檔案。外部收件與往返驗收要另外記錄，不能從本機測試推論。

Pin a version and public synthetic or licensed fixture, document field mappings and loss, then implement parse → normalize → validate → preview → export. Test multiple sources, withdrawals, revisions, quote mismatches, method-specific response values, non-ASCII and size bounds. Record external receipt and round-trip acceptance separately.

Current Metagov scope remains selected Statement export with private provenance companions, pinned to `e5d3312aa0da481429ef4545ac172b668ead5f55`. No full ontology compatibility or upstream transport agreement is claimed.


## 主持紀錄與新 adapters / Facilitation records and new adapters

`operations` 是 workspace v1 的可選延伸，保存更正、場次與提案推進歷程；既有備份仍可使用。Polis 分析、Metadecidim 與 Hypha 以具名、有限範圍的 adapter 接入，不代表整套原服務重寫或共同驗收。欄位、損失與驗證界線見 [P2–P7 實作說明](stages-p2-p7-2026-09-23.md)。

The optional workspace `operations` extension stores correction, session and proposal histories while preserving old backup compatibility. Polis analysis, Metadecidim and Hypha adapters support scoped contracts, not complete upstream reimplementations or partner acceptance. See the linked bilingual delivery notes for fields, losses and evidence.


## Session support extension / 場次支持擴充

Optional `participationGap.sessionSource` links a task to a historical session observation; optional session `changeReason` records plan revisions. Old v1 backups remain valid. Runtime validates source text, version, alias, round ordering and carry-forward lineage. See [implementation and limits / 實作及限制](session-support-2026-09-23.md).
