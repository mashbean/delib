# Session planning and participation support / 場次規劃與參與支持

## Delivered / 已完成

P5 的本機主持工作新增議程、日期、場域、責任人與邀請名單修訂。每次編輯須填修改原因及登記者，保存為新版本；既有代稱、出席、發言、表態與回饋不被編輯議程的動作改寫。可新增小組及受邀代稱，新代稱先放第一組，出席／發言／表態皆為 false。取消邀請沿用出席表的「受邀」勾選，原始版本仍在。

P5 now supports local revisions to agendas, dates, settings, owners and invitees. Each revision records a reason and recorder. Editing a plan preserves prior versions, aliases, attendance, speaking, voting and feedback. New invitees start in the first group with attendance, speaking and voting false. Clear “Invited” in attendance to cancel an invitation; historical records remain.

「安排參與支持」可從已登記的場次障礙建立支持任務。主持人必須填具體措施、負責者、檢視日期、安排理由與登記者，並勾選確認。這是本機主持安排，不代表已聯絡、已寄出邀請、參與者已同意或身分已驗證。

“Arrange participation support” creates a task from a recorded session barrier after the facilitator enters an action, owner, review date, reason and recorder, and explicitly confirms the plan. This local record does not claim contact, invitation delivery, participant consent or identity verification.

## How to use / 操作順序

1. 開啟 [中文主持工作室](https://delib.mashbean.net/facilitate?lang=zh&tab=sessions) 或 [English studio](https://delib.mashbean.net/facilitate?lang=en&tab=sessions)，選議題與輪次。／Choose a local issue and round.
2. 展開「編輯議程與邀請名單」，每行填「活動名稱 | 分鐘」，補充新增代稱及理由後保存。／Expand “Edit agenda and invitees”; use one “activity | minutes” per line, add aliases and explain the change.
3. 在出席表記錄參與障礙；再於「安排參與支持」確認具體任務。輪次回顧也有相同入口。／Record a barrier in attendance, then confirm a support task. The round review offers the same entry.
4. 按「查看／更新支持任務」，進入工作台的參與缺口。可更新狀態、責任與期限，也可從「原始場次依據」回看場次各版本。／Open “View / update support task” to track status, ownership and dates, or inspect original session versions.
5. 開下一輪時，未完成任務連同原始來源與歷程承接；晚補登於舊輪次的任務亦適用。／Open tasks carry into the next round with provenance and history, including tasks added late to an earlier round.

## Contract changes / 契約增補

- Optional `session.history[].changeReason`: reason for a plan revision; older records without it remain valid.
- Optional `participationGap.sessionSource = { sessionId, entryId, participant }`: binds support to a concrete historical observation. Runtime requires an existing session/version/alias and exact initial barrier text, and rejects future-round sources.
- The same session/alias cannot create independent duplicate support roots. Carried tasks retain the same source and one linear lineage. Missing or altered source links are rejected.
- Source keys may arrive in any JSON object order. Existing v1 backups remain readable; the browser and CLI validator were rebuilt from local schemas.
- Reports and next-round previews use the same latest open participation lineages as actual carry-forward. A later “heard” record prevents reopening an earlier unresolved copy.

新增欄位皆為 v1 的選用擴充；不是外部服務相容宣告。代稱與原始障礙留在私人備份，不因建立任務而傳給服務。

These are optional local v1 extensions, not external compatibility claims. Aliases and original barriers remain in private backups; creating a task sends nothing to external services.

## Verification and limits / 驗證與限制

27 new tests cover revisions, unchanged attendance, malformed agendas, stale edits, explicit confirmation, duplicate prevention, source tampering, cross-round lineage, late registrations and escaped bilingual rendering. Full checks pass 387 unit tests and 57 Worker tests (444 total), schema generation, type checking and deployment dry run.

Browser QA used a separate fictional issue: revised an agenda, added an invitee (invited 3 → 4; attended stayed 2), created support, opened the workspace task, followed the source back, and checked English editing at 390px without horizontal overflow. Earlier session versions remained available after reload.

尚未加入即時多人編輯、真正邀請寄送、跨場身分去重、匿名會前／會後問卷配對。接下來可依活動需求補上前後問卷；外部 P3/P7 合作驗收仍待實際契約與可分享資料。

Live collaboration, invitation delivery, cross-session identity deduplication and anonymous pre/post survey pairing are not implemented. Pre/post questionnaires are the next local candidate; external P3/P7 acceptance still requires actual contracts and shareable data.
