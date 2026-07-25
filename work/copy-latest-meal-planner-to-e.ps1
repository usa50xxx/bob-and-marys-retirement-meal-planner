$ErrorActionPreference = "Stop"

$source = "C:\Users\usa50\Documents\Codex\2026-07-23\i-want-to-create-a-new\outputs\meal-planner"
$target = "E:\Meal Planner"
$androidSource = "C:\Users\usa50\Documents\Codex\2026-07-23\i-want-to-create-a-new\outputs\android"
$driveRootSource = "C:\Users\usa50\Documents\Codex\2026-07-23\i-want-to-create-a-new\thumb-drive-root"

if (-not (Test-Path -LiteralPath "E:\" -PathType Container)) {
  throw "Drive E: is not available."
}

if (-not (Test-Path -LiteralPath $source -PathType Container)) {
  throw "The latest meal planner folder was not found: $source"
}

New-Item -ItemType Directory -Force -Path $target | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $target "icons") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $target "images") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $target "images\ingredients") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $target "backups") | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $target "backups\before-update-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null

$topLevelFiles = @(
  "app.js",
  "compatibility.js",
  "food-engine.js",
  "ingredient-image-aliases.js",
  "index.html",
  "iphone.html",
  "android.html",
  "manifest.webmanifest",
  "pwa.js",
  "receipt-reader.js",
  "recipe-reader.js",
  "recovery.js",
  "service-worker.js",
  "starter-recipes.js",
  "styles.css",
  "meal-planner-server.ps1",
  "README.txt",
  "Start Meal Planner.bat",
  "Start Meal Planner for Phones.bat",
  "Start Meal Planner From Drive.bat",
  "Start Supperloom.bat",
  "Start Supperloom for Phones.bat",
  "autorun.inf",
  "favicon.ico"
)

foreach ($file in $topLevelFiles) {
  $targetFile = Join-Path $target $file
  if (Test-Path -LiteralPath $targetFile -PathType Leaf) {
    Copy-Item -LiteralPath $targetFile -Destination (Join-Path $backup $file) -Force
  }
}

foreach ($file in $topLevelFiles) {
  $sourceFile = Join-Path $source $file
  if (Test-Path -LiteralPath $sourceFile -PathType Leaf) {
    Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $target $file) -Force
  }
}

Copy-Item -LiteralPath (Join-Path $driveRootSource "autorun.inf") -Destination "E:\autorun.inf" -Force

$sourceIcons = Join-Path $source "icons"
$targetIcons = Join-Path $target "icons"
if (Test-Path -LiteralPath $sourceIcons -PathType Container) {
  Copy-Item -Path (Join-Path $sourceIcons "*") -Destination $targetIcons -Recurse -Force
}

$legacyStarterFiles = @(
  "Start Bob and Mary's Meal Planner.bat",
  "Start Bob and Mary's Meal Planner for Phones.bat"
)

foreach ($file in $legacyStarterFiles) {
  foreach ($legacyFile in @((Join-Path "E:\" $file), (Join-Path $target $file))) {
    if (Test-Path -LiteralPath $legacyFile -PathType Leaf) {
      Copy-Item -LiteralPath $legacyFile -Destination (Join-Path $backup $file) -Force
      Remove-Item -LiteralPath $legacyFile -Force
    }
  }
}

$rootStarterFiles = @(
  "Start Supperloom.bat",
  "Start Supperloom for Phones.bat"
)

foreach ($file in $rootStarterFiles) {
  $rootFile = Join-Path "E:\" $file
  if (Test-Path -LiteralPath $rootFile -PathType Leaf) {
    Copy-Item -LiteralPath $rootFile -Destination (Join-Path $backup $file) -Force
  }
  $sourceFile = Join-Path $driveRootSource $file
  if (Test-Path -LiteralPath $sourceFile -PathType Leaf) {
    Copy-Item -LiteralPath $sourceFile -Destination $rootFile -Force
  }
}

$sourceImages = Join-Path $source "images"
$targetImages = Join-Path $target "images"
$sourceIngredientImages = Join-Path $sourceImages "ingredients"
$targetIngredientImages = Join-Path $targetImages "ingredients"
$sourceWebpCount = (Get-ChildItem -LiteralPath $sourceIngredientImages -Filter "*.webp" -File | Measure-Object).Count
if ($sourceWebpCount -lt 298) {
  throw "The optimized ingredient picture set is incomplete, so the old pictures were left alone."
}
Copy-Item -Path (Join-Path $sourceImages "*") -Destination $targetImages -Recurse -Force
$sourceImageNames = @(
  Get-ChildItem -LiteralPath $sourceIngredientImages -Filter "*.webp" -File |
    ForEach-Object { $_.Name }
)
Get-ChildItem -LiteralPath $targetIngredientImages -Filter "*.webp" -File |
  Where-Object { $_.Name -notin $sourceImageNames } |
  Remove-Item -Force
Get-ChildItem -LiteralPath $targetIngredientImages -Filter "*.png" -File |
  Remove-Item -Force

$sourceVendor = Join-Path $source "vendor"
$targetVendor = Join-Path $target "vendor"
if (Test-Path -LiteralPath $sourceVendor -PathType Container) {
  New-Item -ItemType Directory -Force -Path $targetVendor | Out-Null
  Copy-Item -Path (Join-Path $sourceVendor "*") -Destination $targetVendor -Recurse -Force
}

$targetAndroid = Join-Path $target "Android"
if (Test-Path -LiteralPath $androidSource -PathType Container) {
  New-Item -ItemType Directory -Force -Path $targetAndroid | Out-Null
  Copy-Item -Path (Join-Path $androidSource "*") -Destination $targetAndroid -Recurse -Force
}

$dataFile = Join-Path $target "planner-data.json"
if (Test-Path -LiteralPath $dataFile -PathType Leaf) {
  Copy-Item -LiteralPath $dataFile -Destination (Join-Path $backup "planner-data-preserved-copy.json") -Force
}

$summary = [ordered]@{
  target = $target
  backup = $backup
  targetAppLength = (Get-Item -LiteralPath (Join-Path $target "app.js")).Length
  ingredientImageCount = (Get-ChildItem -LiteralPath (Join-Path $target "images\ingredients") -Filter "*.webp" | Measure-Object).Count
  oldPngImageCount = (Get-ChildItem -LiteralPath (Join-Path $target "images\ingredients") -Filter "*.png" | Measure-Object).Count
  androidApkCopied = (Test-Path -LiteralPath (Join-Path $targetAndroid "Supperloom.apk") -PathType Leaf)
  dataFilePreserved = (Test-Path -LiteralPath $dataFile -PathType Leaf)
  copiedAt = (Get-Date).ToString("s")
}

$summary | ConvertTo-Json
