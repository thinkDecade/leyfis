#Requires -Version 5.1
<#
.SYNOPSIS
    Leyfis Docker Development Environment Setup - Tasks 1-14
    Run from the leyfis-protocol folder:
      powershell -ExecutionPolicy Bypass -File .\leyfis-setup.ps1
#>

$ErrorActionPreference = "Continue"
$PROJECT = "$env:USERPROFILE\leyfis-protocol"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Step { param($n, $msg) Write-Host "" ; Write-Host "=== TASK ${n}: $msg ===" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-WARN { param($msg) Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Write-FAIL { param($msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Write-INFO { param($msg) Write-Host "  --> $msg" -ForegroundColor Gray }

# Helper: run bash inside container
function Invoke-Bash {
    param([string]$Script)
    docker exec leyfis-dev bash -c $Script
}

# ─────────────────────────────────────────────────────────────────────────────
# TASK 1 - Verify Docker Desktop
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 1 "Verify Docker Desktop"

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
$dockerPath = if ($dockerCmd) { $dockerCmd.Source } else { $null }

if (-not $dockerPath) {
    Write-FAIL "Docker not found in PATH."
    Write-WARN "Opening Docker Desktop download page..."
    Start-Process "https://www.docker.com/products/docker-desktop"
    Write-Host ""
    Write-Host "MANUAL ACTION REQUIRED:" -ForegroundColor Yellow
    Write-Host "  1. Download and install Docker Desktop" -ForegroundColor Yellow
    Write-Host "  2. During install: if WSL is broken, select 'Use Hyper-V instead'" -ForegroundColor Yellow
    Write-Host "  3. Re-run this script after Docker Desktop is running" -ForegroundColor Yellow
    exit 1
}
Write-OK "docker found at: $dockerPath"
Write-INFO (docker --version)

# Start Docker Desktop if not running
$dockerRunning = $false
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -eq 0) { $dockerRunning = $true }
} catch {}

if (-not $dockerRunning) {
    Write-WARN "Docker daemon not running. Attempting to start Docker Desktop..."
    $ddPaths = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe"
    )
    $ddPath = $null
    foreach ($p in $ddPaths) { if (Test-Path $p) { $ddPath = $p; break } }

    if ($ddPath) {
        Start-Process $ddPath
        Write-INFO "Waiting up to 90 seconds for Docker to become ready..."
        $waited = 0
        while ($waited -lt 90) {
            Start-Sleep 5; $waited += 5
            $null = docker info 2>&1
            if ($LASTEXITCODE -eq 0) { $dockerRunning = $true; break }
            Write-INFO "  still waiting... ($waited s)"
        }
    }

    if (-not $dockerRunning) {
        Write-FAIL "Docker did not start within 90 seconds."
        Write-WARN "Please start Docker Desktop manually and re-run this script."
        exit 1
    }
}

Write-OK "Docker is running"

# ─────────────────────────────────────────────────────────────────────────────
# TASK 2 - Attempt WSL recovery (non-blocking)
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 2 "Attempt WSL file recovery (non-blocking)"

$wslAvailable = $false
try {
    $null = wsl --list --verbose 2>&1
    if ($LASTEXITCODE -eq 0) { $wslAvailable = $true }
} catch {}

if ($wslAvailable) {
    Write-INFO "WSL available - attempting keypair recovery..."
    try {
        $keypairs = wsl -d Ubuntu bash -c "find / -name 'deployer.json' -path '*/keys/*' 2>/dev/null | head -3" 2>&1
        if ($keypairs -and ($keypairs -notmatch "error") -and ($keypairs.Trim() -ne "")) {
            Write-OK "Found keypairs in WSL: $keypairs"
        } else {
            Write-WARN "No keypairs found in WSL - will generate fresh wallets"
        }
    } catch {
        Write-WARN "WSL recovery skipped"
    }
} else {
    Write-WARN "WSL not available or broken - skipping (expected)"
}

# ─────────────────────────────────────────────────────────────────────────────
# TASK 3 - Create project folder structure
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 3 "Create project folder at $PROJECT"

$dirs = @(
    $PROJECT,
    "$PROJECT\programs\leyfis-gate\src",
    "$PROJECT\programs\test-vault\src",
    "$PROJECT\tests",
    "$PROJECT\scripts",
    "$PROJECT\keys",
    "$PROJECT\app"
)
foreach ($d in $dirs) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
}
Write-OK "Project folder structure ready: $PROJECT"

# Copy files from the script's own directory into the project folder
if ($SCRIPT_DIR -ne $PROJECT) {
    Write-INFO "Copying project files from $SCRIPT_DIR ..."
    $filesToCopy = @(
        "Dockerfile.dev", "start.bat", "stop.bat", "shell.bat", "run.bat",
        ".gitignore", "CLAUDE.md", "Anchor.toml", "Cargo.toml", "Cargo.lock",
        "package.json", "tsconfig.json", "claude_desktop_config.json"
    )
    foreach ($f in $filesToCopy) {
        $src = Join-Path $SCRIPT_DIR $f
        if (Test-Path $src) {
            Copy-Item $src "$PROJECT\$f" -Force
            Write-INFO "  Copied $f"
        }
    }
    foreach ($sub in @("programs", "tests", "scripts", "keys")) {
        $src = Join-Path $SCRIPT_DIR $sub
        if (Test-Path $src) {
            Copy-Item $src $PROJECT -Recurse -Force
            Write-OK "  Copied $sub/"
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# TASK 4 - Verify Dockerfile.dev
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 4 "Verify Dockerfile.dev"

if (-not (Test-Path "$PROJECT\Dockerfile.dev")) {
    Write-FAIL "Dockerfile.dev not found at $PROJECT\Dockerfile.dev"
    Write-WARN "Make sure you copied all files from the Claude outputs folder first"
    exit 1
}
Write-OK "Dockerfile.dev found"

# ─────────────────────────────────────────────────────────────────────────────
# TASK 5 - Build Docker image
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 5 "Build Docker image 'leyfis-dev' (8-20 min first time)"

$null = docker image inspect leyfis-dev 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-OK "Image 'leyfis-dev' already exists - skipping build"
} else {
    Write-INFO "Building image - downloads Rust, Solana 3.1.10, Anchor 0.30.1, Node 20..."
    Write-INFO "Estimated time: 10-20 minutes depending on internet speed"
    Set-Location $PROJECT
    docker build -f Dockerfile.dev -t leyfis-dev . --progress=plain
    if ($LASTEXITCODE -ne 0) {
        Write-FAIL "Docker build failed."
        Write-FAIL "Retry: cd $PROJECT; docker build -f Dockerfile.dev -t leyfis-dev ."
        exit 1
    }
    Write-OK "Docker image built successfully"
}

# ─────────────────────────────────────────────────────────────────────────────
# TASK 6 - Verify batch scripts
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 6 "Verify container management scripts"
foreach ($bat in @("start.bat","stop.bat","shell.bat","run.bat")) {
    if (Test-Path "$PROJECT\$bat") { Write-OK "$bat present" }
    else { Write-WARN "$bat missing" }
}

# ─────────────────────────────────────────────────────────────────────────────
# TASK 7 - Start container and verify tools
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 7 "Start container and verify tools"

# Remove stale stopped container if it exists
$null = docker inspect leyfis-dev 2>&1
if ($LASTEXITCODE -eq 0) {
    $status = docker inspect --format "{{.State.Status}}" leyfis-dev 2>$null
    if ($status -ne "running") {
        Write-INFO "Removing stopped container to recreate with volume mounts..."
        docker rm leyfis-dev | Out-Null
    }
}

$status = docker inspect --format "{{.State.Status}}" leyfis-dev 2>$null
if ($status -ne "running") {
    docker run -d `
        --name leyfis-dev `
        -v "${PROJECT}:/workspace" `
        -v "leyfis-build-cache:/build-cache" `
        -p 8899:8899 `
        -p 8900:8900 `
        leyfis-dev `
        tail -f /dev/null

    if ($LASTEXITCODE -ne 0) {
        Write-FAIL "Failed to start container"
        exit 1
    }
    Write-OK "Container started"
} else {
    Write-OK "Container already running"
}

# Verify all 6 tools
Write-INFO "Verifying installed tools..."
$toolChecks = @(
    @{ cmd = "rustc --version";   name = "Rust" },
    @{ cmd = "cargo --version";   name = "Cargo" },
    @{ cmd = "solana --version";  name = "Solana CLI" },
    @{ cmd = "anchor --version";  name = "Anchor CLI" },
    @{ cmd = "node --version";    name = "Node.js" },
    @{ cmd = "npm --version";     name = "npm" }
)
$allOK = $true
foreach ($t in $toolChecks) {
    $result = docker exec leyfis-dev bash -c "source /root/.bashrc 2>/dev/null; $($t.cmd) 2>&1"
    if ($LASTEXITCODE -eq 0) {
        Write-OK "$($t.name): $result"
    } else {
        Write-FAIL "$($t.name): NOT FOUND"
        $allOK = $false
    }
}
if (-not $allOK) {
    Write-FAIL "Some tools missing. Rebuild: docker rmi leyfis-dev; re-run script"
    exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
# TASK 8-9 - Pre-generate wallet, then build Anchor programs
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "8-9" "Build Anchor programs inside Docker"

$gateLib  = Invoke-Bash "test -f /workspace/programs/leyfis-gate/src/lib.rs && echo yes || echo no"
$vaultLib = Invoke-Bash "test -f /workspace/programs/test-vault/src/lib.rs && echo yes || echo no"

if ($gateLib.Trim() -eq "yes" -and $vaultLib.Trim() -eq "yes") {
    Write-OK "Source files found in /workspace"
} else {
    Write-WARN "Source files missing - check $PROJECT\programs\"
}

# Pre-generate deployer keypair so anchor build has a valid wallet
Write-INFO "Pre-generating deployer keypair for anchor build..."
Invoke-Bash "source /root/.bashrc; mkdir -p /workspace/keys; [ ! -f /workspace/keys/deployer.json ] && solana-keygen new --outfile /workspace/keys/deployer.json --no-bip39-passphrase --silent && echo 'Generated deployer' || echo 'Kept existing deployer'"

# Set as default Solana wallet inside container (anchor reads this during build)
Invoke-Bash "mkdir -p /root/.config/solana && cp /workspace/keys/deployer.json /root/.config/solana/id.json && echo 'Default wallet set'"

# Write a clean Anchor.toml directly into the container via docker cp
# (bypasses Windows CRLF/encoding issues that corrupt the file read by Linux anchor)
$buildToml = "$env:TEMP\Anchor.toml.build"
@'
[features]
seeds = false
skip-lint = false

[programs.localnet]
leyfis_gate = "7jyP2jp8ozmGSeXpyLm9gbpghKA3qgAu2hWVhigh63Gj"
test_vault  = "9TpGNHaiFbiDZFmbPc6D97TXghBUMNXiGsFAZ1k7zHxy"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "localnet"
wallet = "/workspace/keys/deployer.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
'@ | Out-File -FilePath $buildToml -Encoding ASCII
docker cp $buildToml leyfis-dev:/workspace/Anchor.toml
Invoke-Bash "sed -i 's/\r//' /workspace/Anchor.toml && echo 'Anchor.toml OK'"
Write-OK "Fresh Anchor.toml (localnet) written into container"

# Clear any stale program keypairs from a previous failed build attempt
Invoke-Bash "rm -f /build-cache/deploy/*.json 2>/dev/null; echo 'Cleared stale program keypairs'"

Write-INFO "Running anchor build --skip-lint (first build: 5-15 min)..."

$buildScript = "source /root/.bashrc; cd /workspace; export CARGO_TARGET_DIR=/build-cache; export TMPDIR=/tmp; export RUST_BACKTRACE=1; anchor build --skip-lint 2>&1"
Invoke-Bash $buildScript

if ($LASTEXITCODE -ne 0) {
    Write-WARN "First build attempt failed. Applying proc-macro2 patch..."

    # Write patch as a proper shell script file - avoids PowerShell/bash quoting issues
    $patchFile = "$env:TEMP\anchor_patch.sh"
    @'
#!/bin/bash
for f in /root/.cargo/registry/src/*/anchor-syn-0.30.1/src/idl/defined.rs; do
  if [ -f "$f" ]; then
    sed -i 's|proc_macro2::Span::call_site().source_file().path()|std::path::PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default()).join("src").join("lib.rs")|g' "$f"
    sed -i 's|find_path("lib.rs", &source_path).expect("lib.rs should exist")|source_path.clone()|g' "$f"
    echo "Patched: $f"
  fi
done
echo "Patch complete"
'@ | Out-File -FilePath $patchFile -Encoding ASCII
    docker cp $patchFile leyfis-dev:/tmp/anchor_patch.sh
    # Strip Windows CRLF line endings so bash can execute the script
    Invoke-Bash "sed -i 's/\r//' /tmp/anchor_patch.sh && chmod +x /tmp/anchor_patch.sh && /tmp/anchor_patch.sh"

    Write-INFO "Retrying anchor build..."
    Invoke-Bash $buildScript

    if ($LASTEXITCODE -ne 0) {
        Write-FAIL "anchor build still failing. Check output above."
        exit 1
    }
}

Write-OK "Anchor build succeeded"

# Copy artifacts to workspace
$copyScript = "mkdir -p /workspace/target/deploy /workspace/target/idl; cp /build-cache/deploy/*.so /workspace/target/deploy/ 2>/dev/null; cp /build-cache/idl/*.json /workspace/target/idl/ 2>/dev/null; echo done"
Invoke-Bash $copyScript

$soFiles  = Invoke-Bash "ls -lh /workspace/target/deploy/*.so 2>/dev/null || ls -lh /build-cache/deploy/*.so 2>/dev/null"
$idlFiles = Invoke-Bash "ls -lh /workspace/target/idl/*.json 2>/dev/null"
Write-OK "Build artifacts:"
Write-INFO $soFiles
Write-INFO $idlFiles

# ─────────────────────────────────────────────────────────────────────────────
# TASK 10 - Generate remaining wallets and update Anchor.toml with program IDs
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 10 "Generate devnet keypairs and lock in program IDs"

# Generate any missing keypairs (deployer was pre-generated above, this fills the rest)
$genScript = 'source /root/.bashrc; mkdir -p /workspace/keys; for key in deployer wallet-a wallet-b admin issuer; do if [ ! -f "/workspace/keys/$key.json" ]; then solana-keygen new --outfile "/workspace/keys/$key.json" --no-bip39-passphrase --silent; echo "Generated $key"; else echo "Kept existing $key"; fi; done'
Invoke-Bash $genScript

# Read wallet addresses
$walletAddresses = @{}
foreach ($w in @("deployer", "wallet-a", "wallet-b", "admin", "issuer")) {
    $addr = Invoke-Bash "source /root/.bashrc; solana-keygen pubkey /workspace/keys/$w.json 2>/dev/null"
    $walletAddresses[$w] = $addr.Trim()
    Write-OK "${w}: $($walletAddresses[$w])"
}

# Get program IDs from build artifacts
$gateId  = Invoke-Bash "source /root/.bashrc; solana-keygen pubkey /build-cache/deploy/leyfis_gate-keypair.json 2>/dev/null || solana-keygen pubkey /workspace/target/deploy/leyfis_gate-keypair.json 2>/dev/null"
$vaultId = Invoke-Bash "source /root/.bashrc; solana-keygen pubkey /build-cache/deploy/test_vault-keypair.json 2>/dev/null || solana-keygen pubkey /workspace/target/deploy/test_vault-keypair.json 2>/dev/null"
$gateId  = $gateId.Trim()
$vaultId = $vaultId.Trim()
Write-OK "Gate Program:  $gateId"
Write-OK "Test Vault:    $vaultId"

# Write Anchor.toml directly on Windows (workspace = Windows folder)
$anchorToml = @"
[features]
resolution = true
skip-lint = false

[programs.devnet]
leyfis_gate = "$gateId"
test_vault  = "$vaultId"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "devnet"
wallet = "/workspace/keys/deployer.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
"@
Set-Content "$PROJECT\Anchor.toml" $anchorToml
Write-OK "Anchor.toml updated with real program IDs"

# ─────────────────────────────────────────────────────────────────────────────
# TASK 11 - Fund wallets via devnet faucet
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 11 "Fund wallets via devnet faucet"

Write-INFO "Attempting CLI airdrops (may be rate-limited)..."
$fundedCount = 0
foreach ($entry in $walletAddresses.GetEnumerator()) {
    $addr = $entry.Value
    if (-not $addr) { continue }

    # Try CLI airdrop
    $result = Invoke-Bash "source /root/.bashrc; solana airdrop 2 $addr --url devnet 2>&1"
    if ($result -match "SOL" -and $result -notmatch "Error") {
        Write-OK "Funded $($entry.Key) ($addr)"
        $fundedCount++
    } else {
        # JSON-RPC fallback
        $curlCmd = "curl -s -X POST https://api.devnet.solana.com -H 'Content-Type: application/json' -d '{""jsonrpc"":""2.0"",""id"":1,""method"":""requestAirdrop"",""params"":[""$addr"",2000000000]}' 2>&1"
        $result2 = Invoke-Bash $curlCmd
        if ($result2 -match '"result"') {
            Write-OK "Funded $($entry.Key) via JSON-RPC"
            $fundedCount++
        } else {
            Write-WARN "Rate-limited: $($entry.Key) ($addr)"
        }
    }
    Start-Sleep 2
}

# Show balances
Write-INFO "Balances:"
foreach ($entry in $walletAddresses.GetEnumerator()) {
    $bal = Invoke-Bash "source /root/.bashrc; solana balance $($entry.Value) --url devnet 2>&1"
    Write-INFO "  $($entry.Key): $($entry.Value) = $($bal.Trim())"
}

if ($fundedCount -lt $walletAddresses.Count) {
    Write-WARN "Some wallets need manual funding at: https://faucet.solana.com"
    foreach ($entry in $walletAddresses.GetEnumerator()) {
        Write-WARN "  $($entry.Key): $($entry.Value)"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# TASK 12 - Update .gitignore and CLAUDE.md
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 12 "Update .gitignore and CLAUDE.md"

@"
keys/
target/
.anchor/
node_modules/
.env
*.pem
Dockerfile.dev
leyfis-setup.ps1
"@ | Set-Content "$PROJECT\.gitignore"
Write-OK ".gitignore written"

$claudeMd = Get-Content "$PROJECT\CLAUDE.md" -Raw -ErrorAction SilentlyContinue
if ($claudeMd -and ($claudeMd -notmatch "Docker Workflow")) {
    $dockerSection = @"


---

## Docker Workflow

All Anchor commands run INSIDE the Docker container.

| Action | Command |
|--------|---------|
| Start container | ``start.bat`` |
| Open shell | ``shell.bat`` |
| Stop container | ``stop.bat`` |
| Build programs | ``docker exec leyfis-dev bash -c "cd /workspace && anchor build"`` |

Windows folder C:\Users\$env:USERNAME\leyfis-protocol = /workspace inside container.
Edit files in VS Code on Windows - changes appear instantly inside Docker.
CARGO_TARGET_DIR=/build-cache - build artifacts go to a Docker volume.
"@
    ($claudeMd + $dockerSection) | Set-Content "$PROJECT\CLAUDE.md"
    Write-OK "CLAUDE.md updated with Docker workflow section"
} else {
    Write-OK "CLAUDE.md already has Docker section (or not found)"
}

# ─────────────────────────────────────────────────────────────────────────────
# TASK 13 - Git init and initial commit
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 13 "Git init and initial commit"

$gitScript = "source /root/.bashrc; cd /workspace; git config --global user.email 'build@leyfis.io'; git config --global user.name 'Leyfis Build'; if [ ! -d .git ]; then git init; fi; git add -A; git status --short; git commit -m 'init: Docker dev environment, anchor programs, devnet wallets' 2>&1 || echo 'Nothing new to commit'"
Invoke-Bash $gitScript

Write-INFO "To push to GitHub:"
Write-INFO "  docker exec leyfis-dev bash -c 'cd /workspace && git remote add origin https://github.com/YOUR_USER/leyfis-protocol && git push -u origin main'"

# ─────────────────────────────────────────────────────────────────────────────
# TASK 14 - Final verification report
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 14 "Final Verification Report"

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  LEYFIS PHASE 1 - SETUP COMPLETE" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$reportScript = 'source /root/.bashrc; echo ""; echo "=== TOOLS ==="; rustc --version; solana --version; anchor --version; node --version; echo ""; echo "=== PROGRAMS ==="; ls -lh /build-cache/deploy/*.so 2>/dev/null || ls -lh /workspace/target/deploy/*.so 2>/dev/null; ls -lh /workspace/target/idl/*.json 2>/dev/null; echo ""; echo "=== WALLETS ==="; for key in deployer wallet-a wallet-b admin issuer; do addr=$(solana-keygen pubkey /workspace/keys/$key.json 2>/dev/null); bal=$(solana balance $addr --url devnet 2>/dev/null || echo "see faucet.solana.com"); echo "$key: $addr = $bal"; done; echo ""; echo "=== CONTAINER ==="; echo "Name: leyfis-dev"; hostname'
Invoke-Bash $reportScript

Write-Host ""
Write-Host "Gate Program:  $gateId" -ForegroundColor Green
Write-Host "Test Vault:    $vaultId" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT: Phase 2 - Write complete Gate Program lib.rs" -ForegroundColor Yellow
Write-Host "  Open shell:  .\shell.bat" -ForegroundColor Yellow
Write-Host ""
if ($fundedCount -lt $walletAddresses.Count) {
    Write-Host "ACTION NEEDED: Fund wallets at https://faucet.solana.com" -ForegroundColor Red
    foreach ($entry in $walletAddresses.GetEnumerator()) {
        Write-Host "  $($entry.Key): $($entry.Value)" -ForegroundColor Red
    }
}
Write-Host ""
Write-Host "Ready for Phase 2." -ForegroundColor Green
