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
  ".json" = "application/json; charset=utf-8"
  ".txt" = "text/plain; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg" = "image/svg+xml"
  ".ico" = "image/x-icon"
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

function Send-Response($stream, $status, $contentType, $bodyBytes) {
  $header = "HTTP/1.1 $status`r`nContent-Length: $($bodyBytes.Length)`r`nContent-Type: $contentType`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  $stream.Write($bodyBytes, 0, $bodyBytes.Length)
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

    if ($requestLine -match "^\w+\s+(/[^\s]*)" -and $Matches[1].Split("?")[0] -eq "/api/data") {
      if ($method -eq "GET") {
        if (Test-Path -LiteralPath $dataPath -PathType Leaf) {
          Send-Response $stream "200 OK" "application/json; charset=utf-8" ([System.IO.File]::ReadAllBytes($dataPath))
        } else {
          Send-Response $stream "200 OK" "application/json; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("{}"))
        }
        $client.Close()
        continue
      }

      if ($method -eq "POST") {
        $contentLength = 0
        if ($headers.ContainsKey("content-length")) {
          [int]::TryParse($headers["content-length"], [ref]$contentLength) | Out-Null
        }

        $buffer = New-Object char[] $contentLength
        $read = 0
        while ($read -lt $contentLength) {
          $read += $reader.Read($buffer, $read, $contentLength - $read)
        }

        $body = -join $buffer
        $body | ConvertFrom-Json | Out-Null
        if (Test-Path -LiteralPath $dataPath -PathType Leaf) {
          New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
          $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
          Copy-Item -LiteralPath $dataPath -Destination (Join-Path $backupDir "planner-data-$stamp.json") -Force
          Get-ChildItem -LiteralPath $backupDir -Filter "planner-data-*.json" |
            Sort-Object LastWriteTime -Descending |
            Select-Object -Skip 25 |
            Remove-Item -Force
        }
        [System.IO.File]::WriteAllText($dataPath, $body, [System.Text.Encoding]::UTF8)
        Send-Response $stream "200 OK" "application/json; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("{""saved"":true}"))
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
