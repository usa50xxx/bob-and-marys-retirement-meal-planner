const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { chromium, devices } = require("playwright");

const root = process.argv[2] || path.resolve("outputs/meal-planner");
const screenshotPath = process.env.DEVICE_MODE_SCREENSHOT || path.join(os.tmpdir(), "bob-mary-device-mode-test.png");
const cookingScreenshotPath = process.env.COOKING_MODE_SCREENSHOT || path.join(os.tmpdir(), "bob-mary-cooking-mode-test.png");
const shoppingScreenshotPath = process.env.SHOPPING_SCREENSHOT || path.join(os.tmpdir(), "supperloom-phone-shopping-test.png");

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
    await iphone.addInitScript(() => {
      window.__sharedRecipe = null;
      window.__sharedClipboard = "";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value) => {
            window.__sharedClipboard = value;
          }
        }
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (payload) => {
          window.__sharedRecipe = payload;
        }
      });
    });
    await iphone.goto(`${baseUrl}/iphone.html`, { waitUntil: "networkidle" });
    await iphone.waitForFunction(() => location.search.includes("device=iphone") && document.body.dataset.deviceMode === "iphone");
    await iphone.waitForSelector("h1", { state: "visible" });
    await iphone.locator(".rolodex-spin").last().click();
    await iphone.locator(".rolodex-card[data-center='true']").click();
    await iphone.waitForTimeout(900);
    await iphone.evaluate(() => window.scrollTo(0, 0));
    await iphone.waitForTimeout(200);
    await iphone.screenshot({ path: screenshotPath, fullPage: false });
    await iphone.locator("[data-app-view='recipes']").click();
    await iphone.locator(".recipe-card").first().click();
    await iphone.locator("#textRecipe").click();
    await iphone.waitForFunction(() =>
      /recipe shared/i.test(document.querySelector("#textRecipe")?.textContent || "")
      && Boolean(window.__sharedRecipe?.text)
    );
    const iphoneShareResult = await iphone.evaluate(() => ({
      title: window.__sharedRecipe?.title || "",
      text: window.__sharedRecipe?.text || "",
      clipboard: window.__sharedClipboard,
      button: document.querySelector("#textRecipe")?.textContent || "",
      status: document.querySelector("#saveStatus")?.textContent || ""
    }));

    const android = await browser.newPage({ ...devices["Pixel 7"], viewport: { width: 412, height: 915 } });
    await android.goto(`${baseUrl}/android.html`, { waitUntil: "networkidle" });
    await android.waitForFunction(() => location.search.includes("device=android") && document.body.dataset.deviceMode === "android");
    const swipe = ({
      startX = 350,
      endX = 70,
      startY = 420,
      endY = 422,
      selector = ".shell"
    } = {}) => android.evaluate(({ startX, endX, startY, endY, selector }) => {
      const surface = document.querySelector(selector);
      const start = new Event("touchstart", { bubbles: true });
      Object.defineProperty(start, "touches", {
        value: [{ clientX: startX, clientY: startY }]
      });
      surface.dispatchEvent(start);
      const end = new Event("touchend", { bubbles: true });
      Object.defineProperty(end, "changedTouches", {
        value: [{ clientX: endX, clientY: endY }]
      });
      surface.dispatchEvent(end);
    }, { startX, endX, startY, endY, selector });
    const activeView = () => android.locator("[aria-current='page'][data-app-view]").getAttribute("data-app-view");
    const forwardViews = [];
    let phonePlanResult = null;
    for (const expected of ["recipes", "plan", "groceries", "inventory", "spending"]) {
      await swipe();
      await android.waitForFunction(
        (view) => document.querySelector(`[data-app-view="${view}"]`)?.getAttribute("aria-current") === "page",
        expected
      );
      forwardViews.push(await activeView());
      if (expected === "plan") {
        const firstRecipe = await android.locator("[data-week-recipe='monday'] option").nth(1).getAttribute("value");
        await android.locator("[data-week-recipe='monday']").selectOption(firstRecipe);
        await android.waitForSelector(".store-comparison-row");
        phonePlanResult = await android.evaluate(() => {
          const row = document.querySelector(".store-comparison-row");
          const rowRect = row?.getBoundingClientRect();
          const choices = [...document.querySelectorAll(".store-comparison-row .store-price-choice")]
            .slice(0, 3)
            .map((choice) => {
              const rect = choice.getBoundingClientRect();
              return { width: rect.width, height: rect.height };
            });
          return {
            noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
            rowFitsViewport: Boolean(rowRect) && rowRect.left >= -1 && rowRect.right <= innerWidth + 1,
            choiceCount: choices.length,
            choices
          };
        });
        await android.locator("#storeComparison").scrollIntoViewIfNeeded();
        await android.screenshot({ path: shoppingScreenshotPath, fullPage: false });
      }
    }
    await swipe();
    const stoppedAtSpending = await activeView();
    const swipeAnnouncement = await android.locator("#appViewAnnouncement").textContent();
    await swipe({ selector: ".meal-calendar" });
    const calendarStayedOnSpending = await activeView();
    const backViews = [];
    for (const expected of ["inventory", "groceries", "plan", "recipes", "home"]) {
      await swipe({ startX: 70, endX: 350 });
      await android.waitForFunction(
        (view) => document.querySelector(`[data-app-view="${view}"]`)?.getAttribute("aria-current") === "page",
        expected
      );
      backViews.push(await activeView());
    }
    await swipe({ startX: 70, endX: 350 });
    const stoppedAtHome = await activeView();
    await swipe({ startX: 20, endX: 300 });
    const edgeSwipeStayedHome = await activeView();
    await swipe({ startX: 260, endX: 235 });
    const shortSwipeStayedHome = await activeView();
    await swipe({ startX: 300, endX: 180, startY: 250, endY: 500 });
    const verticalSwipeStayedHome = await activeView();
    await android.locator("[data-app-view='recipes']").click();
    await swipe({ selector: "#recipeForm label" });
    const formSwipeStayedRecipes = await activeView();
    await android.locator("[data-app-view='home']").click();
    await swipe({ selector: ".visual-recipe-list" });
    const rolodexSwipeStayedHome = await activeView();
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
    await swipe();
    const dialogSwipeStayedRecipes = await activeView();
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
    iphoneResult.share = iphoneShareResult;

    const androidLayoutResult = await android.evaluate(() => ({
      mode: document.body.dataset.deviceMode,
      phoneLayout: document.body.classList.contains("phone-layout"),
      activeDevice: document.querySelector(".device-link.active")?.textContent?.trim() || "",
      buttonHeight: document.querySelector("button")?.getBoundingClientRect().height || 0,
      mastheadColumns: getComputedStyle(document.querySelector(".masthead")).gridTemplateColumns
    }));
    const androidResult = {
      ...androidLayoutResult,
      ...stickyNavResult,
      phonePlanResult,
      forwardViews,
      backViews,
      stoppedAtSpending,
      swipeAnnouncement,
      calendarStayedOnSpending,
      stoppedAtHome,
      edgeSwipeStayedHome,
      shortSwipeStayedHome,
      verticalSwipeStayedHome,
      formSwipeStayedRecipes,
      rolodexSwipeStayedHome,
      dialogSwipeStayedRecipes
    };

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
    if (
      !iphoneResult.share?.title
      || !/Ingredients/i.test(iphoneResult.share?.text)
      || !/Instructions/i.test(iphoneResult.share?.text)
      || (() => {
        const parts = (iphoneResult.share?.text.split("\n")[1] || "")
          .split("|")
          .map((part) => part.trim())
          .filter(Boolean);
        return new Set(parts).size !== parts.length;
      })()
      || iphoneResult.share?.clipboard !== iphoneResult.share?.text
      || !/Recipe shared/i.test(iphoneResult.share?.button)
      || !/Full recipe shared and copied/i.test(iphoneResult.share?.status)
    ) failures.push("iPhone recipe sharing did not open the native share handoff with a full recipe.");
    if (androidResult.focusedTop < androidResult.tabsBottom - 2) failures.push("Sticky phone navigation covers the selected screen.");
    if (androidResult.inventoryRemoveHeight < 48 || androidResult.inventoryDateHeight < 48) failures.push("Phone inventory controls are too small for touch use.");
    if (
      !androidResult.phonePlanResult?.noHorizontalOverflow
      || !androidResult.phonePlanResult?.rowFitsViewport
      || androidResult.phonePlanResult?.choiceCount !== 3
      || androidResult.phonePlanResult?.choices.some((choice) => choice.height < 48)
    ) failures.push("Three-store shopping comparison does not fit or remain touch-friendly on Android.");
    if (androidResult.forwardViews.join(",") !== "recipes,plan,groceries,inventory,spending") failures.push("Phone swipe navigation did not follow the expected forward screen order.");
    if (androidResult.backViews.join(",") !== "inventory,groceries,plan,recipes,home") failures.push("Phone swipe navigation did not follow the expected reverse screen order.");
    if (androidResult.stoppedAtSpending !== "spending" || androidResult.stoppedAtHome !== "home") failures.push("Phone swipe navigation did not stop at the first and last screens.");
    if (androidResult.swipeAnnouncement?.trim() !== "Spending, page 6 of 6") failures.push("Phone swipe navigation did not announce the selected screen.");
    if (
      androidResult.calendarStayedOnSpending !== "spending"
      || androidResult.edgeSwipeStayedHome !== "home"
      || androidResult.shortSwipeStayedHome !== "home"
      || androidResult.verticalSwipeStayedHome !== "home"
      || androidResult.formSwipeStayedRecipes !== "recipes"
      || androidResult.rolodexSwipeStayedHome !== "home"
      || androidResult.dialogSwipeStayedRecipes !== "recipes"
    ) failures.push("Phone swipe navigation interfered with a protected control or non-horizontal gesture.");
    if (!cookingResult.open || !cookingResult.title || !cookingResult.stepText || !cookingResult.ingredientCount) failures.push("Guided cooking did not open with recipe content on Android.");
    if (!cookingResult.ingredientsCollapsed || !cookingResult.ingredientSummaryVisible) failures.push("Guided cooking did not prioritize the current step while keeping ingredients reachable on Android.");
    if (!cookingResult.fitsViewport || !cookingResult.noHorizontalOverflow) failures.push("Guided cooking overflows the Android viewport.");
    if (!cookingResult.stepVisible || !cookingResult.nextStepVisible || !cookingResult.footerVisible) failures.push("Guided cooking controls are not visible on the Android screen.");
    if (cookingResult.controlHeight < 48) failures.push("Guided cooking controls are too small for touch use.");

    console.log(JSON.stringify({
      root,
      screenshotPath,
      cookingScreenshotPath,
      shoppingScreenshotPath,
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
