import { mergeTttcFiles, parseTttcCsv, tttcRowsToCsv } from "./tttc-csv-core.js";

export const MAX_HANDOFF_BYTES = 3 * 1024 * 1024;
export const DESTINATION_MAX_ROWS = Object.freeze({ tttc: 600, reply: 400 });
const L = (zh, en) => ({ zh, en });

/** Pure local conversion. Source hashes are supplied by the browser after reading each file. */
export function buildHandoff(files, { generatedAt = new Date().toISOString() } = {}) {
  if (!Array.isArray(files) || !files.length || files.length > 20) throw new Error("Choose between 1 and 20 CSV files / 請選擇 1 至 20 份 CSV。");
  const seenHashes = new Set();
  for (const file of files) {
    if (new TextEncoder().encode(file.text).length > MAX_HANDOFF_BYTES) throw new Error(`${file.name}: file exceeds 3 MB / 單檔超過 3 MB。`);
    if (!/^[a-f0-9]{64}$/.test(file.sha256 || "")) throw new Error("A source SHA-256 hash is required / 缺少來源檔案雜湊。");
    // Identical uploads are almost always a selection mistake; do not double the evidence silently.
    if (seenHashes.has(file.sha256)) throw new Error(`${file.name}: identical file selected twice / 重複選取同一份內容。`);
    seenHashes.add(file.sha256);
  }
  const parsed = files.map((file) => parseTttcCsv({ text: file.text, label: file.name }));
  const merged = mergeTttcFiles(parsed, { scopeInterviews: true, namespaceIds: true });
  const csv = tttcRowsToCsv(merged.rows);
  const byteLength = new TextEncoder().encode(csv).length;
  const notices = [];
  const piiWarnings = parsed.flatMap((p) => p.warnings);
  if (piiWarnings.length) notices.push({ level: "error", text: L(`有 ${piiWarnings.length} 列疑似含電子郵件、手機或身分證號。請回原檔修正後重選；下載檔案仍包含原始文字。`, `${piiWarnings.length} rows may contain an email, mobile number or national ID. Correct the original files and select them again; the download still contains the original text.`) });
  if (merged.summary.blankInterviews) notices.push({ level: "notice", text: L(`${merged.summary.blankInterviews} 列沒有 interview。缺少分組時，TTTC 可能將每列計為一個來源，不能用它還原實際人數。`, `${merged.summary.blankInterviews} rows have no interview group. TTTC may count each row as a source; this cannot recover the actual number of people.`) });
  if (merged.summary.duplicateComments) notices.push({ level: "notice", text: L(`${merged.summary.duplicateComments} 句文字完全相同，仍保留各自來源；相同句子不代表同一人，也不代表多一票。`, `${merged.summary.duplicateComments} texts repeat exactly. All source rows remain; identical text is neither proof of the same person nor another vote.`) });
  if (byteLength > MAX_HANDOFF_BYTES) notices.push({ level: "error", text: L('合併後超過 3 MB，無法直接放入目前 TTTC / Reply。請按議題或輪次分批選檔。', 'The merged CSV exceeds 3 MB and cannot fit the current TTTC / Reply input limit. Select a smaller batch by topic or round.') });
  if (merged.rows.length > DESTINATION_MAX_ROWS.tttc) notices.push({ level: "error", text: L('合併後超過目前 TTTC 的 600 列及 Reply 的 400 列上限。請按議題或輪次分批選檔。', 'The batch exceeds the current limits of 600 rows for TTTC and 400 for Reply. Select a smaller batch by topic or round.') });
  else if (merged.rows.length > DESTINATION_MAX_ROWS.reply) notices.push({ level: "notice", text: L('這批可交給 TTTC；Reply 目前最多 400 列，需要再分批。', 'This batch fits TTTC. Reply currently accepts at most 400 rows, so split it further for Reply.') });
  const manifest = {
    format: "delib-csv-handoff/v1", generatedAt,
    simulated: files.every((f) => f.simulated === true),
    inputFormat: "tttc.csv: id,interview,comment", outputFormat: "tttc.csv: id,interview,comment",
    sources: files.map((file, index) => ({ sourceIndex: index, name: file.name, sha256: file.sha256, bytes: file.byteLength ?? new TextEncoder().encode(file.text).length, rows: parsed[index].rows.length })),
    transformations: ["Namespaced and collision-checked source IDs (maximum 120 characters).", "Interview aliases replaced by source-scoped group codes; no cross-source person matching.", "CSV formula prefixes escaped; original text remains in the privately retained source files.", "No comments removed, no votes inferred and no consent transferred."],
    mappings: merged.rows.map((r) => ({ outputId: r.id, sourceIndex: r.sourceFileIndex, originalId: r.originalId, originalInterview: r.originalInterview, outputInterview: r.interview })),
    summary: { ...merged.summary, byteLength, groupCountIsParticipantCount: false },
    dataCard: { containsParticipantFreeText: true, containsPseudonymousLinkage: true, containsOriginalAliases: true, suitableForPublicSharing: false, storedByDelib: false, publicationStatus: "local-private-export", limitations: ["Pattern checks cannot certify anonymization or consent.", "Do not publish this mapping or use it to infer identities across tools.", "Blank or shared interview labels do not establish unique participant counts."] },
  };
  return { parsed, merged, csv, byteLength, notices, manifest, exportAllowed: byteLength <= MAX_HANDOFF_BYTES && merged.rows.length <= DESTINATION_MAX_ROWS.tttc };
}
