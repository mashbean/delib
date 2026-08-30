import { describe, expect, it } from "vitest";
import {
  buildBundle,
  buildMarkdown,
  buildPlan,
  normalizeState,
  recommendTools,
  stateFromSearch,
  stateToSearch,
} from "../public/core.js";

const state = {
  goal: "listen",
  format: "hybrid",
  scale: "medium",
  privacy: "pseudonymous",
  output: "receipt",
};

const tools = [
  {
    id: "call-in",
    name: "Call-in",
    summary: "即時互動",
    url: "https://example.com/call-in",
    source: "https://example.com/source",
    status: "integrated",
    goals: ["listen"],
    formats: ["hybrid"],
    scales: ["medium"],
    privacy: ["pseudonymous"],
    outputs: ["receipt"],
  },
  {
    id: "public-only",
    name: "Public only",
    summary: "公開投票",
    url: "https://example.com/public",
    status: "catalog",
    goals: ["listen"],
    formats: ["hybrid"],
    scales: ["medium"],
    privacy: ["public"],
    outputs: ["questions"],
  },
];

describe("plan state", () => {
  it("round trips through stable query parameters", () => {
    expect(stateFromSearch(`?${stateToSearch(state)}`)).toEqual(state);
  });

  it("rejects missing and unknown options", () => {
    expect(normalizeState({ ...state, goal: "invented" })).toBeNull();
    expect(normalizeState({ goal: "listen" })).toBeNull();
  });
});

describe("recommendations", () => {
  it("uses deterministic capabilities and privacy support", () => {
    expect(recommendTools(tools, state)[0].id).toBe("call-in");
  });

  it("builds a recipe with offline gears and care checks", () => {
    const plan = buildPlan(state, tools);
    expect(plan.offlineGears).toHaveLength(3);
    expect(plan.careChecks).toHaveLength(6);
    expect(plan.tools[0].match.reasons).toContain("支援需要匿名或化名");
  });
});

describe("handoff artifacts", () => {
  it("exports a participant-data-free bundle", () => {
    const bundle = buildBundle(buildPlan(state, tools), "https://delib.example/?goal=listen");
    expect(bundle.schema).toContain("delib-bundle/v1");
    expect(bundle.dataCard.containsParticipantData).toBe(false);
    expect(bundle.recipe.tools[0]).not.toHaveProperty("match");
  });

  it("exports a human-readable runbook", () => {
    const markdown = buildMarkdown(buildPlan(state, tools), "https://delib.example/");
    expect(markdown).toContain("# 審議拼圖執行手冊");
    expect(markdown).toContain("Civic AI care check");
    expect(markdown).toContain("Call-in");
  });
});

