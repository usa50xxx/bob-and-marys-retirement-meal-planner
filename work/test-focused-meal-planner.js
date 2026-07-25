const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { createHash } = require("crypto");
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
  groceryPriceHistory: [{
    id: "price-aldi-beef",
    name: "ground beef",
    amount: 1,
    unit: "lb",
    price: 4,
    store: "Aldi",
    itemNumber: "ALDI-BEEF",
    recordedAt: new Date().toISOString()
  }, {
    id: "price-walmart-beef",
    name: "ground beef",
    amount: 1,
    unit: "lb",
    price: 5,
    store: "Walmart",
    itemNumber: "WM-BEEF",
    recordedAt: new Date().toISOString()
  }, {
    id: "price-publix-beef",
    name: "ground beef",
    amount: 1,
    unit: "lb",
    price: 6,
    store: "Publix",
    itemNumber: "PUBLIX-BEEF",
    recordedAt: new Date().toISOString()
  }],
  shoppingSettings: {
    stores: ["Walmart", "Publix", "Aldi"],
    assignments: {}
  },
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

async function inspectBuilderImages(page, groupLabel, minimumCount) {
  await page.locator("#resetBuiltMeal").click();
  await page.locator("#mainChoiceButtons").getByRole(
    "button",
    { name: groupLabel, exact: true }
  ).click();
  await page.waitForFunction((expectedCount) => {
    const cards = [...document.querySelectorAll("#mainChoiceButtons .choice-button")];
    return cards.length >= expectedCount &&
      cards.every((card) => {
        const image = card.querySelector("img");
        return image?.complete && image.naturalWidth > 0;
      });
  }, minimumCount, { timeout: 15_000 });

  const cards = await page.locator("#mainChoiceButtons .choice-button").evaluateAll((buttons) =>
    buttons.map((button) => ({
      name: button.textContent.trim().replace(/\s+/g, " "),
      src: button.querySelector("img")?.getAttribute("src") || "",
      loaded: Boolean(button.querySelector("img")?.naturalWidth)
    }))
  );
  const hashes = await Promise.all(cards.map(async (card) => {
    const response = await fetch(new URL(card.src, page.url()));
    assert(response.ok, `Could not load ${groupLabel} picture: ${card.name}`);
    const contents = Buffer.from(await response.arrayBuffer());
    return createHash("sha256").update(contents).digest("hex");
  }));
  return {
    cards: cards.map((card, index) => ({ ...card, hash: hashes[index] })),
    loaded: cards.filter((card) => card.loaded).length,
    unique: new Set(hashes).size
  };
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
    window.__machineToneStarts = 0;
    window.__lastClipboardText = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__lastClipboardText = value;
        }
      }
    });
    class FakeAudioParam {
      setValueAtTime() {}
      exponentialRampToValueAtTime() {}
    }
    class FakeOscillator {
      constructor() {
        this.frequency = new FakeAudioParam();
        this.type = "sine";
      }
      connect() {
        return this;
      }
      start() {
        window.__machineToneStarts += 1;
      }
      stop() {}
    }
    class FakeGain {
      constructor() {
        this.gain = new FakeAudioParam();
      }
      connect() {
        return this;
      }
    }
    window.AudioContext = class {
      constructor() {
        this.currentTime = 0;
        this.state = "running";
        this.destination = {};
      }
      createOscillator() {
        return new FakeOscillator();
      }
      createGain() {
        return new FakeGain();
      }
      resume() {
        return Promise.resolve();
      }
    };
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
    check(
      await page.locator("#machineSoundToggle").getAttribute("aria-pressed") === "true",
      "Machine sounds start on with an accessible control"
    );
    await page.locator("#machineSoundToggle").click();
    const tonesAfterTurningOff = await page.evaluate(() => window.__machineToneStarts);
    check(
      await page.locator("#machineSoundToggle").getAttribute("aria-pressed") === "false"
        && await page.evaluate(() => localStorage.getItem("supperloomMachineSounds")) === "off",
      "Machine sound preference can be turned off and is remembered"
    );

    await clickView(page, "plan");
    check(
      await page.evaluate(() => window.__machineToneStarts) === tonesAfterTurningOff,
      "Muted machine sounds stay silent during navigation"
    );
    await page.locator("#machineSoundToggle").click();
    const tonesAfterTurningOn = await page.evaluate(() => window.__machineToneStarts);
    await clickView(page, "home");
    check(
      await page.locator("#machineSoundToggle").getAttribute("aria-pressed") === "true"
        && await page.evaluate(() => window.__machineToneStarts) > tonesAfterTurningOn,
      "Machine sounds return for page movement when turned on"
    );
    await clickView(page, "plan");
    check(await page.locator("#weeklyPlannerCard").isVisible(), "Plan screen opens");
    check(await page.locator("#receiptImportCard").isHidden(), "Unrelated receipt screen stays hidden");
    await page.locator("[data-week-recipe='monday']").selectOption("test-meatloaf");
    await page.locator("[data-week-servings='monday']").fill("4");
    await page.waitForTimeout(450);
    console.error("CHECKPOINT plan");
    const weeklyText = await page.locator("#weeklyGroceryGroups").innerText();
    check(/ground beef/i.test(weeklyText) && /Buy\s+1\.5 lb/i.test(weeklyText), "Weekly list calculates Have / Need / Buy", weeklyText.replace(/\s+/g, " "));
    const comparisonText = await page.locator("#storeComparison").innerText();
    check(
      /Walmart[\s\S]*\$10\.00/i.test(comparisonText)
        && /Publix[\s\S]*\$12\.00/i.test(comparisonText)
        && /Aldi[\s\S]*Cheapest[\s\S]*\$8\.00/i.test(comparisonText),
      "Shopping list compares three stores side by side using full packages",
      comparisonText.replace(/\s+/g, " ").slice(0, 500)
    );
    check(
      await page.locator("[data-shopping-store-choice='Aldi']:checked").count() === 1
        && /ground beef[\s\S]*\$8\.00[\s\S]*2 packages, 1 lb each/i.test(
          await page.locator("#storeShoppingLists .store-shopping-list", { hasText: "Aldi" }).innerText()
        ),
      "Cheapest prices are checked and separated into a store shopping list"
    );
    await page.locator("[data-shopping-store-choice='Walmart']").check();
    await page.waitForTimeout(350);
    check(
      /ground beef[\s\S]*\$10\.00/i.test(
        await page.locator("#storeShoppingLists .store-shopping-list", { hasText: "Walmart" }).innerText()
      )
        && await page.locator("[data-shopping-store-choice='Walmart']:checked").count() === 1,
      "A shopper can move an item to a different store list"
    );
    const packageChecks = await page.evaluate(() => {
      const candidates = [
        { name: "granulated sugar", amount: 1, unit: "item", price: 2.5, store: "Walmart", source: "Saved receipt", sourceRank: 3, date: new Date().toISOString() },
        { name: "canned corn", amount: 1, unit: "item", price: 1.25, store: "Walmart", source: "Saved receipt", sourceRank: 3, date: new Date().toISOString() },
        { name: "ribeye steak", amount: 1, unit: "item", price: 12, store: "Walmart", source: "Saved receipt", sourceRank: 3, date: new Date().toISOString() },
        { name: "granulated sugar", amount: 4, unit: "lb", price: 6, store: "Aldi", source: "Inventory receipt", sourceRank: 1, date: new Date().toISOString() }
      ];
      const sugar = estimateStorePrice({ name: "sugar", buy: 2, unit: "tbsp" }, "Walmart", candidates);
      const corn = estimateStorePrice({ name: "corn", buy: 20, unit: "oz" }, "Walmart", candidates);
      const steak = estimateStorePrice({ name: "ribeye steak", buy: 2, unit: "oz" }, "Walmart", candidates);
      const partialInventory = estimateStorePrice({ name: "sugar", buy: 2, unit: "tbsp" }, "Aldi", candidates);
      return { sugar, corn, steak, partialInventory };
    });
    check(
      packageChecks.sugar.packageCount === 1
        && packageChecks.sugar.packageUnit === "lb"
        && packageChecks.sugar.packageCount * packageChecks.sugar.targetAmount >= 2
        && packageChecks.corn.packageCount === 2
        && packageChecks.corn.packageAmount === 12
        && packageChecks.corn.packageCount * packageChecks.corn.targetAmount >= 20
        && packageChecks.steak.packageCount === 1
        && packageChecks.steak.packageUnit === "lb"
        && packageChecks.steak.packageCount * packageChecks.steak.targetAmount >= 2
        && packageChecks.partialInventory.packageAmount === 1
        && packageChecks.partialInventory.packageUnit === "lb"
        && packageChecks.partialInventory.packagePrice === 1.5,
      "Package rounding always buys the required amount or extra",
      JSON.stringify(packageChecks)
    );
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
    const persistedRecipeCount = plannerData.recipes.length;
    await page.locator("#newRecipe").click();
    await page.waitForFunction(() => document.querySelector("#recipeName")?.value === "New recipe");
    const draftImage = await page.locator("#recipeList .recipe-card.active img").evaluate((image) => ({
      src: image.getAttribute("src"),
      loaded: image.complete && image.naturalWidth > 0
    }));
    check(
      plannerData.recipes.length === persistedRecipeCount,
      "An incomplete new recipe is not written to thumb-drive data"
    );
    check(
      draftImage.loaded && /icons\/app-icon-192\.png$/i.test(draftImage.src),
      "A recipe without a food photo uses the local Supperloom placeholder",
      JSON.stringify(draftImage)
    );
    await page.locator("#undoChange").click();
    await page.waitForFunction(() => document.querySelector("#recipeName")?.value === "Test Meatloaf");
    await page.fill("#targetServings", "4");
    const scaledText = await page.locator("#scaledList").innerText();
    check(/2 lb\s+ground beef/i.test(scaledText), "Recipe ingredients scale for four people", scaledText);
    await page.evaluate(() => {
      window.__shareAlertMessage = "";
      window.__originalShareAlert = window.alert;
      window.alert = (message) => {
        window.__shareAlertMessage = String(message);
      };
    });
    await page.locator("#textRecipe").click();
    await page.waitForFunction(() =>
      /recipe copied/i.test(document.querySelector("#textRecipe")?.textContent || "")
      && /full recipe has been copied/i.test(window.__shareAlertMessage || "")
    );
    const sharedRecipe = await page.evaluate(() => window.__lastClipboardText);
    const shareFeedback = await page.evaluate(() => ({
      alert: window.__shareAlertMessage,
      button: document.querySelector("#textRecipe")?.textContent || "",
      status: document.querySelector("#saveStatus")?.textContent || ""
    }));
    await page.evaluate(() => {
      window.alert = window.__originalShareAlert;
      delete window.__originalShareAlert;
    });
    check(
      /Test Meatloaf/i.test(sharedRecipe)
        && /Serves 4/i.test(sharedRecipe)
        && /2 lb ground beef/i.test(sharedRecipe)
        && /Ingredients/i.test(sharedRecipe)
        && /Instructions/i.test(sharedRecipe),
      "Text recipe prepares a complete scaled message",
      sharedRecipe.replace(/\s+/g, " ").slice(0, 220)
    );
    check(
      /full recipe has been copied/i.test(shareFeedback.alert)
        && /recipe copied/i.test(shareFeedback.button)
        && /full recipe copied/i.test(shareFeedback.status),
      "Computer sharing gives clear visible instructions",
      JSON.stringify(shareFeedback)
    );
    await page.evaluate(() => renderPrintSheet());
    await page.emulateMedia({ media: "print" });
    const printLayout = await page.locator("#printSheet").evaluate((sheet) => {
      const sheetStyle = getComputedStyle(sheet);
      const columnsStyle = getComputedStyle(sheet.querySelector(".print-columns"));
      const bodyStyle = getComputedStyle(document.body);
      return {
        display: sheetStyle.display,
        color: sheetStyle.color,
        background: sheetStyle.backgroundColor,
        fontSize: sheetStyle.fontSize,
        columns: columnsStyle.columnCount,
        bodyBackground: bodyStyle.backgroundColor,
        devicePrompt: getComputedStyle(document.querySelector("#devicePrompt")).display,
        cookingMode: getComputedStyle(document.querySelector("#cookingMode")).display
      };
    });
    check(
      printLayout.display === "block"
        && printLayout.color === "rgb(0, 0, 0)"
        && printLayout.background === "rgb(255, 255, 255)"
        && Math.abs(Number.parseFloat(printLayout.fontSize) - (16 * 96 / 72)) < 0.1
        && printLayout.columns === "3"
        && printLayout.bodyBackground === "rgb(255, 255, 255)"
        && printLayout.devicePrompt === "none"
        && printLayout.cookingMode === "none",
      "Printed recipes use black 16-point text on white paper in three columns",
      JSON.stringify(printLayout)
    );
    await page.emulateMedia({ media: "screen" });
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
    const builderGroups = [
      { label: "Beef", minimumCount: 18, minimumUnique: 18 },
      { label: "Chicken", minimumCount: 10, minimumUnique: 10 },
      { label: "Pork", minimumCount: 14, minimumUnique: 14 },
      { label: "Seafood", minimumCount: 18, minimumUnique: 18 }
    ];
    for (const group of builderGroups) {
      const result = await inspectBuilderImages(page, group.label, group.minimumCount);
      check(
        result.cards.length >= group.minimumCount &&
          result.loaded === result.cards.length &&
          result.unique >= group.minimumUnique,
        `${group.label} choices have loaded, distinct pictures`,
        `${result.cards.length} choices, ${result.loaded} loaded, ${result.unique} byte-unique; ` +
        result.cards.map((card) => (
          `${card.name}=${card.src}#${card.hash.slice(0, 8)}`
        )).join("; ")
      );
    }
    const specificIngredientImages = {
      "apple cider vinegar": "apple_cider_vinegar",
      "red wine vinegar": "red_wine_vinegar",
      "rice vinegar": "rice_vinegar",
      "white vinegar": "white_vinegar",
      "canola oil": "canola_oil",
      "sesame oil": "sesame_oil",
      "sweet and sour sauce": "sweet_and_sour_sauce",
      "brown rice": "brown_rice",
      "basmati rice": "basmati_rice",
      "jasmine rice": "jasmine_rice",
      "rice noodles": "rice_noodles",
      "bread flour": "bread_flour",
      "powdered sugar": "powdered_sugar",
      "peanuts": "peanuts",
      "cannellini beans": "cannellini_beans",
      "refried beans": "refried_beans",
      "split peas": "split_peas",
      "stewed tomatoes": "stewed_tomatoes",
      "corned beef hash": "corned_beef_hash",
      "chicken liver": "chicken_liver",
      "chicken wings": "chicken_wings",
      "minced pork": "minced_pork",
      "rainbow trout": "rainbow_trout",
      "salt cod": "salt_cod",
      "cream cheese": "cream_cheese",
      "sweetened condensed milk": "sweetened_condensed_milk",
      "bouillon cubes": "bouillon_cubes",
      "taco shells": "taco_shells"
    };
    const imageKeyResults = await page.evaluate((cases) => (
      Object.entries(cases).map(([name, expected]) => ({
        name,
        expected,
        actual: ingredientImageKey(name)
      }))
    ), specificIngredientImages);
    check(
      imageKeyResults.every(({ actual, expected }) => actual === expected),
      "Specific pantry and condiment names use their exact pictures",
      imageKeyResults.map(({ name, actual }) => `${name}=${actual}`).join("; ")
    );
    console.error("CHECKPOINT builder");

    await clickView(page, "groceries");
    const receiptText = [
      "Walmart",
      "Whole Milk 1 count $3.48 SKU 12345",
      "Publix Order",
      "Frozen Shrimp 16 oz $9.98 Item # 55555",
      "Aldi Receipt",
      "2 x 16 oz Spaghetti $2.58 UPC 33333"
    ].join("\n");
    await page.fill("#walmartPaste", receiptText);
    await page.locator("#addWalmartOrder").click();
    const rows = page.locator(".receipt-review-row");
    await rows.first().waitFor();
    check(await rows.count() === 3, "Pasted receipt opens an editable review", `${await rows.count()} items`);
    const parsedRows = await rows.evaluateAll((receiptRows) => receiptRows.map((row) => ({
      amount: Number(row.querySelector(".receipt-amount").value),
      unit: row.querySelector(".receipt-unit").value,
      name: row.querySelector(".receipt-item-name").value,
      store: row.querySelector(".receipt-store-name").value
    })));
    check(
      JSON.stringify(parsedRows) === JSON.stringify([
        { amount: 1, unit: "count", name: "Whole Milk", store: "Walmart" },
        { amount: 16, unit: "oz", name: "Frozen Shrimp", store: "Publix" },
        { amount: 32, unit: "oz", name: "Spaghetti", store: "Aldi" }
      ]),
      "Multi-store headings and package quantities are parsed correctly",
      JSON.stringify(parsedRows)
    );
    await rows.first().locator(".receipt-best-by-date").fill(dateFromToday(2));
    await page.locator("#commitReceiptItems").click();
    await page.waitForTimeout(400);
    check(
      ["Walmart", "Publix", "Aldi"].every((store) =>
        plannerData.groceryPriceHistory.some((item) => item.store === store && item.recordedAt)
      ),
      "Approved receipts save dated prices for future store comparisons"
    );
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
    const firstRecipeUnit = page.locator("#ingredientRows .unit").first();
    const originalRecipeUnit = await firstRecipeUnit.inputValue();
    await firstRecipeUnit.fill("2");
    const validationDialogPromise = page.waitForEvent("dialog");
    await page.locator("#recipeForm button[type='submit']").click();
    const validationDialog = await validationDialogPromise;
    const validationMessage = validationDialog.message();
    check(
      /check the unit/i.test(validationMessage),
      "Numeric-only recipe units are rejected before saving",
      validationMessage
    );
    check(
      plannerData.recipes[0].ingredients[0].unit === originalRecipeUnit,
      "An invalid recipe edit is not written to the thumb-drive data"
    );
    await firstRecipeUnit.fill(originalRecipeUnit);
    await page.waitForTimeout(450);
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
    const recordedCost = plannerData.mealCostHistory[0].cost;
    await clickView(page, "spending");
    const postCookingCost = await page.locator("#currentMealCost").innerText();
    check(
      postCookingCost.includes(`$${recordedCost.toFixed(2)}`),
      "Meal estimate remains stable after its inventory is consumed",
      postCookingCost
    );
    await clickView(page, "inventory");
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
    check(plannerData.schemaVersion === 6, "Planner data saves with the current schema");
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
