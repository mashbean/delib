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
  handlePocketPolisRequest,
  handlePocketHarmonicaRequest,
  handlePocketReplyRequest,
  handlePocketFormRequest,
  handlePocketTttcRequest,
  handlePublicReceiptRequest,
  handleRankingRoomRequest,
  handleTttcRequest,
  parseAgoraConversationSlug,
  parseHeyFormId,
  parsePolisConversationId,
} from "./index";

const rankingEnv = env as unknown as Parameters<typeof handleRankingRoomRequest>[1];
const publicReceiptEnv = env as unknown as Parameters<typeof handlePublicReceiptRequest>[1];

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
    organizer: {
      interpretation: "仍有取捨需要討論。",
      missingVoices: "尚未納入夜間使用者。",
      decisionStatus: "under-review",
      authority: "虛構工作小組",
      responsibleActor: "虛構主辦者",
      responseBy: "2026-10-01",
      nextAction: "補訪後公開回覆。",
      evidenceUrl: "",
    },
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
      limitations: ["不是代表性民調", "公開句子由主辦者挑選", "不含分群", "解讀是人工聲明"],
    },
  };
}

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
  it("creates a Pocket Polis conversation without retaining the private token", async () => {
    const upstream = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://polis.mashbean.net/api/conversations");
      expect(JSON.parse(String(init?.body))).toEqual({
        title: "公園議題",
        description: "找出居民能共同推進的方向",
        seedStatements: ["增加照明", "保留草地", "改善無障礙", "增加遊具", "再辦討論"],
        autoApprove: false,
        allowSubmissions: true,
        openData: false,
      });
      return Response.json({
        conversationId: "abc123def4",
        adminToken: "a".repeat(32),
        urls: {
          participate: "/c/abc123def4",
          report: "/r/abc123def4",
          admin: `/a/abc123def4#token=${"a".repeat(32)}`,
        },
      });
    });
    const response = await handlePocketPolisRequest(
      new Request("https://delib.example/api/integrations/pocket-polis", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "公園議題",
          description: "找出居民能共同推進的方向",
          seedStatements: ["增加照明", "保留草地", "改善無障礙", "增加遊具", "再辦討論"],
          autoApprove: false,
          allowSubmissions: true,
          openData: false,
          confirmed: true,
        }),
      }),
      upstream as typeof fetch,
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      integration: "pocket-polis",
      participateUrl: "https://polis.mashbean.net/c/abc123def4",
      reportUrl: "https://polis.mashbean.net/r/abc123def4",
      adminUrl: `https://polis.mashbean.net/a/abc123def4#token=${"a".repeat(32)}`,
      storedByDelib: false,
      credentialStoredByDelib: false,
    });
  });

  it("hands a question pool to Pocket Reply and returns the receipt and one-time manage links", async () => {
    const upstream = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://reply.mashbean.net/api/loops");
      const sent = JSON.parse(String(init?.body));
      expect(sent).toMatchObject({ title: "叩應閉環", speaker: "主持人", confirmed: true });
      expect(sent.csv).toContain("id,interview,comment");
      return new Response(JSON.stringify({ loopId: "abc123def4", adminToken: "e".repeat(32), questions: 2 }), { status: 201 });
    });
    const response = await handlePocketReplyRequest(
      new Request("https://delib.example/api/integrations/pocket-reply", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({ title: "叩應閉環", speaker: "主持人", positions: "先審查。https://example.org/p", csv: "id,interview,comment\n1,阿德,演習從來沒真的演過\n2,,電價漲了\n", confirmed: true }),
      }),
      upstream as typeof fetch,
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      integration: "pocket-reply",
      loopId: "abc123def4",
      questions: 2,
      receiptUrl: "https://reply.mashbean.net/r/abc123def4",
      manageUrl: `https://reply.mashbean.net/r/abc123def4#admin=${"e".repeat(32)}`,
      storedByDelib: false,
    });
    const never = vi.fn();
    const noSpeaker = await handlePocketReplyRequest(new Request("https://delib.example/api/integrations/pocket-reply", { method: "POST", headers: { Origin: "https://delib.example", "Content-Type": "application/json" }, body: JSON.stringify({ title: "x", csv: "id,comment\n1,a\n", confirmed: true }) }), never as typeof fetch);
    expect(noSpeaker.status).toBe(400);
    expect(never).not.toHaveBeenCalled();
  });

  it("creates a Pocket Harmonica interview from the Harmonica-shaped draft without any API key", async () => {
    const upstream = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://harmonica.mashbean.net/api/sessions");
      const sent = JSON.parse(String(init?.body));
      expect(sent).toMatchObject({ topic: "核電重啟：補訪", goal: "理解北海岸居民的顧慮", confirmed: true, askAlias: true });
      expect(sent.questions).toEqual(["你住哪裡？", "要先做到什麼？"]);
      return new Response(JSON.stringify({ sessionId: "abc123def4", adminToken: "d".repeat(32), budget: { worstCaseNeuronsPerReply: 70, worstCaseNeuronsPerSession: 8400 } }), { status: 201 });
    });
    const response = await handlePocketHarmonicaRequest(
      new Request("https://delib.example/api/integrations/pocket-harmonica", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "核電重啟：補訪", goal: "理解北海岸居民的顧慮", critical: "蘭嶼", questions: ["你住哪裡？", "要先做到什麼？", ""], confirmed: true }),
      }),
      upstream as typeof fetch,
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      integration: "pocket-harmonica",
      sessionId: "abc123def4",
      participateUrl: "https://harmonica.mashbean.net/s/abc123def4",
      hostUrl: `https://harmonica.mashbean.net/h/abc123def4#admin=${"d".repeat(32)}`,
      budget: { worstCaseNeuronsPerSession: 8400 },
      credentialStoredByDelib: false,
    });
    const never = vi.fn();
    const noQuestions = await handlePocketHarmonicaRequest(new Request("https://delib.example/api/integrations/pocket-harmonica", { method: "POST", headers: { Origin: "https://delib.example", "Content-Type": "application/json" }, body: JSON.stringify({ topic: "x", goal: "y", questions: [], confirmed: true }) }), never as typeof fetch);
    expect(noQuestions.status).toBe(400);
    expect(never).not.toHaveBeenCalled();
  });

  it("creates a Pocket Form form and returns participate, host and export links", async () => {
    const upstream = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://form.mashbean.net/api/forms");
      const sent = JSON.parse(String(init?.body));
      expect(sent).toMatchObject({ title: "核電審議報名", askAlias: true, confirmed: true });
      expect(sent.questions).toHaveLength(2);
      return new Response(JSON.stringify({ formId: "abc123def4", adminToken: "c".repeat(32), questions: 2 }), { status: 201 });
    });
    const response = await handlePocketFormRequest(
      new Request("https://delib.example/api/integrations/pocket-form", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({ title: "核電審議報名", askAlias: true, questions: [{ type: "long", label: "一句話", required: true }, { type: "consent", label: "同意" }], confirmed: true }),
      }),
      upstream as typeof fetch,
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      integration: "pocket-form",
      formId: "abc123def4",
      participateUrl: "https://form.mashbean.net/f/abc123def4",
      hostUrl: `https://form.mashbean.net/h/abc123def4#admin=${"c".repeat(32)}`,
      exports: { tttcCsv: "https://form.mashbean.net/api/forms/abc123def4/export/tttc.csv" },
      storedByDelib: false,
    });
    const never = vi.fn();
    const unconfirmed = await handlePocketFormRequest(new Request("https://delib.example/api/integrations/pocket-form", { method: "POST", headers: { Origin: "https://delib.example", "Content-Type": "application/json" }, body: JSON.stringify({ title: "x", questions: [{ type: "long", label: "y" }] }) }), never as typeof fetch);
    expect(unconfirmed.status).toBe(400);
    expect(never).not.toHaveBeenCalled();
  });

  it("hands a tttc.csv to Pocket TTTC and returns the report and one-time manage links", async () => {
    const upstream = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://ttt-city.mashbean.net/api/reports");
      const sent = JSON.parse(String(init?.body));
      expect(sent).toMatchObject({ title: "核電審議發言", language: "zh-Hant", confirmed: true });
      expect(sent.csv).toContain("id,interview,comment");
      return new Response(JSON.stringify({ reportId: "abc123def4", adminToken: "b".repeat(32), rows: 2 }), { status: 201 });
    });
    const response = await handlePocketTttcRequest(
      new Request("https://delib.example/api/integrations/pocket-tttc", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({ title: "核電審議發言", csv: "id,interview,comment\n1,阿德,演習從來沒真的演過\n2,,電價漲了\n", confirmed: true }),
      }),
      upstream as typeof fetch,
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      integration: "pocket-tttc",
      status: "queued",
      reportId: "abc123def4",
      rows: 2,
      reportUrl: "https://ttt-city.mashbean.net/r/abc123def4",
      manageUrl: `https://ttt-city.mashbean.net/r/abc123def4#admin=${"b".repeat(32)}`,
      storedByDelib: false,
      credentialStoredByDelib: false,
    });
  });

  it("rejects Pocket TTTC requests without confirmation or the id/comment header, and maps upstream limits", async () => {
    const make = (body: Record<string, unknown>) =>
      new Request("https://delib.example/api/integrations/pocket-tttc", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const never = vi.fn();
    expect((await handlePocketTttcRequest(make({ title: "x", csv: "id,comment\n1,a\n" }), never as typeof fetch)).status).toBe(400);
    expect((await handlePocketTttcRequest(make({ title: "x", csv: "statement_id,text\n1,a\n", confirmed: true }), never as typeof fetch)).status).toBe(400);
    expect(never).not.toHaveBeenCalled();
    const limited = vi.fn(async () => new Response(JSON.stringify({ error: "creation rate limit reached" }), { status: 429 }));
    expect((await handlePocketTttcRequest(make({ title: "x", csv: "id,comment\n1,a\n", confirmed: true }), limited as typeof fetch)).status).toBe(429);
    const rejected = vi.fn(async () => new Response(JSON.stringify({ error: "這個部署每份報告最多 600 則發言" }), { status: 400 }));
    const bad = await handlePocketTttcRequest(make({ title: "x", csv: "id,comment\n1,a\n", confirmed: true }), rejected as typeof fetch);
    expect(bad.status).toBe(400);
    await expect(bad.json()).resolves.toMatchObject({ error: "這個部署每份報告最多 600 則發言" });
  });

  it("requires confirmation and 5–15 unique Pocket Polis seed statements", async () => {
    const upstream = vi.fn();
    const response = await handlePocketPolisRequest(
      new Request("https://delib.example/api/integrations/pocket-polis", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "公園議題",
          seedStatements: ["一", "二", "三", "四"],
          autoApprove: false,
          allowSubmissions: true,
          openData: false,
          confirmed: true,
        }),
      }),
      upstream as typeof fetch,
    );
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("maps Pocket Polis rate limits without echoing upstream details", async () => {
    const response = await handlePocketPolisRequest(
      new Request("https://delib.example/api/integrations/pocket-polis", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "公園議題",
          seedStatements: ["一", "二", "三", "四", "五"],
          autoApprove: false,
          allowSubmissions: true,
          openData: false,
          confirmed: true,
        }),
      }),
      vi.fn(async () => new Response("private upstream detail", { status: 429 })) as typeof fetch,
    );
    expect(response.status).toBe(429);
    expect(await response.text()).not.toContain("private upstream detail");
  });

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
    expect(body.workspaceUrl).toBe("https://delib.example/integrations/polis?conversation=2demo");
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
      workspaceUrl: "https://delib.example/integrations/heyform?form=dCN9pF7U",
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
      workspaceUrl: "https://delib.example/integrations/agora?conversation=ss_4Cg",
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
      "https://delib.example/integrations/tttc?title=%E5%85%AC%E5%9C%92%E8%A8%AA%E8%AB%87&description=%E5%B7%B2%E5%8E%BB%E8%AD%98%E5%88%A5%E7%9A%84%E8%A8%AA%E8%AB%87",
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
        "https://delib.example/integrations/harmonica?session=session_12345678&title=%E5%85%AC%E5%9C%92%E6%B7%B1%E5%BA%A6%E5%B0%8D%E8%A9%B1",
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

describe("public result short links", () => {
  it("stores only a validated public receipt, serves it by slug, and deletes it with a private token", async () => {
    const created = await handlePublicReceiptRequest(
      new Request("https://delib.example/api/receipts", {
        method: "POST",
        headers: { Origin: "https://delib.example", "Content-Type": "application/json" },
        body: JSON.stringify({ receipt: pocketReceiptFixture(), retentionDays: 365, confirmed: true }),
      }),
      publicReceiptEnv,
    );
    expect(created.status).toBe(201);
    const payload = (await created.json()) as {
      publicUrl: string;
      manageUrl: string;
      expiresAt: number;
      excludedFields: string[];
    };
    expect(payload.publicUrl).toMatch(/^https:\/\/delib\.example\/r\/[a-f0-9]{16}$/);
    expect(payload.manageUrl).toMatch(/#delete=[a-f0-9]{64}$/);
    expect(payload.excludedFields).toContain("individual responses");

    const slug = new URL(payload.publicUrl).pathname.split("/").pop() || "";
    const fetched = await handlePublicReceiptRequest(
      new Request(`https://delib.example/api/receipts/${slug}`),
      publicReceiptEnv,
    );
    expect(fetched.status).toBe(200);
    await expect(fetched.json()).resolves.toMatchObject({
      status: "ready",
      kind: "pocket-polis-receipt",
      receipt: { findings: [{ text: "增加照明" }] },
    });

    const stub = env.PUBLIC_RECEIPTS.getByName(slug);
    await runInDurableObject(stub, async (_instance, state) => {
      const row = state.storage.sql
        .exec<{ receipt_json: string; admin_hash: string }>(
          "SELECT receipt_json, admin_hash FROM receipt WHERE id = 1",
        )
        .one();
      expect(row.receipt_json).not.toContain("participantId");
      expect(row.receipt_json).not.toContain("adminToken");
      expect(row.admin_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(payload.manageUrl).not.toContain(row.admin_hash);
    });

    const adminToken = new URL(payload.manageUrl).hash.replace(/^#delete=/, "");
    const deleted = await handlePublicReceiptRequest(
      new Request(`https://delib.example/api/receipts/${slug}`, {
        method: "DELETE",
        headers: { Origin: "https://delib.example", "X-Receipt-Admin": adminToken },
      }),
      publicReceiptEnv,
    );
    expect(deleted.status).toBe(200);
    const missing = await handlePublicReceiptRequest(
      new Request(`https://delib.example/api/receipts/${slug}`),
      publicReceiptEnv,
    );
    expect(missing.status).toBe(404);
  });

  it("rejects raw participant linkage, unconfirmed publication, and cross-origin writes", async () => {
    const linked = pocketReceiptFixture();
    linked.dataCard.containsPseudonymousLinkage = true;
    const rejected = await handlePublicReceiptRequest(
      new Request("https://delib.example/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt: linked, retentionDays: 365, confirmed: true }),
      }),
      publicReceiptEnv,
    );
    expect(rejected.status).toBe(400);

    const unconfirmed = await handlePublicReceiptRequest(
      new Request("https://delib.example/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt: pocketReceiptFixture(), retentionDays: 365 }),
      }),
      publicReceiptEnv,
    );
    expect(unconfirmed.status).toBe(400);

    const crossOrigin = await handlePublicReceiptRequest(
      new Request("https://delib.example/api/receipts", {
        method: "POST",
        headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
        body: JSON.stringify({ receipt: pocketReceiptFixture(), retentionDays: 365, confirmed: true }),
      }),
      publicReceiptEnv,
    );
    expect(crossOrigin.status).toBe(403);
  });

  it("clears the public receipt when its alarm fires", async () => {
    const created = await handlePublicReceiptRequest(
      new Request("https://delib.example/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt: pocketReceiptFixture(), retentionDays: 30, confirmed: true }),
      }),
      publicReceiptEnv,
    );
    const payload = (await created.json()) as { publicUrl: string };
    const slug = new URL(payload.publicUrl).pathname.split("/").pop() || "";
    const stub = env.PUBLIC_RECEIPTS.getByName(slug);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const missing = await handlePublicReceiptRequest(
      new Request(`https://delib.example/api/receipts/${slug}`),
      publicReceiptEnv,
    );
    expect(missing.status).toBe(404);
  });
});
