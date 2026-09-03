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

await check("GET /integrations/polis allows only the Pol.is frame", async () => {
  const response = await get("/integrations/polis");
  expect(response.status === 200, `status ${response.status}`);
  const csp = response.headers.get("content-security-policy") || "";
  expect(csp.includes("frame-src https://pol.is"), `unexpected CSP: ${csp || "(missing)"}`);
  expect(!csp.includes("frame-src 'none'"), "workspace CSP still blocks frames");
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
