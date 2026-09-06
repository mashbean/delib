# Delib 方法論與來源查核 / Methodology and source audit

查核日期：2026-09-06。用途：支援本次 Delib 首頁、八步驟互動、跨輪引導、Agent prompt 與工具整合。以下「建議」是 Delib 的產品設計綜合，並非任何組織對 Delib 的認證。外部網站與 repository 的公開說明不等於本次已完成部署或資料往返測試。

## 建議採用的主軸

**讓參與者看見自己在哪一輪、為何用這個工具、聲音如何影響下一步。** 保留既有八步驟，但以「輪次 × 步驟 × 線上／實體」呈現。抽樣是有條件的分支；學習、聆聽、比較可以往返。每輪結束必須帶走未解問題、缺席聲音、負責人與下一輪起點。

**Show the round, the reason for each tool, and how a contribution changes what happens next.** Keep the eight familiar stages, with online and in-person participation as connected modes. Sampling is conditional. Learning, listening, and comparison can repeat. Every round leaves a response record and a reason for the next round.

這呼應 Metagov 的循環治理：工具只完成治理中的部分功能，實務流程可從不同位置開始、跨階段往返，並接回行動與檢討；並非所有活動必須依序跑完同一條管線。[Metagov 工具圖譜](https://metagov.org/delib-tools)、[Building Composable Governance Software](https://metagov.org/files/govloop.pdf)

## 可直接用在網頁的組織卡片

| 組織 | 正體中文引導 | English guidance | 主要來源與適用範圍 |
| --- | --- | --- | --- |
| MIT Center for Constructive Communication | 先從小組建立信任，再把不同房間的理解串起來。經驗先於立場，摘要要能回到原話。 | Build trust in small groups, then connect understanding across rooms. Start with lived experience and keep a route back to the original words. | [CCC 原則](https://www.ccc.mit.edu/about/)、[Forage](https://www.ccc.mit.edu/project/forage/)；小組方法與附來源的檢索原型。 |
| Cortico | 先準備共同提問與主持指引；在錄音、轉寫、上傳前說明用途並取得同意。 | Prepare shared prompts and facilitator notes. Explain recording, transcription, and hosting before obtaining consent. | [Conversation Guide Library](https://help.cortico.ai/hc/en-us/articles/19581097938071-Conversation-Guide-Library)、[Capturing consent](https://help.cortico.ai/hc/en-us/articles/4824680189207-Capturing-consent)；可用的主持資源。 |
| Collective Intelligence Project | 觀察跨群體都能接受的方向，保留不同意的理由；以相同問題追蹤多輪變化。 | Look for support across groups, preserve objections, and revisit consistent questions across rounds. | [Community Models](https://blog.cip.org/p/community-models)、[Global Dialogues Index](https://www.cip.org/2025gdindex)；群體支持與持續研究，不是任何投票自動得到代表性。 |
| New_ Public | 讓人願意進來、認識彼此、理解議題，最後知道能一起做什麼。維護社群的人也需要明確角色。 | Help people feel welcome, connect, understand, and act together. Make community stewardship visible. | [Civic Signals：Thoughtful conversation](https://newpublic.org/uploads/2020/10/S12-Promote-thoughtful-conversation.pdf)、[Roundabout](https://joinroundabout.com/)；公共空間設計與地方社群實作。 |
| Metagov | 把審議當成可重複的治理循環。每個工具交出能被下一個工具讀懂的資料。 | Treat deliberation as a repeatable governance cycle. Give every tool an explicit, portable handoff. | [Deliberative Tools Gallery](https://metagov.org/delib-tools)、[Interoperability repository](https://github.com/metagov/interop)；平面檔匯入／匯出要求，不代表統一成品標準已存在。 |
| Stanford Deliberative Democracy Lab | 先讀多方證據，在有主持的小組中提問，再比較討論前後的看法；公開抽樣與流失限制。 | Read balanced material, develop questions in facilitated groups, then compare views before and after deliberation. Disclose sampling and attrition. | [Deliberative Polling methodology](https://deliberation.stanford.edu/what-deliberative-pollingr)、[Online Deliberation Platform](https://deliberation.stanford.edu/tools-resources/online-deliberation-platform)。 |
| 新版 vTaiwan / Civic Talk | 建立資訊基礎 → 用自己的 AI 想清楚 → 帶回意見 → 更新資訊基礎，讓下一輪看見新問題。 | Build a shared information base, reflect with your own AI, return your view, and update the material for the next round. | [現行 Civic Talk 說明](https://civic.vtaiwan.tw/about)、[官方連出的 repository](https://github.com/g0v/civic-talk-hono)；現行實驗平台，避免沿用舊站描述。 |
| Civic AI | 讓 Agent 有明確服務範圍、責任人、更正與停止方式；幫人參與和記憶，決定權仍由實際有權者承擔。 | Give the agent a bounded mandate, accountable owner, correction path, and stopping rule. Help people participate and remember; make decision authority explicit. | [OpenClaw Bootstrap Guide](https://civic.ai/openclaw/)、[6-Pack of Care](https://civic.ai/)；治理原則與機器可讀 skill 的出版模式。 |

## 八步驟：每個位置都有下一步建議

下表是依 Delib 現有 `public/data/deliberation-process.json` 的八個 ID 設計的產品文案。工具名稱代表應提供的優先路線，實際上線狀態仍由整合與端點查核決定。

| ID／階段 | 本輪要回答 / Question for this round | 線上與實體的對接 / Mode handoff | 優先工具與交付物 | 前往下一步的條件 / Move on when |
| --- | --- | --- | --- | --- |
| `frame` 定義問題 / Frame the question | 誰受到影響？誰能作決定？ / Who is affected, and who can decide? | 線上共同改寫 brief；實體用主持開場確認問題。 / Edit the brief online; confirm it in the room. | Delib brief；Pocket Reply 的回覆責任表。交付：範圍、權限、期限。 | 受影響者能更正問題，且有具名回覆者。 / Affected people can correct the framing, and an owner will respond. |
| `recruit` 招募與接觸 / Invite participation | 哪些聲音還沒進來？ / Whose voices are missing? | 網頁報名配合電話、紙本或現場協助；記錄參與方式。 / Combine online sign-up with assisted or offline access. | Pocket Form；交付：招募缺口與可近用需求，聯絡資料另外保存。 | 主辦者說得出缺口與補邀方法。 / The organizer can name gaps and how to address them. |
| `sortition` 抽樣與分組 / Sample and form groups | 本輪需要抽樣，還是開放參與？ / Does this round need a sample or open participation? | 抽樣名單不自動公開；線上、實體小組共用分組原則。 / Keep rosters private and use a shared grouping rationale across modes. | 選用 OpenDLP／Panelot；開放活動可略過抽樣並保留分組。 | 公開招募、配額、替補與限制；自願參與不稱代表性樣本。 / Recruitment, quotas, replacements, and limits are disclosed. |
| `learn` 共同學習 / Learn together | 我們還缺哪些事實與問題？ / What evidence and questions are still missing? | 先讀短版證據包，現場或線上向不同立場提問，再更新材料。 / Read a short brief, question different perspectives, and update it. | Call-in 提問；Pocket TTTC 整理問題；Civic Talk 為外部進階資料頁。交付：來源、爭點、待查證。 | 支持與反對材料都可查；更正會回寫。 / Evidence from different perspectives is accessible and corrections are retained. |
| `listen` 聆聽經驗 / Listen to experience | 你的經驗讓我們看見什麼？ / What does your experience help others see? | 自填或一對一引導可與小組逐字紀錄併入聲音池；區分原話和整理。 / Combine self-entry, guided reflection, and consented group notes. | Pocket Form／Pocket Harmonica；Pocket Polis 陳述。交付：原話、來源 ID、同意範圍。 | 參與者有更正與撤回途徑；轉寫已校對。 / Participants can correct or withdraw contributions; transcripts are checked. |
| `deliberate` 比較與提案 / Compare and propose | 哪些方向可推進？哪些代價仍有分歧？ / What can move forward, and which tradeoffs remain? | 線上觀點圖帶進實體小組；修正案再回線上比較。 / Bring online patterns into the room and return revised proposals for comparison. | Pocket Polis、Power Ranker；有提案／預算需求才展開相關站內服務。交付：候選方向、少數聲音、涵蓋率。 | 分數與理由都可見；主持者確認異議未被摘要抹平。 / Scores and reasons are visible, and objections remain in the record. |
| `respond` 決定與回覆 / Decide and respond | 誰採取什麼行動，何時回覆？ / Who will act, and when will they respond? | 回覆可線上查閱，實體說明會可逐題追問。 / Publish a response record and allow questions in a follow-up meeting. | Pocket Reply；Pocket TTTC 作整理。交付：原問題 → 回覆 → 採納狀態 → 負責人 → 日期。 | 每個輸入都有已答、待答或不採納理由，且有申訴方式。 / Each input has an answer, pending status, or reason for non-adoption. |
| `feedback` 檢討與下一輪 / Review and continue | 哪些改變已發生？下一輪從哪裡開始？ / What changed, and where should the next round begin? | 線上回饋加入實體回顧，與上輪承諾逐項對照。 / Combine online feedback and in-person review against earlier commitments. | Pocket Form、Pocket Reply、Delib 輪次記錄。交付：結果、更正、未解事項、下一輪 brief。 | 下輪有具體目的、起點、工具、負責人；必要時結案。 / The next round has a purpose, starting stage, tools, and owner—or the process is closed. |

主持提示來源：小組與經驗設計取自 CCC；提問與錄音同意取自 Cortico；前後比較與證據包取自 Stanford；跨群體支持取自 CIP；迭代與交接取自 Metagov；回覆與可修正性取自 Civic AI。這些組合是本案設計，不應標為官方八步驟方法。

## 下一輪的推薦規則

不要把「下一輪」設成回首頁或所有步驟重做。讓使用者先選仍未解決的問題，然後點亮 3D 圖中的建議路徑。

| 觀察 / Observation | 建議起點 / Recommended return | 可顯示的原因 / Explanation |
| --- | --- | --- |
| 缺席聲音 / Missing voices | 02 招募 → 05 聆聽 | 先補齊參與缺口，再解讀意見變化。 / Address participation gaps before interpreting opinion change. |
| 事實有爭議 / Contested evidence | 04 學習 → 06 比較 | 補來源與不同立場的提問，再重新比較選項。 / Add evidence and questions before comparing options again. |
| 選項仍太抽象 / Options remain abstract | 05 經驗 → 06 提案 | 回到具體情境，將原則改成可比較方案。 / Use concrete experiences to turn principles into comparable proposals. |
| 有決定但無行動 / Decision without follow-through | 07 回覆 → 08 檢討 | 指定責任人、期限與可查證進度。 / Assign an owner, deadline, and verifiable progress. |
| 摘要被指出誤讀 / Misinterpretation reported | 原始輸入 → 05／06 → 07 | 修正保留版本與原話連結，不覆寫舊輪。 / Keep a correction history and source links instead of overwriting the earlier round. |
| 新參與者加入 / New participants join | 04 學習 → 05 聆聽 | 提供前輪簡介與未解問題，保留加入時間。 / Offer prior-round context and retain entry timing. |

若跨輪比較人數或支持率，必須分開呈現「同一批回訪參與者」與「本輪新增參與者」，並顯示未完成數；以輪次限定的代碼做選用連結。不要因為每台裝置都有代碼就聲稱是同一人、真實唯一人或具代表性樣本。這是本案的分析防錯建議。

## 3D 區塊與模擬案例建議

- **平面上的八個站點 = 步驟；垂直兩層 = 線上與實體；輪次切換 = 時間。** 不要把動畫前進等同活動完成。每個站點可展開「人怎麼加入／離開」「帶入什麼資料」「帶走什麼」「誰要確認」。
- **紫色人流**顯示招募、換組、回訪、暫離與新加入；**綠色資料流**顯示原話、陳述、投票、摘要、回覆。以圖形和文字同時編碼，不能只靠顏色。點連線看欄位映射與轉換損失；自由文字改成 Polis 種子需人確認語意。
- 線上與實體使用同一輪的 source IDs；不要把實體會議當成單一匿名來源，也不要預設公開逐字稿。每次跨層交接要標「紙本校對」「錄音同意」「帶回小組」「確認修正」等具體動作。
- 旋轉、縮放、暫停與還原視角；鍵盤可直接選八個站點；提供等價的 2D 步驟與清單。`prefers-reduced-motion` 應靜止顯示人／資料位置，而不是完全隱藏資訊。

**模擬案例 / Fictional scenario：河畔社區圖書館要如何延長開館時間？ / How should Riverside Library extend its opening hours?**

所有議題、人物、數量、資料與結果都必須醒目標示模擬；不使用真實社區或實際人物，也不把 AI 人物的改變包裝成社會科學成效。

| 輪次 | 模擬流程與可見變化 | 本輪留下什麼 |
| --- | --- | --- |
| 1 聆聽 / Listen | 24 位模擬參與者用 Form 提出使用情境；12 段模擬 Harmonica 訪談接 TTTC，得到 3 個示意爭點：夜間使用、照顧需求、館員負擔。2 位人物選擇暫離，動畫顯示離場。 | 18 條示意陳述、原始輸入連結；發現缺少輪班工作者聲音。 |
| 2 比較 / Compare | 加入 6 位模擬新參與者；Call-in 問題池與證據包帶進兩個實體小組；Polis 比較後用提案工具改成 3 個有成本的方案。 | 示例共同方向「先試辦兩晚」，以及未解反對理由「人力安排與返家安全」。保留每項修正的上輪來源。 |
| 3 試辦與回覆 / Trial and respond | 用 Power Ranker 比較方案；Pocket Reply 對每個問題建立回覆或待答狀態；模擬試辦 4 週後，Form 回收使用體驗。 | 示例責任人、回覆期限、可驗證指標；若館員負擔仍未解，下一輪回到學習與提案。 |

數字是供示範 UI 的建議初始值；實作應從同一份 fixture 計算數量，避免畫面寫 24 人而檔案只有 8 人。讓使用者下載「本輪輸入／轉換後／回覆收據」並點擊追蹤一位人物的一段原話。任何「實際送到工具」按鈕都要另外顯示會建立的活動、是否公開和管理連結，避免把本機播放誤當成真實送出。

## 工具整合與開源適用性

| 工具／來源 | 本次確認 | 整合判斷 |
| --- | --- | --- |
| Civic Talk（新版 vTaiwan） | 官方 about 連到 `g0v/civic-talk-hono`；repo 列 MIT。核心是產生 prompt、收回結果，Hono + Vue + Workers + D1；投稿需登入。 | **新增外部進階選項；先吸收 OPINION.md 往返方式。** 與本地免登入工具的定位不同；未實測跨站登入／投稿。 [官方說明](https://civic.vtaiwan.tw/about)、[repo](https://github.com/g0v/civic-talk-hono) |
| Uncommon Ground | CC0；`SKILL.md`、零依賴腳本與 agent briefs；強調原問題的逐題回覆與計算涵蓋率。 | **合併在 Pocket Reply 的進階來源下。** 不另做同功能主卡；可借鑑驗證器、來源映射和雙語收據。其模擬接收測試只可標模擬。 [repo](https://github.com/audreyt/uncommon-ground) |
| CIP Community Models / OSCCAI | CIP 官方稱開源並連到 `collect-intel/osccai`；repo 有 Prisma、PostgreSQL、Clerk、Supabase 等依賴；本次未找到清楚頂層 LICENSE 標示。 | **方法來源／進階研究。** 群體支持原則適合吸收；不可直接稱免帳號即用或已具重寫授權。 [CIP 文章](https://blog.cip.org/p/community-models)、[repo](https://github.com/collect-intel/osccai) |
| MIT Forage | 官方列為 prototype；自然語言檢索會附對話片段與引用。CCC 說明其與 Cortico 共享 IP 走開源授權，但不等於所有產品都能公開自架。 | **研究候選；TTTC 的來源回查 UX 參考。** 本次未核實 Forage 的可部署 repo 與授權，不宣稱站內可用。 [Forage](https://www.ccc.mit.edu/project/forage/)、[CCC](https://www.ccc.mit.edu/about/) |
| Cortico / Fora | 查到可用的主持資源與平台使用指引；未核實可完整自架的產品 repository。 | **主持手冊優先。** Pocket Harmonica／Call-in／TTTC 保留本地首選；涉及錄音上傳另交代保存與同意。 [資源庫](https://help.cortico.ai/hc/en-us/articles/19581097938071-Conversation-Guide-Library) |
| Stanford Online Deliberation Platform | 官方描述免下載、計時議程、發言佇列、多人小組及自動主持；需聯絡平台團隊了解使用。 | **外部大型活動選項。** 吸收平等發言與前後比較；未確認公開開源 repo。不能與已開源的 Stanford PB 視為同一產品。 [平台頁](https://deliberation.stanford.edu/tools-resources/online-deliberation-platform) |
| Stanford Participatory Budgeting | Delib 現有 catalog 已列 `StanfordCDT/pb`，且有本地預算功能。 | **與本地預算服務同組。** 原版作進階替代；授權與現行部署細節應由工具審核另查，不因 Stanford 名字相同而合併視訊與預算功能。 |
| PolicyKit（Metagov 合作） | 官方稱開源、MIT；治理程序與可下載的 JSON 投票模板。 | **長期治理的外部進階選項。** 適合多輪成果要變成社群規則；需要社群平台整合與權限，不宜本次直接自動執行治理。 [官方站](https://policykit.org/) |
| New_ Public Roundabout | 官方為 2026 年招募美國地方社群的產品；重點為人類社群維護者與地方資訊。 | **方法與社群經營參考。** 本次未查到可重用的公開授權 repo；不標為可本地部署的開源工具。 [官方產品](https://joinroundabout.com/)、[發布說明](https://newpublic.substack.com/p/introducing-roundabout-built-for) |
| New_ Public Public Spaces Incubator | 官方有計畫頁與研究／原型方向；頁面需 JavaScript，公開發布承諾不能充當已交付程式碼。 | **候選追蹤。** 待可用 toolkit、授權與輸入輸出文件核實，再納入可啟用工具。 [官方計畫](https://newpublic.org/psi)、[2026-08-23 官方更新](https://newpublic.substack.com/p/what-if-you-had-three-months-to-test) |

首層卡片按工作目的整合：**蒐集（Form／Harmonica）→ 提問（Call-in）→ 比較（Polis／Ranker）→ 理解（TTTC）→ 回覆（Reply）**；點開才看原始專案與進階替代方案。相同用途不代表資料語意相同，也不表示 Pocket 重寫擁有原版全部功能。

## 資料標準與交接設計建議

Metagov 的可確認要求是工具可以匯入及匯出 JSON、JSON-LD、CSV 等平面檔；本次沒有證據顯示一個被全生態系共同採用的成品 schema。Delib 應稱「Delib 可攜格式／轉接約定」，並公布版本、測試 fixture 與各工具的轉換能力。[Metagov Interop README](https://github.com/metagov/interop)

下列是本案的建議資料設計，並非已確認實作：

- `processId`、`roundId`、`previousRoundId`、`stage`、`sourceTool`、`sourceRecordId`、`language`、`createdAt`：使每輪與來源可追溯。
- `sourceType` 分 `human-original`、`human-edited`、`ai-summary`、`synthetic-demo`；人類原話、AI 摘要、模擬不能共用沒有標記的內容欄。
- `derivedFrom[]` + `transform` + `reviewStatus`：原話變陳述、陳述變議題樹、議題變回覆，都可查回來源與人工確認。
- `consentScope`、`visibility`、`retentionUntil`、`withdrawnAt`：權限不能只附在原工具中、匯出後消失。公開收據排除聯絡資訊、管理 token 與逐人投票。
- `participants` 與聯絡名單分離；跨工具識別依明確需要與同意，不建立預設全域身分。缺少回應用 `missing`；不知道／跳過與反對分開。
- 同一 topic 合併可保留多來源；同一人多裝置不可用文字相似度猜成同一人。重複匯入以來源 ID 與 import ID 去重，保留轉換紀錄。
- 每個 adapter 公開「能帶過去／會省略／需要人工確認」，例如 TTTC CSV 保留文字但不承諾保留完整投票矩陣；Polis 種子也不等於原始投票資料。
- 轉換前後驗證筆數、引用存在性、語言、孤兒 ID、撤回狀態與允許公開的欄位。測試至少有兩個不同工具的真實 exporter fixture 往返；只驗同一函式的自產資料不足以證明互通。

## Agent skill prompt 的出版方式

提供網頁可讀說明、**複製完整 prompt**、**下載 SKILL.md**，另提供穩定的機器可讀網址。首頁不要求提供 AI API key。說明「把這個流程交給你已在使用的 Agent；工具有 AI 功能時仍可能有自己的額度／服務限制」。Civic Talk 的使用者自帶 AI 工作法與 Civic AI 的機器可讀入口可作為模式參考。[Civic Talk](https://civic.vtaiwan.tw/about)、[Civic AI bootstrap](https://civic.ai/openclaw/)

建議 prompt 最低內容（本案撰寫，可中英並列）：

```text
你是這一場審議活動的流程協作者。先讀本活動 brief、輪次紀錄與工具能力表。
確認議題、受影響者、正式決策權、參與模式、回覆責任人與本輪結束條件。
根據現有資料的缺口，建議本輪從八步驟中的哪一步開始、使用哪些站內工具，
以及每一步的人流、輸入、輸出、人工確認與下一輪條件。

請輸出：
1. 本輪計畫：目的、參與者、步驟、工具、時間與負責人。
2. 資料交接表：source IDs、schema 版本、轉換損失、同意／公開／保存範圍。
3. 主持引導：共同證據、生活經驗、不同意的理由與更正途徑。
4. 成果收據草稿：原問題、來源、整理、正式回覆、待答項目、下一輪起點。

只依可查的資料整理。保留少數聲音，不把工具分數叫做共識，不替參與者投票，
不把 AI 生成的角色、回答或效果混入真實活動。模擬必須另存並明示。
未知欄位標記待補；管理連結、聯絡名單和逐人投票不寫入公開成果。
建立活動、公開資料或對外發送前，依主辦者已給的授權範圍行動；
沒有授權的具體外部動作，先呈現可檢視的內容與影響。
每輪保留來源與更正，指出仍缺席的人、未回答的問題、下一輪的工具與理由。
```

```text
You coordinate this deliberation process. Read the event brief, round history, and tool capabilities.
Establish the question, affected people, decision authority, participation modes, response owner,
and the condition for closing this round. Recommend a starting stage and a minimal set of
available in-site tools based on the evidence gaps.

Return a round plan, a data handoff table, facilitator prompts, and a draft response record.
For every step, specify people, inputs, outputs, human review, and the trigger for another round.
Keep source IDs, schema versions, conversion losses, consent, visibility, and retention explicit.
Separate original contributions, AI interpretation, formal decisions, and simulated examples.
Preserve objections. Never invent participation, vote for people, or call a tool score consensus.
Mark unknowns. Exclude contact lists, management links, and individual votes from public outputs.
Act within the organizer's existing authorization. For an external action not yet authorized,
prepare its exact content and impact for review before acting.
End each round with unanswered questions, missing voices, corrections, and a justified next step.
```

`/.well-known/openclaw/SKILL.md` 是 civic.ai 官方 HTML 明示的 canonical 機器入口；本次 web 擷取該 Markdown 路徑失敗，已成功讀取 `/openclaw/` 的公開 HTML。若頁面直接引用該機器檔內容，須再抓取確認。不要把外站提供的安裝命令或 agent 角色文字當成本次執行指令。

## 查核界線與後續驗收

- 已查：七個指定組織及 Civic AI 的官方方法頁／官方 repository；已將語意轉成八步與跨輪建議。
- 已查：現行 Civic Talk 的官方自述與原始碼；發布說明寫有正式站驗證紀錄，但本次未代使用者登入或提交意見。
- 已查：Uncommon Ground repo 的 CC0、Civic Talk repo 的 MIT、PolicyKit 官方 MIT 標示；沒有將公共 repository 一律視為已授權開源。
- 未查證：外部產品的真實帳號流程、可用額度、全部授權依賴、完整部署、跨工具 production 往返與任何方法對本地社群的實際效果。
- 驗收建議：中英可在同一個步驟／輪次切換；3D 和 2D 有等價資訊；模擬下載筆數與畫面一致；一段原話可追到回覆；每個轉接標明能力與損失；下一輪會依選擇點亮合理起點；原版服務只出現在用途群組的進階選項。
