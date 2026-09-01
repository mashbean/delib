import {
  buildPocketPolisBundle,
  parsePocketPolisExports,
  pocketPolisToAgoraCsv,
  pocketPolisToTttcCsv,
} from "/pocket-polis-data-core.js";

const STORAGE_KEY = "delib:pocket-polis-data-source";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const form = document.querySelector("#pocket-polis-data-form");
const result = document.querySelector("#pocket-polis-data-result");
const status = document.querySelector("#pocket-polis-data-status");
const consent = document.querySelector("#pocket-polis-data-consent");
const downloadButtons = [...document.querySelectorAll(".data-download")];
let currentBundle = null;

restorePublicContext();
form.addEventListener("submit", checkExports);
form.addEventListener("input", invalidateResult);
form.addEventListener("change", invalidateResult);
consent.addEventListener("change", syncDownloadState);
for (const button of downloadButtons) button.addEventListener("click", downloadOutput);

async function checkExports(event) {
  event.preventDefault();
  const submit = document.querySelector("#check-pocket-polis-data");
  const statementsFile = document.querySelector("#pocket-polis-statements-file").files[0];
  const votesFile = document.querySelector("#pocket-polis-votes-file").files[0];
  currentBundle = null;
  result.hidden = true;
  consent.checked = false;
  syncDownloadState();
  submit.disabled = true;
  status.textContent = "正在目前瀏覽器檢查檔案與計算 SHA-256…";
  try {
    const [statements, votes] = await Promise.all([
      readCsvFile(statementsFile, "意見清單"),
      readCsvFile(votesFile, "投票紀錄"),
    ]);
    const parsed = parsePocketPolisExports({
      statementsCsv: statements.text,
      votesCsv: votes.text,
    });
    currentBundle = buildPocketPolisBundle({
      title: document.querySelector("#pocket-polis-data-title").value,
      description: document.querySelector("#pocket-polis-data-description").value,
      reportUrl: document.querySelector("#pocket-polis-data-report").value,
      parsed,
      files: [statements.evidence, votes.evidence],
    });
    renderResult(currentBundle);
    result.hidden = false;
    status.textContent = "兩份 CSV 已在本機通過格式檢查；尚未上傳或保存。";
    result.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "目前無法檢查這兩份 CSV。";
  } finally {
    submit.disabled = false;
  }
}

async function readCsvFile(file, label) {
  if (!(file instanceof File)) throw new Error(`請選擇${label} CSV`);
  if (file.size < 1) throw new Error(`${label}是空檔案`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${label}超過 20 MiB 安全上限`);
  const bytes = await file.arrayBuffer();
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label}不是有效的 UTF-8 CSV`);
  }
  return {
    text,
    evidence: {
      role: label === "意見清單" ? "statements" : "votes",
      name: file.name,
      size: file.size,
      sha256: await sha256(bytes),
    },
  };
}

function renderResult(bundle) {
  const consistency = document.querySelector("#pocket-polis-data-consistency");
  consistency.textContent = bundle.consistency.countMatches
    ? "兩份檔案的逐票紀錄與陳述彙整票數相符。"
    : `有 ${bundle.consistency.mismatchedStatements.length} 句的彙整票數不一致；建議回管理頁同時重新下載。`;
  consistency.className = bundle.consistency.countMatches ? "data-check-ok" : "data-check-warning";

  const metrics = [
    [bundle.summary.participants, "匿名參與者"],
    [bundle.summary.approvedStatements, `已核准意見／共 ${bundle.summary.statements} 句`],
    [bundle.summary.votes, "逐筆投票"],
    [`${Math.round(bundle.summary.coverage * 100)}%`, "已核准意見投票涵蓋率"],
  ];
  document.querySelector("#pocket-polis-data-metrics").replaceChildren(
    ...metrics.map(([value, label]) => {
      const card = document.createElement("div");
      const strong = document.createElement("strong");
      const span = document.createElement("span");
      strong.textContent = String(value);
      span.textContent = label;
      card.append(strong, span);
      return card;
    }),
  );

  const warningMessages = [];
  if (!bundle.consistency.countMatches) {
    warningMessages.push(`不一致的 statement_id：${bundle.consistency.mismatchedStatements.join("、")}`);
  }
  if (bundle.summary.approvedStatements === 0) warningMessages.push("沒有已核准意見，暫時不能建立 TTTC CSV。");
  if (bundle.summary.votes === 0) warningMessages.push("沒有投票紀錄，暫時不能建立 Agora 匯入包。");
  const warnings = document.querySelector("#pocket-polis-data-warnings");
  warnings.hidden = warningMessages.length === 0;
  warnings.replaceChildren(
    ...warningMessages.map((message) => {
      const item = document.createElement("p");
      item.textContent = message;
      return item;
    }),
  );

  const preview = document.querySelector("#pocket-polis-statement-preview");
  preview.replaceChildren(
    ...bundle.statements.slice(0, 5).map((statement) => {
      const item = document.createElement("li");
      item.textContent = `${statement.text}（${statusLabel(statement.status)}；同意 ${statement.agrees}／不同意 ${statement.disagrees}／略過 ${statement.passes}）`;
      return item;
    }),
  );
  const limitations = document.querySelector("#pocket-polis-limitations");
  limitations.replaceChildren(
    ...bundle.dataCard.limitations.map((limitation) => {
      const item = document.createElement("li");
      item.textContent = limitation;
      return item;
    }),
  );
}

function downloadOutput(event) {
  if (!currentBundle || !consent.checked) return;
  const id = currentBundle.source.conversationId;
  const output = event.currentTarget.dataset.download;
  if (output === "bundle") {
    downloadText(`pocket-polis-${id}-delib.json`, `${JSON.stringify(currentBundle, null, 2)}\n`, "application/json;charset=utf-8");
    return;
  }
  if (output === "tttc") {
    downloadText(`pocket-polis-${id}-tttc.csv`, pocketPolisToTttcCsv(currentBundle), "text/csv;charset=utf-8");
    return;
  }
  const agora = pocketPolisToAgoraCsv(currentBundle);
  const agoraFiles = {
    "agora-summary": ["summary", agora.summaryCsv],
    "agora-comments": ["comments", agora.commentsCsv],
    "agora-votes": ["votes", agora.votesCsv],
  };
  const selected = agoraFiles[output];
  if (selected) downloadText(`pocket-polis-${id}-agora-${selected[0]}.csv`, selected[1], "text/csv;charset=utf-8");
}

function downloadText(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function syncDownloadState() {
  for (const button of downloadButtons) {
    const output = button.dataset.download;
    const available =
      output === "bundle" ||
      (output === "tttc" && currentBundle?.summary.approvedStatements > 0) ||
      (output?.startsWith("agora-") && currentBundle?.summary.votes > 0);
    button.disabled = !currentBundle || !consent.checked || !available;
  }
}

function invalidateResult() {
  if (!currentBundle) return;
  currentBundle = null;
  result.hidden = true;
  consent.checked = false;
  syncDownloadState();
  status.textContent = "來源或檔案已變更，請重新檢查兩份 CSV。";
}

function restorePublicContext() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return;
    const title = typeof saved.title === "string" ? saved.title.slice(0, 120) : "";
    const reportUrl = typeof saved.reportUrl === "string" ? saved.reportUrl.slice(0, 2000) : "";
    const description = typeof saved.description === "string" ? saved.description.slice(0, 2000) : "";
    if (!title || !reportUrl) return;
    document.querySelector("#pocket-polis-data-title").value = title;
    document.querySelector("#pocket-polis-data-report").value = reportUrl;
    document.querySelector("#pocket-polis-data-description").value = description;
    document.querySelector("#pocket-polis-memory").hidden = false;
  } catch {
    // Ignore malformed tab-local context and leave the form empty.
  }
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function statusLabel(value) {
  return value === "approved" ? "已核准" : value === "pending" ? "待審核" : "已退回";
}

function reducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}
