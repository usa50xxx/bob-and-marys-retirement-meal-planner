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

The `Draft Android release` workflow runs for semantic version tags such as
`v0.9.1`. It repeats the tests, builds a signed APK and Android App Bundle,
packages the portable thumb-drive website, writes SHA-256 checksums, and
creates a draft GitHub release for final human review.

## One-time signing setup

Create and protect a release keystore before making a release tag. The same key
must be retained for future updates. Never commit it to Git.

Configure these GitHub Actions repository secrets:

- `ANDROID_KEYSTORE_BASE64`: Base64-encoded contents of the keystore
- `ANDROID_KEYSTORE_PASSWORD`: Keystore password
- `ANDROID_KEY_ALIAS`: Signing key alias
- `ANDROID_KEY_PASSWORD`: Signing key password

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
- [ ] Airplane-mode operation and optional online recipe search are tested.
- [ ] Backup and restore are tested with realistic data.
- [ ] Accessibility review covers text scaling, contrast, touch targets, and screen readers.
- [ ] Privacy policy accurately describes local data, photos, files, and internet access.
- [ ] Food image licenses and attribution are complete.
- [ ] Repository license and support contact are selected.
- [ ] Release notes explain known limitations and backup instructions.
- [ ] Thumb-drive and Android release packages contain no personal data.
