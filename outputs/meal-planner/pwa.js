(function enableSupperloomOfflineMode() {
  "use strict";

  if (!("serviceWorker" in navigator)) return;
  if (
    window.Capacitor
    && typeof window.Capacitor.isNativePlatform === "function"
    && window.Capacitor.isNativePlatform()
  ) {
    return;
  }

  window.addEventListener("load", function registerOfflineWorker() {
    navigator.serviceWorker.register("./service-worker.js").catch(function ignoreRegistrationFailure() {
      // Thumb-drive LAN pages can still work when a browser blocks service workers over HTTP.
    });
  });
})();
