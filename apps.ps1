param([string]$Extension)

# Собирает приложения из системного списка «Открыть с помощью» для расширения.
$ErrorActionPreference = 'SilentlyContinue'
$list = New-Object System.Collections.ArrayList
$seen = @{}

function Resolve-AppPath([string]$candidate) {
  if ([string]::IsNullOrWhiteSpace($candidate)) { return '' }
  $value = $candidate.Trim().Trim('"')
  if ($value -like '*%*') { $value = [Environment]::ExpandEnvironmentVariables($value) }
  if ($value -match '^[a-zA-Z]:') {
    if (Test-Path -LiteralPath $value) { return $value }
  }
  $command = Get-Command $value -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($command -ne $null -and $command.Source) { return $command.Source }
  $appKey = "Registry::HKEY_CLASSES_ROOT\Applications\$value\shell\open\command"
  if (Test-Path -LiteralPath $appKey) {
    $cmd = (Get-ItemProperty -LiteralPath $appKey -ErrorAction SilentlyContinue).'(default)'
    if ($cmd -match '"([^"]+\.exe)"') { return $matches[1] }
    if ($cmd -match '^([^\s]+\.exe)') { return $matches[1] }
  }
  $appPathKey = "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$value"
  if (Test-Path -LiteralPath $appPathKey) {
    $cmd = (Get-ItemProperty -LiteralPath $appPathKey -ErrorAction SilentlyContinue).'(default)'
    if ($cmd) { return $cmd.Trim('"') }
  }
  return ''
}

function Add-App([string]$candidate) {
  $path = Resolve-AppPath $candidate
  if ($path -eq '') { return }
  if (-not $path.ToLower().EndsWith('.exe')) { return }
  if (-not (Test-Path -LiteralPath $path)) { return }
  $key = $path.ToLower()
  if ($seen.ContainsKey($key)) { return }
  $seen[$key] = $true
  $name = [System.IO.Path]::GetFileNameWithoutExtension($path)
  try {
    $info = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($path)
    if (-not [string]::IsNullOrWhiteSpace($info.FileDescription)) { $name = $info.FileDescription }
  } catch { }
  [void]$list.Add([pscustomobject]@{ path = $path; name = $name })
}

# 1. Список «Открыть с помощью» в HKCR.
$owKey = "Registry::HKEY_CLASSES_ROOT\$Extension\OpenWithList"
if (Test-Path -LiteralPath $owKey) {
  $item = Get-Item -LiteralPath $owKey
  foreach ($prop in $item.Property) {
    if ($prop -match '^[a-zA-Z]$') { Add-App ([string](Get-ItemProperty -LiteralPath $owKey).$prop) }
  }
}

# 2. Список «Открыть с помощью» в профиле пользователя.
$owUser = "Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$Extension\OpenWithList"
if (Test-Path -LiteralPath $owUser) {
  $item = Get-Item -LiteralPath $owUser
  foreach ($prop in $item.Property) {
    if ($prop -match '^[a-zA-Z]$') { Add-App ([string](Get-ItemProperty -LiteralPath $owUser).$prop) }
  }
}

# 3. Приложения, объявившие поддержку этого расширения.
foreach ($app in (Get-ChildItem -LiteralPath 'Registry::HKEY_CLASSES_ROOT\Applications' -ErrorAction SilentlyContinue)) {
  $supported = (Get-ItemProperty -LiteralPath $app.PSPath -ErrorAction SilentlyContinue).SupportedTypes
  if ($supported -ne $null -and ($supported -contains $Extension)) { Add-App $app.PSChildName }
}

# 4. ProgID, связанные с расширением.
$progIdKey = "Registry::HKEY_CLASSES_ROOT\$Extension\OpenWithProgids"
if (Test-Path -LiteralPath $progIdKey) {
  $item = Get-Item -LiteralPath $progIdKey
  foreach ($prop in $item.Property) {
    $cmdKey = "Registry::HKEY_CLASSES_ROOT\$prop\shell\open\command"
    if (Test-Path -LiteralPath $cmdKey) {
      $cmd = (Get-ItemProperty -LiteralPath $cmdKey -ErrorAction SilentlyContinue).'(default)'
      if ($cmd -match '"([^"]+\.exe)"') { Add-App $matches[1] }
    }
  }
}

# 5. Значение по умолчанию для расширения.
$defaultKey = "Registry::HKEY_CLASSES_ROOT\$Extension\shell\open\command"
if (Test-Path -LiteralPath $defaultKey) {
  $cmd = (Get-ItemProperty -LiteralPath $defaultKey -ErrorAction SilentlyContinue).'(default)'
  if ($cmd -match '"([^"]+\.exe)"') { Add-App $matches[1] }
}

$list | ConvertTo-Json -Compress
