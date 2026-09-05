import {
  buildPocketPolisBundle,
  parsePocketPolisExports,
  pocketPolisToAgoraCsv,
  pocketPolisToTttcCsv,
} from "/pocket-polis-data-core.js";
import { pocketPolisBundleToDelibData } from "/delib-data-core.js";
import {
  TOOL_SYNTHESIS_MODE_LABELS,
  createPocketPolisReceipt,
  pocketPolisReceiptToMarkdown,
  pocketPolisReceiptUrl,
  selectToolSynthesis,
} from "/pocket-polis-receipt-core.js";
import { formatDateTime } from "/ui-shared.js";
import { mergeTttcFiles, parseTttcCsv, tttcRowsToCsv } from "/tttc-csv-core.js";

const STORAGE_KEY = "delib:pocket-polis-data-source";
const MAX_SYNTHESIS_POINT_PICKS = 6;
const MAX_SYNTHESIS_TENSION_PICKS = 4;
let currentSynthesis = null;
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

// ---- 已是 TTTC 格式的 CSV：檢查、合併、重新輸出 ----
const tttcForm = document.querySelector("#tttc-csv-form");
const tttcResult = document.querySelector("#tttc-csv-result");
const tttcStatus = document.querySelector("#tttc-csv-status");
const tttcConsent = document.querySelector("#tttc-csv-consent");
const tttcDownload = document.querySelector("#tttc-csv-download");
let currentTttc = null;
tttcForm.addEventListener("submit", checkTttcFiles);
tttcForm.addEventListener("change", () => {
  if (!currentTttc) return;
  currentTttc = null;
  tttcResult.hidden = true;
  tttcConsent.checked = false;
  tttcDownload.disabled = true;
  tttcStatus.textContent = "檔案已變更，請重新檢查。";
});
tttcConsent.addEventListener("change", () => {
  tttcDownload.disabled = !currentTttc || !tttcConsent.checked;
});
tttcDownload.addEventListener("click", () => {
  if (!currentTttc || !tttcConsent.checked) return;
  downloadText(`tttc-merged-${currentTttc.summary.rows}-rows.csv`, tttcRowsToCsv(currentTttc.rows), "text/csv;charset=utf-8");
});

async function checkTttcFiles(event) {
  event.preventDefault();
  const submit = document.querySelector("#check-tttc-csv");
  const files = [...document.querySelector("#tttc-csv-files").files];
  currentTttc = null;
  tttcResult.hidden = true;
  tttcConsent.checked = false;
  tttcDownload.disabled = true;
  submit.disabled = true;
  tttcStatus.textContent = "正在目前瀏覽器檢查檔案…";
  try {
    if (files.length === 0) throw new Error("請選擇至少一份 TTTC CSV");
    const parsed = [];
    for (const file of files) {
      const read = await readCsvFile(file, file.name);
      parsed.push(parseTttcCsv({ text: read.text, label: file.name }));
    }
    currentTttc = mergeTttcFiles(parsed);
    renderTttcResult(currentTttc);
    tttcResult.hidden = false;
    tttcStatus.textContent = `${files.length} 份檔案已在本機通過檢查；尚未上傳或保存。`;
    tttcResult.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  } catch (error) {
    tttcStatus.textContent = error instanceof Error ? error.message : "目前無法檢查這些 CSV。";
  } finally {
    submit.disabled = false;
  }
}

function renderTttcResult(merged) {
  document.querySelector("#tttc-csv-summary").textContent = merged.summary.perFile
    .map((entry) => `${entry.file}：${entry.rows} 列`)
    .join("；");
  const metrics = [
    [merged.summary.rows, "合併後的發言"],
    [merged.summary.files, "來源檔案"],
    [merged.summary.interviews, "不同的 interview 標記"],
    [merged.summary.blankInterviews, "沒有 interview 的列"],
  ];
  document.querySelector("#tttc-csv-metrics").replaceChildren(
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
  const warnings = document.querySelector("#tttc-csv-warnings");
  warnings.hidden = merged.warnings.length === 0;
  warnings.replaceChildren(
    ...merged.warnings.slice(0, 20).map((message) => {
      const item = document.createElement("p");
      item.textContent = message;
      return item;
    }),
  );
  document.querySelector("#tttc-csv-preview").replaceChildren(
    ...merged.rows.slice(0, 5).map((row) => {
      const item = document.createElement("li");
      item.textContent = `${row.interview || "（無 interview）"}：${row.comment}`;
      return item;
    }),
  );
}
form.addEventListener("input", invalidateResult);
form.addEventListener("change", invalidateResult);
consent.addEventListener("change", syncDownloadState);
for (const button of downloadButtons) button.addEventListener("click", downloadOutput);
document.querySelector("#pocket-polis-receipt-form").addEventListener("submit", prepareReceipt);
document.querySelector("#pocket-polis-receipt-form").addEventListener("input", invalidatePreparedReceipt);
document.querySelector("#pocket-polis-receipt-form").addEventListener("change", invalidatePreparedReceipt);
document.querySelector("#pocket-receipt-filter").addEventListener("input", renderReceiptCandidates);
document.querySelector("#pocket-receipt-statement-list").addEventListener("change", selectReceiptStatement);
document.querySelector("#pocket-receipt-synthesis-load").addEventListener("click", loadSynthesis);
document.querySelector("#pocket-receipt-synthesis-points").addEventListener("change", (event) =>
  limitSynthesisPicks(event, MAX_SYNTHESIS_POINT_PICKS, "共同點最多放 6 點"));
document.querySelector("#pocket-receipt-synthesis-tensions").addEventListener("change", (event) =>
  limitSynthesisPicks(event, MAX_SYNTHESIS_TENSION_PICKS, "張力最多放 4 組"));
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
      role: label === "意見清單" ? "statements" : label === "投票紀錄" ? "votes" : "tttc",
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
    [bundle.summary.participants, "匿名投票者"],
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
  copy.textContent = `${bundle.summary.participants} 位匿名投票者、${bundle.summary.votes} 筆投票；${receiptCandidates.length} 句已核准陳述達到 3 份公開門檻。`;
  summary.replaceChildren(heading, copy);
  document.querySelector("#pocket-polis-receipt-result").hidden = true;
  document.querySelector("#pocket-receipt-confirm").checked = false;
  document.querySelector("#pocket-receipt-filter").value = "";
  resetSynthesisPanel();
  const blocker = !bundle.consistency.countMatches
    ? "兩份 CSV 的票數不一致；請重新下載後再準備公開成果。"
    : bundle.summary.participants < 3
      ? "公開成果頁至少需要 3 位匿名投票者。你仍可下載本機資料，但不應公開逐句票數。"
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
    let toolSynthesis = null;
    if (document.querySelector("#pocket-receipt-synthesis-include").checked) {
      if (!currentSynthesis) throw new Error("請先按「讀取綜整」，或取消「把勾選的工具整理放進成果頁」。");
      toolSynthesis = selectToolSynthesis(currentSynthesis, {
        includeOverview: document.querySelector("#pocket-receipt-synthesis-overview").checked,
        pointIndexes: checkedIndexes("#pocket-receipt-synthesis-points"),
        tensionIndexes: checkedIndexes("#pocket-receipt-synthesis-tensions"),
      });
      if (!toolSynthesis) throw new Error("請至少勾選概述、一個共同點或一組張力，或取消「把勾選的工具整理放進成果頁」。");
    }
    currentReceipt = createPocketPolisReceipt({
      bundle: currentBundle,
      selectedStatementIds: [...selectedReceiptStatementIds],
      toolSynthesis,
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
  if (output === "portable") {
    downloadText(
      `pocket-polis-${id}-delib-data.json`,
      `${JSON.stringify(pocketPolisBundleToDelibData(currentBundle), null, 2)}\n`,
      "application/json;charset=utf-8",
    );
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
      output === "portable" ||
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
  resetSynthesisPanel();
}

function resetSynthesisPanel() {
  currentSynthesis = null;
  document.querySelector("#pocket-receipt-synthesis-body").hidden = true;
  document.querySelector("#pocket-receipt-synthesis-points").replaceChildren();
  document.querySelector("#pocket-receipt-synthesis-tensions").replaceChildren();
  document.querySelector("#pocket-receipt-synthesis-include").checked = false;
  document.querySelector("#pocket-receipt-synthesis-overview").checked = true;
  document.querySelector("#pocket-receipt-synthesis-status").textContent = "";
}

async function loadSynthesis() {
  const statusNode = document.querySelector("#pocket-receipt-synthesis-status");
  const button = document.querySelector("#pocket-receipt-synthesis-load");
  if (!currentBundle) {
    statusNode.textContent = "請先檢查兩份 CSV。";
    return;
  }
  button.disabled = true;
  statusNode.textContent = "正在向 Pocket Polis 讀取綜整…";
  try {
    const response = await fetch(
      `/api/integrations/pocket-polis/synthesis?conversation=${encodeURIComponent(currentBundle.source.conversationId)}`,
      { headers: { Accept: "application/json" } },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "暫時讀不到綜整，請稍後再試。");
    if (payload.sourceUrl && currentBundle.source.origin && new URL(payload.sourceUrl).origin !== currentBundle.source.origin) {
      throw new Error("這個活動不在本站連接的 Pocket Polis 主機上，無法讀取它的綜整。");
    }
    if (payload.status !== "ready") {
      currentSynthesis = null;
      document.querySelector("#pocket-receipt-synthesis-body").hidden = true;
      statusNode.textContent = payload.status === "pending"
        ? "Pocket Polis 正在產生綜整，通常需要幾分鐘；稍後再按一次「讀取綜整」。"
        : payload.status === "insufficient"
          ? `Pocket Polis 還無法綜整：${payload.reason || "參與者或意見群不足"}。`
          : `Pocket Polis 暫時無法提供綜整${payload.reason ? `：${payload.reason}` : ""}。`;
      return;
    }
    currentSynthesis = payload;
    renderSynthesisPanel(payload);
    statusNode.textContent = "已讀取；勾選要放進成果頁的部分，再勾選下方的確認。";
  } catch (error) {
    currentSynthesis = null;
    document.querySelector("#pocket-receipt-synthesis-body").hidden = true;
    statusNode.textContent = error instanceof Error ? error.message : "暫時讀不到綜整，請稍後再試。";
  } finally {
    button.disabled = false;
  }
}

function renderSynthesisPanel(synthesis) {
  const modeLabel = TOOL_SYNTHESIS_MODE_LABELS[synthesis.generationMode] || synthesis.generationMode;
  const counts = synthesis.provenance || {};
  document.querySelector("#pocket-receipt-synthesis-provenance").textContent =
    `由 ${synthesis.model} 於 ${formatDateTime(synthesis.generatedAt)} 產生（${modeLabel}）` +
    `${synthesis.isStale ? "；投票資料其後有更新，數字可能已不同" : ""}` +
    `${counts.participantCount ? `；當時 ${counts.participantCount} 位參與者、${counts.groupCount || "?"} 個意見群` : ""}。`;
  const overviewText = document.querySelector("#pocket-receipt-synthesis-overview-text");
  const overviewOption = document.querySelector("#pocket-receipt-synthesis-overview");
  overviewText.textContent = synthesis.overview?.summary || "（這份綜整沒有整體概述）";
  overviewOption.checked = Boolean(synthesis.overview?.summary);
  overviewOption.disabled = !synthesis.overview?.summary;

  const points = document.querySelector("#pocket-receipt-synthesis-points");
  const keyPoints = synthesis.commonGround?.keyPoints || [];
  points.replaceChildren(
    ...keyPoints.map((point, index) =>
      synthesisOption(index, point.title, [
        point.description,
        point.citedStatementIds?.length ? `引用陳述 ${point.citedStatementIds.join("、")}` : "",
      ], point.direction === "agree" ? "跨群同意" : "跨群不同意")),
  );
  if (!keyPoints.length) points.append(emptyNote("這份綜整沒有列出跨群共同點。"));

  const tensions = document.querySelector("#pocket-receipt-synthesis-tensions");
  const tensionItems = synthesis.tensions || [];
  tensions.replaceChildren(
    ...tensionItems.map((tension, index) =>
      synthesisOption(index, tension.topic, [
        `${tension.groupALabel}：${tension.groupAPerspective || "—"}／${tension.groupBLabel}：${tension.groupBPerspective || "—"}`,
        tension.bridgingQuestion ? `橋接提問：${tension.bridgingQuestion}` : "",
        tension.citedStatementIds?.length ? `引用陳述 ${tension.citedStatementIds.join("、")}` : "",
      ])),
  );
  if (!tensionItems.length) tensions.append(emptyNote("這份綜整沒有列出分歧與張力。"));
  document.querySelector("#pocket-receipt-synthesis-body").hidden = false;
}

function synthesisOption(index, title, lines, chip = "") {
  const label = document.createElement("label");
  label.className = "synthesis-option";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = String(index);
  const body = document.createElement("span");
  const heading = document.createElement("strong");
  heading.textContent = title;
  body.append(heading);
  if (chip) {
    const badge = document.createElement("span");
    badge.className = `synthesis-direction${chip === "跨群不同意" ? " synthesis-direction-disagree" : ""}`;
    badge.textContent = chip;
    body.append(badge);
  }
  for (const line of lines.filter(Boolean)) {
    const small = document.createElement("small");
    small.textContent = line;
    body.append(small);
  }
  label.append(input, body);
  return label;
}

function emptyNote(text) {
  const note = document.createElement("p");
  note.className = "field-note";
  note.textContent = text;
  return note;
}

function limitSynthesisPicks(event, limit, message) {
  if (!(event.target instanceof HTMLInputElement) || !event.target.checked) return;
  const picked = event.currentTarget.querySelectorAll("input:checked").length;
  if (picked > limit) {
    event.target.checked = false;
    document.querySelector("#pocket-receipt-synthesis-status").textContent = `${message}；請先取消一個。`;
  }
}

function checkedIndexes(selector) {
  return [...document.querySelectorAll(`${selector} input:checked`)].map((input) => Number(input.value));
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
