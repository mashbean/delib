import { CAPABILITY_QUERY_KEYS, activityToStationUrl, buildToolUrl, stationNavigationUrl } from "/tool-shell-core.js";
import { normalizeRankingConfig, rankingConfigToHash, rankingConfigFromHash } from "/power-ranker-core.js";

const text = {
  zh: {
    skip:"跳到工具", back:"回到流程地圖", original:"獨立開啟 ↗", handoff:"這一步完成後，資料去哪裡？", next:"前往下一個工具 →",
    loading:"正在載入工具…", loaded:"工具已送出載入請求。若畫面空白或登入受限，請獨立開啟。", reload:"重新載入",
    boundary:"工具在原服務中運作，原有活動與管理權限維持獨立。跨工具資料仍需匯出、審閱與匯入；站內導覽不會自動搬移資料。",
    languageNote:"導覽提供中英文；工具內文的語言依各工具支援。若畫面無法載入，可用上方「獨立開啟」。",
    local:"只在瀏覽器", rankHeading:"建立一輪成對排序", rankIntro:"先填入題目與 3–10 個方案。排序在瀏覽器進行，題目放在連結中；答案不會自動上傳。",
    question:"要比較的問題", options:"方案（每行一項，3–10 項）", start:"開始排序", example:"填入模擬公園案例",
    exampleTitle:"模擬案例：河畔公園應該優先改善什麼？", exampleItems:"增設遮蔭與座椅\n改善夜間照明\n拓寬無障礙步道\n保留自然草地",
    invalid:"請填入題目，以及 3–10 個不重複的方案。", unavailable:"工作區暫時無法載入，請回到流程地圖。", step:"建議位置 · 步驟",
    existing:"已經有活動連結？在這裡接著用", activityLabel:"貼上這個工具的活動或報告網址", openActivity:"在站內開啟", invalidActivity:"請貼上目前這個工具的完整網址。",
    rankMode:"這一輪怎麼收件？", localMode:"只在本機，個別匯出結果", dayMode:"多人收件室 · 保存 24 小時", weekMode:"多人收件室 · 保存 7 天", roomConsent:"我確認公開題目與保存期限。Delib 只保存題目、彙整計數與隨機參與代碼的雜湊，到期刪除。", consentRequired:"請先確認收件室的公開內容與保存期限。", createFailed:"收件室未能完成建立，請稍後再試。", participantLink:"參與者連結（可分享，不含管理憑證）↗",
  },
  en: {
    skip:"Skip to tool", back:"Back to the journey", original:"Open independently ↗", handoff:"Where does the data go next?", next:"Continue to the next tool →",
    loading:"Loading the tool…", loaded:"The tool has been requested. If the view is blank or sign-in is restricted, open it independently.", reload:"Reload",
    boundary:"The tool runs in its original service, with independent activities and management permissions. Moving data between tools still requires export, review and import; station navigation does not transfer it automatically.",
    languageNote:"Station navigation is bilingual; languages within each tool depend on that service. Use “Open independently” if the embedded view cannot load.",
    local:"IN YOUR BROWSER", rankHeading:"Start a pairwise ranking round", rankIntro:"Enter a question and 3–10 proposals. Ranking runs in your browser; the question travels in the link and answers are not uploaded automatically.",
    question:"Question to compare", options:"Proposals (one per line, 3–10)", start:"Start ranking", example:"Use the fictional park example",
    exampleTitle:"Simulation: what should Riverside Park improve first?", exampleItems:"Add shade and benches\nImprove nighttime lighting\nWiden accessible paths\nKeep natural grassland",
    invalid:"Enter a question and 3–10 distinct proposals.", unavailable:"The workspace could not load. Return to the journey map.", step:"Suggested position · step",
    existing:"Already have an activity link? Continue here", activityLabel:"Paste an activity or report URL from this tool", openActivity:"Open in this station", invalidActivity:"Paste a full URL from this tool’s service.",
    rankMode:"How will this round collect responses?", localMode:"Local only; export results individually", dayMode:"Shared room · keep for 24 hours", weekMode:"Shared room · keep for 7 days", roomConsent:"I confirm the public question and retention period. Delib stores the question, aggregate counts and hashes of random session IDs, and deletes them at expiry.", consentRequired:"Confirm the public content and retention period first.", createFailed:"The shared room could not be created. Please try again later.", participantLink:"Participant link (shareable; no management key) ↗",
  },
};

const params = new URLSearchParams(location.search);
const language = params.get("lang") === "en" ? "en" : "zh";
const copy = text[language];
const frame = document.querySelector("#tool-frame");
const frameStatus = document.querySelector("#frame-status");
const original = document.querySelector("#original-link");
const container = document.querySelector("#tool-container");
const setup = document.querySelector("#rank-setup");
let activeToolUrl = null;
document.querySelector(".skip").addEventListener("click", (event) => {
  event.preventDefault();
  // Activity configuration and management keys also use the fragment.
  // Moving focus must not overwrite them with an in-page anchor.
  frame.focus();
  frame.scrollIntoView({ block: "start" });
});
document.querySelectorAll("[data-text]").forEach((element) => { element.textContent = copy[element.dataset.text]; });
document.querySelector("#hub-link").href = `/?lang=${language}#journey`;
try { if (sessionStorage.getItem('delib:last-project')) { const link=document.querySelector('#hub-link');link.href=`/workspace?lang=${language}`;link.textContent=language==='en'?'Back to my issue':'回到我的議題'; } } catch {}
document.querySelector("#reload-tool").addEventListener("click", () => { if (activeToolUrl) frame.src = activeToolUrl.href; });
frame.addEventListener("load", () => { frameStatus.textContent = copy.loaded; });

try {
  const response = await fetch("/data/tool-stations.json");
  if (!response.ok) throw new Error("Station registry unavailable");
  const stations = await response.json();
  const station = stations.find((item) => item.slug === document.body.dataset.station);
  if (!station) throw new Error("Unknown station");
  document.querySelector("#station-summary").textContent = station.summary[language];
  document.querySelector("#station-handoff").textContent = station.handoff[language];
  document.querySelector("#station-step").textContent = `${copy.step} ${String(station.stage).padStart(2,"0")}`;
  document.querySelector("#next-link").href = stationNavigationUrl(station.next, language);
  frame.title = `${station.name} — ${station.title[language]}`;
  if (station.slug === "rank") {
    // The trusted same-origin ranker can return to its setup page after a
    // deliberate link click. External tools do not get top-navigation rights.
    frame.sandbox.add("allow-top-navigation-by-user-activation");
  }
  container.setAttribute("aria-label", frame.title);

  activeToolUrl = buildToolUrl(location.href, station, document.body.dataset.origin);
  if (CAPABILITY_QUERY_KEYS.some((key) => params.has(key))) {
    const cleanUrl = new URL(location.href);
    CAPABILITY_QUERY_KEYS.forEach((key) => cleanUrl.searchParams.delete(key));
    cleanUrl.hash = activeToolUrl.hash;
    history.replaceState(null, "", cleanUrl);
  }
  const languageUrl = new URL(location.href);
  languageUrl.searchParams.set("lang", language === "en" ? "zh" : "en");
  const languageLink = document.querySelector("#language-switch");
  languageLink.href = languageUrl.href;
  languageLink.textContent = language === "en" ? "正體中文" : "English";
  languageLink.lang = language === "en" ? "zh-Hant" : "en";

  original.href = activeToolUrl.href;
  document.querySelector("#activity-link-panel").hidden = station.slug === "rank";
  document.querySelector("#activity-link-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const target = activityToStationUrl(document.querySelector("#activity-url").value.trim(), station, document.body.dataset.origin, location.origin, language);
      location.assign(target.href);
    } catch {
      document.querySelector("#activity-error").textContent = copy.invalidActivity;
    }
  });
  const emptyRank = station.slug === "rank" && !params.has("room") && params.get("mode") !== "aggregate" && !rankingConfigFromHash(location.hash);
  if (station.slug === "rank" && /^[a-f0-9]{64}$/.test(params.get("room") || "")) {
    document.querySelector("#room-participation").hidden = false;
    const participantUrl = new URL("/rank", location.origin);
    participantUrl.search = new URLSearchParams({ room: params.get("room"), lang: language }).toString();
    document.querySelector("#room-participant-link").href = participantUrl.href;
  }
  if (emptyRank) {
    container.hidden = true;
    setup.hidden = false;
    original.hidden = true;
    document.querySelector("#rank-example").addEventListener("click", () => {
      document.querySelector("#rank-title").value = copy.exampleTitle;
      document.querySelector("#rank-items").value = copy.exampleItems;
    });
    document.querySelector("#rank-mode").addEventListener("change", (event) => {
      document.querySelector("#rank-consent-row").hidden = event.target.value === "local";
      document.querySelector("#rank-consent").checked = false;
    });
    document.querySelector("#rank-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const config = normalizeRankingConfig({ title: document.querySelector("#rank-title").value, items: document.querySelector("#rank-items").value.split(/\r?\n/).filter((line) => line.trim()) });
      if (!config) { document.querySelector("#rank-error").textContent = copy.invalid; return; }
      const destination = new URL(location.href);
      const mode = document.querySelector("#rank-mode").value;
      const errorLine = document.querySelector("#rank-error");
      if (mode !== "local") {
        if (!document.querySelector("#rank-consent").checked) { errorLine.textContent = copy.consentRequired; return; }
        const button = event.submitter;
        if (button) button.disabled = true;
        try {
          const created = await fetch("/api/integrations/power-ranker/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: config.title, items: config.items.map((item) => item.label), retentionHours: Number(mode), confirmed: true }) });
          const room = await created.json();
          if (!created.ok || !/^[a-f0-9]{64}$/.test(room.roomId || "")) throw new Error("Room creation failed");
          const management = new URL(room.manageUrl, location.origin);
          if (management.origin !== location.origin || !/^#admin=[a-f0-9]{64}$/.test(management.hash)) throw new Error("Invalid management link");
          destination.searchParams.set("room", room.roomId);
          destination.hash = management.hash;
        } catch {
          errorLine.textContent = copy.createFailed;
          if (button) button.disabled = false;
          return;
        }
      } else destination.hash = rankingConfigToHash(config);
      // Reload so a shared link and the initial state follow the same path.
      history.replaceState(null, "", destination.href);
      location.reload();
    });
  } else frame.src = activeToolUrl.href;
} catch (error) {
  frameStatus.textContent = copy.unavailable;
  frame.hidden = true;
  original.hidden = true;
}
