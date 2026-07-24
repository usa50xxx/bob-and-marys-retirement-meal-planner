import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const imageDir = path.join(projectRoot, "outputs", "meal-planner", "images", "ingredients");
const legacySourceFile = path.join(imageDir, "IMAGE_SOURCES.json");
const beefSourceFile = path.join(imageDir, "beef-cut-image-attribution.txt");
const provenanceFile = path.join(imageDir, "IMAGE_PROVENANCE.json");
const aliasesFile = path.join(imageDir, "IMAGE_ALIASES.json");
const strict = process.argv.includes("--strict");

async function readJson(file, fallback) {
  try {
    return JSON.parse((await fs.readFile(file, "utf8")).replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function normalizedImageName(value) {
  const name = path.basename(String(value || "")).toLowerCase();
  return name.endsWith(".webp") ? name : `${name.replace(/\.[^.]+$/, "")}.webp`;
}

function isCompleteApproval(record) {
  return (
    record &&
    record.status === "approved" &&
    typeof record.file === "string" &&
    /^https:\/\//i.test(record.sourceUrl || "") &&
    String(record.author || "").trim() &&
    String(record.license || "").trim() &&
    /^https:\/\//i.test(record.licenseUrl || "")
  );
}

const imageNames = (await fs.readdir(imageDir))
  .filter((name) => name.toLowerCase().endsWith(".webp"))
  .sort((left, right) => left.localeCompare(right));

const hashes = new Map();
for (const imageName of imageNames) {
  const contents = await fs.readFile(path.join(imageDir, imageName));
  const hash = createHash("sha256").update(contents).digest("hex");
  if (!hashes.has(hash)) hashes.set(hash, []);
  hashes.get(hash).push(imageName);
}

const legacySources = await readJson(legacySourceFile, []);
const referenced = new Set(
  legacySources
    .map((record) => normalizedImageName(record.ingredient))
    .filter((name) => imageNames.includes(name)),
);

try {
  const beefSources = await fs.readFile(beefSourceFile, "utf8");
  for (const match of beefSources.matchAll(/^([a-z0-9_]+)\.png\s+-/gim)) {
    const imageName = `${match[1].toLowerCase()}.webp`;
    if (imageNames.includes(imageName)) referenced.add(imageName);
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const provenance = await readJson(provenanceFile, []);
const aliases = await readJson(aliasesFile, {});
const approved = new Set(
  provenance
    .filter(isCompleteApproval)
    .map((record) => normalizedImageName(record.file))
    .filter((name) => imageNames.includes(name)),
);
const staleApprovals = provenance
  .filter(isCompleteApproval)
  .map((record) => normalizedImageName(record.file))
  .filter((name) => !imageNames.includes(name));

const summary = {
  totalImages: imageNames.length,
  uniqueImages: hashes.size,
  duplicateFiles: imageNames.length - hashes.size,
  imageAliases: Object.keys(aliases).length,
  referencedByExistingNotes: referenced.size,
  missingAnySourceRecord: imageNames.length - referenced.size,
  approvedForRelease: approved.size,
  unresolvedForRelease: imageNames.length - approved.size,
  staleApprovedRecords: staleApprovals.length,
};

console.log("Ingredient image provenance audit");
console.log(`  Files: ${summary.totalImages}`);
console.log(`  Byte-for-byte unique: ${summary.uniqueImages}`);
console.log(`  Duplicate files: ${summary.duplicateFiles}`);
console.log(`  Ingredient aliases: ${summary.imageAliases}`);
console.log(`  Existing source references: ${summary.referencedByExistingNotes}`);
console.log(`  Missing any source record: ${summary.missingAnySourceRecord}`);
console.log(`  Fully approved for release: ${summary.approvedForRelease}`);
console.log(`  Unresolved for release: ${summary.unresolvedForRelease}`);
if (summary.staleApprovedRecords) {
  console.log(`  Stale approved records: ${summary.staleApprovedRecords}`);
}

if (strict && (summary.unresolvedForRelease || summary.staleApprovedRecords)) {
  console.error(
    "Release blocked: every ingredient image needs an approved source, author, license, and license URL.",
  );
  process.exit(1);
}
