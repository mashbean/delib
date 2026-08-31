import { describe, expect, it } from "vitest";
import {
  RANKING_SCHEMA,
  aggregateRankingBundles,
  buildAggregateRankingBundleFromPairs,
  buildIndividualRankingBundle,
  normalizeRankingConfig,
  rankJudgments,
  rankingConfigFromHash,
  rankingConfigToHash,
  recommendedComparisonCount,
  selectNextPair,
} from "../public/power-ranker-core.js";

const config = normalizeRankingConfig({
  title: "公園下一步",
  items: ["照明", "草地", "遊具"],
});

const judgments = [
  { alpha: "item-1", beta: "item-2", choice: "alpha" },
  { alpha: "item-2", beta: "item-3", choice: "alpha" },
  { alpha: "item-1", beta: "item-3", choice: "alpha" },
];

describe("Power Ranker browser port", () => {
  it("round trips a public question through URL fragment parameters", () => {
    const hash = rankingConfigToHash(config);
    expect(hash).toContain("title=");
    expect(rankingConfigFromHash(`#${hash}`)).toEqual(config);
  });

  it("rejects duplicate or undersized option sets", () => {
    expect(normalizeRankingConfig({ title: "問題", items: ["A", "a", "B"] })).toBeNull();
    expect(normalizeRankingConfig({ title: "問題", items: ["A", "B"] })).toBeNull();
  });

  it("produces the expected rank-centrality order", () => {
    const result = rankJudgments(config.items, judgments);
    expect(result.map((item) => item.id)).toEqual(["item-1", "item-2", "item-3"]);
    expect(result.reduce((sum, item) => sum + item.score, 0)).toBeCloseTo(1, 6);
  });

  it("canonicalizes reversed pair orientation without changing the winner", () => {
    const forward = rankJudgments(config.items, [
      { alpha: "item-1", beta: "item-2", choice: "alpha" },
    ]);
    const reversed = rankJudgments(config.items, [
      { alpha: "item-2", beta: "item-1", choice: "beta" },
    ]);
    expect(reversed).toEqual(forward);
  });

  it("starts with a connected comparison chain and sets a bounded target", () => {
    expect(selectNextPair(config.items, [])).toEqual({ alpha: "item-1", beta: "item-2" });
    expect(selectNextPair(config.items, [judgments[0]])).toEqual({ alpha: "item-2", beta: "item-3" });
    expect(recommendedComparisonCount(10)).toBe(18);
  });

  it("exports participant data explicitly without persisting it", () => {
    const bundle = buildIndividualRankingBundle({
      config,
      judgments,
      sessionId: "session-example-1",
      sourceUrl: "https://delib.example/integrations/power-ranker.html#question",
      exportedAt: "2026-08-31T00:00:00.000Z",
    });
    expect(bundle.schema).toBe(RANKING_SCHEMA);
    expect(bundle.kind).toBe("individual");
    expect(bundle.dataCard).toMatchObject({
      containsParticipantData: true,
      containsDirectIdentifiers: false,
      storedByDelib: false,
    });
  });

  it("deduplicates sessions and drops individual linkage in aggregates", () => {
    const first = buildIndividualRankingBundle({
      config,
      judgments,
      sessionId: "session-example-1",
      sourceUrl: "https://delib.example/",
    });
    const second = buildIndividualRankingBundle({
      config,
      judgments: judgments.map((judgment) => ({ ...judgment, choice: "beta" })),
      sessionId: "session-example-2",
      sourceUrl: "https://delib.example/",
    });
    const outcome = aggregateRankingBundles([first, first, second], "https://delib.example/");
    expect(outcome.accepted).toBe(2);
    expect(outcome.duplicates).toBe(1);
    expect(outcome.bundle.kind).toBe("aggregate");
    expect(outcome.bundle.aggregate.sessions).toBe(2);
    expect(outcome.bundle).not.toHaveProperty("judgments");
    expect(outcome.bundle.dataCard.aggregation).toBe("pair-counts-without-session-links");
  });

  it("rebuilds a portable aggregate from stored pair counts", () => {
    const bundle = buildAggregateRankingBundleFromPairs({
      config,
      aggregate: {
        sessions: 3,
        pairwise: [
          { alpha: "item-1", beta: "item-2", alphaWins: 2, betaWins: 1, equal: 0 },
          { alpha: "item-2", beta: "item-3", alphaWins: 3, betaWins: 0, equal: 0 },
        ],
      },
      sourceUrl: "https://delib.example/integrations/power-ranker.html?room=public",
      expiresAt: Date.parse("2026-09-01T00:00:00.000Z"),
    });
    expect(bundle.aggregate.sessions).toBe(3);
    expect(bundle.aggregate.judgments).toBe(6);
    expect(bundle.result.map((item) => item.id)).toEqual(["item-1", "item-2", "item-3"]);
    expect(bundle.dataCard).toMatchObject({
      storedByDelib: true,
      publicationStatus: "ephemeral-room-aggregate",
    });
  });
});
