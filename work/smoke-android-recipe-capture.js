async function run() {
  const endpoint = process.env.ANDROID_CDP_URL || "http://127.0.0.1:9223";
  const targets = await fetch(`${endpoint}/json`).then((response) => response.json());
  const target = targets.find((item) => item.type === "page");
  if (!target?.webSocketDebuggerUrl) throw new Error("The Android meal-planner WebView was not found.");

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const exceptions = [];
  let commandId = 0;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") {
      exceptions.push(message.params?.exceptionDetails?.text || "Android WebView exception");
    }
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  function command(method, params = {}) {
    const id = ++commandId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const result = await command("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result?.value;
  }

  await command("Runtime.enable");
  const nativeFetch = await evaluate(`fetch("https://schema.org/Recipe")
    .then(async (response) => {
      const text = await response.text();
      return { ok: response.ok, status: response.status, hasRecipePage: /schema\\.org Type|A recipe/i.test(text) };
    })
    .catch((error) => ({ ok: false, status: 0, error: error.message }))`);
  if (!nativeFetch.ok || !nativeFetch.hasRecipePage) {
    throw new Error(`Android native recipe fetch failed: ${JSON.stringify(nativeFetch)}`);
  }
  const originalCount = await evaluate(`document.querySelectorAll(".recipe-card").length`);
  const review = await evaluate(`(() => {
    document.querySelector('[data-app-view="recipes"]').click();
    const box = document.querySelector("#recipePasteBox");
    box.value = \`Android Baked Cod
Serves 2
Prep time: 10 minutes
Cook time: 15 minutes
Ingredients
2 cod fillets
1 tbsp olive oil
1 lemon
Instructions
Heat oven to 400 F.
Brush the cod with oil and bake for 15 minutes.\`;
    box.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#savePastedRecipe").click();
    return {
      reviewVisible: !document.querySelector("#recipeReview").hidden,
      name: document.querySelector("#reviewRecipeName").value,
      servings: document.querySelector("#reviewRecipeServings").value,
      cookTime: document.querySelector("#reviewCookTime").value,
      temperature: document.querySelector("#reviewTemperature").value,
      ingredients: document.querySelectorAll(".review-ingredient-row").length,
      countBeforeApproval: document.querySelectorAll(".recipe-card").length,
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  })()`);

  if (!review.reviewVisible) throw new Error("The Android recipe review did not open.");
  if (review.name !== "Android Baked Cod") throw new Error(`Unexpected recipe name: ${review.name}`);
  if (review.servings !== "2") throw new Error(`Unexpected servings: ${review.servings}`);
  if (review.cookTime !== "15 minutes") throw new Error(`Unexpected cook time: ${review.cookTime}`);
  if (review.temperature !== "400°F") throw new Error(`Unexpected temperature: ${review.temperature}`);
  if (review.ingredients !== 3) throw new Error(`Unexpected ingredient count: ${review.ingredients}`);
  if (review.countBeforeApproval !== originalCount) throw new Error("Android saved the recipe before approval.");
  if (review.overflow > 1) throw new Error(`Android review overflows horizontally by ${review.overflow}px.`);

  const saved = await evaluate(`(() => {
    document.querySelector("#saveReviewedRecipe").click();
    return {
      name: document.querySelector("#recipeName").value,
      count: document.querySelectorAll(".recipe-card").length,
      reviewHidden: document.querySelector("#recipeReview").hidden,
      status: document.querySelector("#saveStatus").textContent
    };
  })()`);
  if (saved.name !== "Android Baked Cod") throw new Error(`Android editor opened ${saved.name} instead.`);
  if (saved.count !== originalCount + 1) throw new Error("Android did not save the reviewed recipe exactly once.");
  if (!saved.reviewHidden) throw new Error("Android review stayed open after saving.");
  if (exceptions.length) throw new Error(`Android WebView exceptions: ${exceptions.join(" | ")}`);

  console.log(JSON.stringify({
    passed: true,
    title: target.title,
    nativeFetch,
    review,
    saved
  }, null, 2));
  socket.close();
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
