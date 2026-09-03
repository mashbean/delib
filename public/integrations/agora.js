import { emptyState, mountEmbeddedFrame } from "/ui-shared.js";

const conversationSlug = new URLSearchParams(location.search).get("conversation")?.trim() || "";
const root = document.querySelector("#agora-embed-root");
const status = document.querySelector("#agora-workspace-status");
const directLink = document.querySelector("#agora-direct-link");

if (/^[A-Za-z0-9_-]{3,120}$/.test(conversationSlug)) {
  const participantUrl = `https://www.agoracitizen.app/conversation/${encodeURIComponent(conversationSlug)}`;
  directLink.href = participantUrl;
  mountEmbeddedFrame({
    root,
    status,
    src: `${participantUrl}/embed`,
    title: "Agora Citizen Network 公開對話",
    testId: "agora-iframe",
    height: 1100,
    allow: "clipboard-write; web-share",
    allowFullscreen: true,
    serviceName: "Agora",
    initialText: "公開對話工作區已開啟；Delib 不會接收參與資料。",
  });
} else {
  root.replaceChildren(emptyState("這個 Agora 工作區連結不完整。回到 Delib 重新貼一次公開對話網址就好。"));
  status.textContent = "找不到可以開啟的公開對話。";
}
