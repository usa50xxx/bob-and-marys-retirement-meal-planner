const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { chromium, devices } = require("playwright");

const root = process.argv[2] || path.resolve("outputs/meal-planner");
const screenshotPath = path.resolve("outputs/device-mode-test.png");

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
    await desktop.locator(".recipe-card").first().click();
    await desktop.waitForSelector(".recipe-showcase");

    const iphone = await browser.newPage({ ...devices["iPhone 15"], viewport: { width: 393, height: 852 } });
    await iphone.goto(`${baseUrl}/iphone.html`, { waitUntil: "networkidle" });
    await iphone.waitForFunction(() => location.search.includes("device=iphone") && document.body.dataset.deviceMode === "iphone");
    await iphone.waitForSelector("h1", { state: "visible" });
    await iphone.locator(".rolodex-spin").last().click();
    await iphone.locator(".rolodex-card[data-center='true']").click();
    await iphone.waitForTimeout(900);
    await iphone.evaluate(() => window.scrollTo(0, 0));
    await iphone.waitForTimeout(200);
    await iphone.screenshot({ path: screenshotPath, fullPage: false });

    const android = await browser.newPage({ ...devices["Pixel 7"], viewport: { width: 412, height: 915 } });
    await android.goto(`${baseUrl}/android.html`, { waitUntil: "networkidle" });
    await android.waitForFunction(() => location.search.includes("device=android") && document.body.dataset.deviceMode === "android");

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

    const androidResult = await android.evaluate(() => ({
      mode: document.body.dataset.deviceMode,
      phoneLayout: document.body.classList.contains("phone-layout"),
      activeDevice: document.querySelector(".device-link.active")?.textContent?.trim() || "",
      buttonHeight: document.querySelector("button")?.getBoundingClientRect().height || 0,
      mastheadColumns: getComputedStyle(document.querySelector(".masthead")).gridTemplateColumns
    }));

    const failures = [];
    if (!result.promptHidden) failures.push("First-time device prompt did not hide after choosing Computer.");
    if (result.desktopMode !== "computer" || result.activeDevice !== "Computer") failures.push("Computer mode did not activate from the top device selector.");
    if (!result.showcase) failures.push("Recipe click did not open a recipe after device switching.");
    if (iphoneResult.mode !== "iphone" || !iphoneResult.phoneLayout || iphoneResult.activeDevice !== "iPhone") failures.push("iPhone page did not switch into iPhone phone layout.");
    if (androidResult.mode !== "android" || !androidResult.phoneLayout || androidResult.activeDevice !== "Android") failures.push("Android page did not switch into Android phone layout.");
    if (iphoneResult.buttonHeight < 48 || androidResult.buttonHeight < 48) failures.push("Phone buttons are not large enough for touch use.");
    if (iphoneResult.mastheadColumns.split(" ").length > 1 || androidResult.mastheadColumns.split(" ").length > 1) failures.push("Phone masthead did not collapse to one column.");
    if (!iphoneResult.headingVisible || iphoneResult.bodyTextLength < 300) failures.push("iPhone screen did not show the planner content.");

    console.log(JSON.stringify({
      root,
      screenshotPath,
      status: failures.length ? "FAIL" : "PASS",
      failures,
      result,
      iphoneResult,
      androidResult
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
