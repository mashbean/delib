// Browser-native port of PowerRanker's rankCentrality path.
// Upstream: https://github.com/zaratanDotWorld/powerRanker/tree/4cc4f604022d0188bde1619fc47f05678c0bc0ad
// Copyright (c) 2024 Kronosapiens Labs, used under the MIT License.

export const RANKING_SCHEMA = "https://delib.mashbean.net/schemas/delib-ranking/v1.json";
export const POWER_RANKER_SOURCE =
  "https://github.com/zaratanDotWorld/powerRanker/tree/4cc4f604022d0188bde1619fc47f05678c0bc0ad";

const VALID_CHOICES = new Set(["alpha", "beta", "equal"]);

export function normalizeRankingConfig(value) {
  const title = cleanLine(value?.title, 120);
  const labels = Array.isArray(value?.items)
    ? value.items.map((item) => cleanLine(item?.label ?? item, 80)).filter(Boolean)
    : [];
  if (!title || labels.length < 3 || labels.length > 10) return null;

  const uniqueLabels = new Set(labels.map((label) => label.toLocaleLowerCase("zh-Hant")));
  if (uniqueLabels.size !== labels.length) return null;

  return {
    title,
    items: labels.map((label, index) => ({ id: `item-${index + 1}`, label })),
  };
}

export function rankingConfigToHash(config) {
  const normalized = normalizeRankingConfig(config);
  if (!normalized) throw new Error("invalid ranking config");
  const params = new URLSearchParams({ title: normalized.title });
  for (const item of normalized.items) params.append("item", item.label);
  return params.toString();
}

export function rankingConfigFromHash(hash) {
  const params = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  return normalizeRankingConfig({ title: params.get("title"), items: params.getAll("item") });
}

export function pairKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function recommendedComparisonCount(itemCount) {
  const total = (itemCount * (itemCount - 1)) / 2;
  return Math.min(total, Math.max(itemCount - 1, Math.ceil(itemCount * 1.75)));
}

export function rankJudgments(items, judgments) {
  const normalizedItems = normalizeItems(items);
  if (normalizedItems.length < 2) throw new Error("at least two items are required");

  const indices = new Map(normalizedItems.map((item, index) => [item.id, index]));
  const matrix = Array.from({ length: normalizedItems.length }, () =>
    Array(normalizedItems.length).fill(0),
  );
  const observations = Object.fromEntries(normalizedItems.map((item) => [item.id, 0]));
  const accepted = [];

  for (const raw of Array.isArray(judgments) ? judgments : []) {
    const judgment = normalizeJudgment(raw, indices);
    if (!judgment) continue;
    const alphaIndex = indices.get(judgment.alpha);
    const betaIndex = indices.get(judgment.beta);
    const alphaValue = judgment.choice === "alpha" ? 1 : judgment.choice === "equal" ? 0.5 : 0;
    matrix[betaIndex][alphaIndex] += alphaValue;
    matrix[alphaIndex][betaIndex] += 1 - alphaValue;
    observations[judgment.alpha] += 1;
    observations[judgment.beta] += 1;
    accepted.push(judgment);
  }

  const scores = rankCentrality(matrix);
  return normalizedItems
    .map((item, index) => ({
      id: item.id,
      label: item.label,
      score: scores[index],
      observations: observations[item.id],
    }))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "zh-Hant"))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

export function selectNextPair(items, judgments) {
  const normalizedItems = normalizeItems(items);
  const accepted = normalizeJudgments(normalizedItems, judgments);
  const compared = new Set(accepted.map((judgment) => pairKey(judgment.alpha, judgment.beta)));

  // The first pass is a connected chain so every option reaches the same graph.
  for (let index = 0; index < normalizedItems.length - 1; index += 1) {
    const alpha = normalizedItems[index].id;
    const beta = normalizedItems[index + 1].id;
    if (!compared.has(pairKey(alpha, beta))) return { alpha, beta };
  }

  const result = rankJudgments(normalizedItems, accepted);
  const position = Object.fromEntries(result.map((item) => [item.id, item.rank]));
  const observations = Object.fromEntries(result.map((item) => [item.id, item.observations]));
  const candidates = [];

  for (let i = 0; i < normalizedItems.length; i += 1) {
    for (let j = i + 1; j < normalizedItems.length; j += 1) {
      const alpha = normalizedItems[i].id;
      const beta = normalizedItems[j].id;
      const key = pairKey(alpha, beta);
      if (compared.has(key)) continue;
      const coverage =
        (1 / Math.sqrt(1 + observations[alpha])) *
        (1 / Math.sqrt(1 + observations[beta]));
      const proximity = 1 / (1 + Math.abs(position[alpha] - position[beta]));
      candidates.push({ alpha, beta, key, weight: coverage * proximity });
    }
  }

  candidates.sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key));
  return candidates[0] ? { alpha: candidates[0].alpha, beta: candidates[0].beta } : null;
}

export function buildIndividualRankingBundle({ config, judgments, sessionId, sourceUrl, exportedAt }) {
  const normalized = normalizeRankingConfig(config);
  if (!normalized) throw new Error("invalid ranking config");
  const accepted = normalizeJudgments(normalized.items, judgments);
  return {
    schema: RANKING_SCHEMA,
    kind: "individual",
    exportedAt: exportedAt || new Date().toISOString(),
    source: sourceRecord(sourceUrl),
    question: normalized,
    session: {
      id: cleanSessionId(sessionId) || crypto.randomUUID(),
      judgments: accepted.length,
    },
    method: methodRecord(),
    judgments: accepted,
    result: rankJudgments(normalized.items, accepted),
    coverage: coverageRecord(normalized.items.length, accepted.length),
    dataCard: {
      containsParticipantData: true,
      containsDirectIdentifiers: false,
      containsFreeText: false,
      aggregation: "one-browser-session",
      publicationStatus: "local-export-only",
      storedByDelib: false,
      limitations: rankingLimitations(),
    },
  };
}

export function aggregateRankingBundles(bundles, sourceUrl, exportedAt) {
  const acceptedBundles = [];
  const seenSessions = new Set();
  let config = null;
  let rejected = 0;
  let duplicates = 0;

  for (const candidate of Array.isArray(bundles) ? bundles.slice(0, 100) : []) {
    const parsed = normalizeIndividualBundle(candidate);
    if (!parsed) {
      rejected += 1;
      continue;
    }
    if (!config) config = parsed.question;
    if (!sameQuestion(config, parsed.question)) {
      rejected += 1;
      continue;
    }
    if (seenSessions.has(parsed.session.id)) {
      duplicates += 1;
      continue;
    }
    seenSessions.add(parsed.session.id);
    acceptedBundles.push(parsed);
  }

  if (!config || acceptedBundles.length === 0) {
    return { bundle: null, accepted: 0, rejected, duplicates };
  }

  const judgments = acceptedBundles.flatMap((bundle) => bundle.judgments);
  const bundle = {
    schema: RANKING_SCHEMA,
    kind: "aggregate",
    exportedAt: exportedAt || new Date().toISOString(),
    source: sourceRecord(sourceUrl),
    question: config,
    method: methodRecord(),
    aggregate: {
      sessions: acceptedBundles.length,
      judgments: judgments.length,
      pairwise: summarizePairs(config.items, judgments),
    },
    result: rankJudgments(config.items, judgments),
    coverage: coverageRecord(config.items.length, new Set(judgments.map((item) => pairKey(item.alpha, item.beta))).size),
    dataCard: {
      containsParticipantData: true,
      containsDirectIdentifiers: false,
      containsFreeText: false,
      aggregation: "pair-counts-without-session-links",
      publicationStatus: "local-aggregate-only",
      storedByDelib: false,
      limitations: rankingLimitations(),
    },
  };
  return { bundle, accepted: acceptedBundles.length, rejected, duplicates };
}

export function buildAggregateRankingBundleFromPairs({
  config,
  aggregate,
  sourceUrl,
  exportedAt,
  expiresAt,
}) {
  const normalized = normalizeRankingConfig(config);
  if (!normalized || !aggregate || typeof aggregate !== "object") return null;
  const pairwise = normalizePairwise(normalized.items, aggregate.pairwise);
  const sessions = boundedInteger(aggregate.sessions, 0, 300);
  if (sessions === null) return null;
  const judgments = [];
  for (const pair of pairwise) {
    for (let index = 0; index < pair.alphaWins; index += 1) {
      judgments.push({ alpha: pair.alpha, beta: pair.beta, choice: "alpha" });
    }
    for (let index = 0; index < pair.betaWins; index += 1) {
      judgments.push({ alpha: pair.alpha, beta: pair.beta, choice: "beta" });
    }
    for (let index = 0; index < pair.equal; index += 1) {
      judgments.push({ alpha: pair.alpha, beta: pair.beta, choice: "equal" });
    }
  }
  return {
    schema: RANKING_SCHEMA,
    kind: "aggregate",
    exportedAt: exportedAt || new Date().toISOString(),
    source: { ...sourceRecord(sourceUrl), persisted: true },
    question: normalized,
    method: methodRecord(),
    aggregate: {
      sessions,
      judgments: judgments.length,
      pairwise: pairwise.map((pair) => ({ ...pair, total: pair.alphaWins + pair.betaWins + pair.equal })),
    },
    result: rankJudgments(normalized.items, judgments),
    coverage: coverageRecord(normalized.items.length, pairwise.filter((pair) => pair.alphaWins + pair.betaWins + pair.equal > 0).length),
    dataCard: {
      containsParticipantData: true,
      containsDirectIdentifiers: false,
      containsFreeText: false,
      aggregation: "pair-counts-without-session-links",
      publicationStatus: "ephemeral-room-aggregate",
      storedByDelib: true,
      expiresAt: typeof expiresAt === "number" ? new Date(expiresAt).toISOString() : null,
      limitations: rankingLimitations(),
    },
  };
}

export function rankingResultToCsv(bundle) {
  const rows = [["rank", "item_id", "item", "model_score", "observations"]];
  for (const item of bundle?.result || []) {
    rows.push([item.rank, item.id, item.label, Number(item.score).toFixed(6), item.observations]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function rankCentrality(matrix) {
  const size = matrix.length;
  const degree = Array(size).fill(0);
  for (let i = 0; i < size; i += 1) {
    for (let j = i + 1; j < size; j += 1) {
      if (matrix[i][j] + matrix[j][i] > 0) {
        degree[i] += 1;
        degree[j] += 1;
      }
    }
  }
  const maxDegree = Math.max(...degree);
  if (maxDegree === 0) return Array(size).fill(1 / size);

  const transition = Array.from({ length: size }, () => Array(size).fill(0));
  for (let i = 0; i < size; i += 1) {
    for (let j = i + 1; j < size; j += 1) {
      const total = matrix[i][j] + matrix[j][i];
      if (total > 0) {
        transition[i][j] = matrix[i][j] / total / maxDegree;
        transition[j][i] = matrix[j][i] / total / maxDegree;
      }
    }
  }
  for (let i = 0; i < size; i += 1) {
    transition[i][i] = 1 - transition[i].reduce((sum, value, j) => sum + (i === j ? 0 : value), 0);
  }

  let previous = Array(size).fill(1 / size);
  for (let iteration = 0; iteration < 1_000; iteration += 1) {
    const next = Array(size).fill(0);
    for (let i = 0; i < size; i += 1) {
      for (let j = 0; j < size; j += 1) next[j] += previous[i] * transition[i][j];
    }
    const distance = Math.sqrt(next.reduce((sum, value, index) => sum + (value - previous[index]) ** 2, 0));
    previous = next;
    if (distance < 0.001) break;
  }
  const total = previous.reduce((sum, value) => sum + value, 0);
  return total > 0 ? previous.map((value) => value / total) : Array(size).fill(1 / size);
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const result = [];
  for (const [index, item] of items.entries()) {
    const id = cleanId(item?.id) || `item-${index + 1}`;
    const label = cleanLine(item?.label ?? item, 80);
    if (!label || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, label });
  }
  return result;
}

function normalizeJudgments(items, judgments) {
  const indices = new Map(normalizeItems(items).map((item, index) => [item.id, index]));
  const seenPairs = new Set();
  const result = [];
  for (const raw of Array.isArray(judgments) ? judgments.slice(0, 45) : []) {
    const judgment = normalizeJudgment(raw, indices);
    if (!judgment) continue;
    const key = pairKey(judgment.alpha, judgment.beta);
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    result.push({ ...judgment, order: result.length + 1 });
  }
  return result;
}

function normalizeJudgment(raw, indices) {
  if (!raw || typeof raw !== "object") return null;
  let alpha = cleanId(raw.alpha);
  let beta = cleanId(raw.beta);
  let choice = typeof raw.choice === "string" ? raw.choice : "";
  if (!alpha || !beta || alpha === beta || !indices.has(alpha) || !indices.has(beta) || !VALID_CHOICES.has(choice)) {
    return null;
  }
  if (indices.get(alpha) > indices.get(beta)) {
    [alpha, beta] = [beta, alpha];
    if (choice === "alpha") choice = "beta";
    else if (choice === "beta") choice = "alpha";
  }
  return { alpha, beta, choice };
}

function normalizeIndividualBundle(value) {
  if (!value || typeof value !== "object" || value.schema !== RANKING_SCHEMA || value.kind !== "individual") {
    return null;
  }
  const question = normalizeRankingConfig(value.question);
  const sessionId = cleanSessionId(value.session?.id);
  if (!question || !sessionId) return null;
  const judgments = normalizeJudgments(question.items, value.judgments);
  if (judgments.length < question.items.length - 1) return null;
  return { question, session: { id: sessionId }, judgments };
}

function normalizePairwise(items, value) {
  if (!Array.isArray(value)) return [];
  const positions = new Map(normalizeItems(items).map((item, index) => [item.id, index]));
  const seen = new Set();
  const result = [];
  for (const raw of value.slice(0, 45)) {
    if (!raw || typeof raw !== "object") continue;
    let alpha = cleanId(raw.alpha);
    let beta = cleanId(raw.beta);
    let alphaWins = boundedInteger(raw.alphaWins, 0, 300);
    let betaWins = boundedInteger(raw.betaWins, 0, 300);
    const equal = boundedInteger(raw.equal, 0, 300);
    if (!alpha || !beta || alpha === beta || !positions.has(alpha) || !positions.has(beta)) continue;
    if (alphaWins === null || betaWins === null || equal === null) continue;
    if (positions.get(alpha) > positions.get(beta)) {
      [alpha, beta] = [beta, alpha];
      [alphaWins, betaWins] = [betaWins, alphaWins];
    }
    const key = pairKey(alpha, beta);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ alpha, beta, alphaWins, betaWins, equal });
  }
  return result;
}

function summarizePairs(items, judgments) {
  const labels = Object.fromEntries(normalizeItems(items).map((item) => [item.id, item.label]));
  const pairs = new Map();
  for (const judgment of judgments) {
    const key = pairKey(judgment.alpha, judgment.beta);
    const entry = pairs.get(key) || {
      alpha: judgment.alpha,
      alphaLabel: labels[judgment.alpha],
      beta: judgment.beta,
      betaLabel: labels[judgment.beta],
      alphaWins: 0,
      betaWins: 0,
      equal: 0,
    };
    entry[judgment.choice === "equal" ? "equal" : judgment.choice === "alpha" ? "alphaWins" : "betaWins"] += 1;
    pairs.set(key, entry);
  }
  return [...pairs.values()].map((entry) => ({
    ...entry,
    total: entry.alphaWins + entry.betaWins + entry.equal,
  }));
}

function coverageRecord(itemCount, comparedPairs) {
  const totalPairs = (itemCount * (itemCount - 1)) / 2;
  return {
    comparedPairs,
    totalPairs,
    ratio: totalPairs ? comparedPairs / totalPairs : 0,
  };
}

function methodRecord() {
  return {
    name: "PowerRanker rankCentrality",
    normalization: "rankCentrality",
    flow: "bidirectional",
    source: POWER_RANKER_SOURCE,
    implementation: "Delib browser-native port",
  };
}

function sourceRecord(sourceUrl) {
  return {
    generator: "Delib · Power Ranker",
    url: String(sourceUrl || "https://delib.mashbean.net/integrations/power-ranker.html"),
    persisted: false,
  };
}

function rankingLimitations() {
  return [
    "模型分數是相對排序權重，不是支持率、預算比例或共識證明。",
    "結果只反映已匯入的成對判斷；招募缺口與未比較配對仍需揭露。",
    "發佈前應由主辦者檢查題目措辭、代表性、平手處理與決策權限。",
  ];
}

function sameQuestion(alpha, beta) {
  return (
    alpha.title === beta.title &&
    alpha.items.length === beta.items.length &&
    alpha.items.every((item, index) => item.id === beta.items[index].id && item.label === beta.items[index].label)
  );
}

function cleanLine(value, max) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length <= max ? cleaned : "";
}

function cleanId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : "";
}

function cleanSessionId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(value) ? value : "";
}

function boundedInteger(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : null;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
