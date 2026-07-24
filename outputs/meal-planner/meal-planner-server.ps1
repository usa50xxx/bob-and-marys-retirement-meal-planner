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

function Send-Response($stream, $status, $contentType, $bodyBytes) {
  $header = "HTTP/1.1 $status`r`nContent-Length: $($bodyBytes.Length)`r`nContent-Type: $contentType`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  $stream.Write($bodyBytes, 0, $bodyBytes.Length)
}

function Send-JsonResponse($stream, $status, $value) {
  $json = $value | ConvertTo-Json -Compress -Depth 5
  Send-Response $stream $status "application/json; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes($json))
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
  if ($uri.Scheme -notin @("http", "https")) {
    throw "Use a recipe link beginning with http or https."
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

        if ($contentLength -le 0 -or $contentLength -gt 52428800) {
          Send-Response $stream "413 Payload Too Large" "application/json; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("{""saved"":false,""error"":""Invalid data size""}"))
          $client.Close()
          continue
        }

        $buffer = New-Object char[] $contentLength
        $read = 0
        while ($read -lt $contentLength) {
          $read += $reader.Read($buffer, $read, $contentLength - $read)
        }

        $tempPath = Join-Path $root ("planner-data-{0}.tmp" -f [Guid]::NewGuid().ToString("N"))
        try {
          $body = -join $buffer
          $parsedBody = $body | ConvertFrom-Json
          if ($null -eq $parsedBody -or $null -eq $parsedBody.recipes -or $parsedBody.recipes.Count -lt 1) {
            throw "Planner data must contain at least one recipe."
          }

          $utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
          [System.IO.File]::WriteAllText($tempPath, $body, $utf8WithoutBom)
          New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
          $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
          $backupPath = Join-Path $backupDir "planner-data-$stamp.json"
          if (Test-Path -LiteralPath $dataPath -PathType Leaf) {
            Copy-Item -LiteralPath $dataPath -Destination $backupPath -Force
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
            Select-Object -Skip 25 |
            Remove-Item -Force
          Send-Response $stream "200 OK" "application/json; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("{""saved"":true}"))
        } catch {
          if (Test-Path -LiteralPath $tempPath -PathType Leaf) {
            Remove-Item -LiteralPath $tempPath -Force
          }
          Send-Response $stream "400 Bad Request" "application/json; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("{""saved"":false,""error"":""Invalid planner data""}"))
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
