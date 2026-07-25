import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const workflowsDirectory = ".github/workflows";
const workflowNames = fs
  .readdirSync(workflowsDirectory)
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort();

assert.ok(workflowNames.length > 0, "No GitHub Actions workflows were found.");

for (const workflowName of workflowNames) {
  const workflowPath = path.join(workflowsDirectory, workflowName);
  const workflow = fs.readFileSync(workflowPath, "utf8");

  for (const [index, line] of workflow.split(/\r?\n/).entries()) {
    const match = line.match(/^\s*uses:\s*(\S+)/);
    if (!match || match[1].startsWith("./")) continue;

    assert.match(
      match[1],
      /^[^@\s]+@[0-9a-f]{40}$/,
      `${workflowPath}:${index + 1} must pin its action to an exact 40-character commit SHA.`,
    );
  }
}

const release = fs.readFileSync(
  path.join(workflowsDirectory, "release.yml"),
  "utf8",
);
assert.match(release, /^\s*id-token:\s*write\s*$/m);
assert.match(release, /^\s*attestations:\s*write\s*$/m);
assert.match(
  release,
  /actions\/attest@f7c74d28b9d84cb8768d0b8ca14a4bac6ef463e6/,
);
for (const releaseSubject of [
  "dist/*.apk",
  "dist/*.aab",
  "dist/*.zip",
  "dist/SHA256SUMS.txt",
]) {
  assert.ok(
    release.includes(releaseSubject),
    `Release attestation is missing ${releaseSubject}.`,
  );
}

const removeKeyIndex = release.indexOf(
  "- name: Remove signing key before emulator testing",
);
const emulatorIndex = release.indexOf(
  "- name: Test the exact signed APK and upgrade on Android 15",
);
assert.ok(removeKeyIndex >= 0, "Release workflow does not remove the signing key.");
assert.ok(emulatorIndex >= 0, "Release workflow does not test the signed APK.");
assert.ok(
  removeKeyIndex < emulatorIndex,
  "The signing key must be removed before emulator testing.",
);

const dependencyReview = fs.readFileSync(
  path.join(workflowsDirectory, "dependency-review.yml"),
  "utf8",
);
assert.match(
  dependencyReview,
  /actions\/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294/,
);
assert.match(dependencyReview, /^\s*fail-on-severity:\s*moderate\s*$/m);

const dependabot = fs.readFileSync(".github/dependabot.yml", "utf8");
for (const ecosystem of ["npm", "gradle", "github-actions"]) {
  assert.match(
    dependabot,
    new RegExp(`package-ecosystem:\\s*${ecosystem.replace("-", "\\-")}`),
    `Dependabot is not configured for ${ecosystem}.`,
  );
}
assert.equal(
  (dependabot.match(/interval:\s*weekly/g) || []).length,
  3,
  "Each dependency ecosystem must have a weekly update schedule.",
);

console.log(
  `Workflow security checks passed for ${workflowNames.length} workflows.`,
);
