const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const AxeBuilder = require("@axe-core/playwright").default;
const { chromium } = require("playwright");

const root = path.resolve(process.env.MEAL_PLANNER_ROOT || "outputs/meal-planner");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
  ".gz": "application/gzip",
  ".ico": "image/x-icon",
};

function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname === "/api/data") {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end("{}");
        return;
      }

      const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = path.normalize(path.join(root, requested));
      if (!filePath.startsWith(path.normalize(root))) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      const data = await fsp.readFile(filePath);
      response.writeHead(200, {
        "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      });
      response.end(data);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
}

function formatViolations(label, violations) {
  return violations.map((violation) => {
    const targets = violation.nodes
      .flatMap((node) => node.target)
      .slice(0, 6)
      .join(", ");
    return `${label}: ${violation.id} (${violation.impact || "unknown"}) at ${targets}`;
  });
}

async function audit(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return formatViolations(label, results.violations);
}

async function accessibilityNodes(page) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Accessibility.enable");
    const result = await session.send("Accessibility.getFullAXTree");
    return result.nodes.filter((node) => !node.ignored);
  } finally {
    await session.detach();
  }
}

function hasAccessibleNode(nodes, role, name) {
  return nodes.some((node) => (
    node.role?.value === role
    && (name === undefined || node.name?.value === name)
  ));
}

async function selectView(page, view) {
  await page.locator(`[data-app-view="${view}"]`).click();
  await page.waitForFunction(
    (name) => document.querySelector(`[data-app-view="${name}"]`)?.getAttribute("aria-current") === "page",
    view,
  );
}

async function run() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  let context;
  const failures = [];

  try {
    const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    browser = await chromium.launch({
      headless: true,
      executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
      args: ["--no-sandbox"],
    });
    context = await browser.newContext({ viewport: { width: 1365, height: 900 } });

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const page = await context.newPage();
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "networkidle" });
    await page.waitForSelector("#devicePrompt:not([hidden])");
    failures.push(...await audit(page, "device prompt"));

    await page.locator("[data-device-choice='computer']").click();
    await page.waitForFunction(() => document.querySelector("#devicePrompt")?.hidden === true);
    failures.push(...await audit(page, "home"));
    const homeNodes = await accessibilityNodes(page);
    if (!hasAccessibleNode(homeNodes, "heading", "Bob and Mary's Retirement Meal Planner")) {
      failures.push("screen reader: the page title heading is missing from the accessibility tree");
    }
    if (!hasAccessibleNode(homeNodes, "navigation", "Main areas")) {
      failures.push("screen reader: the main screen navigation has no accessible name");
    }

    for (const view of ["plan", "groceries", "inventory", "spending", "recipes"]) {
      await selectView(page, view);
      failures.push(...await audit(page, view));
    }

    const recipeCard = page.locator(".recipe-card").first();
    if (await recipeCard.count()) {
      await recipeCard.click();
      failures.push(...await audit(page, "selected recipe"));
      await page.locator("#startCooking").click();
      await page.waitForFunction(() => document.querySelector("#cookingMode")?.open === true);
      failures.push(...await audit(page, "cooking mode"));
      const cookingName = await page.locator("#cookingTitle").innerText();
      const cookingNodes = await accessibilityNodes(page);
      if (!hasAccessibleNode(cookingNodes, "dialog", cookingName)) {
        failures.push("screen reader: guided cooking is not exposed as a named dialog");
      }
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#cookingMode")?.open === false);
    } else {
      failures.push("selected recipe: no recipe card was available for the accessibility audit");
    }

    for (const mode of [
      { name: "iphone", width: 393, height: 852 },
      { name: "android", width: 412, height: 915 },
    ]) {
      const phonePage = await context.newPage();
      await phonePage.setViewportSize({ width: mode.width, height: mode.height });
      await phonePage.goto(`${baseUrl}/${mode.name}.html`, { waitUntil: "networkidle" });
      await phonePage.waitForFunction(
        (name) => document.body.dataset.deviceMode === name,
        mode.name,
      );
      failures.push(...await audit(phonePage, `${mode.name} home`));
      await selectView(phonePage, "recipes");
      failures.push(...await audit(phonePage, `${mode.name} recipes`));
      await phonePage.close();
    }

    const keyboardPage = await context.newPage();
    await keyboardPage.addInitScript(() => {
      localStorage.setItem("bobMaryMealPlannerDeviceMode", "computer");
    });
    await keyboardPage.goto(`${baseUrl}/index.html?device=computer`, { waitUntil: "networkidle" });

    let reachedRecipes = false;
    let visibleFocus = false;
    for (let index = 0; index < 80; index += 1) {
      await keyboardPage.keyboard.press("Tab");
      const focus = await keyboardPage.evaluate(() => {
        const element = document.activeElement;
        const style = window.getComputedStyle(element);
        return {
          recipes: element?.matches?.('[data-app-view="recipes"]') || false,
          visible: (style.outlineStyle !== "none" && style.outlineWidth !== "0px")
            || style.boxShadow !== "none",
        };
      });
      visibleFocus ||= focus.visible;
      if (focus.recipes) {
        reachedRecipes = true;
        await keyboardPage.keyboard.press("Enter");
        break;
      }
    }

    if (!reachedRecipes) failures.push("keyboard: the Recipes screen was not reachable with Tab");
    if (!visibleFocus) failures.push("keyboard: no visible focus indicator was detected");
    if (reachedRecipes) {
      await keyboardPage.waitForFunction(
        () => document.querySelector('[data-app-view="recipes"]')?.getAttribute("aria-current") === "page",
      );
    }

    if (failures.length) {
      throw new Error(`Accessibility audit failed:\n${failures.map((item) => `- ${item}`).join("\n")}`);
    }

    console.log(JSON.stringify({
      passed: true,
      audited: [
        "device prompt",
        "home",
        "plan",
        "groceries",
        "inventory",
        "spending",
        "recipes",
        "selected recipe",
        "cooking mode",
        "iphone home and recipes",
        "android home and recipes",
      ],
      keyboard: {
        recipesReachable: reachedRecipes,
        visibleFocus,
      },
      screenReader: {
        namedPageHeading: true,
        namedMainNavigation: true,
        namedCookingDialog: true,
      },
    }, null, 2));
  } finally {
    await context?.close();
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
