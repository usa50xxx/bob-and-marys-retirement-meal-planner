import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";

const output = path.resolve("work/recipe-fixtures");
await fs.mkdir(output, { recursive: true });

const lines = [
  "EASY SALMON DINNER",
  "Serves 2",
  "Prep time: 10 minutes",
  "Cook time: 18 minutes",
  "Temperature: 400 F",
  "",
  "Ingredients",
  "2 salmon fillets",
  "1 tbsp olive oil",
  "1 lemon",
  "1 tsp garlic powder",
  "",
  "Instructions",
  "Heat the oven to 400 F.",
  "Brush salmon with oil and season.",
  "Bake for 18 minutes."
];

const pdf = await PDFDocument.create();
const page = pdf.addPage([612, 792]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
let y = 740;
for (const line of lines) {
  page.drawText(line || " ", {
    x: 54,
    y,
    size: line === lines[0] ? 19 : 13,
    font: line === lines[0] || /^(Ingredients|Instructions)$/.test(line) ? bold : font,
    color: rgb(0.05, 0.05, 0.05)
  });
  y -= line === lines[0] ? 32 : 25;
}
await fs.writeFile(path.join(output, "sample-recipe.pdf"), await pdf.save());

const escaped = lines.map((line) => line
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;"));
const svgLines = escaped.map((line, index) => {
  const weight = index === 0 || /^(Ingredients|Instructions)$/.test(line) ? 700 : 500;
  const size = index === 0 ? 40 : 28;
  return `<text x="65" y="${75 + index * 46}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="#101010">${line || " "}</text>`;
}).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
  <rect width="1200" height="900" fill="#ffffff"/>
  ${svgLines}
</svg>`;
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(output, "sample-recipe.png"));

console.log(`Recipe fixtures written to ${output}`);
