import { buildHandoff } from "./handoff-core.js";
import { exportTttcCsv } from "./flow-core.js";

const text = {
  openFlow:["開啟 3D 資料流 ↗","Open 3D data flow ↗"],flowHint:["查看原話、整理結果與下一輪的關係。另開工作台；此頁檔案不會自動帶入。","Follow sources, synthesis and later rounds. Opens a separate workspace; files from this page are not transferred automatically."],
  skip: ["跳到工作台", "Skip to workbench"], brand: ["資料交接", "Data handoff"], back: ["回到工具集 ↗", "Back to the toolkit ↗"],
  eyebrow: ["保留來源，讓對話繼續。", "KEEP THE SOURCE. CONTINUE THE CONVERSATION."],
  title: ["資料交接", "Data handoff"],
  lede: ["帶入來源，查看轉換，再交給下一個工具。", "Bring in a source, inspect the changes, then hand it over."],
  local: ["檔案只在此分頁記憶體中處理；不會上傳或存入瀏覽器儲存空間。重新整理即清除。", "Files stay in this tab’s memory. Nothing is uploaded or written to browser storage; reloading clears the data."],
  workspace: ["資料交接工作台", "Data handoff workbench"], receive: ["帶入原始文字", "Bring in the source text"],
  receiveBody: ["從工具的主辦者頁下載 tttc.csv。這個工作台接受 id、interview、comment 三欄；每份檔案最多 3 MB，一次最多 20 份。", "Download tttc.csv from a tool’s host page. This workbench accepts id, interview and comment columns: up to 3 MB per file and 20 files at a time."],
  choose: ["選擇 CSV 檔案", "Choose CSV files"], chooseHint: ["可一次選擇多份；不會上傳", "Choose multiple files; no upload"], sample: ["先用三輪模擬資料試試", "Try three fictional rounds"], clear: ["清除", "Clear"],
  check: ["確認資料的意思", "Check what the data means"],
  checkBody: ["每份來源加上獨立前綴，保留原始 id 對照。同一來源的暱稱轉成代碼；不依同名暱稱推定跨工具是同一人。", "Give each source its own prefix and preserve original ID mappings. Replace aliases with source-scoped codes; matching names never establish the same person across tools."],
  empty: ["選擇檔案後，這裡會顯示檢查結果。", "Choose files to see the checks here."],
  semantics: ["代碼群組數不是人數。空白 interview 只代表來源未提供分組；TTTC 可能改以資料列計數。CSV 不會攜帶原始票數、共識分析或參與同意。", "Group codes are not a headcount. A blank interview means no grouping was supplied; TTTC may count source rows instead. CSV does not carry original votes, consensus analysis or participation consent."],
  preview: ["預覽，再交接", "Preview, then hand over"],
  previewBody: ["下方最多顯示 12 列；下載會包含全部資料。內容仍是原始發言，代碼化並不等於去識別化。", "The preview shows up to 12 rows; downloads contain all rows. These remain original statements: replacing aliases does not anonymize the text."],
  previewEmpty: ["每則發言都能回到原始來源。", "Every statement keeps a path back to its source."], group: ["來源內代碼", "Source group"], comment: ["原始文字", "Source text"],
  downloadCsv: ["下載交接 CSV ↓", "Download handoff CSV ↓"], downloadManifest: ["下載私人來源對照表 ↓", "Download private source map ↓"],
  manifestNote: ["來源對照表包含檔案雜湊、原始 id 與原始暱稱，請與 CSV 一起私下保存。不要把對照表當成公開成果。", "The source map includes file hashes, original IDs and original aliases. Keep it privately alongside the CSV; it is not a public results document."],
  tttcLabel: ["整理成附來源的議題樹", "Organize source-linked themes"], replyLabel: ["草擬逐題回覆", "Draft question-linked replies"],
  destinationNote: ["「開啟」只會打開工具，不會傳送檔案。在下一個工具自行選擇或貼上 CSV 並建立分析後，資料會送到該服務；TTTC 與 Reply 的結果可能透過持有連結公開閱覽。請先確認文字內容、用途與參與者同意。", "Opening a tool does not transfer files. Selecting or pasting the CSV there and creating an analysis sends data to that service; TTTC and Reply results may be readable by anyone with the link. First review the text, intended use and participant consent."],
  demoLink: ["看三輪審議如何延續 →", "See how three rounds connect →"], footer: ["保留來源，也保留不同意的理由。", "Keep the sources—and the reasons for dissent."],
  files: ["來源檔案", "source files"], rows: ["原始資料列", "source rows"], groups: ["來源內群組", "source groups"],
  ready: ["已在本機完成檢查，尚未上傳。", "Checked locally. Nothing has been uploaded."], working: ["正在本機讀取與檢查…", "Reading and checking locally…"],
  cleared: ["此分頁內的檔案資料已清除。", "File data in this tab has been cleared."], error: ["無法合併，請確認原始 CSV：", "Could not merge. Check the original CSV: "],
  downloadReady: ["已準備下載。檔案尚未交給其他服務。", "Download prepared. No file has been sent to another service."],
  synthetic: ["這些是三輪完整虛構資料。每輪保留獨立來源，沒有建立任何真實活動。", "These are three fully fictional rounds. Each keeps a separate source; no real activity was created."],
};
const $ = (id) => document.getElementById(id);
let language = new URL(location.href).searchParams.get("lang") === "en" || document.documentElement.lang === "en" ? "en" : "zh";
let state = null;
let sourceFiles = [];
let operation = 0;
let lastError = "";
let busy = false;
const t = (key) => text[key]?.[language === "en" ? 1 : 0] || key;

function applyLanguage() {
  document.documentElement.lang = language === "en" ? "en" : "zh-Hant";
  document.title = `${language === "en" ? "Data handoff" : "資料交接工作台"} · Delib`;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  $("workspace-flow-link").href=`/workspace?view=flow&lang=${language}`;
  $("language").textContent = language === "en" ? "正體中文" : "English";
  $("language").lang = language === "en" ? "zh-Hant" : "en";
  document.querySelectorAll('a[href^="/tttc"],a[href^="/reply"]').forEach((a) => { const url = new URL(a.href); url.searchParams.set("lang", language === "en" ? "en" : "zh-Hant"); a.href = url.pathname + url.search; });
  document.querySelectorAll('a[href]').forEach((a) => {
    const url = new URL(a.href);
    if (url.origin === location.origin && url.pathname === "/") {
      url.searchParams.set("lang", language === "en" ? "en" : "zh-Hant");
      a.href = url.pathname + url.search + url.hash;
    }
  });
  render();
}

function render() {
  $("file-list").replaceChildren();
  for (const file of sourceFiles) {
    const li = document.createElement("li");
    const label = document.createElement("span"); label.textContent = file.name;
    const size = document.createElement("small"); size.textContent = `${(new TextEncoder().encode(file.text).length / 1024).toFixed(1)} KB`;
    li.append(label, size); $("file-list").append(li);
  }
  $("stats").replaceChildren(); $("notices").replaceChildren(); $("preview-rows").replaceChildren();
  if (state) {
    for (const [key, value] of [["files", state.merged.summary.files], ["rows", state.merged.summary.rows], ["groups", state.merged.summary.interviews]]) {
      const stat = document.createElement("div"); stat.className = "stat";
      const num = document.createElement("strong"); num.textContent = value;
      const label = document.createElement("span"); label.textContent = t(key); stat.append(num, label); $("stats").append(stat);
    }
    for (const notice of state.notices) appendNotice(notice.text[language], notice.level);
    if (state.manifest.simulated) appendNotice(t("synthetic"), "notice");
    for (const row of state.merged.rows.slice(0, 12)) {
      const tr = document.createElement("tr");
      for (const value of [row.id, row.interview || "—", row.comment]) { const td = document.createElement("td"); td.textContent = value; tr.append(td); }
      $("preview-rows").append(tr);
    }
  } else { const p = document.createElement("p"); p.textContent = t("empty"); $("stats").append(p); }
  if (lastError) appendNotice(t("error") + localizeError(lastError), "error");
  $("preview-count").textContent = state ? `${Math.min(12, state.merged.rows.length)} / ${state.merged.rows.length}` : "";
  $("preview-empty").hidden = !!state; $("preview-table-wrap").hidden = !state;
  $("download-csv").disabled = busy || !state?.exportAllowed;
  $("download-manifest").disabled = busy || !state?.exportAllowed;
  $("clear").disabled = !state && !sourceFiles.length && !busy && !lastError;
  $("sample").disabled = busy;
  $("status").textContent = busy ? t("working") : state ? t("ready") : "";
}

function appendNotice(message, type) { const p = document.createElement("p"); p.className = `notice ${type === "error" ? "error" : ""}`; p.textContent = message; $("notices").append(p); }
function localizeError(message) {
  if (language !== "en") return message;
  // Preserve IDs and row numbers; translate the parser's finite set of user-facing failures.
  return message.replace(/第 (\d+) 列/g, "row $1").replace(/欄位不符/g, "column mismatch").replace(/需要/g, "requires ").replace(/沒有資料列/g, " has no data rows").replace(/的 id 為空或過長/g, ": id is empty or exceeds 120 characters").replace(/的 comment 是空的/g, ": comment is empty").replace(/的 comment 過長或含無效字元/g, ": comment is too long or contains invalid characters").replace(/的 interview 過長/g, ": interview exceeds 200 characters").replace(/有重複的 id：/g, " has a duplicate id: ").replace(/請至少放入一份 TTTC CSV/g, "Choose at least one TTTC CSV");
}

async function digest(bytes) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function processFiles(readFiles) {
  const token = ++operation; busy = true; lastError = ""; state = null; sourceFiles = []; render();
  try {
    const incoming = await readFiles();
    if (token !== operation) return;
    const files = await Promise.all(incoming.map(async (file) => ({ ...file, sha256: await digest(file.sourceBytes || new TextEncoder().encode(file.text)) })));
    if (token !== operation) return;
    const result = buildHandoff(files);
    sourceFiles = files; state = result;
  } catch (error) { if (token === operation) { lastError = error instanceof Error ? error.message : String(error); state = null; } }
  finally { if (token === operation) { busy = false; render(); } }
}

$("files").addEventListener("change", (event) => {
  const picked = [...event.target.files];
  if (!picked.length) return;
  void processFiles(async () => {
    if (picked.length > 20) throw new Error("At most 20 files / 一次最多 20 份檔案。");
    for (const file of picked) if (file.size > 3 * 1024 * 1024) throw new Error(`${file.name}: exceeds 3 MB / 超過 3 MB。`);
    return Promise.all(picked.map(async (file) => {
      const sourceBytes = await file.arrayBuffer();
      let fileText;
      try { fileText = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes); }
      catch { throw new Error(`${file.name}: save as UTF-8 CSV / 請先另存為 UTF-8 CSV。`); }
      return { name: file.name, text: fileText, sourceBytes, byteLength: file.size, simulated: false };
    }));
  });
});

$("sample").addEventListener("click", () => { void processFiles(async () => {
  const response = await fetch("/data/flow-demo.json");
  if (!response.ok) throw new Error("Demo data could not be loaded / 無法載入示範資料。");
  const demo = await response.json();
  return demo.rounds.map((round) => ({ name: `synthetic-${round.id}-${language}.csv`, text: exportTttcCsv(demo, { roundId: round.id, language, includeParticipantRefs: true }), simulated: true }));
}); });

$("clear").addEventListener("click", () => { operation++; busy = false; sourceFiles = []; state = null; lastError = ""; $("files").value = ""; render(); $("status").textContent = t("cleared"); });
$("language").addEventListener("click", () => { language = language === "en" ? "zh" : "en"; const url = new URL(location.href); url.searchParams.set("lang", language); history.replaceState(null, "", url); applyLanguage(); });

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $("status").textContent = t("downloadReady");
}
$("download-csv").addEventListener("click", () => { if (state?.exportAllowed) download(state.csv, "delib-handoff-tttc.csv", "text/csv;charset=utf-8"); });
$("download-manifest").addEventListener("click", () => { if (state?.exportAllowed) download(JSON.stringify(state.manifest, null, 2) + "\n", "delib-handoff-private-source-map.json", "application/json"); });
applyLanguage();
