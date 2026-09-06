import { rankingReceiptSummary as originalReceiptSummary, rankingReceiptToMarkdown as originalReceiptMarkdown, decisionStatusLabel as originalDecisionStatus } from "./ranking-receipt-core.js";
// Explicit UI translations. Participant labels and organizer prose are never translated.
export const RANKING_EN = Object.freeze({
  "主辦者彙整": "Organizer aggregation",
  "把多人結果合在一起": "Combine results from multiple people",
  "選取參與者交回的個人結果 JSON；合併在本機完成，不會上傳。": "Select the individual result JSON files returned by participants. Merging happens locally; files are not uploaded.",
  "合併 Power Ranker 結果 · Delib": "Combine Power Ranker results · Delib",
  "無法讀取排序題目。": "The ranking question could not be read.",
  "這個連結沒有有效題目。請回到 Delib，填入 3–10 個不重複選項。": "This link has no valid question. Return to Delib and enter 3–10 distinct proposals.",
  "找不到這個收件室。": "This room could not be found.",
  "公開連結不完整，請向主辦者索取新的參與連結。": "The participant link is incomplete. Ask the organizer for a new link.",
  "收件室的題目格式不完整": "The room's question is incomplete",
  "短期收件室 · 主辦者": "Temporary room · Organizer",
  "短期收件室 · 參與者": "Temporary room · Participant",
  "短期彙整": "Temporary aggregation",
  "送出時，逐題判斷只用來立即增加成對計數；Delib 不保存可逐份還原的原始判斷。": "On submission, each judgment immediately increases pair counts. Delib does not store a reconstructable copy of your individual judgments.",
  "伺服器保存公開題目、彙整計數與隨機參與代碼 的 無法回推的摘要（SHA-256）；到期或主辦者提前刪除時一併清除。": "The server stores the public question, aggregate counts and SHA-256 hashes of random session IDs. They are cleared at expiry or when the organizer deletes the room.",
  "收件室暫時無法讀取": "The room is temporarily unavailable",
  "私人管理連結可能不正確或已經到期。": "The private management link may be incorrect or expired.",
  "這個收件室可能已到期或由主辦者提前刪除。": "This room may have expired or been deleted by its organizer.",
  "暫時無法更新群體結果。": "The group results could not be refreshed.",
  "已完成 ${0} 組；建議比較 ${1} 組。": "Comparisons completed: ${0}; recommended: ${1}.",
  "選擇目前較應優先的項目；無法區分時可以選一樣重要。": "Choose the item that deserves priority, or select equally important.",
  "已回到上一組比較。": "Returned to the previous comparison.",
  "已用 ${0} 組比較產生結果；完整配對共有 ${1} 組。": "Results use ${0} comparisons out of ${1} possible pairs.",
  "這份個人結果仍只在目前分頁；勾選說明並送出後，伺服器才會立即合併成計數。": "Your individual results are still in this tab. After you confirm and submit, the server merges them directly into counts.",
  "結果只留在這個分頁；下載後才會形成可交接檔案。": "Results remain in this tab. Download them to create a file for the next step.",
  "已清除目前分頁裡的選擇。": "Choices in this tab have been cleared.",
  "送出前請先確認短期保存方式。": "Confirm the temporary storage terms before submitting.",
  "正在送出並合併成對計數。": "Submitting and merging pair counts.",
  "這個瀏覽器 session 已經送過，沒有重複計入。": "This browser session already submitted; it was not counted twice.",
  "已合併成無法回推個人計數；伺服器沒有保存這份逐題判斷。": "Merged into aggregate counts. The server did not retain your individual judgments.",
  "這輪選擇暫時沒有送出。": "This round could not be submitted.",
  "正在清除收件室。": "Deleting the room.",
  "收件室已刪除；題目、參與代碼摘要與彙整計數都已清除。": "The room, question, session hashes and aggregate counts have been deleted.",
  "收件室沒有完成刪除。": "The room could not be deleted.",
  "已停止收件；參與者仍能在本機完成排序，但不能再送進這個收件室。": "Submissions are closed. Participants can still rank locally but cannot submit to this room.",
  "暫時無法停止收件，請稍後再試。": "Submissions could not be closed. Please try again later.",
  "已收到 ${0} 份不重複結果${1}": "${0} distinct results received${1}",
  "（主辦者已停止收件）": " (submissions closed)",
  "預計於 ${0} 自動清除。": "Scheduled for deletion on ${0}.",
  "已停止收件": "Submissions closed",
  "停止收件": "Close submissions",
  "主辦者已停止收件；你仍可以在本機完成排序並下載個人結果。": "The organizer closed submissions. You can still rank locally and download your results.",
  "尚未收到結果；管理頁會在第一份送達後顯示彙整。": "No results yet. The management page shows aggregates after the first submission.",
  "至少收到 ${0} 份才會顯示群體排序。": "Group rankings appear after at least ${0} submissions.",
  "群體計數格式不完整，請稍後再更新。": "The group counts are incomplete. Please refresh later.",
  "管理者預覽：目前 ${0} 份；參與者仍看不到群體排序。": "Organizer preview: ${0} submissions; participants cannot yet see the group ranking.",
  "目前合併 ${0} 份、${1} 組成對計數。": "Combined ${0} submissions and ${1} pairwise judgments.",
  "短期收件室彙整": "Temporary room aggregate",
  "服務回應格式不完整": "The service response was incomplete",
  "服務暫時無法回應": "The service is temporarily unavailable",
  "${0}. ${1} — 模型權重 ${2}": "${0}. ${1} — model weight ${2}",
  "# ${0}\n\n${1}\n\n比較 ${2}/${3} 組。模型權重不是支持率或共識證明。": "# ${0}\n\n${1}\n\n${2}/${3} pairs compared. Model weights are not support rates or evidence of consensus.",
  "成果摘要已複製。": "Result summary copied.",
  "瀏覽器沒有允許複製；請改下載 CSV。": "Clipboard access was denied. Download CSV instead.",
  "尚未選取檔案。": "No files selected.",
  "沒有可彙整的同題結果；${0} 份格式、題目或內容不符。": "No matching results to merge; ${0} files have an incompatible format, question or content.",
  "選取的檔案不是這一題，沒有進行彙整。": "The selected files use a different question and were not merged.",
  "已在本機彙整 ${0} 份；排除 ${1} 份重複 session、${2} 份無效或不同題檔案。": "Merged ${0} files locally; excluded ${1} duplicate sessions and ${2} invalid or different-question files.",
  "瀏覽器本機彙整": "Local browser aggregate",
  " 至少需要 3 份不重複 session，才能準備公開成果收據。": " At least 3 distinct sessions are required to prepare a public result receipt.",
  "${0} 份不重複 session、${1} 組成對判斷；比較涵蓋 ${2}/${3} 組。": "${0} distinct sessions, ${1} pairwise judgments; ${2}/${3} pairs covered.",
  "請先產生一份群體彙整結果。": "Create a group aggregate first.",
  "公開前請先確認資料邊界與回覆責任。": "Confirm data boundaries and response responsibilities before publishing.",
  "成果已產生。這份連結較長，請同時下載 JSON，避免通訊軟體截斷網址。": "Receipt prepared. This link is long; also download JSON in case a messaging service truncates it.",
  "成果已在瀏覽器中產生；先預覽校對，再決定是否分享。": "Receipt prepared in your browser. Preview and check it before deciding to share.",
  "成果收據暫時無法產生。": "The result receipt could not be prepared.",
  "公開成果連結已複製；連結內含彙整資料與主辦者說明，請視為公開內容。": "Public receipt link copied. It includes aggregate data and the organizer's explanation; treat it as public.",
  "瀏覽器沒有允許複製；請打開預覽後從網址列複製。": "Clipboard access was denied. Open the preview and copy from the address bar.",
  "內容已變更；請重新確認後再產生新的成果連結。": "Content has changed. Review it again before generating a new receipt link.",
  "權重 ${0} · ${1} 次比較": "Weight ${0} · ${1} comparisons",
  "已下載 ${0}。": "Downloaded ${0}.",
  "正在讀取公開成果…": "Loading the public result…",
  "公開成果暫時無法讀取。": "The public result is temporarily unavailable.",
  "這份公開成果現在看不到": "This public result is currently unavailable",
  "${0} · 成果收據 · Delib": "${0} · Result receipt · Delib",
  "準備於 ${0}": "Prepared ${0}",
  "比較涵蓋 · ${0}%": "Pair coverage · ${0}%",
  "尚未設定日期": "No date set",
  "原始短期收件室預計於 ${0} 清除；這張收據是另行分享的自足副本。": "The original temporary room is scheduled for deletion on ${0}; this receipt is a separately shared, self-contained copy.",
  "原始彙整來自短期收件室；這張收據是另行分享的自足副本。": "The original aggregate came from a temporary room; this receipt is a separately shared, self-contained copy.",
  "原始彙整在主辦者瀏覽器中完成；Delib 沒有收到個人結果檔或保存這張收據。": "The original aggregate was prepared in the organizer's browser. Delib did not receive individual files or store this receipt.",
  "瀏覽器無法暫存這份草稿；請改用複製成果摘要。": "The browser cannot hold this draft. Copy the result summary instead.",
  "成果摘要與公開連結已複製。": "Result summary and public link copied.",
  "瀏覽器沒有允許複製；請改下載 Markdown。": "Clipboard access was denied. Download Markdown instead.",
  "在瀏覽器內完成成對優先序排序，並匯出可攜的 Delib 資料包。": "Rank priorities in pairs in your browser and export portable Delib data.",
  "Power Ranker · Delib 審議拼圖": "Power Ranker · Delib",
  "跳到排序題目": "Skip to the ranking question",
  "回 Delib 審議拼圖": "Back to Delib",
  "回到工具設定": "Back to tool setup",
  "本機成對排序": "Local pairwise ranking",
  "成對排序": "Pairwise ranking",
  "正在讀取題目。": "Loading the question.",
  "查看演算法原始碼 ↗": "View the algorithm source ↗",
  "只在本機": "Local only",
  "題目放在網址井字號（#）後面，選擇只留在目前分頁；Delib 不會收到或保存答案。": "The question is encoded after # in the URL. Your choices remain in this tab; Delib does not receive or store your answers.",
  "匯出的隨機參與代碼可協助排除重複檔，但仍應視為化名參與資料。": "Exported random session IDs help detect duplicates and should still be treated as pseudonymous participant data.",
  "短期多人收件室": "Temporary shared room",
  "尚未收到結果": "No results yet",
  "更新群體結果": "Refresh group results",
  "目前分頁的一輪選擇": "One round of choices in this tab",
  "準備第一組比較。": "Preparing the first comparison.",
  "上一步": "Undo",
  "如果現在只能優先做一項，你會選哪個？": "If you could prioritize only one item now, which would you choose?",
  "或": "or",
  "兩項一樣重要": "Equally important",
  "先看目前結果": "View current results",
  "基本比較完成後可以先停，也可以繼續增加排序證據。": "Stop after the basic comparisons, or continue collecting ranking evidence.",
  "本機結果": "Local results",
  "目前這一輪的排序": "Ranking for this round",
  "模型分數是這批成對選擇形成的相對權重，不是支持率、預算比例，也不能單獨證明群體共識。": "Model scores are relative weights produced by these pairwise choices. They are not support rates, budget shares or proof of group consensus.",
  "我知道送出後，Delib 會立即把這輪判斷合併成計數，只保存隨機參與代碼 的雜湊，不保存我的逐題判斷。": "I understand that Delib immediately merges submitted judgments into counts, stores only a hash of the random session ID, and does not keep my individual judgments.",
  "送出這輪選擇": "Submit this round",
  "下載個人結果 JSON": "Download individual JSON",
  "下載通用資料": "Download portable data",
  "下載排序 CSV": "Download ranking CSV",
  "複製成果摘要": "Copy result summary",
  "再比較一組": "Compare another pair",
  "清除並重來": "Clear and restart",
  "這個收件室的群體排序": "This room's group ranking",
  "只呈現無法回推個人的成對計數；這不是代表性樣本、支持率或正式共識。": "Only aggregate pair counts are shown. These are not a representative sample, support rates or formal consensus.",
  "下載群體 JSON": "Download group JSON",
  "下載群體 CSV": "Download group CSV",
  "主辦者管理": "Organizer controls",
  "停止收件後，已收到的結果仍可查看到期為止；參與者送出時會看到「主辦者已停止收件」。": "After submissions close, existing results remain readable until expiry. Participants attempting to submit will see that submissions are closed.",
  "提前刪除會立即清除題目、參與代碼摘要與全部彙整計數，無法復原。": "Deleting early permanently clears the question, session hashes and all aggregate counts.",
  "我確認已下載需要保留的彙整結果。": "I confirm I have downloaded any aggregate results I need to keep.",
  "提前刪除收件室": "Delete this room early",
  "把多人下載的結果合在一起": "Combine downloaded results from multiple people",
  "選取參與者交回的 JSON；瀏覽器會在本機排除重複 session，合併成對計數，再產生一份不保留個別連結的彙整資料包。": "Select participant JSON files. Your browser removes duplicate sessions and combines pair counts locally, producing an aggregate bundle without individual links.",
  "選取個人結果 JSON": "Select individual result JSON files",
  "最多 100 份；檔案不會上傳到 Delib。": "Up to 100 files; nothing is uploaded to Delib.",
  "下載彙整 JSON": "Download aggregate JSON",
  "下載彙整 CSV": "Download aggregate CSV",
  "把排序接成下一輪行動": "Turn the ranking into next-round action",
  "至少三份不重複 session 的彙整才可公開。請補上主辦者的解讀、未被代表的聲音、真正的決策狀態與回覆責任，再產生可以檢查的成果頁。": "Public receipts require at least three distinct sessions. Add the organizer's interpretation, missing voices, actual decision status and response responsibilities to create a reviewable result page.",
  "目前決策狀態": "Current decision status",
  "尚在聆聽": "Still listening",
  "正在評估": "Under review",
  "已採納": "Adopted",
  "部分採納": "Partially adopted",
  "未採納": "Not adopted",
  "誰確認這個狀態？": "Who confirms this status?",
  "例如：公園改善工作小組": "For example: Park improvement working group",
  "主辦者怎麼解讀這份排序？": "How does the organizer interpret this ranking?",
  "說明看見的優先序、接近的取捨與仍有爭議之處；不要把模型權重寫成支持率。": "Explain priorities, close trade-offs and remaining disagreement. Do not describe model weights as support rates.",
  "哪些人或觀點還沒有被充分納入？": "Which people or perspectives are still missing?",
  "例如：夜間較少使用公園的人、兒童與行動不便者尚未被充分邀請。": "For example: infrequent nighttime users, children and people with limited mobility have not been sufficiently invited.",
  "下一步由誰負責？": "Who owns the next action?",
  "例如：社區發展協會": "For example: Community development association",
  "預計何時回應？（選填）": "Expected response date (optional)",
  "具體下一步": "Specific next action",
  "例如：補訪尚未納入的使用者，並在下次公開會議逐項回覆。": "For example: interview missing users and respond to each issue at the next public meeting.",
  "公開依據或會議紀錄（選填）": "Public evidence or meeting record (optional)",
  "產生後會發生：": "After generating the receipt:",
  "只帶入無法回推個人的彙整計數，不含個別 session、逐題判斷或管理權杖；": "It contains aggregate counts without individual sessions, judgments or management keys;",
  "成果資料編碼在網址 # 後方，不會隨頁面請求送到本站伺服器；": "Receipt data is encoded after # in the URL and is not sent with the page request to this server;",
  "任何拿到連結的人都能閱讀、複製與再次分享，請把它視為公開成果。": "Anyone with the link can read, copy and reshare it. Treat it as public.",
  "我已區分「工具計算」與「主辦者解讀」，確認沒有放入未經同意的個資，並願意公開承擔上面寫的回覆責任。": "I have separated tool calculations from organizer interpretation, checked that no personal data is included without consent, and accept the response responsibilities described above.",
  "產生成果收據": "Generate result receipt",
  "成果收據準備好了": "Your result receipt is ready",
  "先打開預覽逐項校對；確定無誤後再把公開連結交給參與者。": "Open the preview and check each section before sharing the public link with participants.",
  "預覽成果頁 ↗": "Preview result page ↗",
  "複製公開連結": "Copy public link",
  "下載收據 JSON": "Download receipt JSON",
  "下載 Markdown": "Download Markdown",
  "排序方法是 MIT 授權 PowerRanker 演算法的瀏覽器版本；完整來源與修改說明見": "This ranking method is a browser port of the MIT-licensed PowerRanker algorithm. Source and modification details are in",
  "Power Ranker 群體排序的可檢查成果收據、主辦者解讀與下一步責任。": "A reviewable Power Ranker group result receipt, organizer interpretation and next-step responsibilities.",
  "Power Ranker 成果收據 · Delib": "Power Ranker result receipt · Delib",
  "跳到成果內容": "Skip to result content",
  "成果收據": "Result receipt",
  "開啟新一輪": "Start a new round",
  "這份成果收據無法讀取": "This result receipt could not be read",
  "連結可能不完整、被通訊軟體截斷，或不是目前支援的格式。請向主辦者索取新的成果連結或 JSON 檔。": "The link may be incomplete, truncated by a messaging service or in an unsupported format. Ask the organizer for a new link or JSON file.",
  "回到 Delib": "Back to Delib",
  "這不是投票結果。以下把工具計算、主辦者解讀、決策狀態與下一步分開呈現，讓參與者知道意見後來去了哪裡。": "This page separates calculations, organizer interpretation, decision status and next actions so participants can trace what happened to their input.",
  "成果收據資料狀態": "Result receipt data status",
  "可攜成果": "Portable result",
  "收據未另存於 Delib": "Receipt not separately stored by Delib",
  "彙整範圍": "Aggregate scope",
  "不重複 session": "distinct sessions",
  "成對判斷": "pairwise judgments",
  "比較涵蓋": "pair coverage",
  "工具計算": "Tool calculations",
  "群體相對排序": "Group relative ranking",
  "查看原始排序頁 ↗": "View the original ranking ↗",
  "模型權重是這批成對判斷形成的相對排序，不是支持率、預算比例，也不能單獨證明群體共識。": "Model weights describe the relative ranking produced by these judgments. They are not support rates, budget shares or proof of group consensus.",
  "主辦者解讀": "Organizer interpretation",
  "這份排序怎麼被理解": "How this ranking is understood",
  "未納入／限制": "Missing voices / limitations",
  "還缺少哪些聲音": "Whose perspectives are missing",
  "人工聲明": "Human statement",
  "決策狀態與確認者": "Decision status and confirmer",
  "· 由": "· confirmed by",
  "確認": "",
  "查看公開依據 ↗": "View public evidence ↗",
  "下一步": "Next action",
  "誰要在何時做什麼": "Who will do what, and when",
  "負責回應": "Responsible person",
  "預計回應": "Expected response",
  "具體行動": "Specific action",
  "資料邊界": "Data boundaries",
  "這張成果頁帶了什麼": "What this result page contains",
  "包含無法回推個人的群體成對計數，也就是參與資料的彙整；": "Aggregate group pair counts, which are derived from participation;",
  "不含個別 參與代碼、逐題判斷、姓名、聯絡方式或參與者自由文字；": "No individual session IDs, judgments, names, contact details or participant free text;",
  "包含主辦者主動填寫的解讀與責任聲明；網址可以被複製與再次分享。": "The organizer's interpretation and responsibility statement. The URL can be copied and reshared.",
  "短而穩定的分享": "Short, durable sharing",
  "留一個可以到期、可以刪除的短網址": "Create a short URL with expiry and deletion controls",
  "原本的無儲存長網址仍可繼續使用。": "The original long URL without server storage remains usable.",
  "Delib 只保存本頁看得到的群體成對計數、相對排序、主辦者解讀與下一步；不保存 參與代碼、逐題判斷、來源檔或管理憑證。": "Delib stores only the group pair counts, relative ranking, organizer interpretation and next steps shown here. It does not store session IDs, individual judgments, source files or management keys.",
  "保存期限": "Retention period",
  "30 天": "30 days",
  "1 年": "1 year",
  "3 年": "3 years",
  "我確認本頁的群體彙整、排序與主辦者說明可以公開。": "I confirm that these aggregate results, rankings and organizer explanations may be public.",
  "建立公開短網址": "Create public short URL",
  "公開短網址": "Public short URL",
  "複製公開網址": "Copy public URL",
  "私人刪除網址": "Private deletion URL",
  "複製私人網址": "Copy private URL",
  "立即刪除公開成果": "Delete this public result now",
  "私人網址的刪除權杖只存在網址 # 後方；Delib 只保存雜湊，無法替你找回。": "The private deletion key exists only after # in the URL. Delib stores its hash and cannot recover the key for you.",
  "接到下一輪": "Continue into another round",
  "下一步想開哪一個齒輪？": "Which tool should come next?",
  "先看會帶走什麼，再回 Delib 逐欄確認。": "Review what will carry over, then confirm each field in Delib.",
  "選擇下一步工具": "Choose the next tool",
  "成果回報場": "Report-back event",
  "補訪缺席聲音": "Reach missing voices",
  "整理下一輪文字": "Organize next-round text",
  "開放新陳述": "Invite new statements",
  "會帶入草稿：": "Draft will include:",
  "排序收據沒有文字意見。若前一輪用過口袋審議，到其報告頁的「資料與其他工具」下載 tttc.csv，或把 statements.csv 與 votes.csv 帶到": "Ranking receipts contain no text contributions. If you used Pocket Polis, download tttc.csv from its report's data section, or bring statements.csv and votes.csv to the",
  "Delib 資料工作台": "Delib data workbench",
  "轉換。": "for conversion.",
  "草稿只在同一分頁暫存，最多兩小時；可在預覽頁下載或清除。開啟工具後仍須人工貼上、審閱與確認，不會自動建立活動或上傳資料。": "The draft stays in this tab for up to two hours. Download or clear it on the preview page, then manually paste, review and confirm fields in the tool. No activity is created and no data is uploaded automatically.",
  "預覽交接草稿": "Preview handoff draft",
  "讓成果回到下一輪": "Bring the result into the next round",
  "可以沿用同一組選項再做一次本機排序，也可以回到 Delib 重新選擇工具與收件方式。": "Reuse these options for another local ranking round, or return to Delib to choose different tools and collection methods.",
  "同一組選項再跑一輪": "Run another round with these options",
  "重新規劃流程": "Plan the process again",
  "下載 JSON": "Download JSON",
  "回報成果頁問題": "Report a problem with this result page",
  "需要一份有效的群體彙整結果": "A valid group aggregate is required.",
  "彙整來源網址不完整": "The aggregate source URL is incomplete.",
  "公開成果收據至少需要 3 份不重複 session": "A public result receipt requires at least 3 distinct sessions.",
  "請完整填寫解讀、未納入聲音、決策狀態與下一步責任": "Complete the interpretation, missing voices, decision status and next-step responsibilities.",
  "成果收據格式不完整": "The result receipt is incomplete.",
  "成果內容超過分享連結上限，請改下載 JSON 或縮短主辦者說明": "The receipt exceeds the sharing-link limit. Download JSON or shorten the organizer explanation.",
  "目前連不上 Delib 伺服器；請確認網路後重新整理。": "Delib cannot be reached. Check your connection and reload.",
  "這份公開成果已到期，內容已依承諾清除。": "This public result expired and its content has been cleared.",
  "找不到這份公開成果；它可能已被主辦者刪除，或網址抄錯了。": "This public result was not found. It may have been deleted or the link may be incorrect.",
  "公開成果暫時無法讀取，請稍後再試。": "The public result is temporarily unavailable. Please try again later.",
  "這份公開成果已由主辦者刪除。": "The organizer deleted this public result.",
  "這個短網址指向的成果格式與這個頁面不符。": "This short URL points to a different result format.",
  "請先確認公開範圍。": "Confirm what will be public first.",
  "正在建立短網址…": "Creating the short URL…",
  "短網址已建立。請另外保存私人刪除網址；Delib 無法替你找回。": "Short URL created. Save the private deletion link separately; Delib cannot recover it for you.",
  "短網址建立失敗。": "The short URL could not be created.",
  "公開短網址已複製。": "Public short URL copied.",
  "私人刪除網址已複製，請妥善保存。": "Private deletion URL copied. Keep it safe.",
  "正在刪除公開成果…": "Deleting the public result…",
  "公開成果與到期排程已刪除；這個短網址不再可用。": "The public result and expiry schedule were deleted. This short URL is no longer available.",
  "公開摘要已刪除": "Public summary deleted",
  "成果刪除失敗。": "The result could not be deleted.",
  "瀏覽器未允許自動複製；網址已選取。": "Clipboard access was denied. The URL has been selected.",
  "公開摘要保存至 ${0}": "Public summary retained until ${0}",
  "成果回報場 · Call-in": "Report-back event · Call-in",
  "活動名稱": "Activity title",
  "成果狀態與下一步說明": "Result status and next steps",
  "不帶成果統計、逐筆參與資料或管理連結；公開簡報網址仍要由主辦者確認。": "No result statistics, individual records or management links are included. The organizer still confirms the public slide URL.",
  "補訪缺席聲音 · Harmonica": "Reach missing voices · Harmonica",
  "補訪目標": "Follow-up interview goal",
  "背景情境": "Background context",
  "三個起始問題": "Three opening questions",
  "不帶成果統計、逐筆參與資料或 API key。": "No result statistics, individual records or API keys are included.",
  "整理下一輪文字 · TTTC": "Organize next-round text · TTTC",
  "分析名稱": "Analysis title",
  "要補充理解的問題": "Questions for further understanding",
  "不帶任何 CSV 或原始意見；成果收據不是文字分析資料。文字資料另外取得：口袋審議報告頁的「資料與其他工具」可直接下載 tttc.csv（id,interview,comment），或下載 statements.csv 與 votes.csv 到 Delib 資料工作台轉換；排序收據沒有自由文字。": "No CSV or original contributions are included. A result receipt is not a text dataset. Download tttc.csv from Pocket Polis, or convert statements.csv and votes.csv in the data workbench. Ranking receipts contain no free text.",
  "開放新陳述 · Pol.is": "Invite new statements · Pocket Polis",
  "建立新對話模式": "New-conversation mode",
  "下一輪對話名稱": "Next-round conversation title",
  "不帶種子陳述、成果統計、Site ID 或登入資訊。": "No seed statements, result statistics, Site ID or sign-in information are included."
});

export function rankingLanguage(url = typeof location === "undefined" ? "https://delib.example/" : location.href) {
  return new URL(url).searchParams.get("lang") === "en" ? "en" : "zh";
}
export function tr(value, language = rankingLanguage()) {
  if (language !== "en" || typeof value !== "string") return value;
  return Object.hasOwn(RANKING_EN, value) ? RANKING_EN[value] : value;
}
export function formatRankingTemplate(parts, values, language = rankingLanguage()) {
  const key = parts.reduce((text, part, index) => text + (index ? `\${${index - 1}}` : "") + part, "");
  const translated = tr(key, language);
  return translated.replace(/\$\{(\d+)\}/g, (_, index) => String(values[Number(index)]));
}
export function rt(parts, ...values) { return formatRankingTemplate(parts, values); }
export function rankDateTime(value) {
  return new Intl.DateTimeFormat(rankingLanguage() === "en" ? "en" : "zh-Hant-TW", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}
export function rankingLanguageUrl(value, { language = rankingLanguage(), station = false, origin = typeof location === "undefined" ? "https://delib.example" : location.origin } = {}) {
  const url = new URL(value, origin);
  if (url.origin !== origin) return url.href;
  url.searchParams.set("lang", language);
  if (station && ["/integrations/power-ranker", "/integrations/power-ranker.html"].includes(url.pathname)) url.pathname = "/rank";
  return url.href;
}
/** Run once, before any participant or organizer content is inserted. */
export function initializeRankingLanguage() {
  const language = rankingLanguage();
  document.documentElement.lang = language === "en" ? "en" : "zh-Hant";
  if (language === "en") {
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (["SCRIPT", "STYLE"].includes(node.parentElement?.tagName)) continue;
      const key = node.textContent.replace(/\s+/g, " ").trim();
      if (Object.hasOwn(RANKING_EN, key)) node.textContent = node.textContent.replace(node.textContent.trim(), RANKING_EN[key]);
    }
    document.querySelectorAll("[placeholder],[aria-label],[title],meta[content]").forEach((element) => {
      for (const name of ["placeholder", "aria-label", "title", "content"]) {
        const value = element.getAttribute(name);
        if (value !== null && Object.hasOwn(RANKING_EN, value)) element.setAttribute(name, RANKING_EN[value]);
      }
    });
  }
  document.querySelectorAll("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (href.startsWith("#")) {
      anchor.addEventListener("click", (event) => {
        const target = document.getElementById(href.slice(1));
        if (target) { event.preventDefault(); target.tabIndex = -1; target.focus(); target.scrollIntoView({ block: "start" }); }
      });
    } else anchor.href = rankingLanguageUrl(anchor.href, { station: true });
  });
  const toggle = document.querySelector("#ranking-language-switch");
  if (toggle) {
    toggle.textContent = language === "en" ? "正體中文" : "English";
    toggle.lang = language === "en" ? "zh-Hant" : "en";
    toggle.href = rankingLanguageUrl(location.href, { language: language === "en" ? "zh" : "en", station: true });
  }
}

export function rankReceiptSummary(receipt) {
  if (rankingLanguage() !== "en") return originalReceiptSummary(receipt);
  const top = receipt.result.slice(0, 3).map((item) => `${item.rank}. ${item.label}`).join("; ");
  return `${receipt.question.title} | ${tr(originalDecisionStatus(receipt.organizer.decisionStatus))} | Current ranking: ${top}. Next action — ${receipt.organizer.responsibleActor}: ${receipt.organizer.nextAction}. Model weights are not support rates or evidence of consensus.`;
}
export function rankReceiptMarkdown(receipt) {
  if (rankingLanguage() !== "en") return originalReceiptMarkdown(receipt);
  const o = receipt.organizer;
  return [
    `# ${receipt.question.title}`,
    `Prepared: ${receipt.preparedAt}`,
    "## Aggregate scope",
    `${receipt.aggregate.sessions} distinct sessions; ${receipt.aggregate.judgments} pairwise judgments; ${receipt.coverage.comparedPairs}/${receipt.coverage.totalPairs} pairs covered.`,
    "## Relative ranking",
    receipt.result.map((item) => `${item.rank}. ${item.label} — weight ${item.score.toFixed(3)}; ${item.observations} comparisons`).join("\n"),
    "Model weights are not support rates, budget shares or evidence of consensus.",
    "## Organizer interpretation", o.interpretation,
    "## Missing voices and limitations", o.missingVoices,
    "## Decision status", `${tr(originalDecisionStatus(o.decisionStatus))} — confirmed by ${o.authority}`,
    "## Next action", `Responsible: ${o.responsibleActor}\nResponse by: ${o.responseBy || "Not set"}\nAction: ${o.nextAction}`,
    o.evidenceUrl ? `Evidence: ${o.evidenceUrl}` : "",
    `Aggregate source: ${receipt.source.aggregateUrl}`,
    "This receipt contains aggregate pair counts and organizer statements, without individual session IDs or judgments.",
  ].filter(Boolean).join("\n\n") + "\n";
}
