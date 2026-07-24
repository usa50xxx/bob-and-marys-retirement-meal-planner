import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const androidDir = path.resolve("android");
const wrapper = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const tasks = process.argv.slice(2);

if (!tasks.length) {
  console.error("Provide at least one Gradle task.");
  process.exit(2);
}

if (process.platform !== "win32") {
  fs.chmodSync(path.join(androidDir, "gradlew"), 0o755);
}

const result = spawnSync(wrapper, ["--no-daemon", ...tasks], {
  cwd: androidDir,
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
