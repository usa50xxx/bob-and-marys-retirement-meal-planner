$ErrorActionPreference = "Stop"

function Assert-True($condition, $message) {
  if (-not $condition) { throw $message }
}

function New-Planner($name, $savedAt) {
  return [ordered]@{
    schemaVersion = 5
    savedAt = $savedAt
    recipes = @(
      [ordered]@{
        id = $name.ToLowerInvariant().Replace(" ", "-")
        name = $name
        baseServings = 2
        notes = "Test recipe"
        photo = ""
        ingredients = @(
          [ordered]@{ amount = 1; unit = "cup"; name = "milk" }
        )
      }
    )
    foodStorage = [ordered]@{ refrigerator = @(); freezer = @(); pantry = @() }
    builderTemplates = @{}
    mealCostHistory = @()
    weeklyPlan = @{}
  }
}

function Send-Planner($baseUrl, $planner) {
  $json = $planner | ConvertTo-Json -Depth 20 -Compress
  return Invoke-WebRequest `
    -UseBasicParsing `
    -Uri "$baseUrl/api/data" `
    -Method Post `
    -ContentType "application/json" `
    -Body ([System.Text.Encoding]::ASCII.GetBytes($json))
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$serverSource = Join-Path $repoRoot "outputs\meal-planner\meal-planner-server.ps1"
$tempBase = [System.IO.Path]::GetTempPath()
$tempRoot = Join-Path $tempBase ("bob-mary-server-test-" + [Guid]::NewGuid().ToString("N"))
$serverProcess = $null

try {
  New-Item -ItemType Directory -Path $tempRoot | Out-Null
  $serverPath = Join-Path $tempRoot "meal-planner-server.ps1"
  $stdoutPath = Join-Path $tempRoot "server.stdout.txt"
  $stderrPath = Join-Path $tempRoot "server.stderr.txt"
  Copy-Item -LiteralPath $serverSource -Destination $serverPath

  $powerShellExecutable = (Get-Process -Id $PID).Path
  $startParameters = @{
    FilePath = $powerShellExecutable
    ArgumentList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $serverPath, "-NoBrowser")
    PassThru = $true
    RedirectStandardOutput = $stdoutPath
    RedirectStandardError = $stderrPath
  }
  if ($PSVersionTable.PSEdition -eq "Desktop" -or $IsWindows) {
    $startParameters.WindowStyle = "Hidden"
  }
  $serverProcess = Start-Process @startParameters

  $baseUrl = $null
  for ($attempt = 0; $attempt -lt 100 -and -not $baseUrl; $attempt++) {
    Start-Sleep -Milliseconds 100
    if ($serverProcess.HasExited) {
      throw "The test server stopped early. $(Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue)"
    }
    $output = Get-Content -LiteralPath $stdoutPath -Raw -ErrorAction SilentlyContinue
    if ($output -match "Meal Planner is running at (http://127\.0\.0\.1:\d+)") {
      $baseUrl = $Matches[1]
    }
  }
  Assert-True $baseUrl "The test server did not report its address."

  $plannerA = New-Planner "First safe supper" "2026-07-24T12:00:00.000Z"
  $plannerB = New-Planner "Second safe supper" "2026-07-24T12:05:00.000Z"
  $plannerC = New-Planner "Interrupted safe supper" "2026-07-24T12:10:00.000Z"

  $saveA = Send-Planner $baseUrl $plannerA
  $saveB = Send-Planner $baseUrl $plannerB
  Assert-True ($saveA.StatusCode -eq 200 -and $saveB.StatusCode -eq 200) "Planner saves did not succeed."

  $backupResponse = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/backups"
  $backupPayload = $backupResponse.Content | ConvertFrom-Json
  Assert-True (@($backupPayload.backups).Count -ge 1) "The first safe save was not backed up."
  $firstBackup = @($backupPayload.backups)[0]

  $restoreBody = @{ name = $firstBackup.name } | ConvertTo-Json -Compress
  $restoreResponse = Invoke-WebRequest `
    -UseBasicParsing `
    -Uri "$baseUrl/api/restore" `
    -Method Post `
    -ContentType "application/json" `
    -Body ([System.Text.Encoding]::ASCII.GetBytes($restoreBody))
  $restorePayload = $restoreResponse.Content | ConvertFrom-Json
  Assert-True ($restorePayload.data.recipes[0].name -eq "First safe supper") "The selected automatic backup was not restored."

  $dataPath = Join-Path $tempRoot "planner-data.json"
  $pendingPath = Join-Path $tempRoot "planner-data-interrupted.tmp"
  [System.IO.File]::WriteAllText($dataPath, "{not valid json", [System.Text.UTF8Encoding]::new($false))
  $pendingJson = $plannerC | ConvertTo-Json -Depth 20 -Compress
  [System.IO.File]::WriteAllText($pendingPath, $pendingJson, [System.Text.UTF8Encoding]::new($false))
  (Get-Item -LiteralPath $pendingPath).LastWriteTimeUtc = (Get-Date).ToUniversalTime().AddMinutes(1)

  $recoveredResponse = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/data"
  $recoveredPlanner = $recoveredResponse.Content | ConvertFrom-Json
  Assert-True ($recoveredResponse.Headers["X-Meal-Planner-Recovered"] -eq "true") "Interrupted-save recovery was not reported."
  Assert-True ($recoveredPlanner.recipes[0].name -eq "Interrupted safe supper") "The newest valid interrupted save was not recovered."
  Assert-True ((Get-Content -LiteralPath $dataPath -Raw | ConvertFrom-Json).recipes[0].name -eq "Interrupted safe supper") "Recovered data was not made current."
  Assert-True (-not (Test-Path -LiteralPath $pendingPath)) "The promoted interrupted-save file was not cleaned up."

  [ordered]@{
    passed = $true
    server = $baseUrl
    automaticBackups = @($backupPayload.backups).Count
    restoredRecipe = $restorePayload.data.recipes[0].name
    interruptedRecipe = $recoveredPlanner.recipes[0].name
  } | ConvertTo-Json
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    $serverProcess.WaitForExit()
  }
  $resolvedTempBase = [System.IO.Path]::GetFullPath($tempBase)
  $resolvedTempRoot = [System.IO.Path]::GetFullPath($tempRoot)
  if (
    $resolvedTempRoot.StartsWith($resolvedTempBase, [System.StringComparison]::OrdinalIgnoreCase) -and
    [System.IO.Path]::GetFileName($resolvedTempRoot).StartsWith("bob-mary-server-test-")
  ) {
    Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
