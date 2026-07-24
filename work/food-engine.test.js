const assert = require("node:assert/strict");
const food = require("../outputs/meal-planner/food-engine.js");
const receipts = require("../outputs/meal-planner/receipt-reader.js");

assert.equal(food.convertAmount(1, "lb", "oz"), 16);
assert.equal(food.convertAmount(1, "cup", "tbsp"), 16);
assert.equal(food.convertAmount(2, "eggs", "item"), 2);
assert.equal(food.convertAmount(2, "count", "item"), 2);
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
assert.equal(Number(consumed.totalUsedCost.toFixed(2)), 8.1);
assert.equal(storage.refrigerator[0].amount, 2);
assert.equal(storage.refrigerator[0].price, 10);

const splitStorage = {
  refrigerator: [
    { id: "beef-a", name: "Ground Beef 80/20", amount: 8, unit: "oz", price: 3 }
  ],
  freezer: [
    { id: "beef-b", name: "Ground Beef", amount: 1, unit: "lb", price: 6 }
  ],
  pantry: []
};
const splitAnalysis = food.analyzeIngredient(
  { name: "ground beef", amount: 1.25, unit: "lb" },
  splitStorage
);
assert.equal(splitAnalysis.matches.length, 2);
assert.equal(splitAnalysis.have, 1.5);
assert.equal(splitAnalysis.buy, 0);
assert.equal(Number(splitAnalysis.estimatedCost.toFixed(2)), 7.5);

const splitConsumed = food.consumeIngredients(splitStorage, [
  { name: "ground beef", amount: 1.25, unit: "lb" }
]);
assert.equal(splitConsumed.storage.freezer.length, 0);
assert.equal(splitConsumed.storage.refrigerator[0].amount, 4);
assert.equal(Number(splitConsumed.storage.refrigerator[0].price.toFixed(2)), 1.5);
assert.equal(splitConsumed.consumed.length, 2);
assert.equal(Number(splitConsumed.totalUsedCost.toFixed(2)), 7.5);

const duplicateAnalysis = food.analyzeRecipe([
  { name: "ground beef", amount: 12, unit: "oz" },
  { name: "ground beef", amount: 8, unit: "oz" }
], {
  refrigerator: [],
  freezer: [{ id: "only-beef", name: "ground beef", amount: 1, unit: "lb", price: 6 }],
  pantry: []
});
assert.equal(duplicateAnalysis.rows[0].have, 16);
assert.equal(duplicateAnalysis.rows[0].buy, 0);
assert.equal(duplicateAnalysis.rows[1].have, 4);
assert.equal(duplicateAnalysis.rows[1].buy, 4);
assert.equal(duplicateAnalysis.ready, false);
assert.equal(duplicateAnalysis.missingCount, 1);

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
