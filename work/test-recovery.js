const http = require("http");
const fsp = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(process.env.MEAL_PLANNER_ROOT || "outputs/meal-planner");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
  ".gz": "application/gzip"
};

function planner(name, savedAt, schemaVersion = 5) {
  return {
    schemaVersion,
    savedAt,
    recipes: [{
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      baseServings: 2,
      notes: "Warm gently.",
      photo: "",
      ingredients: [{ amount: 1, unit: "cup", name: "milk" }]
    }],
    foodStorage: { refrigerator: [], freezer: [], pantry: [] },
    builderTemplates: {},
    mealCostHistory: [],
    weeklyPlan: {}
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      const file = path.resolve(root, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`);
      if (!file.startsWith(`${root}${path.sep}`)) throw new Error("Forbidden");
      const body = await fsp.readFile(file);
      response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  const badResponses = [];
  const dialogs = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });

  const current = planner("Before interruption", "2026-07-24T12:00:00.000Z", 3);
  const pending = planner("Recovered supper", "2026-07-24T12:05:00.000Z", 5);
  const previous = planner("Previous supper", "2026-07-24T11:00:00.000Z", 3);
  await page.addInitScript(({ currentData, pendingData, previousData }) => {
    window.Capacitor = { isNativePlatform: () => true };
    localStorage.setItem("thumb-drive-meal-planner-v2", JSON.stringify(currentData));
    localStorage.setItem("bobMaryMealPlannerPendingSave", JSON.stringify(pendingData));
    localStorage.setItem("bobMaryMealPlannerPreviousGoodSave", JSON.stringify(previousData));
    localStorage.setItem("bobMaryMealPlannerView", "home");
  }, { currentData: current, pendingData: pending, previousData: previous });

  const checks = [];
  const check = (condition, name) => {
    assert(condition, name);
    checks.push(name);
  };
  const openRecoveryPanel = async () => {
    const panel = page.locator("#recoveryPanel");
    if (!(await panel.evaluate((element) => element.open))) {
      await panel.locator("summary").click();
    }
  };

  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#recipeName")?.value === "Recovered supper");
    check(/interrupted/i.test(await page.locator("#saveStatus").textContent()), "Interrupted save is explained on startup");
    check(await page.evaluate(() => localStorage.getItem("bobMaryMealPlannerPendingSave")) === null, "Recovered pending marker is cleared");
    check(await page.evaluate(() => JSON.parse(localStorage.getItem("thumb-drive-meal-planner-v2")).recipes[0].name) === "Recovered supper", "Newest valid interrupted data becomes current");
    check(/this phone/i.test(await page.locator("#lastSaveDetail").textContent()), "Last-save destination is visible");

    await openRecoveryPanel();
    await page.locator("#createBackup").click();
    await page.waitForFunction(() => /new backup/i.test(document.querySelector("#recoveryStatus")?.textContent || ""));
    const manualOption = page.locator("#backupSelect option").filter({ hasText: "Manual backup" });
    check(await manualOption.count() === 1, "Manual phone backup appears in recovery history");

    await page.locator('[data-app-view="recipes"]').click();
    await page.locator("#recipeName").fill("Changed after backup");
    await page.waitForTimeout(350);
    check(await page.evaluate(() => JSON.parse(localStorage.getItem("thumb-drive-meal-planner-v2")).schemaVersion) === 6, "Older schema upgrades to the current schema on save");

    await page.locator('[data-app-view="home"]').click();
    await openRecoveryPanel();
    await page.locator("#backupSelect").selectOption(await manualOption.getAttribute("value"));
    await page.locator("#restoreBackup").click();
    await page.waitForFunction(() => document.querySelector("#recipeName")?.value === "Recovered supper");
    check(/Restored Manual backup/i.test(await page.locator("#recoveryStatus").textContent()), "Selected phone backup restores successfully");

    const malformedBackup = {
      schemaVersion: 5,
      recipes: [{
        id: "valid-import",
        name: "Imported Soup",
        baseServings: 2,
        ingredients: [
          { amount: 2, unit: "cups", name: "broth" },
          { amount: 0, unit: "", name: "" }
        ]
      }, "not a recipe"],
      foodStorage: {
        refrigerator: [
          { amount: 1, unit: "item", name: "milk" },
          { amount: 0, unit: "", name: "" }
        ],
        freezer: [],
        pantry: []
      }
    };
    await page.locator("#importData").setInputFiles({
      name: "backup-with-problems.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(malformedBackup))
    });
    await page.waitForFunction(() => /problem/i.test(document.querySelector("#recoveryStatus")?.textContent || ""));
    check(
      dialogs.some((message) =>
        /ingredient row 2/i.test(message) &&
        /Recipe row 2/i.test(message) &&
        /Refrigerator row 2/i.test(message)
      ),
      "Import explains every unreadable recipe and inventory row before approval"
    );
    check(await page.locator("#recipeName").inputValue() === "Imported Soup", "Valid backup rows still import");
    check(/milk/i.test(await page.locator("#refrigeratorList").textContent()), "Valid inventory rows still import");

    const recipeOnlyBackup = {
      recipes: [{
        id: "legacy-stew",
        name: "Legacy Stew",
        baseServings: 2,
        ingredients: [{ amount: 1, unit: "can", name: "tomatoes" }]
      }]
    };
    await page.locator("#importData").setInputFiles({
      name: "old-recipe-only-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(recipeOnlyBackup))
    });
    await page.waitForFunction(() => document.querySelector("#recipeName")?.value === "Legacy Stew");
    check(/milk/i.test(await page.locator("#refrigeratorList").textContent()), "Recipe-only upgrades preserve household inventory");

    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      buttonHeights: [...document.querySelectorAll(".recovery-panel button")]
        .map((button) => Math.round(button.getBoundingClientRect().height))
    }));
    check(layout.overflow <= 1, "Recovery screen fits phone width");
    check(layout.buttonHeights.every((height) => height >= 40), "Recovery controls stay touch friendly");
    check(errors.length === 0, `No browser errors: ${errors.join(" | ")}`);
    check(badResponses.length === 0, `No failed assets: ${badResponses.join(" | ")}`);

    console.log(JSON.stringify({ passed: true, checks }, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
