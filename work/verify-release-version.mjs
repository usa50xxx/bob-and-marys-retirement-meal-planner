import fs from "node:fs";
import process from "node:process";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const gradle = fs.readFileSync("android/app/build.gradle", "utf8");
const requestedTag =
  process.argv[2] || process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME;
const expectedTag = `v${packageJson.version}`;
const versionName = gradle.match(/appVersionName\s*=\s*"([^"]+)"/)?.[1]
  || gradle.match(/versionName\s+"([^"]+)"/)?.[1];
const versionCode = Number(
  gradle.match(/appVersionCode\s*=\s*(\d+)/)?.[1]
  || gradle.match(/versionCode\s+(\d+)/)?.[1],
);
const [major, minor, patch] = packageJson.version.split(".").map(Number);
const expectedCode = major * 1_000_000 + minor * 1_000 + patch;

const failures = [];

if (!/^\d+\.\d+\.\d+$/.test(packageJson.version)) {
  failures.push(`package.json version must be X.Y.Z, found ${packageJson.version}`);
}
if (versionName !== packageJson.version) {
  failures.push(
    `Android versionName ${versionName ?? "missing"} does not match ${packageJson.version}`,
  );
}
if (versionCode !== expectedCode) {
  failures.push(
    `Android versionCode ${versionCode || "missing"} must be ${expectedCode}`,
  );
}
if (requestedTag && requestedTag !== expectedTag) {
  failures.push(`Release tag ${requestedTag} must match ${expectedTag}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`ERROR: ${failure}`);
  process.exit(1);
}

console.log(
  `Release version verified: ${expectedTag} (Android versionCode ${versionCode})`,
);
