async function run() {
  const endpoint = process.env.ANDROID_CDP_URL || "http://127.0.0.1:9224";
  const expectedApi = String(process.env.ANDROID_EXPECTED_API || "");
  const expectedRelease = String(process.env.ANDROID_EXPECTED_RELEASE || "");
  const expectedLayout = process.env.ANDROID_EXPECTED_LAYOUT || "phone";
  const expectedOffline = process.env.ANDROID_EXPECTED_OFFLINE === "1";
  const targets = await fetch(`${endpoint}/json`).then((response) => response.json());
  const target = targets.find((item) => item.type === "page");
  if (!target || !target.webSocketDebuggerUrl) {
    throw new Error("The Android meal-planner WebView was not found.");
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const exceptions = [];
  let commandId = 0;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params && message.params.exceptionDetails;
      const exception = details && details.exception;
      exceptions.push(
        (exception && (exception.description || exception.value))
        || (details && details.text)
        || "Android WebView exception",
      );
    }
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out connecting to the Android WebView.")),
      10000,
    );
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    socket.addEventListener("error", (event) => {
      clearTimeout(timer);
      reject(event.error || new Error("Android WebView connection failed."));
    }, { once: true });
  });

  function command(method, params = {}) {
    const id = ++commandId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Android WebView did not answer ${method}.`));
      }, 10000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const result = await command("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const exception = result.exceptionDetails.exception;
      throw new Error((exception && exception.description) || result.exceptionDetails.text);
    }
    return result.result && result.result.value;
  }

  try {
    await command("Runtime.enable");
    const initial = await evaluate(`(function () {
      return {
        readyState: document.readyState,
        title: document.title,
        native: Boolean(
          window.Capacitor
          && typeof window.Capacitor.isNativePlatform === "function"
          && window.Capacitor.isNativePlatform()
        ),
        recovery: Boolean(
          window.MealPlannerRecovery
          && typeof window.MealPlannerRecovery.chooseLocalRecovery === "function"
        ),
        uuid: Boolean(window.crypto && typeof window.crypto.randomUUID === "function"),
        matchAll: typeof String.prototype.matchAll === "function",
        recipeCount: document.querySelectorAll(".recipe-card").length,
        recipeReadStatus: document.querySelector("#recipeReadStatus").textContent,
        recipeReviewVisible: !document.querySelector("#recipeReview").hidden,
        width: window.innerWidth,
        height: window.innerHeight,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        userAgent: navigator.userAgent
      };
    })()`);

    if (initial.readyState !== "complete") throw new Error("The Android page did not finish loading.");
    if (!initial.title.includes("Bob and Mary")) throw new Error(`Unexpected title: ${initial.title}`);
    if (!initial.native) throw new Error("The Android app did not identify itself as native.");
    if (!initial.recovery) throw new Error("The recovery module was not loaded.");
    if (!initial.uuid || !initial.matchAll) throw new Error("Android compatibility helpers are missing.");
    if (initial.recipeCount < 1) throw new Error("No recipe cards loaded.");
    if (initial.overflow > 1) {
      throw new Error(`The Android home page overflows horizontally by ${initial.overflow}px.`);
    }
    if (expectedRelease && !initial.userAgent.includes(`Android ${expectedRelease}`)) {
      throw new Error(
        `Unexpected Android release for API ${expectedApi}: ${initial.userAgent}`,
      );
    }

    let networkCheck = "not requested";
    if (expectedOffline) {
      networkCheck = await evaluate(`Promise.race([
        fetch("https://schema.org/Recipe?offline-smoke=" + Date.now(), { cache: "no-store" })
          .then(function () { return "online"; })
          .catch(function () { return "blocked"; }),
        new Promise(function (resolve) {
          setTimeout(function () { resolve("blocked"); }, 5000);
        })
      ])`);
      if (networkCheck === "online") {
        throw new Error("The emulator still reached the internet during the offline test.");
      }
    }

    const recipeView = await evaluate(`(function () {
      document.querySelector('[data-app-view="recipes"]').click();
      var firstRecipe = document.querySelector(".recipe-card");
      firstRecipe.click();
      var buttonHeights = Array.prototype.map.call(
        document.querySelectorAll("button"),
        function (button) { return Math.round(button.getBoundingClientRect().height); }
      ).filter(function (height) { return height > 0; });
      return {
        activeView: document.body.getAttribute("data-active-view"),
        selectedName: document.querySelector("#recipeName").value,
        ingredientCount: document.querySelectorAll("#ingredientRows .ingredient-row").length,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        minimumButtonHeight: Math.min.apply(Math, buttonHeights)
      };
    })()`);

    if (!recipeView.selectedName) throw new Error("Selecting a recipe did not open its details.");
    if (recipeView.ingredientCount < 1) throw new Error("The selected recipe has no ingredients.");
    if (recipeView.overflow > 1) {
      throw new Error(`The Android recipe view overflows by ${recipeView.overflow}px.`);
    }
    if (recipeView.minimumButtonHeight < 40) {
      throw new Error(`A visible button is only ${recipeView.minimumButtonHeight}px high.`);
    }
    if (expectedLayout === "tablet" && initial.width < 700) {
      throw new Error(`Tablet test opened at only ${initial.width}px CSS width.`);
    }
    if (expectedLayout === "phone" && initial.width >= 700) {
      throw new Error(`Phone test opened at ${initial.width}px CSS width.`);
    }
    if (exceptions.length) {
      throw new Error(`Android WebView exceptions: ${exceptions.join(" | ")}`);
    }

    console.log(JSON.stringify({
      passed: true,
      expectedApi,
      expectedRelease,
      expectedLayout,
      expectedOffline,
      target: { title: target.title, url: target.url },
      initial,
      networkCheck,
      recipeView,
    }, null, 2));
  } finally {
    socket.close();
  }
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
