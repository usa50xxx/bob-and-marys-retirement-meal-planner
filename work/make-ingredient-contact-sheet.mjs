import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const imageDir = path.resolve("outputs/meal-planner/images/ingredients");
const output = path.resolve("work/ingredient-contact-sheet.jpg");
const files = (await fs.readdir(imageDir))
  .filter((file) => /\.source\.(png|jpe?g|webp)$/i.test(file))
  .sort();
const cellWidth = 240;
const cellHeight = 200;
const columns = 4;
const rows = Math.ceil(files.length / columns);
const composites = [];

for (let index = 0; index < files.length; index += 1) {
  const file = files[index];
  const image = await sharp(path.join(imageDir, file))
    .resize(cellWidth - 16, 150, { fit: "contain", background: "#171d1c" })
    .flatten({ background: "#171d1c" })
    .jpeg()
    .toBuffer();
  const label = file.replace(/\.source\.(png|jpe?g|webp)$/i, "").replaceAll("_", " ");
  const labelSvg = Buffer.from(
    `<svg width="${cellWidth}" height="42"><rect width="100%" height="100%" fill="#171d1c"/>` +
    `<text x="8" y="26" fill="#f1eee5" font-size="17" font-family="Arial">${label}</text></svg>`
  );
  const left = (index % columns) * cellWidth;
  const top = Math.floor(index / columns) * cellHeight;
  composites.push({ input: image, left: left + 8, top: top + 4 });
  composites.push({ input: labelSvg, left, top: top + 154 });
}

await sharp({
  create: {
    width: columns * cellWidth,
    height: rows * cellHeight,
    channels: 3,
    background: "#171d1c"
  }
})
  .composite(composites)
  .jpeg({ quality: 88 })
  .toFile(output);

console.log(output);
