const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(process.env.MEAL_PLANNER_ROOT || process.argv[2] || "E:\\Meal Planner");
const screenshotPath = path.join(os.tmpdir(), "supperloom-top-rolodex.png");

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
        const body = await fsp.readFile(path.join(rootDir, "planner-data.json"), "utf8").catch(() => "{}");
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(body);
        return;
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
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
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
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    const url = `http://127.0.0.1:${server.address().port}/index.html`;
    await page.goto(url, { waitUntil: "networkidle" });
    if (await page.locator("#devicePrompt").isVisible()) {
      await page.locator("#devicePromptDismiss").click();
    }
    await page.waitForSelector(".masthead .masthead-rolodex .recipe-rolodex-window");
    await page.waitForFunction(() => {
      const image = document.querySelector(".masthead .rolodex-card[data-center='true'] img");
      return image?.complete && image.naturalWidth > 0;
    });

    await page.locator("[data-app-view='spending']").click();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.locator("[data-app-view='home']").click();
    await page.waitForFunction(() => window.scrollY < 5);

    const beforeTransforms = await page.$$eval(".masthead .rolodex-card", cards => cards.map(card => card.style.transform));
    await page.locator(".masthead .rolodex-spin").last().click();
    await page.waitForTimeout(350);
    const afterButtonTransforms = await page.$$eval(".masthead .rolodex-card", cards => cards.map(card => card.style.transform));
    await page.locator(".masthead .rolodex-letter").filter({ hasText: /^T$/ }).first().click();
    await page.waitForTimeout(350);
    const activeLetter = await page.locator(".masthead .rolodex-letter.active").innerText();
    const homePosition = await page.evaluate(() => {
      const windowBox = document.querySelector(".masthead .recipe-rolodex-window")?.getBoundingClientRect();
      const centerCard = document.querySelector(".masthead .rolodex-card[data-center='true']")?.getBoundingClientRect();
      return {
        centerCardContained: Boolean(
          windowBox && centerCard
          && centerCard.top >= windowBox.top
          && centerCard.bottom <= windowBox.bottom
        ),
        scrollY: window.scrollY
      };
    });
    await page.locator(".masthead .rolodex-card[data-center='true']").click();
    await page.waitForTimeout(900);

    const result = await page.evaluate(() => {
      const title = document.querySelector(".masthead > div:first-child")?.getBoundingClientRect();
      const rolodex = document.querySelector(".masthead-rolodex")?.getBoundingClientRect();
      const windowBox = document.querySelector(".masthead .recipe-rolodex-window")?.getBoundingClientRect();
      const serving = document.querySelector(".serving-panel")?.getBoundingClientRect();
      return {
        heading: document.querySelector("h1")?.textContent || "",
        showcase: document.querySelector("#showcaseMealName")?.textContent || "",
        mastheadColumns: getComputedStyle(document.querySelector(".masthead")).gridTemplateColumns,
        titleRight: title?.right || 0,
        rolodexLeft: rolodex?.left || 0,
        rolodexRight: rolodex?.right || 0,
        servingLeft: serving?.left || 0,
        rolodexWidth: rolodex?.width || 0,
        rolodexWindowHeight: windowBox?.height || 0,
        visualInMasthead: !!document.querySelector(".masthead #visualRecipeList"),
        visualInSidebar: !!document.querySelector(".sidebar #visualRecipeList"),
        letterCount: document.querySelectorAll(".masthead .rolodex-letter").length,
        activeLetter: document.querySelector(".masthead .rolodex-letter.active")?.textContent || ""
      };
    });
    result.homePosition = homePosition;

    await page.screenshot({ path: screenshotPath, fullPage: false });

    const failures = [];
    if (!result.visualInMasthead || result.visualInSidebar) failures.push("Rolodex is not only in the masthead.");
    if (!(result.titleRight <= result.rolodexLeft && result.rolodexRight <= result.servingLeft)) failures.push("Rolodex is not between the title and people controls.");
    if (result.rolodexWidth < 430 || result.rolodexWindowHeight < 340) failures.push("Rolodex is not large enough in the masthead.");
    if (JSON.stringify(beforeTransforms) === JSON.stringify(afterButtonTransforms)) failures.push("Rolodex did not spin from the top controls.");
    if (activeLetter !== "T" || result.showcase !== "Taco Night") failures.push("Top A-Z tab/front card did not open Taco Night.");
    if (!result.homePosition.centerCardContained || result.homePosition.scrollY > 5) failures.push("Returning Home left the selected Rolodex card clipped.");
    if (result.letterCount !== 26) failures.push("A-Z rail is missing letters.");

    console.log(JSON.stringify({
      url,
      screenshotPath,
      status: failures.length ? "FAIL" : "PASS",
      failures,
      activeLetter,
      buttonSpinChanged: JSON.stringify(beforeTransforms) !== JSON.stringify(afterButtonTransforms),
      result
    }, null, 2));

    if (failures.length) process.exit(1);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
