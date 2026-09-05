// 已是 Talk to the City 格式（id,interview,comment）的 CSV：在瀏覽器本機檢查、合併多份、重新輸出。
// 來源可能是口袋審議報告頁、Call-in 或工作台自己輸出的 tttc.csv。只處理文字，不碰投票資料。
import { csvTable, formulaSafeCell, parseCsvWithHeaders } from "./pocket-polis-data-core.js";

export const TTTC_HEADERS = Object.freeze(["id", "interview", "comment"]);
const MAX_COMMENT_CHARS = 2_000;
const MAX_INTERVIEW_CHARS = 200;
const MAX_ID_CHARS = 120;
const MAX_FILES = 20;
const MAX_ROWS_TOTAL = 200_000;
const PII_PATTERNS = [
  { name: "email", pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  { name: "phone", pattern: /(?:\+?886|0)9\d{2}[-\s]?\d{3}[-\s]?\d{3}\b/ },
  { name: "id-number", pattern: /\b[A-Z][12]\d{8}\b/ },
];

/** 解析一份 tttc.csv。回傳列與這份檔案的警告；欄位不符會直接丟錯。 */
export function parseTttcCsv({ text, label }) {
  const fileLabel = cleanLabel(label) || "TTTC CSV";
  const records = parseCsvWithHeaders(text, TTTC_HEADERS, fileLabel);
  if (records.length === 0) throw new Error(`${fileLabel}沒有資料列`);
  const warnings = [];
  const rows = records.map((record, index) => {
    const rowNumber = index + 2;
    const id = String(record.id ?? "").trim();
    const interview = String(record.interview ?? "").trim().replace(/\s+/g, " ");
    const comment = String(record.comment ?? "").replace(/\r\n?/g, "\n").trim();
    if (!id || id.length > MAX_ID_CHARS) throw new Error(`${fileLabel}第 ${rowNumber} 列的 id 為空或過長`);
    if (!comment) throw new Error(`${fileLabel}第 ${rowNumber} 列的 comment 是空的`);
    if (comment.length > MAX_COMMENT_CHARS || comment.includes("\0")) {
      throw new Error(`${fileLabel}第 ${rowNumber} 列的 comment 過長或含無效字元`);
    }
    if (interview.length > MAX_INTERVIEW_CHARS) throw new Error(`${fileLabel}第 ${rowNumber} 列的 interview 過長`);
    for (const { name, pattern } of PII_PATTERNS) {
      if (pattern.test(comment) || pattern.test(interview)) {
        warnings.push(`${fileLabel}第 ${rowNumber} 列可能含有 ${name}，公開前請人工檢查。`);
        break;
      }
    }
    return { id, interview, comment, file: fileLabel };
  });
  return { rows, warnings, file: fileLabel };
}

/**
 * 合併多份已解析的 tttc.csv。同一份檔案內 id 重複視為錯誤；跨檔案重複則加上檔案序號前綴，
 * 讓 TTTC 仍能把每一列當成獨立發言。完全相同的 comment 會提醒但保留。
 */
export function mergeTttcFiles(files) {
  if (!Array.isArray(files) || files.length === 0) throw new Error("請至少放入一份 TTTC CSV");
  if (files.length > MAX_FILES) throw new Error(`一次最多合併 ${MAX_FILES} 份`);
  const warnings = [];
  const merged = [];
  const seenIds = new Map();
  let renamed = 0;
  files.forEach((file, fileIndex) => {
    const local = new Set();
    for (const row of file.rows) {
      if (local.has(row.id)) throw new Error(`${file.file}有重複的 id：${row.id}`);
      local.add(row.id);
      let id = row.id;
      if (seenIds.has(id)) {
        id = `f${fileIndex + 1}-${row.id}`;
        renamed += 1;
      }
      seenIds.set(id, true);
      merged.push({ ...row, id });
    }
    warnings.push(...file.warnings);
  });
  if (merged.length > MAX_ROWS_TOTAL) throw new Error(`合併後超過 ${MAX_ROWS_TOTAL} 列安全上限`);
  if (renamed > 0) warnings.unshift(`${renamed} 列的 id 與其他檔案重複，已加上檔案序號前綴。`);
  const commentCounts = new Map();
  for (const row of merged) commentCounts.set(row.comment, (commentCounts.get(row.comment) ?? 0) + 1);
  const duplicateComments = [...commentCounts.values()].filter((count) => count > 1).length;
  if (duplicateComments > 0) warnings.push(`${duplicateComments} 句 comment 在合併後完全相同，TTTC 會把它們當成不同人的發言。`);
  const interviews = new Set(merged.map((row) => row.interview).filter(Boolean));
  return {
    rows: merged,
    warnings,
    summary: {
      files: files.length,
      rows: merged.length,
      interviews: interviews.size,
      blankInterviews: merged.filter((row) => !row.interview).length,
      perFile: files.map((file) => ({ file: file.file, rows: file.rows.length })),
    },
  };
}

/** 重新輸出為 TTTC 可讀的三欄 CSV；儲存格開頭的公式字元會加上單引號。 */
export function tttcRowsToCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("沒有可輸出的列");
  return csvTable(
    [...TTTC_HEADERS],
    rows.map((row) => [row.id, formulaSafeCell(row.interview), formulaSafeCell(row.comment)]),
  );
}

function cleanLabel(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
}
