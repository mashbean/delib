import { emptyState } from "/ui-shared.js";

const params = new URLSearchParams(location.search);
const conversation = params.get("conversation")?.trim() || "";
const siteId = params.get("site")?.trim() || "";
const pageId = params.get("page")?.trim() || "";
const title = params.get("title")?.trim().slice(0, 120) || "Pol.is 對話";

const root = document.querySelector("#polis-embed-root");
const status = document.querySelector("#polis-workspace-status");
const heading = document.querySelector("#polis-workspace-title");
const directLink = document.querySelector("#polis-direct-link");

heading.textContent = title;
document.title = `${title} · Pol.is 工作區 · Delib`;

if (isConversationId(conversation)) {
  directLink.href = `https://pol.is/${conversation}`;
  mountPolis({ conversation });
} else if (isSiteId(siteId) && isPageId(pageId)) {
  directLink.hidden = true;
  mountPolis({ siteId, pageId });
} else {
  root.replaceChildren(emptyState("這個工作區連結不完整。回到 Delib 重新貼一次對話網址就好。"));
  status.textContent = "找不到可以開啟的 Pol.is 對話。";
}

function mountPolis(config) {
  const frameId = config.conversation
    ? config.conversation
    : `${config.siteId}_${config.pageId}`;
  const path = config.conversation
    ? encodeURIComponent(config.conversation)
    : `${encodeURIComponent(config.siteId)}/${encodeURIComponent(config.pageId)}`;
  const embedUrl = new URL(`https://pol.is/${path}`);
  // Send only the page location without its query (which carries the title)
  // and the referrer origin, never a full URL that may describe a plan.
  embedUrl.searchParams.set("parent_url", `${location.origin}${location.pathname}`);
  embedUrl.searchParams.set("referrer", referrerOrigin());
  embedUrl.searchParams.set("ui_lang", "zh_Hant");

  directLink.href = `https://pol.is/${path}`;
  directLink.hidden = false;

  const frame = document.createElement("iframe");
  frame.id = `polis_${frameId}`;
  frame.dataset.testid = "polis-iframe";
  frame.title = `${title}的 Pol.is 參與介面`;
  frame.src = embedUrl.href;
  frame.width = "100%";
  frame.height = "930";
  frame.loading = "eager";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.style.border = "0";
  frame.style.background = "white";
  root.replaceChildren(frame);

  frame.addEventListener("load", () => {
    status.textContent = config.conversation
      ? "畫面已嵌入；若下方一直空白，請改用右上角按鈕直接在 Pol.is 開啟。"
      : "正在向 Pol.is 開啟這輪對話；第一次載入可能會多等幾秒。若一直空白，請改用右上角按鈕。";
  });
  frame.addEventListener("error", () => {
    root.replaceChildren(emptyState("Pol.is 暫時載不進來。這可能是網路或內容阻擋器造成的，不是你的操作錯誤。"));
    status.textContent = "目前無法載入 Pol.is。";
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== "https://pol.is") return;
    const message = event.data || {};
    if (message.polisFrameId !== frameId) return;

    if (message.name === "init") {
      status.textContent = "Pol.is 已就緒；你的陳述與投票會直接送到 Pol.is。";
    }
    if (message.name === "resize" && Number.isFinite(Number(message.height))) {
      frame.height = String(Math.max(560, Number(message.height)));
    }
  });
}

function referrerOrigin() {
  try {
    return document.referrer ? new URL(document.referrer).origin : "";
  } catch {
    return "";
  }
}


function isConversationId(value) {
  return /^[A-Za-z0-9_-]{2,80}$/.test(value);
}

function isSiteId(value) {
  return /^[A-Za-z0-9_-]{1,80}$/.test(value);
}

function isPageId(value) {
  return /^[A-Za-z0-9._:-]{1,120}$/.test(value);
}
