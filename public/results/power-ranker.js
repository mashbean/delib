import {
  decisionStatusLabel,
  nextRoundRankingUrl,
  normalizeRankingReceipt,
  rankingReceiptFromHash,
  rankingReceiptSummary,
  rankingReceiptToMarkdown,
} from "/ranking-receipt-core.js";
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

let receipt = rankingReceiptFromHash(location.hash);
const error = document.querySelector("#receipt-page-error");
const content = document.querySelector("#receipt-page-content");
const actionStatus = document.querySelector("#receipt-action-status");
let storedReceipt = null;
let loadFailure = null;
if (!receipt) {
  const loading = document.createElement("p");
  loading.className = "loading-note";
  loading.setAttribute("role", "status");
  loading.textContent = "正在讀取公開成果…";
  document.querySelector("#receipt-main")?.prepend(loading);
  try {
    storedReceipt = await loadStoredReceipt(normalizeRankingReceipt, "ranking-receipt");
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
    prefix: "receipt",
    status: actionStatus,
  });
  content.hidden = false;
}

function renderReceipt(value) {
  const status = decisionStatusLabel(value.organizer.decisionStatus);
  document.title = `${value.question.title} · 成果收據 · Delib`;
  document.querySelector("#receipt-page-title").textContent = value.question.title;
  document.querySelector("#receipt-decision-chip").textContent = status;
  document.querySelector("#receipt-prepared-at").textContent = `準備於 ${formatDateTime(value.preparedAt)}`;
  document.querySelector("#receipt-session-count").textContent = String(value.aggregate.sessions);
  document.querySelector("#receipt-judgment-count").textContent = String(value.aggregate.judgments);
  document.querySelector("#receipt-coverage-count").textContent =
    `${value.coverage.comparedPairs}/${value.coverage.totalPairs}`;
  document.querySelector("#receipt-coverage-label").textContent =
    `比較涵蓋 · ${Math.round(value.coverage.ratio * 100)}%`;
  document.querySelector("#receipt-aggregate-source").href = value.source.aggregateUrl;
  renderRankingList(document.querySelector("#receipt-ranking-list"), value.result);

  document.querySelector("#receipt-interpretation").textContent = value.organizer.interpretation;
  document.querySelector("#receipt-missing-voices").textContent = value.organizer.missingVoices;
  document.querySelector("#receipt-decision-status").textContent = status;
  document.querySelector("#receipt-authority").textContent = value.organizer.authority;
  document.querySelector("#receipt-responsible-actor").textContent = value.organizer.responsibleActor;
  document.querySelector("#receipt-response-by").textContent = value.organizer.responseBy
    ? formatDate(value.organizer.responseBy)
    : "尚未設定日期";
  document.querySelector("#receipt-next-action-copy").textContent = value.organizer.nextAction;

  const evidence = document.querySelector("#receipt-evidence-link");
  if (value.organizer.evidenceUrl) {
    evidence.href = value.organizer.evidenceUrl;
    evidence.hidden = false;
  }

  const expiry = document.querySelector("#receipt-source-expiry");
  expiry.textContent = value.source.aggregateStorage === "ephemeral-room"
    ? value.source.aggregateExpiresAt
      ? `原始短期收件室預計於 ${formatDateTime(value.source.aggregateExpiresAt)} 清除；這張收據是另行分享的自足副本。`
      : "原始彙整來自短期收件室；這張收據是另行分享的自足副本。"
    : "原始彙整在主辦者瀏覽器中完成；Delib 沒有收到個人結果檔或保存這張收據。";

  document.querySelector("#receipt-next-round").href = nextRoundRankingUrl(value, location.origin);
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
  document.querySelector("#receipt-handoff-continue").addEventListener("click", () => {
    if (!selectedHandoff) return;
    try {
      sessionStorage.setItem(RECEIPT_HANDOFF_STORAGE_KEY, JSON.stringify(selectedHandoff));
      location.assign(receiptHandoffTargetUrl(selectedHandoff, location.origin));
    } catch {
      actionStatus.textContent = "瀏覽器無法暫存這份草稿；請改用複製成果摘要。";
    }
  });
  document.querySelector("#receipt-copy-summary").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(`${rankingReceiptSummary(value)}\n${publicPageUrl()}`);
      actionStatus.textContent = "成果摘要與公開連結已複製。";
    } catch {
      actionStatus.textContent = "瀏覽器沒有允許複製；請改下載 Markdown。";
    }
  });
  document.querySelector("#receipt-download-json").addEventListener("click", () =>
    downloadFile(value, "delib-power-ranker-receipt.json", "application/json"),
  );
  document.querySelector("#receipt-download-md").addEventListener("click", () =>
    downloadFile(rankingReceiptToMarkdown(value), "delib-power-ranker-receipt.md", "text/markdown"),
  );
}

function publicPageUrl() {
  const url = new URL(location.href);
  if (url.pathname.startsWith("/r/")) url.hash = "";
  return url.toString();
}

function renderHandoffPreview(handoff) {
  const target = RECEIPT_HANDOFF_TARGETS[handoff.target];
  document.querySelector("#receipt-handoff-target-label").textContent = target.label;
  document.querySelector("#receipt-handoff-fields").replaceChildren(
    ...target.carried.map((field) => {
      const item = document.createElement("li");
      item.textContent = field;
      return item;
    }),
  );
  document.querySelector("#receipt-handoff-boundary").textContent = target.omitted;
  const preview = document.querySelector("#receipt-handoff-preview");
  preview.hidden = false;
  preview.querySelector("button").focus();
}

function renderRankingList(root, ranking) {
  root.replaceChildren(
    ...ranking.map((item) => {
      const row = document.createElement("li");
      const heading = document.createElement("div");
      const rank = document.createElement("strong");
      const label = document.createElement("span");
      const score = document.createElement("small");
      const bar = document.createElement("span");
      rank.textContent = String(item.rank).padStart(2, "0");
      label.textContent = item.label;
      score.textContent = `權重 ${item.score.toFixed(3)} · ${item.observations} 次比較`;
      bar.className = "ranking-bar";
      bar.style.width = `${Math.max(2, item.score * 100)}%`;
      heading.append(rank, label, score);
      row.append(heading, bar);
      return row;
    }),
  );
}

function downloadFile(value, filename, type) {
  const contentValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const blob = new Blob([contentValue], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  actionStatus.textContent = `已下載 ${filename}。`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-Hant-TW", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(value),
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-Hant-TW", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}
