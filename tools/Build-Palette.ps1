$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
Push-Location $project
try {
    & node build.mjs
    if ($LASTEXITCODE -ne 0) { throw 'JavaScript build failed.' }
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
    & $compiler /nologo /target:winexe /optimize+ /platform:anycpu '/out:dist\Effect Master.exe' '/win32manifest:palette\app.manifest' /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll /r:Microsoft.CSharp.dll '/resource:dist\Effect Master Core.js,EffectMaster.Core' '/resource:dist\Effect Master.jsx,EffectMaster.Panel' 'palette\Program.cs' 'palette\Bridge.cs' 'palette\Palette.cs' 'palette\Installer.cs'
    if ($LASTEXITCODE -ne 0) { throw 'Palette compilation failed.' }
    Copy-Item -LiteralPath 'dist/Effect Master.exe' -Destination 'dist/Setup Effect Master.exe' -Force
    Write-Host 'Built floating palette and graphical per-user installer.'
} finally { Pop-Location }
