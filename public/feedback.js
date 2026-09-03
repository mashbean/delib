import { createFeedbackRecord, feedbackGitHubLink, feedbackToMarkdown } from "/feedback-core.js";

const form = document.querySelector("#feedback-form");
const status = document.querySelector("#feedback-status");
const result = document.querySelector("#feedback-result");
let currentRecord = null;

const requestedPhase = new URLSearchParams(location.search).get("phase") || "";
if ([...document.querySelector("#feedback-phase").options].some((option) => option.value === requestedPhase)) {
  document.querySelector("#feedback-phase").value = requestedPhase;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const fields = Object.fromEntries(new FormData(form));
    fields.confirmed = form.elements.confirmed.checked;
    currentRecord = createFeedbackRecord(fields, new Date().toISOString());
    const markdown = feedbackToMarkdown(currentRecord);
    document.querySelector("#feedback-preview").textContent = markdown;
    const link = feedbackGitHubLink(currentRecord);
    document.querySelector("#feedback-github").href = link.url;
    result.hidden = false;
    status.textContent = link.truncated
      ? "回饋已整理完成，但內容太長，GitHub 網址只能帶入摘要欄位；請先下載 JSON，再貼進 issue。"
      : "回饋已在本機整理完成；請先預覽，再決定下載或送到 GitHub。";
    result.scrollIntoView({ block: "start" });
  } catch (error) {
    currentRecord = null;
    result.hidden = true;
    status.textContent = error instanceof Error ? error.message : "目前無法整理回饋。";
  }
});

form.addEventListener("input", invalidate);
form.addEventListener("change", invalidate);
document.querySelector("#feedback-download").addEventListener("click", () => {
  if (!currentRecord) return;
  const text = `${JSON.stringify(currentRecord, null, 2)}\n`;
  const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "delib-interop-feedback.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  status.textContent = "結構化回饋 JSON 已下載，尚未送到任何服務。";
});

function invalidate() {
  if (!currentRecord) return;
  currentRecord = null;
  result.hidden = true;
  status.textContent = "內容已變更；請重新產生預覽。";
}
