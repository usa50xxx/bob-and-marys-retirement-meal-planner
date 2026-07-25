(function initializeFoodEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MealPlannerFood = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createFoodEngine() {
  "use strict";

  const UNIT_ALIASES = {
    lbs: "lb",
    pound: "lb",
    pounds: "lb",
    ounce: "oz",
    ounces: "oz",
    grams: "g",
    gram: "g",
    kilograms: "kg",
    kilogram: "kg",
    tablespoons: "tbsp",
    tablespoon: "tbsp",
    teaspoons: "tsp",
    teaspoon: "tsp",
    cups: "cup",
    "fluid ounce": "fl oz",
    "fluid ounces": "fl oz",
    milliliters: "ml",
    milliliter: "ml",
    liters: "l",
    liter: "l",
    pints: "pint",
    quarts: "quart",
    gallons: "gallon",
    items: "item",
    each: "item",
    eggs: "item",
    egg: "item",
    cans: "item",
    can: "item",
    jars: "item",
    jar: "item",
    packages: "item",
    package: "item",
    packets: "item",
    packet: "item",
    packs: "item",
    pack: "item",
    slices: "item",
    slice: "item",
    cloves: "item",
    clove: "item",
    buns: "item",
    bun: "item",
    patties: "item",
    patty: "item",
    servings: "item",
    serving: "item",
    pieces: "item",
    piece: "item",
    counts: "count"
  };

  const UNIT_INFO = {
    lb: { dimension: "weight", factor: 16 },
    oz: { dimension: "weight", factor: 1 },
    g: { dimension: "weight", factor: 0.0352739619 },
    kg: { dimension: "weight", factor: 35.2739619 },
    tsp: { dimension: "volume", factor: 1 },
    tbsp: { dimension: "volume", factor: 3 },
    cup: { dimension: "volume", factor: 48 },
    "fl oz": { dimension: "volume", factor: 6 },
    ml: { dimension: "volume", factor: 0.202884136 },
    l: { dimension: "volume", factor: 202.884136 },
    pint: { dimension: "volume", factor: 96 },
    quart: { dimension: "volume", factor: 192 },
    gallon: { dimension: "volume", factor: 768 },
    item: { dimension: "count", factor: 1 },
    count: { dimension: "count", factor: 1 }
  };

  const STOP_WORDS = new Set([
    "and", "the", "with", "fresh", "frozen", "organic", "great", "value",
    "boneless", "skinless", "shredded", "large", "small", "medium", "favorite"
  ]);

  function cleanNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  function normalizeDateValue(value) {
    const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return "";

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const serial = Date.UTC(year, month - 1, day);
    const parsed = new Date(serial);
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return "";
    }
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  function localDateValue(value = new Date()) {
    const normalized = normalizeDateValue(value);
    if (normalized) return normalized;

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return localDateValue(new Date());
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dateSerial(value) {
    const normalized = normalizeDateValue(value);
    if (!normalized) return null;
    const [year, month, day] = normalized.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  }

  function daysUntilBestBy(value, today = new Date()) {
    const target = dateSerial(value);
    const current = dateSerial(localDateValue(today));
    if (target === null || current === null) return null;
    return Math.round((target - current) / 86400000);
  }

  function expiryState(item, options = {}) {
    const bestBy = normalizeDateValue(item?.bestBy);
    if (!bestBy) return { state: "undated", bestBy: "", days: null };

    const days = daysUntilBestBy(bestBy, options.today);
    const warningDays = Math.max(1, Math.round(cleanNumber(options.warningDays, 7)));
    if (days < 0) return { state: "past", bestBy, days };
    if (days === 0) return { state: "today", bestBy, days };
    if (days <= warningDays) return { state: "soon", bestBy, days };
    return { state: "later", bestBy, days };
  }

  function bestBySortValue(item) {
    return dateSerial(item?.bestBy) ?? Number.POSITIVE_INFINITY;
  }

  function normalizeUnit(unit) {
    const cleaned = String(unit || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/\s+/g, " ")
      .trim();
    return UNIT_ALIASES[cleaned] || cleaned;
  }

  function unitInfo(unit) {
    return UNIT_INFO[normalizeUnit(unit)] || null;
  }

  function convertAmount(amount, fromUnit, toUnit) {
    const value = cleanNumber(amount, NaN);
    const from = normalizeUnit(fromUnit);
    const to = normalizeUnit(toUnit);
    if (!Number.isFinite(value)) return null;
    if (from === to || (!from && !to)) return value;

    const fromInfo = unitInfo(from);
    const toInfo = unitInfo(to);
    if (!fromInfo || !toInfo || fromInfo.dimension !== toInfo.dimension) return null;
    return (value * fromInfo.factor) / toInfo.factor;
  }

  function normalizeFoodName(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .filter((word) => !STOP_WORDS.has(word))
      .join(" ");
  }

  function foodWords(value) {
    return normalizeFoodName(value)
      .split(" ")
      .filter((word) => word.length > 1);
  }

  function nameMatchScore(left, right) {
    const a = normalizeFoodName(left);
    const b = normalizeFoodName(right);
    if (!a || !b) return 0;
    if (a === b) return 100;
    if (a.includes(b) || b.includes(a)) return 80;

    const aWords = foodWords(a);
    const bWords = foodWords(b);
    const shared = aWords.filter((word) => bWords.includes(word));
    if (!shared.length) return 0;
    const coverage = shared.length / Math.max(aWords.length, bWords.length);
    return Math.round(40 + coverage * 35);
  }

  function flattenStorage(storage) {
    if (Array.isArray(storage)) return storage;
    if (!storage || typeof storage !== "object") return [];
    return ["refrigerator", "freezer", "pantry"].flatMap((section) =>
      (Array.isArray(storage[section]) ? storage[section] : []).map((item) => ({ ...item, section }))
    );
  }

  function inventoryMatchCandidates(name, storage, desiredUnit = "") {
    return flattenStorage(storage)
      .map((item) => {
        const score = nameMatchScore(name, item.name);
        const conversion = convertAmount(1, item.unit || "", desiredUnit || item.unit || "");
        return { item, score, compatible: conversion !== null };
      })
      .filter((entry) => entry.score >= 55)
      .sort((a, b) => {
        if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
        if (a.score !== b.score) return b.score - a.score;
        return bestBySortValue(a.item) - bestBySortValue(b.item);
      });
  }

  function findInventoryMatches(name, storage, desiredUnit = "") {
    const compatible = inventoryMatchCandidates(name, storage, desiredUnit)
      .filter((entry) => entry.compatible);
    if (!compatible.length) return [];

    const bestScore = compatible[0].score;
    const minimumScore = Math.max(70, bestScore - 20);
    return compatible
      .filter((entry) => entry.score >= minimumScore)
      .map((entry) => entry.item);
  }

  function findBestInventoryItem(name, storage, desiredUnit = "") {
    return inventoryMatchCandidates(name, storage, desiredUnit)[0]?.item || null;
  }

  function cloneStorage(storage) {
    return {
      refrigerator: (storage?.refrigerator || []).map((item) => ({ ...item })),
      freezer: (storage?.freezer || []).map((item) => ({ ...item })),
      pantry: (storage?.pantry || []).map((item) => ({ ...item }))
    };
  }

  function removeAllocatedFood(storage, allocations) {
    const consumed = [];

    allocations.forEach((allocation) => {
      const section = allocation.section || findSectionForId(storage, allocation.itemId);
      const list = storage[section] || [];
      const index = list.findIndex((item) => item.id === allocation.itemId);
      if (index < 0) return;

      const current = list[index];
      const beforeAmount = cleanNumber(current.amount, 0);
      const beforePrice = cleanNumber(current.price, 0);
      const usedAmount = Math.min(beforeAmount, cleanNumber(allocation.storedAmount, 0));
      const remainingAmount = Math.max(0, beforeAmount - usedAmount);
      const remainingRatio = beforeAmount > 0 ? remainingAmount / beforeAmount : 0;

      current.amount = remainingAmount;
      current.price = beforePrice * remainingRatio;
      consumed.push({
        id: current.id,
        name: current.name,
        amount: usedAmount,
        unit: current.unit || "",
        section,
        cost: beforePrice - current.price
      });
    });

    Object.keys(storage).forEach((section) => {
      storage[section] = storage[section]
        .filter((item) => cleanNumber(item.amount, 0) > 0.0001);
    });

    return consumed;
  }

  function analyzeIngredient(ingredient, storage) {
    const need = cleanNumber(ingredient?.amount, 0);
    const unit = normalizeUnit(ingredient?.unit || "");
    const matches = findInventoryMatches(ingredient?.name, storage, unit);
    const match = matches[0] || findBestInventoryItem(ingredient?.name, storage, unit);
    const lots = matches.map((item) => ({
      item,
      have: convertAmount(cleanNumber(item.amount, 0), item.unit || "", unit) || 0,
      price: cleanNumber(item.price, 0)
    }));
    const compatible = lots.length > 0;
    const have = lots.reduce((sum, lot) => sum + lot.have, 0);
    const buy = Math.max(0, need - have);

    const pricedLots = lots.filter((lot) => lot.price > 0 && lot.have > 0);
    const pricedHave = pricedLots.reduce((sum, lot) => sum + lot.have, 0);
    const pricedTotal = pricedLots.reduce((sum, lot) => sum + lot.price, 0);
    const estimatedCost = pricedHave > 0 ? need * (pricedTotal / pricedHave) : 0;
    const allocations = [];
    let remainingNeed = need;
    let usedCost = 0;

    lots.forEach((lot) => {
      if (remainingNeed <= 0.0001 || lot.have <= 0) return;
      const requestedAmount = Math.min(remainingNeed, lot.have);
      const storedAmount = convertAmount(
        requestedAmount,
        unit,
        lot.item.unit || ""
      );
      if (storedAmount === null) return;

      const storedTotal = cleanNumber(lot.item.amount, 0);
      const allocationCost = storedTotal > 0
        ? (lot.price / storedTotal) * storedAmount
        : 0;
      allocations.push({
        itemId: lot.item.id,
        name: lot.item.name,
        section: lot.item.section || findSectionForId(storage, lot.item.id),
        requestedAmount,
        requestedUnit: unit,
        storedAmount,
        storedUnit: lot.item.unit || "",
        cost: allocationCost
      });
      usedCost += allocationCost;
      remainingNeed -= requestedAmount;
    });

    return {
      ingredient: {
        amount: need,
        unit,
        name: String(ingredient?.name || "").trim()
      },
      match,
      matches,
      allocations,
      compatible,
      have,
      need,
      buy,
      estimatedCost,
      usedCost
    };
  }

  function analyzeRecipe(ingredients, storage) {
    const workingStorage = cloneStorage(storage);
    const rows = [];
    (Array.isArray(ingredients) ? ingredients : [])
      .filter((ingredient) => String(ingredient?.name || "").trim() && cleanNumber(ingredient?.amount, 0) > 0)
      .forEach((ingredient) => {
        const row = analyzeIngredient(ingredient, workingStorage);
        rows.push(row);
        removeAllocatedFood(workingStorage, row.allocations);
      });
    return {
      rows,
      ready: rows.length > 0 && rows.every((row) => row.buy <= 0.0001),
      estimatedCost: rows.reduce((sum, row) => sum + row.estimatedCost, 0),
      usedCost: rows.reduce((sum, row) => sum + row.usedCost, 0),
      missingCount: rows.filter((row) => row.buy > 0.0001).length
    };
  }

  function consumeIngredients(storage, ingredients) {
    const nextStorage = cloneStorage(storage);
    const analysis = analyzeRecipe(ingredients, storage);
    const consumed = [];

    analysis.rows.forEach((row) => {
      consumed.push(...removeAllocatedFood(nextStorage, row.allocations));
    });

    return {
      storage: nextStorage,
      consumed,
      missing: analysis.rows.filter((row) => row.buy > 0.0001),
      totalUsedCost: consumed.reduce((sum, item) => sum + item.cost, 0)
    };
  }

  function rankRecipesByExpiry(recipes, storage, options = {}) {
    const warningDays = Math.max(1, Math.round(cleanNumber(options.warningDays, 7)));
    const today = options.today || new Date();
    const itemsById = new Map(flattenStorage(storage).map((item) => [item.id, item]));

    return (Array.isArray(recipes) ? recipes : [])
      .map((recipe) => {
        const analysis = analyzeRecipe(recipe?.ingredients || [], storage);
        const expiringById = new Map();

        analysis.rows.forEach((row) => {
          row.allocations.forEach((allocation) => {
            const item = itemsById.get(allocation.itemId);
            const status = expiryState(item, { today, warningDays });
            if (!item || status.days === null || status.days < 0 || status.days > warningDays) return;
            expiringById.set(item.id, {
              ...item,
              section: item.section || allocation.section || findSectionForId(storage, item.id),
              days: status.days
            });
          });
        });

        const expiringItems = [...expiringById.values()]
          .sort((a, b) => a.days - b.days || String(a.name).localeCompare(String(b.name)));
        const urgencyScore = expiringItems.reduce(
          (sum, item) => sum + (warningDays - item.days + 1) * 100,
          0
        );
        const score = urgencyScore +
          expiringItems.length * 25 +
          (analysis.ready ? 75 : 0) -
          analysis.missingCount * 30;

        return {
          recipe,
          analysis,
          ready: analysis.ready,
          missingCount: analysis.missingCount,
          missing: analysis.rows.filter((row) => row.buy > 0.0001),
          expiringItems,
          score
        };
      })
      .filter((idea) => idea.expiringItems.length)
      .sort((a, b) =>
        b.score - a.score ||
        Number(b.ready) - Number(a.ready) ||
        a.missingCount - b.missingCount ||
        String(a.recipe?.name || "").localeCompare(String(b.recipe?.name || ""))
      );
  }

  function findSectionForId(storage, id) {
    return ["refrigerator", "freezer", "pantry"].find((section) =>
      (storage?.[section] || []).some((item) => item.id === id)
    ) || "pantry";
  }

  return {
    analyzeIngredient,
    analyzeRecipe,
    cleanNumber,
    consumeIngredients,
    convertAmount,
    daysUntilBestBy,
    expiryState,
    findBestInventoryItem,
    findInventoryMatches,
    flattenStorage,
    localDateValue,
    nameMatchScore,
    normalizeDateValue,
    normalizeFoodName,
    normalizeUnit,
    rankRecipesByExpiry,
    unitInfo
  };
});
