import { describe, expect, it } from "vitest";
import {
  POCKET_POLIS_DATA_SCHEMA,
  buildPocketPolisBundle,
  parsePocketPolisExports,
  parsePocketPolisReportUrl,
  pocketPolisToAgoraCsv,
  pocketPolisToTttcCsv,
} from "../public/pocket-polis-data-core.js";

const statementsCsv = `statement_id,text,status,is_seed,agrees,disagrees,passes,created_at
1,"增加照明，但保留暗區",approved,1,2,0,0,2026-09-01T00:00:00.000Z
2,"=保留草地\n與老樹",approved,0,1,1,0,2026-09-01T00:01:00.000Z
3,=不公開個資,pending,0,0,0,0,2026-09-01T00:02:00.000Z
`;

const votesCsv = `participant,statement_id,vote,updated_at
p1,1,1,2026-09-01T01:00:00.000Z
p2,1,1,2026-09-01T01:01:00.000Z
p1,2,-1,2026-09-01T01:02:00.000Z
p2,2,1,2026-09-01T01:03:00.000Z
`;

function bundleFixture() {
  const parsed = parsePocketPolisExports({ statementsCsv, votesCsv });
  return buildPocketPolisBundle({
    title: "公園下一步",
    description: "理解居民的取捨",
    reportUrl: "https://polis.mashbean.net/r/abc123def4",
    parsed,
    exportedAt: "2026-09-01T02:00:00.000Z",
    files: [
      { role: "statements", name: "statements.csv", size: 300, sha256: "a".repeat(64) },
      { role: "votes", name: "votes.csv", size: 200, sha256: "b".repeat(64) },
    ],
  });
}

describe("Pocket Polis local data handoff", () => {
  it("parses quoted statements, votes and matching aggregate counts", () => {
    const parsed = parsePocketPolisExports({ statementsCsv, votesCsv });
    expect(parsed.statements[0].text).toBe("增加照明，但保留暗區");
    expect(parsed.statements[1].text).toContain("\n");
    expect(parsed.summary).toMatchObject({
      statements: 3,
      approvedStatements: 2,
      participants: 2,
      votes: 4,
      coverage: 1,
    });
    expect(parsed.consistency).toEqual({ countMatches: true, mismatchedStatements: [] });
  });

  it("rejects unknown statement references and duplicate participant votes", () => {
    expect(() =>
      parsePocketPolisExports({
        statementsCsv,
        votesCsv: votesCsv.replace("p2,2,1", "p2,9,1"),
      }),
    ).toThrow("不存在");
    expect(() =>
      parsePocketPolisExports({ statementsCsv, votesCsv: `${votesCsv}p1,1,1,2026-09-01T02:00:00.000Z\n` }),
    ).toThrow("重複");
  });

  it("rejects malformed CSV quote boundaries", () => {
    expect(() =>
      parsePocketPolisExports({
        statementsCsv: statementsCsv.replace('"增加照明，但保留暗區"', '"增加照明，但保留暗區"x'),
        votesCsv,
      }),
    ).toThrow("引號欄位後");
    expect(() =>
      parsePocketPolisExports({
        statementsCsv: statementsCsv.replace("=不公開個資", '=不公開"個資'),
        votesCsv,
      }),
    ).toThrow("未加引號欄位");
  });

  it("keeps a visible warning when statement totals and vote rows differ", () => {
    const parsed = parsePocketPolisExports({
      statementsCsv: statementsCsv.replace("approved,1,2,0,0", "approved,1,3,0,0"),
      votesCsv,
    });
    expect(parsed.consistency.countMatches).toBe(false);
    expect(parsed.consistency.mismatchedStatements).toEqual([1]);
  });

  it("builds a participant-aware bundle with source hashes and no admin token", () => {
    const bundle = bundleFixture();
    expect(bundle.schema).toBe(POCKET_POLIS_DATA_SCHEMA);
    expect(bundle.source).toMatchObject({
      conversationId: "abc123def4",
      reportUrl: "https://polis.mashbean.net/r/abc123def4",
      persistedByDelib: false,
    });
    expect(bundle.dataCard).toMatchObject({
      containsParticipantData: true,
      containsDirectIdentifiers: false,
      containsParticipantFreeText: true,
      containsPseudonymousLinkage: true,
      publicationStatus: "local-private-export",
      storedByDelib: false,
    });
    expect(JSON.stringify(bundle)).not.toContain("token=");
  });

  it("prepares TTTC standard columns and formula-safe free text", () => {
    const csv = pocketPolisToTttcCsv(bundleFixture());
    expect(csv).toContain("id,interview,comment");
    expect(csv).toContain("Pocket Polis 種子陳述");
    expect(csv).toContain("'=保留草地");
    expect(csv).not.toContain(",=保留草地");
    expect(csv).not.toContain("=不公開個資");
    expect(csv).not.toContain("pending");
  });

  it("prepares the three Agora Pol.is import files with disclosed lossy mappings", () => {
    const result = pocketPolisToAgoraCsv(bundleFixture());
    expect(result.summaryCsv).toContain("topic,公園下一步");
    expect(result.summaryCsv).toContain("commenters,0");
    expect(result.commentsCsv).toContain("comment-id,author-id");
    expect(result.commentsCsv).toContain("3,-1,0,0,0,'=不公開個資");
    expect(result.votesCsv).toContain("comment-id,voter-id,vote");
    expect(result.notes.join(" ")).toContain("author-id");
  });

  it("does not claim downstream-ready files when the required rows are absent", () => {
    const noApproved = bundleFixture();
    noApproved.statements.forEach((statement) => { statement.status = "pending"; });
    expect(() => pocketPolisToTttcCsv(noApproved)).toThrow("沒有已核准意見");
    const noVotes = bundleFixture();
    noVotes.votes = [];
    noVotes.summary.votes = 0;
    expect(() => pocketPolisToAgoraCsv(noVotes)).toThrow("沒有投票紀錄");
  });

  it("accepts any HTTPS Pocket Polis-compatible report origin but no secrets", () => {
    expect(parsePocketPolisReportUrl("https://polis.example/r/abc123def4")).toMatchObject({
      conversationId: "abc123def4",
      origin: "https://polis.example",
    });
    expect(parsePocketPolisReportUrl("https://polis.example/r/abc123def4#token=secret")).toBeNull();
    expect(parsePocketPolisReportUrl("https://user:pass@polis.example/r/abc123def4")).toBeNull();
  });
});
