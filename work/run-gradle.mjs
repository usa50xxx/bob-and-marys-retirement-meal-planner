import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const androidDir = path.resolve("android");
const wrapper = path.join(
  androidDir,
  process.platform === "win32" ? "gradlew.bat" : "gradlew",
);
const MAX_CAPTURED_OUTPUT = 2 * 1024 * 1024;
const TRANSIENT_NETWORK_TEXT = [
  "java.net.socketexception",
  "java.net.sockettimeoutexception",
  "java.net.unknownhostexception",
  "connection reset",
  "connection timed out",
  "read timed out",
  "temporary failure in name resolution",
  "could not resolve host",
  "remote host terminated the handshake",
  "502 bad gateway",
  "503 service unavailable",
  "504 gateway timeout",
];
const ALLOWED_GRADLE_ARGUMENTS = new Map([
  "assembleDebug",
  "assembleRelease",
  "bundleRelease",
  "lintDebug",
  "lintRelease",
].map((argument) => [argument, argument]));

export function isRetryableGradleFailure(output) {
  const normalized = String(output || "").toLowerCase();
  return TRANSIENT_NETWORK_TEXT.some((fragment) => normalized.includes(fragment));
}

export function isSafeGradleArgument(value) {
  try {
    canonicalGradleArgument(value);
    return true;
  } catch {
    return false;
  }
}

export function canonicalGradleArgument(value) {
  const allowed = ALLOWED_GRADLE_ARGUMENTS.get(value);
  if (allowed) return allowed;

  const versionOverride = /^-PbobMaryVersionCodeOverride=(\d{1,9})$/.exec(value);
  if (versionOverride) {
    const versionCode = Number(versionOverride[1]);
    if (Number.isSafeInteger(versionCode) && versionCode > 0) {
      return `-PbobMaryVersionCodeOverride=${versionCode}`;
    }
  }
  throw new Error(`Unsupported Gradle argument: ${value}`);
}

function appendOutput(current, chunk) {
  const combined = `${current}${chunk}`;
  return combined.length > MAX_CAPTURED_OUTPUT
    ? combined.slice(-MAX_CAPTURED_OUTPUT)
    : combined;
}

function runAttempt(tasks) {
  return new Promise((resolve) => {
    const gradleArguments = ["--no-daemon", ...tasks];
    const windows = process.platform === "win32";
    const command = windows ? process.env.ComSpec || "cmd.exe" : wrapper;
    const commandArguments = windows
      ? [
          "/d",
          "/s",
          "/c",
          `""${wrapper}" ${gradleArguments.join(" ")}"`,
        ]
      : gradleArguments;
    const child = spawn(command, commandArguments, {
      cwd: androidDir,
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
      windowsVerbatimArguments: windows,
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      output = appendOutput(output, chunk);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      output = appendOutput(output, chunk);
    });
    child.on("error", (error) => resolve({ status: 1, output, error }));
    child.on("close", (status) => resolve({ status: status ?? 1, output }));
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runGradle(tasks, {
  retries = process.env.CI ? 2 : 0,
  retryDelayMs = 10_000,
} = {}) {
  if (!tasks.length) {
    throw new Error("Provide at least one Gradle task.");
  }
  const canonicalTasks = tasks.map(canonicalGradleArgument);
  if (process.platform !== "win32") {
    fs.chmodSync(wrapper, 0o755);
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const result = await runAttempt(canonicalTasks);
    if (result.status === 0) return;
    if (result.error) throw result.error;

    const canRetry =
      attempt < retries && isRetryableGradleFailure(result.output);
    if (!canRetry) {
      process.exitCode = result.status;
      return;
    }

    const nextAttempt = attempt + 2;
    const totalAttempts = retries + 1;
    console.warn(
      `::warning::Gradle hit a transient network error. Retrying in ${
        retryDelayMs / 1000
      } seconds (attempt ${nextAttempt} of ${totalAttempts}).`,
    );
    await wait(retryDelayMs);
  }
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const tasks = process.argv.slice(2);
  runGradle(tasks).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
