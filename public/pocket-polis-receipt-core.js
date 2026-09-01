import {
  POCKET_POLIS_DATA_SCHEMA,
  parsePocketPolisReportUrl,
} from "./pocket-polis-data-core.js";

export const POCKET_POLIS_RECEIPT_SCHEMA =
  "https://delib.mashbean.net/schemas/delib-pocket-polis-receipt/v1.json";

export const POCKET_POLIS_DECISION_STATUS_LABELS = Object.freeze({
  listening: "尚在聆聽",
  "under-review": "正在評估",
  adopted: "已採納",
  "partially-adopted": "部分採納",
  "not-adopted": "未採納",
});

const MAX_RECEIPT_BYTES = 18_000;
const MAX_INCLUDED_STATEMENTS = 8;
const MIN_PUBLIC_RESPONSES = 3;

export function createPocketPolisReceipt({ bundle, selectedStatementIds, organizer, preparedAt }) {
  const source = normalizeSourceBundle(bundle);
  if (!source) throw new Error("需要一份有效的 Pocket Polis 本機資料包");
  if (!source.consistency.countMatches) throw new Error("兩份 CSV 的票數不一致，請重新下載後再準備公開成果");
  if (source.summary.participants < MIN_PUBLIC_RESPONSES) {
    throw new Error("公開成果頁至少需要 3 位匿名投票者");
  }

  const ids = normalizeSelectedIds(selectedStatementIds);
  if (!ids) throw new Error("請選擇 1–8 句要公開呈現的已核准陳述");
  const statements = new Map(source.statements.map((statement) => [statement.statementId, statement]));
  const findings = ids.map((statementId) => {
    const statement = statements.get(statementId);
    if (!statement || statement.status !== "approved") {
      throw new Error(`statement_id ${statementId} 不是已核准陳述`);
    }
    const responses = statement.agrees + statement.disagrees + statement.passes;
    if (responses < MIN_PUBLIC_RESPONSES) {
      throw new Error(`statement_id ${statementId} 少於 3 份回應，不適合放入公開成果頁`);
    }
    return {
      statementId,
      text: statement.text,
      isSeed: statement.isSeed,
      agrees: statement.agrees,
      disagrees: statement.disagrees,
      passes: statement.passes,
      responses,
    };
  });

  const normalizedOrganizer = normalizeOrganizer(organizer);
  if (!normalizedOrganizer) {
    throw new Error("請完整填寫解讀、未納入聲音、決策狀態與下一步責任");
  }

  return buildReceipt({
    source,
    findings,
    organizer: normalizedOrganizer,
    preparedAt: validDateTime(preparedAt) || new Date().toISOString(),
  });
}

export function normalizePocketPolisReceipt(value) {
  if (
    !value ||
    typeof value !== "object" ||
    value.schema !== POCKET_POLIS_RECEIPT_SCHEMA ||
    value.kind !== "pocket-polis-receipt"
  ) {
    return null;
  }
  const preparedAt = validDateTime(value.preparedAt);
  const source = normalizeReceiptSource(value.source);
  const organizer = normalizeOrganizer(value.organizer);
  const findings = normalizeFindings(value.findings);
  const scope = normalizeScope(value.scope, findings?.length);
  if (!preparedAt || !source || !organizer || !findings || !scope) return null;
  return buildNormalizedReceipt({ source, findings, organizer, scope, preparedAt });
}

export function pocketPolisReceiptToHash(value) {
  const receipt = normalizePocketPolisReceipt(value);
  if (!receipt) throw new Error("Pocket Polis 成果收據格式不完整");
  const bytes = new TextEncoder().encode(JSON.stringify(receipt));
  if (bytes.byteLength > MAX_RECEIPT_BYTES) {
    throw new Error("成果內容超過分享連結上限，請縮短主辦者說明或減少公開陳述");
  }
  return new URLSearchParams({ receipt: bytesToBase64Url(bytes) }).toString();
}

export function pocketPolisReceiptFromHash(hash) {
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
    return normalizePocketPolisReceipt(JSON.parse(json));
  } catch {
    return null;
  }
}

export function pocketPolisReceiptUrl(value, baseUrl = "https://delib.mashbean.net/") {
  const url = new URL("/results/pocket-polis.html", baseUrl);
  url.hash = pocketPolisReceiptToHash(value);
  return url.toString();
}

export function pocketPolisDecisionStatusLabel(value) {
  return POCKET_POLIS_DECISION_STATUS_LABELS[value] || "狀態未確認";
}

export function pocketPolisReceiptToMarkdown(value) {
  const receipt = normalizePocketPolisReceipt(value);
  if (!receipt) throw new Error("Pocket Polis 成果收據格式不完整");
  const findings = receipt.findings
    .map(
      (item) =>
        `- ${escapeMarkdown(item.text)}（同意 ${item.agrees}／不同意 ${item.disagrees}／略過 ${item.passes}；共 ${item.responses} 份回應）`,
    )
    .join("\n");
  const deadline = receipt.organizer.responseBy || "未設定日期";
  const evidence = receipt.organizer.evidenceUrl
    ? `\n- 公開依據：${receipt.organizer.evidenceUrl}`
    : "";
  return `# ${escapeMarkdown(receipt.source.title)}\n\n` +
    `> Pocket Polis 成果收據 · ${formatDate(receipt.preparedAt)}\n\n` +
    `## 回應概況\n\n${findings}\n\n` +
    `- 匿名投票者：${receipt.scope.participants}\n` +
    `- 逐筆投票：${receipt.scope.totalVotes}\n` +
    `- 已核准陳述：${receipt.scope.approvedStatements}\n` +
    `- 已核准陳述投票涵蓋率：${Math.round(receipt.scope.coverage * 100)}%\n\n` +
    `票數只描述這一輪已收到的回應，不是代表性民調，也不能單獨證明共識。\n\n` +
    `## 主辦者解讀\n\n${receipt.organizer.interpretation}\n\n` +
    `## 未納入與限制\n\n${receipt.organizer.missingVoices}\n\n` +
    `## 決策狀態\n\n- 狀態：${pocketPolisDecisionStatusLabel(receipt.organizer.decisionStatus)}\n` +
    `- 狀態確認者：${receipt.organizer.authority}${evidence}\n\n` +
    `## 下一步\n\n- 負責回應：${receipt.organizer.responsibleActor}\n` +
    `- 預計回應：${deadline}\n` +
    `- 行動：${receipt.organizer.nextAction}\n\n` +
    `---\n此收據由 Delib 在瀏覽器中產生；分享內容位於網址 fragment，Delib 不另存這份收據。`;
}

export function pocketPolisReceiptSummary(value) {
  const receipt = normalizePocketPolisReceipt(value);
  if (!receipt) throw new Error("Pocket Polis 成果收據格式不完整");
  const highlights = receipt.findings
    .slice(0, 3)
    .map((item) => `${item.text}（同意 ${item.agrees}／不同意 ${item.disagrees}）`)
    .join("；");
  return `${receipt.source.title}｜${pocketPolisDecisionStatusLabel(receipt.organizer.decisionStatus)}｜公開回應：${highlights}。下一步由 ${receipt.organizer.responsibleActor}：${receipt.organizer.nextAction}（票數不是代表性民調或共識證明）`;
}

function normalizeSourceBundle(value) {
  if (
    !value ||
    typeof value !== "object" ||
    value.schema !== POCKET_POLIS_DATA_SCHEMA ||
    value.kind !== "pocket-polis-export" ||
    !Array.isArray(value.statements)
  ) {
    return null;
  }
  const countMatches = value.consistency?.countMatches;
  const receiptSource = normalizeReceiptSource({
    tool: "Pocket Polis",
    title: value.source?.title,
    description: value.source?.description,
    conversationId: value.source?.conversationId,
    reportUrl: value.source?.reportUrl,
    sourceExportedAt: value.exportedAt,
    sourceCountMatches: true,
  });
  const participants = nonNegativeInteger(value.summary?.participants);
  const approvedStatements = nonNegativeInteger(value.summary?.approvedStatements);
  const totalVotes = nonNegativeInteger(value.summary?.votes);
  const coverage = boundedNumber(value.summary?.coverage);
  const statements = value.statements.map(normalizeBundleStatement);
  if (
    !receiptSource || typeof countMatches !== "boolean" ||
    participants === null ||
    approvedStatements === null ||
    totalVotes === null ||
    coverage === null ||
    statements.some((statement) => !statement)
  ) {
    return null;
  }
  return {
    ...receiptSource,
    summary: { participants, approvedStatements, totalVotes, coverage },
    consistency: { countMatches },
    statements,
  };
}

function normalizeBundleStatement(value) {
  if (!value || typeof value !== "object") return null;
  const statementId = positiveInteger(value.statementId);
  const text = cleanText(value.text, 280);
  const status = ["approved", "pending", "rejected"].includes(value.status) ? value.status : "";
  const agrees = nonNegativeInteger(value.agrees);
  const disagrees = nonNegativeInteger(value.disagrees);
  const passes = nonNegativeInteger(value.passes);
  if (
    !statementId ||
    !text ||
    !status ||
    typeof value.isSeed !== "boolean" ||
    agrees === null ||
    disagrees === null ||
    passes === null
  ) {
    return null;
  }
  return { statementId, text, status, isSeed: value.isSeed, agrees, disagrees, passes };
}

function normalizeReceiptSource(value) {
  if (!value || typeof value !== "object" || value.tool !== "Pocket Polis") return null;
  const title = cleanLine(value.title, 120);
  const description = cleanOptionalText(value.description, 2_000);
  const report = parsePocketPolisReportUrl(value.reportUrl);
  const conversationId = cleanConversationId(value.conversationId);
  const sourceExportedAt = validDateTime(value.sourceExportedAt);
  if (
    !title ||
    description === null ||
    !report ||
    !conversationId ||
    report.conversationId !== conversationId ||
    !sourceExportedAt ||
    value.sourceCountMatches !== true
  ) {
    return null;
  }
  return {
    tool: "Pocket Polis",
    title,
    description,
    conversationId,
    reportUrl: report.reportUrl,
    sourceExportedAt,
    sourceCountMatches: true,
  };
}

function normalizeScope(value, findingsLength) {
  if (!value || typeof value !== "object") return null;
  const participants = positiveInteger(value.participants);
  const approvedStatements = positiveInteger(value.approvedStatements);
  const totalVotes = positiveInteger(value.totalVotes);
  const coverage = boundedNumber(value.coverage);
  const includedStatements = positiveInteger(value.includedStatements);
  if (
    participants === null || participants < MIN_PUBLIC_RESPONSES ||
    approvedStatements === null || totalVotes === null || coverage === null ||
    includedStatements === null || includedStatements !== findingsLength ||
    includedStatements > approvedStatements
  ) {
    return null;
  }
  return { participants, approvedStatements, totalVotes, coverage, includedStatements };
}

function normalizeFindings(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_INCLUDED_STATEMENTS) return null;
  const ids = new Set();
  const findings = value.map((item) => {
    if (!item || typeof item !== "object") return null;
    const statementId = positiveInteger(item.statementId);
    const text = cleanText(item.text, 280);
    const agrees = nonNegativeInteger(item.agrees);
    const disagrees = nonNegativeInteger(item.disagrees);
    const passes = nonNegativeInteger(item.passes);
    const responses = positiveInteger(item.responses);
    if (
      !statementId || ids.has(statementId) || !text || typeof item.isSeed !== "boolean" ||
      agrees === null || disagrees === null || passes === null || responses === null ||
      responses < MIN_PUBLIC_RESPONSES || responses !== agrees + disagrees + passes
    ) {
      return null;
    }
    ids.add(statementId);
    return { statementId, text, isSeed: item.isSeed, agrees, disagrees, passes, responses };
  });
  return findings.some((finding) => !finding) ? null : findings;
}

function normalizeSelectedIds(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_INCLUDED_STATEMENTS) return null;
  const ids = value.map(positiveInteger);
  return ids.some((id) => id === null) || new Set(ids).size !== ids.length ? null : ids;
}

function normalizeOrganizer(value) {
  if (!value || typeof value !== "object") return null;
  const interpretation = cleanText(value.interpretation, 1_200);
  const missingVoices = cleanText(value.missingVoices, 800);
  const decisionStatus = Object.hasOwn(POCKET_POLIS_DECISION_STATUS_LABELS, value.decisionStatus)
    ? value.decisionStatus
    : "";
  const authority = cleanLine(value.authority, 120);
  const responsibleActor = cleanLine(value.responsibleActor, 120);
  const nextAction = cleanText(value.nextAction, 500);
  const responseBy = cleanDate(value.responseBy);
  const evidenceUrl = cleanOptionalHttpsUrl(value.evidenceUrl);
  if (
    !interpretation || !missingVoices || !decisionStatus || !authority ||
    !responsibleActor || !nextAction || responseBy === null || evidenceUrl === null
  ) {
    return null;
  }
  return { interpretation, missingVoices, decisionStatus, authority, responsibleActor, responseBy, nextAction, evidenceUrl };
}

function buildReceipt({ source, findings, organizer, preparedAt }) {
  return buildNormalizedReceipt({
    source: {
      tool: "Pocket Polis",
      title: source.title,
      description: source.description,
      conversationId: source.conversationId,
      reportUrl: source.reportUrl,
      sourceExportedAt: source.sourceExportedAt,
      sourceCountMatches: true,
    },
    findings,
    organizer,
    preparedAt,
    scope: {
      participants: source.summary.participants,
      approvedStatements: source.summary.approvedStatements,
      totalVotes: source.summary.totalVotes,
      coverage: source.summary.coverage,
      includedStatements: findings.length,
    },
  });
}

function buildNormalizedReceipt({ source, findings, organizer, scope, preparedAt }) {
  return {
    schema: POCKET_POLIS_RECEIPT_SCHEMA,
    kind: "pocket-polis-receipt",
    preparedAt,
    source,
    scope,
    findings,
    organizer,
    dataCard: {
      containsParticipantData: true,
      containsDirectIdentifiers: false,
      containsParticipantRecords: false,
      containsParticipantFreeText: true,
      containsPseudonymousLinkage: false,
      containsOrganizerFreeText: true,
      aggregation: "selected-statement-counts",
      publicationStatus: "share-link-prepared",
      storedByDelib: false,
      transport: "url-fragment",
      limitations: [
        "票數只描述這一輪已收到的回應，不是代表性民調，也不能單獨證明共識。",
        "公開陳述由主辦者從已核准且至少有 3 份回應的文字中挑選，選擇本身會影響讀者看見的結果。",
        "Pocket Polis CSV 不含群組分群結果；這張成果頁只呈現逐句彙整票數。",
        "主辦者解讀、決策狀態與下一步是人工聲明，不是由工具推論。",
      ],
    },
  };
}

function cleanLine(value, max) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length > 0 && cleaned.length <= max ? cleaned : "";
}

function cleanText(value, max) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim().replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n");
  return cleaned.length > 0 && cleaned.length <= max ? cleaned : "";
}

function cleanOptionalText(value, max) {
  if (value === "" || value === null || value === undefined) return "";
  return typeof value === "string" && value.length <= max
    ? value.trim().replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ")
    : null;
}

function cleanConversationId(value) {
  return typeof value === "string" && /^[a-z0-9]{10}$/.test(value) ? value : "";
}

function cleanDate(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

function cleanOptionalHttpsUrl(value) {
  if (value === "" || value === null || value === undefined) return "";
  if (typeof value !== "string" || value.length > 2_000) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function validDateTime(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function boundedNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
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
