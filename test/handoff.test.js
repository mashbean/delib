import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildHandoff, MAX_HANDOFF_BYTES } from "../public/handoff-core.js";
import { parseTttcCsv } from "../public/tttc-csv-core.js";

const file = (name, text) => ({ name, text, sha256: createHash("sha256").update(text).digest("hex"), byteLength: Buffer.byteLength(text) });

describe("local source-preserving CSV handoff", () => {
  it("keeps file hashes and reversible ID/alias mappings while CSV gets source-scoped codes", () => {
    const files = [
      file("form.csv", "id,interview,comment\np1-q1,阿文,過街路線不清楚\np1-q2,阿文,需要清楚指標\n"),
      file("interview.csv", "id,interview,comment\np1-q1,阿文,配送時段需協調\n"),
    ];
    const result = buildHandoff(files, { generatedAt: "2026-09-06T00:00:00.000Z" });
    expect(result.exportAllowed).toBe(true);
    expect(result.merged.summary).toMatchObject({ files: 2, rows: 3, interviews: 2 });
    expect(result.manifest.sources.map((s) => s.sha256)).toEqual(files.map((f) => f.sha256));
    expect(result.manifest.mappings[2]).toEqual({ outputId: "f2-p1-q1", sourceIndex: 1, originalId: "p1-q1", originalInterview: "阿文", outputInterview: "source-2:group-1" });
    expect(result.csv).not.toContain("阿文");
    expect(result.manifest.dataCard).toMatchObject({ containsOriginalAliases: true, suitableForPublicSharing: false, storedByDelib: false });
    expect(parseTttcCsv({ text: result.csv, label: "merged.csv" }).rows.map((r) => r.comment)).toEqual(["過街路線不清楚", "需要清楚指標", "配送時段需協調"]);
    expect(result.manifest.summary.groupCountIsParticipantCount).toBe(false);
  });

  it("rejects duplicate uploads, malformed contracts, and hashes that could not identify a source", () => {
    const f = file("one.csv", "id,interview,comment\n1,p1,test\n");
    expect(() => buildHandoff([f, { ...f, name: "copy.csv" }])).toThrow(/identical file/);
    expect(() => buildHandoff([file("wide.csv", "email,answer\na@b.com,test\n")])).toThrow();
    expect(() => buildHandoff([{ ...f, sha256: "unknown" }])).toThrow(/SHA-256/);
  });

  it("makes privacy and missing-group limits explicit without silently editing the original words", () => {
    const result = buildHandoff([file("sensitive.csv", "id,interview,comment\n1,,call 0912-345-678\n2,p2,same comment\n3,p2,same comment\n")]);
    expect(result.csv).toContain("0912-345-678");
    expect(result.notices.some((n) => n.level === "error" && n.text.en.includes("mobile"))).toBe(true);
    expect(result.notices.some((n) => n.text.en.includes("actual number of people"))).toBe(true);
    expect(result.notices.some((n) => n.text.en.includes("neither proof"))).toBe(true);
    expect(result.manifest.dataCard.suitableForPublicSharing).toBe(false);
  });

  it("does not produce an apparently usable download when the merged file exceeds native input limits", () => {
    const makeRows = (offset) => Array.from({ length: 1700 }, (_, i) => `${offset + i},p1,${"a".repeat(1000)}`).join("\n");
    const files = [file("first.csv", `id,interview,comment\n${makeRows(0)}\n`), file("second.csv", `id,interview,comment\n${makeRows(1700)}\n`)];
    expect(files.every((f) => f.byteLength < MAX_HANDOFF_BYTES)).toBe(true);
    const result = buildHandoff(files);
    expect(result.byteLength).toBeGreaterThan(MAX_HANDOFF_BYTES);
    expect(result.exportAllowed).toBe(false);
    expect(result.notices.some((n) => n.text.en.includes("exceeds 3 MB"))).toBe(true);
  });

  it("distinguishes TTTC and Reply row limits and refuses a batch that fits neither", () => {
    const rows = (n) => "id,interview,comment\n" + Array.from({ length: n }, (_, i) => `${i},p1,comment ${i}`).join("\n");
    const tttcOnly = buildHandoff([file("450.csv", rows(450))]);
    expect(tttcOnly.exportAllowed).toBe(true);
    expect(tttcOnly.notices.some((n) => n.text.en.includes("at most 400"))).toBe(true);
    const tooMany = buildHandoff([file("601.csv", rows(601))]);
    expect(tooMany.exportAllowed).toBe(false);
    expect(tooMany.notices.some((n) => n.text.en.includes("600 rows"))).toBe(true);
  });
});
