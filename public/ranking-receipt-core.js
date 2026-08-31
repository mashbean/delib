import {
  buildAggregateRankingBundleFromPairs,
  normalizeRankingConfig,
  rankingConfigToHash,
} from "./power-ranker-core.js";

export const RANKING_RECEIPT_SCHEMA =
  "https://delib.mashbean.net/schemas/delib-ranking-receipt/v1.json";

export const DECISION_STATUS_LABELS = Object.freeze({
  listening: "尚在聆聽",
  "under-review": "正在評估",
  adopted: "已採納",
  "partially-adopted": "部分採納",
  "not-adopted": "未採納",
});

const MAX_RECEIPT_BYTES = 14_000;
const VALID_STORAGE = new Set(["local", "ephemeral-room"]);

export function createRankingReceipt({ aggregateBundle, organizer, preparedAt, aggregateUrl }) {
  const question = normalizeRankingConfig(aggregateBundle?.question);
  if (!question || aggregateBundle?.kind !== "aggregate") {
    throw new Error("需要一份有效的群體彙整結果");
  }

  const sourceUrl = cleanPublicUrl(aggregateUrl || aggregateBundle.source?.url);
  if (!sourceUrl) throw new Error("彙整來源網址不完整");

  const storage = aggregateBundle.dataCard?.storedByDelib === true ? "ephemeral-room" : "local";
  const rebuilt = buildAggregateRankingBundleFromPairs({
    config: question,
    aggregate: aggregateBundle.aggregate,
    sourceUrl,
    exportedAt: validDateTime(aggregateBundle.exportedAt) || undefined,
    expiresAt: dateTimeMilliseconds(aggregateBundle.dataCard?.expiresAt),
  });
  if (!rebuilt || rebuilt.aggregate.sessions < 3 || rebuilt.aggregate.judgments < 1) {
    throw new Error("公開成果收據至少需要 3 份不重複 session");
  }

  const normalizedOrganizer = normalizeOrganizer(organizer);
  if (!normalizedOrganizer) {
    throw new Error("請完整填寫解讀、未納入聲音、決策狀態與下一步責任");
  }

  return buildReceipt({
    rebuilt,
    organizer: normalizedOrganizer,
    storage,
    aggregateUrl: sourceUrl,
    preparedAt: validDateTime(preparedAt) || new Date().toISOString(),
  });
}

export function normalizeRankingReceipt(value) {
  if (
    !value ||
    typeof value !== "object" ||
    value.schema !== RANKING_RECEIPT_SCHEMA ||
    value.kind !== "ranking-receipt"
  ) {
    return null;
  }

  const question = normalizeRankingConfig(value.question);
  const aggregateUrl = cleanPublicUrl(value.source?.aggregateUrl);
  const storage = VALID_STORAGE.has(value.source?.aggregateStorage)
    ? value.source.aggregateStorage
    : null;
  const preparedAt = validDateTime(value.preparedAt);
  const organizer = normalizeOrganizer(value.organizer);
  if (!question || !aggregateUrl || !storage || !preparedAt || !organizer) return null;

  const expiresAt = validDateTime(value.source?.aggregateExpiresAt);
  const rebuilt = buildAggregateRankingBundleFromPairs({
    config: question,
    aggregate: value.aggregate,
    sourceUrl: aggregateUrl,
    exportedAt: preparedAt,
    expiresAt: storage === "ephemeral-room" ? dateTimeMilliseconds(expiresAt) : null,
  });
  if (!rebuilt || rebuilt.aggregate.sessions < 3 || rebuilt.aggregate.judgments < 1) return null;

  return buildReceipt({ rebuilt, organizer, storage, aggregateUrl, preparedAt });
}

export function rankingReceiptToHash(value) {
  const receipt = normalizeRankingReceipt(value);
  if (!receipt) throw new Error("成果收據格式不完整");
  const bytes = new TextEncoder().encode(JSON.stringify(receipt));
  if (bytes.byteLength > MAX_RECEIPT_BYTES) {
    throw new Error("成果內容超過分享連結上限，請改下載 JSON 或縮短主辦者說明");
  }
  return new URLSearchParams({ receipt: bytesToBase64Url(bytes) }).toString();
}

export function rankingReceiptFromHash(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  if (!raw || raw.length > MAX_RECEIPT_BYTES * 2) return null;
  const encoded = new URLSearchParams(raw).get("receipt") || "";
  if (!encoded || encoded.length > MAX_RECEIPT_BYTES * 2 || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    return null;
  }
  try {
    const bytes = base64UrlToBytes(encoded);
    if (bytes.byteLength > MAX_RECEIPT_BYTES) return null;
    const json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return normalizeRankingReceipt(JSON.parse(json));
  } catch {
    return null;
  }
}

export function rankingReceiptUrl(value, baseUrl = "https://delib.mashbean.net/") {
  const url = new URL("/results/power-ranker.html", baseUrl);
  url.hash = rankingReceiptToHash(value);
  return url.toString();
}

export function nextRoundRankingUrl(receipt, baseUrl = "https://delib.mashbean.net/") {
  const normalized = normalizeRankingReceipt(receipt);
  if (!normalized) throw new Error("成果收據格式不完整");
  const url = new URL("/integrations/power-ranker.html", baseUrl);
  url.hash = rankingConfigToHash({
    title: `${normalized.question.title}（下一輪）`.slice(0, 120),
    items: normalized.question.items,
  });
  return url.toString();
}

export function decisionStatusLabel(value) {
  return DECISION_STATUS_LABELS[value] || "狀態未確認";
}

export function rankingReceiptToMarkdown(value) {
  const receipt = normalizeRankingReceipt(value);
  if (!receipt) throw new Error("成果收據格式不完整");
  const ranking = receipt.result
    .map(
      (item) =>
        `${item.rank}. ${escapeMarkdown(item.label)}（模型權重 ${item.score.toFixed(3)}；${item.observations} 次比較）`,
    )
    .join("\n");
  const deadline = receipt.organizer.responseBy || "未設定日期";
  const evidence = receipt.organizer.evidenceUrl
    ? `\n- 公開依據：${receipt.organizer.evidenceUrl}`
    : "";
  return `# ${escapeMarkdown(receipt.question.title)}\n\n` +
    `> Power Ranker 成果收據 · ${formatDate(receipt.preparedAt)}\n\n` +
    `## 工具計算\n\n${ranking}\n\n` +
    `- 不重複 session：${receipt.aggregate.sessions}\n` +
    `- 成對判斷：${receipt.aggregate.judgments}\n` +
    `- 比較涵蓋：${receipt.coverage.comparedPairs}/${receipt.coverage.totalPairs}\n\n` +
    `模型權重是相對排序，不是支持率、預算比例或群體共識。\n\n` +
    `## 主辦者解讀\n\n${receipt.organizer.interpretation}\n\n` +
    `## 未納入與限制\n\n${receipt.organizer.missingVoices}\n\n` +
    `## 決策狀態\n\n- 狀態：${decisionStatusLabel(receipt.organizer.decisionStatus)}\n` +
    `- 狀態確認者：${receipt.organizer.authority}${evidence}\n\n` +
    `## 下一步\n\n- 負責回應：${receipt.organizer.responsibleActor}\n` +
    `- 預計回應：${deadline}\n` +
    `- 行動：${receipt.organizer.nextAction}\n\n` +
    `---\n此收據由 Delib 在瀏覽器中產生；分享內容位於網址 fragment，Delib 不另存這份收據。`;
}

export function rankingReceiptSummary(value) {
  const receipt = normalizeRankingReceipt(value);
  if (!receipt) throw new Error("成果收據格式不完整");
  const top = receipt.result.slice(0, 3).map((item) => `${item.rank}. ${item.label}`).join("、");
  return `${receipt.question.title}｜${decisionStatusLabel(receipt.organizer.decisionStatus)}｜目前排序：${top}。下一步由 ${receipt.organizer.responsibleActor}：${receipt.organizer.nextAction}（模型權重不是支持率或共識）`;
}

function buildReceipt({ rebuilt, organizer, storage, aggregateUrl, preparedAt }) {
  const expiresAt = storage === "ephemeral-room" ? validDateTime(rebuilt.dataCard.expiresAt) : null;
  return {
    schema: RANKING_RECEIPT_SCHEMA,
    kind: "ranking-receipt",
    preparedAt,
    source: {
      generator: "Delib · Power Ranker",
      aggregateStorage: storage,
      aggregateUrl,
      aggregateExpiresAt: expiresAt,
    },
    question: rebuilt.question,
    method: rebuilt.method,
    aggregate: rebuilt.aggregate,
    result: rebuilt.result,
    coverage: rebuilt.coverage,
    organizer,
    dataCard: {
      containsParticipantData: true,
      containsDirectIdentifiers: false,
      containsParticipantFreeText: false,
      containsOrganizerFreeText: true,
      aggregation: "pair-counts-without-session-links",
      publicationStatus: "share-link-prepared",
      storedByDelib: false,
      transport: "url-fragment",
      limitations: [
        "模型分數是相對排序權重，不是支持率、預算比例或共識證明。",
        "成果只反映已納入的成對判斷；招募缺口與未比較配對仍會影響解讀。",
        "主辦者解讀、決策狀態與下一步是人工聲明，不是由排序模型推論。",
      ],
    },
  };
}

function normalizeOrganizer(value) {
  if (!value || typeof value !== "object") return null;
  const interpretation = cleanText(value.interpretation, 1_200);
  const missingVoices = cleanText(value.missingVoices, 800);
  const decisionStatus = Object.hasOwn(DECISION_STATUS_LABELS, value.decisionStatus)
    ? value.decisionStatus
    : "";
  const authority = cleanLine(value.authority, 120);
  const responsibleActor = cleanLine(value.responsibleActor, 120);
  const nextAction = cleanText(value.nextAction, 500);
  const responseBy = cleanDate(value.responseBy);
  const evidenceUrl = cleanOptionalHttpsUrl(value.evidenceUrl);
  if (
    !interpretation ||
    !missingVoices ||
    !decisionStatus ||
    !authority ||
    !responsibleActor ||
    !nextAction ||
    responseBy === null ||
    evidenceUrl === null
  ) {
    return null;
  }
  return {
    interpretation,
    missingVoices,
    decisionStatus,
    authority,
    responsibleActor,
    responseBy,
    nextAction,
    evidenceUrl,
  };
}

function cleanLine(value, max) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length > 0 && cleaned.length <= max ? cleaned : "";
}

function cleanText(value, max) {
  if (typeof value !== "string") return "";
  const cleaned = value
    .trim()
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
  return cleaned.length > 0 && cleaned.length <= max ? cleaned : "";
}

function cleanDate(value) {
  if (value === "" || value === null || value === undefined) return "";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

function validDateTime(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function dateTimeMilliseconds(value) {
  const normalized = validDateTime(value);
  return normalized ? Date.parse(normalized) : undefined;
}

function cleanPublicUrl(value) {
  if (typeof value !== "string" || value.length > 2_000) return null;
  try {
    const url = new URL(value.trim());
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if ((url.protocol !== "https:" && !localHttp) || url.username || url.password) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function cleanOptionalHttpsUrl(value) {
  if (value === "" || value === null || value === undefined) return "";
  if (typeof value !== "string" || value.length > 2_000) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function escapeMarkdown(value) {
  return String(value).replace(/([\\`*_{}\[\]()#+.!|-])/g, "\\$1");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-Hant-TW", { dateStyle: "medium" }).format(new Date(value));
}
