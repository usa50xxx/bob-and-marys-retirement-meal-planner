(function initializeRecipeReader(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MealPlannerRecipeReader = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createRecipeReader() {
  "use strict";

  const unitNames = [
    "tablespoons", "tablespoon", "teaspoons", "teaspoon", "packages", "package",
    "packets", "packet", "ounces", "ounce", "pounds", "pound", "quarts", "quart",
    "pints", "pint", "cloves", "clove", "slices", "slice", "pieces", "piece",
    "cups", "cup", "cans", "can", "jars", "jar", "sticks", "stick", "bunches",
    "bunch", "heads", "head", "tbsp", "tsp", "lbs", "lb", "oz", "grams", "gram",
    "kilograms", "kilogram", "milliliters", "milliliter", "liters", "liter",
    "pinches", "pinch", "dashes", "dash", "count"
  ];
  const unicodeFractions = {
    "\u00bc": 0.25,
    "\u00bd": 0.5,
    "\u00be": 0.75,
    "\u2153": 1 / 3,
    "\u2154": 2 / 3,
    "\u2155": 0.2,
    "\u2156": 0.4,
    "\u2157": 0.6,
    "\u2158": 0.8,
    "\u2159": 1 / 6,
    "\u215a": 5 / 6,
    "\u215b": 0.125,
    "\u215c": 0.375,
    "\u215d": 0.625,
    "\u215e": 0.875
  };

  function decodeEntities(value) {
    const namedEntities = {
      nbsp: " ",
      amp: "&",
      quot: "\"",
      apos: "'",
      lt: "<",
      gt: ">"
    };
    return String(value || "").replace(
      /&(?:nbsp|amp|quot|apos|lt|gt|#39|#\d+);/gi,
      function decodeEntity(entity) {
        const code = entity.slice(1, -1);
        if (code.charAt(0) === "#") return String.fromCharCode(Number(code.slice(1)));
        return namedEntities[code.toLowerCase()];
      }
    );
  }

  function stripHtml(value) {
    return decodeEntities(String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|li|div|section|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " "))
      .replace(/[ \t]+/g, " ")
      .replace(/\s*\n\s*/g, "\n")
      .trim();
  }

  function parseLeadingAmount(text) {
    const value = String(text || "").trim();
    const unicode = value.match(/^(\d+)?\s*([\u00bc-\u00be\u2153-\u215e])\s*/);
    if (unicode) {
      return {
        amount: Number(unicode[1] || 0) + unicodeFractions[unicode[2]],
        length: unicode[0].length
      };
    }

    const mixed = value.match(/^(\d+)\s+(\d+)\/(\d+)\s*/);
    if (mixed) {
      return {
        amount: Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]),
        length: mixed[0].length
      };
    }

    const fraction = value.match(/^(\d+)\/(\d+)\s*/);
    if (fraction) {
      return {
        amount: Number(fraction[1]) / Number(fraction[2]),
        length: fraction[0].length
      };
    }

    const decimal = value.match(/^(\d+(?:\.\d+)?)\s*/);
    if (decimal) return { amount: Number(decimal[1]), length: decimal[0].length };
    return { amount: 1, length: 0 };
  }

  function parseIngredientLine(line) {
    const cleaned = stripHtml(line)
      .replace(/^[-*\u2022]\s*/, "")
      .replace(/^\d+[.)]\s+/, "")
      .trim();
    const amountMatch = parseLeadingAmount(cleaned);
    let remainder = cleaned.slice(amountMatch.length).replace(/^[-, ]+/, "").trim();
    let unit = "";

    const firstWords = remainder.toLowerCase().match(/^([a-z]+(?:\s+[a-z]+)?)(?:\s+|$)/)?.[1] || "";
    const matchingUnit = unitNames
      .slice()
      .sort((a, b) => b.length - a.length)
      .find((candidate) => firstWords === candidate || firstWords.startsWith(`${candidate} `));
    if (matchingUnit) {
      const originalUnit = remainder.slice(0, matchingUnit.length);
      unit = originalUnit;
      remainder = remainder.slice(matchingUnit.length).replace(/^[-, ]+/, "").trim();
    }

    return {
      amount: Number.isFinite(amountMatch.amount) && amountMatch.amount > 0 ? amountMatch.amount : 1,
      unit,
      name: remainder || cleaned || "Ingredient"
    };
  }

  function looksLikeIngredient(line) {
    const value = String(line || "").trim();
    return /^[-*\u2022]?\s*(?:\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+|[\u00bc-\u00be\u2153-\u215e])/u.test(value)
      || /\b(?:cup|tbsp|tsp|ounce|pound|clove|can|package|pinch|dash)s?\b/i.test(value);
  }

  function friendlyDuration(value) {
    const source = String(value || "").trim();
    const match = source.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?$/i);
    if (!match) return source;
    const parts = [];
    if (Number(match[1])) parts.push(`${Number(match[1])} day${Number(match[1]) === 1 ? "" : "s"}`);
    if (Number(match[2])) parts.push(`${Number(match[2])} hour${Number(match[2]) === 1 ? "" : "s"}`);
    if (Number(match[3])) parts.push(`${Number(match[3])} minute${Number(match[3]) === 1 ? "" : "s"}`);
    return parts.join(" ");
  }

  function extractLabeledValue(lines, labels) {
    const expression = new RegExp(`^(?:${labels.join("|")})\\s*:?\\s*(.+)$`, "i");
    return lines.map((line) => line.match(expression)).find(Boolean)?.[1]?.trim() || "";
  }

  function extractTemperature(text) {
    const source = String(text || "");
    const labeled = source.match(/\b(?:oven|temperature|temp)\s*(?:to|at|:)?\s*(\d{2,3})\s*(?:degrees?\s*)?([fc])?\b/i);
    const general = source.match(/\b(\d{2,3})\s*(?:degrees?\s*)?([fc])\b/i);
    const match = labeled || general;
    if (!match) return "";
    return `${match[1]}\u00b0${String(match[2] || "F").toUpperCase()}`;
  }

  function parseServings(value, fallback = 2) {
    const source = typeof value === "object" && value !== null
      ? value.value || value.maxValue || value.name || ""
      : value;
    const match = String(source || "").match(/(\d+(?:\.\d+)?)/);
    const servings = match ? Number(match[1]) : Number(fallback);
    return Number.isFinite(servings) && servings > 0 ? servings : 2;
  }

  function parseText(text, options = {}) {
    const source = stripHtml(text);
    const lines = source
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (!lines.length) throw new Error("No recipe words were found.");

    const headingPattern = /^(ingredients?|directions?|instructions?|method|preparation|steps?|notes?)\s*:?\s*$/i;
    const metadataPattern = /^(?:serves?|servings?|yield|prep(?:aration)?\s*time|cook(?:ing)?\s*time|total\s*time|oven|temperature|temp)\b/i;
    const title = lines.find((line) => !headingPattern.test(line) && !metadataPattern.test(line))
      || options.name
      || "Imported recipe";
    const servingsLine = lines.find((line) => /^(?:serves?|servings?|yield)\b/i.test(line)) || "";
    const prepTime = friendlyDuration(extractLabeledValue(lines, ["prep(?:aration)?\\s*time"]));
    const cookTime = friendlyDuration(extractLabeledValue(lines, ["cook(?:ing)?\\s*time"]));
    const totalTime = friendlyDuration(extractLabeledValue(lines, ["total\\s*time"]));
    const ingredientLines = [];
    const instructionLines = [];
    let mode = "";
    let hasIngredientHeading = false;

    lines.forEach((line) => {
      if (/^ingredients?\s*:?\s*$/i.test(line)) {
        mode = "ingredients";
        hasIngredientHeading = true;
        return;
      }
      if (/^(?:directions?|instructions?|method|preparation|steps?)\s*:?\s*$/i.test(line)) {
        mode = "instructions";
        return;
      }
      if (line === title || metadataPattern.test(line)) return;
      if (mode === "ingredients") {
        ingredientLines.push(line);
        return;
      }
      if (mode === "instructions") {
        instructionLines.push(line);
      }
    });

    if (!hasIngredientHeading) {
      let sawIngredient = false;
      lines.forEach((line) => {
        if (line === title || metadataPattern.test(line) || headingPattern.test(line)) return;
        if (looksLikeIngredient(line) && !instructionLines.includes(line)) {
          ingredientLines.push(line);
          sawIngredient = true;
        } else if (sawIngredient && !instructionLines.includes(line)) {
          instructionLines.push(line);
        }
      });
    }

    const ingredients = ingredientLines
      .map(parseIngredientLine)
      .filter((ingredient) => ingredient.name);
    const notes = instructionLines
      .map((line) => line.replace(/^\s*(?:step\s*)?\d+[.)-]?\s*/i, "").trim())
      .filter(Boolean)
      .join("\n");

    return {
      name: title.replace(/^recipe\s*:\s*/i, "").trim(),
      baseServings: parseServings(servingsLine, options.baseServings || 2),
      prepTime,
      cookTime,
      totalTime,
      temperature: extractTemperature(`${source}\n${notes}`),
      sourceUrl: options.sourceUrl || "",
      photo: options.photo || "",
      notes,
      ingredients
    };
  }

  function typeIncludesRecipe(type) {
    return (Array.isArray(type) ? type : [type])
      .some((value) => String(value || "").toLowerCase().split("/").pop() === "recipe");
  }

  function findRecipeObject(value, seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value)) return null;
    seen.add(value);
    if (typeIncludesRecipe(value["@type"])) return value;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findRecipeObject(item, seen);
        if (found) return found;
      }
      return null;
    }
    for (const nested of Object.values(value)) {
      const found = findRecipeObject(nested, seen);
      if (found) return found;
    }
    return null;
  }

  function flattenInstructions(value) {
    if (!value) return [];
    if (typeof value === "string") {
      return stripHtml(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    }
    if (Array.isArray(value)) return value.flatMap(flattenInstructions);
    if (typeof value === "object") {
      const heading = value.name && !value.text ? [stripHtml(value.name)] : [];
      const content = value.itemListElement || value.steps || value.text || value.description || value.name || "";
      return [...heading, ...flattenInstructions(content)];
    }
    return [];
  }

  function normalizeImage(value) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") return first;
    if (first && typeof first === "object") return first.url || first.contentUrl || "";
    return "";
  }

  function scriptElements(html) {
    const source = String(html || "");
    const lowerSource = source.toLowerCase();
    const elements = [];
    let offset = 0;

    while (offset < source.length) {
      const start = lowerSource.indexOf("<script", offset);
      if (start < 0) break;
      const boundary = source.charAt(start + 7);
      if (boundary && !/[\s/>]/.test(boundary)) {
        offset = start + 7;
        continue;
      }

      let quote = "";
      let openEnd = start + 7;
      for (; openEnd < source.length; openEnd += 1) {
        const character = source.charAt(openEnd);
        if (quote) {
          if (character === quote) quote = "";
        } else if (character === "\"" || character === "'") {
          quote = character;
        } else if (character === ">") {
          break;
        }
      }
      if (openEnd >= source.length) break;

      let closeStart = lowerSource.indexOf("</script", openEnd + 1);
      while (
        closeStart >= 0
        && source.charAt(closeStart + 8)
        && !/[\s>]/.test(source.charAt(closeStart + 8))
      ) {
        closeStart = lowerSource.indexOf("</script", closeStart + 8);
      }
      if (closeStart < 0) break;
      const closeEnd = source.indexOf(">", closeStart + 8);
      if (closeEnd < 0) break;

      elements.push({
        openTag: source.slice(start, openEnd + 1),
        body: source.slice(openEnd + 1, closeStart)
      });
      offset = closeEnd + 1;
    }
    return elements;
  }

  function attributeValue(openTag, requestedName) {
    const source = String(openTag || "");
    const requested = String(requestedName || "").toLowerCase();
    let offset = source.toLowerCase().indexOf("script") + 6;

    while (offset > 5 && offset < source.length) {
      while (offset < source.length && /[\s/>]/.test(source.charAt(offset))) offset += 1;
      const nameStart = offset;
      while (offset < source.length && !/[\s=/>]/.test(source.charAt(offset))) offset += 1;
      if (nameStart === offset) break;
      const name = source.slice(nameStart, offset).toLowerCase();
      while (offset < source.length && /\s/.test(source.charAt(offset))) offset += 1;
      if (source.charAt(offset) !== "=") continue;
      offset += 1;
      while (offset < source.length && /\s/.test(source.charAt(offset))) offset += 1;

      const quote = source.charAt(offset);
      let valueStart = offset;
      let valueEnd = offset;
      if (quote === "\"" || quote === "'") {
        valueStart = offset + 1;
        valueEnd = source.indexOf(quote, valueStart);
        if (valueEnd < 0) valueEnd = source.length;
        offset = valueEnd + 1;
      } else {
        while (valueEnd < source.length && !/[\s>]/.test(source.charAt(valueEnd))) valueEnd += 1;
        offset = valueEnd;
      }
      if (name === requested) return source.slice(valueStart, valueEnd);
    }
    return "";
  }

  function unwrapHtmlComment(value) {
    const source = String(value || "").trim();
    if (source.slice(0, 4) === "<!--") {
      if (source.slice(-3) === "-->") return source.slice(4, -3).trim();
      if (source.slice(-4) === "--!>") return source.slice(4, -4).trim();
    }
    return source;
  }

  function jsonLdRecipe(html) {
    const scripts = scriptElements(html);
    for (const script of scripts) {
      if (attributeValue(script.openTag, "type").toLowerCase() !== "application/ld+json") continue;
      const body = unwrapHtmlComment(script.body);
      try {
        const found = findRecipeObject(JSON.parse(body));
        if (found) return found;
      } catch {
        // Some pages contain malformed metadata; the text fallback still works.
      }
    }
    return null;
  }

  function itemListValues(value) {
    const source = value?.itemListElement || value;
    if (!Array.isArray(source)) return source ? [source] : [];
    return source.map((item) => item?.item?.name || item?.name || item?.value || item).filter(Boolean);
  }

  function parseHtml(html, sourceUrl = "") {
    const structured = jsonLdRecipe(html);
    if (!structured) return parseText(stripHtml(html), { sourceUrl });

    const instructions = flattenInstructions(structured.recipeInstructions || structured.step);
    const ingredientValues = itemListValues(structured.recipeIngredient || structured.ingredients);
    return {
      name: stripHtml(structured.name || structured.headline || "Imported recipe"),
      baseServings: parseServings(structured.recipeYield || structured.yield, 2),
      prepTime: friendlyDuration(structured.prepTime),
      cookTime: friendlyDuration(structured.cookTime),
      totalTime: friendlyDuration(structured.totalTime),
      temperature: extractTemperature(instructions.join("\n")),
      sourceUrl,
      photo: normalizeImage(structured.image),
      notes: instructions.join("\n"),
      ingredients: ingredientValues.map((value) => parseIngredientLine(String(value))).filter((ingredient) => ingredient.name)
    };
  }

  return {
    extractTemperature,
    friendlyDuration,
    looksLikeIngredient,
    parseHtml,
    parseIngredientLine,
    parseServings,
    parseText
  };
});
