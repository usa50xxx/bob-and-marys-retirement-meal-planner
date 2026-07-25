# Play Console Data safety worksheet

This worksheet records the verified behavior of Bob and Mary's Retirement Meal
Planner and provides conservative draft answers for Google Play Console. Review
the final release build and TheMealDB's current data handling before submitting
the form.

Google defines collection as transmitting user data off the device, including
transmission to a third party. Data used only on the device is outside the
collection definition. Google requires every published app to complete the
form, keep it consistent with the privacy policy, and include third-party code
and services in the review.

Official references:

- [Google Play Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)

## Verified release behavior

- The Android package is `com.bobandmary.mealplanner`.
- The packaged APK requests `android.permission.INTERNET` and no location,
  contacts, camera, microphone, advertising ID, or broad-storage permission.
- There is no account, advertising, analytics, crash-reporting service, push
  service, or developer-operated synchronization service.
- Recipes, meal plans, grocery lists, prices, spending history, inventory,
  receipt contents, PDFs, receipt photos, and recipe photos are stored and
  processed locally.
- Receipt and recipe optical character recognition runs from bundled local
  files and models.
- Android automatic cloud backup and device-transfer backup are disabled.
- Online recipe search sends the search term to TheMealDB over HTTPS only after
  the user chooses Search.
- Recipe-link import requests the public HTTPS address entered by the user only
  after the user chooses to import it.
- The app does not send household inventory, receipts, prices, spending
  history, meal plans, or personal photos to TheMealDB or recipe websites.

Evidence:

- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/res/xml/backup_rules.xml`
- `android/app/src/main/res/xml/data_extraction_rules.xml`
- `outputs/meal-planner/app.js`
- `outputs/meal-planner/receipt-reader.js`
- `outputs/meal-planner/recipe-reader.js`
- `PRIVACY.md`

## Draft top-level answers

| Play Console question | Draft answer | Basis |
| --- | --- | --- |
| Does the app collect or share required user data types? | Yes | Optional search terms and recipe-link requests leave the device. |
| Is all collected user data encrypted in transit? | Yes | Release network destinations use HTTPS. Recheck the final staged app before submission. |
| Does the app provide a data-deletion request mechanism? | No developer-held server data exists | Users delete local entries or app storage themselves. Do not claim deletion of third-party logs. |
| Does the app support accounts? | No | The app has no sign-in or account creation. |

## Data type: In-app search history

Use this entry for the recipe name or ingredient a user sends to TheMealDB.

| Field | Conservative draft answer |
| --- | --- |
| Collected | Yes |
| Shared | No, if the user-initiated sharing exception applies; confirm in Play Console |
| Required or optional | Optional |
| Purpose | App functionality |
| Processed ephemerally | Do not claim until TheMealDB confirms retention and logging behavior |
| Encrypted in transit | Yes |

The app does not retain an online search history for the developer. A recipe
the user chooses to save becomes local planner data.

## Data type: Web browsing history

Use this entry conservatively for a public recipe URL explicitly entered by the
user and requested by the app.

| Field | Conservative draft answer |
| --- | --- |
| Collected | Yes |
| Shared | No, if the user-initiated sharing exception applies; confirm in Play Console |
| Required or optional | Optional |
| Purpose | App functionality |
| Processed ephemerally | Do not claim because the destination website controls its logs |
| Encrypted in transit | Yes; the release accepts HTTPS recipe links |

## Data types not transmitted by the app

Do not select these based only on local planner storage:

- Purchase history or other financial information
- Photos or videos
- Files and documents
- Other user-generated content, including recipes and notes
- App interactions
- Location
- Contacts
- Device or other IDs
- Crash logs, diagnostics, or other performance data

Revisit this list if analytics, crash reporting, cloud synchronization,
accounts, advertising, or a different recipe provider is added.

## Before submission

1. Build the signed `v1.0.0` APK and AAB from the release workflow.
2. Verify the final APK permissions and inspect all release network endpoints.
3. Obtain written confirmation of TheMealDB's retention and permitted app-store
   use for the paid API key.
4. Decide with Play Console guidance whether the user-initiated sharing
   exception applies to search terms and recipe-link requests.
5. Publish the privacy policy at a stable public webpage, link it inside the
   app, and enter that same URL in Play Console.
6. Enter the answers as a draft, compare Play Console's preview with
   `PRIVACY.md`, and submit only after the signed build is final.
