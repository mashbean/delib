# Delib implementation blueprint / 實作藍圖

2026-09-23. Owner / 執行主體：Delib maintainer. Public tracker / 公開追蹤：[/contracts](https://delib.mashbean.net/contracts?lang=zh), [English](https://delib.mashbean.net/contracts?lang=en). Machine-readable status: `public/data/implementation-roadmap.json`.

## 目標與執行原則 / Goals and sequencing

以一個可延續多輪的審議工作台，連結低門檻工具、可追溯資料與有責任的回覆。先穩定共通契約，再擴充方法資料及原版服務轉接，最後增加現場審議與協作功能。每階段可獨立驗收；計畫中的服務不顯示為已支援。

Connect accessible tools, traceable data and accountable responses in a recurring deliberation workspace. Stabilize contracts first, then method data and original-service adapters, then facilitated sessions and collaboration. Each stage has an acceptance gate. Planned integrations must not appear as supported.

功能相近、schema 驗證通過、正式環境讀取、雙向寫回及對方驗收，是不同證據層級。新增工具優先延伸既有 Pocket 或工作台；只有獨立活動生命週期、資料所有權或參與介面需要分離時，才另建服務。

Functional similarity, schema validity, production reads, bidirectional writes and partner acceptance are distinct evidence levels. Extend existing Pocket tools or the workspace first. Create a separate service only when activity lifecycle, ownership or participation interfaces require it.

## 順序與驗收 / Stages and acceptance

| 順序 | 交付 / Deliverable | 驗收 / Acceptance | 依賴 / Dependencies |
| --- | --- | --- | --- |
| P1 | 資料契約、公開範例、瀏覽器與 CLI 檢查器 / Contracts, public fixtures, browser and CLI checker | 舊檔保留缺值；型別、日期、來源、歷程與秘密欄位驗證；不回傳原文 / Preserve legacy omissions; validate fields, dates, links, history and credentials without disclosing content | 無 / None |
| P2 | Pocket Polis 最新匯出與分析轉接 / Current Pocket Polis export and analysis adapters | 釘選服務版本與三個公開資料集；保留票數、分群、算法／模型版本、覆蓋率與引文；明列損失 / Pin service version and three public datasets; preserve counts, groups, algorithm/model version, coverage and quotations; disclose loss | P1 |
| P3 | 原版 Decidim 唯讀匯入；V2V／Assemblis 格式對照 / Original Decidim read-only import; V2V / Assemblis crosswalks | 一個指定實例、固定測試檔、版本／多語／採納／來源核對；寫回與外部驗收另列 / Named instance and pinned fixtures; verify revisions, translations, adoption and provenance; track write-back and acceptance separately | P1–P2 |
| P4 | 意見到決策與更正流程 / Voice-to-decision and correction workflow | 多來源提案、未採納理由、確認回覆、責任人、期限及撤回影響；草稿不冒充承諾 / Multi-source proposals, rejection reasons, confirmed responses, owners, dates and withdrawal impacts; drafts are not commitments | P1、P3 |
| P5 | 輕量場次與品質評估模組 / Lightweight session and quality module | 用模擬活動跑議程、小組、主持紀錄與會後評估；區分受邀／出席／發言／投票與缺席原因 / Simulate agenda, groups, facilitation and evaluation; distinguish invitees, attendees, speakers, voters and barriers | P1、P4 |
| P6 | 團隊提案推進與論證證據 / Team proposal progression and argument evidence | 透明推進規則、版本差異、支持／反對證據與少數意見保留 / Explicit progression rules, version differences, pro/con evidence and minority views | P4–P5 |
| P7 | 聯邦整合與大型諮詢 / Federation and larger consultations | 真實介面、資料授權與負載驗證；沒有 API 時保留手動轉接 / Verify real interfaces, data permissions and load; retain manual handoff where APIs are unavailable | P3、P6 |

P1、P2 以及 P4–P6 本機基礎功能已實作；P3／P7 部分完成，仍待外部契約與共同驗收。詳見 [本輪實作與限制](stages-p2-p7-2026-09-23.md)。P3 的合作夥伴驗收取決於可取得的測試資料與共同確認；未收到資料前可先完成公開格式 adapter，但不宣稱外部已接受。

P1, P2 and local baseline features for P4–P6 are implemented. P3/P7 remain partial; external contracts and joint acceptance are outstanding. See [delivery and limitations](stages-p2-p7-2026-09-23.md). Partner acceptance in P3 depends on actual fixtures and agreement. Public-format adapters can proceed independently, without claiming partner acceptance.

## 論文服務盤點與重寫策略 / Paper services and implementation strategy

| 服務 / Service | 目前對應 / Current counterpart | 後續工作 / Next work |
| --- | --- | --- |
| Pol.is | Pocket Polis：輕量獨立實作 / Independent lightweight implementation | P2 彙總方法資料 adapter，保留已知損失 / Aggregate method-data adapter with explicit losses |
| Talk to the City | Pocket TTTC：輕量重寫 / Lightweight reimplementation | P2 持續驗證引文與版本；保留原生格式差異 / Maintain quotation/version tests and native distinctions |
| Harmonica | Pocket Harmonica：獨立重寫 / Independent reimplementation | P2 驗證角色、訪談脈絡與合成內容區別 / Verify roles, interview context and synthesized content |
| MAPLE | Pocket Maple：臺灣情境輕量版 / Taiwan-oriented lightweight version | P3 原版另設 adapter；不宣稱立法通知、追蹤等完整功能 / Separate original-service adapter; no full notification/tracking claim |
| HeyForm | Pocket Form：部分功能 / Partial counterpart | P5 只按活動需求補跳題、前後問卷與評估 / Add branching and pre/post surveys for session needs |
| Decidim | Pocket Proposals：提案／修正／附議 / Proposals, amendments, endorsements | P3 先接資料；P6 延伸提案模組；不重寫整套治理平台 / Import first, extend proposals later; no whole-platform rewrite |
| Voice to Vision | 工作台／Reply 有功能重疊 / Workspace / Reply overlap | P4 獨立實作意見到決策、責任與更正功能 / Implement traceability, accountability and corrections |
| Assemblis | 主持工作室已有本機基礎功能 / Local studio baseline implemented | P5 優先候選：場次、分組、主持紀錄、會後品質評估 / Priority candidate: sessions, groups, notes and quality evaluation |
| Evocracy | Pocket Proposals 部分重疊 / Partial overlap | P6 團隊協作與代表推進；先確認方法規則 / Team collaboration and representative progression after method review |
| Swarmcheck | Pocket Argument 功能相近 / Similar functions | P6 證據圖、論證關係與來源回查；不標成已重寫原版 / Evidence graph and provenance; do not claim an existing rewrite |
| Hypha | 已接指定匯出格式 / Pinned export adapter implemented | P7 優先接入；只有不足功能才考慮獨立模組 / Integrate first; implement only demonstrated gaps |
| Make.org | 無直接對應 / No direct counterpart | P7 調查可授權資料匯出；完整服務重寫暫緩 / Investigate permitted exports; full service rewrite deferred |

所有「可重寫」都是功能設計候選，不是已確認可複製原始碼。實作前逐案檢查上游版本、授權、商標、資料使用條件與實際格式。現有工具不因上表而新增外部寫入權限。

Every proposed reimplementation is a functional candidate, not permission to copy source. Check versions, licenses, names, data terms and actual formats first. This plan grants no new third-party write permissions.

## 每個 adapter 都需附的證據 / Evidence required for each adapter

1. 來源版本、授權、匯出日期與檔案雜湊 / Source revision, license, export date and file hash.
2. 原始欄位 → 共通欄位 → 目的欄位對照 / Source → common → destination field mapping.
3. 保留、改寫、排除、不支援及不可還原項目 / Preserved, transformed, excluded, unsupported and irreversible fields.
4. 缺值、撤回、版本更新、多來源、非 ASCII、多語與引用錯誤的測試 / Missingness, withdrawal, revisions, multiple sources, non-ASCII, multilingual content and bad-reference tests.
5. 本機／正式唯讀／正式模擬往返／對方共同驗收，附日期與版本 / Dated local, production-read, production-synthetic-round-trip or joint-acceptance evidence.

## P1 交付清單 / Delivered in P1

- `public/schemas/delib-workspace/v1.json`：明列脈絡、日期、下一輪、事件及原生匯入擴充；舊版缺值不偽造。
- `public/vendor/workspace-validator.js`：由本機 schema 編譯；不在瀏覽器下載或執行遠端 schema。
- `public/workspace-contract-core.js`：schema + 既有來源／狀態驗證；輸出不含原文與身分的報告。
- `/contracts?lang=zh|en`：雙語規格、藍圖、範例與本機檔案檢查。
- `npm run validate:workspace -- file.json`：離線 CLI；不改寫輸入。
- `public/fixtures/contracts/`：多來源／跨輪與舊版缺值的公開虛構範例。
- [資料契約 / Data contracts](data-contracts.md)：欄位字典、版本政策、限制與接入步驟。

P1 does not add a new external-service adapter, verify real identities, propagate remote deletion or establish full Metagov conformance. It establishes a repeatable local acceptance baseline for the next stages.

## 依據 / Sources

- Hughes et al. (2025), [Towards Interoperability](https://doi.org/10.1145/3737609.3747119), especially §4.2, §5, Figure 1 and Table 2.
- [Decidim API documentation](https://docs.decidim.org/en/v0.32/develop/api/): inspect the chosen instance/version before integrating.
- [Pinned Metagov crosswalk](../public/data/metagov-crosswalk.json): scoped Statement export; external acceptance remains false.
- [Adapter matrix](../public/data/adapter-matrix.json) and [dated evidence](../public/data/interop-evidence.json): local contracts and dated observations, not blanket compatibility.
