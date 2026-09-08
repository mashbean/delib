import {nativeAdapters} from '../public/exchange-core.js';
import {pocketPolisBundleToDelibData,rankingBundleToDelibData} from '../public/delib-data-core.js';
import {parseTttcCsv} from '../public/tttc-csv-core.js';
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(here, "..");

const readJson = async (root, path) => JSON.parse(await readFile(resolve(root, path), "utf8"));

const countBy = (items, key) => items.reduce((result, item) => {
  const value = item[key] ?? "unknown";
  result[value] = (result[value] ?? 0) + 1;
  return result;
}, {});

const formatCounts = (counts) => Object.entries(counts)
  .map(([key, value]) => `${key} ${value}`)
  .join(", ");

/**
 * Build a deterministic, read-only interoperability audit from the checked-in
 * registries. It deliberately reports catalog metadata and adapter coverage;
 * it never calls an upstream service or creates an activity.
 */
export async function buildAudit(root = defaultRoot) {
  const [tools, integrations, hosting, dataSchema, roundsSchema, workspaceSchema] = await Promise.all([
    readJson(root, "public/data/tools.json"),
    readJson(root, "public/data/integrations.json"),
    readJson(root, "public/data/hosting.json"),
    readJson(root, "public/schemas/delib-data/v1.json"),
    readJson(root, "public/schemas/delib-rounds/v1.json"),
    readJson(root, "public/schemas/delib-workspace/v1.json"),
  ]);

  const toolIds = tools.tools.map((tool) => tool.id);
  const auditedIds = [
    ...integrations.integrations.map((item) => item.toolId),
    ...integrations.catalogOnly,
  ];
  const adapterFiles = [
    "public/delib-data-core.js",
    "public/tttc-csv-core.js",
    "public/handoff-core.js",
    "public/integrations/pocket-polis-data.js",
    "public/integrations/power-ranker.js",
  ];
  adapterFiles.push('public/exchange-core.js');
  const adapterCoverage = [
    {name:'Pocket Polis',implemented:typeof pocketPolisBundleToDelibData === 'function',contract:'delib-data/v1'},
    {name:'Power Ranker',implemented:typeof rankingBundleToDelibData === 'function',contract:'delib-data/v1'},
    {name:'TTTC CSV',implemented:typeof parseTttcCsv === 'function',contract:'id,interview,comment'},
    ...nativeAdapters.map(tool=>({name:({form:'Form native JSON',harmonica:'Harmonica native JSON',tttc:'TTTC report JSON',reply:'Reply native JSON'})[tool] || `${tool} native JSON`,implemented:true,contract:'delib-exchange/v1 private companion'}))
  ];

  const duplicateToolIds = toolIds.filter((id, index) => toolIds.indexOf(id) !== index);
  const duplicateAuditIds = auditedIds.filter((id, index) => auditedIds.indexOf(id) !== index);
  const missingFromAudit = toolIds.filter((id) => !auditedIds.includes(id));
  const unknownAuditIds = auditedIds.filter((id) => !toolIds.includes(id));
  const requiredDataFields = dataSchema.required;
  const requiredRoundFields = roundsSchema.required;
  const requiredWorkspaceFields = workspaceSchema.required;

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      tools: tools.tools.length,
      integratedTools: tools.tools.filter((tool) => tool.status === "integrated").length,
      catalogTools: tools.tools.filter((tool) => tool.status === "catalog").length,
      auditedIntegrations: integrations.integrations.length,
      catalogOnly: integrations.catalogOnly.length,
    },
    readiness: countBy(integrations.integrations, "readiness"),
    hostingRoutes: countBy(hosting.tools, "route"),
    coverage: {
      duplicateToolIds,
      duplicateAuditIds,
      missingFromAudit,
      unknownAuditIds,
      complete: duplicateToolIds.length === 0 && duplicateAuditIds.length === 0 &&
        missingFromAudit.length === 0 && unknownAuditIds.length === 0,
    },
    schemas: {
      canonicalData: { id: dataSchema.$id, required: requiredDataFields },
      rounds: { id: roundsSchema.$id, required: requiredRoundFields },
      workspace: { id: workspaceSchema.$id, required: requiredWorkspaceFields },
    },
    adapterCoverage,
    adapterFiles,
  };
}

export function renderMarkdown(audit) {
  const lines = [
    "# Delib interoperability audit",
    "",
    `Generated: ${audit.generatedAt}`,
    "",
    "This is a read-only audit of checked-in registries and local adapters. It does not create activities, call upstream APIs or claim semantic equivalence.",
    "",
    `- Tools: ${audit.counts.tools} (${audit.counts.integratedTools} integrated, ${audit.counts.catalogTools} catalog)`,
    `- Integration registry: ${audit.counts.auditedIntegrations} entries + ${audit.counts.catalogOnly} catalog-only entries`,
    `- Readiness: ${formatCounts(audit.readiness)}`,
    `- Hosting routes: ${formatCounts(audit.hostingRoutes)}`,
    `- Registry coverage: ${audit.coverage.complete ? "complete" : "needs repair"}`,
    "",
    "## Canonical contracts",
    "",
    `- delib-data/v1: ${audit.schemas.canonicalData.required.join(", ")}`,
    `- delib-rounds/v1: ${audit.schemas.rounds.required.join(", ")}`,
    `- delib-workspace/v1: ${audit.schemas.workspace.required.join(", ")}`,
    "",
    "## Local adapter coverage",
    "",
    "| Surface | Executable adapter | Interpretation |",
    "| --- | --- | --- |",
    ...audit.adapterCoverage.map((item) => `| ${item.name} | ${item.implemented ? "yes" : "no"} | ${item.implemented ? "Exported adapter covered by contract fixtures; destination semantics remain explicit." : "No native JSON → canonical adapter detected; keep this as a next implementation gate."} |`),
    "",
    "## Repair queue",
    "",
    "1. Extend native export coverage for omitted proposal revisions, ballot reasons and remote withdrawal histories.",
    "2. Keep CSV adapters as compatibility bridges; emit field-level preservation and loss reports.",
    "3. Local withdrawal and typed relations are implemented in delib-exchange/v1; destination permission remains an explicit human review.",
    "4. Civic Talk public opinions import and Sensemaker backend JSON export are fixture-tested; the Sensemaker web picker still needs a JSON entry path.",
    "5. Keep live upstream writes behind the existing human confirmation boundary.",
    "",
  ];
  if (!audit.coverage.complete) {
    lines.push("Coverage errors:", "", ...audit.coverage.missingFromAudit.map((id) => `- Missing from integration audit: ${id}`), ...audit.coverage.unknownAuditIds.map((id) => `- Unknown integration ID: ${id}`), "");
  }
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const audit = await buildAudit();
  process.stdout.write(`${renderMarkdown(audit)}\n`);
}
