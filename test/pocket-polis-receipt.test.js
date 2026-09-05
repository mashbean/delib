import { describe, expect, it } from "vitest";
import { buildPocketPolisBundle, parsePocketPolisExports } from "../public/pocket-polis-data-core.js";
import {
  createPocketPolisReceipt,
  normalizePocketPolisReceipt,
  pocketPolisDecisionStatusLabel,
  pocketPolisReceiptFromHash,
  pocketPolisReceiptSummary,
  pocketPolisReceiptToHash,
  pocketPolisReceiptToMarkdown,
  pocketPolisReceiptUrl,
  selectToolSynthesis,
} from "../public/pocket-polis-receipt-core.js";
import { createReceiptHandoff } from "../public/receipt-handoff-core.js";

const statementsCsv = `statement_id,text,status,is_seed,agrees,disagrees,passes,created_at
1,增加照明但保留部分暗區,approved,1,3,0,0,2026-09-01T00:00:00.000Z
2,保留草地與老樹,approved,0,2,1,0,2026-09-01T00:01:00.000Z
3,新設施完成前再辦居民討論,approved,0,1,1,1,2026-09-01T00:02:00.000Z
4,公開參與者姓名,pending,0,0,0,0,2026-09-01T00:03:00.000Z
`;
const votesCsv = `participant,statement_id,vote,updated_at
p1,1,1,2026-09-01T01:00:00.000Z
p2,1,1,2026-09-01T01:01:00.000Z
p3,1,1,2026-09-01T01:02:00.000Z
p1,2,1,2026-09-01T01:03:00.000Z
p2,2,1,2026-09-01T01:04:00.000Z
p3,2,-1,2026-09-01T01:05:00.000Z
p1,3,1,2026-09-01T01:06:00.000Z
p2,3,-1,2026-09-01T01:07:00.000Z
p3,3,0,2026-09-01T01:08:00.000Z
`;

const organizer = {
  interpretation: "照明獲得較多同意，但草地保存與後續討論仍呈現取捨。",
  missingVoices: "兒童、夜間較少使用者與行動不便者尚未被充分邀請。",
  decisionStatus: "under-review",
  authority: "公園改善工作小組",
  responsibleActor: "社區發展協會",
  responseBy: "2026-09-20",
  nextAction: "補訪尚未納入的使用者，並在公開會議逐項回覆。",
  evidenceUrl: "https://example.org/meeting-notes",
};

function bundleFixture() {
  return buildPocketPolisBundle({
    title: "公園下一步",
    description: "理解居民對公園空間的取捨",
    reportUrl: "https://polis.mashbean.net/r/abc123def4",
    parsed: parsePocketPolisExports({ statementsCsv, votesCsv }),
    exportedAt: "2026-09-01T02:00:00.000Z",
    files: [
      { role: "statements", name: "statements.csv", size: 300, sha256: "a".repeat(64) },
      { role: "votes", name: "votes.csv", size: 200, sha256: "b".repeat(64) },
    ],
  });
}

describe("Pocket Polis result receipt", () => {
  it("creates a public aggregate without pseudonymous participants or vote rows", () => {
    const receipt = createPocketPolisReceipt({
      bundle: bundleFixture(),
      selectedStatementIds: [1, 3],
      organizer,
      preparedAt: "2026-09-01T03:00:00.000Z",
    });
    expect(receipt.kind).toBe("pocket-polis-receipt");
    expect(receipt.findings).toHaveLength(2);
    expect(receipt.scope).toMatchObject({ participants: 3, totalVotes: 9, includedStatements: 2 });
    expect(receipt.dataCard).toMatchObject({
      containsParticipantRecords: false,
      containsParticipantFreeText: true,
      containsPseudonymousLinkage: false,
      storedByDelib: false,
      transport: "url-fragment",
    });
    const serialized = JSON.stringify(receipt);
    expect(serialized).not.toContain('"participant"');
    expect(serialized).not.toContain('"votes"');
    expect(serialized).not.toContain("p1");
    expect(serialized).not.toContain("sha256");
    expect(serialized).toContain("meeting-notes");
  });

  it("round trips Unicode in a fragment-only result URL", () => {
    const receipt = createPocketPolisReceipt({ bundle: bundleFixture(), selectedStatementIds: [1, 2], organizer });
    const hash = pocketPolisReceiptToHash(receipt);
    expect(hash).toMatch(/^receipt=/);
    expect(pocketPolisReceiptFromHash(`#${hash}`)).toEqual(normalizePocketPolisReceipt(receipt));
    const url = new URL(pocketPolisReceiptUrl(receipt, "https://delib.mashbean.net/current"));
    expect(url.pathname).toBe("/results/pocket-polis.html");
    expect(url.search).toBe("");
  });

  it("blocks inconsistent, too-small and low-response public receipts", () => {
    const inconsistent = bundleFixture();
    inconsistent.consistency = { countMatches: false, mismatchedStatements: [1] };
    expect(() => createPocketPolisReceipt({ bundle: inconsistent, selectedStatementIds: [1], organizer })).toThrow("票數不一致");

    const tooSmall = bundleFixture();
    tooSmall.summary.participants = 2;
    expect(() => createPocketPolisReceipt({ bundle: tooSmall, selectedStatementIds: [1], organizer })).toThrow("至少需要 3 位");

    const lowResponse = bundleFixture();
    lowResponse.statements[1].agrees = 1;
    lowResponse.statements[1].disagrees = 0;
    expect(() => createPocketPolisReceipt({ bundle: lowResponse, selectedStatementIds: [2], organizer })).toThrow("少於 3 份");
  });

  it("requires one to eight unique approved statements and complete organizer accountability", () => {
    const bundle = bundleFixture();
    expect(() => createPocketPolisReceipt({ bundle, selectedStatementIds: [], organizer })).toThrow("1–8");
    expect(() => createPocketPolisReceipt({ bundle, selectedStatementIds: [1, 1], organizer })).toThrow("1–8");
    expect(() => createPocketPolisReceipt({ bundle, selectedStatementIds: [4], organizer })).toThrow("不是已核准");
    expect(() => createPocketPolisReceipt({
      bundle,
      selectedStatementIds: [1],
      organizer: { ...organizer, authority: "" },
    })).toThrow("完整填寫");
    expect(() => createPocketPolisReceipt({
      bundle,
      selectedStatementIds: [1],
      organizer: { ...organizer, responseBy: "" },
    })).toThrow("完整填寫");
  });

  it("exports layered Markdown and a concise public summary", () => {
    const receipt = createPocketPolisReceipt({ bundle: bundleFixture(), selectedStatementIds: [1, 2], organizer });
    expect(pocketPolisDecisionStatusLabel("under-review")).toBe("正在評估");
    expect(pocketPolisReceiptToMarkdown(receipt)).toContain("## 主辦者解讀");
    expect(pocketPolisReceiptToMarkdown(receipt)).toContain("票數只描述這一輪");
    expect(pocketPolisReceiptSummary(receipt)).toContain("下一步由 社區發展協會");
  });

  it.each(["call-in", "harmonica", "talk-to-the-city", "polis"])(
    "prepares a minimized %s next-step draft without findings or vote counts",
    (target) => {
      const receipt = createPocketPolisReceipt({ bundle: bundleFixture(), selectedStatementIds: [1, 2], organizer });
      const handoff = createReceiptHandoff({ receipt, target, createdAt: "2026-09-01T04:00:00.000Z" });
      const serialized = JSON.stringify(handoff);
      expect(handoff.source.tool).toBe("pocket-polis");
      expect(handoff.target).toBe(target);
      expect(serialized).not.toContain("增加照明但保留部分暗區");
      expect(serialized).not.toContain('"agrees"');
      expect(serialized).not.toContain('"participant"');
    },
  );

  it("keeps Pocket Polis TTTC handoff punctuation readable", () => {
    const receipt = createPocketPolisReceipt({ bundle: bundleFixture(), selectedStatementIds: [1, 2], organizer });
    const handoff = createReceiptHandoff({ receipt, target: "talk-to-the-city" });
    expect(handoff.draft.description).toContain("請到口袋審議報告頁下載 tttc.csv");
    expect(handoff.draft.description).not.toContain("。。");
  });
});

describe("Pocket Polis receipt tool synthesis layer", () => {
  const synthesis = {
    status: "ready",
    model: "@cf/google/gemma-4-26b-a4b-it",
    generationMode: "ai",
    generatedAt: 1788325567906,
    mathRevision: 1788325565622,
    isStale: false,
    overview: { summary: "照明與草地保存呈現取捨。", participantContext: "3 位參與者", citedStatementIds: [1, 2] },
    commonGround: {
      summary: "1 項共通點",
      keyPoints: [
        { title: "照明有共識", description: "三位參與者都同意增加照明。", direction: "agree", citedStatementIds: [1] },
        { title: "不公開姓名", description: "沒有人支持公開姓名。", direction: "disagree", citedStatementIds: [4] },
      ],
    },
    tensions: [
      { groupALabel: "A 群", groupBLabel: "B 群", topic: "草地", groupAPerspective: "保留", groupBPerspective: "改建", tensions: "使用方式不同", bridgingQuestion: "哪些時段可以共用？", citedStatementIds: [2] },
    ],
  };

  it("carries an organizer-selected excerpt with provenance and a matching limitation", () => {
    const toolSynthesis = selectToolSynthesis(synthesis, { includeOverview: true, pointIndexes: [0, 0, 5], tensionIndexes: [0] });
    expect(toolSynthesis.commonGround).toHaveLength(1);
    expect(toolSynthesis.generatedAt).toBe("2026-09-02T05:06:07.906Z");
    const receipt = createPocketPolisReceipt({
      bundle: bundleFixture(),
      selectedStatementIds: [1, 2],
      organizer,
      preparedAt: "2026-09-01T03:00:00.000Z",
      toolSynthesis,
    });
    expect(receipt.toolSynthesis.model).toBe("@cf/google/gemma-4-26b-a4b-it");
    expect(receipt.toolSynthesis.tensions[0].bridgingQuestion).toBe("哪些時段可以共用？");
    expect(receipt.dataCard.limitations.some((line) => line.includes("工具整理"))).toBe(true);
    expect(pocketPolisReceiptToMarkdown(receipt)).toContain("## 工具整理（AI 綜整）");
    const roundTrip = pocketPolisReceiptFromHash(`#${pocketPolisReceiptToHash(receipt)}`);
    expect(roundTrip.toolSynthesis).toEqual(receipt.toolSynthesis);
  });

  it("drops empty or malformed excerpts instead of publishing them", () => {
    expect(selectToolSynthesis(synthesis, { includeOverview: false })).toBeNull();
    expect(selectToolSynthesis({ ...synthesis, status: "pending" }, { includeOverview: true })).toBeNull();
    expect(normalizePocketPolisReceipt({
      ...createPocketPolisReceipt({ bundle: bundleFixture(), selectedStatementIds: [1], organizer, preparedAt: "2026-09-01T03:00:00.000Z" }),
      toolSynthesis: { tool: "Pocket Polis", model: "x", generationMode: "magic", generatedAt: "2026-09-01T00:00:00.000Z", mathRevision: 1, isStale: false, overview: "?", commonGround: [], tensions: [] },
    })).toBeNull();
  });
});
