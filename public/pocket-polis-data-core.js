export const POCKET_POLIS_DATA_SCHEMA =
  "https://delib.mashbean.net/schemas/delib-pocket-polis/v1.json";

const STATEMENT_HEADERS = Object.freeze([
  "statement_id",
  "text",
  "status",
  "is_seed",
  "agrees",
  "disagrees",
  "passes",
  "created_at",
]);
const VOTE_HEADERS = Object.freeze(["participant", "statement_id", "vote", "updated_at"]);
const STATEMENT_STATUSES = new Set(["approved", "pending", "rejected"]);
const MAX_ROWS = 500_000;

export function parsePocketPolisExports({ statementsCsv, votesCsv }) {
  const statementRows = parseCsvWithHeaders(statementsCsv, STATEMENT_HEADERS, "意見清單");
  const voteRows = parseCsvWithHeaders(votesCsv, VOTE_HEADERS, "投票紀錄");
  if (statementRows.length === 0) throw new Error("意見清單沒有資料列");

  const statementIds = new Set();
  const statements = statementRows.map((row, index) => {
    const rowNumber = index + 2;
    const statementId = positiveInteger(row.statement_id, `意見清單第 ${rowNumber} 列的 statement_id`);
    if (statementIds.has(statementId)) throw new Error(`意見清單有重複的 statement_id：${statementId}`);
    statementIds.add(statementId);
    const text = cleanStatementText(row.text, rowNumber);
    if (!STATEMENT_STATUSES.has(row.status)) {
      throw new Error(`意見清單第 ${rowNumber} 列的 status 不在允許範圍`);
    }
    const isSeed = binaryInteger(row.is_seed, `意見清單第 ${rowNumber} 列的 is_seed`) === 1;
    return {
      statementId,
      text,
      status: row.status,
      isSeed,
      agrees: nonNegativeInteger(row.agrees, `意見清單第 ${rowNumber} 列的 agrees`),
      disagrees: nonNegativeInteger(row.disagrees, `意見清單第 ${rowNumber} 列的 disagrees`),
      passes: nonNegativeInteger(row.passes, `意見清單第 ${rowNumber} 列的 passes`),
      createdAt: isoDateTime(row.created_at, `意見清單第 ${rowNumber} 列的 created_at`),
    };
  });

  const voteKeys = new Set();
  const participantIds = new Set();
  const observedCounts = new Map(statements.map((statement) => [
    statement.statementId,
    { agrees: 0, disagrees: 0, passes: 0 },
  ]));
  const votes = voteRows.map((row, index) => {
    const rowNumber = index + 2;
    const participant = cleanParticipant(row.participant, rowNumber);
    const statementId = positiveInteger(row.statement_id, `投票紀錄第 ${rowNumber} 列的 statement_id`);
    if (!statementIds.has(statementId)) {
      throw new Error(`投票紀錄第 ${rowNumber} 列指向不存在的 statement_id：${statementId}`);
    }
    const value = integer(row.vote, `投票紀錄第 ${rowNumber} 列的 vote`);
    if (![-1, 0, 1].includes(value)) throw new Error(`投票紀錄第 ${rowNumber} 列的 vote 必須是 -1、0 或 1`);
    const key = `${participant}:${statementId}`;
    if (voteKeys.has(key)) throw new Error(`投票紀錄有重複的參與者／陳述組合：${key}`);
    voteKeys.add(key);
    participantIds.add(participant);
    const counts = observedCounts.get(statementId);
    if (value === 1) counts.agrees += 1;
    else if (value === -1) counts.disagrees += 1;
    else counts.passes += 1;
    return {
      participant,
      statementId,
      value,
      updatedAt: isoDateTime(row.updated_at, `投票紀錄第 ${rowNumber} 列的 updated_at`),
    };
  });

  const mismatchedStatements = statements
    .filter((statement) => {
      const observed = observedCounts.get(statement.statementId);
      return (
        statement.agrees !== observed.agrees ||
        statement.disagrees !== observed.disagrees ||
        statement.passes !== observed.passes
      );
    })
    .map((statement) => statement.statementId);
  const approvedCount = statements.filter((statement) => statement.status === "approved").length;
  const approvedIds = new Set(
    statements.filter((statement) => statement.status === "approved").map((statement) => statement.statementId),
  );
  const approvedVotes = votes.filter((vote) => approvedIds.has(vote.statementId)).length;
  const possibleVotes = participantIds.size * approvedCount;

  return {
    statements,
    votes,
    summary: {
      statements: statements.length,
      approvedStatements: approvedCount,
      seedStatements: statements.filter((statement) => statement.isSeed).length,
      participantSubmittedStatements: statements.filter((statement) => !statement.isSeed).length,
      participants: participantIds.size,
      votes: votes.length,
      coverage: possibleVotes > 0 ? Math.min(1, approvedVotes / possibleVotes) : 0,
    },
    consistency: {
      countMatches: mismatchedStatements.length === 0,
      mismatchedStatements,
    },
  };
}

export function buildPocketPolisBundle({ title, description, reportUrl, parsed, files, exportedAt }) {
  const normalizedTitle = cleanLine(title, 120, "請填入活動名稱");
  const normalizedDescription = cleanOptionalText(description, 2_000);
  const source = parsePocketPolisReportUrl(reportUrl);
  if (!source) throw new Error("請貼上有效的 Pocket Polis 公開成果網址");
  if (!parsed || !Array.isArray(parsed.statements) || !Array.isArray(parsed.votes)) {
    throw new Error("請先匯入並驗證兩份 Pocket Polis CSV");
  }
  const normalizedFiles = normalizeFileEvidence(files);
  return {
    schema: POCKET_POLIS_DATA_SCHEMA,
    kind: "pocket-polis-export",
    exportedAt: validDateTime(exportedAt) || new Date().toISOString(),
    source: {
      tool: "Pocket Polis",
      origin: source.origin,
      conversationId: source.conversationId,
      reportUrl: source.reportUrl,
      title: normalizedTitle,
      description: normalizedDescription,
      importedFiles: normalizedFiles,
      persistedByDelib: false,
    },
    summary: parsed.summary,
    consistency: parsed.consistency,
    statements: parsed.statements,
    votes: parsed.votes,
    dataCard: {
      containsParticipantData: true,
      containsDirectIdentifiers: false,
      containsParticipantFreeText: true,
      containsPseudonymousLinkage: true,
      publicationStatus: "local-private-export",
      storedByDelib: false,
      limitations: [
        "參與者代碼雖已匿名化，仍可串連同一人在本活動中的多筆投票。",
        "參與者投稿是自由文字，仍可能自行揭露身分或敏感情境，發布前必須人工檢查。",
        "參與人並非母體的代表性樣本；群組與票數不能直接當成民意調查或正式授權。",
        ...(parsed.consistency.countMatches
          ? []
          : ["兩份 CSV 的彙整票數不一致，可能下載於不同時間；分析前應重新下載同一時間點的檔案。"]),
      ],
    },
  };
}

export function pocketPolisToTttcCsv(bundle) {
  const normalized = normalizeBundle(bundle);
  const rows = normalized.statements
    .filter((statement) => statement.status === "approved")
    .map((statement) => [
      `statement-${statement.statementId}`,
      statement.isSeed ? "Pocket Polis 種子陳述" : "Pocket Polis 參與者投稿",
      formulaSafeCell(statement.text),
    ]);
  if (rows.length === 0) throw new Error("沒有已核准意見，無法建立 TTTC CSV");
  return csvTable(["id", "interview", "comment"], rows);
}

export function pocketPolisToAgoraCsv(bundle) {
  const normalized = normalizeBundle(bundle);
  if (normalized.votes.length === 0) throw new Error("沒有投票紀錄，無法建立 Agora 匯入包");
  const participantNumbers = new Map(
    [...new Set(normalized.votes.map((vote) => vote.participant))]
      .sort(participantSort)
      .map((participant, index) => [participant, index + 1]),
  );
  const summaryCsv = [
    ["topic", formulaSafeCell(normalized.source.title)],
    ["url", normalized.source.reportUrl],
    ["voters", normalized.summary.participants],
    ["voters-in-conv", normalized.summary.participants],
    ["commenters", 0],
    ["comments", normalized.summary.statements],
    ["groups", 0],
    ["conversation-description", formulaSafeCell(normalized.source.description)],
  ].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
  const commentsCsv = csvTable(
    ["timestamp", "datetime", "comment-id", "author-id", "agrees", "disagrees", "moderated", "comment-body"],
    normalized.statements.map((statement) => [
      Date.parse(statement.createdAt),
      statement.createdAt,
      statement.statementId,
      -1,
      statement.agrees,
      statement.disagrees,
      statement.status === "approved" ? 1 : statement.status === "rejected" ? -1 : 0,
      formulaSafeCell(statement.text),
    ]),
  );
  const votesCsv = csvTable(
    ["timestamp", "datetime", "comment-id", "voter-id", "vote"],
    normalized.votes.map((vote) => [
      Date.parse(vote.updatedAt),
      vote.updatedAt,
      vote.statementId,
      participantNumbers.get(vote.participant),
      vote.value,
    ]),
  );
  return {
    summaryCsv,
    commentsCsv,
    votesCsv,
    notes: [
      "Pocket Polis 不輸出投稿者連結，因此 author-id 統一為 -1、commenters 設為 0。",
      "groups 設為 0，交由 Agora 重新計算。",
      "可能觸發試算表公式的文字已加上單引號前綴。",
    ],
  };
}

export function parsePocketPolisReportUrl(value) {
  if (typeof value !== "string" || value.length > 2_000) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    const match = url.pathname.match(/^\/r\/([a-z0-9]{10})\/?$/);
    if (!match) return null;
    return {
      origin: url.origin,
      conversationId: match[1],
      reportUrl: `${url.origin}/r/${match[1]}`,
    };
  } catch {
    return null;
  }
}

function normalizeBundle(value) {
  if (
    !value ||
    typeof value !== "object" ||
    value.schema !== POCKET_POLIS_DATA_SCHEMA ||
    value.kind !== "pocket-polis-export" ||
    !Array.isArray(value.statements) ||
    !Array.isArray(value.votes)
  ) {
    throw new Error("Pocket Polis 資料包格式不完整");
  }
  return value;
}

function parseCsvWithHeaders(value, expectedHeaders, label) {
  if (typeof value !== "string") throw new Error(`${label}不是文字 CSV`);
  const rows = parseCsv(value.replace(/^\uFEFF/, ""));
  if (rows.length === 0) throw new Error(`${label}是空檔案`);
  const headers = rows[0];
  if (
    headers.length !== expectedHeaders.length ||
    headers.some((header, index) => header !== expectedHeaders[index])
  ) {
    throw new Error(`${label}欄位不符；預期 ${expectedHeaders.join(",")}`);
  }
  if (rows.length - 1 > MAX_ROWS) throw new Error(`${label}超過 ${MAX_ROWS} 筆安全上限`);
  return rows.slice(1).map((values, index) => {
    if (values.length !== expectedHeaders.length) throw new Error(`${label}第 ${index + 2} 列欄位數不符`);
    return Object.fromEntries(expectedHeaders.map((header, column) => [header, values[column]]));
  });
}

function parseCsv(value) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) {
      if (character === '"') {
        if (value[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (closedQuote) {
      if (character === ",") {
        row.push(field);
        field = "";
        closedQuote = false;
      } else if (character === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        closedQuote = false;
      } else if (character !== "\r") {
        throw new Error("CSV 的引號欄位後有無效字元");
      }
    } else if (character === '"') {
      if (field !== "") throw new Error("CSV 的未加引號欄位含有無效引號");
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }
  if (quoted) throw new Error("CSV 有未關閉的引號");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((cell) => cell !== ""));
}

function cleanStatementText(value, rowNumber) {
  if (typeof value !== "string" || !value.trim() || value.length > 280 || value.includes("\0")) {
    throw new Error(`意見清單第 ${rowNumber} 列的 text 為空、過長或含無效字元`);
  }
  return value.trim();
}

function cleanParticipant(value, rowNumber) {
  if (typeof value !== "string" || !/^p[1-9]\d{0,8}$/.test(value)) {
    throw new Error(`投票紀錄第 ${rowNumber} 列的 participant 格式不符`);
  }
  return value;
}

function integer(value, label) {
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) throw new Error(`${label} 必須是整數`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} 超出安全範圍`);
  return parsed;
}

function positiveInteger(value, label) {
  const parsed = integer(value, label);
  if (parsed < 1) throw new Error(`${label} 必須大於 0`);
  return parsed;
}

function nonNegativeInteger(value, label) {
  const parsed = integer(value, label);
  if (parsed < 0) throw new Error(`${label} 不得小於 0`);
  return parsed;
}

function binaryInteger(value, label) {
  const parsed = integer(value, label);
  if (parsed !== 0 && parsed !== 1) throw new Error(`${label} 必須是 0 或 1`);
  return parsed;
}

function isoDateTime(value, label) {
  if (typeof value !== "string") throw new Error(`${label} 必須是 ISO 時間`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`${label} 必須是 ISO 時間`);
  return parsed.toISOString();
}

function cleanLine(value, max, message) {
  if (typeof value !== "string") throw new Error(message);
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > max) throw new Error(message);
  return cleaned;
}

function cleanOptionalText(value, max) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string") throw new Error("活動說明格式不完整");
  const cleaned = value.trim().replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ");
  if (cleaned.length > max) throw new Error(`活動說明不得超過 ${max} 字`);
  return cleaned;
}

function normalizeFileEvidence(value) {
  if (!Array.isArray(value) || value.length !== 2) throw new Error("缺少兩份原始檔案的驗證紀錄");
  const roles = new Set();
  return value.map((file) => {
    if (!file || typeof file !== "object") throw new Error("原始檔案驗證紀錄不完整");
    const role = file.role === "statements" || file.role === "votes" ? file.role : null;
    if (!role || roles.has(role)) throw new Error("原始檔案角色不完整");
    roles.add(role);
    const name = cleanLine(file.name, 180, "原始檔名不完整");
    const size = Number(file.size);
    const sha256 = typeof file.sha256 === "string" && /^[a-f0-9]{64}$/.test(file.sha256) ? file.sha256 : null;
    if (!Number.isSafeInteger(size) || size < 1 || !sha256) throw new Error("原始檔案驗證紀錄不完整");
    return { role, name, size, sha256 };
  });
}

function validDateTime(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function csvTable(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formulaSafeCell(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function participantSort(left, right) {
  return Number(left.slice(1)) - Number(right.slice(1));
}
