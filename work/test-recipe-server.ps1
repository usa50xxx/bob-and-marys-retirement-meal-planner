param(
  [string]$RecipeUrl = "https://schema.org/Recipe"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$serverScript = Join-Path $root "outputs\meal-planner\meal-planner-server.ps1"
$temporaryDirectory = [System.IO.Path]::GetTempPath()
$outFile = Join-Path $temporaryDirectory "bob-mary-recipe-server-out.txt"
$errFile = Join-Path $temporaryDirectory "bob-mary-recipe-server-err.txt"
Remove-Item -LiteralPath $outFile, $errFile -Force -ErrorAction SilentlyContinue

$isWindowsPlatform = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
$startParameters = @{
  FilePath = if ($isWindowsPlatform) { "powershell" } else { "pwsh" }
  ArgumentList = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$serverScript`"",
    "-NoBrowser"
  )
  RedirectStandardOutput = $outFile
  RedirectStandardError = $errFile
  PassThru = $true
}
if ($isWindowsPlatform) {
  $startParameters.WindowStyle = "Hidden"
}
$process = Start-Process @startParameters

try {
  $homeUrl = $null
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 250
    if (Test-Path -LiteralPath $outFile) {
      $output = Get-Content -LiteralPath $outFile -Raw -ErrorAction SilentlyContinue
      if ($output -match "http://127\.0\.0\.1:\d+/index\.html") {
        $homeUrl = $Matches[0]
        break
      }
    }
    if ($process.HasExited) { break }
  }
  if (-not $homeUrl) {
    $details = Get-Content -LiteralPath $errFile -Raw -ErrorAction SilentlyContinue
    throw "The portable server did not start. $details"
  }

  $baseUrl = $homeUrl -replace "/index\.html$", ""
  $encoded = [Uri]::EscapeDataString($RecipeUrl)
  $recipeResponse = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/recipe?url=$encoded" -TimeoutSec 30
  $payload = $recipeResponse.Content | ConvertFrom-Json

  $privateBlocked = $false
  try {
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/recipe?url=$([Uri]::EscapeDataString('https://127.0.0.1/'))" -TimeoutSec 10 | Out-Null
  } catch {
    $privateBlocked = $_.Exception.Response.StatusCode.value__ -eq 400
  }

  $unencryptedBlocked = $false
  try {
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/recipe?url=$([Uri]::EscapeDataString('http://example.com/recipe'))" -TimeoutSec 10 | Out-Null
  } catch {
    $unencryptedBlocked = $_.Exception.Response.StatusCode.value__ -eq 400
  }

  if (-not $payload.html -or $payload.html.Length -lt 100) { throw "The recipe page body was empty." }
  if (-not $privateBlocked) { throw "Private network recipe addresses were not blocked." }
  if (-not $unencryptedBlocked) { throw "Unencrypted recipe addresses were not blocked." }

  [ordered]@{
    passed = $true
    recipeStatus = [int]$recipeResponse.StatusCode
    finalUrl = $payload.finalUrl
    htmlCharacters = $payload.html.Length
    privateAddressBlocked = $privateBlocked
    unencryptedAddressBlocked = $unencryptedBlocked
  } | ConvertTo-Json
} finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}
