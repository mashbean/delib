import { describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import {
  collectOutputText,
  handleAgoraRequest,
  handleAgentRequest,
  handleCallInRequest,
  handleHeyFormRequest,
  handleHarmonicaRequest,
  handlePolisRequest,
  handleRankingRoomRequest,
  handleTttcRequest,
  parseAgoraConversationSlug,
  parseHeyFormId,
  parsePolisConversationId,
} from "./index";

const rankingEnv = env as unknown as Parameters<typeof handleRankingRoomRequest>[1];

const roomJudgments = [
  { alpha: "item-1", beta: "item-2", choice: "alpha" },
  { alpha: "item-2", beta: "item-3", choice: "alpha" },
];

async function createRankingRoom() {
  const response = await handleRankingRoomRequest(
    new Request("https://delib.example/api/integrations/power-ranker/rooms", {
      method: "POST",
      headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "公園下一步",
        items: ["照明", "草地", "遊具"],
        retentionHours: 24,
        confirmed: true,
      }),
    }),
    rankingEnv,
  );
  expect(response.status).toBe(201);
  return (await response.json()) as {
    roomId: string;
    participantUrl: string;
    manageUrl: string;
    expiresAt: number;
  };
}

const plan = {
  goal: "listen",
  format: "hybrid",
  scale: "medium",
  privacy: "pseudonymous",
  output: "receipt",
  tools: [{ id: "call-in", name: "Call-in", summary: "即時提問" }],
  offlineGears: [{ title: "審議前", description: "說明資料用途" }],
};

describe("collectOutputText", () => {
  it("collects every output_text item instead of assuming the first item", () => {
    expect(
      collectOutputText({
        output: [
          { type: "reasoning", content: [] },
          {
            type: "message",
            content: [
              { type: "output_text", text: "第一段" },
              { type: "refusal", refusal: "ignored" },
              { type: "output_text", text: "第二段" },
            ],
          },
        ],
      }),
    ).toBe("第一段\n第二段");
  });

  it("returns an empty string for malformed payloads", () => {
    expect(collectOutputText({ output: null })).toBe("");
  });
});

describe("handleAgentRequest", () => {
  it("rejects missing keys before calling upstream", async () => {
    const upstream = vi.fn();
    const response = await handleAgentRequest(
      new Request("https://delib.example/api/agent", {
        method: "POST",
        body: JSON.stringify({ plan }),
      }),
      upstream,
    );
    expect(response.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("forwards a bounded no-store Responses API request", async () => {
    const upstream = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.store).toBe(false);
      expect(body.model).toBe("gpt-5.6");
      expect(String(body.instructions)).toContain("不是決策者");
      return Response.json({
        output: [{ content: [{ type: "output_text", text: "可執行簡報" }] }],
      });
    });
    const response = await handleAgentRequest(
      new Request("https://delib.example/api/agent", {
        method: "POST",
        headers: {
          Origin: "https://delib.example",
          "Content-Type": "application/json",
          "X-OpenAI-Key": `sk-${"a".repeat(40)}`,
        },
        body: JSON.stringify({ plan, context: "社區公園議題" }),
      }),
      upstream as typeof fetch,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: "可執行簡報", model: "gpt-5.6" });
  });

  it("does not echo upstream error bodies", async () => {
    const response = await handleAgentRequest(
      new Request("https://delib.example/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OpenAI-Key": `sk-${"a".repeat(40)}`,
        },
        body: JSON.stringify({ plan }),
      }),
      vi.fn(async () => new Response("secret upstream detail", { status: 500 })) as typeof fetch,
    );
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret upstream detail");
  });
});

describe("direct integrations", () => {
  it("parses only public Pol.is conversation identifiers", () => {
    expect(parsePolisConversationId("https://pol.is/2demo")).toBe("2demo");
    expect(parsePolisConversationId("https://pol.is/m2demo")).toBe("2demo");
    expect(parsePolisConversationId("2demo")).toBe("2demo");
    expect(parsePolisConversationId("https://example.com/2demo")).toBeNull();
  });

  it("builds an in-site Pol.is workspace without storing credentials", async () => {
    const response = await handlePolisRequest(
      new Request("https://delib.example/api/integrations/polis", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "existing", conversation: "https://pol.is/2demo", confirmed: true }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.workspaceUrl).toBe("https://delib.example/integrations/polis.html?conversation=2demo");
    expect(body.storedByDelib).toBe(false);
  });

  it("requires a human confirmation before a site embed can create a Pol.is conversation", async () => {
    const response = await handlePolisRequest(
      new Request("https://delib.example/api/integrations/polis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "site", siteId: "42", title: "公園議題" }),
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("確認") });
  });

  it("uses a deployment-connected Pol.is Site ID without asking the organizer again", async () => {
    const response = await handlePolisRequest(
      new Request("https://delib.example/api/integrations/polis", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "site", title: "公園議題", confirmed: true }),
      }),
      "polis_site_id_example",
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      siteId: "polis_site_id_example",
      siteSource: "deployment",
      writesWhenOpened: true,
    });
  });

  it("accepts only public HeyForm form IDs or canonical URLs", () => {
    expect(parseHeyFormId("https://heyform.net/f/dCN9pF7U")).toBe("dCN9pF7U");
    expect(parseHeyFormId("dCN9pF7U")).toBe("dCN9pF7U");
    expect(parseHeyFormId("https://my.heyform.net/project/private")).toBeNull();
    expect(parseHeyFormId("https://example.com/f/dCN9pF7U")).toBeNull();
  });

  it("prepares a HeyForm participant workspace without receiving form answers", async () => {
    const response = await handleHeyFormRequest(
      new Request("https://delib.example/api/integrations/heyform", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({ form: "https://heyform.net/f/dCN9pF7U", confirmed: true }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      workspaceUrl: "https://delib.example/integrations/heyform.html?form=dCN9pF7U",
      storedByDelib: false,
      writesWhenSubmitted: true,
    });
  });

  it("accepts only official public Agora Citizen Network conversation URLs", () => {
    expect(
      parseAgoraConversationSlug("https://agoracitizen.network/feed/conversation/ss_4Cg/"),
    ).toBe("ss_4Cg");
    expect(
      parseAgoraConversationSlug("https://www.agoracitizen.app/conversation/nRAynpw/embed"),
    ).toBe("nRAynpw");
    expect(parseAgoraConversationSlug("ss_4Cg")).toBeNull();
    expect(parseAgoraConversationSlug("https://example.com/conversation/ss_4Cg")).toBeNull();
    expect(
      parseAgoraConversationSlug("https://www.agoracitizen.app/conversation/ss_4Cg?admin=true"),
    ).toBeNull();
  });

  it("prepares a current Agora embed workspace without proxying participation", async () => {
    const response = await handleAgoraRequest(
      new Request("https://delib.example/api/integrations/agora", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation: "https://agoracitizen.network/feed/conversation/ss_4Cg/embed",
          confirmed: true,
        }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      integration: "agora-citizen-network",
      workspaceUrl: "https://delib.example/integrations/agora.html?conversation=ss_4Cg",
      participantUrl: "https://www.agoracitizen.app/conversation/ss_4Cg",
      embedUrl: "https://www.agoracitizen.app/conversation/ss_4Cg/embed",
      storedByDelib: false,
      writesWhenOpened: false,
      writesWhenParticipating: true,
    });
  });

  it("requires confirmation before opening an Agora workspace", async () => {
    const response = await handleAgoraRequest(
      new Request("https://delib.example/api/integrations/agora", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation: "https://www.agoracitizen.app/conversation/ss_4Cg",
        }),
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("確認") });
  });

  it("prepares the current Talk to the City create UI with bounded public context", async () => {
    const response = await handleTttcRequest(
      new Request("https://delib.example/api/integrations/tttc", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({ title: "公園訪談", description: "已去識別的訪談", confirmed: true }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.workspaceUrl).toBe(
      "https://delib.example/integrations/tttc.html?title=%E5%85%AC%E5%9C%92%E8%A8%AA%E8%AB%87&description=%E5%B7%B2%E5%8E%BB%E8%AD%98%E5%88%A5%E7%9A%84%E8%A8%AA%E8%AB%87",
    );
    expect(body.writesWhenOpened).toBe(false);
    expect(body.storedByDelib).toBe(false);
  });

  it("creates a Harmonica session without echoing or storing the API key", async () => {
    const upstream = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Authorization: `Bearer hm_live_${"a".repeat(32)}`,
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        topic: "公園深度對話",
        goal: "理解居民在意的取捨",
        context: "資料已去識別",
        questions: [{ text: "你最在意什麼？" }],
        cross_pollination: false,
      });
      return Response.json(
        {
          id: "session_12345678",
          topic: "公園深度對話",
          goal: "理解居民在意的取捨",
          join_url: "https://app.harmonica.chat/chat?s=session_12345678",
          internal: "must not leak",
        },
        { status: 201 },
      );
    });
    const response = await handleHarmonicaRequest(
      new Request("https://delib.example/api/integrations/harmonica", {
        method: "POST",
        headers: {
          Origin: "https://delib.example",
          "Content-Type": "application/json",
          "X-Harmonica-Key": `hm_live_${"a".repeat(32)}`,
        },
        body: JSON.stringify({
          topic: "公園深度對話",
          goal: "理解居民在意的取捨",
          context: "資料已去識別",
          questions: ["你最在意什麼？"],
          confirmed: true,
        }),
      }),
      upstream as typeof fetch,
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      participantUrl: "https://app.harmonica.chat/chat?s=session_12345678",
      workspaceUrl:
        "https://delib.example/integrations/harmonica.html?session=session_12345678&title=%E5%85%AC%E5%9C%92%E6%B7%B1%E5%BA%A6%E5%B0%8D%E8%A9%B1",
      storedByDelib: false,
      credentialStoredByDelib: false,
    });
    expect(body).not.toHaveProperty("internal");
  });

  it("rejects malformed Harmonica keys before calling upstream", async () => {
    const upstream = vi.fn();
    const response = await handleHarmonicaRequest(
      new Request("https://delib.example/api/integrations/harmonica", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Harmonica-Key": "not-a-key" },
        body: JSON.stringify({ topic: "公園", goal: "理解需求", confirmed: true }),
      }),
      upstream,
    );
    expect(response.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("creates a filtered ephemeral Call-in instance", async () => {
    const upstream = vi.fn(async () =>
      Response.json(
        {
          eventId: "a".repeat(32),
          title: "社區說明會",
          expiresAt: 1_800_000_000_000,
          audienceUrl: `https://call-in.example/e/${"a".repeat(32)}/`,
          presenterUrl: `https://call-in.example/e/${"a".repeat(32)}/present/`,
          setupUrl: `https://call-in.example/e/${"a".repeat(32)}/setup/#access=private-admin-token`,
          moderatorUrl: `https://call-in.example/e/${"a".repeat(32)}/moderate/#access=private-mod-token`,
          internal: "must not leak",
        },
        { status: 201 },
      ),
    );
    const response = await handleCallInRequest(
      new Request("https://delib.example/api/integrations/call-in", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "社區說明會",
          deckUrl: "https://slides.example/deck/",
          confirmed: true,
        }),
      }),
      upstream as typeof fetch,
      "https://call-in.example",
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe("ready");
    expect(body).not.toHaveProperty("internal");
    expect(upstream).toHaveBeenCalledOnce();
  });
});

describe("Power Ranker ephemeral rooms", () => {
  it("aggregates three sessions, deduplicates hashes, and supports verified deletion", async () => {
    const room = await createRankingRoom();
    const roomPath = `https://delib.example/api/integrations/power-ranker/rooms/${room.roomId}`;
    const adminToken = new URL(room.manageUrl).hash.replace(/^#admin=/, "");
    expect(new URL(room.participantUrl).hash).toBe("");
    expect(adminToken).toMatch(/^[a-f0-9]{64}$/);

    const adminResponse = await handleRankingRoomRequest(
      new Request(roomPath, { headers: { "X-Ranking-Admin": adminToken } }),
      rankingEnv,
    );
    await expect(adminResponse.json()).resolves.toMatchObject({
      admin: true,
      sessionsReceived: 0,
      aggregate: { sessions: 0, pairwise: [] },
    });

    for (const sessionId of ["session-one", "session-two"]) {
      const response = await handleRankingRoomRequest(
        new Request(`${roomPath}/submissions`, {
          method: "POST",
          headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, judgments: roomJudgments }),
        }),
        rankingEnv,
      );
      expect(response.status).toBe(201);
    }

    const beforeThreshold = await handleRankingRoomRequest(new Request(roomPath), rankingEnv);
    await expect(beforeThreshold.json()).resolves.toMatchObject({
      sessionsReceived: 2,
      aggregate: null,
      resultThreshold: 3,
    });

    const duplicate = await handleRankingRoomRequest(
      new Request(`${roomPath}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "session-one", judgments: roomJudgments }),
      }),
      rankingEnv,
    );
    expect(duplicate.status).toBe(200);
    await expect(duplicate.json()).resolves.toMatchObject({ duplicate: true, sessionsReceived: 2 });

    const third = await handleRankingRoomRequest(
      new Request(`${roomPath}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "session-three", judgments: roomJudgments }),
      }),
      rankingEnv,
    );
    expect(third.status).toBe(201);
    await expect(third.json()).resolves.toMatchObject({
      duplicate: false,
      aggregate: {
        sessions: 3,
        judgments: 6,
        pairwise: [
          { alpha: "item-1", beta: "item-2", alphaWins: 3 },
          { alpha: "item-2", beta: "item-3", alphaWins: 3 },
        ],
      },
    });

    const stub = env.RANKING_ROOMS.get(env.RANKING_ROOMS.idFromString(room.roomId));
    await runInDurableObject(stub, async (_instance, state) => {
      const hashes = state.storage.sql
        .exec<{ session_hash: string }>("SELECT session_hash FROM sessions ORDER BY session_hash")
        .toArray();
      expect(hashes).toHaveLength(3);
      expect(hashes.every((row) => /^[a-f0-9]{64}$/.test(row.session_hash))).toBe(true);
      expect(JSON.stringify(hashes)).not.toContain("session-one");
      const tables = state.storage.sql
        .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
        .toArray()
        .map((row) => row.name);
      expect(tables).not.toContain("judgments");
    });

    const deleted = await handleRankingRoomRequest(
      new Request(roomPath, {
        method: "DELETE",
        headers: { Origin: "https://delib.example", "X-Ranking-Admin": adminToken },
      }),
      rankingEnv,
    );
    expect(deleted.status).toBe(200);
    const afterDelete = await handleRankingRoomRequest(new Request(roomPath), rankingEnv);
    expect(afterDelete.status).toBe(404);
  });

  it("clears every stored field when its alarm fires", async () => {
    const room = await createRankingRoom();
    const stub = env.RANKING_ROOMS.get(env.RANKING_ROOMS.idFromString(room.roomId));
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const response = await handleRankingRoomRequest(
      new Request(`https://delib.example/api/integrations/power-ranker/rooms/${room.roomId}`),
      rankingEnv,
    );
    expect(response.status).toBe(404);
  });
});
