import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const source = path.resolve(
  process.argv[2] || "assets/generated/beef-replacements-v1.png",
);
const destination = path.resolve(
  "outputs/meal-planner/images/ingredients",
);
const names = [
  "beef_tenderloin",
  "corned_beef",
  "cube_steak",
  "eye_round_roast",
  "london_broil",
  "meatballs",
  "minced_beef",
  "rump_roast",
];

const metadata = await sharp(source).metadata();
if (!metadata.width || !metadata.height) {
  throw new Error(`Could not read generated source sheet: ${source}`);
}

await fs.mkdir(destination, { recursive: true });
for (let index = 0; index < names.length; index += 1) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  const leftEdge = Math.round((column * metadata.width) / 4);
  const rightEdge = Math.round(((column + 1) * metadata.width) / 4);
  const topEdge = Math.round((row * metadata.height) / 2);
  const bottomEdge = Math.round(((row + 1) * metadata.height) / 2);
  const inset = 2;

  await sharp(source)
    .extract({
      left: leftEdge + inset,
      top: topEdge + inset,
      width: rightEdge - leftEdge - (inset * 2),
      height: bottomEdge - topEdge - (inset * 2),
    })
    .resize(420, 420, { fit: "cover", position: "centre" })
    .webp({ quality: 84, effort: 6, smartSubsample: true })
    .toFile(path.join(destination, `${names[index]}.webp`));
}

console.log(JSON.stringify({
  source,
  sourceSize: `${metadata.width}x${metadata.height}`,
  outputSize: "420x420",
  files: names.map((name) => `${name}.webp`),
}, null, 2));
