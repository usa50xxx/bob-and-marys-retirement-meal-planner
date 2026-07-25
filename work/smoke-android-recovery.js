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

  async function waitFor(expression, message, timeout = 15000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(message);
  }

  await command("Runtime.enable");
  const original = await evaluate(`(() => {
    document.querySelector('[data-app-view="recipes"]').click();
    return {
      name: document.querySelector("#recipeName").value,
      recoveryLoaded: Boolean(
        window.MealPlannerRecovery
        && typeof window.MealPlannerRecovery.chooseLocalRecovery === "function"
      ),
      native: Boolean(
        window.Capacitor
        && typeof window.Capacitor.isNativePlatform === "function"
        && window.Capacitor.isNativePlatform()
      )
    };
  })()`);
  if (!original.name) throw new Error("The Android app did not open a recipe.");
  if (!original.recoveryLoaded) throw new Error("The Android APK did not include the recovery module.");
  if (!original.native) throw new Error("The Android app did not identify itself as native.");

  await evaluate(`(() => {
    document.querySelector('[data-app-view="home"]').click();
    const panel = document.querySelector("#recoveryPanel");
    panel.open = true;
    document.querySelector("#createBackup").click();
    return true;
  })()`);
  await waitFor(
    `Boolean([...document.querySelectorAll("#backupSelect option")].find((option) => /Manual backup/.test(option.textContent)))`,
    "The Android app did not create a manual backup."
  );

  const changedName = `${original.name} recovery smoke`;
  const backupValue = await evaluate(`([...document.querySelectorAll("#backupSelect option")]
    .find((option) => /Manual backup/.test(option.textContent)) || {}).value || ""`);
  if (!backupValue) throw new Error("The manual backup could not be selected.");

  await evaluate(`(() => {
    document.querySelector('[data-app-view="recipes"]').click();
    const field = document.querySelector("#recipeName");
    field.value = ${JSON.stringify(changedName)};
    field.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
  await waitFor(
    `JSON.parse(localStorage.getItem("thumb-drive-meal-planner-v2")).recipes
      .some((recipe) => recipe.name === ${JSON.stringify(changedName)})`,
    "The Android app did not save the changed recipe."
  );

  await evaluate(`(() => {
    document.querySelector('[data-app-view="home"]').click();
    const panel = document.querySelector("#recoveryPanel");
    panel.open = true;
    document.querySelector("#backupSelect").value = ${JSON.stringify(backupValue)};
    window.confirm = () => true;
    document.querySelector("#restoreBackup").click();
    return true;
  })()`);
  await waitFor(
    `document.querySelector("#recipeName").value === ${JSON.stringify(original.name)}`,
    "The Android app did not restore the selected backup."
  );

  const restored = await evaluate(`(() => ({
    name: document.querySelector("#recipeName").value,
    status: document.querySelector("#recoveryStatus").textContent,
    lastSave: document.querySelector("#lastSaveDetail").textContent,
    backupCount: document.querySelectorAll("#backupSelect option").length,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    buttonHeights: [...document.querySelectorAll(".recovery-panel button")]
      .map((button) => Math.round(button.getBoundingClientRect().height))
  }))()`);
  if (!/Restored Manual backup/i.test(restored.status)) {
    throw new Error(`Android restore status was unclear: ${restored.status}`);
  }
  if (!/this phone/i.test(restored.lastSave)) {
    throw new Error(`Android last-save receipt was unclear: ${restored.lastSave}`);
  }
  if (restored.overflow > 1) {
    throw new Error(`Android recovery view overflows horizontally by ${restored.overflow}px.`);
  }
  if (restored.buttonHeights.some((height) => height < 40)) {
    throw new Error(`Android recovery controls are too small: ${restored.buttonHeights.join(", ")}`);
  }
  if (exceptions.length) throw new Error(`Android WebView exceptions: ${exceptions.join(" | ")}`);

  console.log(sanitizeForLog(JSON.stringify({
    passed: true,
    title: target.title,
    original,
    changedName,
    restored
  }, null, 2)));
  socket.close();
}

run().catch((error) => {
  console.error("Android recovery smoke test failed.");
  process.exitCode = 1;
});
