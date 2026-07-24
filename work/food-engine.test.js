const assert = require("node:assert/strict");
const food = require("../outputs/meal-planner/food-engine.js");
const receipts = require("../outputs/meal-planner/receipt-reader.js");

assert.equal(food.convertAmount(1, "lb", "oz"), 16);
assert.equal(food.convertAmount(1, "cup", "tbsp"), 16);
assert.equal(food.convertAmount(2, "eggs", "item"), 2);
assert.equal(food.convertAmount(1, "cup", "lb"), null);

const storage = {
  refrigerator: [
    { id: "beef", name: "Ground Beef 80/20", amount: 2, unit: "lb", price: 10, store: "Walmart" },
    { id: "eggs", name: "Large Eggs", amount: 12, unit: "item", price: 3.6, store: "Publix" }
  ],
  freezer: [],
  pantry: []
};
const recipe = [
  { name: "ground beef", amount: 24, unit: "oz" },
  { name: "eggs", amount: 2, unit: "eggs" }
];
const analysis = food.analyzeRecipe(recipe, storage);
assert.equal(analysis.ready, true);
assert.equal(analysis.rows[0].have, 32);
assert.equal(analysis.rows[0].buy, 0);
assert.equal(Number(analysis.estimatedCost.toFixed(2)), 8.1);

const consumed = food.consumeIngredients(storage, recipe);
assert.equal(consumed.storage.refrigerator[0].amount, 0.5);
assert.equal(consumed.storage.refrigerator[1].amount, 10);
assert.equal(Number(consumed.storage.refrigerator[0].price.toFixed(2)), 2.5);

const receiptRows = receipts.parseReceiptText(`
Walmart
Great Value Ketchup $2.48
2 x Chicken Breast $9.96
Subtotal $12.44
`);
assert.equal(receiptRows.length, 2);
assert.equal(receiptRows[0].store, "Walmart");
assert.equal(receiptRows[1].amount, 2);
assert.equal(receiptRows[1].price, 9.96);

console.log("food-engine tests passed");
