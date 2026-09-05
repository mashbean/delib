import {
  TOOL_SYNTHESIS_MODE_LABELS,
  pocketPolisDecisionStatusLabel,
  normalizePocketPolisReceipt,
  pocketPolisReceiptFromHash,
  pocketPolisReceiptSummary,
  pocketPolisReceiptToMarkdown,
} from "/pocket-polis-receipt-core.js";
import {
  bindPublicationControls,
  loadStoredReceipt,
} from "/public-receipt-client.js";
import {
  RECEIPT_HANDOFF_STORAGE_KEY,
  RECEIPT_HANDOFF_TARGETS,
  createReceiptHandoff,
  receiptHandoffTargetUrl,
} from "/receipt-handoff-core.js";

let receipt = pocketPolisReceiptFromHash(location.hash);
const error = document.querySelector("#pocket-receipt-page-error");
const content = document.querySelector("#pocket-receipt-page-content");
const actionStatus = document.querySelector("#pocket-receipt-action-status");
let storedReceipt = null;
let loadFailure = null;
if (!receipt) {
  const loading = document.createElement("p");
  loading.className = "loading-note";
  loading.setAttribute("role", "status");
  loading.textContent = "正在讀取公開成果…";
  document.querySelector("#receipt-main")?.prepend(loading);
  try {
    storedReceipt = await loadStoredReceipt(normalizePocketPolisReceipt, "pocket-polis-receipt");
  } catch (failure) {
    loadFailure = failure;
  }
  loading.remove();
  receipt = storedReceipt?.receipt || null;
}

if (!receipt) {
  if (loadFailure) {
    const detail = document.createElement("p");
    detail.textContent = loadFailure instanceof Error ? loadFailure.message : "公開成果暫時無法讀取。";
    error.querySelector("h1").textContent = "這份公開成果現在看不到";
    error.querySelector("h1").after(detail);
  }
  error.hidden = false;
} else {
  renderReceipt(receipt);
  bindReceiptActions(receipt);
  bindPublicationControls({
    receipt,
    stored: storedReceipt,
    prefix: "pocket-receipt",
    status: actionStatus,
  });
  content.hidden = false;
}

function renderReceipt(value) {
  const status = pocketPolisDecisionStatusLabel(value.organizer.decisionStatus);
  document.title = `${value.source.title} · 成果收據 · Delib`;
  document.querySelector("#pocket-receipt-page-title").textContent = value.source.title;
  document.querySelector("#pocket-receipt-page-description").textContent = value.source.description ||
    "以下把逐句回應、主辦者解讀、決策狀態與下一步分開呈現，讓參與者知道意見後來去了哪裡。";
  document.querySelector("#pocket-receipt-decision-chip").textContent = status;
  document.querySelector("#pocket-receipt-prepared-at").textContent = `準備於 ${formatDateTime(value.preparedAt)}`;
  document.querySelector("#pocket-receipt-participant-count").textContent = String(value.scope.participants);
  document.querySelector("#pocket-receipt-vote-count").textContent = String(value.scope.totalVotes);
  document.querySelector("#pocket-receipt-statement-count").textContent =
    `${value.scope.includedStatements}/${value.scope.approvedStatements}`;
  document.querySelector("#pocket-receipt-coverage").textContent = `${Math.round(value.scope.coverage * 100)}%`;
  document.querySelector("#pocket-receipt-source-link").href = value.source.reportUrl;
  renderFindings(document.querySelector("#pocket-receipt-finding-list"), value.findings);
  renderToolSynthesis(value.toolSynthesis || null);

  document.querySelector("#pocket-receipt-interpretation").textContent = value.organizer.interpretation;
  document.querySelector("#pocket-receipt-missing-voices").textContent = value.organizer.missingVoices;
  document.querySelector("#pocket-receipt-decision-status").textContent = status;
  document.querySelector("#pocket-receipt-authority").textContent = value.organizer.authority;
  document.querySelector("#pocket-receipt-responsible-actor").textContent = value.organizer.responsibleActor;
  document.querySelector("#pocket-receipt-response-by").textContent = formatDate(value.organizer.responseBy);
  document.querySelector("#pocket-receipt-next-action").textContent = value.organizer.nextAction;

  const evidence = document.querySelector("#pocket-receipt-evidence-link");
  if (value.organizer.evidenceUrl) {
    evidence.href = value.organizer.evidenceUrl;
    evidence.hidden = false;
  }
  document.querySelector("#pocket-receipt-source-note").textContent =
    `來源資料匯出於 ${formatDateTime(value.source.sourceExportedAt)}；兩份 CSV 的逐票紀錄與彙整票數相符。Pocket Polis CSV 不含分群結果，因此本頁不呈現或推論意見群組。`;
}

function renderToolSynthesis(synthesis) {
  const section = document.querySelector("#pocket-receipt-synthesis-section");
  if (!section) return;
  if (!synthesis) {
    section.hidden = true;
    return;
  }
  const modeLabel = TOOL_SYNTHESIS_MODE_LABELS[synthesis.generationMode] || synthesis.generationMode;
  document.querySelector("#pocket-receipt-synthesis-mode").textContent = modeLabel;
  const overview = document.querySelector("#pocket-receipt-synthesis-overview");
  overview.textContent = synthesis.overview;
  overview.hidden = !synthesis.overview;

  const common = document.querySelector("#pocket-receipt-synthesis-common");
  const commonList = common.querySelector("ul");
  commonList.replaceChildren(
    ...synthesis.commonGround.map((point) => {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = point.title;
      const direction = document.createElement("span");
      direction.className = "synthesis-direction";
      direction.textContent = point.direction === "agree" ? "跨群同意" : "跨群不同意";
      const description = document.createElement("small");
      description.textContent = point.description;
      item.append(title, " ", direction, description, citationNote(point.citedStatementIds));
      return item;
    }),
  );
  common.hidden = synthesis.commonGround.length === 0;

  const tensions = document.querySelector("#pocket-receipt-synthesis-tensions");
  const tensionList = tensions.querySelector("ul");
  tensionList.replaceChildren(
    ...synthesis.tensions.map((tension) => {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = tension.topic;
      const sides = document.createElement("small");
      sides.textContent = `${tension.groupALabel}：${tension.groupAPerspective || "—"}／${tension.groupBLabel}：${tension.groupBPerspective || "—"}`;
      item.append(title, sides);
      if (tension.tensions) {
        const detail = document.createElement("small");
        detail.textContent = tension.tensions;
        item.append(detail);
      }
      if (tension.bridgingQuestion) {
        const question = document.createElement("small");
        question.className = "synthesis-question";
        question.textContent = `橋接提問：${tension.bridgingQuestion}`;
        item.append(question);
      }
      item.append(citationNote(tension.citedStatementIds));
      return item;
    }),
  );
  tensions.hidden = synthesis.tensions.length === 0;

  document.querySelector("#pocket-receipt-synthesis-provenance").textContent =
    `由 Pocket Polis 於 ${formatDateTime(synthesis.generatedAt)} 以 ${synthesis.model} 產生（${modeLabel}）` +
    `${synthesis.isStale ? "，投票資料其後有更新" : ""}。主辦者只挑選了其中幾點；引用的陳述編號可在來源成果頁核對。這是工具整理，不是主辦者解讀，也不是共識證明。`;
  const dataList = document.querySelector("#pocket-receipt-data-list");
  if (dataList && !dataList.querySelector("[data-synthesis-note]")) {
    const note = document.createElement("li");
    note.dataset.synthesisNote = "true";
    note.textContent = "包含 Pocket Polis 產生的綜整節錄，並標明模型、產生時間與是否過期；不包含模型看過的逐筆投票。";
    dataList.append(note);
  }
  section.hidden = false;
}

function citationNote(ids) {
  const note = document.createElement("small");
  note.className = "synthesis-citation";
  note.textContent = ids.length ? `引用陳述 ${ids.join("、")}` : "";
  return note;
}

function bindReceiptActions(value) {
  let selectedHandoff = null;
  document.querySelectorAll("[data-handoff-target]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedHandoff = createReceiptHandoff({ receipt: value, target: button.dataset.handoffTarget });
      document.querySelectorAll("[data-handoff-target]").forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle("active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });
      renderHandoffPreview(selectedHandoff);
    });
  });
  document.querySelector("#pocket-receipt-handoff-continue").addEventListener("click", () => {
    if (!selectedHandoff) return;
    try {
      sessionStorage.setItem(RECEIPT_HANDOFF_STORAGE_KEY, JSON.stringify(selectedHandoff));
      location.assign(receiptHandoffTargetUrl(selectedHandoff, location.origin));
    } catch {
      actionStatus.textContent = "瀏覽器無法暫存這份草稿；請改用複製成果摘要。";
    }
  });
  document.querySelector("#pocket-receipt-copy-summary").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(`${pocketPolisReceiptSummary(value)}\n${publicPageUrl()}`);
      actionStatus.textContent = "成果摘要與公開連結已複製。";
    } catch {
      actionStatus.textContent = "瀏覽器沒有允許複製；請改下載 Markdown。";
    }
  });
  document.querySelector("#pocket-receipt-download-json").addEventListener("click", () =>
    downloadFile(value, `pocket-polis-${value.source.conversationId}-receipt.json`, "application/json"),
  );
  document.querySelector("#pocket-receipt-download-md").addEventListener("click", () =>
    downloadFile(
      pocketPolisReceiptToMarkdown(value),
      `pocket-polis-${value.source.conversationId}-receipt.md`,
      "text/markdown",
    ),
  );
}

function publicPageUrl() {
  const url = new URL(location.href);
  if (url.pathname.startsWith("/r/")) url.hash = "";
  return url.toString();
}

function renderFindings(root, findings) {
  root.replaceChildren(
    ...findings.map((finding) => {
      const item = document.createElement("li");
      const heading = document.createElement("div");
      const badge = document.createElement("span");
      const text = document.createElement("strong");
      const counts = document.createElement("div");
      const bar = document.createElement("div");
      badge.className = "receipt-layer-label";
      badge.textContent = finding.isSeed ? "種子陳述" : "參與者投稿";
      text.textContent = finding.text;
      heading.append(badge, text);
      counts.className = "statement-response-counts";
      counts.append(
        responseCount("同意", finding.agrees, "agree"),
        responseCount("不同意", finding.disagrees, "disagree"),
        responseCount("略過", finding.passes, "pass"),
      );
      bar.className = "statement-response-bar";
      bar.append(
        responseBar(finding.agrees, finding.responses, "agree"),
        responseBar(finding.disagrees, finding.responses, "disagree"),
        responseBar(finding.passes, finding.responses, "pass"),
      );
      item.append(heading, counts, bar);
      return item;
    }),
  );
}

function responseCount(label, value, className) {
  const node = document.createElement("span");
  node.className = className;
  node.textContent = `${label} ${value}`;
  return node;
}

function responseBar(value, total, className) {
  const node = document.createElement("span");
  node.className = className;
  node.style.width = `${(value / total) * 100}%`;
  return node;
}

function renderHandoffPreview(handoff) {
  const target = RECEIPT_HANDOFF_TARGETS[handoff.target];
  document.querySelector("#pocket-receipt-handoff-target-label").textContent = target.label;
  document.querySelector("#pocket-receipt-handoff-fields").replaceChildren(
    ...target.carried.map((field) => {
      const item = document.createElement("li");
      item.textContent = field;
      return item;
    }),
  );
  document.querySelector("#pocket-receipt-handoff-boundary").textContent = target.omitted;
  document.querySelector("#pocket-receipt-handoff-data").hidden = handoff.target !== "talk-to-the-city";
  const preview = document.querySelector("#pocket-receipt-handoff-preview");
  preview.hidden = false;
  preview.querySelector("button").focus();
}

function downloadFile(value, filename, type) {
  const contentValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const url = URL.createObjectURL(new Blob([contentValue], { type: `${type};charset=utf-8` }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  actionStatus.textContent = `已下載 ${filename}。`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-Hant-TW", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-Hant-TW", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}
