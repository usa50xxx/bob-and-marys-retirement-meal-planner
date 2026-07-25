param(
  [switch]$NoBrowser,
  [switch]$ShareOnWifi
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataPath = Join-Path $root "planner-data.json"
$backupDir = Join-Path $root "backups"
$port = 8765
$listener = $null
$bindAddress = if ($ShareOnWifi) { [System.Net.IPAddress]::Any } else { [System.Net.IPAddress]::Loopback }

while ($port -lt 8795) {
  try {
    $listener = [System.Net.Sockets.TcpListener]::new($bindAddress, $port)
    $listener.Start()
    break
  } catch {
    $port++
  }
}

if ($null -eq $listener) {
  Write-Host "Could not start the meal planner website."
  Read-Host "Press Enter to close"
  exit 1
}

$url = "http://127.0.0.1:$port/index.html"
$phoneUrl = $null

if ($ShareOnWifi) {
  try {
    $phoneIp = Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown" } |
      Sort-Object InterfaceMetric |
      Select-Object -First 1 -ExpandProperty IPAddress
  } catch {
    $phoneIp = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
      Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and $_.IPAddressToString -notlike "127.*" } |
      Select-Object -First 1 -ExpandProperty IPAddressToString
  }

  if (-not [string]::IsNullOrWhiteSpace($phoneIp)) {
    $phoneUrl = "http://$($phoneIp):$port/index.html"
  }
}

if (-not $NoBrowser) {
  try {
    Start-Process $url
  } catch {
    Write-Host "If the browser did not open, type this address into the browser:"
    Write-Host $url
  }
}
Write-Host ""
Write-Host "Meal Planner is running at $url"
if ($phoneUrl) {
  Write-Host "Phone view on the same Wi-Fi: $phoneUrl"
  Write-Host "Use the iPhone or Android button at the top of the page."
}
Write-Host "Keep this window open while you use it."
Write-Host "Close this window when you are done."
Write-Host ""

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".mjs" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".txt" = "text/plain; charset=utf-8"
  ".png" = "image/png"
  ".webp" = "image/webp"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg" = "image/svg+xml"
  ".ico" = "image/x-icon"
  ".wasm" = "application/wasm"
  ".gz" = "application/gzip"
}

function Get-RequestPath($requestLine) {
  if ($requestLine -notmatch "^\w+\s+([^\s]+)") {
    return "index.html"
  }

  $path = [Uri]::UnescapeDataString($Matches[1].Split("?")[0]).TrimStart("/")
  if ([string]::IsNullOrWhiteSpace($path)) {
    return "index.html"
  }

  return $path.Replace("/", [System.IO.Path]::DirectorySeparatorChar)
}

function Send-Response($stream, $status, $contentType, $bodyBytes, $extraHeaders = @{}) {
  $additional = ""
  foreach ($name in $extraHeaders.Keys) {
    $safeName = ([string]$name) -replace "[^A-Za-z0-9-]", ""
    $safeValue = ([string]$extraHeaders[$name]) -replace "[\r\n]", " "
    if ($safeName) { $additional += "$safeName`: $safeValue`r`n" }
  }
  $header = "HTTP/1.1 $status`r`nContent-Length: $($bodyBytes.Length)`r`nContent-Type: $contentType`r`nAccess-Control-Allow-Origin: *`r`n$additional" + "Connection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  $stream.Write($bodyBytes, 0, $bodyBytes.Length)
}

function Send-JsonResponse($stream, $status, $value) {
  $json = $value | ConvertTo-Json -Compress -Depth 20
  Send-Response $stream $status "application/json; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes($json))
}

function ConvertFrom-PlannerBytes($bytes) {
  try {
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    $data = $text | ConvertFrom-Json
    if ($null -eq $data -or $null -eq $data.recipes -or $data.recipes.Count -lt 1) { return $null }
    return $data
  } catch {
    return $null
  }
}

function Test-PlannerFile($path) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $false }
  return $null -ne (ConvertFrom-PlannerBytes ([System.IO.File]::ReadAllBytes($path)))
}

function New-PlannerBackup([switch]$Force) {
  if (-not (Test-PlannerFile $dataPath)) { return $null }
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  $latest = Get-ChildItem -LiteralPath $backupDir -Filter "planner-data-*.json" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $Force -and $latest -and $latest.LastWriteTime -gt (Get-Date).AddMinutes(-1)) {
    return $latest
  }

  $stamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
  $backupPath = Join-Path $backupDir "planner-data-$stamp.json"
  Copy-Item -LiteralPath $dataPath -Destination $backupPath -Force
  return Get-Item -LiteralPath $backupPath
}

function Get-BackupItems {
  if (-not (Test-Path -LiteralPath $backupDir -PathType Container)) { return @() }
  return @(
    Get-ChildItem -LiteralPath $backupDir -Filter "planner-data-*.json" |
      Sort-Object LastWriteTime -Descending |
      ForEach-Object {
        $data = ConvertFrom-PlannerBytes ([System.IO.File]::ReadAllBytes($_.FullName))
        if ($data) {
          [ordered]@{
            name = $_.Name
            createdAt = $_.LastWriteTimeUtc.ToString("o")
            savedAt = [string]$data.savedAt
            recipes = @($data.recipes).Count
            size = $_.Length
          }
        }
      }
  )
}

function Restore-PlannerFile($sourcePath) {
  if (-not (Test-PlannerFile $sourcePath)) { throw "That backup could not be read." }
  New-PlannerBackup -Force | Out-Null
  $restoreTemp = Join-Path $root ("planner-data-restore-{0}.tmp" -f [Guid]::NewGuid().ToString("N"))
  Copy-Item -LiteralPath $sourcePath -Destination $restoreTemp -Force
  if (Test-Path -LiteralPath $dataPath -PathType Leaf) {
    try {
      [System.IO.File]::Replace($restoreTemp, $dataPath, $null, $true)
    } catch {
      Move-Item -LiteralPath $restoreTemp -Destination $dataPath -Force
    }
  } else {
    Move-Item -LiteralPath $restoreTemp -Destination $dataPath
  }
  return [System.IO.File]::ReadAllBytes($dataPath)
}

function Get-PlannerDataForRead {
  if (Test-PlannerFile $dataPath) {
    return @{ bytes = [System.IO.File]::ReadAllBytes($dataPath); recovered = $false; source = "" }
  }

  $candidates = @()
  $candidates += Get-ChildItem -LiteralPath $root -Filter "planner-data-*.tmp" -ErrorAction SilentlyContinue
  $candidates += Get-ChildItem -LiteralPath $backupDir -Filter "planner-data-*.json" -ErrorAction SilentlyContinue
  $candidate = $candidates |
    Sort-Object LastWriteTime -Descending |
    Where-Object { Test-PlannerFile $_.FullName } |
    Select-Object -First 1
  if (-not $candidate) { return @{ bytes = [System.Text.Encoding]::UTF8.GetBytes("{}"); recovered = $false; source = "" } }

  $bytes = Restore-PlannerFile $candidate.FullName
  Get-ChildItem -LiteralPath $root -Filter "planner-data-*.tmp" -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue
  return @{ bytes = $bytes; recovered = $true; source = $candidate.Name }
}

function Read-RequestBody($reader, $headers, $maximum = 52428800) {
  $contentLength = 0
  if ($headers.ContainsKey("content-length")) {
    [int]::TryParse($headers["content-length"], [ref]$contentLength) | Out-Null
  }
  if ($contentLength -le 0 -or $contentLength -gt $maximum) {
    throw "Invalid data size."
  }

  $buffer = New-Object char[] $contentLength
  $read = 0
  while ($read -lt $contentLength) {
    $next = $reader.Read($buffer, $read, $contentLength - $read)
    if ($next -le 0) { throw "The request ended before all data arrived." }
    $read += $next
  }
  return -join $buffer
}

function Test-PublicRecipeAddress([System.Net.IPAddress]$address) {
  if ([System.Net.IPAddress]::IsLoopback($address)) { return $false }
  if ($address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork) {
    $bytes = $address.GetAddressBytes()
    if ($bytes[0] -eq 0 -or $bytes[0] -eq 10 -or $bytes[0] -eq 127 -or $bytes[0] -ge 224) { return $false }
    if ($bytes[0] -eq 169 -and $bytes[1] -eq 254) { return $false }
    if ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) { return $false }
    if ($bytes[0] -eq 192 -and $bytes[1] -eq 168) { return $false }
    return $true
  }

  if ($address.IsIPv6LinkLocal -or $address.IsIPv6SiteLocal -or $address.IsIPv6Multicast) { return $false }
  $first = $address.GetAddressBytes()[0]
  return (($first -band 0xFE) -ne 0xFC)
}

function Assert-PublicRecipeUri([Uri]$uri) {
  if ($uri.Scheme -ne "https") {
    throw "Use a secure recipe website link beginning with https."
  }
  if ([string]::IsNullOrWhiteSpace($uri.DnsSafeHost) -or $uri.DnsSafeHost -eq "localhost") {
    throw "That recipe address is not allowed."
  }

  $addresses = [System.Net.Dns]::GetHostAddresses($uri.DnsSafeHost)
  if (-not $addresses.Count -or ($addresses | Where-Object { -not (Test-PublicRecipeAddress $_) })) {
    throw "That recipe address is not allowed."
  }
}

function Read-RecipePage([string]$url) {
  Add-Type -AssemblyName System.Net.Http
  $handler = [System.Net.Http.HttpClientHandler]::new()
  $handler.AllowAutoRedirect = $false
  $handler.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds(18)
  $client.DefaultRequestHeaders.UserAgent.ParseAdd("BobAndMaryMealPlanner/0.9")
  $current = [Uri]$url

  try {
    for ($redirect = 0; $redirect -le 4; $redirect++) {
      Assert-PublicRecipeUri $current
      $response = $client.GetAsync($current, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
      try {
        $statusCode = [int]$response.StatusCode
        if ($statusCode -ge 300 -and $statusCode -lt 400 -and $response.Headers.Location) {
          $current = [Uri]::new($current, $response.Headers.Location)
          continue
        }
        if (-not $response.IsSuccessStatusCode) {
          throw "The recipe website returned an error."
        }

        $contentLength = $response.Content.Headers.ContentLength
        if ($contentLength -and $contentLength -gt 2097152) {
          throw "That recipe page is too large to read safely."
        }
        $mediaType = [string]$response.Content.Headers.ContentType.MediaType
        if ($mediaType -and $mediaType -notmatch "^(text/html|application/xhtml\+xml|text/plain)$") {
          throw "That link is not a readable recipe page."
        }

        $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
        if ($bytes.Length -gt 2097152) {
          throw "That recipe page is too large to read safely."
        }
        $encoding = [System.Text.Encoding]::UTF8
        $charset = [string]$response.Content.Headers.ContentType.CharSet
        if (-not [string]::IsNullOrWhiteSpace($charset)) {
          try { $encoding = [System.Text.Encoding]::GetEncoding($charset.Trim('"')) } catch {}
        }
        return @{
          html = $encoding.GetString($bytes)
          finalUrl = $current.AbsoluteUri
        }
      } finally {
        $response.Dispose()
      }
    }
    throw "That recipe website redirected too many times."
  } finally {
    $client.Dispose()
    $handler.Dispose()
  }
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream)
    $requestLine = $reader.ReadLine()
    $headers = @{}

    while ($reader.Peek() -ge 0) {
      $line = $reader.ReadLine()
      if ([string]::IsNullOrEmpty($line)) { break }
      $parts = $line.Split(":", 2)
      if ($parts.Length -eq 2) {
        $headers[$parts[0].Trim().ToLowerInvariant()] = $parts[1].Trim()
      }
    }

    $method = "GET"
    if ($requestLine -match "^(\w+)\s+") {
      $method = $Matches[1].ToUpperInvariant()
    }

    if ($requestLine -match "^\w+\s+(/[^\s]*)" -and $Matches[1].Split("?")[0] -eq "/api/backups") {
      try {
        if ($method -eq "POST") {
          $created = New-PlannerBackup -Force
          if (-not $created) { throw "Save the planner once before creating a backup." }
        } elseif ($method -ne "GET") {
          throw "That backup action is not supported."
        }
        Send-JsonResponse $stream "200 OK" @{ backups = @(Get-BackupItems) }
      } catch {
        Send-JsonResponse $stream "400 Bad Request" @{ error = [string]$_.Exception.Message }
      }
      $client.Close()
      continue
    }

    if ($requestLine -match "^\w+\s+(/[^\s]*)" -and $Matches[1].Split("?")[0] -eq "/api/restore") {
      try {
        if ($method -ne "POST") { throw "Only a selected backup can be restored." }
        $body = Read-RequestBody $reader $headers 1048576
        $request = $body | ConvertFrom-Json
        $name = [string]$request.name
        if ($name -notmatch "^planner-data-\d{8}-\d{6}(?:-\d{3})?\.json$" -or $name -ne [System.IO.Path]::GetFileName($name)) {
          throw "That backup name is not allowed."
        }
        $backupPath = Join-Path $backupDir $name
        $restoredBytes = Restore-PlannerFile $backupPath
        $restoredData = ConvertFrom-PlannerBytes $restoredBytes
        Send-JsonResponse $stream "200 OK" @{ restored = $true; data = $restoredData }
      } catch {
        Send-JsonResponse $stream "400 Bad Request" @{ error = [string]$_.Exception.Message }
      }
      $client.Close()
      continue
    }

    if ($requestLine -match "^\w+\s+(/[^\s]*)" -and $Matches[1].Split("?")[0] -eq "/api/recipe") {
      if ($method -ne "GET") {
        Send-JsonResponse $stream "405 Method Not Allowed" @{ error = "Only recipe links can be read here." }
        $client.Close()
        continue
      }

      try {
        $target = $Matches[1]
        $urlMatch = [regex]::Match($target, "(?:\?|&)url=([^&]+)")
        if (-not $urlMatch.Success) { throw "Enter a recipe website link first." }
        $recipeUrl = [Uri]::UnescapeDataString($urlMatch.Groups[1].Value)
        Send-JsonResponse $stream "200 OK" (Read-RecipePage $recipeUrl)
      } catch {
        Send-JsonResponse $stream "400 Bad Request" @{ error = [string]$_.Exception.Message }
      }
      $client.Close()
      continue
    }

    if ($requestLine -match "^\w+\s+(/[^\s]*)" -and $Matches[1].Split("?")[0] -eq "/api/data") {
      if ($method -eq "GET") {
        $readResult = Get-PlannerDataForRead
        $recoveryHeaders = if ($readResult.recovered) {
          @{ "X-Meal-Planner-Recovered" = "true"; "X-Meal-Planner-Recovery-Source" = $readResult.source }
        } else { @{} }
        Send-Response $stream "200 OK" "application/json; charset=utf-8" $readResult.bytes $recoveryHeaders
        $client.Close()
        continue
      }

      if ($method -eq "POST") {
        $tempPath = Join-Path $root ("planner-data-{0}.tmp" -f [Guid]::NewGuid().ToString("N"))
        try {
          $body = Read-RequestBody $reader $headers
          $parsedBody = $body | ConvertFrom-Json
          if ($null -eq $parsedBody -or $null -eq $parsedBody.recipes -or $parsedBody.recipes.Count -lt 1) {
            throw "Planner data must contain at least one recipe."
          }

          $utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
          [System.IO.File]::WriteAllText($tempPath, $body, $utf8WithoutBom)
          New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
          if (Test-Path -LiteralPath $dataPath -PathType Leaf) {
            New-PlannerBackup | Out-Null
            try {
              [System.IO.File]::Replace($tempPath, $dataPath, $null, $true)
            } catch {
              Move-Item -LiteralPath $tempPath -Destination $dataPath -Force
            }
          } else {
            Move-Item -LiteralPath $tempPath -Destination $dataPath
          }

          Get-ChildItem -LiteralPath $backupDir -Filter "planner-data-*.json" |
            Sort-Object LastWriteTime -Descending |
            Select-Object -Skip 50 |
            Remove-Item -Force
          Send-JsonResponse $stream "200 OK" @{ saved = $true; savedAt = [string]$parsedBody.savedAt }
        } catch {
          if (Test-Path -LiteralPath $tempPath -PathType Leaf) {
            Remove-Item -LiteralPath $tempPath -Force
          }
          Send-JsonResponse $stream "400 Bad Request" @{ saved = $false; error = [string]$_.Exception.Message }
        }
        $client.Close()
        continue
      }
    }

    $relativePath = Get-RequestPath $requestLine
    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))
    $rootPath = [System.IO.Path]::GetFullPath($root)

    if (-not $fullPath.StartsWith($rootPath) -or -not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
      Send-Response $stream "404 Not Found" "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("Not found"))
      $client.Close()
      continue
    }

    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
    $contentType = $mimeTypes[$extension]
    if ([string]::IsNullOrWhiteSpace($contentType)) {
      $contentType = "application/octet-stream"
    }

    Send-Response $stream "200 OK" $contentType $bytes
    $client.Close()
  }
} finally {
  if ($listener) {
    $listener.Stop()
  }
}
