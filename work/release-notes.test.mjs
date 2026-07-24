import assert from "node:assert/strict";
import fs from "node:fs";

const notesPath = "docs/releases/v1.0.0.md";
const notes = fs.readFileSync(notesPath, "utf8");
const workflow = fs.readFileSync(".github/workflows/release.yml", "utf8");

for (const heading of [
  "## Choose your download",
  "## Back up before upgrading",
  "## What is included",
  "## Privacy and offline use",
  "## Known limitations",
  "## Release verification",
]) {
  assert.ok(notes.includes(heading), `Missing release-notes section: ${heading}`);
}

assert.match(notes, /Do not uninstall/i);
assert.match(notes, /Export backup/);
assert.match(notes, /Android 7/);
assert.doesNotMatch(notes, /\b(?:TODO|TBD)\b|<[^>]+>/i);
assert.match(workflow, /docs\/releases\/\$\{RELEASE_TAG\}\.md/);
assert.match(workflow, /isDraft/);
assert.match(workflow, /Refusing to replace an already published release/);

console.log("Release notes and draft-release safeguards passed.");
