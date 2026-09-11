#!/usr/bin/env node
// Post-deploy smoke test. Read-only: it never creates rooms, receipts or
// upstream activities. Usage:
//   node scripts/smoke.mjs [baseUrl] [--expect-version 0.2.0] [--expect-sha abc1234]
// Exit code 1 when any check fails, so CI and humans see the same verdict.

const args = process.argv.slice(2);
const baseUrl = (args.find((arg) => !arg.startsWith("--")) || "https://delib.mashbean.net").replace(/\/$/, "");
const expectedVersion = flag("--expect-version");
const expectedSha = flag("--expect-sha");

const checks = [];
const failures = [];

function flag(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || "" : "";
}

async function check(label, run) {
  try {
    const detail = await run();
    checks.push(`✓ ${label}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    failures.push(`✗ ${label} — ${error instanceof Error ? error.message : String(error)}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function get(path, init = {}) {
  return fetch(`${baseUrl}${path}`, { redirect: "manual", ...init, signal: AbortSignal.timeout(15_000) });
}

await check("GET /api/health reports version and build", async () => {
  const response = await get("/api/health");
  expect(response.status === 200, `status ${response.status}`);
  const body = await response.json();
  expect(body.ok === true, "ok !== true");
  expect(typeof body.version === "string", "missing version");
  if (expectedVersion) expect(body.version === expectedVersion, `version ${body.version} !== ${expectedVersion}`);
  if (expectedSha) expect(body.build?.sha === expectedSha, `sha ${body.build?.sha} !== ${expectedSha}`);
  return `version ${body.version}, sha ${body.build?.sha || "n/a"}, deployed ${body.build?.deployedAt || "n/a"}`;
});

await check("HEAD /api/health answers uptime checkers", async () => {
  const response = await get("/api/health", { method: "HEAD" });
  expect(response.status === 200, `status ${response.status}`);
});

await check("GET / serves the homepage with a strict CSP", async () => {
  const response = await get("/");
  expect(response.status === 200, `status ${response.status}`);
  const csp = response.headers.get("content-security-policy") || "";
  expect(csp.includes("frame-src 'none'"), `unexpected CSP: ${csp || "(missing)"}`);
  expect(response.headers.get("x-frame-options") === "DENY", "missing X-Frame-Options");
  const html = await response.text();
  expect(html.includes("審議拼圖"), "homepage text missing");
});

await check("GET /workspace serves the local issue workbench", async () => {
  const response = await get('/workspace');
  expect(response.status === 200, `status ${response.status}`);
  const html = await response.text();
  expect(html.includes('/workspace.js') && html.includes('project-content'), 'workspace assets missing');
});

await check("Workspace flow assets are published", async () => {
  for (const path of ['/workspace-flow-core.js', '/workspace-flow-view.js', '/workspace-setting-core.js', '/workspace-flow.css', '/vendor/workspace-flow.bundle.js']) {
    const response = await get(path);
    expect(response.status === 200, `${path}: status ${response.status}`);
    expect(!(response.headers.get('content-type') || '').includes('text/html'), `${path}: unexpected HTML fallback`);
    expect((await response.text()).length > 100, `${path}: empty asset`);
  }
});

await check("3D entry and scoped Metagov Statement export are published", async () => {
  const response = await get('/handoff?lang=zh');
  expect(response.status === 200, `handoff status ${response.status}`);
  expect((await response.text()).includes('workspace-flow-link'), 'missing handoff flow entry');
  const mappingResponse = await get('/data/metagov-crosswalk.json');
  expect(mappingResponse.status === 200, `mapping status ${mappingResponse.status}`);
  const mapping = await mappingResponse.json();
  expect(mapping.schema === 'delib-metagov-crosswalk/v1', 'wrong crosswalk');
  expect(mapping.target.revision === 'e5d3312aa0da481429ef4545ac172b668ead5f55', 'unexpected target revision');
  expect(mapping.externalAcceptance === false && mapping.nativeExporterImplemented === true && mapping.exportScope.startsWith('Statement definition only'), 'incorrect acceptance claim');
  for (const path of ['/metagov-readiness-core.js', '/metagov-readiness-view.js', '/metagov-export-core.js', '/metagov-export-view.js', '/metagov-mapping-core.js', '/vendor/metagov-statement-validator.js']) {
    const asset = await get(path);
    expect(asset.status === 200 && !(asset.headers.get('content-type') || '').includes('text/html'), `${path}: missing module`);
  }
});

await check("Pinned upstream Statement schema is available", async () => {
  const response = await get('/schemas/metagov/e5d3312/all-types.json');
  expect(response.status === 200, 'missing upstream schema');
  const schema = await response.json();
  expect(schema.definitions.Statement.required.includes('role_classified_by'), 'missing required classifier');
  const provenance = await get('/schemas/metagov/e5d3312/provenance.json');
  expect(provenance.status === 200, 'missing source provenance');
});

await check("Handoff inspector and local-only modules are published", async () => {
  const response = await get('/interop?lang=zh');
  expect(response.status === 200, 'missing inspector page');
  const html = await response.text();
  expect(html.includes('interop-main') && html.includes('/interop.js'), 'wrong inspector page');
  for (const path of ['/interop-core.js', '/interop-view.js', '/interop-demo.js', '/interop.css', '/metagov-files-core.js']) {
    const asset = await get(path);
    expect(asset.status === 200 && !(asset.headers.get('content-type') || '').includes('text/html'), `${path}: missing module`);
  }
});

await check("Workspace contract is published", async () => {
  const response = await get('/schemas/delib-workspace/v1.json');
  expect(response.status === 200, `status ${response.status}`);
  expect((await response.json()).$id === 'https://delib.mashbean.net/schemas/delib-workspace/v1.json', 'wrong contract');
});

await check("Workspace readback rejects cross-origin input before reading services", async () => {
  const response = await get('/api/workspace/read', {method:'POST',headers:{'Content-Type':'application/json',Origin:'https://invalid.example'},body:JSON.stringify({tool:'form',id:'aaaaaaaaaa'})});
  expect(response.status === 403, `status ${response.status}`);
});

await check("GET /integrations/polis allows only the Pol.is frame", async () => {
  const response = await get("/integrations/polis");
  expect(response.status === 200, `status ${response.status}`);
  const csp = response.headers.get("content-security-policy") || "";
  expect(csp.includes("frame-src https://pol.is"), `unexpected CSP: ${csp || "(missing)"}`);
  expect(!csp.includes("frame-src 'none'"), "workspace CSP still blocks frames");
});

await check("Native tool stations serve a bilingual shell with a fixed frame allowlist", async () => {
  const slugs = ["form", "harmonica", "polis", "call-in", "tttc", "reply", "proposals", "argument", "budget", "rank", "checks", "values", "maple"];
  for (const slug of slugs) {
    const response = await get(`/${slug}?lang=en`);
    expect(response.status === 200, `/${slug}: ${response.status}`);
    const html = await response.text();
    expect(html.includes("tool-shell.js"), `/${slug}: missing shell`);
    const csp = response.headers.get("content-security-policy") || "";
    expect(csp.includes("frame-src ") && !csp.includes("frame-src *"), `/${slug}: missing frame restriction`);
  }
  return `${slugs.length} stations`;
});

await check("Round fixture, contract and Agent skill are published", async () => {
  const fixture = await get("/data/flow-demo.json");
  expect(fixture.status === 200, "fixture missing");
  const data = await fixture.json();
  expect(data.simulated === true && data.rounds.length === 3, "invalid synthetic fixture");
  const schema = await get("/schemas/delib-rounds/v1.json");
  expect(schema.status === 200, "round schema missing");
  const skill = await get("/.well-known/openclaw/SKILL.md");
  expect(skill.status === 200 && (await skill.text()).includes("bounded local steward"), "agent skill missing");
});

await check("GET /data/tools.json is readable", async () => {
  const response = await get("/data/tools.json");
  expect(response.status === 200, `status ${response.status}`);
  const registry = await response.json();
  expect(Array.isArray(registry.tools) && registry.tools.length > 0, "empty registry");
  return `${registry.tools.length} tools`;
});

await check("GET /api/integrations/polis/status hides the Site ID", async () => {
  const response = await get("/api/integrations/polis/status");
  expect(response.status === 200, `status ${response.status}`);
  const body = await response.json();
  expect(typeof body.configured === "boolean", "missing configured flag");
  expect(!("siteId" in body), "Site ID leaked");
});

await check("GET /api/receipts/<unknown> is a JSON 404", async () => {
  const response = await get("/api/receipts/0000000000000000");
  expect(response.status === 404, `status ${response.status}`);
  const body = await response.json();
  expect(typeof body.error === "string", "missing error text");
});

await check("GET /r/<unknown> renders the result page as 404", async () => {
  const response = await get("/r/0000000000000000");
  expect(response.status === 404, `status ${response.status}`);
  const html = await response.text();
  expect(html.includes("成果收據"), "result page markup missing");
});

await check("GET /api/nope is a JSON 404", async () => {
  const response = await get("/api/nope");
  expect(response.status === 404, `status ${response.status}`);
});

await check("POST /api/receipts without confirmation is rejected", async () => {
  const response = await get("/api/receipts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ receipt: {}, retentionDays: 30, confirmed: false }),
  });
  expect(response.status === 400 || response.status === 429, `status ${response.status}`);
});

for (const line of checks) console.log(line);
for (const line of failures) console.error(line);
console.log(`\n${checks.length} passed, ${failures.length} failed against ${baseUrl}`);
process.exit(failures.length ? 1 : 0);
