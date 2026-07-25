const assert = require("assert");
const {
  addSnapshot,
  chooseLocalRecovery,
  normalizeSnapshots,
  parsePlanner
} = require("../outputs/meal-planner/recovery.js");

function planner(name, savedAt) {
  return JSON.stringify({
    schemaVersion: 5,
    savedAt,
    recipes: [{
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      baseServings: 2,
      ingredients: [{ amount: 1, unit: "item", name: "milk" }]
    }]
  });
}

const current = planner("Current", "2026-07-24T12:00:00.000Z");
const pending = planner("Pending", "2026-07-24T12:05:00.000Z");
const previous = planner("Previous", "2026-07-24T11:00:00.000Z");

const normal = chooseLocalRecovery({ current, pending: null, previous });
assert.equal(normal.source, "current");
assert.equal(normal.recovered, false);
assert.equal(normal.data.recipes[0].name, "Current");

const interrupted = chooseLocalRecovery({ current, pending, previous });
assert.equal(interrupted.source, "pending");
assert.equal(interrupted.recovered, true);
assert.match(interrupted.message, /interrupted/i);
assert.equal(interrupted.data.recipes[0].name, "Pending");

const corrupt = chooseLocalRecovery({ current: "{broken", pending: null, previous });
assert.equal(corrupt.source, "previous");
assert.equal(corrupt.data.recipes[0].name, "Previous");
assert.match(corrupt.message, /previous good save/i);

assert.equal(parsePlanner("{}"), null);
assert.equal(parsePlanner("{bad"), null);

let snapshots = addSnapshot([], current, {
  id: "one",
  label: "First",
  now: "2026-07-24T12:00:00.000Z",
  maxCount: 2
});
snapshots = addSnapshot(snapshots, pending, {
  id: "two",
  label: "Second",
  now: "2026-07-24T12:05:00.000Z",
  maxCount: 2
});
snapshots = addSnapshot(snapshots, previous, {
  id: "three",
  label: "Third",
  now: "2026-07-24T12:10:00.000Z",
  maxCount: 2
});
assert.deepEqual(normalizeSnapshots(snapshots).map((item) => item.id), ["three", "two"]);
assert.equal(addSnapshot(snapshots, previous, { id: "duplicate" }).length, 2);

console.log(JSON.stringify({
  passed: true,
  interruptedSource: interrupted.source,
  corruptSource: corrupt.source,
  snapshotCount: snapshots.length
}, null, 2));
