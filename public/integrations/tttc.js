import { mountEmbeddedFrame } from "/ui-shared.js";

const params = new URLSearchParams(location.search);
const title = params.get("title")?.trim().slice(0, 120) || "Talk to the City 分析";
const description = params.get("description")?.trim().slice(0, 500) || "";
const root = document.querySelector("#tttc-embed-root");
const status = document.querySelector("#tttc-workspace-status");
const heading = document.querySelector("#tttc-workspace-title");
const directLink = document.querySelector("#tttc-direct-link");

heading.textContent = title;
document.title = `${title} · Talk to the City 工作區 · Delib`;
const createUrl = new URL("https://talktothe.city/create");
createUrl.searchParams.set("title", title);
if (description) createUrl.searchParams.set("description", description);
directLink.href = createUrl.href;

mountEmbeddedFrame({
  root,
  status,
  src: createUrl.href,
  title: `${title}的 Talk to the City 建立介面`,
  testId: "tttc-iframe",
  height: 1050,
  allow: "clipboard-write",
  serviceName: "Talk to the City",
  initialText: "官方建立頁已嵌入；登入、上傳與模型處理都在 Talk to the City。",
});
