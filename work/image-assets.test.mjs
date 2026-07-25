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
const manifestDir = path.resolve("assets/generated/manifests");
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

const approvedGenerated = provenance.filter(
  (record) => record.status === "approved"
    && record.sourceType === "project-original-generated",
);
for (const record of approvedGenerated) {
  assert.equal(imageNames.includes(record.file), true, `Missing approved image: ${record.file}`);
  assert.ok(record.sourceUrl, `Missing source URL: ${record.file}`);
  assert.ok(record.author, `Missing author: ${record.file}`);
  assert.ok(record.license, `Missing license: ${record.file}`);
  assert.ok(record.licenseUrl, `Missing license URL: ${record.file}`);
  assert.ok(record.sourceCell, `Missing source cell: ${record.file}`);
}

const manifestNames = (await fs.readdir(manifestDir))
  .filter((name) => name.endsWith(".json"))
  .sort();
const manifestedKeys = new Set();
for (const manifestName of manifestNames) {
  const manifest = JSON.parse(
    await fs.readFile(path.join(manifestDir, manifestName), "utf8"),
  );
  await fs.access(path.resolve(manifest.source));
  assert.equal(
    manifest.items.length <= manifest.columns * manifest.rows,
    true,
    `Manifest grid is too small: ${manifestName}`,
  );
  for (const item of manifest.items) {
    assert.equal(
      manifestedKeys.has(item.key),
      false,
      `Ingredient appears in two generated manifests: ${item.key}`,
    );
    manifestedKeys.add(item.key);
    const record = approvedGenerated.find(
      (candidate) => candidate.file === `${item.key}.webp`,
    );
    assert.ok(record, `Manifest item is not approved: ${item.key}`);
  }
}
assert.equal(
  approvedGenerated.length,
  generatedBeefFiles.length + manifestedKeys.size,
  "Every approved generated image must have a retained source sheet.",
);

console.log(JSON.stringify({
  passed: true,
  physicalImages: imageNames.length,
  aliases: Object.keys(aliases).length,
  uniqueHashes: hashes.size,
  approvedGeneratedBeefImages: generatedBeefFiles.length,
  approvedGeneratedImages: approvedGenerated.length,
  generatedManifests: manifestNames.length,
}, null, 2));
