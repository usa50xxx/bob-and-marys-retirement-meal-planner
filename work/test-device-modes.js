const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { chromium, devices } = require("playwright");

const root = process.argv[2] || path.resolve("outputs/meal-planner");
const screenshotPath = process.env.DEVICE_MODE_SCREENSHOT || path.join(os.tmpdir(), "bob-mary-device-mode-test.png");
const cookingScreenshotPath = process.env.COOKING_MODE_SCREENSHOT || path.join(os.tmpdir(), "bob-mary-cooking-mode-test.png");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function serve(rootDir) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname === "/api/data") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end("{}");
        return;
      }

      const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = path.normalize(path.join(rootDir, requested));
      if (!filePath.startsWith(path.normalize(rootDir))) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      const data = await fsp.readFile(filePath);
      res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function run() {
  const server = await serve(root);
  let browser;
  try {
    const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    browser = await chromium.launch({
      headless: true,
      executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
      args: ["--no-sandbox"]
    });

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const desktop = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    await desktop.goto(`${baseUrl}/index.html`, { waitUntil: "networkidle" });
    await desktop.waitForSelector("#devicePrompt:not([hidden])");
    await desktop.locator("[data-device-choice='computer']").click();
    await desktop.waitForFunction(() => document.querySelector("#devicePrompt")?.hidden === true);
    await desktop.locator("[data-device-mode='iphone']").click();
    await desktop.waitForFunction(() => document.body.dataset.deviceMode === "iphone");
    await desktop.locator("[data-device-mode='android']").click();
    await desktop.waitForFunction(() => document.body.dataset.deviceMode === "android");
    await desktop.locator("[data-device-mode='computer']").click();
    await desktop.waitForFunction(() => document.body.dataset.deviceMode === "computer");
    await desktop.locator("[data-app-view='recipes']").click();
    await desktop.locator(".recipe-card").first().click();
    await desktop.waitForSelector(".recipe-showcase");

    const iphone = await browser.newPage({ ...devices["iPhone 15"], viewport: { width: 393, height: 852 } });
    await iphone.goto(`${baseUrl}/iphone.html`, { waitUntil: "networkidle" });
    await iphone.waitForFunction(() => location.search.includes("device=iphone") && document.body.dataset.deviceMode === "iphone");
    await iphone.waitForSelector("h1", { state: "visible" });
    await iphone.locator(".rolodex-spin").last().click();
    await iphone.locator(".rolodex-card[data-center='true']").click();
    await iphone.waitForTimeout(900);
    await iphone.evaluate(() => window.scrollTo(0, 0));
    await iphone.waitForTimeout(200);
    await iphone.screenshot({ path: screenshotPath, fullPage: false });

    const android = await browser.newPage({ ...devices["Pixel 7"], viewport: { width: 412, height: 915 } });
    await android.goto(`${baseUrl}/android.html`, { waitUntil: "networkidle" });
    await android.waitForFunction(() => location.search.includes("device=android") && document.body.dataset.deviceMode === "android");
    await android.locator("[data-app-view='groceries']").click();
    await android.locator("#walmartPaste").fill(
      "Walmart\n1 x Whole Milk $3.49 SKU 12345"
    );
    await android.locator("#addWalmartOrder").click();
    await android.locator(".receipt-review-row").first().waitFor();
    await android.locator("#commitReceiptItems").click();
    await android.locator("[data-app-view='inventory']").click();
    await android.waitForSelector(".inventory-food .inventory-remove");
    await android.waitForTimeout(900);
    const stickyNavResult = await android.evaluate(() => ({
      tabsBottom: Math.round(document.querySelector(".app-tabs")?.getBoundingClientRect().bottom || 0),
      focusedTop: Math.round(document.querySelector("#focusedLayout")?.getBoundingClientRect().top || 0),
      inventoryRemoveHeight: Math.round(
        document.querySelector(".inventory-food .inventory-remove")?.getBoundingClientRect().height || 0
      ),
      inventoryDateHeight: Math.round(
        document.querySelector(".inventory-food .inventory-date input")?.getBoundingClientRect().height || 0
      )
    }));
    await android.locator("[data-app-view='recipes']").click();
    await android.locator(".recipe-card").first().click();
    await android.locator("#startCooking").click();
    await android.waitForSelector("#cookingMode[open]");
    await android.screenshot({ path: cookingScreenshotPath, fullPage: false });

    const result = await desktop.evaluate(() => ({
      desktopMode: document.body.dataset.deviceMode,
      activeDevice: document.querySelector(".device-link.active")?.textContent?.trim() || "",
      showcase: document.querySelector("#showcaseMealName")?.textContent || "",
      promptHidden: document.querySelector("#devicePrompt")?.hidden === true
    }));

    const iphoneResult = await iphone.evaluate(() => ({
      mode: document.body.dataset.deviceMode,
      phoneLayout: document.body.classList.contains("phone-layout"),
      activeDevice: document.querySelector(".device-link.active")?.textContent?.trim() || "",
      buttonHeight: document.querySelector("button")?.getBoundingClientRect().height || 0,
      mastheadColumns: getComputedStyle(document.querySelector(".masthead")).gridTemplateColumns,
      headingVisible: Boolean(document.querySelector("h1")?.getBoundingClientRect().height),
      bodyTextLength: document.body.innerText.trim().length
    }));

    const androidLayoutResult = await android.evaluate(() => ({
      mode: document.body.dataset.deviceMode,
      phoneLayout: document.body.classList.contains("phone-layout"),
      activeDevice: document.querySelector(".device-link.active")?.textContent?.trim() || "",
      buttonHeight: document.querySelector("button")?.getBoundingClientRect().height || 0,
      mastheadColumns: getComputedStyle(document.querySelector(".masthead")).gridTemplateColumns
    }));
    const androidResult = { ...androidLayoutResult, ...stickyNavResult };

    const cookingResult = await android.evaluate(() => {
      const dialog = document.querySelector("#cookingMode");
      const rect = dialog?.getBoundingClientRect();
      const step = document.querySelector("#cookingStepText")?.getBoundingClientRect();
      const footer = document.querySelector(".cooking-footer")?.getBoundingClientRect();
      const nextStep = document.querySelector("#nextCookingStep")?.getBoundingClientRect();
      const ingredientSummary = document.querySelector(".cooking-ingredients-panel summary");
      const ingredientSummaryRect = ingredientSummary?.getBoundingClientRect();
      return {
        open: Boolean(dialog?.open),
        title: document.querySelector("#cookingTitle")?.textContent?.trim() || "",
        stepText: document.querySelector("#cookingStepText")?.textContent?.trim() || "",
        ingredientCount: document.querySelectorAll(".cooking-ingredient").length,
        ingredientsCollapsed: !document.querySelector(".cooking-ingredients-panel")?.open,
        ingredientSummaryVisible: Boolean(ingredientSummary?.textContent?.trim()) &&
          Boolean(ingredientSummaryRect?.height) &&
          ingredientSummaryRect.top >= 0 &&
          ingredientSummaryRect.bottom <= innerHeight,
        fitsViewport: Boolean(rect) &&
          rect.left >= -1 &&
          rect.top >= -1 &&
          rect.right <= innerWidth + 1 &&
          rect.bottom <= innerHeight + 1,
        noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        stepVisible: Boolean(step?.height) && step.top >= 0 && step.bottom <= innerHeight,
        nextStepVisible: Boolean(nextStep?.height) && nextStep.top >= 0 && nextStep.bottom <= footer.top,
        footerVisible: Boolean(footer?.height) && footer.bottom <= innerHeight + 1,
        controlHeight: document.querySelector("#nextCookingStep")?.getBoundingClientRect().height || 0
      };
    });

    const failures = [];
    if (!result.promptHidden) failures.push("First-time device prompt did not hide after choosing Computer.");
    if (result.desktopMode !== "computer" || result.activeDevice !== "Computer") failures.push("Computer mode did not activate from the top device selector.");
    if (!result.showcase) failures.push("Recipe click did not open a recipe after device switching.");
    if (iphoneResult.mode !== "iphone" || !iphoneResult.phoneLayout || iphoneResult.activeDevice !== "iPhone") failures.push("iPhone page did not switch into iPhone phone layout.");
    if (androidResult.mode !== "android" || !androidResult.phoneLayout || androidResult.activeDevice !== "Android") failures.push("Android page did not switch into Android phone layout.");
    if (iphoneResult.buttonHeight < 48 || androidResult.buttonHeight < 48) failures.push("Phone buttons are not large enough for touch use.");
    if (iphoneResult.mastheadColumns.split(" ").length > 1 || androidResult.mastheadColumns.split(" ").length > 1) failures.push("Phone masthead did not collapse to one column.");
    if (!iphoneResult.headingVisible || iphoneResult.bodyTextLength < 300) failures.push("iPhone screen did not show the planner content.");
    if (androidResult.focusedTop < androidResult.tabsBottom - 2) failures.push("Sticky phone navigation covers the selected screen.");
    if (androidResult.inventoryRemoveHeight < 48 || androidResult.inventoryDateHeight < 48) failures.push("Phone inventory controls are too small for touch use.");
    if (!cookingResult.open || !cookingResult.title || !cookingResult.stepText || !cookingResult.ingredientCount) failures.push("Guided cooking did not open with recipe content on Android.");
    if (!cookingResult.ingredientsCollapsed || !cookingResult.ingredientSummaryVisible) failures.push("Guided cooking did not prioritize the current step while keeping ingredients reachable on Android.");
    if (!cookingResult.fitsViewport || !cookingResult.noHorizontalOverflow) failures.push("Guided cooking overflows the Android viewport.");
    if (!cookingResult.stepVisible || !cookingResult.nextStepVisible || !cookingResult.footerVisible) failures.push("Guided cooking controls are not visible on the Android screen.");
    if (cookingResult.controlHeight < 48) failures.push("Guided cooking controls are too small for touch use.");

    console.log(JSON.stringify({
      root,
      screenshotPath,
      cookingScreenshotPath,
      status: failures.length ? "FAIL" : "PASS",
      failures,
      result,
      iphoneResult,
      androidResult,
      cookingResult
    }, null, 2));

    if (failures.length) process.exit(1);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
