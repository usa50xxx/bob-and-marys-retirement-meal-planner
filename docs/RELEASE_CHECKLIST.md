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
8. Reuses that exact APK on Android 7 and Android 15 emulators.
9. Tests offline recipe-photo reading, recovery, touch sizing, and phone layout.
10. Upgrades a lower-version installation and verifies saved recipes and inventory survive.

The `Draft Android release` workflow runs for semantic version tags such as
`v0.9.1`. It repeats the tests, builds a signed APK and Android App Bundle,
packages the portable thumb-drive website, writes SHA-256 checksums, and
creates a draft GitHub release for final human review.

Both Android synchronization and thumb-drive packaging use a tracked-only
release staging step. It rejects backups, planner data, interrupted-save
temporary files, logs, symbolic links, and unexpected root files. Each package
contains a deterministic `RELEASE-MANIFEST.json` with file sizes and SHA-256
hashes.

Normal builds report image provenance progress. Signed release builds use the
strict audit and stop until every ingredient image has approved redistribution
metadata.

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
publishing the draft.

The Android project already targets API level 36, which meets Google Play's
stated requirement for new apps and updates beginning August 31, 2026.

## v1.0 approval gates

- [ ] All automated tests and Android lint pass.
- [ ] Signed APK upgrades an existing 0.9 installation without data loss.
- [ ] Signed AAB passes Play Console pre-launch checks.
- [ ] Core tasks pass on Android 7, current Android, and tablet layouts.
- [x] Native CI passes on Android 7 and Android 15, including offline recipe-photo OCR.
- [x] The installed-app upgrade test preserves and migrates a saved recipe and inventory item.
- [ ] Airplane-mode operation and optional online recipe search are tested.
- [x] Backup and restore are tested with realistic data.
- [x] Automated WCAG A/AA checks cover every main screen, selected recipes, guided cooking, phone layouts, keyboard access, visible focus, and screen-reader names.
- [ ] Manual accessibility review covers 200% text scaling and real TalkBack or VoiceOver use.
- [x] Privacy policy draft describes local data, photos, files, internet access, and disabled Android automatic backup.
- [ ] Privacy policy is published at a stable URL, linked inside the app, and entered in Play Console.
- [ ] Play Console Data safety answers match the verified release behavior and third-party requests.
- [ ] Food image licenses and attribution are complete.
- [ ] A paid TheMealDB publish key is configured and the provider credit is approved.
- [ ] Repository software license is selected.
- [x] Support and privacy questions can be submitted through the repository issue tracker.
- [ ] Release notes explain known limitations and backup instructions.
- [x] Automated tracked-only staging prevents personal data from entering thumb-drive and Android release packages.

Google Play requires an accurate
[Data safety declaration](https://support.google.com/googleplay/android-developer/answer/10787469)
and a privacy policy link in Play Console and in the app under its
[User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311).

Staged Android and portable-release scripts are transformed for the Chrome 69
WebView bundled with the Android 7 test image. The tracked source remains
readable and modern, and small local polyfills cover UUID generation and
collection helpers missing from that WebView.
