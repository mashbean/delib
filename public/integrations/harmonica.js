const params = new URLSearchParams(location.search);
const sessionId = params.get("session")?.trim() || "";
const title = params.get("title")?.trim().slice(0, 120) || "Harmonica 對話";
const root = document.querySelector("#harmonica-embed-root");
const status = document.querySelector("#harmonica-workspace-status");
const heading = document.querySelector("#harmonica-workspace-title");
const directLink = document.querySelector("#harmonica-direct-link");

heading.textContent = title;

if (!/^[A-Za-z0-9_-]{8,128}$/.test(sessionId)) {
  root.replaceChildren(errorMessage("這個 Harmonica 工作區連結缺少有效的 session ID。"));
  status.textContent = "無法載入 Harmonica session。";
} else {
  const participantUrl = new URL("https://app.harmonica.chat/chat");
  participantUrl.searchParams.set("s", sessionId);
  directLink.href = participantUrl.href;

  const frame = document.createElement("iframe");
  frame.dataset.testid = "harmonica-iframe";
  frame.title = `${title}的 Harmonica 對話介面`;
  frame.src = participantUrl.href;
  frame.width = "100%";
  frame.height = "1050";
  frame.loading = "eager";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.style.border = "0";
  frame.style.background = "white";
  frame.addEventListener("load", () => {
    status.textContent = "Harmonica 對話已載入；回答不會經過 Delib。";
  });
  frame.addEventListener("error", () => {
    root.replaceChildren(errorMessage("Harmonica 暫時載不進來；請改用上方按鈕直接開啟。"));
    status.textContent = "目前無法載入 Harmonica。";
  });
  root.replaceChildren(frame);
}

function errorMessage(message) {
  const node = document.createElement("div");
  node.className = "empty-state";
  node.textContent = message;
  return node;
}
