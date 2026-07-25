# Release checklist

## Repository automation

The `Build and test` workflow runs on every push. It:

1. Installs pinned Node.js, pnpm, Java, and Gradle tooling.
2. Restores dependency caches.
3. Runs the food-engine, browser, PDF, and receipt-photo tests.
4. Stages Android web files without personal planner data or backups.
5. Runs Android lint.
6. Builds an installable debug APK.
7. Uploads the APK, checksum, and lint report to the workflow run.
8. Reuses that exact APK on Android 7 and Android 15 phone emulators plus an
   Android 15 Pixel C tablet emulator.
9. Tests live recipe search, airplane-mode behavior, offline recipe-photo
   reading, recovery, touch sizing, phone layout, and Android 200% text scaling.
10. Upgrades a lower-version installation and verifies saved recipes and inventory survive.

Gradle commands stream their normal output and retry at most twice only when a
recognized transient network failure interrupts a dependency or distribution
download. Lint, compilation, signing, and test failures are never retried.

The `Draft Android release` workflow runs for semantic version tags such as
`v0.9.1`. It repeats the tests, builds a signed APK and Android App Bundle,
verifies both signatures, upgrades a signed lower-version installation on
Android 15, runs the native online, offline, recovery, and 200% text checks,
packages the portable thumb-drive website, writes SHA-256 checksums, and
creates a draft GitHub release for final human review. The keystore and its
passwords are scoped to signing steps and removed before emulator testing.

Both Android synchronization and thumb-drive packaging use a tracked-only
release staging step. It rejects backups, planner data, interrupted-save
temporary files, logs, symbolic links, and unexpected root files. Each package
contains a deterministic `RELEASE-MANIFEST.json` with file sizes and SHA-256
hashes.

Normal builds report image provenance progress. Signed release builds use the
strict audit and stop until every ingredient image has approved redistribution
metadata.

Repository secret scanning and push protection are enabled. Dependabot
vulnerability alerts and automatic security updates are enabled, and the
`Dependency review` workflow blocks pull requests that introduce dependencies
with moderate-or-higher known vulnerabilities. Weekly version checks cover
npm, Gradle, and GitHub Actions dependencies.

CodeQL default setup is enabled with the Extended query suite. It scans
supported source and workflow languages on the default branch, pull requests,
and a weekly schedule without duplicating the Android build workflow.

Private vulnerability reporting is enabled, and `.github/SECURITY.md` directs
security reports to GitHub's private advisory form instead of public issues.

Each signed release APK, Android App Bundle, portable website archive, and
checksum file receives a GitHub artifact attestation. This records verifiable
build provenance for the exact files produced by the release workflow.

Immutable releases are enabled for the repository. The workflow creates a
draft and attaches every asset before human publication. Publishing then locks
the release assets and associated tag against modification or deletion.

## One-time signing setup

Create and protect a release keystore before making a release tag. The same key
must be retained for future updates. Never commit it to Git.

Configure these GitHub Actions repository secrets:

- `ANDROID_KEYSTORE_BASE64`: Base64-encoded contents of the keystore
- `ANDROID_KEYSTORE_PASSWORD`: Keystore password
- `ANDROID_KEY_ALIAS`: Signing key alias
- `ANDROID_KEY_PASSWORD`: Signing key password
- `THEMEALDB_API_KEY`: Paid subscriber key authorized for an app-store build

The paid TheMealDB key is inserted only into staged release assets. Like any
key used directly by a phone app, it can be recovered from the published app,
so it should be limited to this use and rotated if the provider account is
misused.

Keep an encrypted offline backup of the keystore and its passwords in two
separate physical locations. Losing the signing key can prevent updates to
installed copies of the app.

## Versioning

The version in `package.json` and Android `versionName` must match. Android
`versionCode` uses this formula:

`major * 1,000,000 + minor * 1,000 + patch`

Run this before creating a version tag:

```powershell
pnpm release:verify v0.9.1
```

Then commit the version change and create the matching tag:

```powershell
git tag -a v0.9.1 -m "Bob and Mary's Meal Planner v0.9.1"
git push origin v0.9.1
```

The workflow creates a draft release. Install and inspect that exact APK before
publishing the draft. After publication, verify the immutable release and a
downloaded asset:

```powershell
gh release verify v0.9.1 -R usa50xxx/bob-and-marys-retirement-meal-planner
gh release verify-asset v0.9.1 Bob-and-Marys-Meal-Planner-v0.9.1.apk -R usa50xxx/bob-and-marys-retirement-meal-planner
```

The Android project already targets API level 36, which meets Google Play's
stated requirement for new apps and updates beginning August 31, 2026.

## v1.0 approval gates

- [x] All automated tests and Android lint pass in hosted CI.
- [ ] Signed APK upgrades an existing 0.9 installation without data loss.
- [ ] Signed AAB passes Play Console pre-launch checks.
- [x] Core recipe, inventory, recovery, and layout tasks pass on Android 7,
  Android 15, and an Android 15 Pixel C tablet.
- [x] Native CI passes on Android 7 and Android 15, including offline recipe-photo OCR.
- [x] The installed-app upgrade test preserves and migrates a saved recipe and inventory item.
- [x] Android 15 CI verifies real TheMealDB search, the airplane-mode failure
  message, and local recipe/photo processing while offline.
- [x] Backup and restore are tested with realistic data.
- [x] Automated WCAG A/AA checks cover every main screen, selected recipes, guided cooking, phone layouts, keyboard access, visible focus, and screen-reader names.
- [x] Android 15 automation restarts the native app at 200% text, proves that
  text enlarged, and checks every main area for clipping, horizontal overflow,
  off-screen controls, and touch-target size.
- [ ] Manual accessibility review covers real TalkBack or VoiceOver use.
- [x] Privacy policy draft describes local data, photos, files, internet access, and disabled Android automatic backup.
- [ ] Privacy policy is published at a stable URL, linked inside the app, and
  entered in Play Console. A tested GitHub Pages build and deploy workflow is
  prepared for `main`, and workflow-based Pages publishing is enabled. Merging
  and deploying the policy plus adding the in-app link remain.
- [ ] Play Console Data safety answers match the verified release behavior and
  third-party requests. The
  [submission worksheet](PLAY_CONSOLE_DATA_SAFETY.md) is prepared; TheMealDB
  retention and the final signed build still require confirmation.
- [x] Food image licenses and attribution are complete; all 298 physical images pass the strict provenance audit.
- [ ] A paid TheMealDB publish key is configured and the provider credit is approved.
- [ ] Repository software license is selected.
- [x] Support and privacy questions can be submitted through the repository issue tracker.
- [x] Release notes explain known limitations and backup instructions.
- [x] Automated tracked-only staging prevents personal data from entering thumb-drive and Android release packages.

Google Play requires an accurate
[Data safety declaration](https://support.google.com/googleplay/android-developer/answer/10787469)
and a privacy policy link in Play Console and in the app under its
[User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311).

Staged Android and portable-release scripts are transformed for the Chrome 69
WebView bundled with the Android 7 test image. The tracked source remains
readable and modern, and small local polyfills cover UUID generation and
collection helpers missing from that WebView.
