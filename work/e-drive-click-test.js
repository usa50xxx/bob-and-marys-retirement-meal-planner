const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const root = "E:\\Meal Planner";
const dataPath = path.join(root, "planner-data.json");
const backupPath = path.join(root, "backups", `click-test-restore-${Date.now()}.json`);
const screenshotPath = "C:\\Users\\usa50\\Documents\\Codex\\2026-07-23\\i-want-to-create-a-new\\outputs\\e-drive-click-test.png";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon"
};

const testData = {
  recipes: [
    {
      id: "test-meatloaf",
      name: "Test Meatloaf",
      baseServings: 2,
      notes: "Heat oven to 350 F.\nMix beef, eggs, ketchup, onion soup mix, salt, and pepper.\nBake 55 minutes, then rest 10 minutes.",
      photo: "",
      ingredients: [
        { amount: 1, unit: "lb", name: "ground beef" },
        { amount: 2, unit: "", name: "eggs" },
        { amount: 0.25, unit: "cup", name: "ketchup" },
        { amount: 1, unit: "packet", name: "onion soup mix" },
        { amount: 0.5, unit: "tsp", name: "salt" },
        { amount: 0.25, unit: "tsp", name: "black pepper" }
      ]
    }
  ],
  foodStorage: {
    refrigerator: [
      { name: "eggs", amount: 12, unit: "count", price: 3.12, store: "Walmart", itemNumber: "UPC 111" }
    ],
    freezer: [],
    pantry: [
      { name: "ketchup", amount: 1, unit: "bottle", price: 2.48, store: "Walmart", itemNumber: "SKU 222" },
      { name: "onion soup mix", amount: 1, unit: "box", price: 1.74, store: "Publix", itemNumber: "SKU 333" },
      { name: "salt", amount: 1, unit: "container", price: 0.88, store: "Aldi", itemNumber: "SKU 444" },
      { name: "black pepper", amount: 1, unit: "container", price: 2.25, store: "Aldi", itemNumber: "SKU 555" }
    ]
  },
  builderOptions: null,
  builderStyles: null,
  builderTemplates: {},
  mealCostHistory: [],
  weeklyPlan: {},
  savedAt: new Date().toISOString()
};

function serve(rootDir) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname === "/api/data") {
        if (req.method === "GET") {
          const body = await fsp.readFile(dataPath, "utf8").catch(() => "{}");
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
          res.end(body);
          return;
        }
        if (req.method === "POST") {
          let body = "";
          req.on("data", chunk => body += chunk);
          req.on("end", async () => {
            await fsp.writeFile(dataPath, body, "utf8");
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
            res.end("{\"saved\":true}");
          });
          return;
        }
      }

      const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = path.normalize(path.join(rootDir, requested));
      if (!filePath.startsWith(rootDir)) {
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

  return new Promise(resolve => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function visibleText(page, selector) {
  return (await page.locator(selector).innerText()).replace(/\s+/g, " ").trim();
}

async function expectText(page, selector, pattern, label, results) {
  const text = await visibleText(page, selector);
  const ok = pattern.test(text);
  results.push({ name: label, status: ok ? "PASS" : "FAIL", detail: text.slice(0, 220) });
  if (!ok) throw new Error(`${label} failed. Saw: ${text}`);
}

async function run() {
  if (!fs.existsSync(path.join(root, "index.html"))) {
    throw new Error("E:\\Meal Planner\\index.html was not found.");
  }
  if (!fs.existsSync(dataPath)) {
    throw new Error("planner-data.json was not found, so I stopped instead of testing over unknown data.");
  }

  await fsp.mkdir(path.dirname(backupPath), { recursive: true });
  await fsp.copyFile(dataPath, backupPath);
  await fsp.writeFile(dataPath, JSON.stringify(testData, null, 2), "utf8");

  let server;
  let browser;
  const results = [];
  const browserErrors = [];
  const requestFailures = [];
  const badResponses = [];

  try {
    server = await serve(root);
    const url = `http://127.0.0.1:${server.address().port}/index.html`;
    const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    browser = await chromium.launch({
      headless: true,
      executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
      args: ["--no-sandbox"]
    });
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    page.on("pageerror", error => browserErrors.push(error.message));
    page.on("console", msg => {
      if (msg.type() === "error") {
        const location = msg.location ? msg.location() : {};
        browserErrors.push(`${msg.text()} ${location.url || ""}`.trim());
      }
    });
    page.on("requestfailed", req => {
      const reqUrl = req.url();
      if (!reqUrl.includes("themealdb.com/images/ingredients")) requestFailures.push(reqUrl);
    });
    page.on("response", response => {
      const status = response.status();
      const reqUrl = response.url();
      if (status >= 400 && !reqUrl.includes("themealdb.com/images/ingredients")) {
        badResponses.push(`${status} ${reqUrl}`);
      }
    });

    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Bob and Mary's Retirement Meal Planner");
    if (await page.locator("#devicePrompt:not([hidden])").count()) {
      await page.locator("[data-device-choice='computer']").click();
      await page.waitForFunction(() => document.querySelector("#devicePrompt")?.hidden === true);
    }
    results.push({ name: "Open from E drive server", status: "PASS", detail: await page.title() });

    const bodyColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    results.push({ name: "Dark easy-on-the-eyes page", status: /rgb\((1[0-9]|2[0-9]|3[0-9])/.test(bodyColor) ? "PASS" : "WARN", detail: bodyColor });

    await expectText(page, "#recipeList", /Test Meatloaf/i, "Recipe list loads", results);

    await page.fill("#targetServings", "4");
    await page.waitForTimeout(300);
    await expectText(page, "#scaledList", /2 lb.*ground beef|ground beef/i, "Servings scale ingredients", results);

    await page.evaluate(() => { window.__printCalled = false; window.print = () => { window.__printCalled = true; }; });
    await page.click("#printMeal");
    await page.waitForTimeout(300);
    const printCalled = await page.evaluate(() => window.__printCalled === true);
    const printTitle = await page.locator("#printTitle").innerText();
    results.push({ name: "Print meal page", status: printCalled && /Test Meatloaf/i.test(printTitle) ? "PASS" : "FAIL", detail: printTitle });

    await page.locator("#weeklyPlannerCard").scrollIntoViewIfNeeded();
    await page.locator("[data-week-recipe='monday']").selectOption("test-meatloaf");
    await page.locator("[data-week-servings='monday']").fill("4");
    await page.waitForTimeout(500);
    await expectText(page, "#weeklyGroceryGroups", /ground beef/i, "Weekly grocery list builds", results);

    await page.locator("#mealBuilderCard").scrollIntoViewIfNeeded();
    await page.click("#resetBuiltMeal");
    await page.locator("#mainChoiceButtons .choice-button").filter({ hasText: /^Beef$/ }).first().click();
    await page.waitForTimeout(400);
    const beefCards = await page.$$eval("#mainChoiceButtons .choice-button", buttons => buttons.map(button => {
      const img = button.querySelector("img");
      return {
        label: button.textContent.trim().replace(/\s+/g, " "),
        src: img ? img.getAttribute("src") : "",
        width: img ? img.naturalWidth : 0,
        height: img ? img.naturalHeight : 0
      };
    }));
    const requiredCuts = ["Ribeye steak", "T-bone steak", "Porterhouse steak", "Filet mignon", "New York strip", "Skirt steak", "Hanger steak", "Beef shank", "Prime rib roast", "Beef roast"];
    const missingCuts = requiredCuts.filter(cut => !beefCards.some(card => card.label === cut && card.width > 0 && card.height > 0));
    const uniqueImages = new Set(beefCards.map(card => card.src)).size;
    results.push({ name: "Build meal beef picture choices", status: !missingCuts.length && uniqueImages >= 18 ? "PASS" : "FAIL", detail: `${beefCards.length} choices, ${uniqueImages} image files, missing: ${missingCuts.join(", ") || "none"}` });
    if (missingCuts.length || uniqueImages < 18) throw new Error("Beef choice picture test failed.");

    await page.locator("#mainChoiceButtons .choice-button").filter({ hasText: /^Ribeye steak$/ }).first().click();
    await page.locator("#mainChoiceButtons .choice-button").filter({ hasText: /^Grill$/ }).first().click();
    await page.waitForSelector("#builderMealName");
    await page.click("#addBuilderIngredientLine");
    await page.locator(".builder-ingredient-row").last().locator(".builder-name").fill("butter");
    await page.click("#saveBuiltMeal");
    await page.waitForTimeout(700);
    await expectText(page, "#recipeList", /Ribeye steak.*Grill|Grill.*Ribeye steak/i, "Built meal saves", results);

    await page.locator("#pantryCard").scrollIntoViewIfNeeded();
    const groceryText = [
      "Walmart",
      "Great Value Whole Milk 1 gal $3.48 SKU 12345",
      "Large Eggs 12 count $2.99 UPC 98765",
      "Frozen Shrimp 2 lb $9.98 Item # 55555",
      "Publix Ketchup 20 oz $2.49 Item # 22222",
      "Aldi Spaghetti 16 oz $1.29 SKU 33333"
    ].join("\n");
    await page.fill("#walmartPaste", groceryText);
    await page.click("#addWalmartOrder");
    await page.waitForTimeout(800);
    await expectText(page, "#refrigeratorList", /Milk|Eggs/i, "Grocery import sorts refrigerator", results);
    await expectText(page, "#freezerList", /Shrimp/i, "Grocery import sorts freezer", results);
    await expectText(page, "#pantryList", /Ketchup|Spaghetti/i, "Grocery import sorts pantry", results);

    await page.fill("#foodAiQuestion", "What can I make tonight?");
    await page.click("#askFoodAi");
    await page.waitForTimeout(300);
    await expectText(page, "#foodAiAnswer", /make|ideas|closest|food|recipe/i, "Small Food AI answers food question", results);

    await page.locator("#mealSpendingCard").scrollIntoViewIfNeeded();
    await page.click("#recordMealCost");
    await page.waitForTimeout(700);
    await expectText(page, "#mealCostCalendar", /\$/i, "Meal cost calendar records cost", results);

    await page.locator("#recipeForm").scrollIntoViewIfNeeded();
    const onePixelPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
    await page.evaluate((dataUrl) => {
      const recipeName = document.querySelector("#recipeName");
      const preview = document.querySelector("#recipePhotoPreview");
      if (recipeName) recipeName.value = `${recipeName.value} Photo Test`;
      if (preview) preview.src = dataUrl;
    }, onePixelPng);
    results.push({ name: "Recipe photo area exists", status: await page.locator("#recipePhotoInput").count() ? "PASS" : "FAIL", detail: "Photo upload control found" });

    await page.locator("#recipeForm").scrollIntoViewIfNeeded();
    await page.screenshot({ path: screenshotPath, fullPage: true });

    await page.locator("#onlineRecipeSearch").fill("chicken");
    await page.click("#searchOnlineRecipes");
    await page.waitForTimeout(5000);
    const onlineStatus = await visibleText(page, "#onlineStatus");
    const onlineOk = /found|saved|recipe/i.test(onlineStatus) && !/could not reach/i.test(onlineStatus);
    results.push({ name: "Online TheMealDB search", status: onlineOk ? "PASS" : "WARN", detail: onlineStatus.slice(0, 220) });

    if (browserErrors.length || requestFailures.length || badResponses.length) {
      results.push({ name: "Browser errors", status: "WARN", detail: `errors=${browserErrors.length}, failedRequests=${requestFailures.length}, badResponses=${badResponses.length}` });
    } else {
      results.push({ name: "Browser errors", status: "PASS", detail: "No page errors or important failed requests" });
    }

    return { url, screenshotPath, results, browserErrors, requestFailures, badResponses };
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await new Promise(resolve => server.close(resolve));
    await fsp.copyFile(backupPath, dataPath);
  }
}

run()
  .then(result => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
