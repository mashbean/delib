import { describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { SELF, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import worker, {
  handleCallInRequest,
  handlePocketPolisSynthesisRequest,
  handlePublicReceiptRequest,
  handleRankingRoomRequest,
} from "./index";
import { sha256 } from "./ranking-room";
import type { PublicReceipt } from "./public-receipt";

const publicReceiptEnv = env as unknown as Parameters<typeof handlePublicReceiptRequest>[1];
const rankingEnv = env as unknown as Parameters<typeof handleRankingRoomRequest>[1];
const workerEnv = env as unknown as Parameters<typeof worker.fetch>[1];
type IncomingRequest = Parameters<typeof worker.fetch>[0];
const incoming = (request: Request): IncomingRequest => request as unknown as IncomingRequest;

function organizerFixture() {
  return {
    interpretation: "仍有取捨需要討論。",
    missingVoices: "尚未納入夜間使用者。",
    decisionStatus: "listening",
    authority: "社區公園工作小組",
    responsibleActor: "公園小組召集人",
    responseBy: "2026-10-01",
    nextAction: "兩週內公開回覆。",
    evidenceUrl: "",
  };
}

function pocketReceiptFixture() {
  return {
    schema: "https://delib.mashbean.net/schemas/delib-pocket-polis-receipt/v1.json",
    kind: "pocket-polis-receipt",
    preparedAt: "2026-09-01T00:00:00.000Z",
    source: {
      tool: "Pocket Polis",
      title: "虛構公園測試",
      description: "只用來驗證公開成果短網址",
      conversationId: "abc123def4",
      reportUrl: "https://polis.example/r/abc123def4",
      sourceExportedAt: "2026-09-01T00:00:00.000Z",
      sourceCountMatches: true,
    },
    scope: { participants: 3, approvedStatements: 1, totalVotes: 3, coverage: 1, includedStatements: 1 },
    findings: [{ statementId: 1, text: "增加照明", isSeed: true, agrees: 2, disagrees: 1, passes: 0, responses: 3 }],
    organizer: organizerFixture(),
    dataCard: {
      containsParticipantData: true,
      containsDirectIdentifiers: false,
      containsParticipantRecords: false,
      containsParticipantFreeText: true,
      containsPseudonymousLinkage: false,
      containsOrganizerFreeText: true,
      aggregation: "selected-statement-counts",
      publicationStatus: "share-link-prepared",
      storedByDelib: false,
      transport: "url-fragment",
      limitations: ["虛構資料"],
    },
  };
}

function rankingReceiptFixture(aggregateUrl = "https://delib.example/integrations/power-ranker?room=0123") {
  return {
    schema: "https://delib.mashbean.net/schemas/delib-ranking-receipt/v1.json",
    kind: "ranking-receipt",
    preparedAt: "2026-09-01T00:00:00.000Z",
    source: {
      generator: "Delib · Power Ranker",
      aggregateStorage: "local",
      aggregateUrl,
      aggregateExpiresAt: null,
    },
    question: {
      title: "公園下一步",
      items: [
        { id: "item-1", label: "照明" },
        { id: "item-2", label: "草地" },
        { id: "item-3", label: "遊具" },
      ],
    },
    method: {
      name: "rankCentrality",
      normalization: "unit-sum",
      flow: "pairwise",
      source: "PowerRanker",
      implementation: "browser",
    },
    aggregate: {
      sessions: 3,
      judgments: 6,
      pairwise: [
        { alpha: "item-1", beta: "item-2", alphaWins: 2, betaWins: 1, equal: 0, total: 3 },
        { alpha: "item-2", beta: "item-3", alphaWins: 2, betaWins: 1, equal: 0, total: 3 },
      ],
    },
    result: [
      { id: "item-1", label: "照明", score: 0.5, observations: 3, rank: 1 },
      { id: "item-2", label: "草地", score: 0.3, observations: 6, rank: 2 },
      { id: "item-3", label: "遊具", score: 0.2, observations: 3, rank: 3 },
    ],
    coverage: { comparedPairs: 2, totalPairs: 3, ratio: 2 / 3 },
    organizer: organizerFixture(),
    dataCard: {
      containsParticipantData: true,
      containsDirectIdentifiers: false,
      containsParticipantFreeText: false,
      containsOrganizerFreeText: true,
      aggregation: "pair-counts-without-session-links",
      publicationStatus: "share-link-prepared",
      storedByDelib: false,
      transport: "url-fragment",
      limitations: ["虛構資料"],
    },
  };
}

async function publish(receipt: unknown, envOverride = publicReceiptEnv) {
  return handlePublicReceiptRequest(
    new Request("https://delib.example/api/receipts", {
      method: "POST",
      headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
      body: JSON.stringify({ receipt, retentionDays: 30, confirmed: true }),
    }),
    envOverride,
  );
}

describe("router", () => {
  it("reports the service version on GET and HEAD health checks", async () => {
    const response = await SELF.fetch("https://delib.example/api/health");
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; version: string; build: { versionId: string | null } };
    expect(body.ok).toBe(true);
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(body.build).toHaveProperty("versionId");

    const head = await SELF.fetch("https://delib.example/api/health", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });

  it("answers unknown API paths with JSON instead of the asset fallback", async () => {
    const response = await SELF.fetch("https://delib.example/api/does-not-exist");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not found" });
  });

  it("does not create storage when an unknown public receipt slug is read", async () => {
    const slug = "0123456789abcdef";
    const response = await SELF.fetch(`https://delib.example/r/${slug}`);
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toContain("成果收據");

    const api = await SELF.fetch(`https://delib.example/api/receipts/${slug}`);
    expect(api.status).toBe(404);

    const stub = env.PUBLIC_RECEIPTS.getByName(slug);
    await runInDurableObject(stub, async (_instance: PublicReceipt, state) => {
      const tables = state.storage.sql
        .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
        .toArray()
        .map((row) => row.name)
        .filter((name) => !name.startsWith("_cf_"));
      expect(tables).toEqual([]);
    });
  });

  it("keeps a deleted receipt empty even after it is read again", async () => {
    const created = await publish(pocketReceiptFixture());
    expect(created.status).toBe(201);
    const body = await created.json() as { publicUrl: string; manageUrl: string };
    const slug = new URL(body.publicUrl).pathname.split("/").pop() || "";
    const token = new URL(body.manageUrl).hash.replace(/^#delete=/, "");

    const removed = await handlePublicReceiptRequest(
      new Request(`https://delib.example/api/receipts/${slug}`, {
        method: "DELETE",
        headers: { Origin: "https://delib.example", "X-Receipt-Admin": token },
      }),
      publicReceiptEnv,
    );
    expect(removed.status).toBe(200);

    const afterwards = await SELF.fetch(`https://delib.example/api/receipts/${slug}`);
    expect(afterwards.status).toBe(404);
    const stub = env.PUBLIC_RECEIPTS.getByName(slug);
    await runInDurableObject(stub, async (_instance: PublicReceipt, state) => {
      const tables = state.storage.sql
        .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
        .toArray()
        .filter((row) => !row.name.startsWith("_cf_"));
      expect(tables).toEqual([]);
      expect(await state.storage.getAlarm()).toBeNull();
    });
  });

  it("lets a configured operator take down a public receipt without the private token", async () => {
    const created = await publish(pocketReceiptFixture());
    const body = await created.json() as { publicUrl: string };
    const slug = new URL(body.publicUrl).pathname.split("/").pop() || "";
    const operatorEnv = { ...publicReceiptEnv, OPERATOR_TOKEN_SHA256: await sha256("operator-secret") };
    const deleteRequest = (token: string) =>
      new Request(`https://delib.example/api/receipts/${slug}`, {
        method: "DELETE",
        headers: { Origin: "https://delib.example", "X-Receipt-Operator": token },
      });

    const unconfigured = await handlePublicReceiptRequest(deleteRequest("operator-secret"), publicReceiptEnv);
    expect(unconfigured.status).toBe(403);
    const wrong = await handlePublicReceiptRequest(deleteRequest("wrong-secret"), operatorEnv);
    expect(wrong.status).toBe(403);
    const removed = await handlePublicReceiptRequest(deleteRequest("operator-secret"), operatorEnv);
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ status: "deleted" });
  });

  it("accepts ranking receipts only when the aggregate lives on this deployment", async () => {
    const sameOrigin = await publish(rankingReceiptFixture());
    expect(sameOrigin.status).toBe(201);
    const foreign = await publish(rankingReceiptFixture("https://evil.example/integrations/power-ranker"));
    expect(foreign.status).toBe(400);
  });

  it("rejects Pocket Polis receipts whose report link is not a public result page", async () => {
    const receipt = pocketReceiptFixture();
    receipt.source.reportUrl = "https://polis.example/a/abc123def4";
    expect((await publish(receipt)).status).toBe(400);
    receipt.source.reportUrl = "https://polis.example/r/zzzzzzzzzz";
    expect((await publish(receipt)).status).toBe(400);
  });

  it("maps upstream timeouts to 504 without leaking details", async () => {
    const response = await handleCallInRequest(
      new Request("https://delib.example/api/integrations/call-in", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({ title: "說明會", deckUrl: "https://deck.example/slides", confirmed: true }),
      }),
      async () => {
        throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
      },
    );
    expect(response.status).toBe(504);
    const body = await response.json() as { error: string };
    expect(body.error).toContain("逾時");
    expect(body.error).not.toContain("aborted");
  });

  it("applies the write rate limit to API writes and fails open when the limiter breaks", async () => {
    const limitedEnv = {
      ...workerEnv,
      WRITE_LIMIT: { limit: async () => ({ success: false }) },
    };
    const blocked = await worker.fetch(
      incoming(new Request("https://delib.example/api/receipts", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.5" },
        body: JSON.stringify({ receipt: {}, retentionDays: 30, confirmed: true }),
      })),
      limitedEnv,
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("60");

    const readStillWorks = await worker.fetch(incoming(new Request("https://delib.example/api/health")), limitedEnv);
    expect(readStillWorks.status).toBe(200);

    const brokenEnv = {
      ...workerEnv,
      WRITE_LIMIT: { limit: async () => { throw new Error("limiter down"); } },
    };
    const passedThrough = await worker.fetch(
      incoming(new Request("https://delib.example/api/receipts", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({ receipt: {}, retentionDays: 30, confirmed: false }),
      })),
      brokenEnv,
    );
    expect(passedThrough.status).toBe(400);
  });

  it("turns unexpected exceptions into a JSON 500 instead of an HTML error page", async () => {
    const explodingEnv = {
      ...workerEnv,
      PUBLIC_RECEIPTS: { getByName: () => { throw new Error("boom"); } },
    };
    const response = await worker.fetch(incoming(new Request("https://delib.example/api/receipts/0123456789abcdef")), explodingEnv);
    expect(response.status).toBe(500);
    const body = await response.json() as { error: string };
    expect(body.error).not.toContain("boom");
  });
});

describe("organizer controls and tool synthesis", () => {
  async function createRoom() {
    const response = await handleRankingRoomRequest(
      new Request("https://delib.example/api/integrations/power-ranker/rooms", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({ title: "公園下一步", items: ["照明", "草地", "遊具"], retentionHours: 24, confirmed: true }),
      }),
      rankingEnv,
    );
    expect(response.status).toBe(201);
    return (await response.json()) as { roomId: string; manageUrl: string };
  }

  function submission(roomId: string, sessionId: string) {
    return new Request(`https://delib.example/api/integrations/power-ranker/rooms/${roomId}/submissions`, {
      method: "POST",
      headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        judgments: [
          { alpha: "item-1", beta: "item-2", choice: "alpha" },
          { alpha: "item-2", beta: "item-3", choice: "alpha" },
        ],
      }),
    });
  }

  it("lets the organizer stop accepting results while keeping the aggregate readable", async () => {
    const room = await createRoom();
    const adminToken = new URL(room.manageUrl).hash.replace(/^#admin=/, "");
    expect((await handleRankingRoomRequest(submission(room.roomId, "session-aaaa-1"), rankingEnv)).status).toBe(201);

    const unauthenticated = await handleRankingRoomRequest(
      new Request(`https://delib.example/api/integrations/power-ranker/rooms/${room.roomId}/close`, {
        method: "POST",
        headers: { Origin: "https://delib.example" },
      }),
      rankingEnv,
    );
    expect(unauthenticated.status).toBe(401);

    const closed = await handleRankingRoomRequest(
      new Request(`https://delib.example/api/integrations/power-ranker/rooms/${room.roomId}/close`, {
        method: "POST",
        headers: { Origin: "https://delib.example", "X-Ranking-Admin": adminToken },
      }),
      rankingEnv,
    );
    expect(closed.status).toBe(200);
    const snapshot = await closed.json() as { closedByOrganizer: boolean; acceptingSubmissions: boolean; sessionsReceived: number };
    expect(snapshot.closedByOrganizer).toBe(true);
    expect(snapshot.acceptingSubmissions).toBe(false);
    expect(snapshot.sessionsReceived).toBe(1);

    const rejected = await handleRankingRoomRequest(submission(room.roomId, "session-bbbb-2"), rankingEnv);
    expect(rejected.status).toBe(409);
    expect(((await rejected.json()) as { error: string }).error).toContain("停止收件");

    const publicView = await handleRankingRoomRequest(
      new Request(`https://delib.example/api/integrations/power-ranker/rooms/${room.roomId}`),
      rankingEnv,
    );
    expect(publicView.status).toBe(200);
    expect(((await publicView.json()) as { closedByOrganizer: boolean }).closedByOrganizer).toBe(true);
  });

  it("keeps an operator-only registry of live receipt slugs", async () => {
    const operatorEnv = { ...publicReceiptEnv, OPERATOR_TOKEN_SHA256: await sha256("operator-secret") };
    const created = await publish(pocketReceiptFixture(), operatorEnv);
    expect(created.status).toBe(201);
    const slug = new URL(((await created.json()) as { publicUrl: string }).publicUrl).pathname.split("/").pop() || "";

    const anonymous = await handlePublicReceiptRequest(new Request("https://delib.example/api/receipts"), operatorEnv);
    expect(anonymous.status).toBe(401);
    const listing = await handlePublicReceiptRequest(
      new Request("https://delib.example/api/receipts", { headers: { "X-Receipt-Operator": "operator-secret" } }),
      operatorEnv,
    );
    expect(listing.status).toBe(200);
    const body = (await listing.json()) as { entries: Array<{ slug: string; kind: string }> };
    expect(body.entries.map((entry) => entry.slug)).toContain(slug);
    expect(body.entries.find((entry) => entry.slug === slug)?.kind).toBe("pocket-polis-receipt");

    await runDurableObjectAlarm(env.PUBLIC_RECEIPTS.getByName(slug));
    const afterAlarm = await handlePublicReceiptRequest(
      new Request("https://delib.example/api/receipts", { headers: { "X-Receipt-Operator": "operator-secret" } }),
      operatorEnv,
    );
    const remaining = (await afterAlarm.json()) as { entries: Array<{ slug: string }> };
    expect(remaining.entries.map((entry) => entry.slug)).not.toContain(slug);
  });

  it("proxies a Pocket Polis synthesis with provenance and without unlisted fields", async () => {
    const upstream = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        version: "v1",
        status: "ready",
        generationMode: "ai",
        model: "@cf/google/gemma-4-26b-a4b-it",
        generatedAt: 1788325567906,
        mathRevision: 1788325565622,
        isStale: true,
        provenance: { participantCount: 118, clusteredCount: 115, statementCount: 24, voteCount: 2768, groupCount: 2 },
        lang: "zh",
        overview: { summary: "兩大陣營在財政手段上分歧。", participantContext: "共 118 位參與者", citedStatementIds: [9, 11, 12] },
        themes: [{ id: "t1", title: "軍購策略", description: "裝備優先順序", statementIds: [3, 4] }],
        commonGround: { summary: "3 項共通價值", keyPoints: [{ title: "強化韌性", description: "同步投入民防", direction: "agree", citedStatementIds: [11] }] },
        groupPortraits: [{ groupId: 0, groupLabel: "A 群", size: 51, title: "務實派", summary: "重視監督", keyStances: [{ sid: 2, stance: "agree", summary: "…" }], citedStatementIds: [2] }],
        tensions: [{ groupAId: 0, groupALabel: "A 群", groupBId: 1, groupBLabel: "B 群", topic: "舉債", groupAPerspective: "可接受", groupBPerspective: "反對", tensions: "財政觀不同", bridgingQuestion: "哪些支出能分期？", citedStatementIds: [2] }],
        participantIds: ["p1", "p2"],
      }));
    const response = await handlePocketPolisSynthesisRequest(
      new Request("https://delib.example/api/integrations/pocket-polis/synthesis?conversation=3ovoxq5c6o"),
      upstream,
      "https://polis.example",
    );
    expect(response.status).toBe(200);
    expect(upstream.mock.calls[0][0]).toBe("https://polis.example/api/conversations/3ovoxq5c6o/synthesis");
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe("ready");
    expect(body.model).toBe("@cf/google/gemma-4-26b-a4b-it");
    expect(body.generatedAt).toBe("2026-09-02T05:06:07.906Z");
    expect(body.sourceUrl).toBe("https://polis.example/r/3ovoxq5c6o");
    expect(body).not.toHaveProperty("participantIds");
    expect(body).not.toHaveProperty("version");
    expect((body.groupPortraits as Array<Record<string, unknown>>)[0]).not.toHaveProperty("keyStances");
    expect((body.tensions as Array<Record<string, unknown>>)[0]).not.toHaveProperty("groupAId");

    const invalid = await handlePocketPolisSynthesisRequest(
      new Request("https://delib.example/api/integrations/pocket-polis/synthesis?conversation=BAD"),
      upstream,
      "https://polis.example",
    );
    expect(invalid.status).toBe(400);

    const pending = await handlePocketPolisSynthesisRequest(
      new Request("https://delib.example/api/integrations/pocket-polis/synthesis?conversation=3ovoxq5c6o"),
      async () => Response.json({ status: "pending", jobId: "secret-job", retryAfterMs: 5000 }),
      "https://polis.example",
    );
    const pendingBody = (await pending.json()) as Record<string, unknown>;
    expect(pendingBody.status).toBe("pending");
    expect(pendingBody.retryAfterMs).toBe(5000);
    expect(pendingBody).not.toHaveProperty("jobId");
  });

  it("accepts a bounded tool synthesis layer inside a public receipt", async () => {
    const withSynthesis = pocketReceiptFixture() as Record<string, unknown>;
    withSynthesis.toolSynthesis = {
      tool: "Pocket Polis",
      model: "@cf/google/gemma-4-26b-a4b-it",
      generationMode: "ai",
      generatedAt: "2026-09-02T05:06:07.906Z",
      mathRevision: 1788325565622,
      isStale: false,
      overview: "兩大陣營在財政手段上分歧。",
      commonGround: [{ title: "強化韌性", description: "同步投入民防", direction: "agree", citedStatementIds: [1] }],
      tensions: [],
    };
    expect((await publish(withSynthesis)).status).toBe(201);

    const unlisted = { ...withSynthesis, toolSynthesis: { ...(withSynthesis.toolSynthesis as object), participants: ["p1"] } };
    expect((await publish(unlisted)).status).toBe(400);

    const empty = { ...withSynthesis, toolSynthesis: { ...(withSynthesis.toolSynthesis as object), overview: "", commonGround: [] } };
    expect((await publish(empty)).status).toBe(400);
  });

  it("rejects ranking receipts whose arithmetic does not add up", async () => {
    const broken = rankingReceiptFixture() as { aggregate: { judgments: number }; result: Array<{ rank: number }> };
    broken.aggregate.judgments = 7;
    expect((await publish(broken)).status).toBe(400);
    const duplicateRank = rankingReceiptFixture() as { result: Array<{ rank: number }> };
    duplicateRank.result[1].rank = 1;
    expect((await publish(duplicateRank)).status).toBe(400);
  });
});
