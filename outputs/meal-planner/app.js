const storageKey = "thumb-drive-meal-planner-v2";
const oldStorageKey = "thumb-drive-meal-planner-v1";
const deviceStorageKey = "bobMaryMealPlannerDeviceMode";
const appViewStorageKey = "bobMaryMealPlannerView";
const cookingStorageKey = "bobMaryMealPlannerCookingSession";
const pendingStorageKey = "bobMaryMealPlannerPendingSave";
const previousStorageKey = "bobMaryMealPlannerPreviousGoodSave";
const backupStorageKey = "bobMaryMealPlannerBackups";
const saveReceiptStorageKey = "bobMaryMealPlannerLastSave";
let saveTimer = null;
let saveStatusTimer = null;
let undoStack = [];
let currentAppView = "home";
let pendingReceiptItems = [];
let editorUndoArmed = true;
let cookingSession = null;
let cookingTimerTicker = null;
let cookingWakeLock = null;
let pendingRecipeDraft = null;
let startupRecoveryMessage = "";
let lastSaveReceipt = null;
let availableBackups = [];

const fallbackRecipes = [
  {
    id: crypto.randomUUID(),
    name: "Lemon Chicken Pasta",
    baseServings: 2,
    notes: "Cook pasta first. Save a splash of pasta water before draining.",
    ingredients: [
      { amount: 2, unit: "chicken breasts", name: "boneless chicken" },
      { amount: 8, unit: "oz", name: "pasta" },
      { amount: 1, unit: "lemon", name: "lemon juice and zest" },
      { amount: 2, unit: "tbsp", name: "olive oil" },
      { amount: 2, unit: "cloves", name: "garlic" },
      { amount: 0.5, unit: "cup", name: "parmesan" }
    ]
  },
  {
    id: crypto.randomUUID(),
    name: "Taco Night",
    baseServings: 2,
    notes: "Set toppings out separately so guests can build their own plates.",
    ingredients: [
      { amount: 0.75, unit: "lb", name: "ground beef or turkey" },
      { amount: 6, unit: "", name: "tortillas" },
      { amount: 1, unit: "packet", name: "taco seasoning" },
      { amount: 1, unit: "cup", name: "shredded lettuce" },
      { amount: 0.5, unit: "cup", name: "shredded cheese" },
      { amount: 0.5, unit: "cup", name: "salsa" }
    ]
  }
];
const sampleRecipes = Array.isArray(globalThis.SUPPERLOOM_STARTER_RECIPES)
  && globalThis.SUPPERLOOM_STARTER_RECIPES.length >= 50
  ? globalThis.SUPPERLOOM_STARTER_RECIPES
  : fallbackRecipes;
const STARTER_CATALOG_VERSION = 1;

let planner;
let recipes;
let foodStorage;
let builderOptions;
let builderStyles;
let builderTemplates;
let mealCostHistory;
let weeklyPlan;
let inventorySettings;
let selectedRecipeId = null;
let visualRecipeIndex = 0;
let lastRecipeSpinAt = 0;
let builderState = { main: "", kind: "", style: "" };
let calendarMonthDate = new Date();

const targetServings = document.querySelector("#targetServings");
const mealDate = document.querySelector("#mealDate");
const minusPerson = document.querySelector("#minusPerson");
const plusPerson = document.querySelector("#plusPerson");
const quickBuildMeal = document.querySelector("#quickBuildMeal");
const quickAddRecipe = document.querySelector("#quickAddRecipe");
const quickShopping = document.querySelector("#quickShopping");
const quickPrint = document.querySelector("#quickPrint");
const viewButtons = document.querySelectorAll("[data-app-view]");
const printViewButton = document.querySelector("[data-print-view]");
const focusedLayout = document.querySelector("#focusedLayout");
const appTabs = document.querySelector(".app-tabs");
const appViewSections = document.querySelectorAll("[data-app-views]");
const undoChange = document.querySelector("#undoChange");
const saveStatus = document.querySelector("#saveStatus");
const lastSaveDetail = document.querySelector("#lastSaveDetail");
const commandTonight = document.querySelector("#commandTonight");
const commandTonightMeta = document.querySelector("#commandTonightMeta");
const commandWeek = document.querySelector("#commandWeek");
const commandWeekMeta = document.querySelector("#commandWeekMeta");
const commandGroceries = document.querySelector("#commandGroceries");
const commandGroceriesMeta = document.querySelector("#commandGroceriesMeta");
const commandSpend = document.querySelector("#commandSpend");
const commandSpendMeta = document.querySelector("#commandSpendMeta");
const foodAiQuestion = document.querySelector("#foodAiQuestion");
const askFoodAi = document.querySelector("#askFoodAi");
const foodAiAnswer = document.querySelector("#foodAiAnswer");
const recipeList = document.querySelector("#recipeList");
const visualRecipeList = document.querySelector("#visualRecipeList");
const recipeForm = document.querySelector("#recipeForm");
const recipeName = document.querySelector("#recipeName");
const baseServings = document.querySelector("#baseServings");
const recipeNotes = document.querySelector("#recipeNotes");
const recipePrepTime = document.querySelector("#recipePrepTime");
const recipeCookTime = document.querySelector("#recipeCookTime");
const recipeTotalTime = document.querySelector("#recipeTotalTime");
const recipeTemperature = document.querySelector("#recipeTemperature");
const recipeSourceUrl = document.querySelector("#recipeSourceUrl");
const recipePhotoPreview = document.querySelector("#recipePhotoPreview");
const recipePhotoInput = document.querySelector("#recipePhotoInput");
const removeRecipePhoto = document.querySelector("#removeRecipePhoto");
const ingredientRows = document.querySelector("#ingredientRows");
const ingredientTemplate = document.querySelector("#ingredientTemplate");
const mealBuilderCard = document.querySelector("#mealBuilderCard");
const builderTrail = document.querySelector("#builderTrail");
const builderQuestion = document.querySelector("#builderQuestion");
const mainChoiceButtons = document.querySelector("#mainChoiceButtons");
const builderPreview = document.querySelector("#builderPreview");
const saveBuiltMeal = document.querySelector("#saveBuiltMeal");
const backBuiltMeal = document.querySelector("#backBuiltMeal");
const resetBuiltMeal = document.querySelector("#resetBuiltMeal");
const builderEditTitle = document.querySelector("#builderEditTitle");
const builderChoiceSelect = document.querySelector("#builderChoiceSelect");
const builderChoiceName = document.querySelector("#builderChoiceName");
const addBuilderChoice = document.querySelector("#addBuilderChoice");
const renameBuilderChoice = document.querySelector("#renameBuilderChoice");
const deleteBuilderChoice = document.querySelector("#deleteBuilderChoice");
const weeklyPlannerCard = document.querySelector("#weeklyPlannerCard");
const weeklyPlanDays = document.querySelector("#weeklyPlanDays");
const weeklyGrocerySummary = document.querySelector("#weeklyGrocerySummary");
const weeklyGroceryGroups = document.querySelector("#weeklyGroceryGroups");
const clearWeeklyPlan = document.querySelector("#clearWeeklyPlan");
const printWeeklyList = document.querySelector("#printWeeklyList");
const copyWeeklyList = document.querySelector("#copyWeeklyList");
const pasteRecipeCard = document.querySelector("#pasteRecipeCard");
const recipeUrlInput = document.querySelector("#recipeUrlInput");
const readRecipeUrl = document.querySelector("#readRecipeUrl");
const recipePasteBox = document.querySelector("#recipePasteBox");
const savePastedRecipe = document.querySelector("#savePastedRecipe");
const recipeFileInput = document.querySelector("#recipeFileInput");
const clearPastedRecipe = document.querySelector("#clearPastedRecipe");
const recipeReadStatus = document.querySelector("#recipeReadStatus");
const recipeReview = document.querySelector("#recipeReview");
const reviewRecipeName = document.querySelector("#reviewRecipeName");
const reviewRecipeServings = document.querySelector("#reviewRecipeServings");
const reviewPrepTime = document.querySelector("#reviewPrepTime");
const reviewCookTime = document.querySelector("#reviewCookTime");
const reviewTotalTime = document.querySelector("#reviewTotalTime");
const reviewTemperature = document.querySelector("#reviewTemperature");
const reviewSourceUrl = document.querySelector("#reviewSourceUrl");
const reviewRecipePhotoBox = document.querySelector("#reviewRecipePhotoBox");
const reviewRecipePhoto = document.querySelector("#reviewRecipePhoto");
const reviewIngredientRows = document.querySelector("#reviewIngredientRows");
const addReviewIngredient = document.querySelector("#addReviewIngredient");
const reviewRecipeNotes = document.querySelector("#reviewRecipeNotes");
const saveReviewedRecipe = document.querySelector("#saveReviewedRecipe");
const cancelRecipeReview = document.querySelector("#cancelRecipeReview");
const addIngredient = document.querySelector("#addIngredient");
const newRecipe = document.querySelector("#newRecipe");
const deleteRecipe = document.querySelector("#deleteRecipe");
const printMeal = document.querySelector("#printMeal");
const scaledList = document.querySelector("#scaledList");
const scaleSummary = document.querySelector("#scaleSummary");
const copyList = document.querySelector("#copyList");
const walmartPaste = document.querySelector("#walmartPaste");
const addWalmartOrder = document.querySelector("#addWalmartOrder");
const groceryFileInput = document.querySelector("#groceryFileInput");
const receiptReadStatus = document.querySelector("#receiptReadStatus");
const receiptReview = document.querySelector("#receiptReview");
const receiptReviewRows = document.querySelector("#receiptReviewRows");
const commitReceiptItems = document.querySelector("#commitReceiptItems");
const cancelReceiptReview = document.querySelector("#cancelReceiptReview");
const clearPantry = document.querySelector("#clearPantry");
const expiryReminderDays = document.querySelector("#expiryReminderDays");
const expirySummary = document.querySelector("#expirySummary");
const useSoonPanel = document.querySelector("#useSoonPanel");
const useSoonList = document.querySelector("#useSoonList");
const suggestUseSoon = document.querySelector("#suggestUseSoon");
const useSoonRecipeResults = document.querySelector("#useSoonRecipeResults");
const refrigeratorList = document.querySelector("#refrigeratorList");
const freezerList = document.querySelector("#freezerList");
const pantryList = document.querySelector("#pantryList");
const needList = document.querySelector("#needList");
const foodSpendSummary = document.querySelector("#foodSpendSummary");
const mealCostSummary = document.querySelector("#mealCostSummary");
const cookAndDeduct = document.querySelector("#cookAndDeduct");
const currentMealCost = document.querySelector("#currentMealCost");
const recordMealCost = document.querySelector("#recordMealCost");
const mealCostHistoryList = document.querySelector("#mealCostHistory");
const calendarSummary = document.querySelector("#calendarSummary");
const previousCalendarMonth = document.querySelector("#previousCalendarMonth");
const nextCalendarMonth = document.querySelector("#nextCalendarMonth");
const mealCostCalendar = document.querySelector("#mealCostCalendar");
const onlineRecipeSearch = document.querySelector("#onlineRecipeSearch");
const pantrySuggestionSelect = document.querySelector("#pantrySuggestionSelect");
const searchOnlineRecipes = document.querySelector("#searchOnlineRecipes");
const suggestFromPantry = document.querySelector("#suggestFromPantry");
const suggestFromStock = document.querySelector("#suggestFromStock");
const onlineStatus = document.querySelector("#onlineStatus");
const onlineResults = document.querySelector("#onlineResults");
const printTitle = document.querySelector("#printTitle");
const printMeta = document.querySelector("#printMeta");
const printIngredients = document.querySelector("#printIngredients");
const printNotes = document.querySelector("#printNotes");
const showcaseSummary = document.querySelector("#showcaseSummary");
const showcaseMealPhoto = document.querySelector("#showcaseMealPhoto");
const showcaseMealName = document.querySelector("#showcaseMealName");
const showcaseIngredients = document.querySelector("#showcaseIngredients");
const showcaseInstructions = document.querySelector("#showcaseInstructions");
const startCooking = document.querySelector("#startCooking");
const cookingMode = document.querySelector("#cookingMode");
const cookingTitle = document.querySelector("#cookingTitle");
const cookingMeta = document.querySelector("#cookingMeta");
const closeCooking = document.querySelector("#closeCooking");
const resetCooking = document.querySelector("#resetCooking");
const cookingIngredientsPanel = document.querySelector(".cooking-ingredients-panel");
const cookingIngredientCount = document.querySelector("#cookingIngredientCount");
const cookingIngredients = document.querySelector("#cookingIngredients");
const cookingStepCount = document.querySelector("#cookingStepCount");
const cookingProgress = document.querySelector("#cookingProgress");
const cookingStepDone = document.querySelector("#cookingStepDone");
const cookingStepText = document.querySelector("#cookingStepText");
const previousCookingStep = document.querySelector("#previousCookingStep");
const nextCookingStep = document.querySelector("#nextCookingStep");
const cookingTimerMinutes = document.querySelector("#cookingTimerMinutes");
const cookingTimerName = document.querySelector("#cookingTimerName");
const startCookingTimer = document.querySelector("#startCookingTimer");
const quickTimerButtons = document.querySelectorAll("[data-quick-timer]");
const cookingTimers = document.querySelector("#cookingTimers");
const cookingWakeStatus = document.querySelector("#cookingWakeStatus");
const cookingSessionStatus = document.querySelector("#cookingSessionStatus");
const finishCooking = document.querySelector("#finishCooking");
const exportData = document.querySelector("#exportData");
const importData = document.querySelector("#importData");
const recoveryPanel = document.querySelector("#recoveryPanel");
const backupSelect = document.querySelector("#backupSelect");
const restoreBackup = document.querySelector("#restoreBackup");
const createBackup = document.querySelector("#createBackup");
const refreshBackups = document.querySelector("#refreshBackups");
const recoveryStatus = document.querySelector("#recoveryStatus");
const deviceModeLinks = document.querySelectorAll("[data-device-mode]");
const deviceModeNote = document.querySelector("#deviceModeNote");
const devicePrompt = document.querySelector("#devicePrompt");
const devicePromptDismiss = document.querySelector("#devicePromptDismiss");
const devicePromptChoices = document.querySelectorAll("[data-device-choice]");

initDeviceMode();
mealDate.valueAsDate = new Date();

targetServings.addEventListener("input", renderMealViews);
mealDate.addEventListener("input", renderPrintSheet);
minusPerson.addEventListener("click", () => changePeople(-1));
plusPerson.addEventListener("click", () => changePeople(1));
quickBuildMeal.addEventListener("click", () => {
  setAppView("plan");
  focusSection(weeklyPlannerCard);
});
quickAddRecipe.addEventListener("click", () => {
  setAppView("recipes");
  focusSection(recipeForm);
});
quickShopping.addEventListener("click", () => {
  setAppView("groceries");
  focusSection(walmartPaste.closest(".pantry-card"), walmartPaste);
});
quickPrint.addEventListener("click", printSelectedMeal);
viewButtons.forEach((button) => button.addEventListener("click", () => setAppView(button.dataset.appView)));
printViewButton.addEventListener("click", printSelectedMeal);
undoChange.addEventListener("click", undoLastChange);
addIngredient.addEventListener("click", () => {
  captureEditorUndoOnce();
  addIngredientRow();
});
saveBuiltMeal.addEventListener("click", saveBuilderMeal);
backBuiltMeal.addEventListener("click", goBackBuilder);
resetBuiltMeal.addEventListener("click", resetBuilder);
addBuilderChoice.addEventListener("click", addCurrentBuilderChoice);
renameBuilderChoice.addEventListener("click", renameCurrentBuilderChoice);
deleteBuilderChoice.addEventListener("click", deleteCurrentBuilderChoice);
clearWeeklyPlan.addEventListener("click", clearWeekPlan);
printWeeklyList.addEventListener("click", printWeeklyGroceryList);
copyWeeklyList.addEventListener("click", copyWeeklyGroceryList);
askFoodAi.addEventListener("click", answerFoodAi);
foodAiQuestion.addEventListener("keydown", (event) => {
  if (event.key === "Enter") answerFoodAi();
});
savePastedRecipe.addEventListener("click", reviewRecipeFromPaste);
readRecipeUrl.addEventListener("click", reviewRecipeFromUrl);
recipeUrlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") reviewRecipeFromUrl();
});
recipeFileInput.addEventListener("change", reviewRecipeFromFile);
addReviewIngredient.addEventListener("click", () => addReviewIngredientRow());
saveReviewedRecipe.addEventListener("click", commitReviewedRecipe);
cancelRecipeReview.addEventListener("click", clearRecipeReview);
clearPastedRecipe.addEventListener("click", () => {
  recipePasteBox.value = "";
  recipePasteBox.focus();
});
newRecipe.addEventListener("click", createRecipe);
deleteRecipe.addEventListener("click", deleteSelectedRecipe);
recipeForm.addEventListener("submit", saveSelectedRecipe);
printMeal.addEventListener("click", printSelectedMeal);
startCooking.addEventListener("click", openCookingMode);
closeCooking.addEventListener("click", closeCookingMode);
resetCooking.addEventListener("click", resetCookingProgress);
previousCookingStep.addEventListener("click", () => changeCookingStep(-1));
nextCookingStep.addEventListener("click", () => changeCookingStep(1));
cookingStepDone.addEventListener("change", updateCookingStepCompletion);
cookingIngredients.addEventListener("change", updateCookingIngredientCompletion);
startCookingTimer.addEventListener("click", () => addCookingTimer());
quickTimerButtons.forEach((button) => {
  button.addEventListener("click", () => addCookingTimer(cleanNumber(button.dataset.quickTimer, 5)));
});
cookingTimers.addEventListener("click", handleCookingTimerAction);
finishCooking.addEventListener("click", finishCookingSession);
cookingMode.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeCookingMode();
});
document.addEventListener("visibilitychange", handleCookingVisibilityChange);
recordMealCost.addEventListener("click", recordSelectedMealCost);
previousCalendarMonth.addEventListener("click", () => changeCalendarMonth(-1));
nextCalendarMonth.addEventListener("click", () => changeCalendarMonth(1));
recipePhotoInput.addEventListener("change", addRecipePhoto);
removeRecipePhoto.addEventListener("click", clearRecipePhoto);
copyList.addEventListener("click", copyScaledIngredients);
addWalmartOrder.addEventListener("click", addWalmartOrderToPantry);
groceryFileInput.addEventListener("change", importGroceryFile);
commitReceiptItems.addEventListener("click", addReviewedReceiptItems);
cancelReceiptReview.addEventListener("click", clearReceiptReview);
clearPantry.addEventListener("click", clearPantryTally);
expiryReminderDays.addEventListener("change", updateExpiryReminder);
suggestUseSoon.addEventListener("click", renderUseSoonRecipeIdeas);
cookAndDeduct.addEventListener("click", cookSelectedMeal);
searchOnlineRecipes.addEventListener("click", searchRecipesByName);
suggestFromPantry.addEventListener("click", suggestRecipesFromPantry);
suggestFromStock.addEventListener("click", suggestRecipesFromStock);
exportData.addEventListener("click", exportRecipes);
importData.addEventListener("change", importRecipes);
recoveryPanel.addEventListener("toggle", () => {
  if (recoveryPanel.open) loadBackupChoices();
});
restoreBackup.addEventListener("click", restoreSelectedBackup);
createBackup.addEventListener("click", createRecoveryBackup);
refreshBackups.addEventListener("click", loadBackupChoices);
deviceModeLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setDeviceMode(link.dataset.deviceMode, { persist: true, updateUrl: true, announce: true });
  });
});
devicePromptChoices.forEach((button) => {
  button.addEventListener("click", () => setDeviceMode(button.dataset.deviceChoice, { persist: true, updateUrl: true, announce: true, hidePrompt: true }));
});
devicePromptDismiss.addEventListener("click", () => setDeviceMode("computer", { persist: true, updateUrl: false, announce: true, hidePrompt: true }));
[recipeName, baseServings, recipeNotes, recipePrepTime, recipeCookTime, recipeTotalTime, recipeTemperature, recipeSourceUrl].forEach((field) => {
  field.addEventListener("input", () => {
    captureEditorUndoOnce();
    saveCurrentFieldsQuietly();
    renderRecipeList();
    renderWeeklyPlanner();
    renderWeeklyGroceryList();
    renderMealViews();
  });
});

function loadPlanner() {
  const saved = localStorage.getItem(storageKey);
  const pending = localStorage.getItem(pendingStorageKey);
  const previous = localStorage.getItem(previousStorageKey);
  const recovery = MealPlannerRecovery.chooseLocalRecovery({ current: saved, pending, previous });
  if (recovery.data) {
    if (recovery.recovered) {
      startupRecoveryMessage = recovery.message;
      try {
        if (MealPlannerRecovery.parsePlanner(saved)) localStorage.setItem(previousStorageKey, saved);
        localStorage.setItem(storageKey, JSON.stringify(recovery.data));
      } catch {
        startupRecoveryMessage += " Keep the app open and export a backup.";
      }
    }
    localStorage.removeItem(pendingStorageKey);
    return plannerDataFromSource(recovery.data);
  }
  if (recovery.message) startupRecoveryMessage = recovery.message;

  try {
    const oldRecipes = JSON.parse(localStorage.getItem(oldStorageKey));
    return {
      recipes: mergeStarterRecipes(oldRecipes),
      foodStorage: normalizeFoodStorage(),
      builderOptions: normalizeBuilderOptions(),
      builderStyles: normalizeBuilderStyles(),
      builderTemplates: {},
      mealCostHistory: [],
      weeklyPlan: normalizeWeeklyPlan(),
      inventorySettings: normalizeInventorySettings(),
      starterCatalogVersion: STARTER_CATALOG_VERSION,
      starterCatalogMigrated: true
    };
  } catch {
    return defaultPlannerData();
  }
}

function plannerDataFromSource(parsed) {
  const starterCatalogMigrated = Number(parsed.starterCatalogVersion || 0) < STARTER_CATALOG_VERSION;
  return {
    recipes: starterCatalogMigrated ? mergeStarterRecipes(parsed.recipes) : normalizeRecipes(parsed.recipes),
    foodStorage: normalizeFoodStorage(parsed.foodStorage || parsed.pantry),
    builderOptions: normalizeBuilderOptions(parsed.builderOptions),
    builderStyles: normalizeBuilderStyles(parsed.builderStyles),
    builderTemplates: normalizeBuilderTemplates(parsed.builderTemplates),
    mealCostHistory: normalizeMealCostHistory(parsed.mealCostHistory),
    weeklyPlan: normalizeWeeklyPlan(parsed.weeklyPlan),
    inventorySettings: normalizeInventorySettings(parsed.inventorySettings),
    starterCatalogVersion: STARTER_CATALOG_VERSION,
    starterCatalogMigrated,
    savedAt: String(parsed.savedAt || "")
  };
}

function initDeviceMode() {
  if (isNativeApp()) {
    setDeviceMode("android", { persist: true, updateUrl: false, announce: false, hidePrompt: true });
    return;
  }
  const queryMode = normalizedDeviceMode(new URLSearchParams(window.location.search).get("device"));
  const savedMode = normalizedDeviceMode(localStorage.getItem(deviceStorageKey));
  const detectedMode = detectDeviceMode();
  const mode = queryMode || savedMode || detectedMode || "computer";
  setDeviceMode(mode, { persist: Boolean(queryMode), updateUrl: false, announce: false, hidePrompt: false });

  if (!queryMode && !savedMode) {
    devicePrompt.hidden = false;
    devicePrompt.querySelector("button")?.focus();
  }
}

function setDeviceMode(mode, options = {}) {
  const nextMode = normalizedDeviceMode(mode) || "computer";
  document.body.dataset.deviceMode = nextMode;
  document.body.classList.toggle("phone-layout", nextMode === "iphone" || nextMode === "android");
  document.body.classList.toggle("iphone-layout", nextMode === "iphone");
  document.body.classList.toggle("android-layout", nextMode === "android");

  deviceModeLinks.forEach((link) => {
    const active = link.dataset.deviceMode === nextMode;
    link.classList.toggle("active", active);
    link.setAttribute("aria-current", active ? "true" : "false");
  });

  if (deviceModeNote) {
    const notes = {
      computer: "Computer view is selected.",
      iphone: "iPhone view is selected. Start the phone starter on the computer first.",
      android: isNativeApp()
        ? "Android app is selected. Your meal planner is saved on this phone."
        : "Android view is selected. Start the phone starter on the computer first."
    };
    deviceModeNote.textContent = notes[nextMode];
  }

  if (options.persist) {
    localStorage.setItem(deviceStorageKey, nextMode);
  }

  if (options.updateUrl) {
    const url = new URL(window.location.href);
    url.pathname = url.pathname.replace(/(iphone|android)\.html$/i, "index.html");
    url.searchParams.set("device", nextMode);
    window.history.replaceState({}, "", url);
  }

  if (options.hidePrompt) {
    devicePrompt.hidden = true;
  }

  if (options.announce && deviceModeNote) {
    deviceModeNote.animate([{ opacity: 0.45 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
  }
}

function normalizedDeviceMode(value) {
  const mode = String(value || "").toLowerCase();
  return ["computer", "iphone", "android"].includes(mode) ? mode : "";
}

function detectDeviceMode() {
  const agent = navigator.userAgent || "";
  const isIpad = /Macintosh/i.test(agent) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(agent) || isIpad) return "iphone";
  if (/Android/i.test(agent)) return "android";
  return "";
}

function setAppView(view, options = {}) {
  const validViews = ["home", "plan", "recipes", "groceries", "inventory", "spending"];
  currentAppView = validViews.includes(view) ? view : "home";
  const showFocusedLayout = currentAppView !== "home";
  focusedLayout.hidden = !showFocusedLayout;

  appViewSections.forEach((section) => {
    const views = String(section.dataset.appViews || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    section.hidden = !views.includes(currentAppView);
  });

  const recipeSidebarVisible = currentAppView === "recipes";
  focusedLayout.classList.toggle("single-pane", showFocusedLayout && !recipeSidebarVisible);
  viewButtons.forEach((button) => {
    const active = button.dataset.appView === currentAppView;
    button.setAttribute("aria-current", active ? "page" : "false");
  });

  if (options.persist !== false) {
    localStorage.setItem(appViewStorageKey, currentAppView);
  }
  if (options.focus !== false) {
    if (document.body.classList.contains("phone-layout")) {
      const layoutTop = focusedLayout.getBoundingClientRect().top + window.scrollY;
      const tabsHeight = appTabs?.getBoundingClientRect().height || 0;
      window.scrollTo({ top: Math.max(0, layoutTop - tabsHeight - 12), behavior: "smooth" });
    } else {
      focusedLayout.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

function captureUndo(label) {
  const snapshot = JSON.stringify({
    data: currentPlannerData(),
    selectedRecipeId,
    appView: currentAppView
  });
  if (undoStack[undoStack.length - 1]?.snapshot === snapshot) return;
  undoStack.push({ label, snapshot });
  undoStack = undoStack.slice(-20);
  undoChange.disabled = false;
  undoChange.textContent = `Undo ${label}`;
}

function captureEditorUndoOnce() {
  if (!editorUndoArmed) return;
  captureUndo("recipe edit");
  editorUndoArmed = false;
}

function undoLastChange() {
  const entry = undoStack.pop();
  if (!entry) return;
  const restored = JSON.parse(entry.snapshot);
  applyPlannerData(restored.data);
  selectedRecipeId = recipes.some((recipe) => recipe.id === restored.selectedRecipeId)
    ? restored.selectedRecipeId
    : recipes[0]?.id || null;
  editorUndoArmed = true;
  persistRecipes();
  render();
  setAppView(restored.appView || "home", { focus: false });
  undoChange.disabled = undoStack.length === 0;
  undoChange.textContent = undoStack.length ? `Undo ${undoStack[undoStack.length - 1].label}` : "Undo";
  setSaveStatus(`Undid ${entry.label}`);
}

function applyPlannerData(data) {
  const source = data && typeof data === "object" ? data : {};
  const starterCatalogMigrated = Number(source.starterCatalogVersion || 0) < STARTER_CATALOG_VERSION;
  recipes = starterCatalogMigrated ? mergeStarterRecipes(source.recipes) : normalizeRecipes(source.recipes);
  foodStorage = normalizeFoodStorage(source.foodStorage || source.pantry);
  builderOptions = normalizeBuilderOptions(source.builderOptions);
  builderStyles = normalizeBuilderStyles(source.builderStyles);
  builderTemplates = normalizeBuilderTemplates(source.builderTemplates);
  mealCostHistory = normalizeMealCostHistory(source.mealCostHistory);
  weeklyPlan = normalizeWeeklyPlan(source.weeklyPlan);
  inventorySettings = normalizeInventorySettings(source.inventorySettings);
  return starterCatalogMigrated;
}

function setSaveStatus(message, resetAfter = 0) {
  clearTimeout(saveStatusTimer);
  saveStatus.textContent = message;
  if (resetAfter > 0) {
    saveStatusTimer = setTimeout(() => {
      saveStatus.textContent = lastSaveReceipt
        ? `Saved to ${lastSaveReceipt.destination}`
        : "Saved on this device";
    }, resetAfter);
  }
}

function loadSaveReceipt() {
  try {
    const parsed = JSON.parse(localStorage.getItem(saveReceiptStorageKey));
    if (parsed?.at && parsed?.destination) return parsed;
  } catch {}
  return null;
}

function recordSuccessfulSave(destination, at = new Date().toISOString()) {
  const timestamp = Number.isFinite(Date.parse(at)) ? at : new Date().toISOString();
  lastSaveReceipt = { destination, at: timestamp };
  try {
    localStorage.setItem(saveReceiptStorageKey, JSON.stringify(lastSaveReceipt));
  } catch {}
  renderLastSaveDetail();
}

function renderLastSaveDetail() {
  if (!lastSaveReceipt) {
    lastSaveDetail.textContent = "No confirmed save yet";
    return;
  }
  const date = new Date(lastSaveReceipt.at);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const day = sameDay ? "today" : date.toLocaleDateString();
  lastSaveDetail.textContent = `Last confirmed ${day} at ${time} on ${lastSaveReceipt.destination}`;
}

function isNativeApp() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

function persistRecipes() {
  const data = currentPlannerData();
  setSaveStatus("Saving...");
  let localSaved = false;
  try {
    writePlannerLocally(data);
    localSaved = true;
    recordSuccessfulSave(isNativeApp() ? "this phone" : "this browser", data.savedAt);
  } catch {
    setSaveStatus("Local save needs attention");
  }
  if (isNativeApp()) {
    if (localSaved) setSaveStatus("Saved on this phone");
    return;
  }
  setSaveStatus(localSaved ? "Saved in browser; saving to thumb drive..." : "Saving to thumb drive...");
  scheduleDriveSave(data);
}

function writePlannerLocally(data, options = {}) {
  const serialized = typeof data === "string" ? data : JSON.stringify(data);
  if (!MealPlannerRecovery.parsePlanner(serialized)) throw new Error("Invalid planner data");
  const current = localStorage.getItem(storageKey);
  if (options.keepPrevious !== false && current && current !== serialized && MealPlannerRecovery.parsePlanner(current)) {
    localStorage.setItem(previousStorageKey, current);
  }
  localStorage.setItem(pendingStorageKey, serialized);
  localStorage.setItem(storageKey, serialized);
  localStorage.removeItem(pendingStorageKey);
}

function currentPlannerData() {
  return {
    schemaVersion: 5,
    starterCatalogVersion: STARTER_CATALOG_VERSION,
    recipes,
    foodStorage,
    builderOptions,
    builderStyles,
    builderTemplates,
    mealCostHistory,
    weeklyPlan,
    inventorySettings,
    savedAt: new Date().toISOString()
  };
}

function scheduleDriveSave(data) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveToDrive(data), 250);
}

async function saveToDrive(data = currentPlannerData()) {
  try {
    const response = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: asciiJson(data)
    });
    if (!response.ok) throw new Error("Drive save failed");
    const result = await response.json().catch(() => ({}));
    recordSuccessfulSave("the thumb drive", result.savedAt || data.savedAt);
    setSaveStatus("Saved to thumb drive");
    if (recoveryPanel.open) loadBackupChoices({ quiet: true });
  } catch {
    setSaveStatus("Saved in this browser only");
  }
}

function asciiJson(value) {
  return JSON.stringify(value, null, 2).replace(/[\u007f-\uffff]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
  );
}

async function loadDriveData() {
  if (isNativeApp()) {
    if (startupRecoveryMessage) {
      setSaveStatus(startupRecoveryMessage);
      recoveryStatus.textContent = startupRecoveryMessage;
      recoveryPanel.open = true;
    } else {
      setSaveStatus("Saved on this phone");
    }
    return;
  }
  try {
    const response = await fetch(`/api/data?time=${Date.now()}`);
    if (!response.ok) return;

    const data = await response.json();
    if (!data || !Array.isArray(data.recipes) || !data.recipes.length) return;

    const starterCatalogMigrated = applyPlannerData(data);
    selectedRecipeId = recipes[0]?.id || null;
    const currentData = currentPlannerData();
    writePlannerLocally(currentData);
    recordSuccessfulSave("the thumb drive", data.savedAt || new Date().toISOString());
    render();
    setAppView(currentAppView, { focus: false, persist: false });
    if (response.headers.get("X-Meal-Planner-Recovered") === "true") {
      startupRecoveryMessage = "The thumb drive recovered its newest good automatic backup.";
      setSaveStatus(startupRecoveryMessage);
      recoveryStatus.textContent = startupRecoveryMessage;
      recoveryPanel.open = true;
    } else if (startupRecoveryMessage) {
      setSaveStatus(startupRecoveryMessage);
      recoveryStatus.textContent = startupRecoveryMessage;
      recoveryPanel.open = true;
    } else {
      setSaveStatus("Loaded from thumb drive");
    }
    if (starterCatalogMigrated) scheduleDriveSave(currentData);
  } catch {
    setSaveStatus(isNativeApp() ? "Saved on this phone" : "Saved in this browser only");
  }
}

function normalizeFoodStorage(saved) {
  if (saved && Array.isArray(saved.refrigerator) && Array.isArray(saved.pantry)) {
    return {
      refrigerator: saved.refrigerator.map(normalizeFoodItem),
      freezer: Array.isArray(saved.freezer) ? saved.freezer.map(normalizeFoodItem) : [],
      pantry: saved.pantry.map(normalizeFoodItem)
    };
  }

  if (Array.isArray(saved)) {
    return {
      refrigerator: [],
      freezer: [],
      pantry: saved.map(normalizeFoodItem)
    };
  }

  return {
    refrigerator: [],
    freezer: [],
    pantry: []
  };
}

function normalizeFoodItem(item) {
  return {
    id: item.id || crypto.randomUUID(),
    amount: cleanNumber(item.amount, 1),
    unit: item.unit || "item",
    name: item.name || "Unknown item",
    price: cleanNumber(item.price, 0),
    itemNumber: item.itemNumber || "",
    store: item.store || "",
    bestBy: MealPlannerFood.normalizeDateValue(item.bestBy || item.expirationDate || item.expires)
  };
}

function normalizeInventorySettings(saved) {
  const value = Number(saved?.reminderDays);
  return {
    reminderDays: [0, 3, 7, 14].includes(value) ? value : 7
  };
}

function defaultPlannerData() {
  return {
    recipes: normalizeRecipes(sampleRecipes),
    foodStorage: normalizeFoodStorage(),
    builderOptions: normalizeBuilderOptions(),
    builderStyles: normalizeBuilderStyles(),
    builderTemplates: {},
    mealCostHistory: [],
    weeklyPlan: normalizeWeeklyPlan(),
    inventorySettings: normalizeInventorySettings(),
    starterCatalogVersion: STARTER_CATALOG_VERSION
  };
}

function mergeStarterRecipes(saved) {
  const existing = normalizeRecipes(saved);
  const existingNames = new Set(existing.map((recipe) => recipe.name.trim().toLowerCase()));
  const missing = sampleRecipes
    .filter((recipe) => !existingNames.has(String(recipe.name || "").trim().toLowerCase()))
    .map(normalizeRecipe);
  return [...existing, ...missing];
}

function normalizeRecipes(saved) {
  const source = Array.isArray(saved) && saved.length ? saved : sampleRecipes;
  return source.map(normalizeRecipe);
}

function normalizeRecipe(recipe) {
  const source = recipe && typeof recipe === "object" ? recipe : {};
  return {
    id: source.id || crypto.randomUUID(),
    name: String(source.name || "Imported recipe"),
    baseServings: cleanNumber(source.baseServings, 1),
    prepTime: String(source.prepTime || ""),
    cookTime: String(source.cookTime || ""),
    totalTime: String(source.totalTime || ""),
    temperature: String(source.temperature || ""),
    sourceUrl: String(source.sourceUrl || ""),
    notes: String(source.notes || ""),
    photo: String(source.photo || ""),
    ingredients: Array.isArray(source.ingredients)
      ? source.ingredients.map((ingredient) => ({
        amount: Math.max(0, Number(ingredient?.amount) || 0),
        unit: String(ingredient?.unit || ""),
        name: String(ingredient?.name || "")
      }))
      : []
  };
}

function normalizeMealCostHistory(saved) {
  if (!Array.isArray(saved)) return [];

  return saved.map((entry) => ({
    id: entry.id || crypto.randomUUID(),
    recipeId: entry.recipeId || "",
    recipeName: entry.recipeName || "Meal",
    people: cleanNumber(entry.people, 1),
    cost: cleanNumber(entry.cost, 0),
    date: entry.date || new Date().toISOString(),
    items: Array.isArray(entry.items) ? entry.items : []
  }));
}

function normalizeWeeklyPlan(saved) {
  const days = weekDayKeys();
  const plan = {};
  days.forEach((day) => {
    const entry = saved && typeof saved === "object" ? saved[day.key] : null;
    plan[day.key] = {
      recipeId: entry?.recipeId || "",
      servings: cleanNumber(entry?.servings, cleanNumber(targetServings?.value, 2))
    };
  });
  return plan;
}

function normalizeBuilderOptions(saved) {
  const source = saved && typeof saved === "object" ? saved : {};
  const normalized = {};

  Object.entries(defaultBuilderOptions).forEach(([mainKey, main]) => {
    normalized[mainKey] = { label: main.label, kinds: { ...main.kinds } };
  });

  Object.entries(source).forEach(([mainKey, main]) => {
    let label = main?.label || normalized[mainKey]?.label || titleFromKey(mainKey);
    if (mainKey === "fish" && label === "Fish") label = "Seafood";
    if (mainKey === "vegetarian" && label === "Vegetarian") label = "Salads";
    const savedKinds = main?.kinds && typeof main.kinds === "object" ? main.kinds : {};
    if (mainKey === "vegetarian") {
      ["pasta", "beans", "stirfry", "soup"].forEach((oldKey) => delete savedKinds[oldKey]);
    }
    const starterKinds = normalized[mainKey]?.kinds || {};
    normalized[mainKey] = { label, kinds: { ...starterKinds, ...savedKinds } };
  });

  if (!Object.keys(normalized).length) {
    return cloneDefaultBuilderOptions();
  }

  return normalized;
}

function cloneDefaultBuilderOptions() {
  return JSON.parse(JSON.stringify(defaultBuilderOptions));
}

function normalizeBuilderStyles(saved) {
  return saved && typeof saved === "object" && Object.keys(saved).length ? { ...saved } : { ...defaultBuilderStyles };
}

function normalizeBuilderTemplates(saved) {
  return saved && typeof saved === "object" ? saved : {};
}

function titleFromKey(key) {
  return String(key)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function selectedRecipe() {
  return recipes.find((recipe) => recipe.id === selectedRecipeId) || recipes[0];
}

function render() {
  renderCommandCenter();
  renderWeeklyPlanner();
  renderWeeklyGroceryList();
  renderMealBuilder();
  renderRecipeList();
  renderVisualRecipeList();
  renderEditor();
  renderMealViews();
  enableLazyImages();
}

function enableLazyImages() {
  document.querySelectorAll("img").forEach((image) => {
    image.loading = "lazy";
    image.decoding = "async";
  });
}

const defaultBuilderOptions = {
  beef: {
    label: "Beef",
    kinds: {
      hamburger: "Hamburgers",
      ribeye: "Ribeye steak",
      sirloin: "Sirloin steak",
      t_bone_steak: "T-bone steak",
      porterhouse: "Porterhouse steak",
      filet_mignon: "Filet mignon",
      new_york_strip: "New York strip",
      flank_steak: "Flank steak",
      skirt_steak: "Skirt steak",
      hanger_steak: "Hanger steak",
      short_ribs: "Short ribs",
      beef_ribs: "Beef ribs",
      beef_shank: "Beef shank",
      top_round: "Top round",
      bottom_round: "Bottom round",
      steak: "Steak",
      prime_rib_roast: "Prime rib roast",
      roast: "Beef roast",
      pot_roast: "Pot roast",
      chuck_roast: "Chuck roast",
      brisket: "Brisket",
      stew_meat: "Stew meat",
      meatloaf: "Meatloaf"
    }
  },
  chicken: {
    label: "Chicken",
    kinds: {
      breast: "Chicken breast",
      thighs: "Chicken thighs",
      whole_chicken: "Whole chicken",
      leg_quarters: "Chicken leg quarters",
      half: "Half chicken",
      cutlets: "Chicken cutlets",
      tenders: "Chicken tenders",
      ground_chicken: "Ground chicken",
      drumsticks: "Drumsticks",
      wings: "Chicken wings"
    }
  },
  pork: {
    label: "Pork",
    kinds: {
      chops: "Pork chops",
      roast: "Pork roast",
      tenderloin: "Pork tenderloin",
      pork_butt: "Pork butt",
      pork_shoulder: "Pork shoulder",
      pork_loin: "Pork loin",
      pork_belly: "Pork belly",
      ribs: "Pork ribs",
      baby_back_ribs: "Baby back ribs",
      spare_ribs: "Spare ribs",
      ground_pork: "Ground pork",
      sausage: "Sausage",
      bacon: "Bacon",
      ham: "Ham"
    }
  },
  fish: {
    label: "Seafood",
    kinds: {
      salmon: "Salmon",
      salmon_fillets: "Salmon fillets",
      cod: "Cod",
      haddock: "Haddock",
      halibut: "Halibut",
      flounder: "Flounder",
      catfish: "Catfish",
      trout: "Trout",
      shrimp: "Shrimp",
      jumbo_shrimp: "Jumbo shrimp",
      tuna: "Tuna steaks",
      crab_cakes: "Crab cakes",
      scallops: "Scallops",
      tilapia: "Tilapia",
      lobster: "Lobster",
      mussels: "Mussels",
      clams: "Clams",
      fish_fillets: "Fish fillets"
    }
  },
  vegetarian: {
    label: "Salads",
    kinds: {
      garden_salad: "Garden salad",
      chef_salad: "Chef salad",
      chicken_salad: "Chicken salad",
      tuna_salad: "Tuna salad",
      pasta_salad: "Pasta salad"
    }
  }
};

const defaultBuilderStyles = {
  skillet: "Skillet",
  oven: "Oven baked",
  grill: "Grill",
  slow: "Slow cooker",
  soup: "Soup or stew"
};

planner = loadPlanner();
recipes = planner.recipes;
foodStorage = planner.foodStorage;
builderOptions = planner.builderOptions;
builderStyles = planner.builderStyles;
builderTemplates = planner.builderTemplates;
mealCostHistory = planner.mealCostHistory;
weeklyPlan = planner.weeklyPlan;
inventorySettings = planner.inventorySettings;
selectedRecipeId = recipes[0]?.id || null;
cookingSession = loadCookingSession();
lastSaveReceipt = loadSaveReceipt();
if (!lastSaveReceipt && planner.savedAt) {
  lastSaveReceipt = {
    destination: isNativeApp() ? "this phone" : "this browser",
    at: planner.savedAt
  };
}
updateCookingTimers();
if (planner.starterCatalogMigrated) {
  writePlannerLocally(currentPlannerData(), { keepPrevious: true });
}

render();
renderLastSaveDetail();
setAppView("home", { focus: false, persist: false });
loadDriveData();

function weekDayKeys() {
  return [
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" }
  ];
}

function renderCommandCenter() {
  const recipe = selectedRecipe();
  const estimate = estimateSelectedMealCost();
  const planned = weeklyPlanEntries();
  const weeklyItems = weeklyGroceryItems();
  const totalRecorded = mealCostHistory.reduce((sum, entry) => sum + cleanNumber(entry.cost, 0), 0);

  commandTonight.textContent = recipe ? recipe.name : "Pick a meal";
  commandTonightMeta.textContent = recipe
    ? `${cleanNumber(targetServings.value, 2)} people${estimate.cost ? ` | about ${formatMoney(estimate.cost)}` : ""}`
    : "Choose servings, date, and recipe.";
  commandWeek.textContent = `${planned.length} meal${planned.length === 1 ? "" : "s"} planned`;
  commandWeekMeta.textContent = planned.length ? planned.map((entry) => entry.day.label).join(", ") : "Use the weekly planner below.";
  commandGroceries.textContent = weeklyItems.length ? `${weeklyItems.length} item${weeklyItems.length === 1 ? "" : "s"}` : "No weekly list yet";
  commandGroceriesMeta.textContent = weeklyItems.length ? "Combined from the week." : "It builds as you plan meals.";
  commandSpend.textContent = formatMoney(totalRecorded);
  commandSpendMeta.textContent = `${mealCostHistory.length} recorded meal${mealCostHistory.length === 1 ? "" : "s"}.`;
}

function renderWeeklyPlanner() {
  weeklyPlanDays.innerHTML = "";

  weekDayKeys().forEach((day) => {
    const entry = weeklyPlan[day.key] || { recipeId: "", servings: cleanNumber(targetServings.value, 2) };
    const card = document.createElement("article");
    card.className = "weekly-day";
    card.innerHTML = `
      <div>
        <strong>${day.label}</strong>
        <small>${entry.recipeId ? escapeHtml(recipeById(entry.recipeId)?.name || "Recipe missing") : "No meal picked"}</small>
      </div>
      <label>
        Meal
        <select data-week-recipe="${day.key}">
          <option value="">Choose a recipe</option>
          ${recipes.filter(isRecipeComplete).map((recipe) => `<option value="${escapeHtml(recipe.id)}" ${recipe.id === entry.recipeId ? "selected" : ""}>${escapeHtml(recipe.name)}</option>`).join("")}
        </select>
      </label>
      <label>
        People
        <input type="number" min="1" step="1" value="${cleanNumber(entry.servings, cleanNumber(targetServings.value, 2))}" data-week-servings="${day.key}" />
      </label>
      <div class="weekly-day-actions">
        <button type="button" data-week-view="${day.key}">View</button>
        <button type="button" data-week-today="${day.key}">Make today</button>
      </div>
    `;
    weeklyPlanDays.appendChild(card);
  });

  weeklyPlanDays.querySelectorAll("[data-week-recipe]").forEach((select) => {
    select.addEventListener("change", () => updateWeeklyPlan(select.dataset.weekRecipe, { recipeId: select.value }));
  });
  weeklyPlanDays.querySelectorAll("[data-week-servings]").forEach((input) => {
    input.addEventListener("input", () => updateWeeklyPlan(input.dataset.weekServings, { servings: cleanNumber(input.value, 2) }));
  });
  weeklyPlanDays.querySelectorAll("[data-week-view]").forEach((button) => {
    button.addEventListener("click", () => viewWeeklyRecipe(button.dataset.weekView, false));
  });
  weeklyPlanDays.querySelectorAll("[data-week-today]").forEach((button) => {
    button.addEventListener("click", () => viewWeeklyRecipe(button.dataset.weekToday, true));
  });
}

function updateWeeklyPlan(dayKey, changes) {
  captureUndo("weekly plan change");
  weeklyPlan[dayKey] = { ...(weeklyPlan[dayKey] || { recipeId: "", servings: 2 }), ...changes };
  persistRecipes();
  renderCommandCenter();
  renderWeeklyPlanner();
  renderWeeklyGroceryList();
}

function viewWeeklyRecipe(dayKey, makeToday) {
  const entry = weeklyPlan[dayKey];
  if (!entry?.recipeId) return;
  selectedRecipeId = entry.recipeId;
  editorUndoArmed = true;
  targetServings.value = cleanNumber(entry.servings, 2);
  if (makeToday) mealDate.valueAsDate = new Date();
  render();
  setAppView("recipes", { focus: false });
  focusSection(document.querySelector(".recipe-showcase"));
}

function clearWeekPlan() {
  if (!weeklyPlanEntries().length) return;
  if (!window.confirm("Clear every meal from this week's plan?")) return;
  captureUndo("clear week");
  weeklyPlan = normalizeWeeklyPlan();
  persistRecipes();
  render();
}

function recipeById(id) {
  return recipes.find((recipe) => recipe.id === id);
}

function weeklyPlanEntries() {
  return weekDayKeys()
    .map((day) => ({ day, entry: weeklyPlan[day.key], recipe: recipeById(weeklyPlan[day.key]?.recipeId) }))
    .filter((item) => item.recipe && isRecipeComplete(item.recipe));
}

function weeklyGroceryItems() {
  const combined = [];
  weeklyPlanEntries().forEach(({ day, entry, recipe }) => {
    scaleRecipeIngredients(recipe, cleanNumber(entry.servings, recipe.baseServings || 2))
      .filter((ingredient) => String(ingredient.name || "").trim() && cleanNumber(ingredient.amount, 0) > 0)
      .forEach((ingredient) => {
      const unit = MealPlannerFood.normalizeUnit(ingredient.unit || "");
      let current = combined.find((item) =>
        normalizeName(item.name) === normalizeName(ingredient.name) &&
        MealPlannerFood.convertAmount(1, unit, item.unit) !== null
      );
      if (!current) {
        current = {
          amount: 0,
          unit,
          name: ingredient.name,
          recipes: new Set(),
          days: new Set()
        };
        combined.push(current);
      }
      const converted = MealPlannerFood.convertAmount(
        cleanNumber(ingredient.amount, 0),
        unit,
        current.unit
      );
      current.amount += converted ?? cleanNumber(ingredient.amount, 0);
      current.recipes.add(recipe.name);
      current.days.add(day.label);
    });
  });

  return combined
    .map((item) => {
      const stock = MealPlannerFood.analyzeIngredient(item, foodStorage);
      return {
        ...item,
        recipes: [...item.recipes],
        days: [...item.days],
        category: groceryCategory(item.name),
        have: stock.have,
        buy: stock.buy,
        matchedItem: stock.match
      };
    })
    .filter((item) => item.buy > 0.0001);
}

function renderWeeklyGroceryList() {
  const items = weeklyGroceryItems();
  weeklyGroceryGroups.innerHTML = "";

  if (!items.length) {
    weeklyGrocerySummary.textContent = "Plan meals above to build a grocery list.";
    weeklyGroceryGroups.innerHTML = '<p class="empty">No weekly groceries yet.</p>';
    return;
  }

  weeklyGrocerySummary.textContent = `${items.length} combined grocery item${items.length === 1 ? "" : "s"} from ${weeklyPlanEntries().length} planned meal${weeklyPlanEntries().length === 1 ? "" : "s"}.`;
  const order = ["Meat & seafood", "Produce", "Refrigerator", "Freezer", "Pantry", "Spices", "Condiments", "Other"];
  order.forEach((category) => {
    const categoryItems = items.filter((item) => item.category === category);
    if (!categoryItems.length) return;

    const section = document.createElement("section");
    section.className = "weekly-grocery-group";
    section.innerHTML = `<h3>${category}</h3><ul class="mini-list"></ul>`;
    const list = section.querySelector("ul");
    categoryItems
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((item) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span>${escapeHtml(item.name)}</span>
          <strong>Buy ${formatAmount(item.buy)} ${escapeHtml(item.unit || "")}</strong>
          <small>${escapeHtml(item.days.join(", "))}${item.have ? ` | Have ${formatAmount(item.have)} ${escapeHtml(item.unit || "")}` : ""}</small>
        `;
        list.appendChild(li);
      });
    weeklyGroceryGroups.appendChild(section);
  });
}

function groceryCategory(name) {
  const value = normalizeName(name);
  const has = (words) => words.some((word) => value.includes(word));
  if (has(["frozen", "freezer", "ice cream", "fish stick", "chicken nugget", "meatball"])) return "Freezer";
  if (has(["beef", "steak", "roast", "hamburger", "chicken", "pork", "bacon", "sausage", "ham", "fish", "salmon", "shrimp", "tuna", "cod", "crab", "scallop", "lobster", "mussel", "clam", "seafood"])) return "Meat & seafood";
  if (has(["lettuce", "tomato", "onion", "pepper", "potato", "carrot", "celery", "broccoli", "cabbage", "cucumber", "lemon", "lime", "mushroom", "corn", "peas", "bean"])) return "Produce";
  if (has(["egg", "milk", "cheese", "butter", "cream", "yogurt", "sour cream", "parmesan"])) return "Refrigerator";
  if (has(["salt", "pepper", "powder", "paprika", "cumin", "oregano", "basil", "parsley", "seasoning", "spice"])) return "Spices";
  if (has(["ketchup", "ketup", "ketsup", "catsup", "mustard", "mayo", "mayonnaise", "relish", "pickle", "salsa", "sauce", "vinegar", "honey"])) return "Condiments";
  if (has(["pasta", "spaghetti", "rice", "flour", "sugar", "breadcrumb", "bread", "tortilla", "oats", "noodle", "cracker", "cereal", "broth", "stock", "oil"])) return "Pantry";
  return "Other";
}

async function copyWeeklyGroceryList() {
  const text = weeklyGroceryListText();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyWeeklyList.textContent = "Copied";
    setTimeout(() => (copyWeeklyList.textContent = "Copy weekly list"), 1200);
  } catch {
    alert(text);
  }
}

function answerFoodAi() {
  saveCurrentFieldsQuietly();
  const question = foodAiQuestion.value.trim().toLowerCase();
  const allItems = allFoodItems();
  const selected = selectedRecipe();
  const possible = stockRecipeIdeas();
  const inventoryWords = ["have", "inventory", "stock", "house", "fridge", "refrigerator", "freezer", "pantry", "own"];
  const expiryWords = ["expire", "expired", "expiration", "best by", "use soon", "going bad", "oldest"];

  if (question && !foodAiCanAnswer(question)) {
    foodAiAnswer.innerHTML = "I only help with food, recipes, and the inventory in your house.";
    return;
  }

  if (!allItems.length) {
    foodAiAnswer.innerHTML = "Add groceries first, then I can suggest meals from your refrigerator, freezer, and pantry.";
    return;
  }

  if (expiryWords.some((word) => question.includes(word))) {
    const warningDays = cleanNumber(inventorySettings.reminderDays, 7) || 7;
    const attention = allItems
      .map((item) => ({ item, expiry: MealPlannerFood.expiryState(item, { warningDays }) }))
      .filter(({ expiry }) => ["past", "today", "soon"].includes(expiry.state))
      .sort((a, b) => a.expiry.days - b.expiry.days);
    const ideas = MealPlannerFood.rankRecipesByExpiry(recipes, foodStorage, { warningDays }).slice(0, 3);

    if (!attention.length) {
      foodAiAnswer.innerHTML = `Nothing with a best-by date is due within ${warningDays} days.`;
      return;
    }

    foodAiAnswer.innerHTML = `
      <strong>Food needing attention:</strong>
      <ul>${attention.slice(0, 8).map(({ item, expiry }) =>
        `<li>${escapeHtml(item.name)} - ${escapeHtml(expiryNoticeText(expiry))}</li>`
      ).join("")}</ul>
      ${ideas.length
        ? `<strong>Recipes to consider:</strong><ul>${ideas.map((idea) =>
          `<li>${escapeHtml(idea.recipe.name)}${idea.ready ? " - ready now" : ` - ${idea.missingCount} item${idea.missingCount === 1 ? "" : "s"} to buy`}</li>`
        ).join("")}</ul>`
        : "<small>No saved recipe uses the food due soon yet.</small>"
      }
    `;
    return;
  }

  if (inventoryWords.some((word) => question.includes(word))) {
    const found = matchingInventoryItems(question);
    if (found.length) {
      foodAiAnswer.innerHTML = `
        <strong>Found in your house inventory:</strong>
        <ul>${found.slice(0, 8).map((item) => `<li>${escapeHtml(item.name)} - ${formatAmount(cleanNumber(item.amount, 0))} ${escapeHtml(item.unit || "item")}</li>`).join("")}</ul>
      `;
      return;
    }

    const counts = {
      refrigerator: foodStorage.refrigerator.length,
      freezer: foodStorage.freezer.length,
      pantry: foodStorage.pantry.length
    };
    foodAiAnswer.innerHTML = `You have ${counts.refrigerator} refrigerator item${counts.refrigerator === 1 ? "" : "s"}, ${counts.freezer} freezer item${counts.freezer === 1 ? "" : "s"}, and ${counts.pantry} pantry item${counts.pantry === 1 ? "" : "s"} recorded.`;
    return;
  }

  if (question.includes("missing") || question.includes("need") || question.includes("buy") || question.includes("shopping")) {
    const missing = selected ? missingIngredientsForRecipe(selected) : [];
    foodAiAnswer.innerHTML = selected && missing.length
      ? `<strong>${escapeHtml(selected.name)}</strong> is missing: ${missing.map((item) => escapeHtml(item.name)).join(", ")}.`
      : selected
        ? `<strong>${escapeHtml(selected.name)}</strong> looks ready from your saved food list.`
        : "Pick a recipe first, then ask what is missing.";
    return;
  }

  if (question.includes("cost") || question.includes("spend") || question.includes("price")) {
    const estimate = estimateSelectedMealCost();
    foodAiAnswer.innerHTML = estimate.cost
      ? `The rough cost for <strong>${escapeHtml(selected.name)}</strong> is about <strong>${formatMoney(estimate.cost)}</strong>, based on ${estimate.items.length} matched grocery item${estimate.items.length === 1 ? "" : "s"}.`
      : "I do not have enough matched prices for this meal yet. Paste grocery orders with prices and I can estimate it.";
    return;
  }

  if (possible.length) {
    foodAiAnswer.innerHTML = `
      <strong>You can make these from food you already have:</strong>
      <ul>${possible.slice(0, 5).map(({ recipe }) => `<li>${escapeHtml(recipe.name)}</li>`).join("")}</ul>
      <small>Use the Ideas from my food only button below to open one.</small>
    `;
    return;
  }

  const calculatorIdeas = foodCalculatorIdeas();
  if (calculatorIdeas.length) {
    foodAiAnswer.innerHTML = `
      <strong>Food calculator ideas from your inventory:</strong>
      <ul>${calculatorIdeas.map((idea) => `<li>${escapeHtml(idea.title)}<small> - ${idea.parts.map((part) => escapeHtml(part.name)).join(", ")}</small></li>`).join("")}</ul>
    `;
    return;
  }

  const nearMatches = recipes
    .map((recipe) => ({ recipe, missing: missingIngredientsForRecipe(recipe) }))
    .filter((item) => item.recipe.ingredients?.length)
    .sort((a, b) => a.missing.length - b.missing.length)
    .slice(0, 3);

  if (!nearMatches.length) {
    foodAiAnswer.innerHTML = "Save a few recipes first, and I can match them against your food.";
    return;
  }

  foodAiAnswer.innerHTML = `
    <strong>Closest ideas:</strong>
    <ul>${nearMatches.map(({ recipe, missing }) => `<li>${escapeHtml(recipe.name)} - missing ${missing.length ? missing.slice(0, 3).map((item) => escapeHtml(item.name)).join(", ") : "nothing"}</li>`).join("")}</ul>
  `;
}

function stockRecipeIdeas() {
  const expiryRanks = new Map(
    MealPlannerFood.rankRecipesByExpiry(recipes, foodStorage, {
      warningDays: cleanNumber(inventorySettings.reminderDays, 7) || 7
    }).map((idea) => [idea.recipe.id, idea.score])
  );
  return recipes
    .map((recipe) => {
      const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
      const missing = missingIngredientsForRecipe(recipe);
      return { recipe, ingredients, missing, expiryScore: cleanNumber(expiryRanks.get(recipe.id), 0) };
    })
    .filter((idea) => idea.ingredients.length && !idea.missing.length)
    .sort((a, b) => b.expiryScore - a.expiryScore || a.recipe.name.localeCompare(b.recipe.name));
}

function missingIngredientsForRecipe(recipe) {
  return MealPlannerFood.analyzeRecipe(recipe.ingredients || [], foodStorage).rows
    .filter((row) => row.buy > 0.0001)
    .map((row) => ({
      ...row.ingredient,
      amount: row.buy
    }));
}

function foodCalculatorIdeas() {
  const available = allFoodItems();
  const mains = available.filter((item) => foodRole(item.name) === "main");
  const sides = available.filter((item) => foodRole(item.name) === "side");
  const vegetables = available.filter((item) => foodRole(item.name) === "vegetable");
  const seasonings = available.filter((item) => ["spice", "condiment", "sauce", "fat"].includes(foodRole(item.name)));
  const ideas = [];

  mains.forEach((main) => {
    const mainKind = mainFoodKind(main.name);
    const matchingSides = sides.filter((side) => foodsGoTogether(mainKind, side.name));
    const matchingVegetables = vegetables.filter((veg) => foodsGoTogether(mainKind, veg.name));
    const matchingSeasonings = seasonings.filter((item) => foodsGoTogether(mainKind, item.name));

    matchingSides.slice(0, 2).forEach((side) => {
      ideas.push({
        title: `${simpleFoodName(main.name)} with ${simpleFoodName(side.name)}`,
        parts: [main, side, matchingVegetables[0], matchingSeasonings[0]].filter(Boolean)
      });
    });

    if (!matchingSides.length && matchingVegetables.length) {
      ideas.push({
        title: `${simpleFoodName(main.name)} with ${simpleFoodName(matchingVegetables[0].name)}`,
        parts: [main, matchingVegetables[0], matchingSeasonings[0]].filter(Boolean)
      });
    }
  });

  return ideas.slice(0, 6);
}

function foodRole(name) {
  const value = normalizeName(name);
  const has = (words) => words.some((word) => value.includes(word));
  if (has(["beef", "steak", "hamburger", "chicken", "pork", "ham", "sausage", "bacon", "fish", "salmon", "shrimp", "tuna", "cod", "crab", "scallop", "lobster", "turkey"])) return "main";
  if (has(["rice", "pasta", "spaghetti", "macaroni", "noodle", "potato", "bread", "bun", "tortilla", "beans", "corn", "grits"])) return "side";
  if (has(["lettuce", "tomato", "onion", "pepper", "carrot", "celery", "broccoli", "cabbage", "cucumber", "mushroom", "peas", "green bean", "spinach", "asparagus", "zucchini", "squash"])) return "vegetable";
  if (has(["salt", "pepper", "powder", "seasoning", "paprika", "cumin", "oregano", "basil", "thyme", "rosemary"])) return "spice";
  if (has(["ketchup", "mustard", "mayo", "mayonnaise", "relish", "salsa", "sauce", "dressing", "vinegar", "honey"])) return "condiment";
  if (has(["oil", "butter"])) return "fat";
  return "other";
}

function mainFoodKind(name) {
  const value = normalizeName(name);
  if (/(salmon|tuna|cod|fish|shrimp|crab|scallop|lobster|clam|mussel|catfish|tilapia)/.test(value)) return "seafood";
  if (/(chicken|turkey)/.test(value)) return "poultry";
  if (/(pork|ham|bacon|sausage)/.test(value)) return "pork";
  if (/(beef|steak|hamburger|roast|brisket)/.test(value)) return "beef";
  return "main";
}

function foodsGoTogether(mainKind, itemName) {
  const value = normalizeName(itemName);
  const universal = ["salt", "pepper", "garlic", "onion", "butter", "oil", "potato", "rice", "bread", "lettuce", "tomato", "green bean", "broccoli", "corn", "peas"];
  if (universal.some((word) => value.includes(word))) return true;

  const rules = {
    beef: ["pasta", "spaghetti", "macaroni", "beans", "tortilla", "ketchup", "mustard", "bbq", "worcestershire", "steak sauce", "mushroom", "carrot", "celery"],
    poultry: ["pasta", "noodle", "broth", "stuffing", "gravy", "ranch", "lemon", "thyme", "rosemary", "salad", "tortilla"],
    pork: ["beans", "bbq", "mustard", "cabbage", "apple", "gravy", "rice", "noodle", "cornbread"],
    seafood: ["lemon", "rice", "pasta", "butter", "dill", "tartar", "cocktail", "old bay", "salad", "asparagus", "zucchini"]
  };

  return (rules[mainKind] || []).some((word) => value.includes(word));
}

function simpleFoodName(name) {
  return String(name || "")
    .replace(/\b(great value|fresh|frozen|organic|boneless|skinless)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchingInventoryItems(question) {
  const words = meaningfulFoodWords(question);
  if (!words.length) return [];

  return allFoodItems().filter((item) => {
    const itemWords = meaningfulFoodWords(item.name);
    return words.some((word) => itemWords.includes(word));
  });
}

function foodAiCanAnswer(question) {
  const allowed = [
    "food", "meal", "recipe", "cook", "make", "eat", "dinner", "lunch", "breakfast",
    "ingredient", "ingredients", "missing", "need", "buy", "shopping", "cost", "price",
    "spend", "inventory", "stock", "house", "fridge", "refrigerator", "freezer", "pantry",
    "have", "own", "beef", "chicken", "pork", "fish", "seafood", "spice", "condiment",
    "expire", "expired", "expiration", "best by", "use soon", "going bad", "oldest"
  ];
  return allowed.some((word) => question.includes(word));
}

function printWeeklyGroceryList() {
  const items = weeklyGroceryItems();
  printTitle.textContent = "Weekly Grocery List";
  printMeta.textContent = `${weeklyPlanEntries().length} planned meal${weeklyPlanEntries().length === 1 ? "" : "s"} | ${items.length} grocery item${items.length === 1 ? "" : "s"}`;
  printIngredients.innerHTML = "";
  weeklyGroceryListText().split("\n").filter(Boolean).forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    printIngredients.appendChild(li);
  });
  printNotes.innerHTML = "";
  weeklyPlanEntries().forEach(({ day, recipe, entry }) => {
    const p = document.createElement("p");
    p.textContent = `${day.label}: ${recipe.name} for ${cleanNumber(entry.servings, 2)} people`;
    printNotes.appendChild(p);
  });
  window.print();
}

function weeklyGroceryListText() {
  const items = weeklyGroceryItems();
  if (!items.length) return "";
  const lines = ["Weekly Grocery List"];
  ["Meat & seafood", "Produce", "Refrigerator", "Freezer", "Pantry", "Spices", "Condiments", "Other"].forEach((category) => {
    const group = items.filter((item) => item.category === category);
    if (!group.length) return;
    lines.push("", category);
    group
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((item) => lines.push(`${formatAmount(item.buy)} ${item.unit || ""} ${item.name}`.replace(/\s+/g, " ").trim()));
  });
  return lines.join("\n");
}

function renderMealBuilder() {
  const recipe = buildRecipeFromChoices();
  saveBuiltMeal.disabled = !recipe;
  backBuiltMeal.disabled = !builderState.main;
  builderTrail.textContent = mealBuilderTrail();

  if (!builderState.main) {
    builderQuestion.textContent = "What do you want to make?";
    renderChoiceButtons(mainChoiceButtons, builderOptions, builderState.main, (key) => {
      builderState = { main: key, kind: "", style: "" };
      renderMealBuilder();
    });
  } else if (!builderState.kind) {
    builderQuestion.textContent = `What kind of ${builderOptions[builderState.main].label.toLowerCase()}?`;
    renderChoiceButtons(
      mainChoiceButtons,
      builderOptions[builderState.main].kinds,
      builderState.kind,
      (key) => {
        builderState.kind = key;
        renderMealBuilder();
      },
      "",
      false,
      builderState.main
    );
  } else if (!builderState.style) {
    builderQuestion.textContent = "How do you want to cook it?";
    renderChoiceButtons(mainChoiceButtons, builderStyles, builderState.style, (key) => {
      builderState.style = key;
      renderMealBuilder();
    });
  } else {
    builderQuestion.textContent = "Ready to save";
    mainChoiceButtons.innerHTML = "";
  }
  renderBuilderListEditor();

  if (!recipe) {
    builderPreview.innerHTML = '<p class="empty">Your meal preview will show here after you make the three choices.</p>';
    return;
  }

  builderPreview.innerHTML = `
    <div class="builder-recipe-editor">
      <label>
        Meal name
        <input id="builderMealName" type="text" value="${escapeHtml(recipe.name)}" />
      </label>
      <p>Click any line below to change it. Changes are remembered for this meal builder path.</p>
      <div id="builderIngredientRows" class="builder-ingredient-rows">
        ${recipe.ingredients.map((item, index) => builderIngredientRowHtml(item, index)).join("")}
      </div>
      <button type="button" id="addBuilderIngredientLine">Add ingredient line</button>
      <label>
        How to prep it
        <textarea id="builderMealNotes" rows="5">${escapeHtml(recipe.notes || "")}</textarea>
      </label>
    </div>
  `;
  bindBuilderPreviewEditor();
}

function mealBuilderTrail() {
  const parts = [];
  if (builderState.main) parts.push(builderOptions[builderState.main].label);
  if (builderState.kind) parts.push(builderOptions[builderState.main].kinds[builderState.kind]);
  if (builderState.style) parts.push(builderStyles[builderState.style]);
  return parts.length ? `Choices: ${parts.join(" > ")}` : "";
}

function renderChoiceButtons(
  container,
  choices,
  selected,
  onClick,
  emptyText = "",
  disabled = false,
  imageGroup = ""
) {
  container.innerHTML = "";
  const entries = Object.entries(choices);
  if (!entries.length || disabled) {
    container.innerHTML = `<p class="empty">${escapeHtml(emptyText)}</p>`;
    return;
  }

  entries.forEach(([key, label]) => {
    const displayLabel = typeof label === "string" ? label : label.label;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.choiceKey = key;
    button.className = `choice-button ${selected === key ? "active" : ""}`;
    const image = document.createElement("img");
    image.src = choiceImageFor(key, displayLabel, imageGroup);
    image.alt = "";
    image.onerror = () => {
      image.onerror = null;
      image.src = ingredientRemoteImageUrl(displayLabel);
    };
    const text = document.createElement("span");
    text.textContent = displayLabel;
    button.append(image, text);
    button.addEventListener("click", () => onClick(key));
    container.appendChild(button);
  });
}

function choiceImageFor(key, label, group = "") {
  const groupChoiceMap = {
    chicken: {
      breast: "chicken breast",
      thighs: "chicken thighs",
      whole_chicken: "whole chicken",
      leg_quarters: "chicken leg quarters",
      half: "half chicken",
      cutlets: "chicken cutlets",
      tenders: "chicken tenders",
      ground_chicken: "ground chicken",
      drumsticks: "drumsticks",
      wings: "wings"
    },
    pork: {
      chops: "pork chops",
      roast: "pork roast",
      tenderloin: "pork tenderloin",
      pork_butt: "pork butt",
      pork_shoulder: "pork shoulder",
      pork_loin: "pork loin",
      pork_belly: "pork belly",
      ribs: "pork ribs",
      baby_back_ribs: "baby back ribs",
      spare_ribs: "spare ribs",
      ground_pork: "ground pork",
      sausage: "pork sausage",
      bacon: "bacon",
      ham: "ham"
    },
    fish: {
      salmon: "salmon",
      salmon_fillets: "salmon fillets",
      cod: "cod",
      haddock: "haddock",
      halibut: "halibut",
      flounder: "flounder",
      catfish: "catfish",
      trout: "trout",
      shrimp: "shrimp",
      jumbo_shrimp: "jumbo shrimp",
      tuna: "tuna steaks",
      crab_cakes: "crab cakes",
      scallops: "scallops",
      tilapia: "tilapia",
      lobster: "lobster",
      mussels: "mussels",
      clams: "clams",
      fish_fillets: "fish fillets"
    }
  };
  const choiceMap = {
    beef: "beef",
    hamburger: "ground beef",
    ribeye: "ribeye",
    sirloin: "sirloin",
    t_bone_steak: "t-bone steak",
    porterhouse: "porterhouse",
    filet_mignon: "filet mignon",
    new_york_strip: "new york strip",
    flank_steak: "flank steak",
    skirt_steak: "skirt steak",
    hanger_steak: "hanger steak",
    short_ribs: "short ribs",
    beef_ribs: "beef ribs",
    beef_shank: "beef shank",
    top_round: "top round",
    bottom_round: "bottom round",
    steak: "beef steak",
    prime_rib_roast: "prime rib roast",
    roast: "beef roast",
    pot_roast: "pot roast",
    chuck_roast: "chuck roast",
    brisket: "brisket",
    stew_meat: "stew meat",
    meatloaf: "ground beef",
    chicken: "chicken",
    breast: "chicken breast",
    thighs: "chicken thighs",
    half: "chicken",
    tenders: "chicken breast",
    drumsticks: "drumsticks",
    wings: "wings",
    pork: "pork",
    chops: "pork chops",
    tenderloin: "pork",
    ribs: "pork",
    sausage: "sausage",
    bacon: "bacon",
    ham: "ham",
    fish: "fish",
    salmon: "salmon",
    cod: "cod",
    shrimp: "shrimp",
    tuna: "tuna",
    crab_cakes: "crab",
    scallops: "scallops",
    tilapia: "fish",
    lobster: "lobster",
    mussels: "mussels",
    clams: "clams",
    fish_fillets: "fish",
    vegetarian: "lettuce",
    garden_salad: "lettuce",
    chef_salad: "lettuce",
    chicken_salad: "chicken breast",
    tuna_salad: "tuna",
    pasta_salad: "macaroni",
    pasta: "macaroni",
    spaghetti: "spaghetti",
    soup: "broth",
    skillet: "olive oil",
    oven: "bread",
    grill: "beef",
    slow: "broth"
  };
  return ingredientImageUrl(groupChoiceMap[group]?.[key] || choiceMap[key] || label);
}

function renderBuilderListEditor() {
  const listInfo = currentBuilderListInfo();
  builderEditTitle.textContent = listInfo.title;
  builderChoiceSelect.innerHTML = "";

  Object.entries(listInfo.choices).forEach(([key, label]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = typeof label === "string" ? label : label.label;
    builderChoiceSelect.appendChild(option);
  });

  const hasChoices = builderChoiceSelect.options.length > 0;
  renameBuilderChoice.disabled = !hasChoices;
  deleteBuilderChoice.disabled = !hasChoices;
}

function currentBuilderListInfo() {
  if (!builderState.main) {
    return { type: "main", title: "Change main food choices", choices: builderOptions };
  }

  if (!builderState.kind) {
    return {
      type: "kind",
      title: `Change ${builderOptions[builderState.main].label} choices`,
      choices: builderOptions[builderState.main].kinds
    };
  }

  return { type: "style", title: "Change cooking choices", choices: builderStyles };
}

function addCurrentBuilderChoice() {
  const name = builderChoiceName.value.trim();
  if (!name) {
    builderChoiceName.focus();
    return;
  }

  const key = uniqueBuilderKey(slugify(name), currentBuilderListInfo().choices);
  captureUndo("add meal choice");
  setBuilderChoice(key, name);
  builderChoiceName.value = "";
  persistRecipes();
  renderMealBuilder();
}

function renameCurrentBuilderChoice() {
  const key = builderChoiceSelect.value;
  const name = builderChoiceName.value.trim();
  if (!key || !name) {
    builderChoiceName.focus();
    return;
  }

  captureUndo("rename meal choice");
  setBuilderChoice(key, name);
  builderChoiceName.value = "";
  persistRecipes();
  renderMealBuilder();
}

function deleteCurrentBuilderChoice() {
  const key = builderChoiceSelect.value;
  if (!key) return;

  const info = currentBuilderListInfo();
  const label = info.type === "main" ? info.choices[key]?.label : info.choices[key];
  if (!window.confirm(`Delete "${label || "this choice"}" from the meal builder?`)) return;
  captureUndo("delete meal choice");
  delete info.choices[key];
  if (info.type === "main" && builderState.main === key) builderState = { main: "", kind: "", style: "" };
  if (info.type === "kind" && builderState.kind === key) builderState.kind = "";
  if (info.type === "style" && builderState.style === key) builderState.style = "";
  persistRecipes();
  renderMealBuilder();
}

function setBuilderChoice(key, name) {
  const info = currentBuilderListInfo();
  if (info.type === "main") {
    if (!builderOptions[key]) builderOptions[key] = { label: name, kinds: {} };
    builderOptions[key].label = name;
    return;
  }

  info.choices[key] = name;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "choice";
}

function uniqueBuilderKey(base, choices) {
  let key = base;
  let index = 2;
  while (choices[key]) {
    key = `${base}_${index}`;
    index++;
  }
  return key;
}

function builderIngredientRowHtml(item, index) {
  return `
    <div class="builder-ingredient-row" data-index="${index}">
      <input class="builder-amount" type="number" min="0" step="0.01" value="${formatAmount(cleanNumber(item.amount, 0))}" aria-label="Amount" />
      <input class="builder-unit" type="text" value="${escapeHtml(item.unit || "")}" aria-label="Unit" />
      <input class="builder-name" type="text" value="${escapeHtml(item.name || "")}" aria-label="Ingredient" />
      <button type="button" class="builder-remove-line" aria-label="Remove ingredient">Remove</button>
    </div>
  `;
}

function bindBuilderPreviewEditor() {
  const nameInput = document.querySelector("#builderMealName");
  const notesInput = document.querySelector("#builderMealNotes");
  const addLine = document.querySelector("#addBuilderIngredientLine");
  const rows = document.querySelector("#builderIngredientRows");

  [nameInput, notesInput, rows].forEach((element) => {
    element?.addEventListener("input", saveBuilderPreviewTemplate);
  });

  addLine?.addEventListener("click", () => {
    const recipe = collectBuilderPreviewRecipe();
    recipe.ingredients.push({ amount: 1, unit: "", name: "new ingredient" });
    saveBuilderTemplate(recipe);
    renderMealBuilder();
  });

  rows?.querySelectorAll(".builder-remove-line").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest(".builder-ingredient-row");
      row.remove();
      saveBuilderPreviewTemplate();
    });
  });
}

function saveBuilderPreviewTemplate() {
  saveBuilderTemplate(collectBuilderPreviewRecipe());
}

function collectBuilderPreviewRecipe() {
  const existing = buildRecipeFromChoices() || {};
  return {
    id: existing.id || crypto.randomUUID(),
    name: document.querySelector("#builderMealName")?.value.trim() || existing.name || "Custom meal",
    baseServings: cleanNumber(targetServings.value, existing.baseServings || 2),
    notes: document.querySelector("#builderMealNotes")?.value.trim() || "",
    photo: existing.photo || "",
    ingredients: [...document.querySelectorAll(".builder-ingredient-row")]
      .map((row) => ({
        amount: cleanNumber(row.querySelector(".builder-amount").value, 0),
        unit: row.querySelector(".builder-unit").value.trim(),
        name: row.querySelector(".builder-name").value.trim()
      }))
      .filter((ingredient) => ingredient.name)
  };
}

function saveBuilderTemplate(recipe) {
  const key = builderTemplateKey();
  if (!key) return;

  builderTemplates[key] = recipe;
  persistRecipes();
}

function renderRecipeList() {
  recipeList.innerHTML = "";

  if (!recipes.length) {
    recipeList.innerHTML = '<div class="empty">No recipes yet. Start a new one.</div>';
    return;
  }

  recipes.forEach((recipe) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `recipe-card ${recipe.id === selectedRecipeId ? "active" : ""}`;
    const image = document.createElement("img");
    setRecipeImage(image, recipe);
    const text = document.createElement("span");
    text.innerHTML = `<strong>${escapeHtml(recipe.name)}</strong><small>Serves ${recipe.baseServings}</small>`;
    button.append(image, text);
    button.addEventListener("click", () => {
      selectedRecipeId = recipe.id;
      editorUndoArmed = true;
      render();
      setAppView("recipes", { focus: false });
      focusSection(document.querySelector(".recipe-showcase"));
    });
    recipeList.appendChild(button);
  });
}

function renderVisualRecipeList() {
  visualRecipeList.innerHTML = "";
  visualRecipeList.classList.add("is-rolodex");

  if (!recipes.length) {
    visualRecipeList.innerHTML = '<div class="empty">Recipe photos will show here.</div>';
    return;
  }

  visualRecipeIndex = wrapRecipeIndex(visualRecipeIndex);
  const shell = document.createElement("div");
  shell.className = "recipe-rolodex-shell";

  const controls = document.createElement("div");
  controls.className = "rolodex-controls";
  const upButton = document.createElement("button");
  upButton.type = "button";
  upButton.className = "rolodex-spin";
  upButton.setAttribute("aria-label", "Previous recipe");
  upButton.innerHTML = "&#9650;";
  const downButton = document.createElement("button");
  downButton.type = "button";
  downButton.className = "rolodex-spin";
  downButton.setAttribute("aria-label", "Next recipe");
  downButton.innerHTML = "&#9660;";
  controls.append(upButton, downButton);

  const windowFrame = document.createElement("div");
  windowFrame.className = "recipe-rolodex-window";
  windowFrame.tabIndex = 0;
  windowFrame.setAttribute("aria-label", "Recipe card spinner");
  const stack = document.createElement("div");
  stack.className = "recipe-rolodex-stack";
  const letterRail = document.createElement("div");
  letterRail.className = "rolodex-letter-rail";

  recipes.forEach((recipe, index) => {
    const offset = circularRecipeOffset(index);
    const distance = Math.abs(offset);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `visual-recipe rolodex-card ${recipe.id === selectedRecipeId ? "active" : ""}`;
    button.dataset.recipeIndex = String(index);
    button.dataset.hidden = distance > 2 ? "true" : "false";
    button.dataset.center = distance === 0 ? "true" : "false";
    button.tabIndex = distance === 0 ? 0 : -1;
    button.style.transform = rolodexTransform(offset, distance);
    button.style.opacity = distance > 2 ? "0" : String(Math.max(0.36, 1 - distance * 0.22));
    button.style.zIndex = String(20 - distance);
    const image = document.createElement("img");
    setRecipeImage(image, recipe);
    const label = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = recipe.name;
    const servings = document.createElement("small");
    servings.textContent = `Serves ${recipe.baseServings}`;
    label.append(name, servings);
    button.append(image, label);
    button.addEventListener("click", () => {
      openRecipeFromRolodex(button, recipe, index);
    });
    stack.appendChild(button);
  });

  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((letter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rolodex-letter";
    button.textContent = letter;
    button.disabled = !recipes.some((recipe) => recipeFirstLetter(recipe) === letter);
    button.dataset.letter = letter;
    button.addEventListener("click", () => spinToRecipeLetter(letter));
    letterRail.appendChild(button);
  });

  windowFrame.appendChild(stack);
  shell.append(controls, windowFrame, letterRail);
  visualRecipeList.appendChild(shell);
  updateRolodexLetters();

  upButton.addEventListener("click", () => spinVisualRecipes(-1));
  downButton.addEventListener("click", () => spinVisualRecipes(1));
  windowFrame.addEventListener("wheel", handleVisualRecipeWheel, { passive: false });
  windowFrame.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      spinVisualRecipes(-1);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      spinVisualRecipes(1);
    }
  });
}

function wrapRecipeIndex(index) {
  if (!recipes.length) return 0;
  return ((index % recipes.length) + recipes.length) % recipes.length;
}

function circularRecipeOffset(index) {
  if (!recipes.length) return 0;
  let offset = index - visualRecipeIndex;
  const half = recipes.length / 2;
  if (offset > half) offset -= recipes.length;
  if (offset < -half) offset += recipes.length;
  return offset;
}

function rolodexTransform(offset, distance) {
  const y = offset * 58;
  const z = (2 - distance) * 18;
  const scale = Math.max(0.78, 1 - distance * 0.08);
  const rotate = offset * -7;
  return `translateY(${y}px) translateZ(${z}px) rotateX(${rotate}deg) scale(${scale})`;
}

function spinVisualRecipes(delta) {
  if (!recipes.length) return;
  visualRecipeIndex = wrapRecipeIndex(visualRecipeIndex + delta);
  updateRolodexDisplay();
}

function spinToRecipeLetter(letter) {
  const index = recipes.findIndex((recipe) => recipeFirstLetter(recipe) === letter);
  if (index === -1) return;
  visualRecipeIndex = index;
  updateRolodexDisplay();
}

function recipeFirstLetter(recipe) {
  const match = String(recipe?.name || "").trim().match(/[a-z]/i);
  return match ? match[0].toUpperCase() : "#";
}

function updateRolodexDisplay() {
  visualRecipeList.querySelectorAll(".rolodex-card").forEach((card) => {
    const index = Number(card.dataset.recipeIndex);
    const offset = circularRecipeOffset(index);
    const distance = Math.abs(offset);
    const recipe = recipes[index];
    card.dataset.hidden = distance > 2 ? "true" : "false";
    card.dataset.center = distance === 0 ? "true" : "false";
    card.tabIndex = distance === 0 ? 0 : -1;
    card.style.transform = rolodexTransform(offset, distance);
    card.style.opacity = distance > 2 ? "0" : String(Math.max(0.36, 1 - distance * 0.22));
    card.style.zIndex = String(20 - distance);
    card.classList.toggle("active", recipe?.id === selectedRecipeId);
  });
  updateRolodexLetters();
}

function updateRolodexLetters() {
  const activeLetter = recipeFirstLetter(recipes[visualRecipeIndex]);
  visualRecipeList.querySelectorAll(".rolodex-letter").forEach((button) => {
    button.classList.toggle("active", button.dataset.letter === activeLetter);
  });
}

function handleVisualRecipeWheel(event) {
  event.preventDefault();
  const now = Date.now();
  if (now - lastRecipeSpinAt < 160 || Math.abs(event.deltaY) < 4) return;
  lastRecipeSpinAt = now;
  spinVisualRecipes(event.deltaY > 0 ? 1 : -1);
}

function openRecipeFromRolodex(card, recipe, index) {
  visualRecipeIndex = index;
  updateRolodexDisplay();
  const activeCard = visualRecipeList.querySelector(`.rolodex-card[data-recipe-index="${index}"]`) || card;
  activeCard.classList.add("is-opening");
  setTimeout(() => {
    selectedRecipeId = recipe.id;
    editorUndoArmed = true;
    render();
    setAppView("recipes", { focus: false });
    focusSection(document.querySelector(".recipe-showcase"));
  }, 260);
}

function recipeImageSource(recipe) {
  return recipe.photo || ingredientImageUrl(recipe.ingredients?.[0]?.name || recipe.name);
}

function setRecipeImage(image, recipe) {
  const fallbackName = recipe.ingredients?.[0]?.name || recipe.name;
  image.src = recipeImageSource(recipe);
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.onerror = () => {
    image.onerror = () => {
      image.hidden = true;
    };
    image.src = ingredientRemoteImageUrl(fallbackName);
  };
}

function renderEditor() {
  const recipe = selectedRecipe();
  ingredientRows.innerHTML = "";

  if (!recipe) {
    recipeName.value = "";
    baseServings.value = 2;
    recipePrepTime.value = "";
    recipeCookTime.value = "";
    recipeTotalTime.value = "";
    recipeTemperature.value = "";
    recipeSourceUrl.value = "";
    recipeNotes.value = "";
    recipePhotoPreview.removeAttribute("src");
    recipePhotoPreview.hidden = true;
    deleteRecipe.disabled = true;
    return;
  }

  deleteRecipe.disabled = recipes.length <= 1;
  recipeName.value = recipe.name;
  baseServings.value = recipe.baseServings;
  recipePrepTime.value = recipe.prepTime || "";
  recipeCookTime.value = recipe.cookTime || "";
  recipeTotalTime.value = recipe.totalTime || "";
  recipeTemperature.value = recipe.temperature || "";
  recipeSourceUrl.value = recipe.sourceUrl || "";
  recipeNotes.value = recipe.notes || "";
  recipePhotoPreview.hidden = !recipe.photo;
  if (recipe.photo) {
    recipePhotoPreview.src = recipe.photo;
  } else {
    recipePhotoPreview.removeAttribute("src");
  }

  recipe.ingredients.forEach((ingredient) => addIngredientRow(ingredient));
}

function renderScaledList() {
  const recipe = selectedRecipe();
  const ingredients = getScaledIngredients(recipe);
  scaledList.innerHTML = "";

  if (!recipe) {
    scaleSummary.textContent = "";
    return;
  }

  const base = cleanNumber(recipe.baseServings, 1);
  const people = cleanNumber(targetServings.value, 1);
  scaleSummary.textContent = `${recipe.name} adjusted from ${base} to ${people} people`;

  ingredients.forEach((ingredient) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${formatAmount(ingredient.amount)} ${escapeHtml(ingredient.unit || "")}</strong><span>${escapeHtml(ingredient.name)}</span>`;
    scaledList.appendChild(li);
  });
}

function renderMealViews() {
  renderCommandCenter();
  renderWeeklyGroceryList();
  renderRecipeShowcase();
  renderScaledList();
  renderPantry();
  renderPantrySuggestionChoices();
  renderNeedList();
  renderMealCostTally();
  renderMealCostCalendar();
  renderPrintSheet();
}

function renderRecipeShowcase() {
  const recipe = selectedRecipe();
  if (!recipe) {
    showcaseSummary.textContent = "Pick or build a meal first.";
    showcaseMealPhoto.removeAttribute("src");
    showcaseMealPhoto.hidden = true;
    showcaseMealName.textContent = "";
    showcaseIngredients.innerHTML = "";
    showcaseInstructions.innerHTML = "";
    startCooking.disabled = true;
    return;
  }

  const people = cleanNumber(targetServings.value, 1);
  const steps = recipeSteps(recipe.notes);
  const timing = recipeTimingText(recipe);
  showcaseSummary.textContent = `${recipe.name} for ${people} people${timing ? ` | ${timing}` : ""}`;
  showcaseMealName.textContent = recipe.name;
  showcaseMealPhoto.hidden = false;
  startCooking.disabled = !steps.length;
  startCooking.textContent = cookingSession?.recipeId === recipe.id ? "Continue cooking" : "Start cooking";
  setRecipeImage(showcaseMealPhoto, recipe);

  showcaseIngredients.innerHTML = "";
  getScaledIngredients(recipe).forEach((ingredient) => {
    const card = document.createElement("article");
    card.className = "showcase-ingredient";
    const image = document.createElement("img");
    image.src = ingredientImageUrl(ingredient.name);
    image.alt = "";
    image.onerror = () => {
      image.onerror = () => {
        image.hidden = true;
      };
      image.src = ingredientRemoteImageUrl(ingredient.name);
    };
    const amount = document.createElement("strong");
    amount.textContent = `${formatAmount(ingredient.amount)} ${ingredient.unit || ""}`.trim();
    const name = document.createElement("span");
    name.textContent = ingredient.name;
    card.append(image, amount, name);
    showcaseIngredients.appendChild(card);
  });

  showcaseInstructions.innerHTML = "";
  if (!steps.length) {
    showcaseInstructions.innerHTML = '<p class="empty">Add cooking steps, times, and temperatures in the recipe notes.</p>';
    return;
  }

  const list = document.createElement("ol");
  steps.forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    list.appendChild(li);
  });
  showcaseInstructions.appendChild(list);
}

function recipeTimingText(recipe) {
  return [
    recipe.prepTime ? `Prep ${recipe.prepTime}` : "",
    recipe.cookTime ? `Cook ${recipe.cookTime}` : "",
    recipe.totalTime ? `Total ${recipe.totalTime}` : "",
    recipe.temperature ? recipe.temperature : ""
  ].filter(Boolean).join(" | ");
}

function recipeSteps(notes) {
  return String(notes || "")
    .split(/\r?\n|(?<=\.)\s+(?=[A-Z0-9])/)
    .map((step) => step.trim())
    .filter(Boolean);
}

function loadCookingSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(cookingStorageKey));
    return normalizeCookingSession(saved);
  } catch {
    return null;
  }
}

function normalizeCookingSession(saved) {
  if (!saved || typeof saved !== "object") return null;
  const recipe = recipes.find((item) => item.id === saved.recipeId);
  if (!recipe) return null;

  const steps = recipeSteps(recipe.notes);
  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;
  const checkedIngredients = uniqueValidIndexes(saved.checkedIngredients, ingredientCount);
  const completedSteps = uniqueValidIndexes(saved.completedSteps, steps.length);
  const timers = Array.isArray(saved.timers)
    ? saved.timers.map(normalizeCookingTimer).filter(Boolean).slice(0, 12)
    : [];

  return {
    recipeId: recipe.id,
    servings: cleanNumber(saved.servings, cleanNumber(recipe.baseServings, 1)),
    activeStep: Math.min(Math.max(0, Math.floor(Number(saved.activeStep) || 0)), Math.max(0, steps.length - 1)),
    checkedIngredients,
    completedSteps,
    timers
  };
}

function uniqueValidIndexes(values, length) {
  if (!Array.isArray(values) || !length) return [];
  return [...new Set(values
    .map((value) => Math.floor(Number(value)))
    .filter((value) => Number.isInteger(value) && value >= 0 && value < length))]
    .sort((a, b) => a - b);
}

function normalizeCookingTimer(saved) {
  if (!saved || typeof saved !== "object") return null;
  const savedDuration = Number(saved.durationMs);
  if (!Number.isFinite(savedDuration) || savedDuration <= 0) return null;
  const durationMs = Math.min(12 * 60 * 60 * 1000, Math.max(600, savedDuration));
  const status = ["running", "paused", "done"].includes(saved.status) ? saved.status : "paused";
  const remainingMs = Math.min(durationMs, Math.max(0, Number(saved.remainingMs) || durationMs));
  const endAt = Number(saved.endAt) || Date.now() + remainingMs;
  return {
    id: saved.id || crypto.randomUUID(),
    label: String(saved.label || "Kitchen timer").slice(0, 40),
    durationMs,
    status,
    remainingMs: status === "done" ? 0 : remainingMs,
    endAt,
    announced: Boolean(saved.announced)
  };
}

function createCookingSession(recipe, servings) {
  return {
    recipeId: recipe.id,
    servings,
    activeStep: 0,
    checkedIngredients: [],
    completedSteps: [],
    timers: []
  };
}

function saveCookingSession() {
  try {
    if (cookingSession) {
      localStorage.setItem(cookingStorageKey, JSON.stringify(cookingSession));
    } else {
      localStorage.removeItem(cookingStorageKey);
    }
  } catch {
    setSaveStatus("Cooking progress could not be saved", 3000);
  }
}

function openCookingMode() {
  const recipe = selectedRecipe();
  const steps = recipeSteps(recipe?.notes);
  if (!recipe || !steps.length) {
    window.alert("Add cooking steps to this recipe before starting guided cooking.");
    return;
  }

  const servings = cleanNumber(targetServings.value, 1);
  const sameSession = cookingSession?.recipeId === recipe.id && cookingSession.servings === servings;
  if (!sameSession) {
    const hasProgress = cookingSession &&
      (cookingSession.checkedIngredients.length || cookingSession.completedSteps.length || cookingSession.timers.length);
    if (hasProgress && !window.confirm("Start a different cooking session? The current cooking progress and timers will be replaced.")) {
      return;
    }
    cookingSession = createCookingSession(recipe, servings);
    saveCookingSession();
  } else {
    cookingSession = normalizeCookingSession(cookingSession);
  }

  renderCookingMode();
  cookingIngredientsPanel.open = !document.body.classList.contains("phone-layout");
  if (typeof cookingMode.showModal === "function") {
    if (!cookingMode.open) cookingMode.showModal();
  } else {
    cookingMode.setAttribute("open", "");
  }
  document.body.classList.add("cooking-open");
  requestCookingWakeLock();
  ensureCookingTimerTicker();
  setTimeout(() => cookingStepDone.focus(), 0);
  renderRecipeShowcase();
}

function closeCookingMode() {
  if (cookingMode.open && typeof cookingMode.close === "function") {
    cookingMode.close();
  } else {
    cookingMode.removeAttribute("open");
  }
  document.body.classList.remove("cooking-open");
  releaseCookingWakeLock();
  renderRecipeShowcase();
}

function renderCookingMode() {
  if (!cookingSession) return;
  const recipe = recipes.find((item) => item.id === cookingSession.recipeId);
  if (!recipe) {
    cookingSession = null;
    saveCookingSession();
    closeCookingMode();
    return;
  }

  const steps = recipeSteps(recipe.notes);
  if (!steps.length) {
    closeCookingMode();
    return;
  }
  cookingSession.activeStep = Math.min(cookingSession.activeStep, steps.length - 1);
  const ingredients = scaleRecipeIngredients(recipe, cookingSession.servings);
  const checkedIngredients = new Set(cookingSession.checkedIngredients);
  const completedSteps = new Set(cookingSession.completedSteps);

  cookingTitle.textContent = recipe.name;
  cookingMeta.textContent = `Cooking for ${formatAmount(cookingSession.servings)} people`;
  cookingIngredients.innerHTML = "";
  ingredients.forEach((ingredient, index) => {
    const label = document.createElement("label");
    label.className = "cooking-ingredient";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.cookingIngredient = String(index);
    checkbox.checked = checkedIngredients.has(index);
    const image = document.createElement("img");
    image.src = ingredientImageUrl(ingredient.name);
    image.alt = "";
    image.onerror = () => {
      image.onerror = () => {
        image.hidden = true;
      };
      image.src = ingredientRemoteImageUrl(ingredient.name);
    };
    const text = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = ingredient.name;
    const amount = document.createElement("small");
    amount.textContent = `${formatAmount(ingredient.amount)} ${ingredient.unit || ""}`.trim();
    text.append(name, amount);
    label.append(checkbox, image, text);
    cookingIngredients.appendChild(label);
  });

  cookingStepCount.textContent = `Step ${cookingSession.activeStep + 1} of ${steps.length}`;
  cookingProgress.max = steps.length;
  cookingProgress.value = cookingSession.activeStep + 1;
  cookingStepText.textContent = steps[cookingSession.activeStep];
  cookingStepDone.checked = completedSteps.has(cookingSession.activeStep);
  previousCookingStep.disabled = cookingSession.activeStep === 0;
  nextCookingStep.disabled = cookingSession.activeStep >= steps.length - 1;
  cookingIngredientCount.textContent = `${checkedIngredients.size} of ${ingredients.length}`;
  renderCookingSessionStatus();
  renderCookingTimers();
}

function renderCookingSessionStatus(message = "") {
  if (!cookingSession) {
    cookingSessionStatus.textContent = "";
    return;
  }
  if (message) {
    cookingSessionStatus.textContent = message;
    return;
  }
  const recipe = recipes.find((item) => item.id === cookingSession.recipeId);
  const ingredientTotal = recipe?.ingredients?.length || 0;
  const stepTotal = recipeSteps(recipe?.notes).length;
  cookingSessionStatus.textContent =
    `${cookingSession.checkedIngredients.length} of ${ingredientTotal} ingredients ready | ` +
    `${cookingSession.completedSteps.length} of ${stepTotal} steps complete`;
}

function updateCookingIngredientCompletion(event) {
  const input = event.target.closest("[data-cooking-ingredient]");
  if (!input || !cookingSession) return;
  const checked = new Set(cookingSession.checkedIngredients);
  const index = Number(input.dataset.cookingIngredient);
  if (input.checked) checked.add(index);
  else checked.delete(index);
  cookingSession.checkedIngredients = [...checked].sort((a, b) => a - b);
  saveCookingSession();
  renderCookingMode();
}

function updateCookingStepCompletion() {
  if (!cookingSession) return;
  const completed = new Set(cookingSession.completedSteps);
  if (cookingStepDone.checked) completed.add(cookingSession.activeStep);
  else completed.delete(cookingSession.activeStep);
  cookingSession.completedSteps = [...completed].sort((a, b) => a - b);
  saveCookingSession();
  renderCookingMode();
}

function changeCookingStep(delta) {
  if (!cookingSession) return;
  const recipe = recipes.find((item) => item.id === cookingSession.recipeId);
  const steps = recipeSteps(recipe?.notes);
  cookingSession.activeStep = Math.min(
    Math.max(0, cookingSession.activeStep + delta),
    Math.max(0, steps.length - 1)
  );
  saveCookingSession();
  renderCookingMode();
  cookingStepText.focus?.();
}

function resetCookingProgress() {
  if (!cookingSession) return;
  const hasProgress =
    cookingSession.checkedIngredients.length ||
    cookingSession.completedSteps.length ||
    cookingSession.timers.length;
  if (hasProgress && !window.confirm("Start this cooking session over and remove its timers?")) return;
  const recipe = recipes.find((item) => item.id === cookingSession.recipeId);
  if (!recipe) return;
  cookingSession = createCookingSession(recipe, cookingSession.servings);
  saveCookingSession();
  updateCookingTimers();
  renderCookingMode();
}

function addCookingTimer(quickMinutes = 0) {
  if (!cookingSession) return;
  const minutes = quickMinutes || Number(cookingTimerMinutes.value);
  if (!Number.isFinite(minutes) || minutes < 0.01 || minutes > 720) {
    window.alert("Enter a timer from 0.01 to 720 minutes.");
    cookingTimerMinutes.focus();
    return;
  }
  const durationMs = Math.round(minutes * 60 * 1000);
  const defaultLabel = `Step ${cookingSession.activeStep + 1} timer`;
  const label = cookingTimerName.value.trim() || defaultLabel;
  cookingSession.timers.push({
    id: crypto.randomUUID(),
    label: label.slice(0, 40),
    durationMs,
    status: "running",
    remainingMs: durationMs,
    endAt: Date.now() + durationMs,
    announced: false
  });
  cookingTimerName.value = "";
  saveCookingSession();
  ensureCookingTimerTicker();
  renderCookingTimers();
  renderCookingSessionStatus(`${label} started`);
}

function handleCookingTimerAction(event) {
  const button = event.target.closest("[data-timer-action]");
  if (!button || !cookingSession) return;
  const timer = cookingSession.timers.find((item) => item.id === button.dataset.timerId);
  if (!timer) return;
  const action = button.dataset.timerAction;
  if (action === "remove") {
    cookingSession.timers = cookingSession.timers.filter((item) => item.id !== timer.id);
  } else if (action === "pause" && timer.status === "running") {
    timer.remainingMs = Math.max(0, timer.endAt - Date.now());
    timer.status = "paused";
  } else if (action === "resume" && timer.status === "paused") {
    timer.endAt = Date.now() + timer.remainingMs;
    timer.status = "running";
  } else if (action === "restart" && timer.status === "done") {
    timer.remainingMs = timer.durationMs;
    timer.endAt = Date.now() + timer.durationMs;
    timer.status = "running";
    timer.announced = false;
  }
  saveCookingSession();
  updateCookingTimers();
  renderCookingTimers();
}

function cookingTimerRemaining(timer) {
  if (timer.status === "running") return Math.max(0, timer.endAt - Date.now());
  if (timer.status === "paused") return Math.max(0, timer.remainingMs);
  return 0;
}

function renderCookingTimers() {
  cookingTimers.innerHTML = "";
  if (!cookingSession?.timers.length) {
    cookingTimers.innerHTML = '<p class="empty">No timers running.</p>';
    return;
  }

  cookingSession.timers.forEach((timer) => {
    const row = document.createElement("article");
    row.className = `cooking-timer ${timer.status}`;
    row.dataset.timerId = timer.id;
    const summary = document.createElement("span");
    const label = document.createElement("strong");
    label.textContent = timer.label;
    const time = document.createElement("time");
    time.textContent = timer.status === "done" ? "Finished" : formatCookingTimer(cookingTimerRemaining(timer));
    summary.append(label, time);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.dataset.timerId = timer.id;
    toggle.dataset.timerAction = timer.status === "running" ? "pause" : timer.status === "paused" ? "resume" : "restart";
    toggle.textContent = timer.status === "running" ? "Pause" : timer.status === "paused" ? "Resume" : "Restart";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.dataset.timerId = timer.id;
    remove.dataset.timerAction = "remove";
    remove.textContent = "Remove";
    row.append(summary, toggle, remove);
    cookingTimers.appendChild(row);
  });
}

function formatCookingTimer(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function updateCookingTimers() {
  if (!cookingSession) {
    stopCookingTimerTicker();
    return;
  }
  const finished = [];
  let changed = false;
  cookingSession.timers.forEach((timer) => {
    if (timer.status !== "running") return;
    const remaining = timer.endAt - Date.now();
    if (remaining <= 0) {
      timer.remainingMs = 0;
      timer.status = "done";
      changed = true;
      if (!timer.announced) {
        timer.announced = true;
        finished.push(timer);
      }
    } else {
      timer.remainingMs = remaining;
    }
  });
  if (changed) saveCookingSession();
  if (cookingMode.open) renderCookingTimers();
  finished.forEach(announceCookingTimer);
  ensureCookingTimerTicker();
}

function announceCookingTimer(timer) {
  const message = `${timer.label} is finished`;
  if (cookingMode.open) renderCookingSessionStatus(message);
  else setSaveStatus(message, 6000);
  try {
    navigator.vibrate?.([250, 150, 250]);
  } catch {
    // Vibration is optional.
  }
}

function ensureCookingTimerTicker() {
  const hasRunningTimer = cookingSession?.timers.some((timer) => timer.status === "running");
  if (hasRunningTimer && !cookingTimerTicker) {
    cookingTimerTicker = window.setInterval(updateCookingTimers, 1000);
  } else if (!hasRunningTimer) {
    stopCookingTimerTicker();
  }
}

function stopCookingTimerTicker() {
  if (!cookingTimerTicker) return;
  window.clearInterval(cookingTimerTicker);
  cookingTimerTicker = null;
}

async function requestCookingWakeLock() {
  if (!cookingMode.open || document.visibilityState !== "visible") return;
  if (!navigator.wakeLock?.request) {
    cookingWakeStatus.textContent = "Screen-awake control is not available here.";
    return;
  }
  if (cookingWakeLock && !cookingWakeLock.released) return;
  try {
    cookingWakeLock = await navigator.wakeLock.request("screen");
    cookingWakeStatus.textContent = "Screen will stay awake while cooking.";
    cookingWakeLock.addEventListener("release", () => {
      cookingWakeLock = null;
      if (cookingMode.open) cookingWakeStatus.textContent = "Screen-awake control was released.";
    });
  } catch {
    cookingWakeStatus.textContent = "Screen sleep setting was not changed.";
  }
}

async function releaseCookingWakeLock() {
  const activeLock = cookingWakeLock;
  cookingWakeLock = null;
  if (!activeLock || activeLock.released) return;
  try {
    await activeLock.release();
  } catch {
    // The browser may have already released it.
  }
}

function handleCookingVisibilityChange() {
  updateCookingTimers();
  if (document.visibilityState === "visible" && cookingMode.open) {
    requestCookingWakeLock();
  }
}

function finishCookingSession() {
  if (!cookingSession) return;
  const recipe = recipes.find((item) => item.id === cookingSession.recipeId);
  if (!recipe) return;
  const ingredientTotal = recipe.ingredients?.length || 0;
  const stepTotal = recipeSteps(recipe.notes).length;
  const unfinished =
    cookingSession.checkedIngredients.length < ingredientTotal ||
    cookingSession.completedSteps.length < stepTotal;
  if (unfinished && !window.confirm("Some ingredients or steps are not checked. Finish cooking anyway?")) return;

  selectedRecipeId = recipe.id;
  targetServings.value = cookingSession.servings;
  if (!cookSelectedMeal()) return;

  cookingSession = null;
  saveCookingSession();
  stopCookingTimerTicker();
  closeCookingMode();
  renderRecipeShowcase();
}

function ingredientImageUrl(name) {
  const key = ingredientImageKey(name);
  const aliases = window.BOB_MARY_INGREDIENT_IMAGE_ALIASES || {};
  return `images/ingredients/${aliases[key] || key}.webp`;
}

function ingredientRemoteImageUrl(name) {
  const key = ingredientImageKey(name);
  const remoteName = key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("_");
  return `https://www.themealdb.com/images/ingredients/${encodeURIComponent(remoteName)}.png`;
}

function ingredientImageKey(name) {
  const cleaned = String(name || "")
    .toLowerCase()
    .replace(/\b(favorite|fresh|frozen|boneless|skinless|shredded|mixed|lipton)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  const stockMap = [
    ["black pepper", "black_pepper"],
    ["pepper", "pepper"],
    ["canola oil", "canola_oil"],
    ["peanut oil", "peanut_oil"],
    ["sesame oil", "sesame_oil"],
    ["vegetable oil", "vegetable_oil"],
    ["olive oil", "olive_oil"],
    ["oil", "oil"],
    ["ground beef", "ground_beef"],
    ["minced beef", "minced_beef"],
    ["t bone", "t_bone_steak"],
    ["porterhouse", "porterhouse"],
    ["filet mignon", "filet_mignon"],
    ["new york strip", "new_york_strip"],
    ["york strip", "new_york_strip"],
    ["flank steak", "flank_steak"],
    ["skirt steak", "skirt_steak"],
    ["round steak", "round_steak"],
    ["cube steak", "cube_steak"],
    ["short rib", "short_ribs"],
    ["short ribs", "short_ribs"],
    ["beef rib", "beef_ribs"],
    ["beef ribs", "beef_ribs"],
    ["beef shank", "beef_shank"],
    ["top round", "top_round"],
    ["bottom round", "bottom_round"],
    ["prime rib roast", "prime_rib_roast"],
    ["prime rib", "prime_rib_roast"],
    ["hanger steak", "hanger_steak"],
    ["skirt steak", "skirt_steak"],
    ["beef roast", "beef_roast"],
    ["pot roast", "pot_roast"],
    ["rump roast", "rump_roast"],
    ["eye round", "eye_round_roast"],
    ["beef tenderloin", "beef_tenderloin"],
    ["london broil", "london_broil"],
    ["corned beef", "corned_beef"],
    ["ribeye", "ribeye"],
    ["sirloin", "sirloin"],
    ["tuna steak", "tuna_steaks"],
    ["pork steak", "pork_steak"],
    ["ham steak", "ham_steak"],
    ["beef steak", "beef_steak"],
    ["steak", "beef_steak"],
    ["chuck roast", "chuck_roast"],
    ["brisket", "brisket"],
    ["stew meat", "stew_meat"],
    ["pork roast", "pork_roast"],
    ["roast", "beef_roast"],
    ["hamburger", "ground_beef"],
    ["beef", "beef"],
    ["half chicken", "half_chicken"],
    ["chicken tender", "chicken_tenders"],
    ["chicken breast", "chicken_breast"],
    ["chicken thigh", "chicken_thighs"],
    ["whole chicken", "whole_chicken"],
    ["leg quarter", "chicken_leg_quarters"],
    ["chicken leg", "chicken_legs"],
    ["chicken cutlet", "chicken_cutlets"],
    ["thin chicken breast", "thin_chicken_breast"],
    ["split chicken breast", "split_chicken_breast"],
    ["bone in chicken thigh", "bone_in_chicken_thighs"],
    ["boneless chicken thigh", "boneless_chicken_thighs"],
    ["chicken drumstick", "chicken_drumsticks"],
    ["wingette", "chicken_wingettes"],
    ["gizzard", "chicken_gizzards"],
    ["chicken liver", "chicken_liver"],
    ["chicken wing", "chicken_wings"],
    ["ground chicken", "ground_chicken"],
    ["drumstick", "drumsticks"],
    ["wing", "wings"],
    ["chicken", "chicken"],
    ["pork tenderloin", "pork_tenderloin"],
    ["pork rib", "pork_ribs"],
    ["pork chop", "pork_chops"],
    ["pork steak", "pork_steak"],
    ["pork butt", "pork_butt"],
    ["pork shoulder", "pork_shoulder"],
    ["pork loin", "pork_loin"],
    ["pork belly", "pork_belly"],
    ["baby back", "baby_back_ribs"],
    ["spare rib", "spare_ribs"],
    ["country style rib", "country_style_ribs"],
    ["ground pork", "ground_pork"],
    ["minced pork", "minced_pork"],
    ["pork cutlet", "pork_cutlets"],
    ["pork sausage", "pork_sausage"],
    ["breakfast sausage", "breakfast_sausage"],
    ["italian sausage", "italian_sausage"],
    ["bratwurst", "bratwurst"],
    ["smoked sausage", "smoked_sausage"],
    ["ham steak", "ham_steak"],
    ["sausage", "sausage"],
    ["bacon", "bacon"],
    ["ham", "ham"],
    ["pork", "pork"],
    ["egg", "egg"],
    ["milk", "milk"],
    ["cheese", "cheese"],
    ["butter", "butter"],
    ["onion", "onion"],
    ["garlic", "garlic"],
    ["potato", "potato"],
    ["tomato", "tomato"],
    ["lettuce", "lettuce"],
    ["bell pepper", "bell_pepper"],
    ["green pepper", "green_pepper"],
    ["red pepper", "red_pepper"],
    ["jalapeno", "jalapeno"],
    ["mushroom", "mushrooms"],
    ["corn", "corn"],
    ["pea", "peas"],
    ["green bean", "green_beans"],
    ["broccoli", "broccoli"],
    ["cabbage", "cabbage"],
    ["cucumber", "cucumber"],
    ["spinach", "spinach"],
    ["asparagus", "asparagus"],
    ["zucchini", "zucchini"],
    ["squash", "squash"],
    ["sweet potato", "sweet_potato"],
    ["green onion", "green_onion"],
    ["red onion", "red_onion"],
    ["shallot", "shallot"],
    ["ginger", "ginger"],
    ["cilantro", "cilantro"],
    ["apple", "apple"],
    ["banana", "banana"],
    ["orange", "orange"],
    ["strawberry", "strawberry"],
    ["blueberry", "blueberry"],
    ["avocado", "avocado"],
    ["lemon", "lemon"],
    ["lime", "lime"],
    ["spaghetti", "spaghetti"],
    ["rice noodle", "rice_noodles"],
    ["egg noodle", "egg_noodles"],
    ["noodle", "noodles"],
    ["penne", "penne"],
    ["lasagna", "lasagna"],
    ["ramen", "ramen"],
    ["macaroni", "macaroni"],
    ["pasta", "macaroni"],
    ["brown rice", "brown_rice"],
    ["basmati rice", "basmati_rice"],
    ["jasmine rice", "jasmine_rice"],
    ["rice", "rice"],
    ["quinoa", "quinoa"],
    ["couscous", "couscous"],
    ["favorite side dish", "rice"],
    ["side dish", "rice"],
    ["mixed vegetable", "green_beans"],
    ["black bean", "black_beans"],
    ["kidney bean", "kidney_beans"],
    ["pinto bean", "pinto_beans"],
    ["refried bean", "refried_beans"],
    ["baked bean", "baked_beans"],
    ["cannellini bean", "cannellini_beans"],
    ["chili bean", "chili_beans"],
    ["chickpea", "chickpeas"],
    ["lentil", "lentils"],
    ["split pea", "split_peas"],
    ["bean", "beans"],
    ["bread flour", "bread_flour"],
    ["flour", "flour"],
    ["cornmeal", "cornmeal"],
    ["cornstarch", "cornstarch"],
    ["baking powder", "baking_powder"],
    ["yeast", "yeast"],
    ["powdered sugar", "powdered_sugar"],
    ["sugar", "sugar"],
    ["brown sugar", "brown_sugar"],
    ["oats", "oats"],
    ["cereal", "cereal"],
    ["salt", "salt"],
    ["ketchup", "ketchup"],
    ["ketup", "ketchup"],
    ["ketsup", "ketchup"],
    ["catsup", "ketchup"],
    ["mustard", "mustard"],
    ["mayonnaise", "mayonnaise"],
    ["mayo", "mayonnaise"],
    ["miracle whip", "mayonnaise"],
    ["relish", "relish"],
    ["pickle", "pickles"],
    ["salsa", "salsa"],
    ["ranch", "ranch"],
    ["salad dressing", "salad_dressing"],
    ["marinara", "marinara"],
    ["tomato sauce", "tomato_sauce"],
    ["tomato paste", "tomato_paste"],
    ["diced tomato", "diced_tomatoes"],
    ["stewed tomato", "stewed_tomatoes"],
    ["corned beef hash", "corned_beef_hash"],
    ["cream of mushroom", "cream_of_mushroom"],
    ["cream of chicken", "cream_of_chicken"],
    ["cream cheese", "cream_cheese"],
    ["sweetened condensed milk", "sweetened_condensed_milk"],
    ["apple cider vinegar", "apple_cider_vinegar"],
    ["balsamic vinegar", "balsamic_vinegar"],
    ["red wine vinegar", "red_wine_vinegar"],
    ["rice vinegar", "rice_vinegar"],
    ["white vinegar", "white_vinegar"],
    ["soy sauce", "soy_sauce"],
    ["fish sauce", "fish_sauce"],
    ["hoisin sauce", "hoisin_sauce"],
    ["oyster sauce", "oyster_sauce"],
    ["sweet and sour sauce", "sweet_and_sour_sauce"],
    ["chili sauce", "chili_sauce"],
    ["duck sauce", "duck_sauce"],
    ["worcestershire", "worcestershire"],
    ["bbq sauce", "bbq_sauce"],
    ["barbecue sauce", "bbq_sauce"],
    ["hot sauce", "hot_sauce"],
    ["vinegar", "vinegar"],
    ["honey", "honey"],
    ["brown sugar", "brown_sugar"],
    ["thyme", "thyme"],
    ["rosemary", "rosemary"],
    ["bay leaf", "bay_leaf"],
    ["cinnamon", "cinnamon"],
    ["nutmeg", "nutmeg"],
    ["cayenne", "cayenne"],
    ["italian seasoning", "italian_seasoning"],
    ["paprika", "paprika"],
    ["cumin", "cumin"],
    ["chili powder", "chili_powder"],
    ["onion powder", "onion_powder"],
    ["garlic powder", "garlic_powder"],
    ["parsley", "parsley"],
    ["oregano", "oregano"],
    ["basil", "basil"],
    ["breadcrumb", "breadcrumbs"],
    ["bread roll", "bread_rolls"],
    ["burger bun", "buns"],
    ["hot dog bun", "hot_dog_buns"],
    ["bun", "buns"],
    ["pie crust", "pie_crust"],
    ["pancake mix", "pancake_mix"],
    ["bouillon cube", "bouillon_cubes"],
    ["peanut butter", "peanut_butter"],
    ["peanut", "peanuts"],
    ["jam", "jam"],
    ["maple syrup", "maple_syrup"],
    ["kosher salt", "kosher_salt"],
    ["sea salt", "sea_salt"],
    ["table salt", "table_salt"],
    ["celery salt", "celery_salt"],
    ["garlic salt", "garlic_salt"],
    ["lemon pepper", "lemon_pepper"],
    ["white pepper", "white_pepper"],
    ["red pepper flakes", "red_pepper_flakes"],
    ["crushed red pepper", "crushed_red_pepper"],
    ["cayenne pepper", "cayenne_pepper"],
    ["smoked paprika", "smoked_paprika"],
    ["sweet paprika", "sweet_paprika"],
    ["ground cumin", "ground_cumin"],
    ["coriander", "coriander"],
    ["turmeric", "turmeric"],
    ["curry powder", "curry_powder"],
    ["garam masala", "garam_masala"],
    ["cajun", "cajun_seasoning"],
    ["taco seasoning", "taco_seasoning"],
    ["fajita seasoning", "fajita_seasoning"],
    ["poultry seasoning", "poultry_seasoning"],
    ["steak seasoning", "steak_seasoning"],
    ["old bay", "old_bay"],
    ["adobo", "adobo_seasoning"],
    ["dill", "dill"],
    ["chives", "chives"],
    ["mint", "mint"],
    ["tarragon", "tarragon"],
    ["marjoram", "marjoram"],
    ["sage", "sage"],
    ["clove", "cloves"],
    ["allspice", "allspice"],
    ["vanilla extract", "vanilla_extract"],
    ["almond extract", "almond_extract"],
    ["dijon mustard", "dijon_mustard"],
    ["spicy brown mustard", "spicy_brown_mustard"],
    ["honey mustard", "honey_mustard"],
    ["steak sauce", "steak_sauce"],
    ["a1 sauce", "a1_sauce"],
    ["teriyaki", "teriyaki_sauce"],
    ["buffalo sauce", "buffalo_sauce"],
    ["sriracha", "sriracha"],
    ["cocktail sauce", "cocktail_sauce"],
    ["tartar sauce", "tartar_sauce"],
    ["horseradish", "horseradish"],
    ["pico de gallo", "pico_de_gallo"],
    ["guacamole", "guacamole"],
    ["blue cheese dressing", "blue_cheese_dressing"],
    ["italian dressing", "italian_dressing"],
    ["caesar dressing", "caesar_dressing"],
    ["thousand island", "thousand_island"],
    ["french dressing", "french_dressing"],
    ["balsamic vinaigrette", "balsamic_vinaigrette"],
    ["alfredo", "alfredo_sauce"],
    ["pesto", "pesto"],
    ["enchilada sauce", "enchilada_sauce"],
    ["taco sauce", "taco_sauce"],
    ["taco shell", "taco_shells"],
    ["smoked salmon", "smoked_salmon"],
    ["salmon fillet", "salmon_fillets"],
    ["salmon", "salmon"],
    ["catfish", "catfish"],
    ["mahi", "mahi_mahi"],
    ["oyster", "oysters"],
    ["calamari", "calamari"],
    ["anchovy", "anchovies"],
    ["lobster tail", "lobster_tails"],
    ["lobster", "lobster"],
    ["mussel", "mussels"],
    ["clam", "clams"],
    ["crab meat", "crab"],
    ["crab leg", "crab"],
    ["crab cake", "crab_cakes"],
    ["crab", "crab"],
    ["sea scallop", "sea_scallops"],
    ["bay scallop", "bay_scallops"],
    ["scallop", "scallops"],
    ["cod", "cod"],
    ["tuna steak", "tuna_steaks"],
    ["canned tuna", "canned_tuna"],
    ["tuna", "tuna"],
    ["raw shrimp", "raw_shrimp"],
    ["cooked shrimp", "cooked_shrimp"],
    ["jumbo shrimp", "jumbo_shrimp"],
    ["shrimp", "shrimp"],
    ["ground turkey", "ground_turkey"],
    ["turkey leg", "turkey_legs"],
    ["turkey wing", "turkey_wings"],
    ["turkey cutlet", "turkey_cutlets"],
    ["turkey tenderloin", "turkey_tenderloin"],
    ["white fish", "white_fish"],
    ["fish fillet", "fish_fillets"],
    ["fish stick", "fish_sticks"],
    ["haddock", "haddock"],
    ["halibut", "halibut"],
    ["flounder", "flounder"],
    ["rainbow trout", "rainbow_trout"],
    ["salt cod", "salt_cod"],
    ["snapper", "snapper"],
    ["grouper", "grouper"],
    ["trout", "trout"],
    ["swordfish", "swordfish"],
    ["sea bass fillet", "sea_bass_fillets"],
    ["sea bass", "sea_bass"],
    ["pollock", "pollock"],
    ["sardine", "sardines"],
    ["fish", "fish"],
    ["carrot", "carrot"],
    ["celery", "celery"],
    ["chicken broth", "chicken_broth"],
    ["beef broth", "beef_broth"],
    ["vegetable broth", "vegetable_broth"],
    ["broth", "broth"],
    ["stock", "broth"],
    ["tortilla", "tortillas"],
    ["mozzarella", "mozzarella"],
    ["cheddar", "cheddar"],
    ["swiss", "swiss"],
    ["feta", "feta"],
    ["ricotta", "ricotta"],
    ["cottage cheese", "cottage_cheese"],
    ["half and half", "half_and_half"],
    ["whipped cream", "whipped_cream"],
    ["ice cream", "ice_cream"],
    ["hot dog", "hot_dogs"],
    ["pepperoni", "pepperoni"],
    ["chorizo", "chorizo"],
    ["turkey breast", "turkey_breast"],
    ["turkey", "turkey"],
    ["meatball", "meatballs"],
    ["lamb", "lamb"],
    ["duck", "duck"],
    ["bread", "bread"]
  ];

  const found = stockMap.reduce((best, entry) => {
    if (!cleaned.includes(entry[0])) return best;
    return !best || entry[0].length > best[0].length ? entry : best;
  }, null);
  return found ? found[1] : cleaned.split(/\s+/).slice(0, 2).join("_") || "chicken";
}

function getScaledIngredients(recipe = selectedRecipe()) {
  if (!recipe) return [];

  return scaleRecipeIngredients(recipe, cleanNumber(targetServings.value, 1));
}

function scaleRecipeIngredients(recipe, people) {
  const base = cleanNumber(recipe.baseServings, 1);
  const multiplier = people / base;
  return recipe.ingredients.map((ingredient) => ({
    amount: cleanNumber(ingredient.amount, 0) * multiplier,
    unit: ingredient.unit || "",
    name: ingredient.name || ""
  }));
}

function addIngredientRow(ingredient = { amount: "", unit: "", name: "" }) {
  const fragment = ingredientTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".ingredient-row");
  row.querySelector(".amount").value = ingredient.amount;
  row.querySelector(".unit").value = ingredient.unit;
  row.querySelector(".name").value = ingredient.name;
  row.querySelector(".remove").addEventListener("click", () => {
    captureEditorUndoOnce();
    row.remove();
    saveCurrentFieldsQuietly();
  });

  row.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      captureEditorUndoOnce();
      saveCurrentFieldsQuietly();
      renderMealViews();
      renderRecipeList();
    });
  });

  ingredientRows.appendChild(fragment);
}

function collectEditorRecipe(existingId = selectedRecipeId) {
  const existing = recipes.find((recipe) => recipe.id === existingId);
  const ingredients = [...ingredientRows.querySelectorAll(".ingredient-row")]
    .map((row) => ({
      amount: cleanNumber(row.querySelector(".amount").value, 0),
      unit: row.querySelector(".unit").value.trim(),
      name: row.querySelector(".name").value.trim()
    }))
    .filter((ingredient) => ingredient.name);

  return {
    id: existingId || crypto.randomUUID(),
    name: recipeName.value.trim() || "Untitled recipe",
    baseServings: cleanNumber(baseServings.value, 1),
    prepTime: recipePrepTime.value.trim(),
    cookTime: recipeCookTime.value.trim(),
    totalTime: recipeTotalTime.value.trim(),
    temperature: recipeTemperature.value.trim(),
    sourceUrl: recipeSourceUrl.value.trim(),
    notes: recipeNotes.value.trim(),
    ingredients,
    photo: existing?.photo || ""
  };
}

function saveSelectedRecipe(event) {
  event.preventDefault();
  const recipe = collectEditorRecipe(selectedRecipeId);
  const error = recipeValidationError(recipe);
  if (error) {
    window.alert(error);
    return;
  }
  const index = recipes.findIndex((item) => item.id === selectedRecipeId);
  if (index >= 0) recipes[index] = recipe;
  persistRecipes();
  editorUndoArmed = true;
  render();
  setSaveStatus("Recipe saved", 1800);
}

function saveCurrentFieldsQuietly() {
  const index = recipes.findIndex((recipe) => recipe.id === selectedRecipeId);
  if (index === -1) return;

  recipes[index] = collectEditorRecipe(selectedRecipeId);
  persistRecipes();
}

function recipeValidationError(recipe) {
  if (!String(recipe?.name || "").trim() || /^untitled recipe$/i.test(recipe.name)) {
    return "Give this recipe a name before saving it.";
  }
  if (!Array.isArray(recipe.ingredients) || !recipe.ingredients.length) {
    return "Add at least one ingredient before saving this recipe.";
  }
  const invalid = recipe.ingredients.find((ingredient) =>
    !String(ingredient.name || "").trim() || cleanNumber(ingredient.amount, 0) <= 0
  );
  if (invalid) return "Every ingredient needs a name and an amount greater than zero.";
  return "";
}

function isRecipeComplete(recipe) {
  return recipeValidationError(recipe) === "";
}

function createRecipe() {
  captureUndo("new recipe");
  const recipe = {
    id: crypto.randomUUID(),
    name: "New recipe",
    baseServings: cleanNumber(targetServings.value, 2),
    prepTime: "",
    cookTime: "",
    totalTime: "",
    temperature: "",
    sourceUrl: "",
    notes: "",
    photo: "",
    ingredients: [{ amount: 1, unit: "", name: "" }]
  };
  recipes.unshift(recipe);
  selectedRecipeId = recipe.id;
  editorUndoArmed = true;
  persistRecipes();
  render();
  recipeName.focus();
  recipeName.select();
}

function addRecipePhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  captureUndo("recipe photo");

  const reader = new FileReader();
  reader.onload = () => {
    resizePhoto(reader.result, (photo) => {
      const index = recipes.findIndex((recipe) => recipe.id === selectedRecipeId);
      if (index === -1) return;

      recipes[index].photo = photo;
      persistRecipes();
      render();
    });
  };
  reader.readAsDataURL(file);
  event.target.value = "";
}

function resizePhoto(source, done) {
  const image = new Image();
  image.onload = () => {
    const maxSize = 1000;
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    done(canvas.toDataURL("image/jpeg", 0.82));
  };
  image.onerror = () => done(source);
  image.src = source;
}

function clearRecipePhoto() {
  const index = recipes.findIndex((recipe) => recipe.id === selectedRecipeId);
  if (index === -1) return;
  if (!recipes[index].photo) return;
  captureUndo("remove recipe photo");

  recipes[index].photo = "";
  persistRecipes();
  render();
}

function buildRecipeFromChoices() {
  if (!builderState.main || !builderState.kind || !builderState.style) return null;

  const kindLabel = builderOptions[builderState.main].kinds[builderState.kind];
  const styleLabel = builderStyles[builderState.style];
  const people = cleanNumber(targetServings.value, 2);
  const savedTemplate = builderTemplates[builderTemplateKey()];
  if (savedTemplate) {
    return {
      ...savedTemplate,
      id: savedTemplate.id || crypto.randomUUID(),
      baseServings: cleanNumber(savedTemplate.baseServings, people),
      ingredients: Array.isArray(savedTemplate.ingredients) ? savedTemplate.ingredients : []
    };
  }

  const templateRecipe = builtMealTemplate(builderState.kind, styleLabel, people);
  if (templateRecipe) return templateRecipe;

  const protein = proteinAmount(builderState.kind, people);
  const ingredients = [
    { amount: protein.amount, unit: protein.unit, name: kindLabel.toLowerCase() },
    { amount: 1, unit: "tbsp", name: "olive oil or butter" },
    { amount: 0.5, unit: "tsp", name: "salt" },
    { amount: 0.25, unit: "tsp", name: "black pepper" },
    { amount: 1, unit: "tsp", name: "garlic powder" },
    { amount: people, unit: "servings", name: "favorite side dish" }
  ];

  if (builderState.style === "soup") {
    ingredients.push(
      { amount: 4, unit: "cups", name: "broth" },
      { amount: 2, unit: "cups", name: "mixed vegetables" }
    );
  }

  return {
    id: crypto.randomUUID(),
    name: `${styleLabel} ${kindLabel}`,
    baseServings: people,
    notes: buildPrepSteps(kindLabel, styleLabel),
    photo: "",
    ingredients
  };
}

function builderTemplateKey() {
  if (!builderState.main || !builderState.kind || !builderState.style) return "";
  return `${builderState.main}|${builderState.kind}|${builderState.style}`;
}

function builtMealTemplate(kind, styleLabel, people) {
  if (kind === "meatloaf") {
    return {
      id: crypto.randomUUID(),
      name: "Meatloaf",
      baseServings: people,
      notes: [
        "Heat oven to 350 degrees.",
        "Mix ground meat, eggs, onion soup mix, ketchup, salt, pepper, onion powder, and breadcrumbs in a bowl.",
        "Shape into a loaf and place in a baking dish.",
        "Spread a little ketchup on top.",
        "Bake until cooked through, then let it rest for 5 to 10 minutes before slicing."
      ].join("\n"),
      photo: "",
      ingredients: scaleTemplateIngredients(people, 4, [
        { amount: 1, unit: "lb", name: "ground beef" },
        { amount: 2, unit: "eggs", name: "eggs" },
        { amount: 0.5, unit: "cup", name: "ketchup" },
        { amount: 1, unit: "packet", name: "Lipton onion soup mix" },
        { amount: 0.75, unit: "cup", name: "breadcrumbs" },
        { amount: 0.5, unit: "tsp", name: "salt" },
        { amount: 0.25, unit: "tsp", name: "black pepper" },
        { amount: 0.5, unit: "tsp", name: "onion powder" }
      ])
    };
  }

  if (kind === "hamburger") {
    return {
      id: crypto.randomUUID(),
      name: `${styleLabel} Hamburgers`,
      baseServings: people,
      notes: [
        "Shape the ground beef into patties.",
        "Season both sides with salt, pepper, and onion powder.",
        `Cook using the ${styleLabel.toLowerCase()} method until done the way you like.`,
        "Serve on buns with cheese, ketchup, mustard, lettuce, tomato, or pickles."
      ].join("\n"),
      photo: "",
      ingredients: scaleTemplateIngredients(people, 4, [
        { amount: 1.5, unit: "lb", name: "ground beef" },
        { amount: 4, unit: "buns", name: "hamburger buns" },
        { amount: 4, unit: "slices", name: "cheese" },
        { amount: 0.25, unit: "cup", name: "ketchup" },
        { amount: 0.25, unit: "cup", name: "mustard" },
        { amount: 0.5, unit: "tsp", name: "salt" },
        { amount: 0.25, unit: "tsp", name: "black pepper" },
        { amount: 0.5, unit: "tsp", name: "onion powder" }
      ])
    };
  }

  return null;
}

function scaleTemplateIngredients(people, basePeople, ingredients) {
  const multiplier = people / basePeople;
  return ingredients.map((ingredient) => ({
    ...ingredient,
    amount: ingredient.amount * multiplier
  }));
}

function proteinAmount(kind, people) {
  if (kind === "hamburger") return { amount: people, unit: "patties" };
  if (kind === "half") return { amount: Math.max(1, Math.ceil(people / 2)), unit: "half chickens" };
  if (kind === "roast") return { amount: Math.max(2, people * 0.5), unit: "lb" };
  if (kind === "ribs") return { amount: Math.max(1, people * 0.5), unit: "racks" };
  if (kind === "shrimp") return { amount: people * 0.33, unit: "lb" };
  if (kind === "pasta" || kind === "beans" || kind === "soup") return { amount: people, unit: "servings" };
  return { amount: people * 0.5, unit: "lb" };
}

function buildPrepSteps(kindLabel, styleLabel) {
  return [
    `Prep the ${kindLabel.toLowerCase()} and pat it dry if needed.`,
    "Season with salt, pepper, garlic powder, and any favorite seasoning.",
    `Cook using the ${styleLabel.toLowerCase()} method until done and safe to eat.`,
    "Let it rest for a few minutes when needed, then serve with your side dish."
  ].join("\n");
}

function saveBuilderMeal() {
  const recipe = buildRecipeFromChoices();
  if (!recipe) return;

  captureUndo("built meal");
  recipes.unshift(recipe);
  selectedRecipeId = recipe.id;
  persistRecipes();
  render();
  focusSection(recipeForm, recipeName);
}

function resetBuilder() {
  builderState = { main: "", kind: "", style: "" };
  renderMealBuilder();
}

function goBackBuilder() {
  if (builderState.style) {
    builderState.style = "";
  } else if (builderState.kind) {
    builderState.kind = "";
  } else if (builderState.main) {
    builderState.main = "";
  }
  renderMealBuilder();
}

function reviewRecipeFromPaste() {
  const pasted = recipePasteBox.value.trim();
  if (!pasted) {
    alert("Paste a recipe into the box first.");
    recipePasteBox.focus();
    return;
  }

  try {
    openRecipeReview(parsePastedRecipe(pasted), "Pasted recipe ready to check.");
  } catch (error) {
    recipeReadStatus.textContent = error?.message || "I could not read that pasted recipe.";
  }
}

function parsePastedRecipe(text) {
  return normalizeRecipe({
    id: crypto.randomUUID(),
    ...MealPlannerRecipeReader.parseText(text, {
      baseServings: cleanNumber(targetServings.value, 2)
    })
  });
}

function looksLikeIngredient(line) {
  return MealPlannerRecipeReader.looksLikeIngredient(line);
}

function parseIngredientLine(line) {
  return MealPlannerRecipeReader.parseIngredientLine(line);
}

async function reviewRecipeFromUrl() {
  const value = recipeUrlInput.value.trim();
  let sourceUrl;
  try {
    sourceUrl = new URL(value);
    if (sourceUrl.protocol !== "https:") throw new Error("Use a secure recipe website link beginning with https.");
    if (!isPublicRecipeUrl(sourceUrl)) throw new Error("Use a public recipe website link.");
  } catch (error) {
    recipeReadStatus.textContent = error?.message || "Enter a complete recipe website link.";
    recipeUrlInput.focus();
    return;
  }

  readRecipeUrl.disabled = true;
  recipeReadStatus.textContent = "Reading the recipe website...";
  try {
    const page = await fetchRecipePage(sourceUrl.href);
    const draft = MealPlannerRecipeReader.parseHtml(page.html, page.finalUrl || sourceUrl.href);
    openRecipeReview(draft, "Website recipe ready to check.");
  } catch (error) {
    recipeReadStatus.textContent = error?.message
      || "That website would not share its recipe. Paste the recipe words instead.";
  } finally {
    readRecipeUrl.disabled = false;
  }
}

function isPublicRecipeUrl(url) {
  const host = String(url?.hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host === "::1") return false;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((part) => part < 0 || part > 255)) return false;
    if (octets[0] === 0 || octets[0] === 10 || octets[0] === 127 || octets[0] >= 224) return false;
    if (octets[0] === 169 && octets[1] === 254) return false;
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return false;
    if (octets[0] === 192 && octets[1] === 168) return false;
  }
  return !/^(?:fc|fd|fe8|fe9|fea|feb)/i.test(host.replace(/:/g, ""));
}

async function fetchRecipePage(sourceUrl) {
  const attempts = isNativeApp()
    ? [{ direct: true, url: sourceUrl }]
    : [
      { direct: false, url: `/api/recipe?url=${encodeURIComponent(sourceUrl)}` },
      { direct: true, url: sourceUrl }
    ];
  let lastError = null;

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url);
      if (!response.ok) {
        const detail = attempt.direct ? "" : (await response.json().catch(() => null))?.error;
        throw new Error(detail || "That recipe website could not be read.");
      }
      if (attempt.direct) {
        return { html: await response.text(), finalUrl: response.url || sourceUrl };
      }
      const payload = await response.json();
      if (!payload?.html) throw new Error("The recipe page did not contain readable words.");
      return payload;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message || "That website would not share its recipe. Paste the recipe words instead.");
}

async function reviewRecipeFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  recipeReadStatus.textContent = `Reading ${file.name}...`;

  try {
    const text = await MealPlannerReceipts.readFile(file, (message) => {
      recipeReadStatus.textContent = String(message || "").replace(/receipt/gi, "recipe");
    });
    const draft = MealPlannerRecipeReader.parseText(text, {
      baseServings: cleanNumber(targetServings.value, 2)
    });
    openRecipeReview(draft, `${file.name} is ready to check.`);
  } catch (error) {
    recipeReadStatus.textContent = error?.message || "That recipe file could not be read.";
  } finally {
    event.target.value = "";
  }
}

function openRecipeReview(draft, message = "Recipe ready to check.") {
  pendingRecipeDraft = normalizeRecipe({
    ...draft,
    id: crypto.randomUUID(),
    baseServings: cleanNumber(draft?.baseServings, cleanNumber(targetServings.value, 2))
  });
  reviewRecipeName.value = pendingRecipeDraft.name;
  reviewRecipeServings.value = pendingRecipeDraft.baseServings;
  reviewPrepTime.value = pendingRecipeDraft.prepTime;
  reviewCookTime.value = pendingRecipeDraft.cookTime;
  reviewTotalTime.value = pendingRecipeDraft.totalTime;
  reviewTemperature.value = pendingRecipeDraft.temperature;
  reviewSourceUrl.value = pendingRecipeDraft.sourceUrl;
  reviewRecipeNotes.value = pendingRecipeDraft.notes;
  reviewIngredientRows.innerHTML = "";
  const ingredients = pendingRecipeDraft.ingredients.length
    ? pendingRecipeDraft.ingredients
    : [{ amount: 1, unit: "", name: "" }];
  ingredients.forEach(addReviewIngredientRow);

  reviewRecipePhotoBox.hidden = !pendingRecipeDraft.photo;
  if (pendingRecipeDraft.photo) {
    reviewRecipePhoto.src = pendingRecipeDraft.photo;
  } else {
    reviewRecipePhoto.removeAttribute("src");
  }
  recipeReview.hidden = false;
  recipeReadStatus.textContent = message;
  recipeReview.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => reviewRecipeName.focus(), 300);
}

function addReviewIngredientRow(ingredient = { amount: 1, unit: "", name: "" }) {
  const fragment = ingredientTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".ingredient-row");
  row.classList.add("review-ingredient-row");
  row.querySelector(".amount").value = ingredient.amount;
  row.querySelector(".unit").value = ingredient.unit || "";
  row.querySelector(".name").value = ingredient.name || "";
  row.querySelector(".remove").addEventListener("click", () => row.remove());
  reviewIngredientRows.appendChild(fragment);
}

function collectReviewedRecipe() {
  return normalizeRecipe({
    id: pendingRecipeDraft?.id || crypto.randomUUID(),
    name: reviewRecipeName.value.trim() || "Untitled recipe",
    baseServings: cleanNumber(reviewRecipeServings.value, 1),
    prepTime: reviewPrepTime.value.trim(),
    cookTime: reviewCookTime.value.trim(),
    totalTime: reviewTotalTime.value.trim(),
    temperature: reviewTemperature.value.trim(),
    sourceUrl: reviewSourceUrl.value.trim(),
    photo: pendingRecipeDraft?.photo || "",
    notes: reviewRecipeNotes.value.trim(),
    ingredients: [...reviewIngredientRows.querySelectorAll(".ingredient-row")]
      .map((row) => ({
        amount: cleanNumber(row.querySelector(".amount").value, 0),
        unit: row.querySelector(".unit").value.trim(),
        name: row.querySelector(".name").value.trim()
      }))
      .filter((ingredient) => ingredient.name)
  });
}

function commitReviewedRecipe() {
  const recipe = collectReviewedRecipe();
  const error = recipeValidationError(recipe);
  if (error) {
    window.alert(`Please check this recipe before saving. ${error}`);
    return;
  }

  captureUndo("import recipe");
  recipes.unshift(recipe);
  selectedRecipeId = recipe.id;
  persistRecipes();
  clearRecipeReview({ preserveStatus: true });
  recipePasteBox.value = "";
  recipeUrlInput.value = "";
  render();
  setAppView("recipes", { focus: false });
  recipeReadStatus.textContent = `${recipe.name} was saved after review.`;
  focusSection(recipeForm, recipeName);
}

function clearRecipeReview(options = {}) {
  pendingRecipeDraft = null;
  recipeReview.hidden = true;
  reviewIngredientRows.innerHTML = "";
  reviewRecipePhoto.removeAttribute("src");
  if (!options.preserveStatus) recipeReadStatus.textContent = "Nothing is saved until you approve the review.";
}

function deleteSelectedRecipe() {
  if (recipes.length <= 1) return;
  const selected = selectedRecipe();
  if (!window.confirm(`Delete "${selected?.name || "this recipe"}"?`)) return;
  captureUndo("delete recipe");
  const removedId = selectedRecipeId;
  recipes = recipes.filter((recipe) => recipe.id !== selectedRecipeId);
  Object.values(weeklyPlan).forEach((entry) => {
    if (entry.recipeId === removedId) entry.recipeId = "";
  });
  selectedRecipeId = recipes[0].id;
  persistRecipes();
  render();
}

function changePeople(delta) {
  const next = Math.max(1, cleanNumber(targetServings.value, 1) + delta);
  targetServings.value = next;
  renderMealViews();
}

async function copyScaledIngredients() {
  const lines = [...scaledList.querySelectorAll("li")].map((item) => item.innerText.replace(/\n/g, " "));
  const text = [scaleSummary.textContent, ...lines].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    copyList.textContent = "Copied";
    setTimeout(() => (copyList.textContent = "Copy list"), 1200);
  } catch {
    alert(text);
  }
}

function exportRecipes() {
  saveCurrentFieldsQuietly();
  const data = currentPlannerData();
  storeLocalSnapshot("Exported backup", JSON.stringify(data));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Supperloom-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  recoveryStatus.textContent = "Backup file created. Keep it with the thumb drive or in another safe place.";
  setSaveStatus("Backup exported", 2200);
}

async function importRecipes(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const prepared = prepareImportedPlanner(await file.text());
    const issueText = prepared.issues.length
      ? `\n\nI found ${prepared.issues.length} item${prepared.issues.length === 1 ? "" : "s"} to correct:\n- ${prepared.issues.slice(0, 6).join("\n- ")}${prepared.issues.length > 6 ? "\n- More items will be listed after import." : ""}`
      : "";
    if (!window.confirm(`Import this backup and replace the current planner data?${issueText}`)) return;
    storeLocalSnapshot("Before imported backup");
    captureUndo("import backup");
    applyPlannerData(prepared.data);
    selectedRecipeId = recipes[0]?.id || null;
    persistRecipes();
    render();
    setAppView("home", { focus: false });
    recoveryPanel.open = true;
    recoveryStatus.textContent = prepared.issues.length
      ? `Backup imported. ${prepared.issues.length} problem${prepared.issues.length === 1 ? "" : "s"}: ${prepared.issues.join(" ")}`
      : `Backup imported from ${file.name}.`;
    loadBackupChoices({ quiet: true });
  } catch (error) {
    const message = error?.message || "That file is not a meal-planner backup.";
    recoveryPanel.open = true;
    recoveryStatus.textContent = `Import stopped: ${message}`;
    alert(`That backup was not imported. ${message}`);
  } finally {
    event.target.value = "";
  }
}

function prepareImportedPlanner(value) {
  let imported;
  try {
    imported = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  const current = currentPlannerData();
  if (Array.isArray(imported)) {
    imported = { ...current, recipes: imported };
  } else if (imported && typeof imported === "object") {
    const hasOwn = (key) => Object.prototype.hasOwnProperty.call(imported, key);
    const importedPantryOnly = !hasOwn("foodStorage") && hasOwn("pantry");
    imported = { ...current, ...imported };
    if (importedPantryOnly) delete imported.foodStorage;
  }
  if (!imported || typeof imported !== "object" || !Array.isArray(imported.recipes)) {
    throw new Error("The file does not contain a recipes list.");
  }

  const issues = [];
  const importedRecipes = [];
  imported.recipes.forEach((recipe, recipeIndex) => {
    if (!recipe || typeof recipe !== "object") {
      issues.push(`Recipe row ${recipeIndex + 1} was not readable and was skipped.`);
      return;
    }
    const name = String(recipe.name || "").trim() || `Imported recipe ${recipeIndex + 1}`;
    if (!String(recipe.name || "").trim()) issues.push(`Recipe row ${recipeIndex + 1} had no name and was renamed "${name}".`);
    const ingredientSource = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    const ingredients = ingredientSource
      .map((ingredient, ingredientIndex) => {
        const ingredientName = String(ingredient?.name || "").trim();
        const amount = Number(ingredient?.amount);
        if (!ingredientName || !Number.isFinite(amount) || amount <= 0) {
          issues.push(`${name}: ingredient row ${ingredientIndex + 1} was incomplete and was skipped.`);
          return null;
        }
        return { amount, unit: String(ingredient.unit || ""), name: ingredientName };
      })
      .filter(Boolean);
    if (!ingredients.length) {
      issues.push(`${name} had no usable ingredients and was skipped.`);
      return;
    }
    importedRecipes.push(normalizeRecipe({ ...recipe, name, ingredients }));
  });
  if (!importedRecipes.length) throw new Error(`No complete recipes could be read. ${issues.join(" ")}`.trim());

  const storageSource = imported.foodStorage || imported.pantry;
  if (Array.isArray(storageSource)) {
    imported.foodStorage = {
      refrigerator: [],
      freezer: [],
      pantry: reviewImportedFoodRows(storageSource, "Pantry", issues)
    };
  } else if (storageSource && typeof storageSource === "object") {
    imported.foodStorage = {
      refrigerator: reviewImportedFoodRows(storageSource.refrigerator, "Refrigerator", issues),
      freezer: reviewImportedFoodRows(storageSource.freezer, "Freezer", issues),
      pantry: reviewImportedFoodRows(storageSource.pantry, "Pantry", issues)
    };
  }
  delete imported.pantry;

  return {
    data: { ...imported, recipes: importedRecipes },
    issues
  };
}

function reviewImportedFoodRows(value, location, issues) {
  if (!Array.isArray(value)) {
    if (value !== undefined) issues.push(`${location} items were not a readable list and were skipped.`);
    return [];
  }
  return value
    .map((item, index) => {
      const name = String(item?.name || "").trim();
      const amount = Number(item?.amount);
      if (!item || typeof item !== "object" || !name || !Number.isFinite(amount) || amount <= 0) {
        issues.push(`${location} row ${index + 1} was incomplete and was skipped.`);
        return null;
      }
      return { ...item, name, amount };
    })
    .filter(Boolean);
}

function storeLocalSnapshot(label, serialized = localStorage.getItem(storageKey) || JSON.stringify(currentPlannerData())) {
  try {
    const snapshots = MealPlannerRecovery.addSnapshot(
      localStorage.getItem(backupStorageKey),
      serialized,
      { id: crypto.randomUUID(), label }
    );
    localStorage.setItem(backupStorageKey, JSON.stringify(snapshots));
    return true;
  } catch {
    recoveryStatus.textContent = "The local backup could not be stored. Export a backup file instead.";
    return false;
  }
}

function backupLabel(prefix, timestamp, extra = "") {
  const date = new Date(timestamp);
  const label = Number.isFinite(date.getTime())
    ? date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "Unknown time";
  return `${prefix} - ${label}${extra ? ` - ${extra}` : ""}`;
}

async function loadBackupChoices(options = {}) {
  const choices = [];
  const previous = localStorage.getItem(previousStorageKey);
  const previousData = MealPlannerRecovery.parsePlanner(previous);
  if (previousData) {
    choices.push({
      id: "local:previous",
      type: "local",
      data: previous,
      createdAt: previousData.savedAt || "",
      label: backupLabel("Previous good save", previousData.savedAt)
    });
  }
  MealPlannerRecovery.normalizeSnapshots(localStorage.getItem(backupStorageKey)).forEach((snapshot) => {
    choices.push({
      id: `local:${snapshot.id}`,
      type: "local",
      data: snapshot.data,
      createdAt: snapshot.createdAt,
      label: backupLabel(snapshot.label, snapshot.createdAt)
    });
  });

  if (!isNativeApp()) {
    try {
      const response = await fetch(`/api/backups?time=${Date.now()}`);
      if (response.ok) {
        const payload = await response.json();
        (payload.backups || []).forEach((backup) => {
          choices.push({
            id: `server:${backup.name}`,
            type: "server",
            name: backup.name,
            createdAt: backup.createdAt,
            label: backupLabel("Thumb drive automatic", backup.createdAt, `${backup.recipes} recipes`)
          });
        });
      }
    } catch {}
  }

  availableBackups = choices.sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""));
  backupSelect.innerHTML = availableBackups.length
    ? availableBackups.map((backup) => `<option value="${escapeHtml(backup.id)}">${escapeHtml(backup.label)}</option>`).join("")
    : '<option value="">No backups available yet</option>';
  restoreBackup.disabled = !availableBackups.length;
  if (!options.quiet) {
    recoveryStatus.textContent = availableBackups.length
      ? `${availableBackups.length} backup${availableBackups.length === 1 ? "" : "s"} available.`
      : "No recovery backups exist yet. Choose Create backup now.";
  }
}

async function createRecoveryBackup() {
  saveCurrentFieldsQuietly();
  const localCreated = storeLocalSnapshot("Manual backup");
  let driveCreated = false;
  if (!isNativeApp()) {
    try {
      const response = await fetch("/api/backups", { method: "POST" });
      driveCreated = response.ok;
    } catch {}
  }
  await loadBackupChoices({ quiet: true });
  recoveryStatus.textContent = driveCreated
    ? "A new backup was saved on the thumb drive."
    : localCreated
      ? `A new backup was saved on ${isNativeApp() ? "this phone" : "this browser"}.`
      : "A backup could not be created. Export a backup file instead.";
}

async function restoreSelectedBackup() {
  const selected = availableBackups.find((backup) => backup.id === backupSelect.value);
  if (!selected) return;
  if (!window.confirm(`Restore "${selected.label}"? The current planner will be backed up first.`)) return;

  try {
    storeLocalSnapshot("Before restore");
    captureUndo("restore backup");
    let data;
    if (selected.type === "server") {
      const response = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selected.name })
      });
      const payload = await response.json();
      if (!response.ok || !payload?.data) throw new Error(payload?.error || "The thumb-drive backup could not be restored.");
      data = payload.data;
    } else {
      data = MealPlannerRecovery.parsePlanner(selected.data);
    }
    if (!data) throw new Error("That backup could not be read.");

    applyPlannerData(data);
    selectedRecipeId = recipes[0]?.id || null;
    persistRecipes();
    render();
    setAppView("home", { focus: false });
    recoveryPanel.open = true;
    recoveryStatus.textContent = `Restored ${selected.label}. The planner you had before restoring is also backed up.`;
    await loadBackupChoices({ quiet: true });
  } catch (error) {
    recoveryStatus.textContent = `Restore stopped: ${error?.message || "That backup could not be restored."}`;
  }
}

function addWalmartOrderToPantry() {
  const items = parseWalmartText(walmartPaste.value);
  if (!items.length) {
    alert("Paste grocery items with one item on each line, or upload a receipt.");
    return;
  }

  showReceiptReview(items);
}

function parseWalmartText(text) {
  const receiptItems = MealPlannerReceipts.parseReceiptText(text);
  if (receiptItems.length) return receiptItems;

  const store = MealPlannerReceipts.extractStoreName(text);
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/subtotal|grand total|delivery|pickup|tax|payment|order number|receipt total/i.test(line))
    .map((line) => {
      const qtyMatch = line.match(/\b(?:qty|quantity)\s*:?\s*(\d+(?:\.\d+)?)/i) || line.match(/^(\d+(?:\.\d+)?)\s*[xX]\s+/);
      const priceMatches = [...line.matchAll(/\$(\d+(?:\.\d{2})?)/g)];
      const price = priceMatches.length ? Number(priceMatches[priceMatches.length - 1][1]) : 0;
      const itemNumber = MealPlannerReceipts.extractItemNumber(line);
      const amount = qtyMatch ? Number(qtyMatch[1]) : 1;
      const cleaned = line
        .replace(/\$\d+(?:\.\d{2})?/g, "")
        .replace(/\b(?:qty|quantity)\s*:?\s*\d+(?:\.\d+)?/gi, "")
        .replace(/\b(?:sku|upc|item\s*#?|item\s*number|product\s*code|barcode)\s*:?\s*[a-z0-9-]+/gi, "")
        .replace(/^\d+(?:\.\d+)?\s*[xX]\s+/, "")
        .replace(/\b(?:walmart|publix|aldi|aldi's)\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      return { amount, unit: "item", name: cleaned, price, itemNumber, store, storage: "", bestBy: "" };
    })
    .filter((item) => item.name.length > 1);
}

async function importGroceryFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  receiptReadStatus.textContent = `Reading ${file.name}...`;
  try {
    const text = await MealPlannerReceipts.readFile(file, (message) => {
      receiptReadStatus.textContent = message;
    });
    walmartPaste.value = text;
    const items = parseWalmartText(text);
    if (!items.length) throw new Error("No grocery items were found. Try a clearer photograph or correct the pasted text.");
    showReceiptReview(items);
    receiptReadStatus.textContent = `${items.length} receipt item${items.length === 1 ? "" : "s"} ready to check.`;
  } catch (error) {
    receiptReadStatus.textContent = error?.message || "That receipt could not be read.";
  } finally {
    event.target.value = "";
  }
}

function showReceiptReview(items) {
  pendingReceiptItems = items.map((item) => ({
    amount: cleanNumber(item.amount, 1),
    unit: item.unit || "item",
    name: String(item.name || "").trim(),
    price: cleanNumber(item.price, 0),
    itemNumber: item.itemNumber || "",
    store: item.store || "",
    storage: item.storage || foodStorageSection(item.name),
    bestBy: MealPlannerFood.normalizeDateValue(item.bestBy)
  }));
  renderReceiptReview();
  receiptReview.hidden = false;
  receiptReview.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderReceiptReview() {
  receiptReviewRows.innerHTML = "";
  pendingReceiptItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "receipt-review-row";
    row.dataset.receiptIndex = index;
    row.innerHTML = `
      <label>Amount<input class="receipt-amount" type="number" min="0.01" step="0.01" value="${escapeHtml(item.amount)}"></label>
      <label>Unit<input class="receipt-unit" type="text" value="${escapeHtml(item.unit)}"></label>
      <label class="receipt-name">Item<input class="receipt-item-name" type="text" value="${escapeHtml(item.name)}"></label>
      <label>Price<input class="receipt-price" type="number" min="0" step="0.01" value="${escapeHtml(item.price)}"></label>
      <label class="receipt-store">Store<input class="receipt-store-name" type="text" value="${escapeHtml(item.store)}"></label>
      <label class="receipt-item-number">Item number<input class="receipt-item-code" type="text" value="${escapeHtml(item.itemNumber)}"></label>
      <label class="receipt-storage">Put in<select>
        <option value="refrigerator" ${item.storage === "refrigerator" ? "selected" : ""}>Refrigerator</option>
        <option value="freezer" ${item.storage === "freezer" ? "selected" : ""}>Freezer</option>
        <option value="pantry" ${item.storage === "pantry" ? "selected" : ""}>Pantry</option>
      </select></label>
      <label class="receipt-best-by">Best by<input class="receipt-best-by-date" type="date" value="${escapeHtml(item.bestBy)}"></label>
      <button type="button" class="remove">Remove</button>
    `;
    const inputs = row.querySelectorAll("input, select");
    inputs.forEach((input) => input.addEventListener("input", () => updateReceiptItemFromRow(row)));
    row.querySelector(".remove").addEventListener("click", () => {
      pendingReceiptItems.splice(index, 1);
      renderReceiptReview();
    });
    receiptReviewRows.appendChild(row);
  });
  commitReceiptItems.disabled = pendingReceiptItems.length === 0;
}

function updateReceiptItemFromRow(row) {
  const index = Number(row.dataset.receiptIndex);
  pendingReceiptItems[index] = {
    amount: cleanNumber(row.querySelector(".receipt-amount").value, 0),
    unit: row.querySelector(".receipt-unit").value.trim(),
    name: row.querySelector(".receipt-item-name").value.trim(),
    price: cleanNumber(row.querySelector(".receipt-price").value, 0),
    store: row.querySelector(".receipt-store-name").value.trim(),
    itemNumber: row.querySelector(".receipt-item-code").value.trim(),
    storage: row.querySelector("select").value,
    bestBy: MealPlannerFood.normalizeDateValue(row.querySelector(".receipt-best-by-date").value)
  };
}

function addReviewedReceiptItems() {
  const validItems = pendingReceiptItems.filter((item) => item.name && cleanNumber(item.amount, 0) > 0);
  if (!validItems.length) {
    window.alert("Keep at least one grocery item with a name and amount.");
    return;
  }
  captureUndo("add groceries");
  validItems.forEach((item) => addFoodStorageItem(item));
  walmartPaste.value = "";
  clearReceiptReview();
  persistRecipes();
  renderMealViews();
  setSaveStatus(`${validItems.length} grocery item${validItems.length === 1 ? "" : "s"} added`, 2200);
}

function clearReceiptReview() {
  pendingReceiptItems = [];
  receiptReviewRows.innerHTML = "";
  receiptReview.hidden = true;
}

function addFoodStorageItem(item) {
  const section = ["refrigerator", "freezer", "pantry"].includes(item.storage)
    ? item.storage
    : foodStorageSection(item.name);
  const list = foodStorage[section];
  const key = normalizeName(item.name);
  const bestBy = MealPlannerFood.normalizeDateValue(item.bestBy);
  const existing = list.find((stored) => {
    if (normalizeName(stored.name) !== key) return false;
    if (MealPlannerFood.normalizeDateValue(stored.bestBy) !== bestBy) return false;
    return MealPlannerFood.convertAmount(1, item.unit || "", stored.unit || "") !== null;
  });
  if (existing) {
    const converted = MealPlannerFood.convertAmount(
      cleanNumber(item.amount, 1),
      item.unit || "",
      existing.unit || ""
    );
    existing.amount = cleanNumber(existing.amount, 0) + (converted ?? cleanNumber(item.amount, 1));
    existing.price = cleanNumber(existing.price, 0) + cleanNumber(item.price, 0);
    existing.itemNumber = existing.itemNumber || item.itemNumber || "";
    existing.store = existing.store || item.store || "";
    return;
  }

  list.push({
    id: crypto.randomUUID(),
    amount: cleanNumber(item.amount, 1),
    unit: item.unit || "item",
    name: item.name,
    price: cleanNumber(item.price, 0),
    itemNumber: item.itemNumber || "",
    store: item.store || "",
    bestBy
  });
}

function renderPantry() {
  refrigeratorList.innerHTML = "";
  freezerList.innerHTML = "";
  pantryList.innerHTML = "";

  renderFoodList(refrigeratorList, foodStorage.refrigerator, "Cold foods will show here.");
  renderFoodList(freezerList, foodStorage.freezer, "Frozen foods will show here.");
  renderFoodList(pantryList, foodStorage.pantry, "Shelf foods will show here.");
  foodSpendSummary.textContent = `Recorded grocery spending: ${formatMoney(totalFoodCost())}`;
  renderExpirationPanel();
}

function renderFoodList(container, items, emptyText) {
  if (!items.length) {
    container.innerHTML = `<li class="empty">${escapeHtml(emptyText)}</li>`;
    return;
  }

  items
    .slice()
    .sort(compareFoodByBestBy)
    .forEach((item) => {
      const li = document.createElement("li");
      li.className = "inventory-food";
      const price = cleanNumber(item.price, 0) ? `<small>${formatMoney(item.price)} recorded</small>` : "<small>No price recorded</small>";
      const details = [
        item.store ? `Store: ${item.store}` : "",
        item.itemNumber ? `Item #: ${item.itemNumber}` : ""
      ].filter(Boolean).join(" | ");
      const detailLine = details ? `<small>${escapeHtml(details)}</small>` : "";
      const warningDays = cleanNumber(inventorySettings.reminderDays, 0);
      const expiry = MealPlannerFood.expiryState(item, { warningDays: warningDays || 7 });
      const showNotice = warningDays > 0 && ["past", "today", "soon"].includes(expiry.state);
      if (showNotice) li.classList.add(expiry.state === "past" ? "past-date" : "use-soon");
      const badge = showNotice
        ? `<small class="expiry-badge">${escapeHtml(expiryNoticeText(expiry))}</small>`
        : "";
      li.innerHTML = `
        <span>${escapeHtml(item.name)}</span>
        <strong>${formatAmount(cleanNumber(item.amount, 0))} ${escapeHtml(item.unit || "")}</strong>
        ${price}
        ${detailLine}
        ${badge}
        <label class="inventory-date">
          Best by
          <input type="date" value="${escapeHtml(item.bestBy || "")}" aria-label="Best-by date for ${escapeHtml(item.name)}">
        </label>
        <button type="button" class="inventory-remove">Remove</button>
      `;
      li.querySelector(".inventory-date input").addEventListener("change", (event) => {
        updateFoodBestBy(item.id, event.target.value);
      });
      li.querySelector(".inventory-remove").addEventListener("click", () => removeFoodItem(item.id));
      container.appendChild(li);
    });
}

function compareFoodByBestBy(left, right) {
  const leftDate = MealPlannerFood.normalizeDateValue(left.bestBy) || "9999-12-31";
  const rightDate = MealPlannerFood.normalizeDateValue(right.bestBy) || "9999-12-31";
  return leftDate.localeCompare(rightDate) || left.name.localeCompare(right.name);
}

function expiryNoticeText(expiry) {
  if (expiry.state === "past") {
    const days = Math.abs(expiry.days);
    return `Past best-by by ${days} day${days === 1 ? "" : "s"} - check before using`;
  }
  if (expiry.state === "today") return "Best by today";
  if (expiry.days === 1) return "Best by tomorrow";
  return `Best by in ${expiry.days} days`;
}

function findFoodItemLocation(id) {
  for (const section of ["refrigerator", "freezer", "pantry"]) {
    const index = foodStorage[section].findIndex((item) => item.id === id);
    if (index >= 0) return { section, index, item: foodStorage[section][index] };
  }
  return null;
}

function updateFoodBestBy(id, value) {
  const location = findFoodItemLocation(id);
  if (!location) return;
  const bestBy = MealPlannerFood.normalizeDateValue(value);
  if (location.item.bestBy === bestBy) return;

  captureUndo("change best-by date");
  location.item.bestBy = bestBy;
  persistRecipes();
  renderMealViews();
  setSaveStatus(bestBy ? "Best-by date saved" : "Best-by date removed", 1800);
}

function removeFoodItem(id) {
  const location = findFoodItemLocation(id);
  if (!location) return;
  if (!window.confirm(`Remove "${location.item.name}" from your food inventory?`)) return;

  captureUndo("remove food");
  foodStorage[location.section].splice(location.index, 1);
  persistRecipes();
  renderMealViews();
  setSaveStatus(`${location.item.name} removed`, 1800);
}

function updateExpiryReminder() {
  const reminderDays = Number(expiryReminderDays.value);
  if (![0, 3, 7, 14].includes(reminderDays) || reminderDays === inventorySettings.reminderDays) return;

  captureUndo("change use-soon notice");
  inventorySettings.reminderDays = reminderDays;
  persistRecipes();
  renderPantry();
  setSaveStatus(reminderDays ? `Use-soon notice set to ${reminderDays} days` : "Use-soon notice turned off", 1800);
}

function renderExpirationPanel() {
  const reminderDays = cleanNumber(inventorySettings.reminderDays, 0);
  expiryReminderDays.value = String(reminderDays);
  useSoonList.innerHTML = "";
  useSoonRecipeResults.innerHTML = "";

  if (!reminderDays) {
    expirySummary.textContent = "Notices are off. Best-by dates are still saved.";
    useSoonPanel.hidden = true;
    suggestUseSoon.disabled = true;
    return;
  }

  const attention = allFoodItems()
    .map((item) => ({ item, expiry: MealPlannerFood.expiryState(item, { warningDays: reminderDays }) }))
    .filter(({ expiry }) => ["past", "today", "soon"].includes(expiry.state))
    .sort((a, b) => a.expiry.days - b.expiry.days || a.item.name.localeCompare(b.item.name));
  const pastCount = attention.filter(({ expiry }) => expiry.state === "past").length;
  const soonCount = attention.length - pastCount;

  if (!attention.length) {
    expirySummary.textContent = `Nothing is due within ${reminderDays} days.`;
    useSoonPanel.hidden = true;
    suggestUseSoon.disabled = true;
    return;
  }

  const summaryParts = [];
  if (pastCount) summaryParts.push(`${pastCount} past its best-by date`);
  if (soonCount) summaryParts.push(`${soonCount} to use soon`);
  expirySummary.textContent = summaryParts.join(" and ");
  useSoonPanel.hidden = false;
  suggestUseSoon.disabled = !attention.some(({ expiry }) => expiry.days >= 0);

  attention.forEach(({ item, expiry }) => {
    const li = document.createElement("li");
    li.className = expiry.state === "past" ? "past-date" : "use-soon";
    li.innerHTML = `
      <span>${escapeHtml(item.name)}</span>
      <strong>${escapeHtml(expiryNoticeText(expiry))}</strong>
    `;
    useSoonList.appendChild(li);
  });
}

function renderUseSoonRecipeIdeas() {
  const reminderDays = cleanNumber(inventorySettings.reminderDays, 7) || 7;
  const ideas = MealPlannerFood.rankRecipesByExpiry(recipes, foodStorage, { warningDays: reminderDays });
  useSoonRecipeResults.innerHTML = "";

  if (!ideas.length) {
    useSoonRecipeResults.innerHTML = `<p class="status-line">No saved recipe uses the food that is due soon yet.</p>`;
    return;
  }

  ideas.slice(0, 6).forEach((idea) => {
    const recipe = idea.recipe;
    const card = document.createElement("article");
    card.className = "online-result stock-result";
    const image = recipe.photo
      ? `<img src="${escapeHtml(recipe.photo)}" alt="" loading="lazy" decoding="async">`
      : `<img src="${escapeHtml(ingredientImageUrl(recipe.ingredients[0]?.name || recipe.name))}" alt="" loading="lazy" decoding="async">`;
    const foodNames = idea.expiringItems.map((item) => item.name).join(", ");
    const readiness = idea.ready
      ? "Ready now from food at home."
      : `${idea.missingCount} ingredient${idea.missingCount === 1 ? "" : "s"} to buy.`;
    card.innerHTML = `
      ${image}
      <div>
        <h3>${escapeHtml(recipe.name)}</h3>
        <p>Uses soon: ${escapeHtml(foodNames)}. ${escapeHtml(readiness)}</p>
        <button type="button">Open recipe</button>
      </div>
    `;
    card.querySelector("button").addEventListener("click", () => {
      selectedRecipeId = recipe.id;
      render();
      setAppView("recipes", { focus: false });
      focusSection(document.querySelector(".recipe-showcase"));
    });
    useSoonRecipeResults.appendChild(card);
  });
}

function renderPantrySuggestionChoices() {
  pantrySuggestionSelect.innerHTML = "";
  const allItems = allFoodItems();

  if (!allItems.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No food items yet";
    pantrySuggestionSelect.appendChild(option);
    return;
  }

  allItems
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((item) => {
      const option = document.createElement("option");
      option.value = item.name;
      option.textContent = item.name;
      pantrySuggestionSelect.appendChild(option);
    });
}

function renderNeedList() {
  const scaled = getScaledIngredients();
  needList.innerHTML = "";
  mealCostSummary.textContent = "";
  const analysis = MealPlannerFood.analyzeRecipe(scaled, foodStorage);

  if (!analysis.rows.length) {
    needList.innerHTML = '<li class="empty">Add ingredients to this recipe first.</li>';
    cookAndDeduct.disabled = true;
    return;
  }

  analysis.rows.forEach((row) => {
    const ingredient = row.ingredient;
    const li = document.createElement("li");
    const unit = escapeHtml(ingredient.unit || "item");
    li.innerHTML = `
      <span>${escapeHtml(ingredient.name)}</span>
      <strong>Need ${formatAmount(row.need)} ${unit}</strong>
      <small>Have ${formatAmount(row.have)} ${unit} | Buy ${formatAmount(row.buy)} ${unit}</small>
    `;
    needList.appendChild(li);
  });
  const estimate = estimateSelectedMealCost();
  const people = cleanNumber(targetServings.value, 1);
  mealCostSummary.textContent = estimate.cost
    ? `Rough meal cost: ${formatMoney(estimate.cost)} | ${formatMoney(estimate.cost / people)} per person`
    : "No matched unit prices yet.";
  cookAndDeduct.disabled = !selectedRecipe();
}

function estimateSelectedMealCost() {
  const analysis = MealPlannerFood.analyzeRecipe(getScaledIngredients(), foodStorage);
  const items = analysis.rows
    .filter((row) => row.match && row.estimatedCost > 0)
    .map((row) => ({
      name: row.match.name,
      ingredientName: row.ingredient.name,
      price: row.estimatedCost,
      store: row.match.store || "",
      itemNumber: row.match.itemNumber || "",
      amount: row.need,
      unit: row.ingredient.unit
    }));
  return {
    cost: items.reduce((sum, item) => sum + item.price, 0),
    items,
    analysis
  };
}

function renderMealCostTally() {
  const recipe = selectedRecipe();
  const estimate = estimateSelectedMealCost();
  const people = cleanNumber(targetServings.value, 1);

  recordMealCost.disabled = !recipe || !estimate.cost;
  currentMealCost.textContent = estimate.cost
    ? `${recipe.name} for ${people} people: about ${formatMoney(estimate.cost)} total, or ${formatMoney(estimate.cost / people)} per person.`
    : "No matched grocery prices yet. Paste grocery orders with prices, then pick a meal.";

  mealCostHistoryList.innerHTML = "";
  if (!mealCostHistory.length) {
    mealCostHistoryList.innerHTML = '<li class="empty">Meal costs you record will show here.</li>';
    return;
  }

  mealCostHistory
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 12)
    .forEach((entry) => {
      const li = document.createElement("li");
      const dateText = new Date(entry.date).toLocaleDateString();
      li.innerHTML = `<span>${escapeHtml(entry.recipeName)}</span><strong>${formatMoney(entry.cost)} for ${entry.people} people</strong><small>${escapeHtml(dateText)} | ${entry.items.length} matched item${entry.items.length === 1 ? "" : "s"}</small>`;
      mealCostHistoryList.appendChild(li);
    });
}

function renderMealCostCalendar() {
  const year = calendarMonthDate.getFullYear();
  const month = calendarMonthDate.getMonth();
  const monthName = calendarMonthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const monthEntries = mealCostHistory.filter((entry) => {
    const entryDate = new Date(entry.date);
    return entryDate.getFullYear() === year && entryDate.getMonth() === month;
  });
  const monthTotal = monthEntries.reduce((sum, entry) => sum + cleanNumber(entry.cost, 0), 0);

  calendarSummary.textContent = `${monthName}: ${formatMoney(monthTotal)} recorded`;
  mealCostCalendar.innerHTML = "";

  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day) => {
    const heading = document.createElement("div");
    heading.className = "calendar-heading";
    heading.textContent = day;
    mealCostCalendar.appendChild(heading);
  });

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let index = 0; index < firstDay.getDay(); index++) {
    const blank = document.createElement("div");
    blank.className = "calendar-day blank";
    mealCostCalendar.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = localDateKey(new Date(year, month, day));
    const entries = mealCostHistory.filter((entry) => localDateKey(new Date(entry.date)) === dateKey);
    const dayTotal = entries.reduce((sum, entry) => sum + cleanNumber(entry.cost, 0), 0);
    const cell = document.createElement("div");
    cell.className = `calendar-day ${entries.length ? "has-cost" : ""}`;
    cell.innerHTML = `
      <strong>${day}</strong>
      ${dayTotal ? `<span>${formatMoney(dayTotal)}</span>` : ""}
      ${entries.slice(0, 3).map((entry) => `<small>${escapeHtml(entry.recipeName)}</small>`).join("")}
      ${entries.length > 3 ? `<small>+${entries.length - 3} more</small>` : ""}
    `;
    mealCostCalendar.appendChild(cell);
  }
}

function changeCalendarMonth(delta) {
  calendarMonthDate = new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth() + delta, 1);
  renderMealCostCalendar();
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recordSelectedMealCost() {
  const recipe = selectedRecipe();
  const estimate = estimateSelectedMealCost();
  if (!recipe || !estimate.cost) return;

  captureUndo("record meal cost");
  mealCostHistory.unshift({
    id: crypto.randomUUID(),
    recipeId: recipe.id,
    recipeName: recipe.name,
    people: cleanNumber(targetServings.value, 1),
    cost: estimate.cost,
    date: mealDate.value ? new Date(`${mealDate.value}T12:00:00`).toISOString() : new Date().toISOString(),
    items: estimate.items
  });
  calendarMonthDate = mealDate.value ? new Date(`${mealDate.value}T12:00:00`) : new Date();
  mealCostHistory = mealCostHistory.slice(0, 100);
  persistRecipes();
  renderMealCostTally();
  renderMealCostCalendar();
}

function cookSelectedMeal() {
  const recipe = selectedRecipe();
  if (!recipe || !isRecipeComplete(recipe)) {
    window.alert("Choose a complete recipe before subtracting food.");
    return false;
  }
  const scaled = getScaledIngredients(recipe);
  const estimate = estimateSelectedMealCost();
  const analysis = MealPlannerFood.analyzeRecipe(scaled, foodStorage);
  const missingText = analysis.missingCount
    ? ` ${analysis.missingCount} ingredient${analysis.missingCount === 1 ? " is" : "s are"} short; available amounts will still be subtracted.`
    : "";
  const costText = estimate.cost ? ` The meal cost of ${formatMoney(estimate.cost)} will be recorded.` : "";
  const usageLines = analysis.rows
    .filter((row) => row.have > 0)
    .slice(0, 10)
    .map((row) => {
      const amount = Math.min(row.need, row.have);
      return `${row.ingredient.name}: ${formatAmount(amount)} ${row.ingredient.unit || "item"}`;
    });
  const usageText = usageLines.length
    ? `\n\nFood to subtract:\n${usageLines.map((line) => `- ${line}`).join("\n")}`
    : "";
  if (!window.confirm(`Mark "${recipe.name}" as cooked and subtract its ingredients?${missingText}${costText}${usageText}`)) return false;

  captureUndo("cook meal");
  const consumed = MealPlannerFood.consumeIngredients(foodStorage, scaled);
  foodStorage = consumed.storage;
  if (estimate.cost) {
    mealCostHistory.unshift({
      id: crypto.randomUUID(),
      recipeId: recipe.id,
      recipeName: recipe.name,
      people: cleanNumber(targetServings.value, 1),
      cost: estimate.cost,
      date: mealDate.value ? new Date(`${mealDate.value}T12:00:00`).toISOString() : new Date().toISOString(),
      items: estimate.items
    });
    mealCostHistory = mealCostHistory.slice(0, 100);
  }
  persistRecipes();
  render();
  setAppView("inventory", { focus: false });
  setSaveStatus(`${recipe.name} cooked and inventory updated`, 2600);
  return true;
}

function renderPrintSheet() {
  const recipe = selectedRecipe();
  if (!recipe) return;

  const people = cleanNumber(targetServings.value, 1);
  const dateText = mealDate.value ? new Date(`${mealDate.value}T12:00:00`).toLocaleDateString() : "No date selected";
  const estimate = estimateSelectedMealCost();
  printTitle.textContent = recipe.name;
  const timing = recipeTimingText(recipe);
  printMeta.textContent = `${dateText} | Planned for ${people} people${timing ? ` | ${timing}` : ""}${estimate.cost ? ` | Rough cost: ${formatMoney(estimate.cost)}` : ""}`;
  printIngredients.innerHTML = "";
  getScaledIngredients(recipe).forEach((ingredient) => {
    const li = document.createElement("li");
    li.textContent = `${formatAmount(ingredient.amount)} ${ingredient.unit || ""} ${ingredient.name}`.replace(/\s+/g, " ").trim();
    printIngredients.appendChild(li);
  });
  printNotes.innerHTML = "";
  const notes = (recipe.notes || "Add prep instructions in the recipe notes.").split(/\r?\n/).filter(Boolean);
  notes.forEach((note) => {
    const p = document.createElement("p");
    p.textContent = note;
    printNotes.appendChild(p);
  });
}

function printSelectedMeal() {
  saveCurrentFieldsQuietly();
  renderPrintSheet();
  window.print();
}

function clearPantryTally() {
  if (!allFoodItems().length) return;
  if (!window.confirm("Clear every item from the refrigerator, freezer, and pantry?")) return;
  captureUndo("clear inventory");
  foodStorage = normalizeFoodStorage();
  persistRecipes();
  renderMealViews();
}

function allFoodItems() {
  return [...foodStorage.refrigerator, ...foodStorage.freezer, ...foodStorage.pantry];
}

function totalFoodCost() {
  return allFoodItems().reduce((sum, item) => sum + cleanNumber(item.price, 0), 0);
}

function foodStorageSection(name) {
  const normalized = normalizeName(name);
  const freezerWords = [
    "frozen", "freezer", "ice cream", "frozen pizza", "frozen dinner", "frozen meal",
    "frozen vegetables", "frozen broccoli", "frozen corn", "frozen peas", "frozen fruit",
    "fish sticks", "shrimp", "salmon fillet", "cod fillet", "tilapia", "chicken nuggets",
    "chicken tenders", "meatballs", "hamburger patties"
  ];
  const refrigeratorWords = [
    "egg", "eggs", "milk", "cheese", "butter", "cream", "yogurt", "sour cream",
    "cottage cheese", "half and half", "meat", "beef", "steak", "roast", "hamburger",
    "chicken", "pork", "bacon", "sausage", "ham", "fish", "salmon", "shrimp",
    "lettuce", "tomato", "tomatoes", "celery", "carrot", "carrots", "pepper",
    "peppers", "onion", "potato", "potatoes", "fruit", "apple", "apples"
  ];
  const pantryWords = [
    "can", "canned", "jar", "jars", "spaghetti", "pasta", "rice", "beans", "flour",
    "sugar", "salt", "pepper", "powder", "seasoning", "soup mix", "bread crumbs",
    "breadcrumbs", "ketchup", "ketup", "ketsup", "catsup", "mustard", "mayo",
    "mayonnaise", "relish", "oil", "vinegar", "cereal", "crackers"
  ];

  if (freezerWords.some((word) => normalized.includes(word))) return "freezer";
  if (pantryWords.some((word) => normalized.includes(word))) return "pantry";
  if (refrigeratorWords.some((word) => normalized.includes(word))) return "refrigerator";
  return "pantry";
}

async function searchRecipesByName() {
  const query = onlineRecipeSearch.value.trim();
  if (!query) {
    onlineStatus.textContent = "Type a meal or ingredient idea first.";
    return;
  }

  setOnlineLoading("Searching online recipes...");
  try {
    const data = await fetchJson(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`);
    renderOnlineResults(data.meals || []);
  } catch {
    setOnlineError();
  }
}

async function suggestRecipesFromPantry() {
  const item = pantrySuggestionSelect.value.trim();
  if (!item) {
    onlineStatus.textContent = "Add food items first, then choose one for suggestions.";
    return;
  }

  setOnlineLoading(`Looking for recipes with ${item}...`);
  try {
    const mainIngredient = item.split(",")[0].split(" ").slice(0, 3).join("_");
    const data = await fetchJson(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(mainIngredient)}`);
    renderOnlineResults(data.meals || [], true);
  } catch {
    setOnlineError();
  }
}

function suggestRecipesFromStock() {
  saveCurrentFieldsQuietly();
  const foods = allFoodItems();
  onlineResults.innerHTML = "";

  if (!foods.length) {
    onlineStatus.textContent = "Add food to the refrigerator, freezer, or pantry first.";
    return;
  }

  const expiryRanks = new Map(
    MealPlannerFood.rankRecipesByExpiry(recipes, foodStorage, {
      warningDays: cleanNumber(inventorySettings.reminderDays, 7) || 7
    }).map((idea) => [idea.recipe.id, idea])
  );
  const ideas = recipes
    .map((recipe) => {
      const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
      const missing = MealPlannerFood.analyzeRecipe(ingredients, foodStorage).rows.filter((row) => row.buy > 0.0001);
      return { recipe, ingredients, missing, expiry: expiryRanks.get(recipe.id) };
    })
    .filter((idea) => idea.ingredients.length && !idea.missing.length)
    .sort((a, b) =>
      cleanNumber(b.expiry?.score, 0) - cleanNumber(a.expiry?.score, 0) ||
      a.recipe.name.localeCompare(b.recipe.name)
    );

  if (!ideas.length) {
    onlineStatus.textContent = "No saved recipes match only the food you have yet. Add more groceries or save more recipes, then try again.";
    return;
  }

  onlineStatus.textContent = `${ideas.length} meal idea${ideas.length === 1 ? "" : "s"} using only refrigerator, freezer, and pantry items.`;
  ideas.slice(0, 12).forEach(({ recipe, expiry }) => {
    const card = document.createElement("article");
    card.className = "online-result stock-result";
    const image = recipe.photo
      ? `<img src="${escapeHtml(recipe.photo)}" alt="" loading="lazy" decoding="async">`
      : `<img src="${escapeHtml(ingredientImageUrl(recipe.ingredients[0]?.name || recipe.name))}" alt="" loading="lazy" decoding="async">`;
    card.innerHTML = `
      ${image}
      <div>
        <h3>${escapeHtml(recipe.name)}</h3>
        <p>You have all ${recipe.ingredients.length} listed ingredient${recipe.ingredients.length === 1 ? "" : "s"}.${
          expiry?.expiringItems?.length
            ? ` Uses soon: ${escapeHtml(expiry.expiringItems.map((item) => item.name).join(", "))}.`
            : ""
        }</p>
        <button type="button">Open recipe</button>
      </div>
    `;
    card.querySelector("button").addEventListener("click", () => {
      selectedRecipeId = recipe.id;
      render();
      setAppView("recipes", { focus: false });
      focusSection(document.querySelector(".recipe-showcase"));
    });
    onlineResults.appendChild(card);
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Recipe search failed");
  return response.json();
}

function setOnlineLoading(message) {
  onlineStatus.textContent = message;
  onlineResults.innerHTML = "";
}

function setOnlineError() {
  onlineStatus.textContent = "I could not reach the online recipe search. Check the internet connection and try again.";
}

function renderOnlineResults(meals, needsLookup = false) {
  onlineResults.innerHTML = "";

  if (!meals.length) {
    onlineStatus.textContent = "No recipes found. Try a simpler search like chicken, pasta, beef, or soup.";
    return;
  }

  onlineStatus.textContent = `${meals.length} recipe${meals.length === 1 ? "" : "s"} found`;
  meals.slice(0, 8).forEach((meal) => {
    const card = document.createElement("article");
    card.className = "online-result";
    const image = meal.strMealThumb
      ? `<img src="${escapeHtml(meal.strMealThumb)}" alt="" loading="lazy" decoding="async">`
      : "";
    card.innerHTML = `
      ${image}
      <div>
        <h3>${escapeHtml(meal.strMeal)}</h3>
        <p>${escapeHtml(meal.strCategory || meal.strArea || "Online recipe")}</p>
        <button type="button">Save recipe</button>
      </div>
    `;
    card.querySelector("button").addEventListener("click", async () => {
      try {
        const fullMeal = needsLookup ? await lookupMeal(meal.idMeal) : meal;
        saveOnlineMeal(fullMeal);
      } catch {
        onlineStatus.textContent = "That recipe could not be saved. Try another one.";
      }
    });
    onlineResults.appendChild(card);
  });
}

async function lookupMeal(id) {
  const data = await fetchJson(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(id)}`);
  if (!data.meals?.[0]) throw new Error("Recipe not found");
  return data.meals[0];
}

function saveOnlineMeal(meal) {
  const ingredients = [];
  for (let index = 1; index <= 20; index++) {
    const name = (meal[`strIngredient${index}`] || "").trim();
    const measure = (meal[`strMeasure${index}`] || "").trim();
    if (!name) continue;

    const parsed = parseMeasure(measure);
    ingredients.push({
      amount: parsed.amount,
      unit: parsed.unit,
      name
    });
  }

  const recipe = {
    id: crypto.randomUUID(),
    name: meal.strMeal || "Online recipe",
    baseServings: cleanNumber(targetServings.value, 2),
    prepTime: "",
    cookTime: "",
    totalTime: "",
    temperature: MealPlannerRecipeReader.extractTemperature(meal.strInstructions || ""),
    sourceUrl: meal.strSource || meal.strYoutube || "",
    notes: meal.strInstructions || "",
    photo: meal.strMealThumb || "",
    ingredients
  };

  openRecipeReview(recipe, `${recipe.name} is ready to check before saving.`);
  onlineStatus.textContent = `${recipe.name} is open in the review section below.`;
  focusSection(pasteRecipeCard);
}

function parseMeasure(measure) {
  const trimmed = String(measure || "").trim();
  const mixedFraction = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)\s*(.*)$/);
  if (mixedFraction) {
    return {
      amount: Number(mixedFraction[1]) + Number(mixedFraction[2]) / Number(mixedFraction[3]),
      unit: firstUnitWords(mixedFraction[4]).unit,
      originalText: `${mixedFraction[1]} ${mixedFraction[2]}/${mixedFraction[3]} ${firstUnitWords(mixedFraction[4]).unit}`.trim()
    };
  }

  const fraction = trimmed.match(/^(\d+)\/(\d+)\s*(.*)$/);
  if (fraction) {
    return {
      amount: Number(fraction[1]) / Number(fraction[2]),
      unit: firstUnitWords(fraction[3]).unit,
      originalText: `${fraction[1]}/${fraction[2]} ${firstUnitWords(fraction[3]).unit}`.trim()
    };
  }

  const decimal = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (decimal) {
    return {
      amount: Number(decimal[1]),
      unit: firstUnitWords(decimal[2]).unit,
      originalText: `${decimal[1]} ${firstUnitWords(decimal[2]).unit}`.trim()
    };
  }

  return {
    amount: 1,
    unit: "",
    originalText: ""
  };
}

function firstUnitWords(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const knownUnits = [
    "cup", "cups", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons",
    "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds", "can", "cans", "jar", "jars",
    "package", "packages", "packet", "packets", "clove", "cloves", "slice", "slices",
    "pinch", "dash", "quart", "quarts", "pint", "pints"
  ];
  if (!words.length) return { unit: "" };
  if (knownUnits.includes(words[0].toLowerCase())) return { unit: words[0] };
  return { unit: "" };
}

function focusSection(section, field) {
  section.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => field?.focus(), 350);
}

function findPantryMatch(ingredientName) {
  const needle = normalizeName(ingredientName);
  if (needle.length < 3) return null;
  const needleWords = meaningfulFoodWords(needle);

  return allFoodItems().find((item) => {
    const haystack = normalizeName(item.name);
    if (haystack.length < 3) return false;
    if (haystack.includes(needle) || needle.includes(haystack)) return true;

    const haystackWords = meaningfulFoodWords(haystack);
    const sharedWords = needleWords.filter((word) => haystackWords.includes(word));
    return sharedWords.length >= Math.min(2, needleWords.length, haystackWords.length);
  });
}

function meaningfulFoodWords(value) {
  return normalizeName(value)
    .split(" ")
    .filter((word) => word.length > 2)
    .filter((word) => !["cup", "cups", "tsp", "tbsp", "tablespoon", "teaspoon", "packet", "pack", "serving", "servings", "favorite"].includes(word));
}

function normalizeName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(great value|organic|fresh|frozen|shredded|boneless|skinless|the|and|or)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function formatAmount(value) {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(2)).toString();
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "$0.00";
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
