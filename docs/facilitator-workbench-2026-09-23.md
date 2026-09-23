# Facilitator-centered workbench / 以主持人為中心的工作台

## Direction / 方向

工作台以「我在哪、下一步做什麼、資料要怎麼檢查、下次如何接續」作為入口。資料流、交接與格式檢查保留作為支援工作。階段是主持人選擇的位置，不是完成度、品質分數或共識判定。

The workspace starts with the facilitator’s position, next action, evidence checks and continuation. Flow, handoffs and format validation remain supporting tasks. A stage is a chosen working position, not completion, quality or consensus.

## Increment 1 — implemented / 第一階段已實作

- Default `/workspace` opens the bilingual facilitator guide. Explicit legacy `view` links keep their destinations. Three primary views: guide, round work, data flow; detailed tasks are expandable.
- Eight freely selectable stages use existing methodological guidance, with a main action, inputs, outputs, readiness questions and online/in-person considerations. Navigation never marks evidence reviewed or executes decisions.
- Each stage offers two initial tools and expandable alternatives: purpose, strengths, limits, handoff explanation and same-origin launch. Launching a tool does not send local data. The full catalog remains accessible.
- Data attention shows scoped voice/unreviewed counts and links to participation gaps, unresolved corrections, native import, review and handoff.
- Optional `round.facilitator = {phase, note}` preserves chosen stage and a note up to 1,000 characters. The backup schema supports it while older backups remain valid. Legacy work positions provide a clearly labeled suggested entry.
- Notes require Save; draft text survives stage/round/language navigation within the tab. Unsaved notes warn before leaving. Stage and saved notes remain in IndexedDB; localStorage supplements sessionStorage for last-issue selection. This is not cross-device/cloud synchronization.
- Full-project compare-and-save rejects stale writes across browser tabs, including changes outside operations. A failed save retains the draft and offers private backup/reload; it never silently overwrites newer data.
- Ask AI prepares an editable, copyable/downloadable question for the user’s own agent. Automatically attached context is limited to phase, rehearsal flag and evidence counts. No source text, names, identifiers, goals or facilitator notes are included by default. User-entered questions can contain private text, so preview is required. There is no embedded model answer, API key collection or outbound AI request.

中文操作：進入「主持引導」→ 選擇階段 → 看 IN／OUT 與建議動作 → 開工具或接回成果 → 核對來源／更正／參與缺口 → 保存接續筆記。遇到困難可預覽 AI 提問，複製給自己的 Agent。

English operation: open Facilitator guide → choose a stage → inspect IN/OUT and the suggested action → open a tool or return its results → check sources, corrections and participation gaps → save a continuation note. When stuck, preview a question and copy it to your own agent.

## Next increments / 後續階段

2. **Tool-specific operation / 工具操作引導**: add short worked examples and per-tool checklists within the same working context, retain actual activity links and distinguish opening, exporting, sending and receiving. Do not imply adapters offer unsupported round trips.
3. **Evidence-aware next actions / 根據證據安排工作**: present a prioritized, explainable task queue from corrections, missing perspectives, pending replies and carry-forward records. Facilitators can override suggestions; choosing another stage does not complete a task.
4. **Optional embedded AI / 選配頁內 AI**: only after provider, credentials, retention and cost are defined. Reuse the preview boundary; agent recommendations never directly publish, change decisions or infer missing identities/authority. Current implementation intentionally delivers a prompt handoff.

## Validation / 驗證

- Full check: 401 unit tests + 57 Worker tests, syntax, type checks, generated contracts and production dry-run passed.
- New tests cover all eight phases, old backups, per-round notes, source-preserving navigation, bilingual rendering, prompt exclusion, storage fallback and stale-write/retry behavior.
- Browser QA on the local read-only fixture: stage changes, note save/reload, independent new-tab resume, AI preview, Chinese/English, 390 px dark-mode layout and the issue-editor action. Two-tab conflict visibly rejected and retained the draft.
- Production verification is recorded in the delivery response; local QA alone is not deployment evidence.
