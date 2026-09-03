import {
  aggregateRankingBundles,
  buildAggregateRankingBundleFromPairs,
  buildIndividualRankingBundle,
  normalizeRankingConfig,
  rankingConfigFromHash,
  rankingResultToCsv,
  recommendedComparisonCount,
  selectNextPair,
} from "/power-ranker-core.js";
import { rankingBundleToDelibData } from "/delib-data-core.js";
import {
  createRankingReceipt,
  rankingReceiptToMarkdown,
  rankingReceiptUrl,
} from "/ranking-receipt-core.js";
import { formatDateTime, storageGet, storageSet } from "/ui-shared.js";

const pageParams = new URLSearchParams(location.search);
const roomId = pageParams.get("room") || "";
// /integrations/power-ranker?mode=aggregate: organizer arrives from the homepage
// data-handoff chooser with participant JSON files, not with a question.
const aggregateOnly = !roomId && pageParams.get("mode") === "aggregate";
const adminToken = roomId ? new URLSearchParams(location.hash.replace(/^#/, "")).get("admin") || "" : "";
let config = roomId ? null : rankingConfigFromHash(location.hash);
let itemMap = new Map();
let targetComparisons = 0;
let judgments = [];
let currentPair = null;
let finished = false;
let submitted = false;
let sessionId = getSessionId();
let currentBundle = null;
let aggregateBundle = null;
let roomAggregateBundle = null;
let receiptSourceBundle = null;
let currentReceipt = null;
let currentReceiptUrl = "";

const title = document.querySelector("#ranking-title");
const status = document.querySelector("#ranking-status");
const error = document.querySelector("#ranking-error");
const panel = document.querySelector("#ranking-panel");
const question = document.querySelector("#ranking-question");
const progressText = document.querySelector("#ranking-progress-text");
const progressBar = document.querySelector("#ranking-progress-bar");
const leftButton = document.querySelector("#ranking-left");
const rightButton = document.querySelector("#ranking-right");
const equalButton = document.querySelector("#ranking-equal");
const finishButton = document.querySelector("#ranking-finish");
const undoButton = document.querySelector("#ranking-undo");
const result = document.querySelector("#ranking-result");
const resultList = document.querySelector("#ranking-result-list");
const actionStatus = document.querySelector("#ranking-action-status");

bindEvents();
if (roomId) {
  loadRoom();
} else if (config) {
  startRanking();
} else if (aggregateOnly) {
  document.querySelector("#ranking-kicker").textContent = "主辦者彙整";
  title.textContent = "把多人結果合在一起";
  status.textContent = "選取參與者交回的個人結果 JSON；合併在本機完成，不會上傳。";
  document.title = "合併 Power Ranker 結果 · Delib";
  document.querySelector("#local-aggregate-panel")?.scrollIntoView({ block: "start" });
  queueMicrotask(() => document.querySelector("#aggregate-files")?.focus({ preventScroll: true }));
} else {
  showLoadError("無法讀取排序題目。", "這個連結沒有有效題目。請回到 Delib，填入 3–10 個不重複選項。");
}

function bindEvents() {
  leftButton.addEventListener("click", () => choose(leftButton.dataset.itemId));
  rightButton.addEventListener("click", () => choose(rightButton.dataset.itemId));
  equalButton.addEventListener("click", () => choose("equal"));
  finishButton.addEventListener("click", finishRanking);
  undoButton.addEventListener("click", undoJudgment);
  document.querySelector("#ranking-continue").addEventListener("click", continueRanking);
  document.querySelector("#ranking-restart").addEventListener("click", restartRanking);
  document.querySelector("#ranking-submit-room").addEventListener("click", submitRoom);
  document.querySelector("#ranking-room-refresh").addEventListener("click", loadRoomSnapshot);
  document.querySelector("#ranking-delete-confirm").addEventListener("change", (event) => {
    document.querySelector("#ranking-delete-room").disabled = !event.target.checked;
  });
  document.querySelector("#ranking-delete-room").addEventListener("click", deleteRoom);
  document.querySelector("#ranking-download-json").addEventListener("click", () =>
    downloadFile(currentBundle, "delib-power-ranker-result.json", "application/json"),
  );
  document.querySelector("#ranking-download-portable").addEventListener("click", () =>
    downloadFile(rankingBundleToDelibData(currentBundle), "delib-power-ranker-delib-data.json", "application/json"),
  );
  document.querySelector("#ranking-download-csv").addEventListener("click", () =>
    downloadFile(rankingResultToCsv(currentBundle), "delib-power-ranker-result.csv", "text/csv"),
  );
  document.querySelector("#ranking-copy-summary").addEventListener("click", copySummary);
  document.querySelector("#aggregate-files").addEventListener("change", aggregateFiles);
  document.querySelector("#aggregate-download-json").addEventListener("click", () =>
    downloadFile(aggregateBundle, "delib-power-ranker-aggregate.json", "application/json"),
  );
  document.querySelector("#aggregate-download-csv").addEventListener("click", () =>
    downloadFile(rankingResultToCsv(aggregateBundle), "delib-power-ranker-aggregate.csv", "text/csv"),
  );
  document.querySelector("#aggregate-download-portable").addEventListener("click", () =>
    downloadFile(rankingBundleToDelibData(aggregateBundle), "delib-power-ranker-aggregate-delib-data.json", "application/json"),
  );
  document.querySelector("#room-aggregate-download-json").addEventListener("click", () =>
    downloadFile(roomAggregateBundle, "delib-power-ranker-room-aggregate.json", "application/json"),
  );
  document.querySelector("#room-aggregate-download-csv").addEventListener("click", () =>
    downloadFile(rankingResultToCsv(roomAggregateBundle), "delib-power-ranker-room-aggregate.csv", "text/csv"),
  );
  document.querySelector("#room-aggregate-download-portable").addEventListener("click", () =>
    downloadFile(rankingBundleToDelibData(roomAggregateBundle), "delib-power-ranker-room-delib-data.json", "application/json"),
  );
  document.querySelector("#ranking-receipt-form").addEventListener("submit", prepareReceipt);
  document.querySelector("#ranking-receipt-form").addEventListener("input", invalidatePreparedReceipt);
  document.querySelector("#ranking-receipt-form").addEventListener("change", invalidatePreparedReceipt);
  document.querySelector("#ranking-receipt-copy-link").addEventListener("click", copyReceiptLink);
  document.querySelector("#ranking-receipt-download-json").addEventListener("click", () =>
    downloadFile(
      currentReceipt,
      "delib-power-ranker-receipt.json",
      "application/json",
      document.querySelector("#receipt-builder-status"),
    ),
  );
  document.querySelector("#ranking-receipt-download-md").addEventListener("click", () =>
    downloadFile(
      currentReceipt ? rankingReceiptToMarkdown(currentReceipt) : null,
      "delib-power-ranker-receipt.md",
      "text/markdown",
      document.querySelector("#receipt-builder-status"),
    ),
  );
}

function startRanking() {
  itemMap = new Map(config.items.map((item) => [item.id, item]));
  targetComparisons = recommendedComparisonCount(config.items.length);
  title.textContent = config.title;
  document.title = `${config.title} · Power Ranker · Delib`;
  panel.hidden = false;
  renderQuestion();
}

async function loadRoom() {
  if (!/^[a-f0-9]{64}$/.test(roomId)) {
    showLoadError("找不到這個收件室。", "公開連結不完整，請向主辦者索取新的參與連結。");
    return;
  }
  try {
    const snapshot = await roomRequest();
    config = normalizeRankingConfig(snapshot.question);
    if (!config) throw new Error("收件室的題目格式不完整");
    document.querySelector("#ranking-kicker").textContent = adminToken
      ? "短期收件室 · 主辦者"
      : "短期收件室 · 參與者";
    document.querySelector("#ranking-trust-heading").textContent = "短期彙整";
    document.querySelector("#ranking-trust-copy").textContent =
      "送出時，逐題判斷只用來立即增加成對計數；Delib 不保存可逐份還原的原始判斷。";
    document.querySelector("#ranking-trust-detail").textContent =
      "伺服器保存公開題目、彙整計數與隨機 session ID 的 SHA-256 雜湊；到期或主辦者提前刪除時一併清除。";
    document.querySelector("#ranking-room-summary").hidden = false;
    document.querySelector("#room-aggregate-panel").hidden = false;
    document.querySelector("#local-aggregate-panel").hidden = true;
    document.querySelector("#ranking-room-consent-row").hidden = false;
    document.querySelector("#ranking-admin-controls").hidden = !snapshot.admin;
    startRanking();
    if (adminToken) await loadRoomSnapshot();
    else renderRoomSnapshot(snapshot);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "收件室暫時無法讀取";
    showLoadError(message, adminToken ? "私人管理連結可能不正確或已經到期。" : "這個收件室可能已到期或由主辦者提前刪除。");
  }
}

async function loadRoomSnapshot() {
  const button = document.querySelector("#ranking-room-refresh");
  button.disabled = true;
  try {
    renderRoomSnapshot(await roomRequest());
  } catch (reason) {
    document.querySelector("#room-aggregate-status").textContent =
      reason instanceof Error ? reason.message : "暫時無法更新群體結果。";
  } finally {
    button.disabled = false;
  }
}

function renderQuestion() {
  currentPair = selectNextPair(config.items, judgments);
  if (!currentPair || judgments.length >= targetComparisons) {
    finishRanking();
    return;
  }

  finished = false;
  question.hidden = false;
  result.hidden = true;
  const reverse = judgments.length % 2 === 1;
  const leftId = reverse ? currentPair.beta : currentPair.alpha;
  const rightId = reverse ? currentPair.alpha : currentPair.beta;
  leftButton.dataset.itemId = leftId;
  rightButton.dataset.itemId = rightId;
  leftButton.textContent = itemMap.get(leftId).label;
  rightButton.textContent = itemMap.get(rightId).label;
  undoButton.disabled = judgments.length === 0;
  finishButton.hidden = judgments.length < config.items.length - 1;
  progressText.textContent = `已完成 ${judgments.length} 組；建議比較 ${targetComparisons} 組。`;
  progressBar.style.width = `${Math.min(100, (judgments.length / targetComparisons) * 100)}%`;
  status.textContent = "選擇目前較應優先的項目；無法區分時可以選一樣重要。";
  leftButton.focus();
}

function choose(selected) {
  if (!currentPair || finished || submitted) return;
  const choice = selected === "equal" ? "equal" : selected === currentPair.alpha ? "alpha" : "beta";
  judgments.push({ ...currentPair, choice, order: judgments.length + 1 });
  renderQuestion();
}

function undoJudgment() {
  if (!judgments.length || submitted) return;
  judgments.pop();
  actionStatus.textContent = "已回到上一組比較。";
  renderQuestion();
}

function finishRanking() {
  if (judgments.length < config.items.length - 1) return;
  finished = true;
  question.hidden = true;
  result.hidden = false;
  finishButton.hidden = true;
  currentBundle = buildIndividualRankingBundle({
    config,
    judgments,
    sessionId,
    sourceUrl: publicSourceUrl(),
  });
  renderRankingList(resultList, currentBundle.result);
  document.querySelector("#ranking-continue").hidden = submitted || !selectNextPair(config.items, judgments);
  document.querySelector("#ranking-restart").hidden = submitted;
  document.querySelector("#ranking-submit-room").hidden = !roomId || submitted;
  progressText.textContent = `已用 ${judgments.length} 組比較產生結果；完整配對共有 ${currentBundle.coverage.totalPairs} 組。`;
  progressBar.style.width = `${Math.min(100, (judgments.length / targetComparisons) * 100)}%`;
  status.textContent = roomId
    ? "這份個人結果仍只在目前分頁；勾選說明並送出後，伺服器才會立即合併成計數。"
    : "結果只留在這個分頁；下載後才會形成可交接檔案。";
  result.scrollIntoView({ block: "start" });
}

function continueRanking() {
  if (submitted) return;
  finished = false;
  result.hidden = true;
  renderQuestion();
}

function restartRanking() {
  if (submitted) return;
  judgments = [];
  currentBundle = null;
  sessionId = getSessionId(true);
  actionStatus.textContent = "已清除目前分頁裡的選擇。";
  document.querySelector("#ranking-room-consent").checked = false;
  renderQuestion();
}

async function submitRoom() {
  const consent = document.querySelector("#ranking-room-consent");
  if (!consent.checked) {
    actionStatus.textContent = "送出前請先確認短期保存方式。";
    consent.focus();
    return;
  }
  const button = document.querySelector("#ranking-submit-room");
  button.disabled = true;
  actionStatus.textContent = "正在送出並合併成對計數。";
  try {
    const snapshot = await jsonRequest(
      `/api/integrations/power-ranker/rooms/${roomId}/submissions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, judgments }),
      },
    );
    submitted = true;
    renderRoomSnapshot(snapshot);
    finishRanking();
    actionStatus.textContent = snapshot.duplicate
      ? "這個瀏覽器 session 已經送過，沒有重複計入。"
      : "已合併成去連結化計數；伺服器沒有保存這份逐題判斷。";
  } catch (reason) {
    actionStatus.textContent = reason instanceof Error ? reason.message : "這輪選擇暫時沒有送出。";
    button.disabled = false;
  }
}

async function deleteRoom() {
  const button = document.querySelector("#ranking-delete-room");
  if (!document.querySelector("#ranking-delete-confirm").checked || !adminToken) return;
  button.disabled = true;
  document.querySelector("#room-aggregate-status").textContent = "正在清除收件室。";
  try {
    await jsonRequest(`/api/integrations/power-ranker/rooms/${roomId}`, {
      method: "DELETE",
      headers: { "X-Ranking-Admin": adminToken },
    });
    panel.hidden = true;
    result.hidden = true;
    document.querySelector("#ranking-room-summary").hidden = true;
    document.querySelector("#room-aggregate-result").hidden = true;
    document.querySelector("#ranking-admin-controls").hidden = true;
    document.querySelector("#room-aggregate-status").textContent = "收件室已刪除；題目、session 雜湊與彙整計數都已清除。";
    clearReceiptBuilder();
  } catch (reason) {
    document.querySelector("#room-aggregate-status").textContent =
      reason instanceof Error ? reason.message : "收件室沒有完成刪除。";
    button.disabled = false;
  }
}

function renderRoomSnapshot(snapshot) {
  const sessions = Number(snapshot.sessionsReceived) || 0;
  document.querySelector("#ranking-room-count").textContent = `已收到 ${sessions} 份不重複 session`;
  document.querySelector("#ranking-room-expiry").textContent = `預計於 ${formatDate(snapshot.expiresAt)} 自動清除。`;
  const aggregateStatus = document.querySelector("#room-aggregate-status");
  const aggregateResult = document.querySelector("#room-aggregate-result");
  roomAggregateBundle = null;
  aggregateResult.hidden = true;
  clearReceiptBuilder();

  if (!snapshot.aggregate || sessions === 0) {
    aggregateStatus.textContent = snapshot.admin
      ? "尚未收到結果；管理頁會在第一份送達後顯示彙整。"
      : `至少收到 ${snapshot.resultThreshold || 3} 份才會顯示群體排序。`;
    return;
  }

  roomAggregateBundle = buildAggregateRankingBundleFromPairs({
    config,
    aggregate: snapshot.aggregate,
    sourceUrl: publicSourceUrl(),
    expiresAt: snapshot.expiresAt,
  });
  if (!roomAggregateBundle) {
    aggregateStatus.textContent = "群體計數格式不完整，請稍後再更新。";
    return;
  }
  renderRankingList(document.querySelector("#room-aggregate-result-list"), roomAggregateBundle.result);
  aggregateResult.hidden = false;
  aggregateStatus.textContent = snapshot.admin && sessions < (snapshot.resultThreshold || 3)
    ? `管理者預覽：目前 ${sessions} 份；參與者仍看不到群體排序。`
    : `目前合併 ${sessions} 份、${roomAggregateBundle.aggregate.judgments} 組成對計數。`;
  if (snapshot.admin && sessions >= (snapshot.resultThreshold || 3)) {
    setReceiptSource(roomAggregateBundle, "短期收件室彙整");
  }
}

async function roomRequest() {
  return jsonRequest(`/api/integrations/power-ranker/rooms/${roomId}`, {
    headers: adminToken ? { "X-Ranking-Admin": adminToken } : {},
  });
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("服務回應格式不完整");
  }
  if (!response.ok) throw new Error(data.error || "服務暫時無法回應");
  return data;
}

async function copySummary() {
  const lines = currentBundle.result.map(
    (item) => `${item.rank}. ${item.label} — 模型權重 ${item.score.toFixed(3)}`,
  );
  const summary = `# ${config.title}\n\n${lines.join("\n")}\n\n比較 ${judgments.length}/${currentBundle.coverage.totalPairs} 組。模型權重不是支持率或共識證明。`;
  try {
    await navigator.clipboard.writeText(summary);
    actionStatus.textContent = "成果摘要已複製。";
  } catch {
    actionStatus.textContent = "瀏覽器沒有允許複製；請改下載 CSV。";
  }
}

async function aggregateFiles(event) {
  const files = [...event.target.files].slice(0, 100);
  const aggregateStatus = document.querySelector("#aggregate-status");
  const aggregateResult = document.querySelector("#aggregate-result");
  aggregateResult.hidden = true;
  aggregateBundle = null;
  clearReceiptBuilder();
  if (!files.length) {
    aggregateStatus.textContent = "尚未選取檔案。";
    return;
  }

  const bundles = [];
  let unreadable = 0;
  for (const file of files) {
    if (file.size > 250_000) {
      unreadable += 1;
      continue;
    }
    try {
      bundles.push(JSON.parse(await file.text()));
    } catch {
      unreadable += 1;
    }
  }
  const outcome = aggregateRankingBundles(bundles, location.href);
  const rejected = outcome.rejected + unreadable;
  if (!outcome.bundle) {
    aggregateStatus.textContent = `沒有可彙整的同題結果；${rejected} 份格式、題目或內容不符。`;
    return;
  }

  if (
    outcome.bundle.question.title !== config.title ||
    outcome.bundle.question.items.some((item, index) => item.label !== config.items[index]?.label)
  ) {
    aggregateStatus.textContent = "選取的檔案不是這一題，沒有進行彙整。";
    return;
  }

  aggregateBundle = outcome.bundle;
  renderRankingList(document.querySelector("#aggregate-result-list"), aggregateBundle.result);
  aggregateResult.hidden = false;
  aggregateStatus.textContent = `已在本機彙整 ${outcome.accepted} 份；排除 ${outcome.duplicates} 份重複 session、${rejected} 份無效或不同題檔案。`;
  if (aggregateBundle.aggregate.sessions >= 3) {
    setReceiptSource(aggregateBundle, "瀏覽器本機彙整");
  } else {
    aggregateStatus.textContent += " 至少需要 3 份不重複 session，才能準備公開成果收據。";
  }
}

function setReceiptSource(bundle, label) {
  receiptSourceBundle = bundle;
  currentReceipt = null;
  currentReceiptUrl = "";
  const builder = document.querySelector("#ranking-receipt-builder");
  const summary = document.querySelector("#receipt-source-summary");
  const resultPanel = document.querySelector("#ranking-receipt-result");
  const sessions = bundle.aggregate.sessions;
  const judgments = bundle.aggregate.judgments;
  const coverage = bundle.coverage;
  const heading = document.createElement("strong");
  const copy = document.createElement("span");
  heading.textContent = `${label} · ${bundle.question.title}`;
  copy.textContent = `${sessions} 份不重複 session、${judgments} 組成對判斷；比較涵蓋 ${coverage.comparedPairs}/${coverage.totalPairs} 組。`;
  summary.replaceChildren(heading, copy);
  resultPanel.hidden = true;
  document.querySelector("#receipt-confirm").checked = false;
  document.querySelector("#receipt-builder-status").textContent = "";
  builder.hidden = false;
}

function clearReceiptBuilder() {
  receiptSourceBundle = null;
  currentReceipt = null;
  currentReceiptUrl = "";
  document.querySelector("#ranking-receipt-builder").hidden = true;
  document.querySelector("#ranking-receipt-result").hidden = true;
}

function prepareReceipt(event) {
  event.preventDefault();
  const status = document.querySelector("#receipt-builder-status");
  const consent = document.querySelector("#receipt-confirm");
  if (!receiptSourceBundle) {
    status.textContent = "請先產生一份群體彙整結果。";
    return;
  }
  if (!consent.checked) {
    status.textContent = "公開前請先確認資料邊界與回覆責任。";
    consent.focus();
    return;
  }

  try {
    currentReceipt = createRankingReceipt({
      aggregateBundle: receiptSourceBundle,
      aggregateUrl: publicSourceUrl(),
      organizer: {
        interpretation: document.querySelector("#receipt-interpretation").value,
        missingVoices: document.querySelector("#receipt-missing-voices").value,
        decisionStatus: document.querySelector("#receipt-decision-status").value,
        authority: document.querySelector("#receipt-authority").value,
        responsibleActor: document.querySelector("#receipt-responsible-actor").value,
        responseBy: document.querySelector("#receipt-response-by").value,
        nextAction: document.querySelector("#receipt-next-action").value,
        evidenceUrl: document.querySelector("#receipt-evidence-url").value,
      },
    });
    currentReceiptUrl = rankingReceiptUrl(currentReceipt, location.origin);
    document.querySelector("#ranking-receipt-preview").href = currentReceiptUrl;
    document.querySelector("#ranking-receipt-result").hidden = false;
    status.textContent =
      currentReceiptUrl.length > 12_000
        ? "成果已產生。這份連結較長，請同時下載 JSON，避免通訊軟體截斷網址。"
        : "成果已在瀏覽器中產生；先預覽校對，再決定是否分享。";
    document.querySelector("#ranking-receipt-result").scrollIntoView({ block: "start" });
  } catch (reason) {
    currentReceipt = null;
    currentReceiptUrl = "";
    document.querySelector("#ranking-receipt-result").hidden = true;
    status.textContent = reason instanceof Error ? reason.message : "成果收據暫時無法產生。";
  }
}

async function copyReceiptLink() {
  const status = document.querySelector("#receipt-builder-status");
  if (!currentReceiptUrl) return;
  try {
    await navigator.clipboard.writeText(currentReceiptUrl);
    status.textContent = "公開成果連結已複製；連結內含彙整資料與主辦者說明，請視為公開內容。";
  } catch {
    status.textContent = "瀏覽器沒有允許複製；請打開預覽後從網址列複製。";
  }
}

function invalidatePreparedReceipt(event) {
  if (!currentReceipt || event.target?.id === "receipt-confirm") return;
  currentReceipt = null;
  currentReceiptUrl = "";
  document.querySelector("#ranking-receipt-result").hidden = true;
  document.querySelector("#receipt-confirm").checked = false;
  document.querySelector("#receipt-builder-status").textContent =
    "內容已變更；請重新確認後再產生新的成果連結。";
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

function downloadFile(value, filename, type, statusRoot = actionStatus) {
  if (!value) return;
  const content = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  statusRoot.textContent = `已下載 ${filename}。`;
}

function publicSourceUrl() {
  if (!roomId) return location.href;
  const url = new URL(location.href);
  url.hash = "";
  return url.toString();
}

function getSessionId(reset = false) {
  if (!roomId) return crypto.randomUUID();
  const key = `delib:power-ranker-room:${roomId}`;
  const existing = reset ? "" : storageGet(key) || "";
  if (/^[A-Za-z0-9_-]{8,80}$/.test(existing)) return existing;
  const next = crypto.randomUUID();
  storageSet(key, next);
  return next;
}

function formatDate(value) {
  return formatDateTime(value);
}

function showLoadError(statusText, detail) {
  error.hidden = false;
  error.textContent = detail;
  status.textContent = statusText;
}
