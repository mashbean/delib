const params = new URLSearchParams(location.search);
const title = params.get("title")?.trim().slice(0, 120) || "Talk to the City 分析";
const description = params.get("description")?.trim().slice(0, 500) || "";
const root = document.querySelector("#tttc-embed-root");
const status = document.querySelector("#tttc-workspace-status");
const heading = document.querySelector("#tttc-workspace-title");
const directLink = document.querySelector("#tttc-direct-link");

heading.textContent = title;
const createUrl = new URL("https://talktothe.city/create");
createUrl.searchParams.set("title", title);
if (description) createUrl.searchParams.set("description", description);
directLink.href = createUrl.href;

const frame = document.createElement("iframe");
frame.dataset.testid = "tttc-iframe";
frame.title = `${title}的 Talk to the City 建立介面`;
frame.src = createUrl.href;
frame.width = "100%";
frame.height = "1050";
frame.loading = "eager";
frame.referrerPolicy = "strict-origin-when-cross-origin";
frame.allow = "clipboard-write";
frame.style.border = "0";
frame.style.background = "white";
frame.addEventListener("load", () => {
  status.textContent = "官方建立頁已載入；登入與資料上傳只會交給 Talk to the City。";
});
frame.addEventListener("error", () => {
  root.replaceChildren(errorMessage("Talk to the City 暫時載不進來；請改用上方按鈕直接開啟。"));
  status.textContent = "目前無法載入 Talk to the City。";
});
root.replaceChildren(frame);

function errorMessage(message) {
  const node = document.createElement("div");
  node.className = "empty-state";
  node.textContent = message;
  return node;
}
