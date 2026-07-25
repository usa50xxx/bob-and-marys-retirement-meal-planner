import assert from "node:assert/strict";
import {
  canonicalGradleArgument,
  isRetryableGradleFailure,
  isSafeGradleArgument,
} from "./run-gradle.mjs";

for (const message of [
  "java.net.SocketException: Connection reset",
  "java.net.SocketTimeoutException: Read timed out",
  "java.net.UnknownHostException: services.gradle.org",
  "Temporary failure in name resolution",
  "Could not resolve host: services.gradle.org",
  "503 Service Unavailable",
]) {
  assert.equal(
    isRetryableGradleFailure(message),
    true,
    `Expected a retry for: ${message}`,
  );
}

for (const message of [
  "Execution failed for task ':app:lintDebug'.",
  "Compilation failed; see the compiler error output for details.",
  "Keystore file not found for signing config release.",
  "There were failing tests.",
]) {
  assert.equal(
    isRetryableGradleFailure(message),
    false,
    `Must not retry a real build failure: ${message}`,
  );
}

for (const argument of [
  "lintDebug",
  "assembleRelease",
  "-PbobMaryVersionCodeOverride=1000000",
]) {
  assert.equal(isSafeGradleArgument(argument), true, argument);
}
for (const argument of [
  "lintDebug && echo unsafe",
  "assembleDebug; uname",
  "$(whoami)",
  "task with spaces",
  ":app:assembleRelease",
  "--stacktrace",
  "-PversionCode=1000000",
  "-PbobMaryVersionCodeOverride=0",
  "clean",
]) {
  assert.equal(isSafeGradleArgument(argument), false, argument);
}
assert.equal(canonicalGradleArgument("lintDebug"), "lintDebug");
assert.equal(
  canonicalGradleArgument("-PbobMaryVersionCodeOverride=000123"),
  "-PbobMaryVersionCodeOverride=123",
);
assert.throws(
  () => canonicalGradleArgument("assembleDebug && whoami"),
  /Unsupported Gradle argument/,
);

console.log("Gradle retry classification tests passed.");
