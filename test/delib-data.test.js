import { describe, expect, it } from "vitest";
import {
  DELIB_DATA_SCHEMA,
  pocketPolisBundleToDelibData,
  rankingBundleToDelibData,
} from "../public/delib-data-core.js";
import {
  buildPocketPolisBundle,
  parsePocketPolisExports,
} from "../public/pocket-polis-data-core.js";
import {
  aggregateRankingBundles,
  buildIndividualRankingBundle,
  normalizeRankingConfig,
} from "../public/power-ranker-core.js";

const statementsCsv = `statement_id,text,status,is_seed,agrees,disagrees,passes,created_at
1,增加照明,approved,1,1,1,0,2026-09-01T00:00:00.000Z
`;
const votesCsv = `participant,statement_id,vote,updated_at
p1,1,1,2026-09-01T01:00:00.000Z
p2,1,-1,2026-09-01T01:01:00.000Z
`;

describe("delib-data/v1 adapters", () => {
  it("maps Pocket Polis items and participant-linked responses without hiding the privacy boundary", () => {
    const parsed = parsePocketPolisExports({ statementsCsv, votesCsv });
    const source = buildPocketPolisBundle({
      title: "公園下一步",
      description: "虛構測試",
      reportUrl: "https://polis.example/r/abc123def4",
      parsed,
      exportedAt: "2026-09-01T02:00:00.000Z",
      files: [
        { role: "statements", name: "statements.csv", size: 100, sha256: "a".repeat(64) },
        { role: "votes", name: "votes.csv", size: 100, sha256: "b".repeat(64) },
      ],
    });
    const portable = pocketPolisBundleToDelibData(source, "2026-09-01T03:00:00.000Z");
    expect(portable.schema).toBe(DELIB_DATA_SCHEMA);
    expect(portable.source.sourceSchema).toBe(source.schema);
    expect(portable.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "statement:1", type: "statement", origin: "organizer" }),
    ]));
    expect(portable.responses.map((item) => item.participantRef)).toEqual([
      "participant:p1",
      "participant:p2",
    ]);
    expect(portable.dataCard).toMatchObject({
      containsPseudonymousLinkage: true,
      suitableForPublicSharing: false,
      storedByDelib: false,
    });
  });

  it("distinguishes an individual ranking from a de-linked aggregate while preserving outcomes", () => {
    const config = normalizeRankingConfig({ title: "公園下一步", items: ["照明", "草地", "遊具"] });
    const judgments = [
      { alpha: "item-1", beta: "item-2", choice: "alpha" },
      { alpha: "item-2", beta: "item-3", choice: "alpha" },
    ];
    const first = buildIndividualRankingBundle({ config, judgments, sessionId: "session-one", sourceUrl: "https://delib.example/rank" });
    const second = buildIndividualRankingBundle({ config, judgments, sessionId: "session-two", sourceUrl: "https://delib.example/rank" });
    const individual = rankingBundleToDelibData(first, "2026-09-01T03:00:00.000Z");
    expect(individual.responses[0].participantRef).toBe("session:session-one");
    expect(individual.dataCard.suitableForPublicSharing).toBe(false);

    const aggregated = aggregateRankingBundles([first, second], "https://delib.example/rank").bundle;
    const portableAggregate = rankingBundleToDelibData(aggregated, "2026-09-01T03:00:00.000Z");
    expect(portableAggregate.responses.every((item) => item.participantRef === null)).toBe(true);
    expect(portableAggregate.outcomes).toHaveLength(3);
    expect(portableAggregate.dataCard).toMatchObject({
      containsPseudonymousLinkage: false,
      aggregation: "pair-counts-without-session-links",
      suitableForPublicSharing: true,
    });
  });
});
