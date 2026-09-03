import { emptyState, mountEmbeddedFrame } from "/ui-shared.js";

const formId = new URLSearchParams(location.search).get("form")?.trim() || "";
const root = document.querySelector("#heyform-embed-root");
const status = document.querySelector("#heyform-workspace-status");
const directLink = document.querySelector("#heyform-direct-link");

if (/^[A-Za-z0-9_-]{2,120}$/.test(formId)) {
  const formUrl = `https://heyform.net/f/${encodeURIComponent(formId)}`;
  directLink.href = formUrl;
  mountEmbeddedFrame({
    root,
    status,
    src: formUrl,
    title: "HeyForm 參與表單",
    testId: "heyform-iframe",
    height: 900,
    serviceName: "HeyForm",
    initialText: "表單工作區已開啟；送出的回答會直接交給 HeyForm。",
  });
} else {
  root.replaceChildren(emptyState("這個 HeyForm 工作區連結不完整。回到 Delib 重新貼一次公開表單網址就好。"));
  status.textContent = "找不到可以開啟的公開表單。";
}
