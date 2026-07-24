import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  connectCdp,
  forwardWebView,
  installApk,
  installedVersionCode,
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
const candidateSource = resolveApk(options.candidate);
const gradle = fs.readFileSync("android/app/build.gradle", "utf8");
const releaseCode = Number(gradle.match(/appVersionCode\s*=\s*(\d+)/)?.[1]);
if (!releaseCode) throw new Error("Could not read appVersionCode from Android build.gradle.");
const baselineCode = releaseCode - 1;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "bob-mary-android-upgrade-"));
const candidateApk = path.join(temporary, "candidate.apk");
const baselineApk = path.join(temporary, "baseline.apk");
fs.copyFileSync(candidateSource, candidateApk);

const marker = `upgrade-${Date.now()}`;
const recipeName = "Upgrade Test Supper";
const preservedName = `${recipeName} preserved`;
const inventoryName = "Upgrade Test Milk";

async function waitFor(cdp, expression, message, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await cdp.evaluate(expression)) return;
    await sleep(250);
  }
  throw new Error(message);
}

try {
  run(process.execPath, ["work/sync-android.mjs"]);
  run(process.execPath, [
    "work/run-gradle.mjs",
    "assembleDebug",
    `-PbobMaryVersionCodeOverride=${baselineCode}`,
  ]);
  fs.copyFileSync("android/app/build/outputs/apk/debug/app-debug.apk", baselineApk);

  installApk(serial, baselineApk, { allowDowngrade: true });
  let pid = await startApp(serial);
  let endpoint = await forwardWebView(serial, pid);
  let cdp = await connectCdp(endpoint);
  await waitFor(
    cdp,
    `document.readyState === "complete" && Boolean(document.querySelector("#recipeName"))`,
    "The baseline app did not finish rendering.",
  );
  await cdp.evaluate(`(function () {
    var raw = localStorage.getItem("thumb-drive-meal-planner-v2");
    var data = raw ? JSON.parse(raw) : {};
    data.schemaVersion = 4;
    data.recipes = [{
      id: ${JSON.stringify(marker)},
      name: ${JSON.stringify(recipeName)},
      baseServings: 2,
      notes: "Created before an APK upgrade.",
      ingredients: [{ amount: 2, unit: "cups", name: "rice" }]
    }];
    data.foodStorage = {
      refrigerator: [{
        id: ${JSON.stringify(marker)},
        amount: 1,
        unit: "gallon",
        name: ${JSON.stringify(inventoryName)},
        price: 3.49,
        itemNumber: "UPGRADE-1",
        store: "Test store"
      }],
      freezer: [],
      pantry: []
    };
    data.savedAt = new Date().toISOString();
    localStorage.setItem("thumb-drive-meal-planner-v2", JSON.stringify(data));
    location.reload();
    return true;
  })()`);
  cdp.close();
  await sleep(2000);

  pid = await startApp(serial);
  endpoint = await forwardWebView(serial, pid);
  cdp = await connectCdp(endpoint);
  await waitFor(
    cdp,
    `document.readyState === "complete"
      && Array.prototype.slice.call(document.querySelectorAll(".recipe-card"))
        .some(function (item) {
          return item.textContent.indexOf(${JSON.stringify(recipeName)}) >= 0;
        })`,
    "The baseline recipe card did not appear after reloading.",
  );
  const baseline = await cdp.evaluate(`(function () {
    var data = JSON.parse(localStorage.getItem("thumb-drive-meal-planner-v2"));
    return {
      schemaVersion: data.schemaVersion,
      recipe: data.recipes.some(function (item) {
        return item.id === ${JSON.stringify(marker)} && item.name === ${JSON.stringify(recipeName)};
      }),
      inventory: data.foodStorage.refrigerator.some(function (item) {
        return item.id === ${JSON.stringify(marker)} && item.name === ${JSON.stringify(inventoryName)};
      })
    };
  })()`);
  cdp.close();
  if (!baseline.recipe || !baseline.inventory || baseline.schemaVersion !== 4) {
    throw new Error(`Baseline data was not prepared correctly: ${JSON.stringify(baseline)}`);
  }
  const installedBaselineCode = installedVersionCode(serial);
  if (installedBaselineCode !== baselineCode) {
    throw new Error(`Installed baseline is ${installedBaselineCode}, expected ${baselineCode}.`);
  }

  installApk(serial, candidateApk);
  pid = await startApp(serial);
  endpoint = await forwardWebView(serial, pid);
  cdp = await connectCdp(endpoint);
  await waitFor(
    cdp,
    `document.readyState === "complete"
      && Array.prototype.slice.call(document.querySelectorAll(".recipe-card"))
        .some(function (item) {
          return item.textContent.indexOf(${JSON.stringify(recipeName)}) >= 0;
        })`,
    "The upgraded recipe card did not appear.",
  );
  const opened = await cdp.evaluate(`(function () {
    var data = JSON.parse(localStorage.getItem("thumb-drive-meal-planner-v2"));
    var recipe = data.recipes.find(function (item) {
      return item.id === ${JSON.stringify(marker)};
    });
    var inventory = data.foodStorage.refrigerator.find(function (item) {
      return item.id === ${JSON.stringify(marker)};
    });
    document.querySelector('[data-app-view="recipes"]').click();
    var card = Array.prototype.slice.call(document.querySelectorAll(".recipe-card"))
      .find(function (item) { return item.textContent.indexOf(${JSON.stringify(recipeName)}) >= 0; });
    if (card) card.click();
    var field = document.querySelector("#recipeName");
    if (field && field.value === ${JSON.stringify(recipeName)}) {
      field.value = ${JSON.stringify(preservedName)};
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return {
      recipe: Boolean(recipe),
      inventory: Boolean(inventory),
      cardFound: Boolean(card),
      editorName: field ? field.value : ""
    };
  })()`);
  if (!opened.recipe || !opened.inventory || !opened.cardFound || opened.editorName !== preservedName) {
    throw new Error(`Candidate did not open preserved data: ${JSON.stringify(opened)}`);
  }
  await sleep(1000);

  const migrated = await cdp.evaluate(`(function () {
    var data = JSON.parse(localStorage.getItem("thumb-drive-meal-planner-v2"));
    return {
      schemaVersion: data.schemaVersion,
      recipe: data.recipes.some(function (item) {
        return item.id === ${JSON.stringify(marker)} && item.name === ${JSON.stringify(preservedName)};
      }),
      inventory: data.foodStorage.refrigerator.some(function (item) {
        return item.id === ${JSON.stringify(marker)} && item.name === ${JSON.stringify(inventoryName)};
      }),
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  })()`);
  cdp.close();
  const installedCandidateCode = installedVersionCode(serial);
  if (installedCandidateCode !== releaseCode) {
    throw new Error(`Installed candidate is ${installedCandidateCode}, expected ${releaseCode}.`);
  }
  if (!migrated.recipe || !migrated.inventory || migrated.schemaVersion !== 5) {
    throw new Error(`Upgrade did not preserve and migrate data: ${JSON.stringify(migrated)}`);
  }
  if (migrated.overflow > 1) {
    throw new Error(`Upgraded app overflows horizontally by ${migrated.overflow}px.`);
  }

  console.log(JSON.stringify({
    passed: true,
    serial,
    baselineVersionCode: installedBaselineCode,
    candidateVersionCode: installedCandidateCode,
    marker,
    baseline,
    migrated,
  }, null, 2));
} finally {
  const generatedApk = path.resolve("android/app/build/outputs/apk/debug/app-debug.apk");
  if (fs.existsSync(candidateApk)) {
    fs.mkdirSync(path.dirname(generatedApk), { recursive: true });
    fs.copyFileSync(candidateApk, generatedApk);
  }
  const resolvedTemporary = path.resolve(temporary);
  const resolvedRoot = path.resolve(os.tmpdir());
  if (!resolvedTemporary.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Refusing to remove unexpected temporary path: ${resolvedTemporary}`);
  }
  fs.rmSync(resolvedTemporary, { recursive: true, force: true });
}
