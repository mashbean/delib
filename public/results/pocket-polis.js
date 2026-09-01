import {
  pocketPolisDecisionStatusLabel,
  pocketPolisReceiptFromHash,
  pocketPolisReceiptSummary,
  pocketPolisReceiptToMarkdown,
} from "/pocket-polis-receipt-core.js";
import {
  RECEIPT_HANDOFF_STORAGE_KEY,
  RECEIPT_HANDOFF_TARGETS,
  createReceiptHandoff,
  receiptHandoffTargetUrl,
} from "/receipt-handoff-core.js";

const receipt = pocketPolisReceiptFromHash(location.hash);
const error = document.querySelector("#pocket-receipt-page-error");
const content = document.querySelector("#pocket-receipt-page-content");
const actionStatus = document.querySelector("#pocket-receipt-action-status");

if (!receipt) {
  error.hidden = false;
} else {
  renderReceipt(receipt);
  bindReceiptActions(receipt);
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
      await navigator.clipboard.writeText(`${pocketPolisReceiptSummary(value)}\n${location.href}`);
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
