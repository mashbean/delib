import { decisionStatusLabel, normalizeRankingReceipt } from "./ranking-receipt-core.js";

export const RECEIPT_HANDOFF_SCHEMA =
  "https://delib.mashbean.net/schemas/delib-handoff/v1.json";
export const RECEIPT_HANDOFF_STORAGE_KEY = "delib:receipt-handoff";
export const RECEIPT_HANDOFF_TTL_MS = 2 * 60 * 60 * 1_000;

export const RECEIPT_HANDOFF_TARGETS = Object.freeze({
  "call-in": Object.freeze({
    label: "成果回報場 · Call-in",
    hash: "launch-call-in",
    carried: Object.freeze(["活動名稱", "成果狀態與下一步說明"]),
    omitted: "不帶排序計數、個別判斷或管理連結；公開簡報網址仍要由主辦者確認。",
  }),
  harmonica: Object.freeze({
    label: "補訪缺席聲音 · Harmonica",
    hash: "launch-harmonica",
    carried: Object.freeze(["補訪目標", "背景情境", "三個起始問題"]),
    omitted: "不帶排序計數、個別判斷、參與者資料或 API key。",
  }),
  "talk-to-the-city": Object.freeze({
    label: "整理下一輪文字 · TTTC",
    hash: "launch-talk-to-the-city",
    carried: Object.freeze(["分析名稱", "要補充理解的問題"]),
    omitted: "不帶任何 CSV 或原始意見；成果收據不是文字分析資料。",
  }),
  polis: Object.freeze({
    label: "開放新陳述 · Pol.is",
    hash: "launch-polis",
    carried: Object.freeze(["建立新對話模式", "下一輪對話名稱"]),
    omitted: "不帶種子陳述、排序資料、Site ID 或登入資訊。",
  }),
});

export function createReceiptHandoff({ receipt, target, createdAt }) {
  const normalizedReceipt = normalizeRankingReceipt(receipt);
  if (!normalizedReceipt) throw new Error("需要一份有效的成果收據");
  if (!Object.hasOwn(RECEIPT_HANDOFF_TARGETS, target)) {
    throw new Error("這個下一步工具尚未支援成果草稿");
  }

  const created = validDateTime(createdAt) || new Date().toISOString();
  const handoff = {
    schema: RECEIPT_HANDOFF_SCHEMA,
    kind: "receipt-handoff",
    target,
    createdAt: created,
    expiresAt: new Date(Date.parse(created) + RECEIPT_HANDOFF_TTL_MS).toISOString(),
    source: {
      tool: "power-ranker",
      title: normalizedReceipt.question.title,
    },
    draft: buildDraft(normalizedReceipt, target),
    dataCard: {
      containsParticipantDerivedSummary: true,
      containsParticipantRecords: false,
      containsDirectIdentifiers: false,
      containsRawJudgments: false,
      containsSessionIds: false,
      containsCredentials: false,
      storedByDelib: false,
      storage: "same-tab-session",
      externalWriteStatus: "not-started",
      expiresWithinMinutes: RECEIPT_HANDOFF_TTL_MS / 60_000,
    },
  };
  return normalizeReceiptHandoff(handoff, { now: Date.parse(created) });
}

export function normalizeReceiptHandoff(value, { now = Date.now() } = {}) {
  if (
    !value ||
    typeof value !== "object" ||
    value.schema !== RECEIPT_HANDOFF_SCHEMA ||
    value.kind !== "receipt-handoff" ||
    !Object.hasOwn(RECEIPT_HANDOFF_TARGETS, value.target)
  ) {
    return null;
  }

  const createdAt = validDateTime(value.createdAt);
  const expiresAt = validDateTime(value.expiresAt);
  const currentTime = validTime(now);
  const sourceTitle = cleanLine(value.source?.title, 120);
  const draft = normalizeDraft(value.target, value.draft);
  if (!createdAt || !expiresAt || currentTime === null || !sourceTitle || !draft) return null;
  const lifetime = Date.parse(expiresAt) - Date.parse(createdAt);
  if (
    lifetime <= 0 ||
    lifetime > RECEIPT_HANDOFF_TTL_MS ||
    Date.parse(createdAt) > currentTime + 60_000 ||
    Date.parse(expiresAt) <= currentTime
  ) {
    return null;
  }

  return {
    schema: RECEIPT_HANDOFF_SCHEMA,
    kind: "receipt-handoff",
    target: value.target,
    createdAt,
    expiresAt,
    source: { tool: "power-ranker", title: sourceTitle },
    draft,
    dataCard: {
      containsParticipantDerivedSummary: true,
      containsParticipantRecords: false,
      containsDirectIdentifiers: false,
      containsRawJudgments: false,
      containsSessionIds: false,
      containsCredentials: false,
      storedByDelib: false,
      storage: "same-tab-session",
      externalWriteStatus: "not-started",
      expiresWithinMinutes: RECEIPT_HANDOFF_TTL_MS / 60_000,
    },
  };
}

export function receiptHandoffTargetUrl(
  value,
  baseUrl = "https://delib.mashbean.net/",
  { now = Date.now() } = {},
) {
  const handoff = normalizeReceiptHandoff(value, { now });
  if (!handoff) throw new Error("成果草稿已過期或格式不完整");
  const url = new URL("/", baseUrl);
  url.hash = RECEIPT_HANDOFF_TARGETS[handoff.target].hash;
  return url.toString();
}

function buildDraft(receipt, target) {
  const title = receipt.question.title;
  const organizer = receipt.organizer;
  const status = decisionStatusLabel(organizer.decisionStatus);
  if (target === "call-in") {
    return {
      title: limitLine(`${title}：成果回報`, 120),
      description: limitText(
        `目前狀態：${status}。主辦者解讀：${organizer.interpretation}\n下一步由 ${organizer.responsibleActor}：${organizer.nextAction}`,
        500,
      ),
      needsDeckUrl: true,
    };
  }
  if (target === "harmonica") {
    return {
      topic: limitLine(`${title}：補訪`, 120),
      goal: limitText(`理解目前未被充分納入的聲音：${organizer.missingVoices}`, 500),
      context: limitText(
        `目前決策狀態：${status}。\n主辦者解讀：${organizer.interpretation}\n目前提出的下一步：由 ${organizer.responsibleActor} 執行「${organizer.nextAction}」。`,
        1_000,
      ),
      critical: limitText(organizer.missingVoices, 500),
      questions: [
        "你怎麼看目前被排在前面的選項？",
        "這份結果遺漏了哪些經驗、需求或取捨？",
        "主辦者提出的下一步需要怎麼修正，才更能納入你的處境？",
      ],
    };
  }
  if (target === "talk-to-the-city") {
    return {
      title: limitLine(`${title}：下一輪文字意見`, 120),
      description: limitText(
        `延續前一輪排序，這次要補充理解：${organizer.missingVoices}。請只上傳已去識別的原始文字意見；排序成果收據不是 Talk to the City 的分析資料。`,
        500,
      ),
    };
  }
  return {
    mode: "site",
    title: limitLine(`${title}：下一輪意見`, 120),
  };
}

function normalizeDraft(target, value) {
  if (!value || typeof value !== "object") return null;
  if (target === "call-in") {
    const title = cleanLine(value.title, 120);
    const description = cleanText(value.description, 500);
    return title && description && value.needsDeckUrl === true
      ? { title, description, needsDeckUrl: true }
      : null;
  }
  if (target === "harmonica") {
    const topic = cleanLine(value.topic, 120);
    const goal = cleanText(value.goal, 500);
    const context = cleanText(value.context, 1_000);
    const critical = cleanText(value.critical, 500);
    const questions = Array.isArray(value.questions)
      ? value.questions.map((item) => cleanLine(item, 240)).filter(Boolean).slice(0, 8)
      : [];
    return topic && goal && context && critical && questions.length > 0
      ? { topic, goal, context, critical, questions }
      : null;
  }
  if (target === "talk-to-the-city") {
    const title = cleanLine(value.title, 120);
    const description = cleanText(value.description, 500);
    return title && description ? { title, description } : null;
  }
  const title = cleanLine(value.title, 120);
  return value.mode === "site" && title ? { mode: "site", title } : null;
}

function limitLine(value, max) {
  return String(value).trim().replace(/\s+/g, " ").slice(0, max).trim();
}

function limitText(value, max) {
  return String(value)
    .trim()
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, max)
    .trim();
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

function validDateTime(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function validTime(value) {
  const parsed = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
