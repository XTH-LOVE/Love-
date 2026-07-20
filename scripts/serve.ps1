$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
Set-Location $project

Get-Content (Join-Path $project '.env') | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}

$env:PORT = '3100'
$env:HOST = '127.0.0.1'
node .output/server/index.mjs
