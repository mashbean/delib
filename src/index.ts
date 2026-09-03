import {
  RankingRoom,
  sha256,
  type RankingItem,
  type RankingJudgment,
  type RankingRoomRpcResult,
} from "./ranking-room";
import {
  PublicReceipt,
  type JsonValue,
  type PublicReceiptKind,
  type PublicReceiptRecord,
} from "./public-receipt";

import packageJson from "../package.json";

export { PublicReceipt, RankingRoom };

type RateLimiter = { limit(options: { key: string }): Promise<{ success: boolean }> };

type WorkerEnv = Omit<
  Env,
  "RANKING_ROOMS" | "PUBLIC_RECEIPTS" | "ASSETS" | "WRITE_LIMIT" | "SUBMIT_LIMIT" | "CF_VERSION_METADATA"
> & {
  ASSETS: Fetcher;
  RANKING_ROOMS: DurableObjectNamespace<RankingRoom>;
  PUBLIC_RECEIPTS: { getByName(name: string): PublicReceiptRpcStub };
  CALL_IN_ORIGIN?: string;
  POCKET_POLIS_ORIGIN?: string;
  POLIS_SITE_ID?: string;
  /** SHA-256 hex of an operator secret that may take down abusive public receipts. */
  OPERATOR_TOKEN_SHA256?: string;
  /** Injected by `npm run deploy:production` (`--var BUILD_SHA:<git sha>`). */
  BUILD_SHA?: string;
  /** Only bound in the production environment; absent in tests and Deploy-button installs. */
  WRITE_LIMIT?: RateLimiter;
  SUBMIT_LIMIT?: RateLimiter;
  CF_VERSION_METADATA?: { id?: string; tag?: string; timestamp?: string };
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
const PUBLIC_RECEIPT_RETENTION_DAYS = new Set([30, 365, 1_095]);
const PUBLIC_RECEIPT_SCHEMA = new Map<string, PublicReceiptKind>([
  ["https://delib.mashbean.net/schemas/delib-pocket-polis-receipt/v1.json", "pocket-polis-receipt"],
  ["https://delib.mashbean.net/schemas/delib-ranking-receipt/v1.json", "ranking-receipt"],
]);
const DEFAULT_MODEL = "gpt-5.6";
const DEFAULT_CALL_IN_ORIGIN = "https://call-in.mashbean.net";
const DEFAULT_POCKET_POLIS_ORIGIN = "https://polis.mashbean.net";
/** Upstream creators answer in a few seconds; the BYOK model call may take longer. */
const UPSTREAM_TIMEOUT_MS = 12_000;
const AGENT_TIMEOUT_MS = 45_000;
const SERVICE_VERSION = packageJson.version;

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
    try {
      return await route(request, env, url);
    } catch (error) {
      // Never log bodies or headers: they may carry BYOK keys or admin tokens.
      console.error("delib unhandled error", {
        path: url.pathname,
        method: request.method,
        message: error instanceof Error ? error.message : String(error),
      });
      if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/r/")) {
        return json({ error: "服務暫時無法回應，請稍後再試" }, 500);
      }
      return new Response("服務暫時無法回應，請稍後再試。", {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  },
} satisfies ExportedHandler<WorkerEnv>;

async function route(request: Request, env: WorkerEnv, url: URL): Promise<Response> {
    if (url.pathname === "/api/health" && (request.method === "GET" || request.method === "HEAD")) {
      return json(
        {
          ok: true,
          service: "delib",
          version: SERVICE_VERSION,
          build: {
            sha: env.BUILD_SHA || null,
            versionId: env.CF_VERSION_METADATA?.id || null,
            deployedAt: env.CF_VERSION_METADATA?.timestamp || null,
          },
          ai: "bring-your-own-key",
          storage: "optional-ephemeral-ranking-rooms-and-public-receipts",
          dataContract: "delib-data/v1",
          publicReceiptRetentionDays: [...PUBLIC_RECEIPT_RETENTION_DAYS],
          rateLimited: Boolean(env.WRITE_LIMIT),
          operatorTakedown: Boolean(env.OPERATOR_TOKEN_SHA256),
        },
        200,
        request.method === "HEAD",
      );
    }

    if (url.pathname.startsWith("/api/") && request.method === "POST") {
      const limiter = url.pathname.endsWith("/submissions") ? env.SUBMIT_LIMIT : env.WRITE_LIMIT;
      const limited = await enforceRateLimit(limiter, request);
      if (limited) return limited;
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

    if (url.pathname === "/api/receipts" || url.pathname.startsWith("/api/receipts/")) {
      return handlePublicReceiptRequest(request, env);
    }

    if (url.pathname === "/api/integrations/call-in" && request.method === "POST") {
      return handleCallInRequest(request, fetch, env.CALL_IN_ORIGIN || DEFAULT_CALL_IN_ORIGIN);
    }

    if (url.pathname === "/api/integrations/pocket-polis" && request.method === "POST") {
      return handlePocketPolisRequest(
        request,
        fetch,
        env.POCKET_POLIS_ORIGIN || DEFAULT_POCKET_POLIS_ORIGIN,
      );
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

    if (url.pathname === "/api/integrations/agora" && request.method === "POST") {
      return handleAgoraRequest(request);
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

    const publicReceiptMatch = url.pathname.match(/^\/r\/([a-f0-9]{16})$/);
    if (publicReceiptMatch && (request.method === "GET" || request.method === "HEAD")) {
      const receiptStub = env.PUBLIC_RECEIPTS.getByName(publicReceiptMatch[1]);
      const record = await receiptStub.getReceipt();
      // Unknown, expired or deleted slugs still get the result page so a person
      // sees a readable explanation; the page fetches the JSON status itself.
      const resultPage = record.kind === "ranking-receipt"
        ? "/results/power-ranker"
        : "/results/pocket-polis";
      const assetUrl = new URL(resultPage, url);
      const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
      const page = withSecurityHeaders(assetResponse, url.pathname);
      if (record.status === "ready" || !assetResponse.ok) return page;
      const status = record.status === "expired" ? 410 : 404;
      const headers = new Headers(page.headers);
      headers.set("Cache-Control", "no-store");
      return new Response(page.body, { status, headers });
    }

    const assetResponse = await env.ASSETS.fetch(request);
    return withSecurityHeaders(assetResponse, url.pathname);
}

async function enforceRateLimit(limiter: RateLimiter | undefined, request: Request): Promise<Response | null> {
  if (!limiter) return null;
  const key = request.headers.get("CF-Connecting-IP") || "unknown";
  try {
    const { success } = await limiter.limit({ key });
    if (success) return null;
  } catch (error) {
    // Fail open: a limiter outage must not take the product down.
    console.error("delib rate limiter unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
  return json({ error: "這個來源短時間內的操作太多，請一分鐘後再試" }, 429, false, {
    "Retry-After": "60",
  });
}

function upstreamFailure(error: unknown, serviceName: string): Response {
  const timedOut = error instanceof Error && error.name === "TimeoutError";
  return json(
    {
      error: timedOut
        ? `${serviceName} 回應逾時，請稍後再試；如果已經建立，請到原站確認`
        : `暫時連不上 ${serviceName}，請稍後再試`,
    },
    timedOut ? 504 : 502,
  );
}

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

type PocketPolisRequest = {
  title?: unknown;
  description?: unknown;
  seedStatements?: unknown;
  autoApprove?: unknown;
  allowSubmissions?: unknown;
  openData?: unknown;
  confirmed?: unknown;
};

type HeyFormRequest = {
  form?: unknown;
  confirmed?: unknown;
};

type AgoraRequest = {
  conversation?: unknown;
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

type PublicReceiptCreateRequest = {
  receipt?: unknown;
  retentionDays?: unknown;
  confirmed?: unknown;
};

type PublicReceiptRpcStub = {
  init(input: {
    kind: PublicReceiptKind;
    receipt: JsonValue;
    createdAt: number;
    expiresAt: number;
    adminTokenHash: string;
  }): Promise<{ created: boolean }>;
  getReceipt(): Promise<PublicReceiptRecord>;
  deleteReceipt(adminToken: string): Promise<PublicReceiptRecord>;
  forceDelete(): Promise<PublicReceiptRecord>;
};

export async function handlePublicReceiptRequest(
  request: Request,
  env: Pick<WorkerEnv, "PUBLIC_RECEIPTS" | "OPERATOR_TOKEN_SHA256">,
): Promise<Response> {
  const url = new URL(request.url);
  const basePath = "/api/receipts";

  if (url.pathname === basePath && request.method === "POST") {
    if (!isSameOriginRequest(request)) return json({ error: "origin not allowed" }, 403);
    const body = await readJsonRequest<PublicReceiptCreateRequest>(request, MAX_BODY_BYTES);
    if (body instanceof Response) return body;
    if (body.confirmed !== true) return json({ error: "發布前請先確認公開內容與保存期限" }, 400);
    const retentionDays = typeof body.retentionDays === "number" &&
        PUBLIC_RECEIPT_RETENTION_DAYS.has(body.retentionDays)
      ? body.retentionDays
      : null;
    if (!retentionDays) return json({ error: "保存期限只能選 30 天、1 年或 3 年" }, 400);
    const normalized = normalizePublicReceipt(body.receipt, url.origin);
    if (!normalized) {
      return json({ error: "只接受已去除個別紀錄、管理憑證與參與者代碼的 Delib 公開成果收據" }, 400);
    }

    const createdAt = Date.now();
    const expiresAt = createdAt + retentionDays * 24 * 60 * 60 * 1_000;
    const adminToken = randomHex(32);
    const adminTokenHash = await sha256(adminToken);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const slug = randomHex(8);
      const receiptStub = env.PUBLIC_RECEIPTS.getByName(slug);
      const initialized = await receiptStub.init({
        kind: normalized.kind,
        receipt: normalized.receipt,
        createdAt,
        expiresAt,
        adminTokenHash,
      });
      if (!initialized.created) continue;
      const publicUrl = new URL(`/r/${slug}`, url);
      const manageUrl = new URL(publicUrl);
      manageUrl.hash = `delete=${adminToken}`;
      return json({
        status: "ready",
        kind: normalized.kind,
        publicUrl: publicUrl.toString(),
        manageUrl: manageUrl.toString(),
        createdAt,
        expiresAt,
        retentionDays,
        storedByDelib: true,
        storedFields: ["public aggregate receipt", "organizer interpretation", "next-step responsibility"],
        excludedFields: ["participant identifiers", "individual responses", "source files", "admin credentials"],
      }, 201);
    }
    return json({ error: "暫時無法產生短網址，請稍後再試" }, 503);
  }

  const match = url.pathname.match(/^\/api\/receipts\/([a-f0-9]{16})$/);
  if (!match) return json({ error: "not found" }, 404);
  const stub = env.PUBLIC_RECEIPTS.getByName(match[1]);

  if (request.method === "GET") {
    return publicReceiptResult(await stub.getReceipt());
  }

  if (request.method === "DELETE") {
    if (!isSameOriginRequest(request)) return json({ error: "origin not allowed" }, 403);
    const operatorToken = request.headers.get("X-Receipt-Operator")?.trim();
    if (operatorToken) {
      // Operator takedown for abusive public pages. Configure with
      // `wrangler secret put OPERATOR_TOKEN_SHA256 --env production`.
      const expected = env.OPERATOR_TOKEN_SHA256?.trim().toLowerCase();
      if (!expected || !/^[a-f0-9]{64}$/.test(expected)) {
        return json({ error: "這個部署尚未設定營運者下架權杖" }, 403);
      }
      const supplied = await sha256(operatorToken);
      if (!constantTimeEqualHex(supplied, expected)) return json({ error: "營運者權杖不正確" }, 403);
      return publicReceiptResult(await stub.forceDelete());
    }
    const adminToken = request.headers.get("X-Receipt-Admin")?.trim();
    if (!adminToken || !/^[a-f0-9]{64}$/.test(adminToken)) return json({ error: "缺少私人刪除權杖" }, 401);
    return publicReceiptResult(await stub.deleteReceipt(adminToken));
  }

  return json({ error: "method not allowed" }, 405);
}

function constantTimeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

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

    const participantUrl = new URL("/integrations/power-ranker", url);
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
    if (result.status === "full") return json({ error: "這個收件室已達 300 份上限，不再接受新結果" }, 409);
    return rankingRoomResult(result, result.duplicate === true ? 200 : 201);
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
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    return upstreamFailure(error, "Call-in");
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

  const workspaceUrl = new URL("/integrations/polis", request.url);
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

export async function handlePocketPolisRequest(
  request: Request,
  upstreamFetch: typeof fetch = fetch,
  configuredOrigin = DEFAULT_POCKET_POLIS_ORIGIN,
): Promise<Response> {
  if (!isSameOriginRequest(request)) return json({ error: "origin not allowed" }, 403);
  const body = await readJsonRequest<PocketPolisRequest>(request, MAX_INTEGRATION_BODY_BYTES);
  if (body instanceof Response) return body;
  if (body.confirmed !== true) return json({ error: "建立前請先確認公開範圍與私人管理連結" }, 400);

  const title = cleanRequiredString(body.title, 120);
  const description = cleanOptionalString(body.description, 2_000);
  const seedStatements = normalizePocketPolisSeeds(body.seedStatements);
  if (!title) return json({ error: "先幫這輪審議取一個名字" }, 400);
  if (!seedStatements) return json({ error: "請填入 5–15 句不重複、每句只表達一個觀點的起始陳述" }, 400);
  if (
    typeof body.autoApprove !== "boolean" ||
    typeof body.allowSubmissions !== "boolean" ||
    typeof body.openData !== "boolean"
  ) {
    return json({ error: "請確認審核、投稿與開放資料設定" }, 400);
  }

  const pocketPolisOrigin = normalizeServiceOrigin(configuredOrigin);
  if (!pocketPolisOrigin) return json({ error: "Pocket Polis 主機設定不完整" }, 503);

  let upstream: Response;
  try {
    upstream = await upstreamFetch(`${pocketPolisOrigin}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        seedStatements,
        autoApprove: body.autoApprove,
        allowSubmissions: body.allowSubmissions,
        openData: body.openData,
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    return upstreamFailure(error, "Pocket Polis");
  }

  if (!upstream.ok) {
    return json(
      {
        error:
          upstream.status === 429
            ? "Pocket Polis 目前建立活動的次數已達上限，請稍後再試"
            : upstream.status === 503
              ? "Pocket Polis 的免費資源暫時忙碌，請稍後再試"
              : "Pocket Polis 沒有完成建立，請檢查內容後再試",
      },
      upstream.status === 429 ? 429 : 502,
    );
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: "Pocket Polis 回應格式不完整" }, 502);
  }
  if (!isRecord(payload)) return json({ error: "Pocket Polis 回應格式不完整" }, 502);
  const conversationId = cleanMatchingString(payload.conversationId, /^[a-z0-9]{10}$/, 10);
  const adminToken = cleanMatchingString(payload.adminToken, /^[a-f0-9]{32}$/i, 32);
  if (!conversationId || !adminToken) {
    return json({ error: "Pocket Polis 回應缺少必要資訊" }, 502);
  }

  const participateUrl = `${pocketPolisOrigin}/c/${conversationId}`;
  const reportUrl = `${pocketPolisOrigin}/r/${conversationId}`;
  const adminUrl = `${pocketPolisOrigin}/a/${conversationId}#token=${adminToken}`;
  return json(
    {
      integration: "pocket-polis",
      status: "ready",
      serviceOrigin: pocketPolisOrigin,
      conversationId,
      title,
      participateUrl,
      reportUrl,
      adminUrl,
      storedByDelib: false,
      credentialStoredByDelib: false,
      writesExternalState: true,
      privacy: {
        privateUrls: ["adminUrl"],
        participantDataOwner: pocketPolisOrigin,
        openData: body.openData,
      },
    },
    201,
  );
}

export async function handleHeyFormRequest(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return json({ error: "origin not allowed" }, 403);
  const body = await readJsonRequest<HeyFormRequest>(request, MAX_INTEGRATION_BODY_BYTES);
  if (body instanceof Response) return body;
  if (body.confirmed !== true) return json({ error: "開啟前請先確認表單資料會送到 HeyForm" }, 400);

  const formId = parseHeyFormId(body.form);
  if (!formId) return json({ error: "請貼上有效的 HeyForm 公開表單網址" }, 400);
  const participantUrl = `https://heyform.net/f/${formId}`;
  const workspaceUrl = new URL("/integrations/heyform", request.url);
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

export async function handleAgoraRequest(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return json({ error: "origin not allowed" }, 403);
  const body = await readJsonRequest<AgoraRequest>(request, MAX_INTEGRATION_BODY_BYTES);
  if (body instanceof Response) return body;
  if (body.confirmed !== true) {
    return json({ error: "開啟前請先確認參與資料會交給 Agora Citizen Network" }, 400);
  }

  const conversationSlug = parseAgoraConversationSlug(body.conversation);
  if (!conversationSlug) return json({ error: "請貼上有效的 Agora 公開對話網址" }, 400);
  const participantUrl = `https://www.agoracitizen.app/conversation/${encodeURIComponent(conversationSlug)}`;
  const embedUrl = `${participantUrl}/embed`;
  const workspaceUrl = new URL("/integrations/agora", request.url);
  workspaceUrl.searchParams.set("conversation", conversationSlug);

  return json({
    integration: "agora-citizen-network",
    mode: "existing-conversation",
    status: "ready",
    conversationSlug,
    workspaceUrl: workspaceUrl.toString(),
    participantUrl,
    embedUrl,
    storedByDelib: false,
    writesWhenOpened: false,
    writesWhenParticipating: true,
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

  const workspaceUrl = new URL("/integrations/tttc", request.url);
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
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    return upstreamFailure(error, "Harmonica");
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
  const workspaceUrl = new URL("/integrations/harmonica", request.url);
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
      signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
    });
  } catch (error) {
    return upstreamFailure(error, "OpenAI");
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

function normalizePocketPolisSeeds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 5 || value.length > 15) return null;
  const statements = value
    .map((statement) => cleanRequiredString(statement, 280))
    .filter((statement): statement is string => Boolean(statement));
  if (statements.length !== value.length) return null;
  const normalized = statements.map((statement) => statement.toLocaleLowerCase("zh-Hant"));
  return new Set(normalized).size === statements.length ? statements : null;
}

function normalizeServiceOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
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

export function parseAgoraConversationSlug(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const parsed = new URL(value.trim());
    const allowedHosts = new Set([
      "agoracitizen.network",
      "www.agoracitizen.network",
      "agoracitizen.app",
      "www.agoracitizen.app",
    ]);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !allowedHosts.has(parsed.hostname)
    ) {
      return null;
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    const oldPath = segments.length === 3 && segments[0] === "feed" && segments[1] === "conversation";
    const oldEmbedPath =
      segments.length === 4 &&
      segments[0] === "feed" &&
      segments[1] === "conversation" &&
      segments[3] === "embed";
    const currentPath = segments.length === 2 && segments[0] === "conversation";
    const currentEmbedPath =
      segments.length === 3 && segments[0] === "conversation" && segments[2] === "embed";
    if (!oldPath && !oldEmbedPath && !currentPath && !currentEmbedPath) return null;
    const conversationSlug = segments[0] === "feed" ? segments[2] : segments[1];
    return /^[A-Za-z0-9_-]{3,120}$/.test(conversationSlug) ? conversationSlug : null;
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

function normalizePublicReceipt(value: unknown, requestOrigin: string): {
  kind: PublicReceiptKind;
  receipt: JsonValue;
} | null {
  if (!isRecord(value)) return null;
  const kind = typeof value.schema === "string" ? PUBLIC_RECEIPT_SCHEMA.get(value.schema) : undefined;
  if (!kind || value.kind !== kind || !isBoundedPublicValue(value)) return null;
  const expectedTopLevel = kind === "pocket-polis-receipt"
    ? ["schema", "kind", "preparedAt", "source", "scope", "findings", "organizer", "dataCard"]
    : [
        "schema",
        "kind",
        "preparedAt",
        "source",
        "question",
        "method",
        "aggregate",
        "result",
        "coverage",
        "organizer",
        "dataCard",
      ];
  if (
    !hasOnlyKeys(value, expectedTopLevel) ||
    !validDateTimeValue(value.preparedAt) ||
    !validPublicOrganizer(value.organizer)
  ) return null;
  if (!isRecord(value.dataCard) || value.dataCard.containsDirectIdentifiers !== false) return null;
  if (
    value.dataCard.containsParticipantData !== true ||
    value.dataCard.containsOrganizerFreeText !== true ||
    value.dataCard.publicationStatus !== "share-link-prepared" ||
    value.dataCard.storedByDelib !== false ||
    value.dataCard.transport !== "url-fragment" ||
    !Array.isArray(value.dataCard.limitations)
  ) return null;

  if (kind === "pocket-polis-receipt") {
    if (
      !hasOnlyKeys(value.dataCard, [
        "containsParticipantData",
        "containsDirectIdentifiers",
        "containsParticipantRecords",
        "containsParticipantFreeText",
        "containsPseudonymousLinkage",
        "containsOrganizerFreeText",
        "aggregation",
        "publicationStatus",
        "storedByDelib",
        "transport",
        "limitations",
      ]) ||
      value.dataCard.containsParticipantRecords !== false ||
      value.dataCard.containsPseudonymousLinkage !== false ||
      value.dataCard.aggregation !== "selected-statement-counts" ||
      !validPocketReceipt(value)
    ) {
      return null;
    }
  } else if (
    !hasOnlyKeys(value.dataCard, [
      "containsParticipantData",
      "containsDirectIdentifiers",
      "containsParticipantFreeText",
      "containsOrganizerFreeText",
      "aggregation",
      "publicationStatus",
      "storedByDelib",
      "transport",
      "limitations",
    ]) ||
    value.dataCard.containsParticipantFreeText !== false ||
    value.dataCard.aggregation !== "pair-counts-without-session-links" ||
    !validRankingReceipt(value, requestOrigin)
  ) {
    return null;
  }

  return { kind, receipt: JSON.parse(JSON.stringify(value)) as JsonValue };
}

function validPocketReceipt(value: Record<string, unknown>): boolean {
  const source = value.source;
  const scope = value.scope;
  const findings = value.findings;
  if (!isRecord(source) || !isRecord(scope) || !Array.isArray(findings)) return false;
  if (
    !hasOnlyKeys(source, [
      "tool",
      "title",
      "description",
      "conversationId",
      "reportUrl",
      "sourceExportedAt",
      "sourceCountMatches",
    ]) ||
    source.tool !== "Pocket Polis" ||
    source.sourceCountMatches !== true ||
    cleanRequiredString(source.title, 120) === null ||
    typeof source.description !== "string" ||
    source.description.length > 2_000 ||
    !cleanMatchingString(source.conversationId, /^[a-z0-9]{10}$/, 10) ||
    !validPocketPolisReportUrl(source.reportUrl, String(source.conversationId)) ||
    !validDateTimeValue(source.sourceExportedAt)
  ) {
    return false;
  }
  if (
    !hasOnlyKeys(scope, ["participants", "approvedStatements", "totalVotes", "coverage", "includedStatements"]) ||
    !integerInRange(scope.participants, 3, 1_000_000) ||
    !integerInRange(scope.approvedStatements, 1, 100_000) ||
    !integerInRange(scope.totalVotes, 1, 100_000_000) ||
    !numberInRange(scope.coverage, 0, 1) ||
    !integerInRange(scope.includedStatements, 1, 8) ||
    findings.length !== scope.includedStatements
  ) {
    return false;
  }
  return findings.length >= 1 && findings.length <= 8 && findings.every((finding) => {
    if (!isRecord(finding) || !hasOnlyKeys(finding, [
      "statementId",
      "text",
      "isSeed",
      "agrees",
      "disagrees",
      "passes",
      "responses",
    ])) return false;
    return integerInRange(finding.statementId, 1, 100_000) &&
      cleanRequiredString(finding.text, 280) !== null &&
      typeof finding.isSeed === "boolean" &&
      integerInRange(finding.agrees, 0, 1_000_000) &&
      integerInRange(finding.disagrees, 0, 1_000_000) &&
      integerInRange(finding.passes, 0, 1_000_000) &&
      integerInRange(finding.responses, 3, 1_000_000) &&
      finding.responses === Number(finding.agrees) + Number(finding.disagrees) + Number(finding.passes);
  });
}

/**
 * A public receipt may only point back at a Pocket Polis public result page
 * (`/r/<10 lowercase alphanumerics>`, no query or fragment). Any other link
 * would turn the short-URL store into anonymous link hosting.
 */
function validPocketPolisReportUrl(value: unknown, conversationId: string): boolean {
  if (typeof value !== "string" || value.length > 2_000) return false;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return false;
    }
    const match = parsed.pathname.match(/^\/r\/([a-z0-9]{10})\/?$/);
    return Boolean(match) && match?.[1] === conversationId;
  } catch {
    return false;
  }
}

function validRankingReceipt(value: Record<string, unknown>, requestOrigin: string): boolean {
  const source = value.source;
  const question = value.question;
  const method = value.method;
  const aggregate = value.aggregate;
  const result = value.result;
  const coverage = value.coverage;
  if (
    !isRecord(source) ||
    !isRecord(question) ||
    !isRecord(method) ||
    !isRecord(aggregate) ||
    !Array.isArray(result) ||
    !isRecord(coverage)
  ) return false;
  if (
    !hasOnlyKeys(source, ["generator", "aggregateStorage", "aggregateUrl", "aggregateExpiresAt"]) ||
    source.generator !== "Delib · Power Ranker" ||
    !["local", "ephemeral-room"].includes(String(source.aggregateStorage)) ||
    !cleanHttpsUrl(source.aggregateUrl, 2_000) ||
    // The aggregate always lives on this Delib deployment's own ranking page.
    !sameOriginUrl(String(source.aggregateUrl), requestOrigin) ||
    !(source.aggregateExpiresAt === null || validDateTimeValue(source.aggregateExpiresAt))
  ) return false;
  if (!hasOnlyKeys(method, ["name", "normalization", "flow", "source", "implementation"])) return false;
  if (!hasOnlyKeys(question, ["title", "items"]) || !Array.isArray(question.items)) return false;
  const questionItems = question.items;
  if (cleanRequiredString(question.title, 120) === null || questionItems.length < 3 || questionItems.length > 10) {
    return false;
  }
  const itemIds = new Set<string>();
  for (const item of questionItems) {
    if (!isRecord(item) || !hasOnlyKeys(item, ["id", "label"])) return false;
    const id = cleanMatchingString(item.id, /^[A-Za-z0-9_-]{1,80}$/, 80);
    if (!id || itemIds.has(id) || cleanRequiredString(item.label, 80) === null) return false;
    itemIds.add(id);
  }
  if (!hasOnlyKeys(aggregate, ["sessions", "judgments", "pairwise"]) || !Array.isArray(aggregate.pairwise)) {
    return false;
  }
  if (!integerInRange(aggregate.sessions, 3, 300) || !integerInRange(aggregate.judgments, 1, 13_500)) {
    return false;
  }
  if (aggregate.pairwise.length > 45 || !aggregate.pairwise.every((pair) => {
    if (!isRecord(pair) || !hasOnlyKeys(pair, ["alpha", "beta", "alphaWins", "betaWins", "equal", "total"])) {
      return false;
    }
    return itemIds.has(String(pair.alpha)) && itemIds.has(String(pair.beta)) && pair.alpha !== pair.beta &&
      integerInRange(pair.alphaWins, 0, 300) && integerInRange(pair.betaWins, 0, 300) &&
      integerInRange(pair.equal, 0, 300) && integerInRange(pair.total, 0, 900);
  })) return false;
  if (result.length !== questionItems.length || !result.every((item) => {
    if (!isRecord(item) || !hasOnlyKeys(item, ["id", "label", "score", "observations", "rank"])) return false;
    return itemIds.has(String(item.id)) && cleanRequiredString(item.label, 80) !== null &&
      numberInRange(item.score, 0, 1) && integerInRange(item.observations, 0, 13_500) &&
      integerInRange(item.rank, 1, questionItems.length);
  })) return false;
  return hasOnlyKeys(coverage, ["comparedPairs", "totalPairs", "ratio"]) &&
    integerInRange(coverage.comparedPairs, 1, 45) &&
    integerInRange(coverage.totalPairs, 3, 45) &&
    numberInRange(coverage.ratio, 0, 1);
}

function sameOriginUrl(value: string, origin: string): boolean {
  try {
    return new URL(value).origin === origin;
  } catch {
    return false;
  }
}

function validPublicOrganizer(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "interpretation",
    "missingVoices",
    "decisionStatus",
    "authority",
    "responsibleActor",
    "responseBy",
    "nextAction",
    "evidenceUrl",
  ])) return false;
  return cleanRequiredString(value.interpretation, 1_200) !== null &&
    cleanRequiredString(value.missingVoices, 800) !== null &&
    ["listening", "under-review", "adopted", "partially-adopted", "not-adopted"].includes(
      String(value.decisionStatus),
    ) &&
    cleanRequiredString(value.authority, 120) !== null &&
    cleanRequiredString(value.responsibleActor, 120) !== null &&
    cleanRequiredString(value.nextAction, 500) !== null &&
    (value.responseBy === "" || /^\d{4}-\d{2}-\d{2}$/.test(String(value.responseBy))) &&
    (value.evidenceUrl === "" || cleanHttpsUrl(value.evidenceUrl, 2_000) !== null);
}

function isBoundedPublicValue(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (value === null || typeof value === "boolean" || typeof value === "number") return true;
  if (typeof value === "string") return value.length <= 2_000;
  if (Array.isArray(value)) return value.length <= 50 && value.every((item) => isBoundedPublicValue(item, depth + 1));
  if (!isRecord(value) || Object.keys(value).length > 20) return false;
  const forbidden = new Set([
    "participantid",
    "participantids",
    "sessionid",
    "sessionids",
    "votes",
    "admintoken",
    "managetoken",
    "token",
    "sourcefiles",
    "importedfiles",
  ]);
  return Object.entries(value).every(([key, nested]) =>
    !forbidden.has(key.toLowerCase()) && key.length <= 80 && isBoundedPublicValue(nested, depth + 1));
}

function hasOnlyKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function integerInRange(value: unknown, min: number, max: number): boolean {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
}

function numberInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function validDateTimeValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf());
}

function publicReceiptResult(result: PublicReceiptRecord): Response {
  switch (result.status) {
    case "ready":
      return json({
        status: "ready",
        kind: result.kind,
        receipt: result.receipt,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt,
      }, 200);
    case "deleted":
      return json({ status: "deleted" }, 200);
    case "expired":
      return json({ error: "這份公開成果已到期並清除" }, 410);
    case "forbidden":
      return json({ error: "私人刪除權杖不正確" }, 403);
    case "not_found":
      return json({ error: "找不到這份公開成果" }, 404);
    default:
      return json({ error: "公開成果暫時無法回應" }, 503);
  }
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

function json(
  data: unknown,
  status: number,
  headOnly = false,
  extraHeaders: Record<string, string> = {},
): Response {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  };
  if (headOnly) {
    return new Response(null, { status, headers: { ...headers, "Content-Type": "application/json" } });
  }
  return Response.json(data, { status, headers });
}

function withSecurityHeaders(response: Response, pathname: string): Response {
  const next = new Response(response.body, response);
  const polisWorkspace = pathname === "/integrations/polis.html" || pathname === "/integrations/polis";
  const heyFormWorkspace = pathname === "/integrations/heyform.html" || pathname === "/integrations/heyform";
  const agoraWorkspace = pathname === "/integrations/agora.html" || pathname === "/integrations/agora";
  const tttcWorkspace = pathname === "/integrations/tttc.html" || pathname === "/integrations/tttc";
  const harmonicaWorkspace =
    pathname === "/integrations/harmonica.html" || pathname === "/integrations/harmonica";
  const frameSource = polisWorkspace
    ? "https://pol.is"
    : heyFormWorkspace
      ? "https://heyform.net"
      : agoraWorkspace
        ? "https://agoracitizen.network https://www.agoracitizen.network https://agoracitizen.app https://www.agoracitizen.app"
        : tttcWorkspace
          ? "https://talktothe.city"
          : harmonicaWorkspace
            ? "https://app.harmonica.chat"
            : "'none'";
  // Keep in sync with public/_headers (static pages). The Cloudflare Web
  // Analytics beacon is cookieless and injected by the zone, so allow it here
  // instead of logging a CSP violation on every page view.
  next.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; img-src 'self' data:; connect-src 'self' https://cloudflareinsights.com; frame-src ${frameSource}; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
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
