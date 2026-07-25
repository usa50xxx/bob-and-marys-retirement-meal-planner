import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

export const appId = "com.bobandmary.mealplanner";
export const activity = `${appId}/.MainActivity`;
const androidSdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
export const adb = process.env.ADB
  || (androidSdk
    ? path.join(androidSdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb")
    : (process.platform === "win32" ? "adb.exe" : "adb"));

export function parseArguments(values) {
  const options = {};
  const booleanOptions = new Set(["upgrade", "online", "offline", "large-text"]);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const name = value.slice(2);
    if (booleanOptions.has(name)) {
      options[name] = true;
      continue;
    }
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for --${name}.`);
    }
    options[name] = next;
    index += 1;
  }
  return options;
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    encoding: "utf8",
    shell: false,
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status}`
      + (detail ? `:\n${detail}` : "."),
    );
  }
  return options.capture ? String(result.stdout || "").trim() : "";
}

export function adbRun(serial, args, options = {}) {
  return run(adb, ["-s", serial, ...args], options);
}

export function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function resolveApk(input) {
  if (!input) throw new Error("Provide --apk with an APK file or artifact directory.");
  const resolved = path.resolve(input);
  const stat = fs.statSync(resolved);
  if (stat.isFile()) return resolved;
  if (!stat.isDirectory()) throw new Error(`APK input is not a file or directory: ${resolved}`);

  const apks = [];
  const pending = [resolved];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(candidate);
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".apk")) apks.push(candidate);
    }
  }
  if (apks.length !== 1) {
    throw new Error(`Expected one APK below ${resolved}, found ${apks.length}.`);
  }
  return apks[0];
}

export function installApk(serial, apkPath, { allowDowngrade = false } = {}) {
  const args = ["install", "-r"];
  if (allowDowngrade) args.push("-d");
  args.push(apkPath);
  adbRun(serial, args);
}

export async function startApp(serial) {
  adbRun(serial, ["shell", "am", "start", "-W", "-n", activity]);
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const pid = adbRun(serial, ["shell", "pidof", appId], { capture: true });
    if (/^\d+$/.test(pid)) {
      await sleep(1500);
      return pid;
    }
    await sleep(500);
  }
  throw new Error(`Android did not start ${appId}.`);
}

export function androidProperty(serial, name) {
  return adbRun(serial, ["shell", "getprop", name], { capture: true });
}

export function installedVersionCode(serial) {
  const output = adbRun(serial, ["shell", "dumpsys", "package", appId], { capture: true });
  const match = output.match(/\bversionCode=(\d+)/);
  if (!match) throw new Error("Could not read the installed Android version code.");
  return Number(match[1]);
}

export async function forwardWebView(serial, pid) {
  const output = adbRun(
    serial,
    ["forward", "tcp:0", `localabstract:webview_devtools_remote_${pid}`],
    { capture: true },
  );
  const port = output.match(/\d+/)?.[0];
  if (!port) throw new Error(`ADB did not return a WebView debug port: ${output}`);
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const targets = await fetch(`${endpoint}/json`).then((response) => response.json());
      if (targets.some((target) => target.type === "page")) return endpoint;
    } catch {
      // The debug socket can appear shortly before it accepts HTTP.
    }
    await sleep(500);
  }
  throw new Error(`The Android WebView did not become debuggable at ${endpoint}.`);
}

export async function connectCdp(endpoint) {
  const targets = await fetch(`${endpoint}/json`).then((response) => response.json());
  const target = targets.find((item) => item.type === "page");
  if (!target?.webSocketDebuggerUrl) throw new Error("The meal-planner WebView was not found.");

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let commandId = 0;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out connecting to the WebView.")), 10000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    socket.addEventListener("error", (event) => {
      clearTimeout(timer);
      reject(event.error || new Error("WebView connection failed."));
    }, { once: true });
  });

  function command(method, params = {}) {
    const id = ++commandId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`WebView did not answer ${method}.`));
      }, 15000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  await command("Runtime.enable");
  return {
    async evaluate(expression) {
      const result = await command("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        const exception = result.exceptionDetails.exception;
        throw new Error((exception && exception.description) || result.exceptionDetails.text);
      }
      return result.result?.value;
    },
    close() {
      socket.close();
    },
  };
}
