import { describe, expect, it, vi } from "vitest";
import { collectOutputText, handleAgentRequest } from "./index";

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

