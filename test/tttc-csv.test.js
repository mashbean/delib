import { describe, expect, it } from "vitest";
import { mergeTttcFiles, parseTttcCsv, tttcRowsToCsv, TTTC_HEADERS } from "../public/tttc-csv-core.js";

const polisCsv = `id,interview,comment
statement-1,host,"核安審查應該邀請國際同儕獨立複核。"
statement-2,p3,"他說 ""好""，然後走了"
`;

const callInCsv = `id,interview,comment
question-abc,"阿德 #48BE · keeper","我家離核二廠不到五公里。"
statement-1,"秀珍 #1234 · bridge","給我一個獨立的第三方，我就相信。"
`;

describe("TTTC csv workbench input", () => {
  it("accepts the tttc-light-js three-column contract and rejects other headers", () => {
    expect([...TTTC_HEADERS]).toEqual(["id", "interview", "comment"]);
    const parsed = parseTttcCsv({ text: polisCsv, label: "口袋審議" });
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[1]).toMatchObject({ id: "statement-2", interview: "p3", comment: '他說 "好"，然後走了', file: "口袋審議" });
    expect(() => parseTttcCsv({ text: "statement_id,text\n1,x\n", label: "錯檔" })).toThrow(/欄位不符/);
    expect(() => parseTttcCsv({ text: "id,interview,comment\n1,,\n", label: "空句" })).toThrow(/comment 是空的/);
  });

  it("merges files, prefixes cross-file id collisions and keeps per-file counts", () => {
    const merged = mergeTttcFiles([
      parseTttcCsv({ text: polisCsv, label: "口袋審議" }),
      parseTttcCsv({ text: callInCsv, label: "Call-in" }),
    ]);
    expect(merged.summary).toMatchObject({ files: 2, rows: 4, interviews: 4, blankInterviews: 0 });
    expect(merged.rows.map((row) => row.id)).toEqual(["statement-1", "statement-2", "question-abc", "f2-statement-1"]);
    expect(merged.warnings[0]).toContain("1 列的 id 與其他檔案重複");
  });

  it("flags likely personal data and duplicate comments without dropping rows", () => {
    const merged = mergeTttcFiles([
      parseTttcCsv({ text: 'id,interview,comment\n1,a,"請寫信到 someone@example.com"\n2,b,"同一句"\n3,c,"同一句"\n', label: "測試" }),
    ]);
    expect(merged.rows).toHaveLength(3);
    expect(merged.warnings.join("\n")).toContain("email");
    expect(merged.warnings.join("\n")).toContain("1 句 comment 在合併後完全相同");
  });

  it("re-emits a clean CSV with formula-safe cells", () => {
    const csv = tttcRowsToCsv([
      { id: "1", interview: "=host", comment: "+1 給照明" },
      { id: "2", interview: "", comment: '含 "引號", 逗號' },
    ]);
    expect(csv).toBe('id,interview,comment\n1,\'=host,\'+1 給照明\n2,,"含 ""引號"", 逗號"\n');
    expect(() => tttcRowsToCsv([])).toThrow();
  });
});
