const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

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
  }],
  foodStorage: {
    refrigerator: [{ id: "eggs", amount: 6, unit: "count", name: "eggs", price: 2.4, store: "Walmart", itemNumber: "111" }],
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
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox"]
  });
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

    await clickView(page, "recipes");
    check(await page.locator("#recipeList").isVisible(), "Recipes screen opens");
    await page.fill("#targetServings", "4");
    const scaledText = await page.locator("#scaledList").innerText();
    check(/2 lb\s+ground beef/i.test(scaledText), "Recipe ingredients scale for four people", scaledText);
    console.error("CHECKPOINT recipes");

    await clickView(page, "home");
    await page.locator("#quickBuildMeal").click();
    check(await page.locator("#weeklyPlannerCard").isVisible(), "Plan this week shortcut opens the weekly planner");
    await clickView(page, "recipes");
    await page.locator("#resetBuiltMeal").click();
    await page.locator("#mainChoiceButtons .choice-button").filter({ hasText: /^Beef$/ }).click();
    await page.waitForTimeout(300);
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
    check(await page.locator("#undoChange").isEnabled(), "Undo is available after a change");
    await page.locator("#undoChange").click();
    await page.waitForTimeout(350);
    const undoneInventory = await page.locator("#pantryCard").innerText();
    check(!/Whole Milk|Frozen Shrimp|Spaghetti/i.test(undoneInventory), "Undo restores the prior inventory");
    console.error("CHECKPOINT inventory");

    await clickView(page, "spending");
    check(await page.locator("#mealSpendingCard").isVisible(), "Spending calendar opens");
    const costText = await page.locator("#currentMealCost").innerText();
    check(/\$/.test(costText) && /per person/i.test(costText), "Meal and per-person cost are calculated", costText);

    await page.waitForTimeout(600);
    const saveText = await page.locator("#saveStatus").innerText();
    check(/Saved to thumb drive|Saved in this browser only/i.test(saveText), "Save status is visible", saveText);

    check(errors.length === 0, "No browser JavaScript errors", errors.join(" | "));
    check(badResponses.length === 0, "No failed local asset requests", badResponses.join(" | "));
    check(plannerData.schemaVersion === 3, "Planner data saves with the current schema");
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
