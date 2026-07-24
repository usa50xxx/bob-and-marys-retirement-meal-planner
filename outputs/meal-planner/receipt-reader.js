(function initializeReceiptReader(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MealPlannerReceipts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createReceiptReader(root) {
  "use strict";

  let ocrWorkerPromise = null;
  let pdfModulePromise = null;

  function extractStoreName(text) {
    if (/publix/i.test(text)) return "Publix";
    if (/\baldi(?:'s)?\b/i.test(text)) return "Aldi";
    if (/walmart/i.test(text)) return "Walmart";
    return "";
  }

  function extractItemNumber(line) {
    const labeled = line.match(/\b(?:sku|upc|item\s*#?|item\s*number|product\s*code|barcode)\s*:?\s*([a-z0-9-]{4,})/i);
    if (labeled) return labeled[1];
    const longNumber = line.match(/\b(\d{8,14})\b/);
    return longNumber ? longNumber[1] : "";
  }

  function parseReceiptText(text) {
    const source = String(text || "");
    const detectedStore = extractStoreName(source);
    const ignored = /\b(?:sub)?total\b|grand total|balance due|delivery|pickup|sales tax|payment|order number|receipt total|change due|cash tendered|credit card/i;
    const lines = source
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const items = [];
    let pendingName = "";

    lines.forEach((line) => {
      if (ignored.test(line)) return;
      const priceMatches = [...line.matchAll(/\$?\b(\d{1,5}\.\d{2})\b/g)];
      const explicitPrice = /\$/.test(line);
      const likelyPriceLine = priceMatches.length && (explicitPrice || pendingName || line.length > 8);

      if (!likelyPriceLine) {
        if (/[a-z]{3}/i.test(line) && line.length <= 100) pendingName = line;
        return;
      }

      const price = Number(priceMatches[priceMatches.length - 1][1]);
      const qtyMatch = line.match(/\b(?:qty|quantity)\s*:?\s*(\d+(?:\.\d+)?)/i)
        || line.match(/^(\d+(?:\.\d+)?)\s*[xX]\s+/);
      const amount = qtyMatch ? Number(qtyMatch[1]) : 1;
      const itemNumber = extractItemNumber(line);
      const store = extractStoreName(line) || detectedStore;
      const cleanedLine = line
        .replace(/\$?\b\d{1,5}\.\d{2}\b/g, "")
        .replace(/\b(?:qty|quantity)\s*:?\s*\d+(?:\.\d+)?/gi, "")
        .replace(/\b(?:sku|upc|item\s*#?|item\s*number|product\s*code|barcode)\s*:?\s*[a-z0-9-]+/gi, "")
        .replace(/^\d+(?:\.\d+)?\s*[xX]\s+/, "")
        .replace(/\b(?:walmart|publix|aldi|aldi's)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      const name = [pendingName, cleanedLine].filter(Boolean).join(" ").trim();
      pendingName = "";
      if (!name || name.length < 2 || !Number.isFinite(price)) return;

      items.push({
        amount,
        unit: "item",
        name,
        price,
        itemNumber,
        store,
        storage: ""
      });
    });

    return mergeDuplicateRows(items);
  }

  function mergeDuplicateRows(items) {
    const merged = new Map();
    items.forEach((item) => {
      const key = [
        String(item.name || "").toLowerCase().replace(/[^a-z0-9]/g, ""),
        item.itemNumber || "",
        item.store || ""
      ].join("|");
      if (!merged.has(key)) {
        merged.set(key, { ...item });
        return;
      }
      const existing = merged.get(key);
      existing.amount += Number(item.amount) || 1;
      existing.price += Number(item.price) || 0;
    });
    return [...merged.values()];
  }

  async function readFile(file, onProgress = () => {}) {
    if (!file) throw new Error("Choose a receipt file first.");
    const type = String(file.type || "").toLowerCase();
    const name = String(file.name || "").toLowerCase();

    if (type.startsWith("text/") || /\.(txt|csv|tsv)$/.test(name)) {
      onProgress("Reading receipt text...");
      return file.text();
    }
    if (type === "application/pdf" || name.endsWith(".pdf")) {
      return readPdf(file, onProgress);
    }
    if (type.startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif|heic)$/.test(name)) {
      return recognizeImage(file, onProgress);
    }
    throw new Error("Use a PDF, receipt photo, text, CSV, or TSV file.");
  }

  async function readPdf(file, onProgress) {
    onProgress("Reading PDF receipt...");
    const pdfjs = await loadPdfModule();
    pdfjs.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.mjs";
    const documentTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await documentTask.promise;
    const textParts = [];
    const imagePages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress(`Reading PDF page ${pageNumber} of ${pdf.numPages}...`);
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => `${item.str || ""}${item.hasEOL ? "\n" : " "}`)
        .join("")
        .trim();
      if (pageText.length >= 20) {
        textParts.push(pageText);
      } else {
        imagePages.push(page);
      }
    }

    for (let index = 0; index < imagePages.length; index += 1) {
      onProgress(`Reading photographed PDF page ${index + 1} of ${imagePages.length}...`);
      const page = imagePages[index];
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      textParts.push(await recognizeImage(canvas, onProgress));
    }

    return textParts.join("\n");
  }

  async function recognizeImage(image, onProgress) {
    const worker = await getOcrWorker(onProgress);
    onProgress("Reading words from receipt photo...");
    const result = await worker.recognize(image);
    return result?.data?.text || "";
  }

  async function getOcrWorker(onProgress) {
    if (!root?.Tesseract?.createWorker) {
      throw new Error("Receipt photo reader is not available.");
    }
    if (!ocrWorkerPromise) {
      ocrWorkerPromise = root.Tesseract.createWorker("eng", 1, {
        workerPath: "vendor/tesseract/worker.min.js",
        corePath: "vendor/tesseract/core",
        langPath: "vendor/tesseract/lang",
        gzip: false,
        logger: (message) => {
          if (message?.status) {
            const percent = Number.isFinite(message.progress) ? ` ${Math.round(message.progress * 100)}%` : "";
            onProgress(`${message.status}${percent}`);
          }
        }
      });
    }
    return ocrWorkerPromise;
  }

  async function loadPdfModule() {
    if (!pdfModulePromise) pdfModulePromise = import("./vendor/pdfjs/pdf.min.mjs");
    return pdfModulePromise;
  }

  return {
    extractItemNumber,
    extractStoreName,
    mergeDuplicateRows,
    parseReceiptText,
    readFile
  };
});
