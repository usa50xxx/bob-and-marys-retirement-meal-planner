import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const sourceDir = path.resolve("outputs/meal-planner");
const stagedDir = path.resolve("work/android-web");
const privateNames = new Set(["backups", "planner-data.json"]);

function assertInsideProject(target) {
  const relative = path.relative(projectRoot, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to replace staging path outside project: ${target}`);
  }
}

function isPublicAsset(source) {
  const relative = path.relative(sourceDir, source);
  if (!relative) return true;
  const firstPart = relative.split(path.sep)[0].toLowerCase();
  return !privateNames.has(firstPart);
}

assertInsideProject(stagedDir);
await fs.rm(stagedDir, { recursive: true, force: true });
await fs.cp(sourceDir, stagedDir, { recursive: true, filter: isPublicAsset });

for (const privateName of privateNames) {
  try {
    await fs.access(path.join(stagedDir, privateName));
    throw new Error(`Private data entered Android staging: ${privateName}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(pnpm, ["exec", "cap", "sync", "android"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    CAPACITOR_WEB_DIR: path.relative(projectRoot, stagedDir).replaceAll("\\", "/"),
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
