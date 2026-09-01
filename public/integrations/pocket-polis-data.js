import {
  buildPocketPolisBundle,
  parsePocketPolisExports,
  pocketPolisToAgoraCsv,
  pocketPolisToTttcCsv,
} from "/pocket-polis-data-core.js";
import {
  createPocketPolisReceipt,
  pocketPolisReceiptToMarkdown,
  pocketPolisReceiptUrl,
} from "/pocket-polis-receipt-core.js";

const STORAGE_KEY = "delib:pocket-polis-data-source";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const form = document.querySelector("#pocket-polis-data-form");
const result = document.querySelector("#pocket-polis-data-result");
const status = document.querySelector("#pocket-polis-data-status");
const consent = document.querySelector("#pocket-polis-data-consent");
const downloadButtons = [...document.querySelectorAll(".data-download")];
let currentBundle = null;
let receiptCandidates = [];
let selectedReceiptStatementIds = new Set();
let currentReceipt = null;
let currentReceiptUrl = "";

restorePublicContext();
form.addEventListener("submit", checkExports);
form.addEventListener("input", invalidateResult);
form.addEventListener("change", invalidateResult);
consent.addEventListener("change", syncDownloadState);
for (const button of downloadButtons) button.addEventListener("click", downloadOutput);
document.querySelector("#pocket-polis-receipt-form").addEventListener("submit", prepareReceipt);
document.querySelector("#pocket-polis-receipt-form").addEventListener("input", invalidatePreparedReceipt);
document.querySelector("#pocket-polis-receipt-form").addEventListener("change", invalidatePreparedReceipt);
document.querySelector("#pocket-receipt-filter").addEventListener("input", renderReceiptCandidates);
document.querySelector("#pocket-receipt-statement-list").addEventListener("change", selectReceiptStatement);
document.querySelector("#pocket-receipt-copy-link").addEventListener("click", copyReceiptLink);
document.querySelector("#pocket-receipt-download-json").addEventListener("click", () => {
  if (!currentReceipt) return;
  downloadText(
    `pocket-polis-${currentReceipt.source.conversationId}-receipt.json`,
    `${JSON.stringify(currentReceipt, null, 2)}\n`,
    "application/json;charset=utf-8",
  );
});
document.querySelector("#pocket-receipt-download-md").addEventListener("click", () => {
  if (!currentReceipt) return;
  downloadText(
    `pocket-polis-${currentReceipt.source.conversationId}-receipt.md`,
    pocketPolisReceiptToMarkdown(currentReceipt),
    "text/markdown;charset=utf-8",
  );
});

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
    setReceiptSource(currentBundle);
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

function setReceiptSource(bundle) {
  receiptCandidates = bundle.statements.filter((statement) =>
    statement.status === "approved" && statement.agrees + statement.disagrees + statement.passes >= 3,
  );
  selectedReceiptStatementIds = new Set();
  currentReceipt = null;
  currentReceiptUrl = "";
  const builder = document.querySelector("#pocket-polis-receipt-builder");
  const fields = document.querySelector("#pocket-receipt-fields");
  const summary = document.querySelector("#pocket-receipt-source-summary");
  const heading = document.createElement("strong");
  const copy = document.createElement("span");
  heading.textContent = `Pocket Polis · ${bundle.source.title}`;
  copy.textContent = `${bundle.summary.participants} 位匿名參與者、${bundle.summary.votes} 筆投票；${receiptCandidates.length} 句已核准陳述達到 3 份公開門檻。`;
  summary.replaceChildren(heading, copy);
  document.querySelector("#pocket-polis-receipt-result").hidden = true;
  document.querySelector("#pocket-receipt-confirm").checked = false;
  document.querySelector("#pocket-receipt-filter").value = "";
  const blocker = !bundle.consistency.countMatches
    ? "兩份 CSV 的票數不一致；請重新下載後再準備公開成果。"
    : bundle.summary.participants < 3
      ? "公開成果頁至少需要 3 位匿名參與者。你仍可下載本機資料，但不應公開逐句票數。"
      : receiptCandidates.length === 0
        ? "目前沒有已核准且至少有 3 份回應的陳述。"
        : "";
  fields.disabled = Boolean(blocker);
  document.querySelector("#pocket-receipt-builder-status").textContent = blocker;
  builder.hidden = false;
  renderReceiptCandidates();
}

function renderReceiptCandidates() {
  const query = document.querySelector("#pocket-receipt-filter").value.trim().toLocaleLowerCase("zh-Hant-TW");
  const matches = receiptCandidates.filter((statement) =>
    !query || statement.text.toLocaleLowerCase("zh-Hant-TW").includes(query) || String(statement.statementId) === query,
  );
  const visible = matches.slice(0, 60);
  document.querySelector("#pocket-receipt-statement-list").replaceChildren(
    ...visible.map((statement) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      const copy = document.createElement("span");
      const text = document.createElement("strong");
      const counts = document.createElement("small");
      input.type = "checkbox";
      input.value = String(statement.statementId);
      input.checked = selectedReceiptStatementIds.has(statement.statementId);
      text.textContent = statement.text;
      counts.textContent = `#${statement.statementId} · ${statement.isSeed ? "種子陳述" : "參與者投稿"} · 同意 ${statement.agrees}／不同意 ${statement.disagrees}／略過 ${statement.passes}`;
      copy.append(text, counts);
      label.append(input, copy);
      return label;
    }),
  );
  const hiddenCount = matches.length - visible.length;
  const selectedCount = selectedReceiptStatementIds.size;
  document.querySelector("#pocket-receipt-selection-status").textContent =
    `已選 ${selectedCount}/8 句${hiddenCount > 0 ? `；另有 ${hiddenCount} 句，請縮小搜尋範圍` : ""}。`;
}

function selectReceiptStatement(event) {
  if (!(event.target instanceof HTMLInputElement) || event.target.type !== "checkbox") return;
  const statementId = Number(event.target.value);
  if (!Number.isSafeInteger(statementId)) return;
  if (event.target.checked && selectedReceiptStatementIds.size >= 8) {
    event.target.checked = false;
    document.querySelector("#pocket-receipt-selection-status").textContent = "成果頁最多放 8 句；請先取消一個選擇。";
    return;
  }
  if (event.target.checked) selectedReceiptStatementIds.add(statementId);
  else selectedReceiptStatementIds.delete(statementId);
  renderReceiptCandidates();
}

function prepareReceipt(event) {
  event.preventDefault();
  const builderStatus = document.querySelector("#pocket-receipt-builder-status");
  const receiptConsent = document.querySelector("#pocket-receipt-confirm");
  if (!currentBundle) {
    builderStatus.textContent = "請先重新檢查兩份 Pocket Polis CSV。";
    return;
  }
  if (!receiptConsent.checked) {
    builderStatus.textContent = "公開前請先確認陳述文字、同意範圍與回覆責任。";
    receiptConsent.focus();
    return;
  }
  try {
    currentReceipt = createPocketPolisReceipt({
      bundle: currentBundle,
      selectedStatementIds: [...selectedReceiptStatementIds],
      organizer: {
        interpretation: document.querySelector("#pocket-receipt-interpretation").value,
        missingVoices: document.querySelector("#pocket-receipt-missing-voices").value,
        decisionStatus: document.querySelector("#pocket-receipt-decision-status").value,
        authority: document.querySelector("#pocket-receipt-authority").value,
        responsibleActor: document.querySelector("#pocket-receipt-responsible-actor").value,
        responseBy: document.querySelector("#pocket-receipt-response-by").value,
        nextAction: document.querySelector("#pocket-receipt-next-action").value,
        evidenceUrl: document.querySelector("#pocket-receipt-evidence-url").value,
      },
    });
    currentReceiptUrl = pocketPolisReceiptUrl(currentReceipt, location.origin);
    document.querySelector("#pocket-receipt-preview").href = currentReceiptUrl;
    document.querySelector("#pocket-polis-receipt-result").hidden = false;
    builderStatus.textContent = currentReceiptUrl.length > 12_000
      ? "成果已產生。這份連結較長，請同時下載 JSON，避免通訊軟體截斷網址。"
      : "成果已在瀏覽器中產生；先預覽校對，再決定是否分享。";
    document.querySelector("#pocket-polis-receipt-result").scrollIntoView({
      behavior: reducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  } catch (error) {
    currentReceipt = null;
    currentReceiptUrl = "";
    document.querySelector("#pocket-polis-receipt-result").hidden = true;
    builderStatus.textContent = error instanceof Error ? error.message : "成果收據暫時無法產生。";
  }
}

async function copyReceiptLink() {
  const builderStatus = document.querySelector("#pocket-receipt-builder-status");
  if (!currentReceiptUrl) return;
  try {
    await navigator.clipboard.writeText(currentReceiptUrl);
    builderStatus.textContent = "公開成果連結已複製；連結含參與者文字與彙整票數，請視為公開內容。";
  } catch {
    builderStatus.textContent = "瀏覽器沒有允許複製；請打開預覽後從網址列複製。";
  }
}

function invalidatePreparedReceipt(event) {
  if (!currentReceipt || event.target?.id === "pocket-receipt-confirm") return;
  currentReceipt = null;
  currentReceiptUrl = "";
  document.querySelector("#pocket-polis-receipt-result").hidden = true;
  document.querySelector("#pocket-receipt-confirm").checked = false;
  document.querySelector("#pocket-receipt-builder-status").textContent =
    "內容已變更；請重新確認後再產生新的成果連結。";
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
  clearReceiptBuilder();
  status.textContent = "來源或檔案已變更，請重新檢查兩份 CSV。";
}

function clearReceiptBuilder() {
  receiptCandidates = [];
  selectedReceiptStatementIds = new Set();
  currentReceipt = null;
  currentReceiptUrl = "";
  document.querySelector("#pocket-polis-receipt-builder").hidden = true;
  document.querySelector("#pocket-polis-receipt-result").hidden = true;
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
