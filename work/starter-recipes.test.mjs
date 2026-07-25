import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const appRoot = path.resolve("outputs/meal-planner");
const source = await fs.readFile(path.join(appRoot, "starter-recipes.js"), "utf8");
const context = {};
vm.runInNewContext(source, context, { filename: "starter-recipes.js" });

const recipes = context.SUPPERLOOM_STARTER_RECIPES;
assert.ok(Array.isArray(recipes), "Starter recipe catalog did not load.");
assert.ok(recipes.length >= 50 && recipes.length <= 100, "Expected 50 to 100 starter recipes.");
assert.equal(new Set(recipes.map((recipe) => recipe.id)).size, recipes.length, "Recipe IDs must be unique.");
assert.equal(
  new Set(recipes.map((recipe) => recipe.name.trim().toLowerCase())).size,
  recipes.length,
  "Recipe names must be unique.",
);

for (const recipe of recipes) {
  assert.match(recipe.id, /^starter-[a-z0-9-]+$/, `Invalid starter ID for ${recipe.name}.`);
  assert.ok(recipe.name.trim(), "Every starter recipe needs a name.");
  assert.ok(recipe.baseServings > 0, `${recipe.name} needs a serving count.`);
  assert.ok(recipe.ingredients.length >= 3, `${recipe.name} needs at least three ingredients.`);
  assert.ok(recipe.notes.split("\n").length >= 2, `${recipe.name} needs step-by-step directions.`);
  assert.ok(recipe.prepTime, `${recipe.name} needs a prep time.`);
  assert.ok(recipe.cookTime, `${recipe.name} needs a cook time.`);
  await fs.access(path.join(appRoot, recipe.photo));

  for (const item of recipe.ingredients) {
    assert.ok(Number.isFinite(item.amount) && item.amount > 0, `${recipe.name} has an invalid amount.`);
    assert.ok(item.name.trim(), `${recipe.name} has a blank ingredient.`);
  }
}

for (const expected of [
  "Classic Meatloaf",
  "Oven Roasted Chicken",
  "Baked Salmon",
  "Slow Cooker Pulled Pork",
  "Weeknight Chili",
  "Buttermilk Pancakes",
]) {
  assert.ok(recipes.some((recipe) => recipe.name === expected), `Missing basic recipe: ${expected}.`);
}

console.log(`Starter recipe tests passed (${recipes.length} offline recipes).`);
