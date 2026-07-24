const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const root = "E:\\Meal Planner";
const screenshotPath = "C:\\Users\\usa50\\Documents\\Codex\\2026-07-23\\i-want-to-create-a-new\\outputs\\e-top-rolodex-header.png";
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

(async () => {
  const server = await serve(root);
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: fs.existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        : undefined,
      args: ["--no-sandbox"]
    });
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: "networkidle" });
    await page.waitForSelector(".masthead .recipe-rolodex-window");
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(JSON.stringify({ screenshotPath }, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
