import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("public contracts", () => {
  it("publishes the same skill used by local installers", async () => {
    const local = await readFile(new URL("skills/delib/SKILL.md", root), "utf8");
    const publicCopy = await readFile(new URL("public/.well-known/delib/SKILL.md", root), "utf8");
    expect(publicCopy).toBe(local);
    expect(local).toContain("name: delib");
    expect(local).toContain("bounded local steward");
  });

  it("ships a source-linked registry with 25 unique tools", async () => {
    const registry = JSON.parse(await readFile(new URL("public/data/tools.json", root), "utf8"));
    expect(registry.schema).toBe("delib-tools/v1");
    expect(registry.tools).toHaveLength(25);
    expect(new Set(registry.tools.map((tool) => tool.id)).size).toBe(25);
    for (const tool of registry.tools) {
      expect(tool.url).toMatch(/^https:\/\//);
      expect(tool.source).toMatch(/^https:\/\//);
      expect(["integrated", "adapter", "catalog"]).toContain(tool.status);
    }
  });

  it("keeps the bundle schema URL stable", async () => {
    const schema = JSON.parse(
      await readFile(new URL("public/schemas/delib-bundle/v1.json", root), "utf8"),
    );
    expect(schema.$id).toBe("https://delib.mashbean.net/schemas/delib-bundle/v1.json");
    expect(schema.properties.dataCard.properties.containsParticipantData.const).toBe(false);
  });

  it("accounts for every catalog tool in the direct-integration audit", async () => {
    const tools = JSON.parse(await readFile(new URL("public/data/tools.json", root), "utf8"));
    const audit = JSON.parse(await readFile(new URL("public/data/integrations.json", root), "utf8"));
    expect(audit.schema).toBe("delib-integrations/v1");
    const auditedIds = [
      ...audit.integrations.map((item) => item.toolId),
      ...audit.catalogOnly,
    ];
    expect(auditedIds).toHaveLength(25);
    expect(new Set(auditedIds).size).toBe(25);
    expect(new Set(auditedIds)).toEqual(new Set(tools.tools.map((tool) => tool.id)));
    expect(audit.integrations.find((item) => item.toolId === "call-in").readiness).toBe("available");
    expect(audit.integrations.find((item) => item.toolId === "polis").readiness).toBe(
      "available-with-connection",
    );
    expect(audit.integrations.find((item) => item.toolId === "heyform").readiness).toBe(
      "available-existing-only",
    );
    expect(audit.integrations.find((item) => item.toolId === "talk-to-the-city").readiness).toBe(
      "available-with-upstream-login",
    );
    expect(audit.integrations.filter((item) => item.activation === "embedded-workspace")).toHaveLength(3);
  });
});
