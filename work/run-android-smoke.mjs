import path from "node:path";
import process from "node:process";
import {
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
  run(process.execPath, [
    "work/test-android-upgrade.mjs",
    "--candidate",
    candidateApk,
    "--serial",
    serial,
  ]);
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

async function runSmoke(script, environment) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      run(process.execPath, [script], { env: environment });
      return;
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
  ANDROID_SKIP_ONLINE: "1",
});
await runSmoke("work/smoke-android-recovery.js", smokeEnvironment);

console.log(JSON.stringify({
  passed: true,
  serial,
  api: expectedApi,
  android: expectedRelease,
  layout: expectedLayout,
  upgrade: Boolean(options.upgrade),
  apk: candidateApk,
}, null, 2));
