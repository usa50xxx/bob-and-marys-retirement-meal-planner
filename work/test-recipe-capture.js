const http = require("http");
const fsp = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(process.env.MEAL_PLANNER_ROOT || "outputs/meal-planner");
const fixtures = path.resolve("work/recipe-fixtures");
let plannerData = {
  schemaVersion: 5,
  recipes: [{
    id: "capture-test",
    name: "Capture Test Meal",
    baseServings: 2,
    notes: "Cook until ready.",
    photo: "",
    ingredients: [{ amount: 1, unit: "item", name: "milk" }]
  }],
  foodStorage: { refrigerator: [], freezer: [], pantry: [] },
  builderTemplates: {},
  mealCostHistory: [],
  weeklyPlan: {}
};
const linkedRecipeHtml = `<!doctype html><html><head>
<script type="application/ld+json">{
  "@context":"https://schema.org",
  "@type":"Recipe",
  "name":"Linked Beef Stew",
  "recipeYield":"6 servings",
  "prepTime":"PT20M",
  "cookTime":"PT2H",
  "totalTime":"PT2H20M",
  "recipeIngredient":["2 lb beef chuck","4 cups beef broth","3 carrots"],
  "recipeInstructions":[
    {"@type":"HowToStep","text":"Heat oven to 325 F."},
    {"@type":"HowToStep","text":"Cook for 2 hours."}
  ]
}</script></head><body>Linked Beef Stew</body></html>`;
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname === "/api/data") {
        if (request.method === "POST") {
          let body = "";
          for await (const chunk of request) body += chunk;
          plannerData = JSON.parse(body);
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end('{"saved":true}');
          return;
        }
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(plannerData));
        return;
      }
      if (url.pathname === "/api/recipe") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({
          html: linkedRecipeHtml,
          finalUrl: url.searchParams.get("url")
        }));
        return;
      }
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

  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  page.setDefaultTimeout(20000);
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
    localStorage.setItem("bobMaryMealPlannerView", "recipes");
  });

  const checks = [];
  const check = (condition, name) => {
    assert(condition, name);
    checks.push(name);
  };

  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#recipeName")?.value === "Capture Test Meal");
    await page.locator('[data-app-view="recipes"]').click();

    const originalCount = await page.locator(".recipe-card").count();
    await page.locator("#recipePasteBox").fill(`Weeknight Meatloaf
Serves 4
Prep time: 15 minutes
Cook time: 55 minutes
Ingredients
1 1/2 lb ground beef
2 eggs
1/2 cup ketchup
Instructions
Heat oven to 350 F.
Mix and bake for 55 minutes.`);
    await page.locator("#savePastedRecipe").click();
    await page.locator("#recipeReview").waitFor({ state: "visible" });
    check(await page.locator(".recipe-card").count() === originalCount, "Paste waits for approval before saving");
    check(await page.locator("#reviewRecipeName").inputValue() === "Weeknight Meatloaf", "Paste extracts recipe name");
    check(await page.locator("#reviewRecipeServings").inputValue() === "4", "Paste extracts servings");
    check(await page.locator("#reviewTemperature").inputValue() === "350°F", "Paste extracts temperature");
    check(await page.locator(".review-ingredient-row").count() === 3, "Paste extracts ingredients");
    await page.locator("#reviewRecipeName").fill("Bob's Weeknight Meatloaf");
    await page.locator("#saveReviewedRecipe").click();
    await page.waitForFunction(() => document.querySelector("#recipeName")?.value === "Bob's Weeknight Meatloaf");
    await page.waitForTimeout(500);
    check(await page.locator(".recipe-card").count() === originalCount + 1, "Approved paste saves exactly once");
    check(plannerData.recipes[0].temperature === "350°F", "Reviewed timing data persists to drive storage");

    await page.locator("#recipeFileInput").setInputFiles(path.join(fixtures, "sample-recipe.pdf"));
    await page.locator("#recipeReview").waitFor({ state: "visible" });
    await page.waitForFunction(() => /salmon/i.test(document.querySelector("#reviewRecipeName")?.value || ""));
    check(await page.locator(".review-ingredient-row").count() === 4, "PDF recipe opens a populated review");
    await page.locator("#cancelRecipeReview").click();

    await page.locator("#recipeFileInput").setInputFiles(path.join(fixtures, "sample-recipe.png"));
    await page.locator("#recipeReview").waitFor({ state: "visible", timeout: 120000 });
    await page.waitForFunction(() => /salmon/i.test(document.querySelector("#reviewRecipeName")?.value || ""), null, { timeout: 120000 });
    check(/400/.test(await page.locator("#reviewTemperature").inputValue()), "Recipe photo OCR extracts oven temperature");
    await page.locator("#cancelRecipeReview").click();

    await page.locator("#recipeUrlInput").fill("http://127.0.0.1/private-recipe");
    await page.locator("#readRecipeUrl").click();
    check(await page.locator("#recipeReview").isHidden(), "Recipe links cannot target a private address");
    check(/public recipe website/i.test(await page.locator("#recipeReadStatus").textContent()), "Private link explains what to use instead");

    await page.locator("#recipeUrlInput").fill("https://recipes.example/beef-stew");
    await page.locator("#readRecipeUrl").click();
    await page.locator("#recipeReview").waitFor({ state: "visible" });
    check(await page.locator("#reviewRecipeName").inputValue() === "Linked Beef Stew", "Link reads Schema.org recipe name");
    check(await page.locator("#reviewCookTime").inputValue() === "2 hours", "Link reads structured cook time");
    check(await page.locator(".review-ingredient-row").count() === 3, "Link reads structured ingredients");
    await page.locator("#cancelRecipeReview").click();

    await page.evaluate(() => saveOnlineMeal({
      strMeal: "Online Lemon Fish",
      strInstructions: "Heat oven to 375 F. Bake the fish.",
      strMealThumb: "",
      strSource: "https://recipes.example/fish",
      strIngredient1: "Fish fillet",
      strMeasure1: "1 lb"
    }));
    check(await page.locator("#recipeReview").isVisible(), "Online search recipe also waits for review");
    check(await page.locator(".recipe-card").count() === originalCount + 1, "Online review does not save early");
    if (process.env.RECIPE_CAPTURE_SCREENSHOT) {
      await page.locator("#pasteRecipeCard").screenshot({ path: process.env.RECIPE_CAPTURE_SCREENSHOT });
    }

    await page.evaluate(() => setDeviceMode("android", { persist: false, updateUrl: false, announce: false, hidePrompt: true }));
    const phoneLayout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      controls: [...document.querySelectorAll("#recipeReview button, #recipeReview input")]
        .filter((element) => !element.closest("[hidden]"))
        .map((element) => Math.round(element.getBoundingClientRect().height))
    }));
    check(phoneLayout.overflow <= 1, "Recipe review fits a phone-width layout");
    check(phoneLayout.controls.every((height) => height >= 40), "Recipe review controls remain touch friendly");
    check(errors.length === 0 && badResponses.length === 0, `No browser errors: ${errors.join(" | ")} ${badResponses.join(" | ")}`);

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
