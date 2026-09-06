import { clearReceiptHandoff, normalizeReceiptHandoff, readReceiptHandoff } from "/receipt-handoff-core.js";

const TOOL_ROUTES = { "call-in": "/call-in", harmonica: "/harmonica", "talk-to-the-city": "/tttc", polis: "/polis" };
const TOOL_NAMES = { "call-in": "Call-in", harmonica: "Pocket Harmonica", "talk-to-the-city": "Pocket TTTC", polis: "Pocket Polis" };
const COPY = {
  zh: { heading:"下一輪的交接草稿", intro:"先檢查這份草稿，再到下一個工具逐欄貼上、修改與確認。這一頁不會建立活動或自動上傳資料。",source:"來源",expires:"暫存到期",boundary:"草稿保留原文，僅存在此分頁的暫存空間，最長兩小時。下載的檔案由你自行保管；切換工具不會自動搬移內容。",copy:"複製草稿 JSON",download:"下載草稿 JSON",open:"開啟工具並人工填入 ↗",technical:"查看完整交接資料",clear:"清除此分頁的交接草稿",ready:"已讀取成果草稿。請檢查欄位、原文與下一步目的。",missing:"這個分頁沒有可用草稿。請回到原成果頁，重新選擇下一步並在同一分頁開啟。",expired:"草稿已過期或格式不符，已清除暫存。請從成果頁重新準備。",mismatch:"這份草稿的目標工具與網址不同；請回到原成果頁重新選擇工具。",unavailable:"瀏覽器不允許讀取暫存。請回到成果頁下載收據，再人工交接。",cleared:"已清除此分頁的交接草稿。另行下載的檔案不受影響。",clearFailed:"已清除畫面，但瀏覽器拒絕清除暫存。請關閉這個分頁，或稍後再清除。",copied:"草稿 JSON 已複製；請在下一個工具人工確認要填入的欄位。",downloaded:"草稿 JSON 已下載。",copyFailed:"瀏覽器不允許複製，請使用下載 JSON。",yes:"需要主辦者補上公開簡報網址。",site:"建立新一輪對話（尚未建立）。" },
  en: { heading:"A draft for the next round",intro:"Review this draft, then paste, edit and confirm each field in the next tool. This page does not create activities or upload data automatically.",source:"Source",expires:"Temporary storage expires",boundary:"The draft retains its original wording and stays in this tab’s temporary storage for at most two hours. You manage downloaded files. Opening another tool does not transfer the content.",copy:"Copy draft JSON",download:"Download draft JSON",open:"Open the tool and fill it in ↗",technical:"View the complete handoff data",clear:"Clear this tab’s handoff draft",ready:"Result draft loaded. Review the fields, source wording and next-step purpose.",missing:"This tab has no available draft. Return to the original result page, choose the next step and continue in the same tab.",expired:"The draft expired or has an unsupported format. Temporary storage was cleared; prepare a new draft from the result page.",mismatch:"The draft’s target differs from the URL. Return to the original result page and select the tool again.",unavailable:"The browser cannot read temporary storage. Download the receipt from the result page and prepare a manual handoff.",cleared:"This tab’s handoff draft was cleared. Separately downloaded files are unaffected.",clearFailed:"The preview was cleared, but the browser refused to clear storage. Close this tab or try clearing again later.",copied:"Draft JSON copied. Review the fields before filling in the next tool.",downloaded:"Draft JSON downloaded.",copyFailed:"Clipboard access was denied. Download JSON instead.",yes:"The organizer must add a public slide URL.",site:"Start a new conversation (not created yet)." },
};
const FIELDS = { title:["名稱","Title"],description:["說明","Description"],needsDeckUrl:["待補資料","Still needed"],topic:["訪談主題","Interview topic"],goal:["訪談目標","Interview goal"],context:["背景脈絡","Context"],critical:["尚未充分納入的聲音","Missing voices"],questions:["起始問題","Opening questions"],mode:["下一步模式","Next-step mode"] };
const params = new URLSearchParams(location.search);
let language = params.get("lang") === "en" ? "en" : "zh";
const target = params.get("target");
let current = null;
let outcome = "missing";
let expiryTimer;
const status = document.querySelector("#draft-status");
const content = document.querySelector("#draft-content");
try {
  const loaded = readReceiptHandoff(sessionStorage, { target });
  current = loaded.handoff;
  outcome = ({ ready:"ready", missing:"missing", "expired-or-invalid":"expired", "invalid-target":"mismatch", "target-mismatch":"mismatch", unavailable:"unavailable" })[loaded.status];
} catch { outcome = "unavailable"; }

function render() {
  const copy = COPY[language];
  document.documentElement.lang = language === "en" ? "en" : "zh-Hant";
  document.title = `${copy.heading} · Delib`;
  document.querySelectorAll("[data-copy]").forEach((element) => { element.textContent = copy[element.dataset.copy]; });
  document.querySelector("#draft-language").textContent = language === "en" ? "正體中文" : "English";
  document.querySelector("#draft-home").href = `/?lang=${language}#journey`;
  status.textContent = copy[outcome];
  content.hidden = !current;
  if (!current) return;
  document.querySelector("#draft-source").textContent = current.source.title;
  document.querySelector("#draft-tool").textContent = TOOL_NAMES[current.target];
  const expires = document.querySelector("#draft-expiry");
  expires.dateTime = current.expiresAt;
  expires.textContent = new Intl.DateTimeFormat(language === "en" ? "en" : "zh-Hant-TW", { dateStyle:"medium",timeStyle:"short" }).format(new Date(current.expiresAt));
  const fields = document.querySelector("#draft-fields");
  fields.replaceChildren();
  for (const [key,value] of Object.entries(current.draft)) {
    const term = document.createElement("dt");
    term.textContent = FIELDS[key]?.[language === "en" ? 1 : 0] || key;
    const definition = document.createElement("dd");
    definition.textContent = key === "needsDeckUrl" ? copy.yes : key === "mode" ? copy.site : Array.isArray(value) ? value.map((item,index) => `${index+1}. ${item}`).join("\n") : String(value);
    fields.append(term,definition);
  }
  document.querySelector("#draft-json").textContent = JSON.stringify(current,null,2);
  document.querySelector("#draft-open-tool").href = `${TOOL_ROUTES[current.target]}?lang=${language}`;
  clearTimeout(expiryTimer);
  expiryTimer = setTimeout(() => ensureFresh(), Math.max(1,Date.parse(current.expiresAt)-Date.now()));
}

function ensureFresh() {
  if (!current) return false;
  if (normalizeReceiptHandoff(current)) return true;
  clearDraft("expired");
  return false;
}
function clearDraft(nextStatus = "cleared") {
  let cleared = false;
  try { cleared = clearReceiptHandoff(sessionStorage); } catch { /* Storage access can be blocked. */ }
  current = null;
  clearTimeout(expiryTimer);
  document.querySelector("#draft-fields").replaceChildren();
  document.querySelector("#draft-json").textContent = "";
  document.querySelector("#draft-source").textContent = "";
  document.querySelector("#draft-open-tool").removeAttribute("href");
  outcome = cleared ? nextStatus : "clearFailed";
  render();
}
document.querySelector("#draft-clear").addEventListener("click", () => clearDraft());
document.querySelector("#draft-language").addEventListener("click", () => {
  language = language === "en" ? "zh" : "en";
  const url = new URL(location.href);url.searchParams.set("lang",language);history.replaceState(null,"",url);
  ensureFresh();render();
});
document.querySelector("#draft-copy").addEventListener("click",async () => {
  if (!ensureFresh()) return;
  try { await navigator.clipboard.writeText(JSON.stringify(current,null,2));outcome="copied"; } catch { outcome="copyFailed"; }
  status.textContent=COPY[language][outcome];
});
document.querySelector("#draft-download").addEventListener("click",() => {
  if (!ensureFresh()) return;
  const blob = new Blob([JSON.stringify(current,null,2)+"\n"],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`delib-${current.target}-draft.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  outcome="downloaded";status.textContent=COPY[language][outcome];
});
document.querySelector("#draft-open-tool").addEventListener("click",(event) => { if (!ensureFresh()) event.preventDefault(); });
document.addEventListener("visibilitychange",() => { if (!document.hidden) ensureFresh(); });
render();
