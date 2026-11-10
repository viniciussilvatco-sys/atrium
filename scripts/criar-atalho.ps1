# Cria (ou recria) o atalho "Atrium" na pasta do projeto.
# O atalho abre a versao publicada (sempre a mais recente) numa janela propria do Chrome/Edge.
# Uso:  npm run atalho

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$url  = 'https://viniciussilvatco-sys.github.io/atrium/'
$png  = Join-Path $root 'public\icons\icon-512.png'
$ico  = Join-Path $root 'scripts\atrium.ico'
$lnk  = Join-Path $root 'Atrium.lnk'

# 1) Icone: converte o PNG do app em .ico (256, 48, 32 e 16 pixels).
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile($png)
$images = @()
foreach ($size in 256, 48, 32, 16) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, 0, 0, $size, $size)
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $images += ,@($size, $ms.ToArray())
}
$src.Dispose()

$out = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $out
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]$images.Count)
$offset = 6 + 16 * $images.Count
foreach ($img in $images) {
  $s = $img[0]; $bytes = $img[1]
  $dim = if ($s -ge 256) { 0 } else { $s }
  $w.Write([Byte]$dim); $w.Write([Byte]$dim); $w.Write([Byte]0); $w.Write([Byte]0)
  $w.Write([UInt16]1); $w.Write([UInt16]32)
  $w.Write([UInt32]$bytes.Length); $w.Write([UInt32]$offset)
  $offset += $bytes.Length
}
foreach ($img in $images) { $w.Write([Byte[]]$img[1]) }
$w.Flush()
[System.IO.File]::WriteAllBytes($ico, $out.ToArray())

# 2) Navegador: Chrome, senao Edge (modo aplicativo); senao o navegador padrao.
$browsers = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$browser = $browsers | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

# 3) Atalho (substitui o anterior, se existir).
if (Test-Path $lnk) { Remove-Item $lnk -Force }
$shell = New-Object -ComObject WScript.Shell
$s = $shell.CreateShortcut($lnk)
if ($browser) {
  $s.TargetPath = $browser
  $s.Arguments = "--app=$url"
  $s.WorkingDirectory = Split-Path -Parent $browser
} else {
  $s.TargetPath = "$env:WINDIR\explorer.exe"
  $s.Arguments = $url
}
$s.IconLocation = "$ico,0"
$s.Description = 'Abrir o Atrium (versao publicada mais recente)'
$s.Save()

Write-Host "Atalho criado: $lnk"
if ($browser) { Write-Host "Abre com: $browser" } else { Write-Host 'Abre com o navegador padrao' }
