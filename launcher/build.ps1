# Compila o launcher (Auditoria RF.exe). Usa o compilador C# que já vem no Windows, então não é
# preciso instalar nada: o .NET Framework 4 está presente em qualquer Windows 10 ou 11.
#
#   powershell -ExecutionPolicy Bypass -File launcher\build.ps1

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { throw "Compilador C# não encontrado em $csc" }

$saida = Join-Path $raiz 'launcher\Auditoria RF.exe'
$fonte = Join-Path $raiz 'launcher\Launcher.cs'
$icone = Join-Path $raiz 'launcher\auditoria.ico'

& $csc /nologo /target:winexe /optimize+ /platform:anycpu `
  "/out:$saida" "/win32icon:$icone" `
  /reference:System.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll `
  "$fonte"

if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar (código $LASTEXITCODE)" }
Write-Output "Gerado: $saida"
