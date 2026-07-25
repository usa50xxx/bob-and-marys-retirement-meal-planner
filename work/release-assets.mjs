import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { transform } from "esbuild";

const APP_SOURCE = "outputs/meal-planner";
const STATIC_DIRECTORIES = new Set(["images", "vendor"]);
const PUBLIC_ROOT_FILES = new Set([
  "README.txt",
  "Start Supperloom for Phones.bat",
  "Start Supperloom.bat",
  "Start Meal Planner From Drive.bat",
  "Start Meal Planner for Phones.bat",
  "Start Meal Planner.bat",
  "android.html",
  "app.js",
  "autorun.inf",
  "compatibility.js",
  "favicon.ico",
  "food-engine.js",
  "index.html",
  "ingredient-image-aliases.js",
  "iphone.html",
  "meal-planner-server.ps1",
  "receipt-reader.js",
  "recipe-reader.js",
  "recovery.js",
  "starter-recipes.js",
  "styles.css",
]);
const LEGAL_FILES = ["PRIVACY.md", "THIRD_PARTY_NOTICES.md", "IMAGE_LICENSE.md"];
const DEVELOPMENT_MEALDB_ENDPOINT = "https://www.themealdb.com/api/json/v1/1/";
const LEGACY_WEBVIEW_SCRIPTS = [
  "food-engine.js",
  "receipt-reader.js",
  "recipe-reader.js",
  "recovery.js",
  "starter-recipes.js",
  "app.js",
];

function normalizeRelativePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertSafeDestination(projectRoot, sourceDir, destination) {
  if (
    destination === projectRoot ||
    !isInside(projectRoot, destination) ||
    isInside(sourceDir, destination) ||
    isInside(destination, sourceDir)
  ) {
    throw new Error(`Refusing to replace unsafe release staging path: ${destination}`);
  }
}

export function isPrivateReleasePath(value) {
  const relative = normalizeRelativePath(value).toLowerCase();
  const segments = relative.split("/").filter(Boolean);
  const baseName = segments.at(-1) || "";
  return (
    segments.includes("backups") ||
    baseName.startsWith("planner-data") ||
    baseName.endsWith(".tmp") ||
    baseName.endsWith(".log")
  );
}

export function isAllowedTrackedAsset(value) {
  const relative = normalizeRelativePath(value);
  if (!relative || isPrivateReleasePath(relative)) return false;
  const parts = relative.split("/");
  return parts.length === 1
    ? PUBLIC_ROOT_FILES.has(parts[0])
    : STATIC_DIRECTORIES.has(parts[0]);
}

export function configureMealDbApiKey(source, apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) return source;
  if (!/^[a-zA-Z0-9_-]+$/.test(key) || key === "1") {
    throw new Error("THEMEALDB_API_KEY must be a paid publish key, not the development key.");
  }
  const occurrences = source.split(DEVELOPMENT_MEALDB_ENDPOINT).length - 1;
  if (!occurrences) {
    throw new Error("TheMealDB development endpoint was not found in the staged app.");
  }
  return source.replaceAll(
    DEVELOPMENT_MEALDB_ENDPOINT,
    `https://www.themealdb.com/api/json/v1/${key}/`,
  );
}

function trackedAppAssets(projectRoot) {
  const result = spawnSync("git", ["ls-files", "-z", "--", APP_SOURCE], {
    cwd: projectRoot,
    encoding: "buffer",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ls-files failed with status ${result.status}.`);
  }

  const prefix = `${APP_SOURCE}/`;
  return result.stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map(normalizeRelativePath)
    .map((file) => {
      if (!file.startsWith(prefix)) {
        throw new Error(`Unexpected tracked path outside ${APP_SOURCE}: ${file}`);
      }
      return file.slice(prefix.length);
    })
    .sort((left, right) => left.localeCompare(right));
}

async function copyRegularFile(source, destination) {
  const details = await fs.lstat(source);
  if (details.isSymbolicLink()) {
    throw new Error(`Release assets cannot contain symbolic links: ${source}`);
  }
  if (!details.isFile()) {
    throw new Error(`Release asset is not a regular file: ${source}`);
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

async function buildManifest(destination) {
  const files = [];

  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = normalizeRelativePath(path.relative(destination, absolute));
      if (relative === "RELEASE-MANIFEST.json") continue;
      if (entry.isSymbolicLink()) {
        throw new Error(`Release staging contains a symbolic link: ${relative}`);
      }
      if (entry.isDirectory()) {
        await visit(absolute);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`Release staging contains an unsupported entry: ${relative}`);
      }
      if (isPrivateReleasePath(relative)) {
        throw new Error(`Private data entered release staging: ${relative}`);
      }
      const contents = await fs.readFile(absolute);
      files.push({
        path: relative,
        bytes: contents.byteLength,
        sha256: createHash("sha256").update(contents).digest("hex"),
      });
    }
  }

  await visit(destination);
  files.sort((left, right) => left.path.localeCompare(right.path));
  return {
    formatVersion: 1,
    source: "git-tracked application assets",
    files,
  };
}

async function makeScriptsCompatibleWithAndroid7(destination) {
  for (const file of LEGACY_WEBVIEW_SCRIPTS) {
    const target = path.join(destination, file);
    const source = await fs.readFile(target, "utf8");
    const result = await transform(source, {
      charset: "utf8",
      legalComments: "inline",
      loader: "js",
      minify: false,
      sourcemap: false,
      target: "chrome69",
    });
    await fs.writeFile(target, result.code, "utf8");
  }
}

export async function stageReleaseAssets({
  projectRoot = process.cwd(),
  destination,
  mealDbApiKey = process.env.THEMEALDB_API_KEY || "",
} = {}) {
  if (!destination) throw new Error("A release staging destination is required.");

  const resolvedRoot = path.resolve(projectRoot);
  const sourceDir = path.join(resolvedRoot, ...APP_SOURCE.split("/"));
  const resolvedDestination = path.resolve(resolvedRoot, destination);
  assertSafeDestination(resolvedRoot, sourceDir, resolvedDestination);

  const trackedFiles = trackedAppAssets(resolvedRoot);
  const rejected = trackedFiles.filter((file) => !isAllowedTrackedAsset(file));
  if (rejected.length) {
    throw new Error(
      `Release staging rejected unexpected or private tracked assets:\n${rejected.join("\n")}`,
    );
  }
  if (!trackedFiles.includes("index.html") || !trackedFiles.includes("app.js")) {
    throw new Error("Tracked meal-planner entry files are missing.");
  }

  await fs.rm(resolvedDestination, { recursive: true, force: true });
  await fs.mkdir(resolvedDestination, { recursive: true });

  for (const relative of trackedFiles) {
    await copyRegularFile(
      path.join(sourceDir, ...relative.split("/")),
      path.join(resolvedDestination, ...relative.split("/")),
    );
  }

  for (const legalFile of LEGAL_FILES) {
    await copyRegularFile(
      path.join(resolvedRoot, legalFile),
      path.join(resolvedDestination, legalFile),
    );
  }

  if (mealDbApiKey) {
    const stagedApp = path.join(resolvedDestination, "app.js");
    const source = await fs.readFile(stagedApp, "utf8");
    await fs.writeFile(
      stagedApp,
      configureMealDbApiKey(source, mealDbApiKey),
      "utf8",
    );
  }

  await makeScriptsCompatibleWithAndroid7(resolvedDestination);

  const manifest = await buildManifest(resolvedDestination);
  await fs.writeFile(
    path.join(resolvedDestination, "RELEASE-MANIFEST.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return {
    destination: resolvedDestination,
    fileCount: manifest.files.length,
    manifest,
  };
}
