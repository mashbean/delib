const conversationSlug = new URLSearchParams(location.search).get("conversation")?.trim() || "";
const root = document.querySelector("#agora-embed-root");
const status = document.querySelector("#agora-workspace-status");
const directLink = document.querySelector("#agora-direct-link");

if (/^[A-Za-z0-9_-]{3,120}$/.test(conversationSlug)) {
  const participantUrl = `https://www.agoracitizen.app/conversation/${encodeURIComponent(conversationSlug)}`;
  directLink.href = participantUrl;
  const frame = document.createElement("iframe");
  frame.dataset.testid = "agora-iframe";
  frame.title = "Agora Citizen Network 公開對話";
  frame.src = `${participantUrl}/embed`;
  frame.width = "100%";
  frame.height = "1100";
  frame.loading = "eager";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.allow = "clipboard-write; web-share";
  frame.allowFullscreen = true;
  frame.style.border = "0";
  frame.style.background = "white";
  frame.addEventListener("load", () => {
    status.textContent = "對話已載入；登入與參與資料會直接交給 Agora。";
  });
  frame.addEventListener("error", () => {
    root.replaceChildren(errorMessage("Agora 暫時載不進來；請改用上方按鈕直接開啟。"));
    status.textContent = "目前無法載入 Agora。";
  });
  root.replaceChildren(frame);
  status.textContent = "公開對話工作區已開啟；Delib 不會接收參與資料。";
} else {
  root.replaceChildren(errorMessage("這個 Agora 工作區連結不完整。回到 Delib 重新貼一次公開對話網址就好。"));
  status.textContent = "找不到可以開啟的公開對話。";
}

function errorMessage(message) {
  const node = document.createElement("div");
  node.className = "empty-state";
  node.textContent = message;
  return node;
}
