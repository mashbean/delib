import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { SELF, runInDurableObject } from "cloudflare:test";
import worker, {
  handleCallInRequest,
  handlePublicReceiptRequest,
} from "./index";
import { sha256 } from "./ranking-room";
import type { PublicReceipt } from "./public-receipt";

const publicReceiptEnv = env as unknown as Parameters<typeof handlePublicReceiptRequest>[1];
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
    coverage: { comparedPairs: 2, totalPairs: 3, ratio: 0.67 },
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
