import { emptyState, mountEmbeddedFrame } from "/ui-shared.js";

const params = new URLSearchParams(location.search);
const sessionId = params.get("session")?.trim() || "";
const title = params.get("title")?.trim().slice(0, 120) || "Harmonica 對話";
const root = document.querySelector("#harmonica-embed-root");
const status = document.querySelector("#harmonica-workspace-status");
const heading = document.querySelector("#harmonica-workspace-title");
const directLink = document.querySelector("#harmonica-direct-link");

heading.textContent = title;
document.title = `${title} · Harmonica 工作區 · Delib`;

if (!/^[A-Za-z0-9_-]{8,128}$/.test(sessionId)) {
  root.replaceChildren(emptyState("這個 Harmonica 工作區連結缺少有效的對話場次代碼。回到 Delib 重新建立一次就好。"));
  status.textContent = "無法載入 Harmonica 對話。";
} else {
  const participantUrl = new URL("https://app.harmonica.chat/chat");
  participantUrl.searchParams.set("s", sessionId);
  directLink.href = participantUrl.href;
  mountEmbeddedFrame({
    root,
    status,
    src: participantUrl.href,
    title: `${title}的 Harmonica 對話介面`,
    testId: "harmonica-iframe",
    height: 1050,
    serviceName: "Harmonica",
  });
}
