import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { stageReleaseAssets } from "./release-assets.mjs";

const projectRoot = process.cwd();
const stagedDir = path.resolve("work/android-web");
const staged = await stageReleaseAssets({ projectRoot, destination: stagedDir });
console.log(`Staged ${staged.fileCount} public files for Android.`);

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
