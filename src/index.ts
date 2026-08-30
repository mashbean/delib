interface Env {
  ASSETS: Fetcher;
}

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
const DEFAULT_MODEL = "gpt-5.6";

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
          storage: "none",
        },
        200,
      );
    }

    if (url.pathname === "/api/agent" && request.method === "POST") {
      return handleAgentRequest(request);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "not found" }, 404);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    return withSecurityHeaders(assetResponse, url.pathname);
  },
} satisfies ExportedHandler<Env>;

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
  next.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
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

