import { describe, expect, it } from "vitest";
import {
  createRankingReceipt,
  decisionStatusLabel,
  nextRoundRankingUrl,
  normalizeRankingReceipt,
  rankingReceiptFromHash,
  rankingReceiptSummary,
  rankingReceiptToHash,
  rankingReceiptToMarkdown,
  rankingReceiptUrl,
} from "../public/ranking-receipt-core.js";
import {
  buildAggregateRankingBundleFromPairs,
  normalizeRankingConfig,
  rankingConfigFromHash,
} from "../public/power-ranker-core.js";

const aggregateBundle = buildAggregateRankingBundleFromPairs({
  config: normalizeRankingConfig({
    title: "公園下一步",
    items: ["照明", "草地", "遊具"],
  }),
  aggregate: {
    sessions: 4,
    pairwise: [
      { alpha: "item-1", beta: "item-2", alphaWins: 3, betaWins: 1, equal: 0 },
      { alpha: "item-2", beta: "item-3", alphaWins: 2, betaWins: 1, equal: 1 },
    ],
  },
  sourceUrl:
    "https://delib.mashbean.net/integrations/power-ranker.html?room=public#admin=private-capability",
  expiresAt: Date.parse("2026-09-08T00:00:00.000Z"),
});

const organizer = {
  interpretation: "照明目前排在前面，但草地與遊具之間仍有接近的取捨。",
  missingVoices: "夜間較少使用公園的人、兒童與行動不便者尚未被充分邀請。",
  decisionStatus: "under-review",
  authority: "公園改善工作小組",
  responsibleActor: "社區發展協會",
  responseBy: "2026-09-20",
  nextAction: "補訪尚未被納入的使用者，並在下次公開會議逐項回覆。",
  evidenceUrl: "https://example.org/meeting-notes",
};

describe("Power Ranker result receipt", () => {
  it("builds a de-linked receipt and strips fragment-held admin capabilities", () => {
    const receipt = createRankingReceipt({
      aggregateBundle,
      organizer,
      preparedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(receipt.kind).toBe("ranking-receipt");
    expect(receipt.aggregate.sessions).toBe(4);
    expect(receipt.source.aggregateStorage).toBe("ephemeral-room");
    expect(receipt.source.aggregateUrl).toBe(
      "https://delib.mashbean.net/integrations/power-ranker.html?room=public",
    );
    expect(receipt.source.aggregateExpiresAt).toBe("2026-09-08T00:00:00.000Z");
    expect(JSON.stringify(receipt)).not.toContain("private-capability");
    expect(receipt.dataCard).toMatchObject({
      containsParticipantData: true,
      containsDirectIdentifiers: false,
      containsParticipantFreeText: false,
      containsOrganizerFreeText: true,
      storedByDelib: false,
      transport: "url-fragment",
    });
  });

  it("round trips Unicode through a fragment-only result URL", () => {
    const receipt = createRankingReceipt({ aggregateBundle, organizer });
    const hash = rankingReceiptToHash(receipt);
    expect(hash).toMatch(/^receipt=/);
    expect(rankingReceiptFromHash(`#${hash}`)).toEqual(normalizeRankingReceipt(receipt));
    const url = rankingReceiptUrl(receipt, "https://delib.mashbean.net/current");
    expect(new URL(url).pathname).toBe("/results/power-ranker.html");
    expect(new URL(url).search).toBe("");
  });

  it("rejects malformed, incomplete or oversized fragments", () => {
    const receipt = createRankingReceipt({ aggregateBundle, organizer });
    expect(rankingReceiptFromHash("#receipt=not-valid-json")).toBeNull();
    expect(normalizeRankingReceipt({ ...receipt, organizer: { ...organizer, authority: "" } })).toBeNull();
    expect(() =>
      createRankingReceipt({
        aggregateBundle,
        organizer: { ...organizer, interpretation: "字".repeat(1_201) },
      }),
    ).toThrow(/完整填寫/);

    const oneSession = buildAggregateRankingBundleFromPairs({
      config: aggregateBundle.question,
      aggregate: {
        sessions: 1,
        pairwise: [
          { alpha: "item-1", beta: "item-2", alphaWins: 1, betaWins: 0, equal: 0 },
        ],
      },
      sourceUrl: "https://delib.mashbean.net/integrations/power-ranker.html",
    });
    expect(() => createRankingReceipt({ aggregateBundle: oneSession, organizer })).toThrow(
      /至少需要 3 份/,
    );
  });

  it("exports layered Markdown and a concise public summary", () => {
    const receipt = createRankingReceipt({ aggregateBundle, organizer });
    expect(decisionStatusLabel("under-review")).toBe("正在評估");
    expect(rankingReceiptToMarkdown(receipt)).toContain("## 主辦者解讀");
    expect(rankingReceiptToMarkdown(receipt)).toContain("## 未納入與限制");
    expect(rankingReceiptSummary(receipt)).toContain("下一步由 社區發展協會");
  });

  it("prepares a new local round with the same public options", () => {
    const receipt = createRankingReceipt({ aggregateBundle, organizer });
    const url = new URL(nextRoundRankingUrl(receipt, "https://delib.mashbean.net/"));
    const nextConfig = rankingConfigFromHash(url.hash);
    expect(url.pathname).toBe("/integrations/power-ranker.html");
    expect(nextConfig.title).toBe("公園下一步（下一輪）");
    expect(nextConfig.items.map((item) => item.label)).toEqual(["照明", "草地", "遊具"]);
  });
});
