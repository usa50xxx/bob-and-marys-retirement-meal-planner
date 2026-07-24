const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

function dateFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const root = path.resolve(process.env.MEAL_PLANNER_ROOT || "outputs/meal-planner");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
  ".gz": "application/gzip",
  ".ico": "image/x-icon"
};

let plannerData = {
  schemaVersion: 3,
  recipes: [{
    id: "test-meatloaf",
    name: "Test Meatloaf",
    baseServings: 2,
    notes: "Heat oven to 350 F.\nMix ingredients.\nBake 55 minutes.",
    photo: "",
    ingredients: [
      { amount: 1, unit: "lb", name: "ground beef" },
      { amount: 2, unit: "count", name: "eggs" },
      { amount: 0.25, unit: "cup", name: "ketchup" }
    ]
  }, {
    id: "test-burgers",
    name: "Test Burgers",
    baseServings: 2,
    notes: "Shape patties.\nCook until done.",
    photo: "",
    ingredients: [
      { amount: 8, unit: "oz", name: "ground beef" }
    ]
  }],
  foodStorage: {
    refrigerator: [{
      id: "eggs",
      amount: 6,
      unit: "count",
      name: "eggs",
      price: 2.4,
      store: "Walmart",
      itemNumber: "111",
      bestBy: dateFromToday(1)
    }],
    freezer: [{ id: "beef", amount: 8, unit: "oz", name: "ground beef", price: 3, store: "Aldi", itemNumber: "222" }],
    pantry: [{ id: "ketchup", amount: 1, unit: "cup", name: "ketchup", price: 1.2, store: "Publix", itemNumber: "333" }]
  },
  builderOptions: null,
  builderStyles: null,
  builderTemplates: {},
  mealCostHistory: [],
  weeklyPlan: {}
};

function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname === "/api/data") {
        if (request.method === "GET") {
          response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify(plannerData));
          return;
        }
        if (request.method === "POST") {
          let body = "";
          for await (const chunk of request) body += chunk;
          plannerData = JSON.parse(body);
          response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          response.end('{"saved":true}');
          return;
        }
      }
      const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = path.resolve(root, `.${requested}`);
      if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error("Forbidden");
      const body = await fsp.readFile(filePath);
      response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function clickView(page, view) {
  await page.locator(`[data-app-view="${view}"]`).click();
  await page.waitForFunction((name) => document.querySelector(`[data-app-view="${name}"]`)?.getAttribute("aria-current") === "page", view);
}

async function run() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  console.error("CHECKPOINT server");
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
        : {}),
      args: ["--no-sandbox"]
    });
  } catch (error) {
    await new Promise((resolve) => server.close(resolve));
    throw error;
  }
  console.error("CHECKPOINT browser");
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  const badResponses = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript(() => {
    localStorage.setItem("bobMaryMealPlannerDeviceMode", "computer");
    localStorage.setItem("bobMaryMealPlannerView", "home");
    window.__wakeLockRequests = 0;
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          window.__wakeLockRequests += 1;
          let released = false;
          const releaseListeners = [];
          return {
            get released() {
              return released;
            },
            addEventListener(type, listener) {
              if (type === "release") releaseListeners.push(listener);
            },
            async release() {
              released = true;
              releaseListeners.forEach((listener) => listener());
            }
          };
        }
      }
    });
  });

  const results = [];
  const check = (condition, name, detail = "") => {
    assert(condition, `${name}: ${detail}`);
    results.push({ name, detail });
  };

  try {
    const url = `http://127.0.0.1:${server.address().port}/index.html`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#recipeName")?.value === "Test Meatloaf");
    console.error("CHECKPOINT loaded");

    check(await page.locator("#focusedLayout").isHidden(), "Home starts focused and uncluttered");
    check(await page.locator(".command-center").isVisible(), "Home summary is visible");

    await clickView(page, "plan");
    check(await page.locator("#weeklyPlannerCard").isVisible(), "Plan screen opens");
    check(await page.locator("#receiptImportCard").isHidden(), "Unrelated receipt screen stays hidden");
    await page.locator("[data-week-recipe='monday']").selectOption("test-meatloaf");
    await page.locator("[data-week-servings='monday']").fill("4");
    await page.waitForTimeout(450);
    console.error("CHECKPOINT plan");
    const weeklyText = await page.locator("#weeklyGroceryGroups").innerText();
    check(/ground beef/i.test(weeklyText) && /Buy\s+1\.5 lb/i.test(weeklyText), "Weekly list calculates Have / Need / Buy", weeklyText.replace(/\s+/g, " "));
    await page.locator("[data-week-recipe='tuesday']").selectOption("test-burgers");
    await page.locator("[data-week-servings='tuesday']").fill("2");
    await page.waitForTimeout(450);
    const mixedUnitWeeklyText = await page.locator("#weeklyGroceryGroups").innerText();
    check(
      /ground beef/i.test(mixedUnitWeeklyText) &&
        /Buy\s+2 lb/i.test(mixedUnitWeeklyText) &&
        /Monday, Tuesday/i.test(mixedUnitWeeklyText),
      "Weekly list combines pounds and ounces before subtracting stock",
      mixedUnitWeeklyText.replace(/\s+/g, " ")
    );

    await clickView(page, "recipes");
    check(await page.locator("#recipeList").isVisible(), "Recipes screen opens");
    await page.fill("#targetServings", "4");
    const scaledText = await page.locator("#scaledList").innerText();
    check(/2 lb\s+ground beef/i.test(scaledText), "Recipe ingredients scale for four people", scaledText);
    await page.locator("#startCooking").click();
    check(await page.locator("#cookingMode").isVisible(), "Guided cooking opens for the selected recipe");
    check(
      /Test Meatloaf/i.test(await page.locator("#cookingTitle").innerText()) &&
        /Step 1 of 3/i.test(await page.locator("#cookingStepCount").innerText()) &&
        /Heat oven to 350 F/i.test(await page.locator("#cookingStepText").innerText()),
      "Guided cooking shows one readable instruction at a time"
    );
    check(
      await page.locator("#cookingIngredients .cooking-ingredient").count() === 3 &&
        /2 lb/i.test(await page.locator("#cookingIngredients").innerText()),
      "Guided cooking shows scaled ingredient checkboxes"
    );
    check(
      await page.evaluate(() => window.__wakeLockRequests) === 1 &&
        /stay awake/i.test(await page.locator("#cookingWakeStatus").innerText()),
      "Guided cooking requests screen-awake mode"
    );
    await page.locator("[data-cooking-ingredient='0']").check();
    await page.locator("#cookingStepDone").check();
    await page.locator("#nextCookingStep").click();
    check(
      /Step 2 of 3/i.test(await page.locator("#cookingStepCount").innerText()) &&
        /Mix ingredients/i.test(await page.locator("#cookingStepText").innerText()),
      "Cooking steps move forward without showing every instruction"
    );
    await page.locator("#cookingTimerMinutes").fill("0.02");
    await page.locator("#cookingTimerName").fill("Oven timer");
    await page.locator("#startCookingTimer").click();
    await page.locator("[data-quick-timer='5']").click();
    check(await page.locator(".cooking-timer").count() === 2, "Multiple cooking timers can run together");
    const quickTimer = page.locator(".cooking-timer", { hasText: "Step 2 timer" });
    await quickTimer.locator("[data-timer-action='pause']").click();
    check(/Resume/i.test(await quickTimer.innerText()), "A cooking timer can be paused");
    await page.waitForFunction(() => {
      const timer = [...document.querySelectorAll(".cooking-timer")]
        .find((item) => item.textContent.includes("Oven timer"));
      return timer?.classList.contains("done");
    }, null, { timeout: 5000 });
    check(/Finished/i.test(await page.locator(".cooking-timer", { hasText: "Oven timer" }).innerText()), "A finished timer is announced");
    await page.locator("#closeCooking").click();
    await page.locator("#startCooking").click();
    await page.locator("#previousCookingStep").click();
    check(
      await page.locator("#cookingStepDone").isChecked() &&
        await page.locator("[data-cooking-ingredient='0']").isChecked(),
      "Cooking progress is saved when the guide is closed and reopened"
    );
    await page.locator("#closeCooking").click();
    console.error("CHECKPOINT recipes");

    await clickView(page, "home");
    await page.locator("#quickBuildMeal").click();
    check(await page.locator("#weeklyPlannerCard").isVisible(), "Plan this week shortcut opens the weekly planner");
    await clickView(page, "recipes");
    await page.locator("#resetBuiltMeal").click();
    await page.locator("#mainChoiceButtons .choice-button").filter({ hasText: /^Beef$/ }).click();
    await page.waitForFunction(() => {
      const cards = [...document.querySelectorAll("#mainChoiceButtons .choice-button")];
      return cards.length >= 18 &&
        cards.every((card) => {
          const image = card.querySelector("img");
          return image?.complete && image.naturalWidth > 0;
        });
    }, null, { timeout: 15_000 });
    const beefCards = await page.locator("#mainChoiceButtons .choice-button").evaluateAll((buttons) =>
      buttons.map((button) => ({
        name: button.textContent.trim().replace(/\s+/g, " "),
        src: button.querySelector("img")?.getAttribute("src") || "",
        loaded: Boolean(button.querySelector("img")?.naturalWidth)
      }))
    );
    const loadedBeefCards = beefCards.filter((card) => card.loaded);
    const uniqueBeefPictures = new Set(beefCards.map((card) => card.src)).size;
    check(beefCards.length >= 18 && loadedBeefCards.length === beefCards.length && uniqueBeefPictures >= 18,
      "Beef choices have loaded, distinct pictures",
      `${beefCards.length} choices, ${loadedBeefCards.length} loaded, ${uniqueBeefPictures} unique; ` +
      `missing: ${beefCards.filter((card) => !card.loaded).map((card) => `${card.name}=${card.src}`).join(", ")}`);
    console.error("CHECKPOINT builder");

    await clickView(page, "groceries");
    const receiptText = [
      "Walmart",
      "1 x Whole Milk $3.48 SKU 12345",
      "1 x Frozen Shrimp $9.98 Item # 55555",
      "1 x Spaghetti $1.29 UPC 33333"
    ].join("\n");
    await page.fill("#walmartPaste", receiptText);
    await page.locator("#addWalmartOrder").click();
    const rows = page.locator(".receipt-review-row");
    await rows.first().waitFor();
    check(await rows.count() === 3, "Pasted receipt opens an editable review", `${await rows.count()} items`);
    await rows.first().locator(".receipt-best-by-date").fill(dateFromToday(2));
    await page.locator("#commitReceiptItems").click();
    await page.waitForTimeout(400);
    console.error("CHECKPOINT receipt");

    await clickView(page, "inventory");
    const inventoryText = [
      await page.locator("#refrigeratorList").innerText(),
      await page.locator("#freezerList").innerText(),
      await page.locator("#pantryList").innerText()
    ].join(" ");
    check(/Whole Milk/i.test(inventoryText) && /Frozen Shrimp/i.test(inventoryText) && /Spaghetti/i.test(inventoryText),
      "Reviewed groceries enter refrigerator, freezer, and pantry", inventoryText.replace(/\s+/g, " "));
    check(
      await page.locator("#refrigeratorList .inventory-food", { hasText: "Whole Milk" })
        .locator("input[type='date']").inputValue() === dateFromToday(2),
      "Receipt review saves an optional best-by date"
    );
    const expirySummaryText = await page.locator("#expirySummary").innerText();
    const useSoonText = await page.locator("#useSoonList").innerText();
    check(
      /2 to use soon/i.test(expirySummaryText) && /eggs/i.test(useSoonText) && /tomorrow/i.test(useSoonText),
      "Inventory highlights food approaching its best-by date",
      `${expirySummaryText} | ${useSoonText.replace(/\s+/g, " ")}`
    );
    await page.locator("#suggestUseSoon").click();
    const useSoonRecipeText = await page.locator("#useSoonRecipeResults").innerText();
    check(
      /Test Meatloaf/i.test(useSoonRecipeText) && /Uses soon:\s*eggs/i.test(useSoonRecipeText),
      "Use-soon recipes prioritize dated food",
      useSoonRecipeText.replace(/\s+/g, " ")
    );
    check(await page.locator("#undoChange").isEnabled(), "Undo is available after a change");
    await page.locator("#undoChange").click();
    await page.waitForTimeout(350);
    const undoneInventory = await page.locator("#pantryCard").innerText();
    check(!/Whole Milk|Frozen Shrimp|Spaghetti/i.test(undoneInventory), "Undo restores the prior inventory");
    await clickView(page, "inventory");

    const changedBestBy = dateFromToday(5);
    await page.locator("#refrigeratorList .inventory-food", { hasText: "eggs" })
      .locator("input[type='date']")
      .evaluate((input, value) => {
        input.value = value;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, changedBestBy);
    await page.waitForTimeout(400);
    check(
      await page.locator("#refrigeratorList .inventory-food", { hasText: "eggs" })
        .locator("input[type='date']").inputValue() === changedBestBy,
      "Best-by dates can be edited directly in inventory"
    );
    await page.locator("#undoChange").click();
    await page.waitForTimeout(350);
    check(
      await page.locator("#refrigeratorList .inventory-food", { hasText: "eggs" })
        .locator("input[type='date']").inputValue() === dateFromToday(1),
      "Undo restores the previous best-by date"
    );
    await page.locator("#expiryReminderDays").selectOption("0");
    await page.waitForTimeout(350);
    check(
      /Notices are off/i.test(await page.locator("#expirySummary").innerText()) &&
        await page.locator("#useSoonPanel").isHidden(),
      "Use-soon notices can be turned off"
    );
    await page.locator("#undoChange").click();
    await page.waitForTimeout(350);
    check(
      await page.locator("#expiryReminderDays").inputValue() === "7" &&
        await page.locator("#useSoonPanel").isVisible(),
      "Undo restores the use-soon notice setting"
    );
    console.error("CHECKPOINT inventory");

    await clickView(page, "spending");
    check(await page.locator("#mealSpendingCard").isVisible(), "Spending calendar opens");
    const costText = await page.locator("#currentMealCost").innerText();
    check(/\$/.test(costText) && /per person/i.test(costText), "Meal and per-person cost are calculated", costText);

    await page.waitForTimeout(600);
    const saveText = await page.locator("#saveStatus").innerText();
    check(/Saved to thumb drive|Saved in this browser only/i.test(saveText), "Save status is visible", saveText);

    await clickView(page, "recipes");
    await page.locator("#startCooking").click();
    await page.locator("#finishCooking").click();
    await page.waitForFunction(() =>
      !document.querySelector("#cookingMode")?.open &&
      document.querySelector("[data-app-view='inventory']")?.getAttribute("aria-current") === "page"
    );
    check(
      await page.evaluate(() => localStorage.getItem("bobMaryMealPlannerCookingSession")) === null,
      "Finishing guided cooking clears the saved cooking session"
    );
    await page.waitForFunction(() => !document.querySelector("#freezerList")?.innerText.includes("ground beef"));
    const cookedRefrigerator = await page.locator("#refrigeratorList").innerText();
    const cookedFreezer = await page.locator("#freezerList").innerText();
    const cookedPantry = await page.locator("#pantryList").innerText();
    check(
      !/ground beef/i.test(cookedFreezer) &&
        /eggs\s+2 count/i.test(cookedRefrigerator) &&
        /ketchup\s+0\.5 cup/i.test(cookedPantry),
      "Cooking subtracts available food as one transaction",
      [cookedRefrigerator, cookedFreezer, cookedPantry].join(" ").replace(/\s+/g, " ")
    );
    await page.waitForTimeout(500);
    check(plannerData.mealCostHistory.length === 1, "Cooking records the meal cost once");
    await page.locator("#undoChange").click();
    const restoredRefrigerator = await page.locator("#refrigeratorList").innerText();
    const restoredFreezer = await page.locator("#freezerList").innerText();
    const restoredPantry = await page.locator("#pantryList").innerText();
    check(
      /ground beef\s+8 oz/i.test(restoredFreezer) &&
        /eggs\s+6 count/i.test(restoredRefrigerator) &&
        /ketchup\s+1 cup/i.test(restoredPantry),
      "Undo restores food consumed by cooking",
      [restoredRefrigerator, restoredFreezer, restoredPantry].join(" ").replace(/\s+/g, " ")
    );
    await page.waitForTimeout(500);
    check(plannerData.mealCostHistory.length === 0, "Undo removes the cooked meal cost");

    check(errors.length === 0, "No browser JavaScript errors", errors.join(" | "));
    check(badResponses.length === 0, "No failed local asset requests", badResponses.join(" | "));
    check(plannerData.schemaVersion === 4, "Planner data saves with the current schema");
    console.error("CHECKPOINT complete");

    console.log(JSON.stringify({ passed: results.length, results }, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
