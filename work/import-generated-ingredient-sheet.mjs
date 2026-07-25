import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const projectRoot = path.resolve(".");
const imageDir = path.join(
  projectRoot,
  "outputs",
  "meal-planner",
  "images",
  "ingredients",
);
const aliasesFile = path.join(imageDir, "IMAGE_ALIASES.json");
const browserAliasesFile = path.join(
  projectRoot,
  "outputs",
  "meal-planner",
  "ingredient-image-aliases.js",
);
const provenanceFile = path.join(imageDir, "IMAGE_PROVENANCE.json");
const manifestPath = path.resolve(process.argv[2] || "");

async function writeFileWithRetry(file, contents) {
  const retryableCodes = new Set(["EACCES", "EBUSY", "EPERM", "UNKNOWN"]);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await fs.writeFile(file, contents, "utf8");
      return;
    } catch (error) {
      if (!retryableCodes.has(error.code) || attempt === 7) throw error;
      await new Promise((resolve) => {
        setTimeout(resolve, 100 * (attempt + 1));
      });
    }
  }
}

if (!process.argv[2]) {
  throw new Error(
    "Usage: node work/import-generated-ingredient-sheet.mjs <manifest.json>",
  );
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const columns = Number(manifest.columns);
const rows = Number(manifest.rows);
const outputSize = Number(manifest.outputSize || 420);
const inset = Number(manifest.inset ?? 2);
const rawItems = Array.isArray(manifest.items) ? manifest.items : [];
const items = rawItems.map((item) => (
  typeof item === "string" ? { key: item } : item
));

if (!Number.isInteger(columns) || columns < 1) {
  throw new Error("Manifest columns must be a positive integer.");
}
if (!Number.isInteger(rows) || rows < 1) {
  throw new Error("Manifest rows must be a positive integer.");
}
if (!Number.isInteger(outputSize) || outputSize < 128) {
  throw new Error("Manifest outputSize must be an integer of at least 128.");
}
if (items.length < 1 || items.length > columns * rows) {
  throw new Error("Manifest items must fit within the declared grid.");
}

const keys = new Set();
for (const item of items) {
  if (!item || !/^[a-z0-9_]+$/.test(item.key || "")) {
    throw new Error(`Invalid ingredient image key: ${item?.key || ""}`);
  }
  if (keys.has(item.key)) {
    throw new Error(`Duplicate ingredient image key: ${item.key}`);
  }
  keys.add(item.key);
}

const sourceRelative = String(manifest.source || "").replaceAll("\\", "/");
const source = path.resolve(projectRoot, sourceRelative);
const sourceFromRoot = path.relative(projectRoot, source);
if (
  !sourceRelative
  || sourceFromRoot.startsWith("..")
  || path.isAbsolute(sourceFromRoot)
) {
  throw new Error("Manifest source must stay inside the project.");
}

const metadata = await sharp(source).metadata();
if (!metadata.width || !metadata.height) {
  throw new Error(`Could not read generated source sheet: ${source}`);
}

await fs.mkdir(imageDir, { recursive: true });
for (let index = 0; index < items.length; index += 1) {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const leftEdge = Math.round((column * metadata.width) / columns);
  const rightEdge = Math.round(((column + 1) * metadata.width) / columns);
  const topEdge = Math.round((row * metadata.height) / rows);
  const bottomEdge = Math.round(((row + 1) * metadata.height) / rows);

  await sharp(source)
    .extract({
      left: leftEdge + inset,
      top: topEdge + inset,
      width: rightEdge - leftEdge - (inset * 2),
      height: bottomEdge - topEdge - (inset * 2),
    })
    .resize(outputSize, outputSize, { fit: "cover", position: "centre" })
    .webp({ quality: 84, effort: 6, smartSubsample: true })
    .toFile(path.join(imageDir, `${items[index].key}.webp`));
}

const aliases = JSON.parse(await fs.readFile(aliasesFile, "utf8"));
const aliasesRemoved = items.filter((item) => (
  Object.prototype.hasOwnProperty.call(aliases, item.key)
)).length;
for (const item of items) delete aliases[item.key];
const sortedAliases = Object.fromEntries(
  Object.entries(aliases).sort(([left], [right]) => left.localeCompare(right)),
);
const physicalKeys = new Set(
  (await fs.readdir(imageDir))
    .filter((name) => name.endsWith(".webp"))
    .map((name) => name.replace(/\.webp$/, "")),
);
for (const [alias, target] of Object.entries(sortedAliases)) {
  if (physicalKeys.has(alias)) {
    throw new Error(`Alias source has a physical image: ${alias}.webp`);
  }
  if (!physicalKeys.has(target)) {
    throw new Error(`Alias target does not exist: ${alias} -> ${target}`);
  }
  if (sortedAliases[target]) {
    throw new Error(`Alias chains are not allowed: ${alias} -> ${target}`);
  }
}

await writeFileWithRetry(
  aliasesFile,
  `${JSON.stringify(sortedAliases, null, 2)}\n`,
);
await writeFileWithRetry(
  browserAliasesFile,
  `(function (global) {\n`
    + `  global.BOB_MARY_INGREDIENT_IMAGE_ALIASES = Object.freeze(`
    + `${JSON.stringify(sortedAliases, null, 2)});\n`
    + `})(window);\n`,
);

const repositoryUrl = manifest.repositoryUrl
  || "https://github.com/usa50xxx/bob-and-marys-retirement-meal-planner";
const sourceUrl = manifest.sourceUrl
  || `${repositoryUrl}/blob/main/${sourceRelative}`;
const licenseUrl = manifest.licenseUrl
  || `${repositoryUrl}/blob/main/IMAGE_LICENSE.md`;
const existingProvenance = JSON.parse(
  await fs.readFile(provenanceFile, "utf8"),
);
const importedFiles = new Set(items.map((item) => `${item.key}.webp`));
const provenance = existingProvenance.filter(
  (record) => !importedFiles.has(record.file),
);

for (let index = 0; index < items.length; index += 1) {
  const item = items[index];
  provenance.push({
    status: "approved",
    file: `${item.key}.webp`,
    sourceUrl,
    author: manifest.author
      || "Bob and Mary's Retirement Meal Planner project with OpenAI image generation",
    license: manifest.license || "Project ingredient image license",
    licenseUrl,
    sourceType: "project-original-generated",
    sourceCell: `row ${Math.floor(index / columns) + 1}, column ${(index % columns) + 1}`,
    subject: item.label || item.key.replaceAll("_", " "),
    changes: `Cropped from source sheet, resized to ${outputSize} by ${outputSize} pixels, and encoded as WebP.`,
  });
}
provenance.sort((left, right) => left.file.localeCompare(right.file));
await writeFileWithRetry(
  provenanceFile,
  `${JSON.stringify(provenance, null, 2)}\n`,
);

console.log(JSON.stringify({
  manifest: path.relative(projectRoot, manifestPath),
  source: sourceRelative,
  sourceSize: `${metadata.width}x${metadata.height}`,
  outputSize: `${outputSize}x${outputSize}`,
  files: items.map((item) => `${item.key}.webp`),
  aliasesRemoved,
}, null, 2));
