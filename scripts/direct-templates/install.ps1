param(
    [switch]$Upgrade,
    [switch]$Check,
    [string]$Target,
    [int]$WaitForPid = 0
)
$ErrorActionPreference = 'Stop'
$Cli = '__CLI__'
$BinaryName = '__BINARY__'
$Repo = 'https://github.com/__OWNER__/__REPO__'
$Root = if ($env:CLI_INSTALL_DIR) { $env:CLI_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA '__CLI__\bin' }
if (-not [IO.Path]::IsPathRooted($Root)) { throw 'CLI_INSTALL_DIR must be absolute' }
if (-not $Target) { $Target = Join-Path $Root "$Cli.exe" }
if (-not [IO.Path]::IsPathRooted($Target)) { throw 'Target must be an absolute path' }
if ($Check) {
    if (Test-Path $Target) { & $Target --version }
    else { Write-Host "$Cli is not installed" }
    $Latest = & curl.exe -sSIL --max-time 20 -o NUL -w '%{url_effective}' "$Repo/releases/latest"
    if ($LASTEXITCODE -ne 0) { throw 'Could not resolve latest GitHub release' }
    Write-Host "Latest release: $Latest"
    exit 0
}
if (-not $Upgrade -and (Test-Path $Target)) { throw "$Cli is already installed. Run '$Cli upgrade'." }
if ($Upgrade -and -not (Test-Path $Target)) { throw 'Existing installation was not found' }
$Version = if ($env:CLI_VERSION) { $env:CLI_VERSION.TrimStart('v') } else { '' }
if ($Version -and $Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid stable release version' }
$Arch = switch ([Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()) {
    'Arm64' { 'arm64' }
    'X64' { 'amd64' }
    default { throw 'Unsupported Windows architecture' }
}
$Asset = "${BinaryName}_windows_${Arch}.exe"
$Base = if ($Version) { "$Repo/releases/download/v$Version" } else { "$Repo/releases/latest/download" }
$Stage = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $Stage | Out-Null
try {
    Invoke-WebRequest "$Base/SHA256SUMS" -OutFile (Join-Path $Stage 'SHA256SUMS')
    Invoke-WebRequest "$Base/$Asset" -OutFile (Join-Path $Stage $Asset)
    $Rows = @(Get-Content (Join-Path $Stage 'SHA256SUMS') | Where-Object { ($_ -split '\s+')[1] -eq $Asset })
    if ($Rows.Count -ne 1) { throw 'Missing or ambiguous release checksum' }
    $Expected = ($Rows[0] -split '\s+')[0]
    $Actual = (Get-FileHash (Join-Path $Stage $Asset) -Algorithm SHA256).Hash
    if ($Expected.Length -ne 64 -or $Actual -ine $Expected) { throw 'Checksum mismatch; installation unchanged' }
    & (Join-Path $Stage $Asset) --version
    if ($LASTEXITCODE -ne 0) { throw 'New binary failed version probe' }
    New-Item -ItemType Directory -Path (Split-Path -Parent $Target) -Force | Out-Null
    if ($WaitForPid -gt 0) {
        try { Wait-Process -Id $WaitForPid -Timeout 120 -ErrorAction SilentlyContinue } catch { }
    }
    # Windows cannot replace a still-running executable. The CLI starts this
    # script in a detached process and exits before it reaches this step.
    Move-Item (Join-Path $Stage $Asset) $Target -Force
    & $Target --version
    Write-Host "Installed $Cli at $Target"
} finally {
    Remove-Item $Stage -Recurse -Force -ErrorAction SilentlyContinue
    # Native upgrade created a temporary script; initial install did not.
    if ($Upgrade -and $WaitForPid -gt 0) {
        Remove-Item $PSCommandPath -Force -ErrorAction SilentlyContinue
    }
}
