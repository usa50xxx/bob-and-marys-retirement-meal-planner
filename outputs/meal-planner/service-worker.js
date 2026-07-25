const CACHE_PREFIX = "supperloom-";
const CACHE_NAME = `${CACHE_PREFIX}v4`;
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./iphone.html",
  "./android.html",
  "./manifest.webmanifest",
  "./icons/app-icon-192.png",
  "./icons/app-icon-512.png",
  "./icons/apple-touch-icon.png",
  "./compatibility.js",
  "./styles.css",
  "./food-engine.js",
  "./receipt-reader.js",
  "./recipe-reader.js",
  "./recovery.js",
  "./ingredient-image-aliases.js",
  "./starter-recipes.js",
  "./app.js",
  "./pwa.js",
  "./vendor/pdfjs/LICENSE.txt",
  "./vendor/pdfjs/pdf.min.mjs",
  "./vendor/pdfjs/pdf.worker.min.mjs",
  "./vendor/tesseract/LICENSE-tesseract-js.txt",
  "./vendor/tesseract/tesseract.min.js",
  "./vendor/tesseract/VERSION.txt",
  "./vendor/tesseract/worker.min.js",
  "./vendor/tesseract/core/LICENSE.txt",
  "./vendor/tesseract/core/tesseract-core-lstm.js",
  "./vendor/tesseract/core/tesseract-core-lstm.wasm",
  "./vendor/tesseract/core/tesseract-core-lstm.wasm.js",
  "./vendor/tesseract/core/tesseract-core-simd-lstm.js",
  "./vendor/tesseract/core/tesseract-core-simd-lstm.wasm",
  "./vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js",
  "./vendor/tesseract/core/tesseract-core-simd.js",
  "./vendor/tesseract/core/tesseract-core-simd.wasm",
  "./vendor/tesseract/core/tesseract-core-simd.wasm.js",
  "./vendor/tesseract/core/tesseract-core.js",
  "./vendor/tesseract/core/tesseract-core.wasm",
  "./vendor/tesseract/core/tesseract-core.wasm.js",
  "./vendor/tesseract/lang/eng.traineddata",
  "./images/ingredients/bacon.webp",
  "./images/ingredients/baked_beans.webp",
  "./images/ingredients/beef_roast.webp",
  "./images/ingredients/bell_pepper.webp",
  "./images/ingredients/bread.webp",
  "./images/ingredients/broccoli.webp",
  "./images/ingredients/cabbage.webp",
  "./images/ingredients/chicken_breast.webp",
  "./images/ingredients/chicken_cutlets.webp",
  "./images/ingredients/chicken_thighs.webp",
  "./images/ingredients/chili_beans.webp",
  "./images/ingredients/cod.webp",
  "./images/ingredients/cornmeal.webp",
  "./images/ingredients/crab_cakes.webp",
  "./images/ingredients/eggs.webp",
  "./images/ingredients/fish_fillets.webp",
  "./images/ingredients/flour.webp",
  "./images/ingredients/green_beans.webp",
  "./images/ingredients/ground_beef.webp",
  "./images/ingredients/ham.webp",
  "./images/ingredients/lasagna.webp",
  "./images/ingredients/lettuce.webp",
  "./images/ingredients/macaroni.webp",
  "./images/ingredients/oats.webp",
  "./images/ingredients/pork_butt.webp",
  "./images/ingredients/pork_chops.webp",
  "./images/ingredients/pork_ribs.webp",
  "./images/ingredients/pork_sausage.webp",
  "./images/ingredients/pork_tenderloin.webp",
  "./images/ingredients/potato.webp",
  "./images/ingredients/ribeye.webp",
  "./images/ingredients/rice.webp",
  "./images/ingredients/salmon_fillets.webp",
  "./images/ingredients/scallops.webp",
  "./images/ingredients/shrimp.webp",
  "./images/ingredients/sirloin.webp",
  "./images/ingredients/spaghetti.webp",
  "./images/ingredients/stew_meat.webp",
  "./images/ingredients/tomato.webp",
  "./images/ingredients/tortillas.webp",
  "./images/ingredients/tuna.webp",
  "./images/ingredients/vegetable_broth.webp",
  "./images/ingredients/whole_chicken.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
