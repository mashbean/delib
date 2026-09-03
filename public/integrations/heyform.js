const formId = new URLSearchParams(location.search).get("form")?.trim() || "";
const root = document.querySelector("#heyform-embed-root");
const status = document.querySelector("#heyform-workspace-status");
const directLink = document.querySelector("#heyform-direct-link");

if (/^[A-Za-z0-9_-]{2,120}$/.test(formId)) {
  const formUrl = `https://heyform.net/f/${encodeURIComponent(formId)}`;
  directLink.href = formUrl;
  const frame = document.createElement("iframe");
  frame.dataset.testid = "heyform-iframe";
  frame.title = "HeyForm 參與表單";
  frame.src = formUrl;
  frame.width = "100%";
  frame.height = "900";
  frame.loading = "eager";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.style.border = "0";
  frame.style.background = "white";
  frame.addEventListener("load", () => {
    status.textContent = "畫面已嵌入。若下方一直空白，表示對方拒絕被嵌入或被瀏覽器阻擋，請改用右上角按鈕直接開啟。";
  });
  frame.addEventListener("error", () => {
    root.replaceChildren(errorMessage("HeyForm 暫時載不進來；請改用上方按鈕直接開啟。"));
    status.textContent = "目前無法載入 HeyForm。";
  });
  root.replaceChildren(frame);
  status.textContent = "表單工作區已開啟；送出的回答會直接交給 HeyForm。";
} else {
  root.replaceChildren(errorMessage("這個 HeyForm 工作區連結不完整。回到 Delib 重新貼一次公開表單網址就好。"));
  status.textContent = "找不到可以開啟的公開表單。";
}

function errorMessage(message) {
  const node = document.createElement("div");
  node.className = "empty-state";
  node.textContent = message;
  return node;
}
