# Ingredient image provenance audit

Status: **blocks a public v1.0 release**

The current ingredient folder contains 295 byte-unique WebP files and no
duplicate files. A browser alias map preserves 101 additional ingredient names
without shipping repeated bytes. Sixty-four project-original images have
complete approved metadata. Existing legacy notes identify a source for 57 of
the physical files, but those records are not complete license approvals.
Seventeen files appear in both sets, leaving 104 physical files with at least
one source record and 191 with none. In total, 231 physical files still need
replacement or complete approval before release.

Run the report without failing normal development:

```powershell
pnpm images:audit
```

The signed release workflow runs the strict form:

```powershell
pnpm images:audit:strict
```

Strict approval requires an `IMAGE_PROVENANCE.json` record for every WebP file
with `status`, `file`, `sourceUrl`, `author`, `license`, and `licenseUrl`.
`status` must be `approved`. A source URL alone is not proof of redistribution
permission.

## Provider findings

- [Walmart.com's Terms of Use](https://www.walmart.com/help/article/walmart-com-terms-of-use/3b75080af40340d6bbd596f116fae5a0/)
  prohibit systematic downloading, data extraction, and scraping without prior
  written consent. Walmart product images must not be redistributed in this
  app without written permission.
- [Walmart corporate terms](https://corporate.walmart.com/terms-of-use) limit
  site content and images to personal, non-commercial use and prohibit
  republishing or distribution without permission.
- [TheMealDB terms](https://www.themealdb.com/terms_of_use.php) permit the free
  API for development, but require a paid subscriber account to publish an app
  to an app store. A release also needs the provider's required source credit.
  The release workflow therefore requires `THEMEALDB_API_KEY` and injects it
  only into staged release assets; the paid key does not make an image
  releasable unless its own artwork and credit terms are also satisfied.
- [Wikimedia Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/en)
  explains that each file has its own license and that the author, license, and
  changes must be credited as required by that file's page.

## Remediation

1. Replace unknown and Walmart-derived files with original project images,
   clearly licensed images, or images for which written redistribution
   permission is retained.
2. Record the exact source page, creator, license name, license URL, and any
   required attribution for each image.
3. Preserve original license notices and document crops, resizing, or other
   changes when the license requires it.
4. Remove redundant files or explicitly map several ingredient names to one
   approved image.
5. Run the strict audit before creating a release tag.

## Completed remediation

- Exact duplicate files were collapsed into `IMAGE_ALIASES.json`; every alias
  resolves locally, alias chains are rejected, and automated tests require all
  physical files to have unique bytes.
- Sixty-four beef, chicken, pork, and seafood images now have visually distinct,
  project-original generated sources. The unedited source sheets and exact grid
  manifests are retained under `assets/generated`, their derivation is
  reproducible, and their release permission is recorded in `IMAGE_LICENSE.md`
  and `IMAGE_PROVENANCE.json`.
