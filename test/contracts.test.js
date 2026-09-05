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

  it("ships a source-linked registry with 33 unique tools", async () => {
    const registry = JSON.parse(await readFile(new URL("public/data/tools.json", root), "utf8"));
    expect(registry.schema).toBe("delib-tools/v1");
    expect(registry.tools).toHaveLength(33);
    expect(new Set(registry.tools.map((tool) => tool.id)).size).toBe(33);
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

  it("publishes one cross-tool data contract with source and privacy provenance", async () => {
    const schema = JSON.parse(
      await readFile(new URL("public/schemas/delib-data/v1.json", root), "utf8"),
    );
    expect(schema.$id).toBe("https://delib.mashbean.net/schemas/delib-data/v1.json");
    expect(schema.properties.source.required).toContain("sourceSchema");
    expect(schema.properties.dataCard.required).toEqual(
      expect.arrayContaining(["containsPseudonymousLinkage", "suitableForPublicSharing"]),
    );
  });

  it("publishes an eight-step people, data and feedback-loop process map", async () => {
    const process = JSON.parse(
      await readFile(new URL("public/data/deliberation-process.json", root), "utf8"),
    );
    const schema = JSON.parse(
      await readFile(new URL("public/schemas/delib-process/v1.json", root), "utf8"),
    );
    expect(process.schema).toBe("delib-process/v1");
    expect(schema.$id).toBe("https://delib.mashbean.net/schemas/delib-process/v1.json");
    expect(process.steps).toHaveLength(8);
    expect(new Set(process.steps.map((step) => step.id)).size).toBe(8);
    expect(new Set(process.steps.map((step) => step.icon)).size).toBe(8);
    expect(process.steps.find((step) => step.id === "recruit").humanFlow).toContain("受邀者");
    expect(process.steps.find((step) => step.id === "sortition").tools).toContain("OpenDLP");
    expect(process.steps.find((step) => step.id === "feedback").dataFlow).toContain("不含逐筆參與資料");
    expect(process.feedbackLoops.map((loop) => loop.audience)).toEqual(["參與者", "主辦者", "工具開發者"]);
  });

  it("keeps the homepage dense sections progressively disclosed", async () => {
    const homepage = await readFile(new URL("public/index.html", root), "utf8");
    expect(homepage).toContain('id="comparison-more"');
    expect(homepage).toContain('class="tool-catalog-details"');
    expect(homepage.match(/<details id="launch-/g)).toHaveLength(8);
    expect(homepage).toContain('/assets/lucide-LICENSE.txt');
  });

  it("publishes a source-linked deployment and interoperability comparison", async () => {
    const comparison = JSON.parse(
      await readFile(new URL("public/data/tool-comparison.json", root), "utf8"),
    );
    const schema = JSON.parse(
      await readFile(new URL("public/schemas/delib-tool-comparison/v1.json", root), "utf8"),
    );
    expect(comparison.schema).toBe("delib-tool-comparison/v1");
    expect(schema.$id).toBe("https://delib.mashbean.net/schemas/delib-tool-comparison/v1.json");
    expect(comparison.tools.length).toBeGreaterThanOrEqual(15);
    expect(new Set(comparison.tools.map((tool) => tool.id)).size).toBe(comparison.tools.length);
    for (const tool of comparison.tools) {
      expect(["direct", "connected", "catalog"]).toContain(tool.delibMode);
      expect(["implemented", "partial", "planned"]).toContain(tool.interopLevel);
      expect(tool.url).toMatch(/^https:\/\//);
      expect(tool.source).toMatch(/^https:\/\//);
    }
    expect(comparison.tools.find((tool) => tool.id === "pocket-polis")).toMatchObject({
      deploymentRoute: "one-click",
      interopLevel: "implemented",
      openSource: "yes",
    });
    expect(comparison.tools.find((tool) => tool.id === "polis").deploymentRoute).toBe("shared-host");
    expect(comparison.tools.find((tool) => tool.id === "opendlp")).toMatchObject({
      deploymentRoute: "early-stage",
      license: "Apache-2.0",
    });
  });

  it("lists only reproducible Cloudflare-native paths as one-click recipes", async () => {
    const deployments = JSON.parse(
      await readFile(new URL("public/data/deployments.json", root), "utf8"),
    );
    expect(deployments.schema).toBe("delib-deployments/v1");
    expect(deployments.recipes.map((item) => item.id)).toEqual([
      "delib-suite",
      "pocket-polis",
      "call-in",
    ]);
    for (const recipe of deployments.recipes) {
      expect(recipe.status).toBe("one-click");
      expect(recipe.repositoryUrl).toMatch(/^https:\/\/github\.com\//);
      expect(recipe.deployUrl).toMatch(/^https:\/\/deploy\.workers\.cloudflare\.com\//);
    }
    expect(deployments.operatorPaths.find((item) => item.id === "polis").status).toBe("shared-host");
    expect(deployments.operatorPaths.find((item) => item.id === "parti-demosx").status).toBe("needs-rehabilitation");
  });

  it("publishes a privacy-safe developer feedback contract and issue workflow", async () => {
    const schema = JSON.parse(
      await readFile(new URL("public/schemas/delib-feedback/v1.json", root), "utf8"),
    );
    const workflow = await readFile(new URL(".github/workflows/check.yml", root), "utf8");
    expect(schema.$id).toBe("https://delib.mashbean.net/schemas/delib-feedback/v1.json");
    expect(schema.properties.dataCard.properties.submittedAutomatically.const).toBe(false);
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("npm run check");
  });

  it("accounts for every catalog tool in the direct-integration audit", async () => {
    const tools = JSON.parse(await readFile(new URL("public/data/tools.json", root), "utf8"));
    const audit = JSON.parse(await readFile(new URL("public/data/integrations.json", root), "utf8"));
    expect(audit.schema).toBe("delib-integrations/v1");
    const auditedIds = [
      ...audit.integrations.map((item) => item.toolId),
      ...audit.catalogOnly,
    ];
    expect(auditedIds).toHaveLength(33);
    expect(new Set(auditedIds).size).toBe(33);
    expect(new Set(auditedIds)).toEqual(new Set(tools.tools.map((tool) => tool.id)));
    expect(audit.integrations.find((item) => item.toolId === "call-in").readiness).toBe("available");
    expect(audit.integrations.find((item) => item.toolId === "polis").readiness).toBe(
      "available-with-connection",
    );
    expect(audit.integrations.find((item) => item.toolId === "pocket-polis").readiness).toBe(
      "available",
    );
    expect(audit.integrations.find((item) => item.toolId === "pocket-tttc").readiness).toBe("available");
    expect(audit.integrations.find((item) => item.toolId === "heyform").readiness).toBe(
      "available-existing-only",
    );
    expect(audit.integrations.find((item) => item.toolId === "agora-citizen-network").readiness).toBe(
      "available-existing-only",
    );
    expect(audit.integrations.find((item) => item.toolId === "talk-to-the-city").readiness).toBe(
      "available-with-upstream-login",
    );
    expect(audit.integrations.find((item) => item.toolId === "harmonica").readiness).toBe(
      "available-with-api-key",
    );
    expect(audit.integrations.find((item) => item.toolId === "power-ranker").readiness).toBe(
      "available",
    );
    expect(audit.integrations.filter((item) => item.activation === "embedded-workspace")).toHaveLength(4);
    expect(audit.integrations.filter((item) => item.activation === "credentialed-create")).toHaveLength(1);
    expect(audit.integrations.filter((item) => item.activation === "local-or-ephemeral-room")).toHaveLength(1);
    expect(audit.integrations.filter((item) => item.activation === "managed-create")).toHaveLength(7);
  });

  it("publishes one source and hosting decision for every tool", async () => {
    const tools = JSON.parse(await readFile(new URL("public/data/tools.json", root), "utf8"));
    const hosting = JSON.parse(await readFile(new URL("public/data/hosting.json", root), "utf8"));
    expect(hosting.schema).toBe("delib-hosting/v1");
    expect(hosting.tools).toHaveLength(33);
    expect(new Set(hosting.tools.map((item) => item.toolId))).toEqual(
      new Set(tools.tools.map((tool) => tool.id)),
    );
    for (const item of hosting.tools) {
      expect(["direct", "connected", "shared-host", "component", "research", "blocked", "unverified"]).toContain(
        item.route,
      );
      expect(typeof item.source.reusable).toBe("boolean");
      if (item.source.reusable) expect(item.source.url).toMatch(/^https:\/\//);
    }
  });

  it("publishes a participant-aware schema for local ranking handoff", async () => {
    const schema = JSON.parse(
      await readFile(new URL("public/schemas/delib-ranking/v1.json", root), "utf8"),
    );
    expect(schema.$id).toBe("https://delib.mashbean.net/schemas/delib-ranking/v1.json");
    expect(schema.properties.dataCard.properties.containsParticipantData.const).toBe(true);
    expect(schema.properties.dataCard.properties.storedByDelib.type).toBe("boolean");
    expect(schema.allOf[0].then.properties.dataCard.properties.storedByDelib.const).toBe(false);
  });

  it("publishes a participant-aware Pocket Polis handoff schema", async () => {
    const schema = JSON.parse(
      await readFile(new URL("public/schemas/delib-pocket-polis/v1.json", root), "utf8"),
    );
    expect(schema.$id).toBe("https://delib.mashbean.net/schemas/delib-pocket-polis/v1.json");
    expect(schema.properties.summary.properties.participants.description).toContain("at least one vote");
    expect(schema.properties.source.properties.persistedByDelib.const).toBe(false);
    expect(schema.properties.dataCard.properties.containsParticipantData.const).toBe(true);
    expect(schema.properties.dataCard.properties.containsParticipantFreeText.const).toBe(true);
    expect(schema.properties.dataCard.properties.containsPseudonymousLinkage.const).toBe(true);
    expect(schema.properties.dataCard.properties.storedByDelib.const).toBe(false);
  });

  it("publishes a de-linked Pocket Polis public receipt schema", async () => {
    const schema = JSON.parse(
      await readFile(new URL("public/schemas/delib-pocket-polis-receipt/v1.json", root), "utf8"),
    );
    expect(schema.$id).toBe(
      "https://delib.mashbean.net/schemas/delib-pocket-polis-receipt/v1.json",
    );
    expect(schema.properties.scope.properties.participants.minimum).toBe(3);
    expect(schema.properties.scope.properties.participants.description).toContain("at least one vote");
    expect(schema.properties.findings.maxItems).toBe(8);
    expect(schema.properties.dataCard.properties.containsParticipantRecords.const).toBe(false);
    expect(schema.properties.dataCard.properties.containsParticipantFreeText.const).toBe(true);
    expect(schema.properties.dataCard.properties.containsPseudonymousLinkage.const).toBe(false);
    expect(schema.properties.dataCard.properties.transport.const).toBe("url-fragment");
  });

  it("keeps the Pocket Polis admin capability out of the data-workbench handoff", async () => {
    const app = await readFile(new URL("public/app.js", root), "utf8");
    const workbench = await readFile(
      new URL("public/integrations/pocket-polis-data.js", root),
      "utf8",
    );
    expect(app).toContain('"delib:pocket-polis-data-source"');
    expect(workbench).toContain('"delib:pocket-polis-data-source"');
    expect(workbench).not.toContain('"delib:pocket-polis-instance"');
    expect(workbench).not.toContain("adminUrl");
  });

  it("ships the Pocket Polis public receipt builder and fragment-only renderer", async () => {
    const builder = await readFile(
      new URL("public/integrations/pocket-polis-data.html", root),
      "utf8",
    );
    const renderer = await readFile(new URL("public/results/pocket-polis.js", root), "utf8");
    const builderScript = await readFile(
      new URL("public/integrations/pocket-polis-data.js", root),
      "utf8",
    );
    const receiptPage = await readFile(new URL("public/results/pocket-polis.html", root), "utf8");
    expect(builder).toContain('id="pocket-polis-receipt-form"');
    expect(builder).toContain("選 1–8 句");
    expect(builderScript).toContain("匿名投票者");
    expect(receiptPage).toContain("匿名投票者");
    expect(renderer).toContain("pocketPolisReceiptFromHash(location.hash)");
    expect(renderer).not.toContain("location.search");
    expect(renderer).not.toContain("adminUrl");
  });

  it("publishes a layered, fragment-only schema for ranking result receipts", async () => {
    const schema = JSON.parse(
      await readFile(new URL("public/schemas/delib-ranking-receipt/v1.json", root), "utf8"),
    );
    expect(schema.$id).toBe(
      "https://delib.mashbean.net/schemas/delib-ranking-receipt/v1.json",
    );
    expect(schema.properties.dataCard.properties.containsParticipantData.const).toBe(true);
    expect(schema.properties.dataCard.properties.containsParticipantFreeText.const).toBe(false);
    expect(schema.properties.dataCard.properties.containsOrganizerFreeText.const).toBe(true);
    expect(schema.properties.dataCard.properties.storedByDelib.const).toBe(false);
    expect(schema.properties.dataCard.properties.transport.const).toBe("url-fragment");
    expect(schema.properties.organizer.required).toEqual(
      expect.arrayContaining(["interpretation", "missingVoices", "authority", "responsibleActor", "nextAction"]),
    );
  });
});
