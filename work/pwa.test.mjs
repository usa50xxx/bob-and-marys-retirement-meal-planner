import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const appRoot = path.resolve("outputs", "meal-planner");
const index = await fs.readFile(path.join(appRoot, "index.html"), "utf8");
const worker = await fs.readFile(path.join(appRoot, "service-worker.js"), "utf8");
const pwa = await fs.readFile(path.join(appRoot, "pwa.js"), "utf8");
const manifest = JSON.parse(
  await fs.readFile(path.join(appRoot, "manifest.webmanifest"), "utf8"),
);

assert.match(index, /rel="manifest" href="manifest\.webmanifest"/);
assert.match(index, /rel="apple-touch-icon" href="icons\/apple-touch-icon\.png"/);
assert.match(index, /<script src="pwa\.js"><\/script>/);
assert.match(pwa, /serviceWorker\.register\("\.\/service-worker\.js"\)/);
assert.equal(manifest.name, "Supperloom Meal Planner");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "./index.html");

for (const [file, width] of [
  ["app-icon-192.png", 192],
  ["app-icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  const metadata = await sharp(path.join(appRoot, "icons", file)).metadata();
  assert.equal(metadata.width, width, file);
  assert.equal(metadata.height, width, file);
}

const cachedPaths = [...worker.matchAll(/"\.\/([^"]*)"/g)].map((match) => match[1]);
for (const relative of cachedPaths) {
  if (!relative) continue;
  await fs.access(path.join(appRoot, ...relative.split("/")));
}

const mimeTypes = new Map([
  [".css", "text/css"],
  [".html", "text/html"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript"],
  [".json", "application/json"],
  [".mjs", "text/javascript"],
  [".png", "image/png"],
  [".wasm", "application/wasm"],
  [".webmanifest", "application/manifest+json"],
  [".webp", "image/webp"],
]);

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const target = path.resolve(appRoot, relative);
    if (target !== appRoot && !target.startsWith(`${appRoot}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    const contents = await fs.readFile(target);
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type": mimeTypes.get(path.extname(target)) || "application/octet-stream",
    });
    response.end(contents);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/index.html?device=iphone`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await assert.doesNotReject(page.locator("h1").first().waitFor());
  assert.match(await page.title(), /Supperloom/);
  assert.match(await page.locator("h1").first().innerText(), /Supperloom Meal Planner/);
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("Installable and offline phone app tests passed.");
