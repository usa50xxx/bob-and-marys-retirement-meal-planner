const assert = require("assert");
const {
  extractTemperature,
  friendlyDuration,
  parseHtml,
  parseIngredientLine,
  parseText
} = require("../outputs/meal-planner/recipe-reader.js");

const pasted = parseText(`
Grandma's Meatloaf
Serves 4
Prep time: 15 minutes
Cook time: 1 hour
Temperature: 350 F

Ingredients
1 1/2 lb ground beef
2 eggs
1/2 cup ketchup
1 packet onion soup mix

Instructions
1. Mix the ingredients.
2. Shape into a loaf.
3. Bake until cooked through.
`);

assert.equal(pasted.name, "Grandma's Meatloaf");
assert.equal(pasted.baseServings, 4);
assert.equal(pasted.prepTime, "15 minutes");
assert.equal(pasted.cookTime, "1 hour");
assert.equal(pasted.temperature, "350°F");
assert.equal(pasted.ingredients.length, 4);
assert.equal(pasted.ingredients[0].amount, 1.5);
assert.equal(pasted.ingredients[0].unit, "lb");
assert.equal(pasted.ingredients[0].name, "ground beef");
assert.match(pasted.notes, /Mix the ingredients/);

const structuredHtml = `<!doctype html>
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [{
    "@type": ["Recipe", "Thing"],
    "name": "Lemon Sheet Pan Chicken",
    "recipeYield": "4 servings",
    "prepTime": "PT20M",
    "cookTime": "PT45M",
    "totalTime": "PT1H5M",
    "image": {"url": "https://images.example/chicken.jpg"},
    "recipeIngredient": [
      "2 lb chicken thighs",
      "1 lemon",
      "2 tbsp olive oil"
    ],
    "recipeInstructions": [{
      "@type": "HowToSection",
      "name": "Bake",
      "itemListElement": [
        {"@type": "HowToStep", "text": "Heat the oven to 400 F."},
        {"@type": "HowToStep", "text": "Bake for 45 minutes."}
      ]
    }]
  }]
}
</script>
</head><body>Fallback page words</body></html>`;

const structured = parseHtml(structuredHtml, "https://recipes.example/chicken");
assert.equal(structured.name, "Lemon Sheet Pan Chicken");
assert.equal(structured.baseServings, 4);
assert.equal(structured.prepTime, "20 minutes");
assert.equal(structured.cookTime, "45 minutes");
assert.equal(structured.totalTime, "1 hour 5 minutes");
assert.equal(structured.temperature, "400°F");
assert.equal(structured.photo, "https://images.example/chicken.jpg");
assert.equal(structured.sourceUrl, "https://recipes.example/chicken");
assert.equal(structured.ingredients[2].unit, "tbsp");
assert.match(structured.notes, /Heat the oven/);

assert.deepEqual(parseIngredientLine("¾ cup breadcrumbs"), {
  amount: 0.75,
  unit: "cup",
  name: "breadcrumbs"
});
assert.equal(friendlyDuration("PT2H30M"), "2 hours 30 minutes");
assert.equal(extractTemperature("Preheat oven to 375 degrees F."), "375°F");

console.log(JSON.stringify({
  passed: true,
  textRecipe: pasted.name,
  structuredRecipe: structured.name,
  ingredientCount: structured.ingredients.length
}, null, 2));
