# Supperloom Meal Planner

A portable, dark-mode meal planner designed to run from a Windows thumb drive.

The offline website is in `outputs/meal-planner`. The installable Android
package is in `outputs/android`, and its native project is in `android`.

The current application version is `0.9.0`. Release work and product priorities
are tracked in [docs/V1_ROADMAP.md](docs/V1_ROADMAP.md). The reviewed draft
notes for the first stable version are in
[docs/releases/v1.0.0.md](docs/releases/v1.0.0.md).

## Android build

The Android app uses Capacitor and supports Android 7.0 (API 24) and newer.
It requires Node.js 22 or newer and Java 21. Install dependencies, synchronize
the web files, and build the private debug APK:

```powershell
pnpm install
pnpm android:build
```

The generated APK is written to
`android/app/build/outputs/apk/debug/app-debug.apk`.

Every GitHub push runs the full browser and receipt tests, Android lint, and an
APK build. Tagged releases also support protected Android signing and draft
GitHub releases. See [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).

## Main features

- Scale recipe ingredients for any number of people
- Plan a week of meals and print a combined grocery list
- Store recipes, preparation instructions, and meal photos
- Track refrigerator, freezer, and pantry inventory
- Import grocery-order text with prices, stores, and item numbers
- Estimate and record meal costs on a calendar
- Build meals through picture-based choices
- Search TheMealDB for online recipe ideas
- Use computer, iPhone, and Android-friendly layouts

## Run on Windows

Open `outputs/meal-planner`, then double-click:

`Start Meal Planner.bat`

Keep the server window open while using the planner.

For phone access on the same Wi-Fi, use:

`Start Meal Planner for Phones.bat`

## Personal data

`planner-data.json` and the automatic backup folder are intentionally excluded
from this repository. Recipes, shopping history, prices, and inventory remain
on the user's thumb drive.
