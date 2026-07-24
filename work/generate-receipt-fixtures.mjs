import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const outputDir = path.resolve("work/receipt-fixtures");
await fs.mkdir(outputDir, { recursive: true });
const lines = [
  "WALMART",
  "Whole Milk $3.48 SKU 12345",
  "Large Eggs $2.99 UPC 98765",
  "Spaghetti $1.29 Item #33333",
  "TOTAL $7.76"
];

const pdf = await PDFDocument.create();
const page = pdf.addPage([612, 792]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
lines.forEach((line, index) => {
  page.drawText(line, {
    x: 60,
    y: 720 - index * 48,
    size: index === 0 ? 25 : 20,
    font,
    color: rgb(0, 0, 0)
  });
});
await fs.writeFile(path.join(outputDir, "sample-receipt.pdf"), await pdf.save());

const escapedLines = lines.map((line) =>
  line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
);
const textSvg = Buffer.from(`
  <svg width="1400" height="1000" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="white"/>
    ${escapedLines.map((line, index) =>
      `<text x="80" y="${130 + index * 145}" fill="black" font-family="Arial" font-size="${index === 0 ? 72 : 58}" font-weight="${index === 0 ? "700" : "400"}">${line}</text>`
    ).join("")}
  </svg>
`);
await sharp(textSvg).png().toFile(path.join(outputDir, "sample-receipt.png"));

console.log(outputDir);
