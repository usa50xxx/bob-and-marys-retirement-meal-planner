import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { buildPrivacySite } from "./build-privacy-site.mjs";

const destination = path.join("work", "privacy-site-test");

try {
  const output = await buildPrivacySite({ destination });
  const page = await fs.readFile(path.join(output, "index.md"), "utf8");
  const layout = await fs.readFile(
    path.join(output, "_layouts", "default.html"),
    "utf8",
  );
  const styles = await fs.readFile(
    path.join(output, "assets", "privacy.css"),
    "utf8",
  );
  const appPage = await fs.readFile(path.join(output, "app", "index.html"), "utf8");
  const manifest = JSON.parse(
    await fs.readFile(path.join(output, "app", "manifest.webmanifest"), "utf8"),
  );

  assert.match(page, /layout: default/);
  assert.match(page, /# Privacy policy/);
  assert.match(page, /Effective date:/);
  assert.match(page, /TheMealDB/);
  assert.match(page, /GitHub issue tracker/);
  assert.match(layout, /<meta name="viewport"/);
  assert.match(layout, /{{ content }}/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(appPage, /Supperloom Meal Planner/);
  assert.equal(manifest.display, "standalone");
} finally {
  await fs.rm(destination, { recursive: true, force: true });
}

console.log("Privacy site build test passed.");
