$ErrorActionPreference = "Stop"

$source = "C:\Users\usa50\Documents\Codex\2026-07-23\i-want-to-create-a-new\outputs\meal-planner"
$target = "E:\Meal Planner"

if (-not (Test-Path -LiteralPath "E:\" -PathType Container)) {
  throw "Drive E: is not available."
}

if (-not (Test-Path -LiteralPath $source -PathType Container)) {
  throw "The latest meal planner folder was not found: $source"
}

New-Item -ItemType Directory -Force -Path $target | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $target "images") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $target "images\ingredients") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $target "backups") | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $target "backups\before-update-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null

$topLevelFiles = @(
  "app.js",
  "index.html",
  "iphone.html",
  "android.html",
  "styles.css",
  "meal-planner-server.ps1",
  "README.txt",
  "Start Meal Planner.bat",
  "Start Meal Planner for Phones.bat",
  "Start Meal Planner From Drive.bat",
  "Start Bob and Mary's Meal Planner.bat",
  "Start Bob and Mary's Meal Planner for Phones.bat",
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

$rootStarterFiles = @(
  "Start Bob and Mary's Meal Planner.bat",
  "Start Bob and Mary's Meal Planner for Phones.bat"
)

foreach ($file in $rootStarterFiles) {
  $rootFile = Join-Path "E:\" $file
  if (Test-Path -LiteralPath $rootFile -PathType Leaf) {
    Copy-Item -LiteralPath $rootFile -Destination (Join-Path $backup $file) -Force
  }
  $sourceFile = Join-Path $source $file
  if (Test-Path -LiteralPath $sourceFile -PathType Leaf) {
    Copy-Item -LiteralPath $sourceFile -Destination $rootFile -Force
  }
}

$sourceImages = Join-Path $source "images"
$targetImages = Join-Path $target "images"
Copy-Item -Path (Join-Path $sourceImages "*") -Destination $targetImages -Recurse -Force

$dataFile = Join-Path $target "planner-data.json"
if (Test-Path -LiteralPath $dataFile -PathType Leaf) {
  Copy-Item -LiteralPath $dataFile -Destination (Join-Path $backup "planner-data-preserved-copy.json") -Force
}

$summary = [ordered]@{
  target = $target
  backup = $backup
  targetAppLength = (Get-Item -LiteralPath (Join-Path $target "app.js")).Length
  ingredientImageCount = (Get-ChildItem -LiteralPath (Join-Path $target "images\ingredients") -Filter "*.png" | Measure-Object).Count
  dataFilePreserved = (Test-Path -LiteralPath $dataFile -PathType Leaf)
  copiedAt = (Get-Date).ToString("s")
}

$summary | ConvertTo-Json
