#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Leyfis — WSL2 Toolchain Setup
# ═══════════════════════════════════════════════════════════════════════════
# Run this once inside your WSL2 terminal.
# After it completes, cd into the leyfis-protocol folder and run:
#   anchor build
#   anchor test
#
# Usage:
#   chmod +x setup-wsl2.sh
#   ./setup-wsl2.sh
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

step() { echo -e "\n${BOLD}${GREEN}▶ $1${RESET}"; }
warn() { echo -e "${YELLOW}⚠ $1${RESET}"; }
info() { echo -e "  $1"; }

# ─────────────────────────────────────────────────────────────────────────────
# 1. System packages
# ─────────────────────────────────────────────────────────────────────────────
step "1/8  System packages"
sudo apt update -qq
sudo apt install -y \
  build-essential \
  pkg-config \
  libudev-dev \
  llvm \
  libclang-dev \
  protobuf-compiler \
  libssl-dev \
  curl \
  git \
  wget \
  unzip \
  jq
info "System packages installed."

# ─────────────────────────────────────────────────────────────────────────────
# 2. Rust
# ─────────────────────────────────────────────────────────────────────────────
step "2/8  Rust (via rustup)"
if command -v rustup &>/dev/null; then
  warn "rustup already installed — updating"
  rustup update stable
else
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
fi

# shellcheck disable=SC1091
source "$HOME/.cargo/env"

# Solana / Anchor require a specific nightly sometimes — stable is fine for now
rustup component add rustfmt clippy
rustup target add wasm32-unknown-unknown

info "Rust version: $(rustc --version)"
info "Cargo version: $(cargo --version)"

# ─────────────────────────────────────────────────────────────────────────────
# 3. Solana CLI
# ─────────────────────────────────────────────────────────────────────────────
step "3/8  Solana CLI (Anza stable)"
if command -v solana &>/dev/null; then
  warn "Solana CLI already installed: $(solana --version)"
  warn "To upgrade: sh -c \"\$(curl -sSfL https://release.anza.xyz/stable/install)\""
else
  sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
fi

# Add to PATH for this session
SOLANA_PATH="$HOME/.local/share/solana/install/active_release/bin"
export PATH="$SOLANA_PATH:$PATH"

# Persist to ~/.bashrc
if ! grep -q "solana/install/active_release/bin" "$HOME/.bashrc" 2>/dev/null; then
  echo "" >> "$HOME/.bashrc"
  echo "# Solana CLI" >> "$HOME/.bashrc"
  echo "export PATH=\"\$HOME/.local/share/solana/install/active_release/bin:\$PATH\"" >> "$HOME/.bashrc"
fi

info "Solana version: $(solana --version)"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Node.js 18 (via nvm)
# ─────────────────────────────────────────────────────────────────────────────
step "4/8  Node.js 18 (via nvm)"
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# shellcheck disable=SC1091
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

nvm install 18
nvm use 18
nvm alias default 18

info "Node version: $(node --version)"
info "npm version:  $(npm --version)"

# ─────────────────────────────────────────────────────────────────────────────
# 5. Yarn
# ─────────────────────────────────────────────────────────────────────────────
step "5/8  Yarn"
npm install -g yarn
info "Yarn version: $(yarn --version)"

# ─────────────────────────────────────────────────────────────────────────────
# 6. Anchor CLI (via avm)
# ─────────────────────────────────────────────────────────────────────────────
step "6/8  Anchor CLI v0.30.1 (via avm)"

# Persist cargo bin to PATH
if ! grep -q '\.cargo/bin' "$HOME/.bashrc" 2>/dev/null; then
  echo "" >> "$HOME/.bashrc"
  echo "# Cargo bin" >> "$HOME/.bashrc"
  echo "export PATH=\"\$HOME/.cargo/bin:\$PATH\"" >> "$HOME/.bashrc"
fi
export PATH="$HOME/.cargo/bin:$PATH"

if command -v avm &>/dev/null; then
  warn "avm already installed"
else
  cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
fi

avm install 0.30.1
avm use 0.30.1

info "Anchor version: $(anchor --version)"

# ─────────────────────────────────────────────────────────────────────────────
# 7. Solana wallets — 5 wallets as per CLAUDE.md
# ─────────────────────────────────────────────────────────────────────────────
step "7/8  Generating Solana wallets"

WALLET_DIR="$HOME/.config/solana/leyfis"
mkdir -p "$WALLET_DIR"

generate_wallet() {
  local name="$1"
  local path="$WALLET_DIR/$name.json"
  if [ -f "$path" ]; then
    warn "$name already exists — skipping"
  else
    solana-keygen new --no-bip39-passphrase --silent --outfile "$path"
    info "$name: $(solana-keygen pubkey $path)"
  fi
}

# Set deployer as default Solana wallet
if [ ! -f "$HOME/.config/solana/id.json" ]; then
  solana-keygen new --no-bip39-passphrase --silent --outfile "$HOME/.config/solana/id.json"
fi

generate_wallet "deployer"   # Super Admin — copy of id.json
generate_wallet "wallet-a"   # Demo Wallet A (no attestation)
generate_wallet "wallet-b"   # Demo Wallet B (Tier 3 / AMINA)
generate_wallet "admin"      # Admin wallet (vault operator)
generate_wallet "kyc-issuer" # KYC Issuer wallet

# Set devnet as default cluster
solana config set --url devnet

echo ""
echo "  ── Wallet pubkeys ──────────────────────────────────────"
for w in deployer wallet-a wallet-b admin kyc-issuer; do
  echo "  $w: $(solana-keygen pubkey $WALLET_DIR/$w.json)"
done
echo "  ────────────────────────────────────────────────────────"
echo ""
warn "IMPORTANT: Copy wallet pubkeys above into CLAUDE.md under 'Wallet Addresses'"

# ─────────────────────────────────────────────────────────────────────────────
# 8. Fund wallets from devnet faucet + install project deps
# ─────────────────────────────────────────────────────────────────────────────
step "8/8  Airdrop SOL + install project deps"

airdrop_wallet() {
  local path="$1"
  local pubkey
  pubkey=$(solana-keygen pubkey "$path")
  info "Airdropping 2 SOL to $pubkey..."
  solana airdrop 2 "$pubkey" --url devnet || warn "Airdrop failed for $pubkey (rate limit — retry manually)"
}

airdrop_wallet "$HOME/.config/solana/id.json"
for w in deployer wallet-a wallet-b admin kyc-issuer; do
  airdrop_wallet "$WALLET_DIR/$w.json"
done

# Install project Node dependencies
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/package.json" ]; then
  cd "$SCRIPT_DIR"
  info "Running yarn install in $(pwd)..."
  yarn install
else
  warn "Could not find package.json — run 'yarn install' manually from repo root"
fi

# ─────────────────────────────────────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Leyfis toolchain setup complete!${RESET}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════════${RESET}"
echo ""
echo "  Next steps:"
echo "  1. Reload your shell:    source ~/.bashrc"
echo "  2. cd into repo root"
echo "  3. Build programs:       anchor build"
echo "  4. Run all 8 tests:      anchor test"
echo "  5. Deploy to devnet:     anchor deploy --provider.cluster devnet"
echo "  6. Update CLAUDE.md with program IDs and wallet addresses"
echo ""
echo "  Wallets are in: $WALLET_DIR"
echo ""
