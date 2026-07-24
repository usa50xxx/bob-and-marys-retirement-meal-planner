param(
  [switch]$ShareOnWifi
)

$ErrorActionPreference = "Stop"

$serverScript = "E:\Meal Planner\meal-planner-server.ps1"
$outFile = "C:\Users\usa50\Documents\Codex\2026-07-23\i-want-to-create-a-new\work\e-server-test-out.txt"
$errFile = "C:\Users\usa50\Documents\Codex\2026-07-23\i-want-to-create-a-new\work\e-server-test-err.txt"

if (-not (Test-Path -LiteralPath $serverScript -PathType Leaf)) {
  throw "Server script was not found on E:."
}

Remove-Item -LiteralPath $outFile, $errFile -Force -ErrorAction SilentlyContinue

$arguments = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$serverScript`"",
  "-NoBrowser"
)

if ($ShareOnWifi) {
  $arguments += "-ShareOnWifi"
}

$process = Start-Process -FilePath "powershell" -ArgumentList $arguments -WindowStyle Hidden -RedirectStandardOutput $outFile -RedirectStandardError $errFile -PassThru

try {
  $url = $null
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 300
    if (Test-Path -LiteralPath $outFile) {
      $text = Get-Content -LiteralPath $outFile -Raw -ErrorAction SilentlyContinue
      if ($text -match "http://127\.0\.0\.1:\d+/index\.html") {
        $url = $Matches[0]
        break
      }
    }
    if ($process.HasExited) {
      break
    }
  }

  if (-not $url) {
    $errorText = if (Test-Path -LiteralPath $errFile) { Get-Content -LiteralPath $errFile -Raw } else { "" }
    throw "The server did not report a URL. $errorText"
  }

  $homeResponse = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 10
  $data = Invoke-WebRequest -UseBasicParsing -Uri ($url -replace "/index\.html$", "/api/data") -TimeoutSec 10

  [ordered]@{
    url = $url
    shareOnWifi = [bool]$ShareOnWifi
    phoneUrlFound = if ($ShareOnWifi) { ($text -match "Phone view on the same Wi-Fi: http://") } else { $false }
    homeStatus = [int]$homeResponse.StatusCode
    titleFound = ($homeResponse.Content -match "Bob and Mary's Retirement Meal Planner")
    dataStatus = [int]$data.StatusCode
    dataLooksJson = ($data.Content.Trim().StartsWith("{"))
    processStillRunning = (-not $process.HasExited)
  } | ConvertTo-Json
} finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}
