$ErrorActionPreference = "Stop"

$imageDir = [System.IO.Path]::GetFullPath(
  (Join-Path $PSScriptRoot "..\outputs\meal-planner\images\ingredients")
)
$sourcePath = Join-Path $imageDir "IMAGE_SOURCES.json"
$baseUrl = "https://www.themealdb.com/images/ingredients"

$ingredients = [ordered]@{
  "chicken" = "Chicken"
  "whole_chicken" = "Chicken"
  "chicken_breast" = "Chicken Breast"
  "chicken_breasts" = "Chicken Breasts"
  "chicken_thighs" = "Chicken Thighs"
  "chicken_drumsticks" = "Chicken drumsticks"
  "chicken_legs" = "Chicken Legs"
  "chicken_wings" = "Chicken Wings"
  "ground_chicken" = "Ground Chicken"
  "chicken_liver" = "Chicken Liver"
  "pork" = "Pork"
  "ground_pork" = "Ground Pork"
  "minced_pork" = "Minced Pork"
  "pork_chops" = "Pork Chops"
  "pork_belly" = "Pork belly slices"
  "pork_shoulder" = "Pork Shoulder"
  "pork_steak" = "Pork Shoulder Steaks"
  "pork_tenderloin" = "Pork Tenderloin"
  "baby_back_ribs" = "Pork Back Ribs"
  "salmon" = "Salmon"
  "smoked_salmon" = "Smoked Salmon"
  "cod" = "Cod"
  "salt_cod" = "Salt Cod"
  "sea_bass" = "Sea Bass"
  "sea_bass_fillets" = "Sea Bass Fillets"
  "rainbow_trout" = "Rainbow Trout"
  "trout" = "Trout"
  "tuna" = "Tuna"
  "shrimp" = "Shrimp"
  "jumbo_shrimp" = "Jumbo Shrimp"
  "raw_shrimp" = "Raw tiger prawns"
  "prawns" = "Prawns"
  "mussels" = "Mussels"
  "oysters" = "Oysters"
  "squid" = "Squid"
  "calamari" = "Baby Squid"
  "lobster" = "Lobster"
  "crab" = "Crab Meay"
}

New-Item -ItemType Directory -Force -Path $imageDir | Out-Null
$sources = @()

foreach ($entry in $ingredients.GetEnumerator()) {
  $encodedName = [Uri]::EscapeDataString($entry.Value)
  $url = "$baseUrl/$encodedName.png"
  $destination = Join-Path $imageDir ($entry.Key + ".source.png")
  Write-Host ("Downloading {0}..." -f $entry.Key)
  try {
    Invoke-WebRequest -Uri $url -OutFile $destination -Headers @{
      "User-Agent" = "BobAndMaryMealPlanner/1.0"
    }
  } catch {
    Write-Warning ("TheMealDB has no downloadable photo for {0}" -f $entry.Key)
    continue
  }
  if ((Get-Item -LiteralPath $destination).Length -lt 1000) {
    Remove-Item -LiteralPath $destination -Force
    Write-Warning ("TheMealDB did not return a usable photo for {0}" -f $entry.Key)
    continue
  }
  $sources += [ordered]@{
    ingredient = $entry.Key
    sourceIngredient = $entry.Value
    source = $url
    downloadedAs = [System.IO.Path]::GetFileName($destination)
  }
  Start-Sleep -Milliseconds 200
}

$sources | ConvertTo-Json -Depth 4 |
  Set-Content -LiteralPath $sourcePath -Encoding UTF8

[ordered]@{
  requested = $ingredients.Count
  downloaded = $sources.Count
  attribution = $sourcePath
} | ConvertTo-Json
