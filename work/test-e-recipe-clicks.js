const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(process.env.MEAL_PLANNER_ROOT || process.argv[2] || "E:\\Meal Planner");
const screenshotPath = path.join(os.tmpdir(), "supperloom-recipe-clicks.png");

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
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    const url = `http://127.0.0.1:${server.address().port}/index.html`;
    await page.goto(url, { waitUntil: "networkidle" });
    if (await page.locator("#devicePrompt").isVisible()) {
      await page.locator("#devicePromptDismiss").click();
    }
    await page.locator("[data-app-view='recipes']").click();
    await page.waitForSelector("#recipeList .recipe-card");
    await page.waitForSelector("#visualRecipeList .visual-recipe");
    await page.waitForFunction(() => {
      const images = [
        document.querySelector("#recipeList .recipe-card.active img"),
        document.querySelector("#visualRecipeList .rolodex-card[data-center='true'] img")
      ];
      return images.every((image) => image?.complete && image.naturalWidth > 0);
    });

    const before = await page.evaluate(() => ({
      recipeCards: document.querySelectorAll("#recipeList .recipe-card").length,
      recipeImages: [...document.querySelectorAll("#recipeList .recipe-card img")].map(img => ({
        src: img.getAttribute("src"),
        width: img.naturalWidth,
        height: img.naturalHeight,
        visible: img.getBoundingClientRect().width > 0 && img.getBoundingClientRect().height > 0
      })),
      visualCards: document.querySelectorAll("#visualRecipeList .visual-recipe").length,
      rolodexCards: document.querySelectorAll("#visualRecipeList .rolodex-card").length,
      rolodexWindow: document.querySelectorAll(".recipe-rolodex-window").length,
      letterButtons: document.querySelectorAll(".rolodex-letter").length,
      enabledLetters: [...document.querySelectorAll(".rolodex-letter:not(:disabled)")].map(button => button.textContent),
      visualText: document.querySelector("#visualRecipeList")?.innerText || "",
      showcaseBefore: document.querySelector("#showcaseMealName")?.textContent || ""
    }));

    const targetText = "Taco Night";
    const transformsBefore = await page.$$eval(".rolodex-card", cards => cards.map(card => card.style.transform));
    await page.locator(".rolodex-spin").last().click();
    await page.waitForTimeout(350);
    const transformsAfterButton = await page.$$eval(".rolodex-card", cards => cards.map(card => card.style.transform));
    await page.locator(".recipe-rolodex-window").hover();
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(350);
    const transformsAfter = await page.$$eval(".rolodex-card", cards => cards.map(card => card.style.transform));
    await page.locator(".rolodex-letter").filter({ hasText: /^T$/ }).first().click();
    await page.waitForTimeout(350);
    const activeLetter = await page.locator(".rolodex-letter.active").innerText();
    await page.locator(".rolodex-card[data-center='true']").click();
    await page.waitForTimeout(1000);

    const after = await page.evaluate(() => ({
      selectedShowcase: document.querySelector("#showcaseMealName")?.textContent || "",
      scrollY: window.scrollY,
      showcaseTop: document.querySelector(".recipe-showcase")?.getBoundingClientRect().top,
      activeRecipe: document.querySelector("#recipeList .recipe-card.active")?.innerText || "",
      rolodexCardOpening: document.querySelectorAll(".rolodex-card.is-opening").length
    }));

    await page.screenshot({ path: screenshotPath, fullPage: true });

    const failures = [];
    if (before.recipeCards < 1) failures.push("No recipe cards found.");
    if (before.recipeImages.length !== before.recipeCards) failures.push("Recipe cards do not all have images.");
    if (before.recipeImages.some(img => !img.src)) failures.push("One or more recipe cards have no image source.");
    if (before.recipeImages.some(img => img.visible && (img.width <= 0 || img.height <= 0))) failures.push("One or more visible recipe card images did not load.");
    if (before.visualCards < before.recipeCards) failures.push("Visual recipe book does not show all recipes.");
    if (before.rolodexCards < before.recipeCards || before.rolodexWindow !== 1) failures.push("Rolodex spinner did not render.");
    if (before.letterButtons !== 26 || !before.enabledLetters.includes("S") || !before.enabledLetters.includes("L") || !before.enabledLetters.includes("T")) failures.push("A-Z Rolodex tabs did not render for the recipe letters.");
    if (JSON.stringify(transformsBefore) === JSON.stringify(transformsAfterButton)) failures.push("Rolodex did not spin when using the down button.");
    if (JSON.stringify(transformsAfterButton) === JSON.stringify(transformsAfter)) failures.push("Rolodex did not spin when using the mouse wheel.");
    if (activeLetter !== "T") failures.push("Clicking the T tab did not spin to the T recipes.");
    if (/Recipe photos will show here/i.test(before.visualText)) failures.push("Visual recipe book still shows the empty message.");
    if (!after.selectedShowcase.includes(targetText)) failures.push(`Clicking ${targetText} from the Rolodex did not open that recipe view.`);

    const result = {
      url,
      screenshotPath,
      targetClicked: targetText,
      buttonSpinChanged: JSON.stringify(transformsBefore) !== JSON.stringify(transformsAfterButton),
      wheelSpinChanged: JSON.stringify(transformsAfterButton) !== JSON.stringify(transformsAfter),
      activeLetterAfterTabClick: activeLetter,
      before,
      after,
      status: failures.length ? "FAIL" : "PASS",
      failures
    };

    console.log(JSON.stringify(result, null, 2));
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
