function sanitizeForLog(value) {
  return String(value).replace(/[\r\n\u2028\u2029]/g, " ");
}

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
  const expectedOffline = process.env.ANDROID_EXPECTED_OFFLINE === "1";
  let onlineSearch = { skipped: true };
  if (process.env.ANDROID_SKIP_ONLINE !== "1") {
    onlineSearch = await evaluate(`(async function () {
      document.querySelector('[data-app-view="recipes"]').click();
      document.querySelector("#onlineRecipeSearch").value = "Arrabiata";
      await searchRecipesByName();
      return {
        status: document.querySelector("#onlineStatus").textContent,
        results: document.querySelectorAll("#onlineResults .online-result").length,
        firstRecipe: document.querySelector("#onlineResults .online-result h3")?.textContent || ""
      };
    })()`);
    if (onlineSearch.results < 1 || !/recipe.*found/i.test(onlineSearch.status)) {
      throw new Error(`Android online recipe search failed: ${JSON.stringify(onlineSearch)}`);
    }
  }
  let offlineSearch = { skipped: true };
  if (expectedOffline) {
    offlineSearch = await evaluate(`(async function () {
      document.querySelector('[data-app-view="recipes"]').click();
      document.querySelector("#onlineRecipeSearch").value = "Arrabiata";
      await searchRecipesByName();
      return {
        status: document.querySelector("#onlineStatus").textContent,
        results: document.querySelectorAll("#onlineResults .online-result").length
      };
    })()`);
    if (offlineSearch.results !== 0 || !/could not reach/i.test(offlineSearch.status)) {
      throw new Error(`Android offline recipe message failed: ${JSON.stringify(offlineSearch)}`);
    }
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

  let photoReview = null;
  const photoPath = process.env.ANDROID_RECIPE_PHOTO;
  if (photoPath) {
    photoReview = await evaluate(`(async function () {
      document.querySelector('[data-app-view="recipes"]').click();
      document.querySelector("#recipeReview").hidden = true;
      var lines = [
        "EASY SALMON DINNER",
        "Serves 2",
        "Prep time: 10 minutes",
        "Cook time: 18 minutes",
        "Temperature: 400 F",
        "",
        "Ingredients",
        "2 salmon fillets",
        "1 tbsp olive oil",
        "1 lemon",
        "1 tsp garlic powder",
        "",
        "Instructions",
        "Heat the oven to 400 F.",
        "Brush salmon with oil and season.",
        "Bake for 18 minutes."
      ];
      var canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 900;
      var context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#101010";
      lines.forEach(function (line, index) {
        var isHeading = index === 0 || line === "Ingredients" || line === "Instructions";
        context.font = (isHeading ? "700 " : "500 ")
          + (index === 0 ? "40px " : "28px ")
          + "Arial, sans-serif";
        context.fillText(line || " ", 65, 75 + index * 46);
      });
      var blob = await new Promise(function (resolve) {
        canvas.toBlob(resolve, "image/png");
      });
      if (!blob) {
        throw new Error("The Android WebView could not create the recipe test image.");
      }
      var file = new File([blob], "sample-recipe.png", { type: "image/png" });
      var input = { files: [file], value: "sample-recipe.png" };
      await reviewRecipeFromFile({ target: input });
      return {
        reviewVisible: !document.querySelector("#recipeReview").hidden,
        name: document.querySelector("#reviewRecipeName").value,
        temperature: document.querySelector("#reviewTemperature").value,
        ingredients: document.querySelectorAll(".review-ingredient-row").length,
        status: document.querySelector("#recipeReadStatus").textContent,
        overflow: document.documentElement.scrollWidth - window.innerWidth
      };
    })()`);
    if (!photoReview.reviewVisible) {
      throw new Error(`Android recipe photo review did not open: ${photoReview.status}`);
    }
    if (!/400/.test(photoReview.temperature)) {
      throw new Error(`Android recipe photo missed the oven temperature: ${JSON.stringify(photoReview)}`);
    }
    if (photoReview.ingredients < 1) throw new Error("Android recipe photo found no ingredients.");
    if (photoReview.overflow > 1) {
      throw new Error(`Android photo review overflows by ${photoReview.overflow}px.`);
    }
  }

  if (exceptions.length) throw new Error(`Android WebView exceptions: ${exceptions.join(" | ")}`);

  console.log(sanitizeForLog(JSON.stringify({
    passed: true,
    title: target.title,
    onlineSearch,
    offlineSearch,
    review,
    saved,
    photoReview
  }, null, 2)));
  socket.close();
}

run().catch((error) => {
  console.error(sanitizeForLog(error.stack || error));
  process.exitCode = 1;
});
