export const DELIB_FEEDBACK_SCHEMA = "https://delib.mashbean.net/schemas/delib-feedback/v1.json";

const ROLES = new Set(["organizer", "participant", "developer", "operator", "researcher"]);
const PHASES = new Set([
  "recommendation",
  "deployment",
  "participation",
  "import",
  "export",
  "analysis",
  "result",
  "handoff",
  "agent",
  "accessibility",
]);
const CATEGORIES = new Set([
  "schema-gap",
  "integration-failure",
  "deployment-friction",
  "privacy-boundary",
  "accessibility",
  "usability",
  "outcome-loop",
  "other",
]);
const SEVERITIES = new Set(["blocked", "degraded", "confusing", "idea"]);

export function createFeedbackRecord(value, createdAt = new Date().toISOString()) {
  const role = enumValue(value?.role, ROLES);
  const phase = enumValue(value?.phase, PHASES);
  const category = enumValue(value?.category, CATEGORIES);
  const severity = enumValue(value?.severity, SEVERITIES);
  const tool = cleanLine(value?.tool, 120, false);
  const summary = cleanLine(value?.summary, 160, true);
  const expected = cleanText(value?.expected, 1_500, true);
  const actual = cleanText(value?.actual, 1_500, true);
  const reproduction = cleanText(value?.reproduction, 2_000, true);
  const workaround = cleanText(value?.workaround, 1_000, false);
  const environment = cleanText(value?.environment, 500, false);
  const publicUrl = cleanPublicUrl(value?.publicUrl);
  if (!role || !phase || !category || !severity || !summary || !expected || !actual || !reproduction) {
    throw new Error("請完整填寫角色、階段、問題類型、影響與重現資訊");
  }
  if (publicUrl === null) throw new Error("成果網址必須是 HTTPS，而且不能包含 # 私人片段");
  if (value?.confirmed !== true) throw new Error("送出前請先確認沒有參與內容、個資或私人權杖");
  return {
    schema: DELIB_FEEDBACK_SCHEMA,
    kind: "interop-feedback",
    createdAt: new Date(createdAt).toISOString(),
    context: { role, phase, tool, publicUrl },
    issue: { category, severity, summary, expected, actual, reproduction, workaround, environment },
    dataCard: {
      containsParticipantContent: false,
      containsDirectIdentifiers: false,
      containsCredentials: false,
      submittedAutomatically: false,
      destination: "user-selected-download-or-github-issue",
    },
  };
}

export function feedbackToMarkdown(record) {
  if (record?.schema !== DELIB_FEEDBACK_SCHEMA || record?.kind !== "interop-feedback") {
    throw new Error("回饋格式不完整");
  }
  const context = record.context;
  const issue = record.issue;
  return `## 發生在哪裡\n\n` +
    `- 角色：${context.role}\n` +
    `- 階段：${context.phase}\n` +
    `- 工具／整合：${context.tool || "未指定"}\n` +
    `- 類型：${issue.category}\n` +
    `- 影響：${issue.severity}\n` +
    `${context.publicUrl ? `- 公開成果網址：${context.publicUrl}\n` : ""}` +
    `\n## 預期行為\n\n${issue.expected}\n` +
    `\n## 實際行為\n\n${issue.actual}\n` +
    `\n## 如何重現\n\n${issue.reproduction}\n` +
    `${issue.workaround ? `\n## 暫時補救\n\n${issue.workaround}\n` : ""}` +
    `${issue.environment ? `\n## 環境\n\n${issue.environment}\n` : ""}` +
    `\n---\n` +
    `資料聲明：這份回饋不含參與內容、直接識別資訊、API key、管理 token 或含權限的網址；由使用者預覽後明確送出。`;
}

export function feedbackGitHubUrl(record) {
  const url = new URL("https://github.com/mashbean/delib/issues/new");
  url.searchParams.set("title", `[Interop] ${record.issue.summary}`);
  url.searchParams.set("body", feedbackToMarkdown(record));
  url.searchParams.set("labels", `interop-feedback,${record.issue.category}`);
  return url.toString();
}

function enumValue(value, allowed) {
  return typeof value === "string" && allowed.has(value) ? value : "";
}

function cleanLine(value, max, required) {
  const cleaned = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (cleaned.length > max || (required && !cleaned)) return "";
  return cleaned;
}

function cleanText(value, max, required) {
  const cleaned = typeof value === "string"
    ? value.trim().replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n")
    : "";
  if (cleaned.length > max || (required && !cleaned)) return "";
  return cleaned;
}

function cleanPublicUrl(value) {
  if (value === "" || value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > 2_000) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
    return url.toString();
  } catch {
    return null;
  }
}
