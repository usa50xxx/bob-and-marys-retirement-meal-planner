const http = require("http");
const fsp = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(process.env.MEAL_PLANNER_ROOT || "outputs/meal-planner");
const fixtures = path.resolve("work/receipt-fixtures");
const plannerData = {
  recipes: [{
    id: "receipt-test",
    name: "Receipt Test Meal",
    baseServings: 2,
    notes: "Test.",
    ingredients: [{ amount: 1, unit: "item", name: "milk" }]
  }],
  foodStorage: { refrigerator: [], freezer: [], pantry: [] },
  builderTemplates: {},
  mealCostHistory: [],
  weeklyPlan: {}
};
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

async function run() {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname === "/api/data") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(request.method === "GET" ? JSON.stringify(plannerData) : '{"saved":true}');
        return;
      }
      const file = path.resolve(root, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`);
      if (!file.startsWith(`${root}${path.sep}`)) throw new Error("Forbidden");
      response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
      response.end(await fsp.readFile(file));
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage();
  const errors = [];
  const failures = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => localStorage.setItem("bobMaryMealPlannerDeviceMode", "computer"));

  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: "networkidle" });
    await page.locator('[data-app-view="groceries"]').click();

    await page.locator("#groceryFileInput").setInputFiles(path.join(fixtures, "sample-receipt.pdf"));
    await page.waitForFunction(() => !document.querySelector("#receiptReview")?.hidden, null, { timeout: 30000 });
    const pdfRows = await page.locator(".receipt-review-row").count();
    const pdfText = (await page.locator(".receipt-review-row input").evaluateAll((inputs) =>
      inputs.map((input) => input.value).join(" ")
    ));
    if (pdfRows !== 3 || !/Milk/i.test(pdfText) || !/Eggs/i.test(pdfText) || /\bTOTAL\b/i.test(pdfText)) {
      throw new Error(`PDF receipt test failed: ${pdfRows} rows; ${pdfText}`);
    }
    await page.locator("#cancelReceiptReview").click();

    await page.locator("#groceryFileInput").setInputFiles(path.join(fixtures, "sample-receipt.png"));
    await page.waitForFunction(() => !document.querySelector("#receiptReview")?.hidden, null, { timeout: 120000 });
    const photoRows = await page.locator(".receipt-review-row").count();
    const photoText = (await page.locator(".receipt-review-row input").evaluateAll((inputs) =>
      inputs.map((input) => input.value).join(" ")
    ));
    if (photoRows !== 3 || !/Milk|Eggs|Spaghetti/i.test(photoText) || /\bTOTAL\b/i.test(photoText)) {
      throw new Error(`Photo receipt test failed: ${photoRows} rows; ${photoText}`);
    }
    if (errors.length || failures.length) {
      throw new Error(`Browser errors: ${errors.join(" | ")}; failed assets: ${failures.join(" | ")}`);
    }

    console.log(JSON.stringify({
      passed: true,
      pdf: { rows: pdfRows, text: pdfText.replace(/\s+/g, " ").trim() },
      photo: { rows: photoRows, text: photoText.replace(/\s+/g, " ").trim() }
    }, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
