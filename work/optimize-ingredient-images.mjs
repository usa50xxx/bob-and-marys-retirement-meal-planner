import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const imageDir = path.resolve("outputs/meal-planner/images/ingredients");
const entries = await fs.readdir(imageDir, { withFileTypes: true });
const sourceFiles = entries
  .filter((entry) => entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name))
  .map((entry) => entry.name);

const selectedSources = new Map();
for (const file of sourceFiles) {
  const isReplacement = /\.source\.(png|jpe?g|webp)$/i.test(file);
  const base = isReplacement
    ? file.replace(/\.source\.(png|jpe?g|webp)$/i, "")
    : file.replace(/\.(png|jpe?g|webp)$/i, "");
  const current = selectedSources.get(base);
  if (!current || isReplacement) {
    selectedSources.set(base, file);
  }
}

let beforeBytes = 0;
let afterBytes = 0;
for (const [base, file] of selectedSources) {
  const input = path.join(imageDir, file);
  const output = path.join(imageDir, `${base}.webp`);
  const stats = await fs.stat(input);
  beforeBytes += stats.size;
  await sharp(input)
    .rotate()
    .resize({ width: 560, height: 420, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, effort: 5, smartSubsample: true })
    .toFile(`${output}.tmp`);
  await fs.rename(`${output}.tmp`, output);
  afterBytes += (await fs.stat(output)).size;
}

const webpFiles = new Set(
  (await fs.readdir(imageDir)).filter((file) => file.toLowerCase().endsWith(".webp"))
);
const missing = [...selectedSources.keys()].filter((base) => !webpFiles.has(`${base}.webp`));
if (missing.length) {
  throw new Error(`Missing optimized pictures: ${missing.join(", ")}`);
}

const removable = (await fs.readdir(imageDir)).filter((file) =>
  /\.(png|jpe?g)$/i.test(file) || /\.source\.webp$/i.test(file)
);
for (const file of removable) {
  await fs.unlink(path.join(imageDir, file));
}

console.log(JSON.stringify({
  converted: selectedSources.size,
  beforeMB: Number((beforeBytes / 1024 / 1024).toFixed(2)),
  afterMB: Number((afterBytes / 1024 / 1024).toFixed(2)),
  reductionPercent: Number(((1 - afterBytes / beforeBytes) * 100).toFixed(1)),
  missing: missing.length
}, null, 2));
