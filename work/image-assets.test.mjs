import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const imageDir = path.resolve("outputs/meal-planner/images/ingredients");
const aliases = JSON.parse(
  await fs.readFile(path.join(imageDir, "IMAGE_ALIASES.json"), "utf8"),
);
const provenance = JSON.parse(
  await fs.readFile(path.join(imageDir, "IMAGE_PROVENANCE.json"), "utf8"),
);
const imageNames = (await fs.readdir(imageDir))
  .filter((name) => name.endsWith(".webp"))
  .sort();
const imageKeys = new Set(imageNames.map((name) => name.replace(/\.webp$/, "")));
const hashes = new Map();

for (const imageName of imageNames) {
  const contents = await fs.readFile(path.join(imageDir, imageName));
  const hash = createHash("sha256").update(contents).digest("hex");
  assert.equal(hashes.has(hash), false, `Duplicate image bytes: ${imageName}`);
  hashes.set(hash, imageName);
}

assert.ok(Object.keys(aliases).length >= 100, "Expected the duplicate alias map.");
for (const [alias, target] of Object.entries(aliases)) {
  assert.equal(imageKeys.has(alias), false, `${alias}.webp should be represented by its alias`);
  assert.equal(imageKeys.has(target), true, `Missing alias target: ${alias} -> ${target}`);
  assert.equal(Boolean(aliases[target]), false, `Alias chain: ${alias} -> ${target}`);
}

const generatedBeefFiles = [
  "beef_tenderloin.webp",
  "corned_beef.webp",
  "cube_steak.webp",
  "eye_round_roast.webp",
  "london_broil.webp",
  "meatballs.webp",
  "minced_beef.webp",
  "rump_roast.webp",
];
const generatedHashes = new Set();
for (const imageName of generatedBeefFiles) {
  assert.equal(imageNames.includes(imageName), true, `Missing generated image: ${imageName}`);
  const contents = await fs.readFile(path.join(imageDir, imageName));
  generatedHashes.add(createHash("sha256").update(contents).digest("hex"));
  const record = provenance.find((item) => item.file === imageName);
  assert.equal(record?.status, "approved", `Unapproved generated image: ${imageName}`);
  assert.equal(record?.sourceType, "project-original-generated");
}
assert.equal(
  generatedHashes.size,
  generatedBeefFiles.length,
  "Generated beef images must be visually distinct files.",
);

console.log(JSON.stringify({
  passed: true,
  physicalImages: imageNames.length,
  aliases: Object.keys(aliases).length,
  uniqueHashes: hashes.size,
  approvedGeneratedBeefImages: generatedBeefFiles.length,
}, null, 2));
