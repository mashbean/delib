const reasons={
  "Identity/linking fields excluded; content consent is separate.": "排除身分與串連欄位；內容轉交的同意另行確認。",
  "Source group labels excluded; no cross-tool identity matching.": "排除來源群組標記，不跨工具比對身分。",
  "CSV has no votes, question types, consent, withdrawal or revision history.": "CSV 不含票數、題型、同意、撤回或修訂歷史。",
  "A consent answer is not authorization for another destination or purpose.": "回答同意題，不代表同意另一個用途或目的地。",
  "Quote text is an excerpt. Match commentId to the original file; group counts are not unique people.": "引文只是節錄；須用 commentId 對照原檔。群組數不是實際人數。",
  "Generated replies are drafts; owner confirmation is not present in this export.": "產生的回覆仍是草稿，匯出檔不含責任人確認。",
  "Pairwise judgments remain a graph, not votes or consensus. Card wording is confirmed synthesis, not verbatim interview text.": "成對判斷保留為圖譜。價值卡是經確認的整理文字，不是逐字訪談，也不是共識。",
  "Totals, ballot counts and allocation bundles are retained. Individual ballots and reasons are not in results.json.": "保留總額、票數與分配方案；results.json 不含逐人選票與理由。",
  "Question accuracy is retained; it is not agreement. Individual feedback and attempts require their separate exports.": "保留答對率；答對不等於同意。個別回饋與作答須另取匯出檔。",
  "space.json contains current proposals and counts, not amendment bodies, response bodies or version history. Do not infer their content.": "space.json 只有當前提案及數量，不含修正案全文、回覆全文或版本歷史。",
  "Support/opposition edges and calculated strengths are retained. Strength is not a consensus score.": "保留支持／反對關聯與計算強度；強度不是共識程度。",
  "Only visible testimonies are exported. Missing entries do not prove withdrawal; no remote withdrawal history is included.": "只匯出仍可見的證詞；缺少一筆不代表已撤回，檔案未提供撤回歷史。",
  "Flagged, hidden or empty opinion excluded from transfer.": "排除遭標記、隱藏或空白的意見。",
  "Civic Talk public opinions only; briefing, evidence materials, terms acceptance and remote moderation history are separate. Public visibility does not grant transfer permission.": "只接入 Civic Talk 公開意見；彙整、佐證、條款同意及審查歷史另行保存。公開可見不等於有權轉交。",
  "Response values and counts retained; participant linkage excluded from the exchange companion. Keep the original privately for participation analysis.": "保留回應值與計數，排除參與者串連碼。若要分析參與情況，請私下保留原檔。",
  "IDs are namespaced by tool and activity; original IDs remain.": "ID 加上工具與活動範圍；原始 ID 仍保留。",
  "Non-identity native fields remain in the private companion; not all destination tools interpret them.": "非身分的原生欄位保留在私人封套；目的工具不一定能解讀全部欄位。",
  "Destination-specific permission and retention are not inferred.": "不自動推定目的地同意與保存期限。",
  "Local withdrawal only. Descendants require review; remote deletion has not been confirmed.": "僅記錄本機撤回；衍生成果待覆核，尚未確認遠端副本刪除。",
  "Only eligible participant text enters CSV. Model drafts, typed relations, method fields and consent stay in the companion.": "CSV 只帶可轉交的參與者文字；模型草稿、關聯、方法欄位及同意留在封套。",
  "CSV formula-leading text is escaped for spreadsheet safety.": "試算表可能當成公式的開頭已跳脫處理。",
  "No voteInfo synthesized from missing votes. Verified backend JSON shape; current web upload picker requires a separate JSON entry path.": "不以缺少票數補造 voteInfo。已核對後端 JSON 格式；現行網頁仍需另接 JSON 選檔入口。"
};
const labels={preserved:'保留',transformed:'轉換',blocked:'排除',review:'待覆核',unavailable:'未提供',dropped:'未轉交',aggregated:'彙總',participant:'參與者',model:'模型草稿','source-excerpt':'來源節錄',organizer:'主辦者','participant-confirmed-synthesis':'參與者確認的整理',calculated:'計算成果',draft:'草稿',unreviewed:'待檢查',reviewed:'已檢查',withdrawn:'已撤回','needs-review':'須重新覆核'};
export function exchangeLabel(value,en){if(en)return value;if(reasons[value])return reasons[value];if(labels[value])return labels[value];if(/^\d+ source references matched/.test(value))return `${value.split(' ')[0]} 個來源已透過交接對照表與精確引文核對接回。`;return value;}
