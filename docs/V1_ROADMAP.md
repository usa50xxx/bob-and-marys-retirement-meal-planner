# Roadmap to v1.0

Supperloom is currently a `0.9.x` prerelease. The goal for
v1.0 is a dependable, private, offline-first planner that is comfortable for
people who do not use computers often.

## What leading apps do well

The review focused on Paprika, AnyList, Samsung Food, Mealime, KitchenPal, and
Cooklist. Their strongest recurring patterns are:

| Product pattern | Examples | Decision for this planner |
| --- | --- | --- |
| Turn planned recipes into one consolidated grocery list | AnyList, Samsung Food, Paprika | Keep and harden |
| Scale servings before calculating the shopping list | AnyList, Mealime | Keep and add quantity validation |
| Compare the grocery list with pantry stock | Paprika, KitchenPal, Cooklist | Make this the core v1.0 calculator |
| Suggest recipes using food already at home | KitchenPal, Cooklist | Keep, then rank by match and expiration |
| Import recipes from links, text, or photos | Paprika, AnyList, Samsung Food | Add a review-before-save importer |
| Provide a focused cooking view | AnyList, Mealime | Add step checkoff, large text, and timers |
| Track expiration dates and leftovers | KitchenPal | Add after quantity matching is reliable |
| Share live household data across devices | AnyList, Cooklist | Defer to v1.1; it requires accounts and a secure sync service |
| Nutrition scoring and retailer checkout | Samsung Food, Mealime | Defer; valuable but not central to the private offline promise |

## v1.0 priorities

### P0: release blockers

- Keep every existing automated browser and receipt test passing.
- Add automated debug APK builds for every push.
- Produce signed APK and AAB files from protected GitHub secrets.
- Test Android 7, a current Android phone, and a tablet-sized screen.
- Complete a backup, restore, upgrade, and interrupted-save recovery test.
- Audit every bundled food image for source and redistribution permission.
- Publish a privacy policy and choose a repository license.
- Remove all example or personal shopping data from release packages.

**Release packaging implemented in the 0.9 prerelease:** Android and portable
website builds now stage only tracked application assets; backups, planner
data, interrupted-save files, logs, links, and unexpected root files are
rejected; every staged package includes a deterministic SHA-256 manifest; and
the signed release workflow refuses to continue until every bundled ingredient
image has complete approved source and license metadata. A privacy policy and
third-party notices are included, and all 298 physical ingredient images now
pass the strict source and redistribution audit. The repository license
decision remains an open release blocker.

### P1: highest-value product work

1. Finish the food calculator.
   Normalize pounds, ounces, cups, cans, packages, and counts. Show Have, Need,
   and Buy consistently. After cooking, ask the user to confirm what was used
   before subtracting it from inventory.

   **Implemented in the 0.9 prerelease:** compatible quantities are combined
   across multiple refrigerator, freezer, and pantry entries; pounds, ounces,
   cups, spoons, metric units, items, and counts convert safely; weekly recipes
   using different compatible units become one grocery requirement; duplicate
   recipe lines cannot use the same stock twice; cooking shows the food that
   will be subtracted; remaining food cost is reduced proportionally; and Undo
   restores both inventory and the meal-cost record.

2. Add expiration-aware inventory.
   Store best-by dates, highlight food to use soon, and rank recipe ideas that
   prevent waste. Alerts should be optional and easy to understand.

   **Implemented in the 0.9 prerelease:** groceries can receive an optional
   best-by date during receipt review or directly in inventory; notices can be
   turned off or set to 3, 7, or 14 days; food past its date is clearly marked
   for checking rather than recommended; separate dated purchases remain
   separate inventory lots; cooking consumes the earliest compatible lot
   first; saved recipe ideas and the food helper prioritize usable food that is
   due soon; and every date or notice change supports Undo.

3. Add a guided cooking mode.
   Show one readable step at a time, allow ingredient and step checkoff, keep
   the screen awake while cooking, and provide simple multiple timers.

   **Implemented in the 0.9 prerelease:** the selected recipe opens in a
   focused cooking guide with scaled ingredient checkboxes, one large step at
   a time, previous and next controls, saved progress, and a phone-first
   layout; several named timers can run, pause, resume, finish, restart, or be
   removed independently; timer deadlines survive closing and reopening the
   guide; supported browsers keep the screen awake and reacquire the wake lock
   after returning to the app; and finishing hands off to the existing
   inventory and meal-cost confirmation before food is subtracted.

4. Add reviewed recipe capture.
   Accept a recipe link, pasted text, PDF, or photograph. Extract the title,
   servings, ingredients, time, temperature, and steps into an editable review
   screen before saving.

   **Implemented in the 0.9 prerelease:** pasted recipes, PDF files, recipe
   photographs, public website links, and recipes returned by online search all
   open the same review screen before anything is saved; the reader extracts
   Schema.org recipe metadata when available and falls back to visible text;
   name, servings, prep/cook/total time, temperature, source, ingredients, and
   cooking steps can all be corrected; the thumb-drive server safely retrieves
   public recipe pages without allowing private-network addresses; and the
   review remains usable at phone width.

5. Add confidence and recovery.
   Keep Undo visible, make automatic backups easy to restore, show the last
   successful save time, and explain any import row that could not be read.

   **Implemented in the 0.9 prerelease:** every successful save shows when and
   where it was confirmed; interrupted phone or browser saves recover from a
   pending or previous-good copy; the thumb-drive server keeps automatic
   backups and can repair a damaged main file from the newest valid temporary
   save or backup; manual, previous-good, exported, and thumb-drive backups are
   listed in one restore panel; the current planner is backed up before an
   import or restore; and incomplete import rows are explained before the user
   decides whether to continue.

### P2: useful after v1.0

- Shared household sync with conflict handling.
- Barcode scanning and product lookup.
- Nutrition and allergy profiles.
- Home-screen grocery and "tonight's meal" widgets.
- Store aisle customization and price comparison.
- Cloud recipe discovery beyond the existing optional provider.

## v1.0 release gates

v1.0 is ready only when all P0 items are complete, P1 quantity and recovery
work is covered by tests, the signed release installs as an upgrade over 0.9,
and a non-technical tester can complete these tasks without help:

1. Import a grocery receipt and correct a mistaken row.
2. Find the imported food in the refrigerator, freezer, or pantry.
3. Choose a recipe based only on food in the house.
4. Change the serving count and see accurate Have, Need, and Buy amounts.
5. Plan a meal, print its recipe, and print the combined grocery list.
6. Mark a meal cooked and confirm inventory and meal cost.
7. Back up the data and restore it on another device.

## Research sources

- [Paprika user guide](https://www.paprikaapp.com/help/windows/)
- [AnyList meal planning](https://www.anylist.com/meal-planning)
- [Samsung Food](https://samsungfood.com/)
- [Mealime](https://www.mealime.com/)
- [KitchenPal pantry and shopping features](https://kitchenpalapp.com/)
- [Cooklist app](https://cooklist.com/cooklist-app)
- [NoWaste inventory and expiration tracking](https://www.nowasteapp.com/)
- [Samsung Food List and expiration tracking](https://www.samsung.com/us/support/answer/ANS10006842/)
- [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
- [W3C Screen Wake Lock specification](https://www.w3.org/TR/screen-wake-lock/)
- [Android release build guidance](https://developer.android.com/build/build-for-release)
- [Google Play target API requirements](https://developer.android.com/google/play/requirements/target-sdk)
