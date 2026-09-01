import { describe, expect, it } from "vitest";
import {
  RECEIPT_HANDOFF_SCHEMA,
  RECEIPT_HANDOFF_TARGETS,
  createReceiptHandoff,
  normalizeReceiptHandoff,
  receiptHandoffTargetUrl,
} from "../public/receipt-handoff-core.js";
import { createRankingReceipt } from "../public/ranking-receipt-core.js";
import { buildAggregateRankingBundleFromPairs, normalizeRankingConfig } from "../public/power-ranker-core.js";
import schema from "../public/schemas/delib-handoff/v1.json" with { type: "json" };

const aggregateBundle = buildAggregateRankingBundleFromPairs({
  config: normalizeRankingConfig({ title: "公園下一步", items: ["照明", "草地", "遊具"] }),
  aggregate: {
    sessions: 37,
    pairwise: [
      { alpha: "item-1", beta: "item-2", alphaWins: 19, betaWins: 12, equal: 6 },
      { alpha: "item-2", beta: "item-3", alphaWins: 17, betaWins: 14, equal: 6 },
    ],
  },
  sourceUrl: "https://delib.mashbean.net/integrations/power-ranker.html?room=public#admin=secret",
});

const receipt = createRankingReceipt({
  aggregateBundle,
  preparedAt: "2026-09-01T04:00:00.000Z",
  organizer: {
    interpretation: "照明目前排在前面，但草地與遊具仍有接近的取捨。",
    missingVoices: "兒童、夜間使用者與行動不便者尚未被充分邀請。",
    decisionStatus: "under-review",
    authority: "公園改善工作小組",
    responsibleActor: "社區發展協會",
    responseBy: "2026-09-20",
    nextAction: "補訪尚未納入的使用者，並在公開會議逐項回覆。",
    evidenceUrl: "https://example.org/meeting-notes",
  },
});

describe("result receipt handoff", () => {
  it("publishes the stable schema and four bounded next-step targets", () => {
    expect(schema.$id).toBe(RECEIPT_HANDOFF_SCHEMA);
    expect(Object.keys(RECEIPT_HANDOFF_TARGETS)).toEqual([
      "call-in",
      "harmonica",
      "talk-to-the-city",
      "polis",
    ]);
  });

  it.each(["call-in", "harmonica", "talk-to-the-city", "polis"])(
    "creates a minimized %s draft without aggregate records or credentials",
    (target) => {
      const handoff = createReceiptHandoff({ receipt, target, createdAt: "2026-09-01T05:00:00.000Z" });
      const serialized = JSON.stringify(handoff);
      expect(handoff.target).toBe(target);
      expect(handoff.expiresAt).toBe("2026-09-01T07:00:00.000Z");
      expect(handoff.dataCard).toMatchObject({
        containsParticipantRecords: false,
        containsRawJudgments: false,
        containsSessionIds: false,
        containsCredentials: false,
        storage: "same-tab-session",
        externalWriteStatus: "not-started",
      });
      expect(serialized).not.toContain("alphaWins");
      expect(serialized).not.toContain("37");
      expect(serialized).not.toContain("admin=secret");
      expect(serialized).not.toContain("meeting-notes");
      expect(
        receiptHandoffTargetUrl(handoff, "https://delib.mashbean.net/", {
          now: Date.parse(handoff.createdAt),
        }),
      ).toContain(`#${RECEIPT_HANDOFF_TARGETS[target].hash}`);
    },
  );

  it("keeps Call-in behind its public deck and confirmation requirements", () => {
    const handoff = createReceiptHandoff({ receipt, target: "call-in" });
    expect(handoff.draft).toMatchObject({ needsDeckUrl: true });
    expect(handoff.draft).not.toHaveProperty("deckUrl");
    expect(handoff.draft.title.length).toBeLessThanOrEqual(120);
    expect(handoff.draft.description.length).toBeLessThanOrEqual(500);
  });

  it("prepares Harmonica follow-up questions but never carries an API key", () => {
    const handoff = createReceiptHandoff({ receipt, target: "harmonica" });
    expect(handoff.draft.questions).toHaveLength(3);
    expect(handoff.draft.questions.every((question) => question.length <= 240)).toBe(true);
    expect(handoff.draft.goal).toContain("未被充分納入");
    expect(handoff.draft).not.toHaveProperty("apiKey");
  });

  it("treats TTTC as a new de-identified text collection, not receipt analysis", () => {
    const handoff = createReceiptHandoff({ receipt, target: "talk-to-the-city" });
    expect(handoff.draft.description).toContain("已去識別的原始文字意見");
    expect(handoff.draft.description).toContain("不是 Talk to the City 的分析資料");
    expect(handoff.draft.description).not.toContain("。。");
    expect(handoff.draft).not.toHaveProperty("csv");
  });

  it("expires after two hours and rejects tampered targets or lifetimes", () => {
    const handoff = createReceiptHandoff({
      receipt,
      target: "polis",
      createdAt: "2026-09-01T05:00:00.000Z",
    });
    expect(normalizeReceiptHandoff(handoff, { now: Date.parse("2026-09-01T06:59:59.000Z") })).not.toBeNull();
    expect(normalizeReceiptHandoff(handoff, { now: Date.parse(handoff.expiresAt) })).toBeNull();
    expect(normalizeReceiptHandoff({ ...handoff, target: "unknown" }, { now: Date.parse(handoff.createdAt) })).toBeNull();
    expect(
      normalizeReceiptHandoff(
        { ...handoff, expiresAt: "2026-09-01T08:00:00.000Z" },
        { now: Date.parse(handoff.createdAt) },
      ),
    ).toBeNull();
  });
});
