import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  configureMealDbApiKey,
  isAllowedTrackedAsset,
  isPrivateReleasePath,
  stageReleaseAssets,
} from "./release-assets.mjs";

const projectRoot = process.cwd();
const destination = path.join(projectRoot, "work", "release-assets-test");

for (const privatePath of [
  "planner-data.json",
  "planner-data-123.tmp",
  "planner-data-restore-123.tmp",
  "backups/meal-planner-backup.json",
  "server.log",
  "images/ingredients/download.tmp",
]) {
  assert.equal(isPrivateReleasePath(privatePath), true, privatePath);
  assert.equal(isAllowedTrackedAsset(privatePath), false, privatePath);
}

for (const publicPath of [
  "index.html",
  "app.js",
  "images/ingredients/apple.webp",
  "vendor/pdfjs/pdf.min.mjs",
]) {
  assert.equal(isPrivateReleasePath(publicPath), false, publicPath);
  assert.equal(isAllowedTrackedAsset(publicPath), true, publicPath);
}

assert.equal(isAllowedTrackedAsset("unexpected-root-file.json"), false);
assert.equal(
  configureMealDbApiKey(
    "fetch('https://www.themealdb.com/api/json/v1/1/search.php')",
    "subscriber123",
  ),
  "fetch('https://www.themealdb.com/api/json/v1/subscriber123/search.php')",
);
assert.throws(
  () => configureMealDbApiKey("https://www.themealdb.com/api/json/v1/1/search.php", "1"),
  /paid publish key/,
);
assert.throws(
  () => configureMealDbApiKey("https://www.themealdb.com/api/json/v1/1/search.php", "bad/key"),
  /paid publish key/,
);

try {
  const first = await stageReleaseAssets({ projectRoot, destination });
  const firstManifest = await fs.readFile(
    path.join(destination, "RELEASE-MANIFEST.json"),
    "utf8",
  );

  const sourceImageNames = (await fs.readdir(
    path.join(projectRoot, "outputs", "meal-planner", "images", "ingredients"),
  )).filter((name) => name.endsWith(".webp"));
  const stagedImageNames = (await fs.readdir(
    path.join(destination, "images", "ingredients"),
  )).filter((name) => name.endsWith(".webp"));
  assert.ok(first.fileCount > sourceImageNames.length);
  assert.equal(stagedImageNames.length, sourceImageNames.length);
  await fs.access(path.join(destination, "index.html"));
  await fs.access(path.join(destination, "compatibility.js"));
  await fs.access(path.join(destination, "ingredient-image-aliases.js"));
  await fs.access(path.join(destination, "PRIVACY.md"));
  await fs.access(path.join(destination, "THIRD_PARTY_NOTICES.md"));
  await fs.access(path.join(destination, "IMAGE_LICENSE.md"));
  await assert.rejects(fs.access(path.join(destination, "planner-data.json")));
  await assert.rejects(fs.access(path.join(destination, "backups")));

  const second = await stageReleaseAssets({ projectRoot, destination });
  const secondManifest = await fs.readFile(
    path.join(destination, "RELEASE-MANIFEST.json"),
    "utf8",
  );
  assert.equal(second.fileCount, first.fileCount);
  assert.equal(secondManifest, firstManifest);

  const parsed = JSON.parse(secondManifest);
  assert.equal(parsed.formatVersion, 1);
  assert.equal(parsed.files.some((file) => isPrivateReleasePath(file.path)), false);
  assert.equal(
    parsed.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)),
    true,
  );
  for (const script of [
    "food-engine.js",
    "receipt-reader.js",
    "recipe-reader.js",
    "recovery.js",
    "app.js",
  ]) {
    const stagedScript = await fs.readFile(path.join(destination, script), "utf8");
    assert.equal(stagedScript.includes("?."), false, `${script} has optional chaining`);
    assert.equal(stagedScript.includes("??"), false, `${script} has nullish coalescing`);
  }
} finally {
  await fs.rm(destination, { recursive: true, force: true });
}

console.log("Release asset staging tests passed.");
