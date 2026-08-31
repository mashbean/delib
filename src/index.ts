import {
  RankingRoom,
  sha256,
  type RankingItem,
  type RankingJudgment,
  type RankingRoomRpcResult,
} from "./ranking-room";

export { RankingRoom };

type WorkerEnv = Omit<Env, "RANKING_ROOMS"> & {
  ASSETS: Fetcher;
  RANKING_ROOMS: DurableObjectNamespace<RankingRoom>;
  CALL_IN_ORIGIN?: string;
  POLIS_SITE_ID?: string;
};

type AgentPlan = {
  goal?: string;
  format?: string;
  scale?: string;
  privacy?: string;
  output?: string;
  tools?: Array<{ id?: string; name?: string; summary?: string }>;
  offlineGears?: Array<{ title?: string; description?: string }>;
};

type AgentRequest = {
  model?: unknown;
  context?: unknown;
  plan?: unknown;
};

const MAX_BODY_BYTES = 32 * 1024;
const MAX_CONTEXT_LENGTH = 4_000;
const MAX_INTEGRATION_BODY_BYTES = 12 * 1024;
const RANKING_ROOM_RETENTION_HOURS = new Set([24, 168]);
const DEFAULT_MODEL = "gpt-5.6";
const DEFAULT_CALL_IN_ORIGIN = "https://call-in.mashbean.net";

const AGENT_INSTRUCTIONS = `你是審議流程的協作助理，不是決策者。請使用正體中文，根據已經由規則引擎選出的流程與工具，產生一份簡短、可執行的主持簡報。

必須包含五個段落：
1. 建議節奏：審議前、進行中、結束後。
2. 主持提醒：如何讓邊緣聲音與歧見被看見。
3. 人工關卡：哪些地方一定要由主辦者或參與者確認。
4. 風險與未知：資料、代表性、工具限制與不確定性。
5. 下一輪：如何回覆參與者、留下可檢查收據並啟動下一步。

遵守 Civic AI 的 bounded local steward 原則：權限要清楚、可申訴、可修正、可關閉。不得虛構共識、參與人數、資料來源或工具能力；不得新增未列在流程中的工具。若資訊不足，直接列出需要主辦者回答的問題。`;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json(
        {
          ok: true,
          service: "delib",
          ai: "bring-your-own-key",
          storage: "optional-ephemeral-ranking-rooms",
        },
        200,
      );
    }

    if (url.pathname === "/api/agent" && request.method === "POST") {
      return handleAgentRequest(request);
    }

    if (url.pathname === "/api/integrations" && request.method === "GET") {
      const registryUrl = new URL("/data/integrations.json", url);
      return withSecurityHeaders(await env.ASSETS.fetch(new Request(registryUrl, request)), url.pathname);
    }

    if (url.pathname.startsWith("/api/integrations/power-ranker/rooms")) {
      return handleRankingRoomRequest(request, env);
    }

    if (url.pathname === "/api/integrations/call-in" && request.method === "POST") {
      return handleCallInRequest(request, fetch, env.CALL_IN_ORIGIN || DEFAULT_CALL_IN_ORIGIN);
    }

    if (url.pathname === "/api/integrations/polis" && request.method === "POST") {
      return handlePolisRequest(request, env.POLIS_SITE_ID);
    }

    if (url.pathname === "/api/integrations/polis/status" && request.method === "GET") {
      return json({
        integration: "polis",
        configured: Boolean(normalizePolisSiteId(env.POLIS_SITE_ID)),
        setup: "A Pol.is account creates the Site ID; Cloudflare only passes it to Delib.",
      }, 200);
    }

    if (url.pathname === "/api/integrations/heyform" && request.method === "POST") {
      return handleHeyFormRequest(request);
    }

    if (url.pathname === "/api/integrations/tttc" && request.method === "POST") {
      return handleTttcRequest(request);
    }

    if (url.pathname === "/api/integrations/harmonica" && request.method === "POST") {
      return handleHarmonicaRequest(request);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "not found" }, 404);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    return withSecurityHeaders(assetResponse, url.pathname);
  },
} satisfies ExportedHandler<WorkerEnv>;

type CallInRequest = {
  title?: unknown;
  description?: unknown;
  deckUrl?: unknown;
  locale?: unknown;
  confirmed?: unknown;
};

type PolisRequest = {
  mode?: unknown;
  conversation?: unknown;
  siteId?: unknown;
  pageId?: unknown;
  title?: unknown;
  confirmed?: unknown;
};

type HeyFormRequest = {
  form?: unknown;
  confirmed?: unknown;
};

type TttcRequest = {
  title?: unknown;
  description?: unknown;
  confirmed?: unknown;
};

type HarmonicaRequest = {
  topic?: unknown;
  goal?: unknown;
  context?: unknown;
  critical?: unknown;
  questions?: unknown;
  crossPollination?: unknown;
  confirmed?: unknown;
};

type RankingRoomCreateRequest = {
  title?: unknown;
  items?: unknown;
  retentionHours?: unknown;
  confirmed?: unknown;
};

type RankingRoomSubmissionRequest = {
  sessionId?: unknown;
  judgments?: unknown;
};

export async function handleRankingRoomRequest(
  request: Request,
  env: Pick<WorkerEnv, "RANKING_ROOMS">,
): Promise<Response> {
  const url = new URL(request.url);
  const basePath = "/api/integrations/power-ranker/rooms";

  if (url.pathname === basePath && request.method === "POST") {
    if (!isSameOriginRequest(request)) return json({ error: "origin not allowed" }, 403);
    const body = await readJsonRequest<RankingRoomCreateRequest>(request, MAX_INTEGRATION_BODY_BYTES);
    if (body instanceof Response) return body;
    if (body.confirmed !== true) return json({ error: "建立前請先確認短期保存範圍" }, 400);

    const question = normalizeRankingQuestion(body.title, body.items);
    if (!question) return json({ error: "請填入問題與 3–10 個不重複項目" }, 400);
    const retentionHours =
      typeof body.retentionHours === "number" && RANKING_ROOM_RETENTION_HOURS.has(body.retentionHours)
        ? body.retentionHours
        : null;
    if (!retentionHours) return json({ error: "保存期限只能選 24 小時或 7 天" }, 400);

    const durableId = env.RANKING_ROOMS.newUniqueId();
    const roomId = durableId.toString();
    const adminToken = randomHex(32);
    const createdAt = Date.now();
    const expiresAt = createdAt + retentionHours * 60 * 60 * 1_000;
    const initialized = await env.RANKING_ROOMS.get(durableId).init({
      ...question,
      createdAt,
      expiresAt,
      adminTokenHash: await sha256(adminToken),
    });
    if (!initialized.created) return json({ error: "房間識別碼衝突，請再試一次" }, 503);

    const participantUrl = new URL("/integrations/power-ranker.html", url);
    participantUrl.searchParams.set("room", roomId);
    const manageUrl = new URL(participantUrl);
    manageUrl.hash = `admin=${adminToken}`;
    return json(
      {
        integration: "power-ranker",
        mode: "ephemeral-room",
        status: "ready",
        roomId,
        participantUrl: participantUrl.toString(),
        manageUrl: manageUrl.toString(),
        createdAt,
        expiresAt,
        retentionHours,
        resultThreshold: 3,
        sessionLimit: 300,
        storedByDelib: true,
        storedFields: ["question", "aggregate pair counts", "hashed random session IDs"],
        rawJudgmentsStored: false,
      },
      201,
    );
  }

  const match = url.pathname.match(
    /^\/api\/integrations\/power-ranker\/rooms\/([a-f0-9]{64})(?:\/(submissions))?$/,
  );
  if (!match) return json({ error: "not found" }, 404);
  const [, roomId, child] = match;
  let durableId: DurableObjectId;
  try {
    durableId = env.RANKING_ROOMS.idFromString(roomId);
  } catch {
    return json({ error: "not found" }, 404);
  }
  const stub = env.RANKING_ROOMS.get(durableId);

  if (!child && request.method === "GET") {
    const result = await stub.getRoom(request.headers.get("X-Ranking-Admin")?.trim() || undefined);
    return rankingRoomResult(result);
  }

  if (child === "submissions" && request.method === "POST") {
    if (!isSameOriginRequest(request)) return json({ error: "origin not allowed" }, 403);
    const body = await readJsonRequest<RankingRoomSubmissionRequest>(request, MAX_INTEGRATION_BODY_BYTES);
    if (body instanceof Response) return body;
    const sessionId = cleanMatchingString(body.sessionId, /^[A-Za-z0-9_-]{8,80}$/, 80);
    if (!sessionId || !Array.isArray(body.judgments)) return json({ error: "排序資料不完整" }, 400);
    const result = await stub.submit(sessionId, body.judgments as RankingJudgment[]);
    if (result.status === "invalid") return json({ error: "至少要完成基本比較，且每組配對只能出現一次" }, 400);
    if (result.status === "full") return json({ error: "這個收件室已達 300 份上限" }, 429);
    const response = rankingRoomResult(result, result.duplicate === true ? 200 : 201);
    return response;
  }

  if (!child && request.method === "DELETE") {
    if (!isSameOriginRequest(request)) return json({ error: "origin not allowed" }, 403);
    const adminToken = request.headers.get("X-Ranking-Admin")?.trim();
    if (!adminToken) return json({ error: "缺少管理權杖" }, 401);
    const result = await stub.deleteRoom(adminToken);
    return rankingRoomResult(result);
  }

  return json({ error: "method not allowed" }, 405);
}

export async function handleCallInRequest(
  request: Request,
  upstreamFetch: typeof fetch = fetch,
  callInOrigin = DEFAULT_CALL_IN_ORIGIN,
): Promise<Response> {
  if (!isSameOriginRequest(request)) return json({ error: "origin not allowed" }, 403);

  const body = await readJsonRequest<CallInRequest>(request, MAX_INTEGRATION_BODY_BYTES);
  if (body instanceof Response) return body;

  const title = cleanRequiredString(body.title, 120);
  const description = cleanOptionalString(body.description, 500);
  const deckUrl = cleanHttpsUrl(body.deckUrl, 2_048);
  const locale = body.locale === "en" ? "en" : "zh-Hant-TW";
  if (!title) return json({ error: "先幫活動取一個名字" }, 400);
  if (!deckUrl) return json({ error: "請貼上可公開開啟的 HTTPS 簡報網址" }, 400);
  if (body.confirmed !== true) return json({ error: "建立前請先確認資料與保存期限" }, 400);

  let upstream: Response;
  try {
    upstream = await upstreamFetch(`${callInOrigin.replace(/\/$/, "")}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, deckUrl, locale }),
    });
  } catch {
    return json({ error: "暫時連不上 Call-in，請稍後再試" }, 502);
  }

  if (!upstream.ok) {
    return json(
      {
        error:
          upstream.status === 429
            ? "目前建立活動的人比較多，請稍後再試"
            : upstream.status === 413
              ? "這份內容超過 Call-in 的大小限制"
              : "Call-in 沒有完成建立，請檢查簡報網址後再試",
      },
      upstream.status === 429 ? 429 : upstream.status === 413 ? 413 : 502,
    );
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: "Call-in 回應格式不完整" }, 502);
  }
  if (!isRecord(payload)) return json({ error: "Call-in 回應格式不完整" }, 502);

  const eventId = cleanMatchingString(payload.eventId, /^[a-f0-9]{32}$/, 32);
  const audienceUrl = cleanHttpsUrl(payload.audienceUrl, 2_048);
  const presenterUrl = cleanHttpsUrl(payload.presenterUrl, 2_048);
  const setupUrl = cleanHttpsUrl(payload.setupUrl, 4_096, true);
  const moderatorUrl = cleanHttpsUrl(payload.moderatorUrl, 4_096, true);
  const expiresAt = typeof payload.expiresAt === "number" ? payload.expiresAt : Number.NaN;
  if (!eventId || !audienceUrl || !presenterUrl || !setupUrl || !moderatorUrl || !Number.isFinite(expiresAt)) {
    return json({ error: "Call-in 回應缺少必要資訊" }, 502);
  }

  return json(
    {
      integration: "call-in",
      status: "ready",
      eventId,
      title,
      expiresAt,
      audienceUrl,
      presenterUrl,
      setupUrl,
      moderatorUrl,
      privacy: {
        retention: "7 days",
        privateUrls: ["setupUrl", "moderatorUrl"],
        storedByDelib: false,
      },
    },
    201,
  );
}

export async function handlePolisRequest(request: Request, defaultSiteId?: string): Promise<Response> {
  if (!isSameOriginRequest(request)) return json({ error: "origin not allowed" }, 403);
  const body = await readJsonRequest<PolisRequest>(request, MAX_INTEGRATION_BODY_BYTES);
  if (body instanceof Response) return body;
  if (body.confirmed !== true) return json({ error: "開啟前請先確認這次會連到 Pol.is" }, 400);

  const workspaceUrl = new URL("/integrations/polis.html", request.url);
  if (body.mode === "existing") {
    const conversationId = parsePolisConversationId(body.conversation);
    if (!conversationId) return json({ error: "找不到有效的 Pol.is 對話代碼或網址" }, 400);
    workspaceUrl.searchParams.set("conversation", conversationId);
    return json(
      {
        integration: "polis",
        mode: "existing",
        status: "ready",
        conversationId,
        workspaceUrl: workspaceUrl.toString(),
        participantUrl: `https://pol.is/${conversationId}`,
        storedByDelib: false,
        writesWhenOpened: false,
      },
      200,
    );
  }

  if (body.mode === "site") {
    const siteId = normalizePolisSiteId(body.siteId) || normalizePolisSiteId(defaultSiteId);
    const title = cleanRequiredString(body.title, 120);
    if (!siteId) return json({ error: "請貼上 Pol.is 的 Site ID，或在部署時連接 POLIS_SITE_ID" }, 400);
    if (!title) return json({ error: "先幫這輪對話取一個名字" }, 400);
    const suppliedPageId = cleanMatchingString(body.pageId, /^[A-Za-z0-9._:-]{1,120}$/, 120);
    const pageId = suppliedPageId || `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`;
    workspaceUrl.searchParams.set("site", siteId);
    workspaceUrl.searchParams.set("page", pageId);
    workspaceUrl.searchParams.set("title", title);
    return json(
      {
        integration: "polis",
        mode: "site",
        status: "ready",
        siteId,
        siteSource: normalizePolisSiteId(body.siteId) ? "request" : "deployment",
        pageId,
        workspaceUrl: workspaceUrl.toString(),
        storedByDelib: false,
        writesWhenOpened: true,
        warning: "第一次開啟工作區時，Pol.is 會在這個 Site ID 下建立對話。",
      },
      201,
    );
  }

  return json({ error: "請選擇已有對話或建立新對話" }, 400);
}

export async function handleHeyFormRequest(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return json({ error: "origin not allowed" }, 403);
  const body = await readJsonRequest<HeyFormRequest>(request, MAX_INTEGRATION_BODY_BYTES);
  if (body instanceof Response) return body;
  if (body.confirmed !== true) return json({ error: "開啟前請先確認表單資料會送到 HeyForm" }, 400);

  const formId = parseHeyFormId(body.form);
  if (!formId) return json({ error: "請貼上有效的 HeyForm 公開表單網址" }, 400);
  const participantUrl = `https://heyform.net/f/${formId}`;
  const workspaceUrl = new URL("/integrations/heyform.html", request.url);
  workspaceUrl.searchParams.set("form", formId);

  return json({
    integration: "heyform",
    mode: "existing-form",
    status: "ready",
    formId,
    workspaceUrl: workspaceUrl.toString(),
    participantUrl,
    storedByDelib: false,
    writesWhenOpened: false,
    writesWhenSubmitted: true,
  }, 200);
}

export async function handleTttcRequest(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return json({ error: "origin not allowed" }, 403);
  const body = await readJsonRequest<TttcRequest>(request, MAX_INTEGRATION_BODY_BYTES);
  if (body instanceof Response) return body;
  if (body.confirmed !== true) return json({ error: "開啟前請先確認資料去識別與人工複核責任" }, 400);

  const title = cleanRequiredString(body.title, 120);
  const description = cleanOptionalString(body.description, 500);
  if (!title) return json({ error: "先幫這份分析取一個名字" }, 400);

  const workspaceUrl = new URL("/integrations/tttc.html", request.url);
  workspaceUrl.searchParams.set("title", title);
  if (description) workspaceUrl.searchParams.set("description", description);
  const createUrl = new URL("https://talktothe.city/create");
  createUrl.searchParams.set("title", title);
  if (description) createUrl.searchParams.set("description", description);

  return json({
    integration: "talk-to-the-city",
    mode: "official-create-workspace",
    status: "ready",
    title,
    workspaceUrl: workspaceUrl.toString(),
    createUrl: createUrl.toString(),
    storedByDelib: false,
    writesWhenOpened: false,
    writesWhenSubmitted: true,
    warning: "登入、上傳、模型處理與發布都發生在 Talk to the City；Delib 不會收到資料。",
  }, 200);
}

export async function handleHarmonicaRequest(
  request: Request,
  upstreamFetch: typeof fetch = fetch,
): Promise<Response> {
  if (!isSameOriginRequest(request)) return json({ error: "origin not allowed" }, 403);
  const apiKey = request.headers.get("X-Harmonica-Key")?.trim();
  if (!apiKey || !/^hm_live_[a-f0-9]{32}$/i.test(apiKey)) {
    return json({ error: "請貼上有效的 Harmonica API key" }, 401);
  }

  const body = await readJsonRequest<HarmonicaRequest>(request, MAX_INTEGRATION_BODY_BYTES);
  if (body instanceof Response) return body;
  if (body.confirmed !== true) {
    return json({ error: "建立前請先確認資料會送到 Harmonica" }, 400);
  }

  const topic = cleanRequiredString(body.topic, 120);
  const goal = cleanRequiredString(body.goal, 500);
  const context = cleanOptionalString(body.context, 1_000);
  const critical = cleanOptionalString(body.critical, 500);
  if (!topic) return json({ error: "先幫這輪對話取一個名字" }, 400);
  if (!goal) return json({ error: "請說明希望這輪對話理解什麼" }, 400);

  const questions = Array.isArray(body.questions)
    ? body.questions
        .slice(0, 8)
        .map((question) => cleanRequiredString(question, 240))
        .filter((question): question is string => Boolean(question))
        .map((text) => ({ text }))
    : [];

  let upstream: Response;
  try {
    upstream = await upstreamFetch("https://app.harmonica.chat/api/v1/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic,
        goal,
        ...(context ? { context } : {}),
        ...(critical ? { critical } : {}),
        ...(questions.length ? { questions } : {}),
        cross_pollination: body.crossPollination === true,
      }),
    });
  } catch {
    return json({ error: "暫時連不上 Harmonica，請稍後再試" }, 502);
  }

  if (!upstream.ok) {
    return json(
      {
        error:
          upstream.status === 401 || upstream.status === 403
            ? "Harmonica 沒有接受這把 key；請檢查是否已撤銷"
            : upstream.status === 429
              ? "Harmonica 目前已達速率或方案上限，請稍後再試"
              : "Harmonica 沒有完成建立；請到原站檢查帳號與方案狀態",
      },
      upstream.status === 401 || upstream.status === 403 || upstream.status === 429
        ? upstream.status
        : 502,
    );
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: "Harmonica 回應格式不完整" }, 502);
  }
  if (!isRecord(payload)) return json({ error: "Harmonica 回應格式不完整" }, 502);
  const sessionId = cleanMatchingString(payload.id, /^[A-Za-z0-9_-]{8,128}$/, 128);
  if (!sessionId) return json({ error: "Harmonica 回應缺少 session ID" }, 502);

  const participantUrl = `https://app.harmonica.chat/chat?s=${encodeURIComponent(sessionId)}`;
  const workspaceUrl = new URL("/integrations/harmonica.html", request.url);
  workspaceUrl.searchParams.set("session", sessionId);
  workspaceUrl.searchParams.set("title", topic);

  return json(
    {
      integration: "harmonica",
      status: "ready",
      sessionId,
      topic,
      participantUrl,
      workspaceUrl: workspaceUrl.toString(),
      manageUrl: `https://app.harmonica.chat/sessions/${encodeURIComponent(sessionId)}`,
      storedByDelib: false,
      credentialStoredByDelib: false,
      writesExternalState: true,
    },
    201,
  );
}

export async function handleAgentRequest(
  request: Request,
  upstreamFetch: typeof fetch = fetch,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && origin !== requestUrl.origin) {
    return json({ error: "origin not allowed" }, 403);
  }

  const contentLength = Number(request.headers.get("Content-Length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: "request too large" }, 413);
  }

  const apiKey = request.headers.get("X-OpenAI-Key")?.trim();
  if (!apiKey || !/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey)) {
    return json({ error: "請貼上有效的 OpenAI API key" }, 401);
  }

  let body: AgentRequest;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ error: "request too large" }, 413);
    }
    body = JSON.parse(rawBody) as AgentRequest;
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  const plan = validatePlan(body.plan);
  if (!plan) return json({ error: "請先完成審議拼圖" }, 400);

  const context = typeof body.context === "string" ? body.context.trim() : "";
  if (context.length > MAX_CONTEXT_LENGTH) {
    return json({ error: `補充說明最多 ${MAX_CONTEXT_LENGTH} 字` }, 400);
  }

  const model = validateModel(body.model);
  if (!model) return json({ error: "model name is invalid" }, 400);

  let upstream: Response;
  try {
    upstream = await upstreamFetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1_200,
        instructions: AGENT_INSTRUCTIONS,
        input: JSON.stringify({
          selected_plan: plan,
          organizer_context: context || "（未提供補充說明）",
        }),
      }),
    });
  } catch {
    return json({ error: "暫時連不上 OpenAI，請稍後再試" }, 502);
  }

  if (!upstream.ok) {
    return json(
      {
        error:
          upstream.status === 401
            ? "OpenAI 沒有接受這把 key，請檢查後再試"
            : upstream.status === 429
              ? "OpenAI 額度或速率已達上限，請稍後再試"
              : "OpenAI 暫時無法完成這次請求",
      },
      upstream.status === 401 || upstream.status === 429 ? upstream.status : 502,
    );
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: "OpenAI 回應格式不完整" }, 502);
  }

  const text = collectOutputText(payload);
  if (!text) return json({ error: "OpenAI 沒有回傳可讀文字" }, 502);

  return json({ text, model }, 200);
}

export function collectOutputText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.output)) return "";
  const texts: string[] = [];
  for (const item of payload.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (
        isRecord(content) &&
        content.type === "output_text" &&
        typeof content.text === "string"
      ) {
        texts.push(content.text);
      }
    }
  }
  return texts.join("\n").trim();
}

async function readJsonRequest<T>(request: Request, maxBytes: number): Promise<T | Response> {
  const contentLength = Number(request.headers.get("Content-Length") || "0");
  if (contentLength > maxBytes) return json({ error: "request too large" }, 413);
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
      return json({ error: "request too large" }, 413);
    }
    return JSON.parse(rawBody) as T;
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
}

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

function cleanRequiredString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned && cleaned.length <= max ? cleaned : null;
}

function cleanOptionalString(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function cleanMatchingString(value: unknown, pattern: RegExp, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length <= max && pattern.test(cleaned) ? cleaned : null;
}

function cleanHttpsUrl(value: unknown, max: number, allowFragment = false): string | null {
  if (typeof value !== "string" || value.length > max) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    if (!allowFragment && parsed.hash) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function parsePolisConversationId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (/^[A-Za-z0-9_-]{2,80}$/.test(cleaned)) return cleaned;
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "https:" || !["pol.is", "www.pol.is"].includes(parsed.hostname)) return null;
    const segment = parsed.pathname.split("/").filter(Boolean)[0] || "";
    const conversationId = segment.startsWith("m") ? segment.slice(1) : segment;
    return /^[A-Za-z0-9_-]{2,80}$/.test(conversationId) ? conversationId : null;
  } catch {
    return null;
  }
}

function normalizePolisSiteId(value: unknown): string | null {
  return cleanMatchingString(value, /^[A-Za-z0-9_-]{1,80}$/, 80);
}

export function parseHeyFormId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (/^[A-Za-z0-9_-]{2,120}$/.test(cleaned)) return cleaned;
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "https:" || !["heyform.net", "www.heyform.net"].includes(parsed.hostname)) {
      return null;
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length !== 2 || segments[0] !== "f") return null;
    return /^[A-Za-z0-9_-]{2,120}$/.test(segments[1]) ? segments[1] : null;
  } catch {
    return null;
  }
}

function slugify(value: string): string {
  const latin = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return latin || "delib-round";
}

function validatePlan(value: unknown): AgentPlan | null {
  if (!isRecord(value)) return null;
  const allowed = ["goal", "format", "scale", "privacy", "output"] as const;
  const plan: AgentPlan = {};
  for (const key of allowed) {
    const current = value[key];
    if (typeof current !== "string" || current.length > 80) return null;
    plan[key] = current;
  }

  if (!Array.isArray(value.tools) || value.tools.length === 0 || value.tools.length > 6) {
    return null;
  }
  plan.tools = value.tools.map((tool) => {
    if (!isRecord(tool)) return {};
    return {
      id: cleanString(tool.id, 80),
      name: cleanString(tool.name, 120),
      summary: cleanString(tool.summary, 500),
    };
  });

  if (Array.isArray(value.offlineGears)) {
    plan.offlineGears = value.offlineGears.slice(0, 8).map((gear) => {
      if (!isRecord(gear)) return {};
      return {
        title: cleanString(gear.title, 120),
        description: cleanString(gear.description, 500),
      };
    });
  }
  return plan;
}

function validateModel(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return DEFAULT_MODEL;
  if (typeof value !== "string") return null;
  const model = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{1,79}$/.test(model) ? model : null;
}

function cleanString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRankingQuestion(titleValue: unknown, itemsValue: unknown): {
  title: string;
  items: RankingItem[];
} | null {
  const title = cleanRequiredString(titleValue, 120);
  if (!title || !Array.isArray(itemsValue)) return null;
  const labels = itemsValue
    .slice(0, 11)
    .map((item) => cleanRequiredString(isRecord(item) ? item.label : item, 80))
    .filter((item): item is string => Boolean(item));
  if (labels.length < 3 || labels.length > 10) return null;
  const normalized = labels.map((label) => label.toLocaleLowerCase("zh-Hant"));
  if (new Set(normalized).size !== labels.length) return null;
  return {
    title,
    items: labels.map((label, index) => ({ id: `item-${index + 1}`, label })),
  };
}

function randomHex(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function rankingRoomResult(result: RankingRoomRpcResult, readyStatus = 200): Response {
  switch (result.status) {
    case "ready":
      return json(result, readyStatus);
    case "deleted":
      return json(result, 200);
    case "expired":
      return json({ error: "這個收件室已到期並清除" }, 410);
    case "forbidden":
      return json({ error: "管理權杖不正確" }, 403);
    case "not_found":
      return json({ error: "找不到這個收件室" }, 404);
    default:
      return json({ error: "收件室暫時無法回應" }, 503);
  }
}

function json(data: unknown, status: number): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function withSecurityHeaders(response: Response, pathname: string): Response {
  const next = new Response(response.body, response);
  const polisWorkspace = pathname === "/integrations/polis.html" || pathname === "/integrations/polis";
  const heyFormWorkspace = pathname === "/integrations/heyform.html" || pathname === "/integrations/heyform";
  const tttcWorkspace = pathname === "/integrations/tttc.html" || pathname === "/integrations/tttc";
  const harmonicaWorkspace =
    pathname === "/integrations/harmonica.html" || pathname === "/integrations/harmonica";
  const frameSource = polisWorkspace
    ? "https://pol.is"
    : heyFormWorkspace
      ? "https://heyform.net"
      : tttcWorkspace
        ? "https://talktothe.city"
        : harmonicaWorkspace
          ? "https://app.harmonica.chat"
        : "'none'";
  next.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src ${frameSource}; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
  );
  next.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  next.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next.headers.set("X-Content-Type-Options", "nosniff");
  next.headers.set("X-Frame-Options", "DENY");
  if (pathname === "/" || pathname.endsWith(".html")) {
    next.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  } else if (!next.headers.has("Cache-Control")) {
    next.headers.set("Cache-Control", "public, max-age=300");
  }
  return next;
}
