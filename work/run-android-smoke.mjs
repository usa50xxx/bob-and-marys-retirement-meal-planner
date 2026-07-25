import path from "node:path";
import process from "node:process";
import {
  adbRun,
  androidProperty,
  forwardWebView,
  installApk,
  parseArguments,
  resolveApk,
  run,
  sleep,
  startApp,
} from "./android-test-utils.mjs";

const options = parseArguments(process.argv.slice(2));
const serial = options.serial
  || process.env.ANDROID_SERIAL
  || `emulator-${process.env.EMULATOR_PORT || "5554"}`;
const candidateApk = resolveApk(options.apk);
const expectedApi = options.api || androidProperty(serial, "ro.build.version.sdk");
const expectedRelease = options.release || androidProperty(serial, "ro.build.version.release");
const expectedLayout = options.layout || "phone";

if (options.upgrade) {
  const upgradeArguments = [
    "work/test-android-upgrade.mjs",
    "--candidate",
    candidateApk,
    "--serial",
    serial,
  ];
  if (options.baseline) {
    upgradeArguments.push("--baseline", resolveApk(options.baseline));
  }
  run(process.execPath, upgradeArguments);
} else {
  installApk(serial, candidateApk);
}

const pid = await startApp(serial);
const endpoint = await forwardWebView(serial, pid);
const smokeEnvironment = {
  ...process.env,
  ANDROID_CDP_URL: endpoint,
  ANDROID_EXPECTED_API: expectedApi,
  ANDROID_EXPECTED_RELEASE: expectedRelease,
  ANDROID_EXPECTED_LAYOUT: expectedLayout,
};

async function runSmoke(script, environment, { capture = false } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return run(process.execPath, [script], {
        env: environment,
        capture,
      });
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
      console.warn(`${script} did not complete on its first CDP connection; retrying.`);
      await sleep(2000);
    }
  }
  throw lastError;
}

await runSmoke("work/smoke-android-compatibility.js", smokeEnvironment);
await runSmoke("work/smoke-android-recipe-capture.js", {
  ...smokeEnvironment,
  ANDROID_RECIPE_PHOTO: path.resolve("work/recipe-fixtures/sample-recipe.png"),
  ANDROID_SKIP_ONLINE: options.online ? "0" : "1",
});
await runSmoke("work/smoke-android-recovery.js", smokeEnvironment);

if (options.offline) {
  try {
    adbRun(serial, ["shell", "cmd", "connectivity", "airplane-mode", "enable"]);
    adbRun(serial, ["shell", "svc", "wifi", "disable"]);
    adbRun(serial, ["shell", "svc", "data", "disable"]);
    await sleep(3000);
    const offlineEnvironment = {
      ...smokeEnvironment,
      ANDROID_EXPECTED_OFFLINE: "1",
    };
    await runSmoke("work/smoke-android-compatibility.js", offlineEnvironment);
    await runSmoke("work/smoke-android-recipe-capture.js", {
      ...offlineEnvironment,
      ANDROID_RECIPE_PHOTO: path.resolve("work/recipe-fixtures/sample-recipe.png"),
      ANDROID_SKIP_ONLINE: "1",
    });
  } finally {
    adbRun(serial, ["shell", "cmd", "connectivity", "airplane-mode", "disable"]);
    adbRun(serial, ["shell", "svc", "data", "enable"]);
    adbRun(serial, ["shell", "svc", "wifi", "enable"]);
    await sleep(3000);
  }
}

if (options["large-text"]) {
  const originalFontScale = adbRun(
    serial,
    ["shell", "settings", "get", "system", "font_scale"],
    { capture: true },
  );
  const baselineOutput = await runSmoke(
    "work/smoke-android-large-text.js",
    {
      ...smokeEnvironment,
      ANDROID_LARGE_TEXT_PHASE: "baseline",
    },
    { capture: true },
  );
  const baseline = JSON.parse(baselineOutput);

  try {
    adbRun(serial, ["shell", "settings", "put", "system", "font_scale", "2.0"]);
    const appliedFontScale = adbRun(
      serial,
      ["shell", "settings", "get", "system", "font_scale"],
      { capture: true },
    );
    if (Number.parseFloat(appliedFontScale) < 1.99) {
      throw new Error(`Android did not apply 200% text; font_scale=${appliedFontScale}.`);
    }

    adbRun(serial, ["shell", "am", "force-stop", "com.bobandmary.mealplanner"]);
    const largeTextPid = await startApp(serial);
    const largeTextEndpoint = await forwardWebView(serial, largeTextPid);
    await runSmoke("work/smoke-android-large-text.js", {
      ...smokeEnvironment,
      ANDROID_CDP_URL: largeTextEndpoint,
      ANDROID_LARGE_TEXT_PHASE: "scaled",
      ANDROID_LARGE_TEXT_BASELINE: Buffer.from(
        JSON.stringify(baseline),
        "utf8",
      ).toString("base64"),
    });
  } finally {
    if (/^(?:null)?$/i.test(originalFontScale)) {
      adbRun(serial, ["shell", "settings", "delete", "system", "font_scale"]);
    } else {
      adbRun(
        serial,
        ["shell", "settings", "put", "system", "font_scale", originalFontScale],
      );
    }
    adbRun(serial, ["shell", "am", "force-stop", "com.bobandmary.mealplanner"]);
    await startApp(serial);
  }
}

console.log(JSON.stringify({
  passed: true,
  serial,
  api: expectedApi,
  android: expectedRelease,
  layout: expectedLayout,
  upgrade: Boolean(options.upgrade),
  online: Boolean(options.online),
  offline: Boolean(options.offline),
  largeText: Boolean(options["large-text"]),
  apk: candidateApk,
}, null, 2));
