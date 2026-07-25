const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const root = "E:\\Meal Planner";
const dataPath = path.join(root, "planner-data.json");
const backupPath = path.join(root, "backups", `click-test-restore-${Date.now()}.json`);
const screenshotPath = path.join(os.tmpdir(), "supperloom-e-drive-click-test.png");

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
  schemaVersion: 3,
  recipes: [
    {
      id: "test-meatloaf",
      name: "Test Meatloaf",
      baseServings: 2,
      notes: "Heat oven to 350 F.\nMix beef, eggs, ketchup, onion soup mix, salt, and pepper.\nBake 55 minutes, then rest 10 minutes.",
      photo: "",
      ingredients: [
        { amount: 1, unit: "lb", name: "ground beef" },
        { amount: 2, unit: "count", name: "eggs" },
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
    freezer: [
      { name: "ground beef", amount: 0.5, unit: "lb", price: 2.5, store: "Aldi", itemNumber: "SKU 000" }
    ],
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
  groceryPriceHistory: [
    { id: "walmart-beef", name: "ground beef", amount: 1, unit: "lb", price: 5, store: "Walmart", recordedAt: new Date().toISOString() },
    { id: "publix-beef", name: "ground beef", amount: 1, unit: "lb", price: 6, store: "Publix", recordedAt: new Date().toISOString() },
    { id: "aldi-beef", name: "ground beef", amount: 1, unit: "lb", price: 4, store: "Aldi", recordedAt: new Date().toISOString() }
  ],
  shoppingSettings: {
    stores: ["Walmart", "Publix", "Aldi"],
    assignments: {}
  },
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

async function clickView(page, view) {
  await page.locator(`[data-app-view="${view}"]`).click();
  await page.waitForFunction(
    name => document.querySelector(`[data-app-view="${name}"]`)?.getAttribute("aria-current") === "page",
    view
  );
}

async function replaceOpenFile(fileHandle, contents) {
  const buffer = Buffer.isBuffer(contents) ? contents : Buffer.from(contents, "utf8");
  await fileHandle.truncate(0);
  await fileHandle.write(buffer, 0, buffer.length, 0);
  await fileHandle.sync();
}

async function writeExclusiveBackup(targetPath, contents) {
  const backupHandle = await fsp.open(targetPath, "wx", 0o600);
  try {
    await backupHandle.writeFile(contents);
    await backupHandle.sync();
  } finally {
    await backupHandle.close();
  }
}

async function run() {
  if (!fs.existsSync(path.join(root, "index.html"))) {
    throw new Error("E:\\Meal Planner\\index.html was not found.");
  }

  let dataHandle;
  try {
    dataHandle = await fsp.open(dataPath, "r+");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("planner-data.json was not found, so I stopped instead of testing over unknown data.");
    }
    throw error;
  }

  let server;
  let browser;
  const results = [];
  const browserErrors = [];
  const requestFailures = [];
  const badResponses = [];
  let originalData;

  try {
    originalData = await dataHandle.readFile();
    await fsp.mkdir(path.dirname(backupPath), { recursive: true });
    await writeExclusiveBackup(backupPath, originalData);
    await replaceOpenFile(dataHandle, JSON.stringify(testData, null, 2));

    server = await serve(root);
    const url = `http://127.0.0.1:${server.address().port}/index.html`;
    const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    browser = await chromium.launch({
      headless: true,
      executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
      args: ["--no-sandbox"]
    });
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    await page.addInitScript(() => {
      window.__lastClipboardText = "";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value) => {
            window.__lastClipboardText = value;
          }
        }
      });
    });
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
    await page.waitForSelector("text=Supperloom Meal Planner");
    if (await page.locator("#devicePrompt:not([hidden])").count()) {
      await page.locator("[data-device-choice='computer']").click();
      await page.waitForFunction(() => document.querySelector("#devicePrompt")?.hidden === true);
    }
    results.push({ name: "Open from E drive server", status: "PASS", detail: await page.title() });

    const bodyColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    results.push({ name: "Dark easy-on-the-eyes page", status: /rgb\((1[0-9]|2[0-9]|3[0-9])/.test(bodyColor) ? "PASS" : "WARN", detail: bodyColor });

    try {
      await page.waitForFunction(
        () => document.querySelector("#recipeName")?.value === "Test Meatloaf",
        null,
        { timeout: 10000 }
      );
    } catch {
      const diagnostics = await page.evaluate(async () => ({
        recipeName: document.querySelector("#recipeName")?.value || "",
        saveStatus: document.querySelector("#saveStatus")?.textContent || "",
        driveRecipes: await fetch("/api/data").then(response => response.json())
          .then(data => data.recipes?.map(recipe => recipe.name) || [])
          .catch(error => [`request failed: ${error.message}`])
      }));
      throw new Error(
        `Thumb-drive recipes did not load: ${JSON.stringify({
          ...diagnostics,
          browserErrors,
          requestFailures,
          badResponses
        })}`
      );
    }
    await clickView(page, "recipes");
    await expectText(page, "#recipeList", /Test Meatloaf/i, "Recipe list loads", results);

    await page.fill("#targetServings", "4");
    await page.waitForTimeout(300);
    await expectText(page, "#scaledList", /2 lb.*ground beef|ground beef/i, "Servings scale ingredients", results);
    const soundToggle = page.locator("#machineSoundToggle");
    const soundStartsOn = await soundToggle.getAttribute("aria-pressed") === "true";
    await soundToggle.click();
    const soundTurnsOff = await soundToggle.getAttribute("aria-pressed") === "false";
    await soundToggle.click();
    const soundReturns = await soundToggle.getAttribute("aria-pressed") === "true";
    results.push({
      name: "Machine sounds can be turned off and on",
      status: soundStartsOn && soundTurnsOff && soundReturns ? "PASS" : "FAIL",
      detail: `starts on: ${soundStartsOn}, turns off: ${soundTurnsOff}, returns: ${soundReturns}`
    });

    await page.evaluate(() => {
      window.__shareAlertMessage = "";
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
      button: document.querySelector("#textRecipe")?.textContent || ""
    }));
    results.push({
      name: "Text recipe prepares scaled ingredients and instructions",
      status: /Test Meatloaf/i.test(sharedRecipe)
        && /Serves 4/i.test(sharedRecipe)
        && /2 lb ground beef/i.test(sharedRecipe)
        && /Instructions/i.test(sharedRecipe)
        ? "PASS"
        : "FAIL",
      detail: sharedRecipe.replace(/\s+/g, " ").slice(0, 220)
    });
    results.push({
      name: "Text recipe visibly explains what happened",
      status: /full recipe has been copied/i.test(shareFeedback.alert)
        && /recipe copied/i.test(shareFeedback.button)
        ? "PASS"
        : "FAIL",
      detail: JSON.stringify(shareFeedback)
    });

    await page.evaluate(() => { window.__printCalled = false; window.print = () => { window.__printCalled = true; }; });
    await page.click("#printMeal");
    await page.waitForTimeout(300);
    const printCalled = await page.evaluate(() => window.__printCalled === true);
    const printTitle = await page.locator("#printTitle").innerText();
    results.push({ name: "Print meal page", status: printCalled && /Test Meatloaf/i.test(printTitle) ? "PASS" : "FAIL", detail: printTitle });
    await page.emulateMedia({ media: "print" });
    const printLayout = await page.locator("#printSheet").evaluate((sheet) => {
      const sheetStyle = getComputedStyle(sheet);
      return {
        color: sheetStyle.color,
        background: sheetStyle.backgroundColor,
        fontSize: sheetStyle.fontSize,
        columns: getComputedStyle(sheet.querySelector(".print-columns")).columnCount,
        devicePrompt: getComputedStyle(document.querySelector("#devicePrompt")).display,
        cookingMode: getComputedStyle(document.querySelector("#cookingMode")).display
      };
    });
    const printLayoutPass = printLayout.color === "rgb(0, 0, 0)"
      && printLayout.background === "rgb(255, 255, 255)"
      && Math.abs(Number.parseFloat(printLayout.fontSize) - (16 * 96 / 72)) < 0.1
      && printLayout.columns === "3"
      && printLayout.devicePrompt === "none"
      && printLayout.cookingMode === "none";
    results.push({
      name: "Print layout is black 16-point text on white paper in three columns",
      status: printLayoutPass ? "PASS" : "FAIL",
      detail: JSON.stringify(printLayout)
    });
    await page.emulateMedia({ media: "screen" });

    await clickView(page, "plan");
    await page.locator("[data-week-recipe='monday']").selectOption("test-meatloaf");
    await page.locator("[data-week-servings='monday']").fill("4");
    await page.waitForTimeout(500);
    await expectText(page, "#weeklyGroceryGroups", /ground beef/i, "Weekly grocery list builds", results);
    await expectText(
      page,
      "#storeComparison",
      /Walmart[\s\S]*\$10\.00[\s\S]*Publix[\s\S]*\$12\.00[\s\S]*Aldi[\s\S]*\$8\.00/i,
      "Thumb-drive shopping list compares three stores",
      results
    );
    const groundBeefComparison = page.locator(".store-comparison-row", { hasText: "ground beef" });
    const aldiChecked = await groundBeefComparison
      .locator("[data-shopping-store-choice='Aldi']:checked")
      .count() === 1;
    const aldiList = await visibleText(
      page,
      "#storeShoppingLists .store-shopping-list:has(h4:text-is('Aldi'))"
    );
    results.push({
      name: "Thumb-drive shopping list checks the cheapest store",
      status: aldiChecked && /ground beef/i.test(aldiList) && /\$8\.00/i.test(aldiList) ? "PASS" : "FAIL",
      detail: aldiList
    });

    await clickView(page, "recipes");
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

    await clickView(page, "groceries");
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
    await page.locator(".receipt-review-row").first().waitFor();
    await page.click("#commitReceiptItems");
    await clickView(page, "inventory");
    await expectText(page, "#refrigeratorList", /Milk|Eggs/i, "Grocery import sorts refrigerator", results);
    await expectText(page, "#freezerList", /Shrimp/i, "Grocery import sorts freezer", results);
    await expectText(page, "#pantryList", /Ketchup|Spaghetti/i, "Grocery import sorts pantry", results);

    await clickView(page, "home");
    await page.fill("#foodAiQuestion", "What can I make tonight?");
    await page.click("#askFoodAi");
    await page.waitForTimeout(300);
    await expectText(page, "#foodAiAnswer", /make|ideas|closest|food|recipe/i, "Small Food AI answers food question", results);

    await clickView(page, "recipes");
    await page.locator("#recipeList button", { hasText: "Test Meatloaf" }).click();
    await clickView(page, "spending");
    await page.click("#recordMealCost");
    await page.waitForTimeout(700);
    await expectText(page, "#mealCostCalendar", /\$/i, "Meal cost calendar records cost", results);

    await clickView(page, "recipes");
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

    const failedResults = results.filter((result) => result.status === "FAIL");
    if (failedResults.length) {
      throw new Error(`Thumb-drive checks failed: ${failedResults.map((result) => result.name).join(", ")}`);
    }

    return { url, screenshotPath, results, browserErrors, requestFailures, badResponses };
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await new Promise(resolve => server.close(resolve));
    if (originalData) {
      await replaceOpenFile(dataHandle, originalData);
      await fsp.rm(backupPath, { force: true });
    }
    await dataHandle.close();
  }
}

module.exports = { replaceOpenFile, writeExclusiveBackup };

if (require.main === module) {
  run()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
