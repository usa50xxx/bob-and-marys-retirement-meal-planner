import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const imageDir = path.resolve("outputs/meal-planner/images/ingredients");
const aliasesFile = path.join(imageDir, "IMAGE_ALIASES.json");
const browserAliasesFile = path.resolve(
  "outputs/meal-planner/ingredient-image-aliases.js",
);
const preferredNames = [
  "fish",
  "chicken",
  "beef",
  "pork",
  "turkey",
  "sausage",
  "ketchup",
  "rice",
  "chicken_breast",
  "gravy",
  "shrimp",
  "flour",
  "mustard",
  "oats",
  "broth",
  "bread",
  "tortillas",
  "tuna",
  "chicken_thighs",
  "mayonnaise",
  "ginger",
  "salmon",
  "jelly",
  "heavy_cream",
  "salt",
  "peas",
  "mushrooms",
  "maple_syrup",
  "hot_sauce",
  "lobster",
  "basil",
  "lasagna",
  "lettuce",
  "anchovies",
  "top_round",
  "potato",
  "sea_bass",
  "powdered_sugar",
  "sugar",
  "olive_oil",
  "noodles",
  "onion",
  "pork_chops",
  "paprika",
  "bell_pepper",
  "black_pepper",
  "chili_powder",
  "chickpeas",
  "cayenne",
  "carrot",
  "calamari",
  "green_beans",
  "breadcrumbs",
  "cinnamon",
  "eggs",
  "parsley",
  "ham",
  "macaroni",
  "oregano",
  "bay_leaf",
  "beef_broth",
  "cumin",
  "cucumber",
];

async function readAliases() {
  try {
    return JSON.parse(await fs.readFile(aliasesFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function chooseCanonical(names) {
  for (const preferred of preferredNames) {
    if (names.includes(preferred)) return preferred;
  }
  return [...names].sort((left, right) => (
    left.length - right.length || left.localeCompare(right)
  ))[0];
}

const existingAliases = await readAliases();
const imageNames = (await fs.readdir(imageDir))
  .filter((name) => name.toLowerCase().endsWith(".webp"))
  .sort();
const groups = new Map();

for (const imageName of imageNames) {
  const contents = await fs.readFile(path.join(imageDir, imageName));
  const hash = createHash("sha256").update(contents).digest("hex");
  if (!groups.has(hash)) groups.set(hash, []);
  groups.get(hash).push(imageName.replace(/\.webp$/i, ""));
}

const aliases = { ...existingAliases };
let removed = 0;
for (const names of groups.values()) {
  if (names.length < 2) continue;
  const canonical = chooseCanonical(names);
  for (const name of names) {
    if (name === canonical) continue;
    aliases[name] = canonical;
    await fs.rm(path.join(imageDir, `${name}.webp`));
    removed += 1;
  }
}

const sortedAliases = Object.fromEntries(
  Object.entries(aliases).sort(([left], [right]) => left.localeCompare(right)),
);
const remaining = new Set(
  (await fs.readdir(imageDir))
    .filter((name) => name.toLowerCase().endsWith(".webp"))
    .map((name) => name.replace(/\.webp$/i, "")),
);

for (const [alias, target] of Object.entries(sortedAliases)) {
  if (remaining.has(alias)) {
    throw new Error(`Alias source still has a physical file: ${alias}.webp`);
  }
  if (!remaining.has(target)) {
    throw new Error(`Alias target does not exist: ${alias} -> ${target}`);
  }
  if (sortedAliases[target]) {
    throw new Error(`Alias chains are not allowed: ${alias} -> ${target}`);
  }
}

await fs.writeFile(
  aliasesFile,
  `${JSON.stringify(sortedAliases, null, 2)}\n`,
  "utf8",
);
await fs.writeFile(
  browserAliasesFile,
  `(function (global) {\n`
    + `  global.BOB_MARY_INGREDIENT_IMAGE_ALIASES = Object.freeze(`
    + `${JSON.stringify(sortedAliases, null, 2)});\n`
    + `})(window);\n`,
  "utf8",
);

console.log(JSON.stringify({
  originalFiles: imageNames.length,
  removed,
  remainingFiles: remaining.size,
  aliases: Object.keys(sortedAliases).length,
  aliasesFile,
  browserAliasesFile,
}, null, 2));
