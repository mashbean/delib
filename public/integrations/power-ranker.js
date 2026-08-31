import {
  aggregateRankingBundles,
  buildIndividualRankingBundle,
  rankingConfigFromHash,
  rankingResultToCsv,
  recommendedComparisonCount,
  selectNextPair,
} from "/power-ranker-core.js";

const config = rankingConfigFromHash(location.hash);
const itemMap = new Map((config?.items || []).map((item) => [item.id, item]));
const targetComparisons = config ? recommendedComparisonCount(config.items.length) : 0;
let judgments = [];
let currentPair = null;
let finished = false;
let sessionId = crypto.randomUUID();
let currentBundle = null;
let aggregateBundle = null;

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

if (!config) {
  error.hidden = false;
  status.textContent = "無法讀取排序題目。";
} else {
  title.textContent = config.title;
  document.title = `${config.title} · Power Ranker · Delib`;
  panel.hidden = false;
  bindEvents();
  renderQuestion();
}

function bindEvents() {
  leftButton.addEventListener("click", () => choose(leftButton.dataset.itemId));
  rightButton.addEventListener("click", () => choose(rightButton.dataset.itemId));
  equalButton.addEventListener("click", () => choose("equal"));
  finishButton.addEventListener("click", finishRanking);
  undoButton.addEventListener("click", undoJudgment);
  document.querySelector("#ranking-continue").addEventListener("click", continueRanking);
  document.querySelector("#ranking-restart").addEventListener("click", restartRanking);
  document.querySelector("#ranking-download-json").addEventListener("click", () =>
    downloadFile(currentBundle, "delib-power-ranker-result.json", "application/json"),
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
  if (!currentPair || finished) return;
  const choice =
    selected === "equal" ? "equal" : selected === currentPair.alpha ? "alpha" : "beta";
  judgments.push({ ...currentPair, choice, order: judgments.length + 1 });
  renderQuestion();
}

function undoJudgment() {
  if (!judgments.length) return;
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
    sourceUrl: location.href,
  });
  renderRankingList(resultList, currentBundle.result);
  document.querySelector("#ranking-continue").hidden = !selectNextPair(config.items, judgments);
  progressText.textContent = `已用 ${judgments.length} 組比較產生結果；完整配對共有 ${currentBundle.coverage.totalPairs} 組。`;
  progressBar.style.width = `${Math.min(100, (judgments.length / targetComparisons) * 100)}%`;
  status.textContent = "結果只留在這個分頁；下載後才會形成可交接檔案。";
  result.scrollIntoView({ block: "start" });
}

function continueRanking() {
  finished = false;
  result.hidden = true;
  renderQuestion();
}

function restartRanking() {
  judgments = [];
  currentBundle = null;
  sessionId = crypto.randomUUID();
  actionStatus.textContent = "已清除目前分頁裡的選擇。";
  renderQuestion();
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
  if (!value) return;
  const content = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  actionStatus.textContent = `已下載 ${filename}。`;
}
