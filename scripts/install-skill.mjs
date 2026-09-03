#!/usr/bin/env node
// Install the Delib skill into the agent homes present on this machine.
//   npx --yes github:mashbean/delib install-skill            # every detected home
//   npx --yes github:mashbean/delib install-skill --target claude
//   npx --yes github:mashbean/delib install-skill --target codex --force

import { cp, mkdir, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith("--")) || "install-skill";
const force = args.includes("--force");
const targetFlag = args.indexOf("--target");
const requested = targetFlag >= 0 ? (args[targetFlag + 1] || "").toLowerCase() : "auto";

const HOMES = {
  codex: () => process.env.CODEX_HOME || join(homedir(), ".codex"),
  claude: () => process.env.CLAUDE_HOME || join(homedir(), ".claude"),
};

if (command !== "install-skill" || !["auto", "all", "codex", "claude"].includes(requested)) {
  console.error("Usage: delib install-skill [--target auto|all|codex|claude] [--force]");
  process.exitCode = 1;
} else {
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const source = join(repoRoot, "skills", "delib");
  const targets = await resolveTargets(requested);
  let failed = false;
  for (const name of targets) {
    const target = join(HOMES[name](), "skills", "delib");
    if (await exists(target)) {
      if (!force) {
        console.error(`Delib skill already exists at ${target}. Re-run with --force to replace it.`);
        failed = true;
        continue;
      }
      await rm(target, { recursive: true, force: true });
    }
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { recursive: true, errorOnExist: false, force: true });
    console.log(`Installed Delib skill for ${name} at ${target}`);
  }
  if (failed) process.exitCode = 1;
}

async function resolveTargets(mode) {
  if (mode === "codex" || mode === "claude") return [mode];
  if (mode === "all") return ["codex", "claude"];
  const detected = [];
  for (const name of ["codex", "claude"]) {
    if (await exists(HOMES[name]())) detected.push(name);
  }
  if (detected.length === 0) {
    console.log("No ~/.codex or ~/.claude directory found; installing for codex. Use --target claude for Claude Code.");
    return ["codex"];
  }
  return detected;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
