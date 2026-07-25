import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parseArguments, run } from "./android-test-utils.mjs";

const options = parseArguments(process.argv.slice(2));
if (!options.output) {
  throw new Error("Provide --output with the baseline APK destination.");
}
const variant = options.variant || "debug";
if (!["debug", "release"].includes(variant)) {
  throw new Error(`Unsupported Android baseline variant: ${variant}.`);
}

const gradleFile = "android/app/build.gradle";
const gradle = fs.readFileSync(gradleFile, "utf8");
const candidateCode = Number(gradle.match(/appVersionCode\s*=\s*(\d+)/)?.[1]);
if (!candidateCode) {
  throw new Error(`Could not read appVersionCode from ${gradleFile}.`);
}

const baselineCode = candidateCode - 1;
const capitalizedVariant = `${variant[0].toUpperCase()}${variant.slice(1)}`;
run(process.execPath, [
  "work/run-gradle.mjs",
  `assemble${capitalizedVariant}`,
  `-PbobMaryVersionCodeOverride=${baselineCode}`,
]);

const source = path.resolve(
  `android/app/build/outputs/apk/${variant}/app-${variant}.apk`,
);
const destination = path.resolve(options.output);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);

console.log(JSON.stringify({
  candidateVersionCode: candidateCode,
  baselineVersionCode: baselineCode,
  variant,
  apk: destination,
}, null, 2));
