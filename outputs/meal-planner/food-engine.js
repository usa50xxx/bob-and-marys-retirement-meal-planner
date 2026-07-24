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
    piece: "item"
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
    item: { dimension: "count", factor: 1 }
  };

  const STOP_WORDS = new Set([
    "and", "the", "with", "fresh", "frozen", "organic", "great", "value",
    "boneless", "skinless", "shredded", "large", "small", "medium", "favorite"
  ]);

  function cleanNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
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

  function findBestInventoryItem(name, storage, desiredUnit = "") {
    const candidates = flattenStorage(storage)
      .map((item) => {
        const score = nameMatchScore(name, item.name);
        const conversion = convertAmount(1, item.unit || "", desiredUnit || item.unit || "");
        return { item, score, compatible: conversion !== null };
      })
      .filter((entry) => entry.score >= 55)
      .sort((a, b) => {
        if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
        return b.score - a.score;
      });
    return candidates[0]?.item || null;
  }

  function analyzeIngredient(ingredient, storage) {
    const need = cleanNumber(ingredient?.amount, 0);
    const unit = normalizeUnit(ingredient?.unit || "");
    const match = findBestInventoryItem(ingredient?.name, storage, unit);
    const convertedHave = match
      ? convertAmount(cleanNumber(match.amount, 0), match.unit || "", unit)
      : null;
    const compatible = convertedHave !== null;
    const have = compatible ? convertedHave : 0;
    const buy = Math.max(0, need - have);

    let estimatedCost = 0;
    let usedCost = 0;
    if (match && compatible && cleanNumber(match.price, 0) > 0 && have > 0) {
      const costPerRequestedUnit = cleanNumber(match.price, 0) / have;
      estimatedCost = need * costPerRequestedUnit;
      usedCost = Math.min(need, have) * costPerRequestedUnit;
    }

    return {
      ingredient: {
        amount: need,
        unit,
        name: String(ingredient?.name || "").trim()
      },
      match,
      compatible,
      have,
      need,
      buy,
      estimatedCost,
      usedCost
    };
  }

  function analyzeRecipe(ingredients, storage) {
    const rows = (Array.isArray(ingredients) ? ingredients : [])
      .filter((ingredient) => String(ingredient?.name || "").trim() && cleanNumber(ingredient?.amount, 0) > 0)
      .map((ingredient) => analyzeIngredient(ingredient, storage));
    return {
      rows,
      ready: rows.length > 0 && rows.every((row) => row.buy <= 0.0001),
      estimatedCost: rows.reduce((sum, row) => sum + row.estimatedCost, 0),
      usedCost: rows.reduce((sum, row) => sum + row.usedCost, 0),
      missingCount: rows.filter((row) => row.buy > 0.0001).length
    };
  }

  function consumeIngredients(storage, ingredients) {
    const nextStorage = {
      refrigerator: (storage?.refrigerator || []).map((item) => ({ ...item })),
      freezer: (storage?.freezer || []).map((item) => ({ ...item })),
      pantry: (storage?.pantry || []).map((item) => ({ ...item }))
    };
    const analysis = analyzeRecipe(ingredients, nextStorage);
    const consumed = [];

    analysis.rows.forEach((row) => {
      if (!row.match || !row.compatible || row.have <= 0) return;
      const section = row.match.section || findSectionForId(nextStorage, row.match.id);
      const list = nextStorage[section] || [];
      const index = list.findIndex((item) => item.id === row.match.id);
      if (index < 0) return;

      const current = list[index];
      const requestedInStoredUnit = convertAmount(
        Math.min(row.need, row.have),
        row.ingredient.unit,
        current.unit || ""
      );
      if (requestedInStoredUnit === null) return;

      const beforeAmount = cleanNumber(current.amount, 0);
      const usedAmount = Math.min(beforeAmount, requestedInStoredUnit);
      const ratioRemaining = beforeAmount > 0 ? Math.max(0, (beforeAmount - usedAmount) / beforeAmount) : 0;
      current.amount = Math.max(0, beforeAmount - usedAmount);
      current.price = cleanNumber(current.price, 0) * ratioRemaining;
      consumed.push({
        name: current.name,
        amount: usedAmount,
        unit: current.unit || "",
        section
      });
    });

    Object.keys(nextStorage).forEach((section) => {
      nextStorage[section] = nextStorage[section].filter((item) => cleanNumber(item.amount, 0) > 0.0001);
    });

    return {
      storage: nextStorage,
      consumed,
      missing: analysis.rows.filter((row) => row.buy > 0.0001)
    };
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
    findBestInventoryItem,
    flattenStorage,
    nameMatchScore,
    normalizeFoodName,
    normalizeUnit,
    unitInfo
  };
});
