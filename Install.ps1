param([switch]$Quiet)
$ErrorActionPreference = 'Stop'
$setup = Join-Path $PSScriptRoot 'dist/Setup Effect Master.exe'
if (-not (Test-Path -LiteralPath $setup)) { throw 'Build the palette with tools/Build-Palette.ps1 first.' }
if ($Quiet) { & $setup --install --quiet } else { & $setup }
