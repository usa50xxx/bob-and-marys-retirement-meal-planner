(function initializeRecovery(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MealPlannerRecovery = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createRecovery() {
  "use strict";

  function parsePlanner(value) {
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      if (!parsed || typeof parsed !== "object") return null;
      if (!Array.isArray(parsed.recipes) || !parsed.recipes.length) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function savedTime(value) {
    const parsed = parsePlanner(value);
    const timestamp = Date.parse(parsed?.savedAt || "");
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function chooseLocalRecovery({ current, pending, previous }) {
    const validCurrent = parsePlanner(current);
    const validPending = parsePlanner(pending);
    const validPrevious = parsePlanner(previous);

    if (validPending && (!validCurrent || savedTime(validPending) > savedTime(validCurrent))) {
      return {
        data: validPending,
        source: "pending",
        recovered: true,
        message: "Recovered a save that was interrupted before it finished."
      };
    }
    if (validCurrent) {
      return { data: validCurrent, source: "current", recovered: false, message: "" };
    }
    if (validPrevious) {
      return {
        data: validPrevious,
        source: "previous",
        recovered: true,
        message: "The newest save could not be read, so the previous good save was restored."
      };
    }
    if (validPending) {
      return {
        data: validPending,
        source: "pending",
        recovered: true,
        message: "Recovered a save that was interrupted before it finished."
      };
    }
    return {
      data: null,
      source: "none",
      recovered: Boolean(current || pending || previous),
      message: current || pending || previous
        ? "Saved meal-planner data could not be read. Starter recipes were opened instead."
        : ""
    };
  }

  function normalizeSnapshots(value) {
    let source = value;
    if (typeof value === "string") {
      try {
        source = JSON.parse(value);
      } catch {
        source = [];
      }
    }
    if (!Array.isArray(source)) return [];
    return source
      .map((snapshot) => ({
        id: String(snapshot?.id || ""),
        createdAt: String(snapshot?.createdAt || ""),
        label: String(snapshot?.label || "Manual backup"),
        data: typeof snapshot?.data === "string" ? snapshot.data : ""
      }))
      .filter((snapshot) => snapshot.id && parsePlanner(snapshot.data))
      .sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""));
  }

  function addSnapshot(value, data, options = {}) {
    const serialized = typeof data === "string" ? data : JSON.stringify(data);
    if (!parsePlanner(serialized)) return normalizeSnapshots(value);
    const current = normalizeSnapshots(value);
    if (current.some((snapshot) => snapshot.data === serialized)) return current;

    const now = options.now || new Date().toISOString();
    const snapshot = {
      id: options.id || `backup-${Date.parse(now) || Date.now()}`,
      createdAt: now,
      label: options.label || "Manual backup",
      data: serialized
    };
    const maxCount = Number.isFinite(options.maxCount) ? options.maxCount : 4;
    const maxCharacters = Number.isFinite(options.maxCharacters) ? options.maxCharacters : 3000000;
    const kept = [snapshot, ...current];
    while (kept.length > maxCount) kept.pop();
    while (kept.length > 1 && kept.reduce((total, item) => total + item.data.length, 0) > maxCharacters) {
      kept.pop();
    }
    return kept;
  }

  return {
    addSnapshot,
    chooseLocalRecovery,
    normalizeSnapshots,
    parsePlanner,
    savedTime
  };
});
