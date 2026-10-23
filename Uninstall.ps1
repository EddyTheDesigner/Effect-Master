param([switch]$WhatIf)
$ErrorActionPreference = 'Stop'
$installDir = Join-Path $env:LOCALAPPDATA 'EffectMaster'
$executable = Join-Path $installDir 'Effect Master.exe'
$config = Join-Path $env:APPDATA 'EffectMaster'
$receiptPath = Join-Path $config 'installation.json'
if (-not (Test-Path -LiteralPath $receiptPath)) { throw 'No Effect Master installation receipt was found.' }
$receipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
if ($WhatIf) {
    Write-Host "Would remove the palette at $executable, its two shortcuts, and restore previous connection settings and the previous EffectCraft panel."
    Write-Host "Settings and backups at $config, project artwork, and generated PNG assets will remain."
    return
}
if (Get-Process -Name 'Effect Master' -ErrorAction SilentlyContinue | Where-Object { $_.Path -ieq $executable }) { throw 'Close the Effect Master palette before uninstalling.' }
foreach ($entry in @(@('VECTORCRAFT_CONTROL_PORT','vectorPort','originalVectorPort'), @('EFFECTCRAFT_CONTROL_PORT','effectPort','originalEffectPort'))) {
    $current = [Environment]::GetEnvironmentVariable($entry[0], 'User')
    if ($current -eq [string]$receipt.($entry[1])) { [Environment]::SetEnvironmentVariable($entry[0], $receipt.($entry[2]), 'User') }
    else { Write-Host "Preserved $($entry[0]) because it was changed after setup." }
}
$panel = Join-Path $env:APPDATA 'EffectCraft/Scripts/ScriptUI Panels/Effect Master.jsx'
if (Test-Path -LiteralPath $panel) {
    $backup = Join-Path $config ('backups/uninstalled-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '.jsx')
    New-Item -ItemType Directory -Path (Split-Path $backup -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $panel -Destination $backup
    Remove-Item -LiteralPath $panel
}
if ($receipt.panelBackup -and (Test-Path -LiteralPath $receipt.panelBackup)) { Copy-Item -LiteralPath $receipt.panelBackup -Destination $panel }
$shell = New-Object -ComObject WScript.Shell
foreach ($folder in @([Environment]::GetFolderPath('DesktopDirectory'), [Environment]::GetFolderPath('Programs'))) {
    $shortcut = Join-Path $folder 'Effect Master.lnk'
    if ((Test-Path -LiteralPath $shortcut) -and $shell.CreateShortcut($shortcut).TargetPath -ieq $executable) { Remove-Item -LiteralPath $shortcut }
}
foreach ($file in @($executable,(Join-Path $installDir 'Read me.txt'))) { if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file } }
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class EffectMasterEnvironmentRefresh { [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageTimeout(IntPtr h,uint m,UIntPtr w,string l,uint f,uint t,out UIntPtr r); }'
$broadcastResult = [UIntPtr]::Zero
[void][EffectMasterEnvironmentRefresh]::SendMessageTimeout([IntPtr]0xffff,0x001a,[UIntPtr]::Zero,'Environment',2,3000,[ref]$broadcastResult)
Write-Host 'Effect Master removed. Restart the Craft apps when convenient. Artwork, image assets, settings and backups were preserved.'
