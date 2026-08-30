#!/usr/bin/env node

import { cp, mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const command = args[0] || "install-skill";
if (command !== "install-skill") {
  console.error("Usage: delib install-skill");
  process.exitCode = 1;
} else {
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const source = join(repoRoot, "skills", "delib");
  const codexRoot = process.env.CODEX_HOME || join(homedir(), ".codex");
  const target = join(codexRoot, "skills", "delib");

  if (await exists(target)) {
    console.error(`Delib skill already exists at ${target}. Remove or rename it before reinstalling.`);
    process.exitCode = 1;
  } else {
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { recursive: true, errorOnExist: true, force: false });
    console.log(`Installed Delib skill to ${target}`);
  }
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

