# LEYFIS

**On-chain compliance middleware for institutional DeFi vaults.**

Leyfis sits between any DeFi vault and the outside world — enforcing KYC/AML access control at the protocol level through cryptographically signed on-chain attestations.

---

## Live Demo

| Surface | URL | Description |
|---------|-----|-------------|
| Public Portal | [leyfis-app.netlify.app](https://leyfis-app.netlify.app) | End-user vault access · two-wallet demo |
| Admin Console | [leyfis-admin.netlify.app](https://leyfis-admin.netlify.app) | Operator · Issuer · Auditor dashboards |

**Gate Program on Solana devnet:**
```
Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP
```
[View on Solana Explorer →](https://explorer.solana.com/address/Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP?cluster=devnet)

---

## The Problem

Institutional capital cannot enter DeFi because compliance has no on-chain address.

Banks verify users in spreadsheets and PDFs. DeFi vaults are permissionless by design — they cannot distinguish a verified institutional investor from a sanctioned wallet. One wrong transaction creates regulatory exposure for the entire institution.

No vault-agnostic compliance middleware exists on Solana today.

---

## What Leyfis Does

Leyfis is a Solana program that acts as a gate between a user's wallet and any DeFi vault. Before any vault interaction executes, Leyfis:

1. Reads a cryptographic attestation stored on Solana (via the Solana Attestation Service)
2. Runs 7 compliance checks in fixed, auditable order
3. Either forwards the instruction to the vault via CPI, or rejects it with a reason code
4. Writes an immutable `AuditEntry` on-chain — on **every** outcome, approved or denied

```
WALLET → LEYFIS GATE → [7 CHECKS] → PASS: CPI to vault
                                   → FAIL: reason code + audit entry
```

---

## Architecture

```
OFF-CHAIN
  KYC Provider (any registered issuer)
    └── Issues LeyfisAttestation to wallet pubkey via SAS

ON-CHAIN — Leyfis Gate Program (Rust / Anchor v0.30.1)
  User wallet submits tx to Gate Program
    ├── Check VaultConfig.paused
    ├── Derive SAS PDA [wallet, issuer, schema_uid]
    ├── Load attestation → not revoked → not expired
    ├── Issuer in trusted_issuers list
    ├── tier >= vault min_tier
    ├── jurisdiction in allowed_jurisdictions
    ├── PASS: CPI to vault_program (instruction forwarded unchanged)
    └── FAIL: LeyfisError + reason_code
    └── ALWAYS: write AuditEntry on-chain

STORAGE (all on Solana devnet)
  VaultConfig PDA    — vault operator settings, min tier, trusted issuers
  IssuerRegistry PDA — maps approved issuer pubkeys to vaults
  AuditEntry accounts — append-only, immutable, publicly readable
  SAS Attestations   — KYC credentials, read-only by Gate Program
```

---

## The 7 Compliance Checks

Enforced on every gate call, in this exact order:

| # | Check | Error Code | Reason |
|---|-------|-----------|--------|
| 01 | Gate active | `GatePaused` | Vault operator has paused access |
| 02 | Attestation exists | `NoAttestation` | No credential found for this wallet |
| 03 | Not revoked | `AttestationRevoked` | Issuer has revoked this credential |
| 04 | Not expired | `AttestationExpired` | Credential has passed its expiry date |
| 05 | Trusted issuer | `UntrustedIssuer` | Issuer not on this vault's approved list |
| 06 | Tier sufficient | `TierInsufficient` | Wallet's KYC tier below vault minimum |
| 07 | Jurisdiction eligible | `JurisdictionBlocked` | Wallet's jurisdiction not permitted |

---

## Account Structures

### VaultConfig
```rust
pub struct VaultConfig {
    pub authority:             Pubkey,       // vault operator
    pub vault_program:         Pubkey,       // target vault program
    pub min_tier:              u8,           // minimum KYC tier (1/2/3)
    pub trusted_issuers:       Vec<Pubkey>,  // approved attestation issuers
    pub allowed_jurisdictions: Vec<[u8; 3]>, // ISO 3166 codes, empty = all
    pub paused:                bool,         // emergency kill switch
    pub registered_at:         i64,
    pub bump:                  u8,
}
```

### AuditEntry
```rust
pub struct AuditEntry {
    pub wallet:         Pubkey,      // wallet that attempted interaction
    pub vault:          Pubkey,      // target vault
    pub timestamp:      i64,         // Unix timestamp
    pub slot:           u64,         // Solana slot
    pub outcome:        GateOutcome, // Approved | Denied
    pub reason_code:    u8,          // 0=approved, 1-7=denial reason
    pub attestation_id: Pubkey,      // SAS attestation PDA
    pub tier:           u8,          // attestation tier (0 if none)
}
```

### LeyfisAttestation (SAS — read only)
```rust
pub struct LeyfisAttestation {
    pub wallet:       Pubkey,    // verified wallet address
    pub issuer:       Pubkey,    // KYC provider wallet
    pub tier:         u8,        // 1=retail 2=accredited 3=institutional
    pub issued_at:    i64,
    pub expires_at:   i64,       // 0 = never expires
    pub kyc_ref:      [u8; 32],  // off-chain KYC reference hash
    pub jurisdiction: [u8; 3],   // ISO 3166 e.g. b"CHE"
    pub revoked:      bool,
}
```

---

## Instructions

```rust
initialize_vault_config(min_tier, trusted_issuers)  // vault operator — once at deploy
update_vault_config(min_tier, trusted_issuers)       // vault operator — live config changes
pause_gate()                                          // vault operator — emergency stop
unpause_gate()                                        // vault operator — resume
register_issuer(issuer_pubkey, vault_pubkey)          // super admin
revoke_issuer(issuer_pubkey)                          // super admin
gate(vault_instruction_data)                          // end user — core instruction
```

---

## Test Suite

8 Anchor tests — all passing on devnet:

```
✓  APPROVED  Wallet with valid Tier 3 attestation passes gate, CPI executes
✓  DENIED    Wallet with no attestation → NoAttestation
✓  DENIED    Wallet with expired attestation → AttestationExpired
✓  DENIED    Wallet with revoked attestation → AttestationRevoked
✓  DENIED    Wallet with Tier 1 on Tier 3 vault → TierInsufficient
✓  DENIED    Wallet with untrusted issuer → UntrustedIssuer
✓  DENIED    Gate paused → GatePaused (Tier 3 wallet still rejected)
✓  APPROVED  update_vault_config lowers min_tier → previously rejected wallet passes
```

Run tests:
```bash
docker exec leyfis-dev bash -c "cd /workspace/leyfis-gate && anchor test"
```

---

## Four Roles

| Role | Identity | Capabilities |
|------|----------|-------------|
| **Super Admin** | Deployer wallet | Register operators and issuers globally |
| **Vault Operator** | `VaultConfig.authority` | Configure vault, pause/unpause, view audit log |
| **KYC Issuer** | `IssuerRegistry` entry | Issue and revoke attestations |
| **Compliance Auditor** | Registered read-only wallet | Filter log, export FATF R.16 CSV |

---

## Admin Console Screens

All live at [leyfis-admin.netlify.app](https://leyfis-admin.netlify.app):

| Screen | Route | Role |
|--------|-------|------|
| Login / role detection | `/` | All — wallet-based, automatic |
| Vault operator dashboard | `/vault` | Operator |
| KYC issuer panel | `/issue` | KYC Issuer |
| Attestation registry | `/registry` | KYC Issuer |
| Audit log explorer | `/audit` | All |
| Live gate feed | `/feed` | All |
| FATF CSV export | `/export` | Operator / Auditor |
| Super admin panel | `/superadmin` | Super Admin |

---

## Deployed Accounts (Solana devnet)

| Account | Address |
|---------|---------|
| Gate Program | `Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP` |
| Test Vault | `88x1hxWW6mMDpQQwuR3sCDgnmbHwHmQBdWYZQhcedNaJ` |
| VaultConfig PDA | `B1vJ1Pwo8SGYg5emXoGBgqHQqBEcmBJa83cAfLJjAatj` |
| IssuerRegistry PDA | `F8NXMpzRPpz1C6HpmgMEaBzqeX7aGyRE9w6eKhdBT3zd` |

| Wallet | Address | Role |
|--------|---------|------|
| Deployer / Super Admin | `EGFbgXT1NC1ZGJgv33FRFdzKrKAc5hFLqqydS66eY4ht` | Authority |
| KYC Issuer | `EDBYT2E8HGEKhTRmHHdrAYUJChi4RUQdbzAmuqB6QALU` | Issues attestations |
| Wallet A (Tier 1 — denied) | `5t1okyeKtcRDQwiq3LT3uSBKQgUEuPTZBBSj15is9fjS` | Demo deny path |
| Wallet B (Tier 3 — approved) | `64je9DfojWKRt3EoxXPcq1DCWqyFNknQ7XWTxF7ekxfb` | Demo approve path |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Solana devnet |
| Smart contracts | Rust + Anchor Framework v0.30.1 |
| Credential layer | Solana Attestation Service (SAS) |
| Frontend | Next.js 14 + TypeScript |
| Wallet adapter | `@solana/wallet-adapter-react` |
| On-chain client | `@coral-xyz/anchor` + `@solana/web3.js` |
| Animations | `@rive-app/react-canvas` |
| Deployment | Netlify (two projects, one monorepo) |
| Dev environment | Docker Desktop on Windows |
| RPC | Helius devnet |

---

## Local Development

**Prerequisites:** Docker Desktop, Node.js 18+, Rust toolchain

```bash
# Clone
git clone https://github.com/thinkDecade/leyfis.git
cd leyfis

# Start Docker container
./start.bat

# Build the Gate Program
docker exec leyfis-dev bash -c "cd /workspace/leyfis-gate && anchor build"

# Run all 8 tests
docker exec leyfis-dev bash -c "cd /workspace/leyfis-gate && anchor test"

# Deploy to devnet
docker exec leyfis-dev bash -c "cd /workspace/leyfis-gate && anchor deploy --provider.cluster devnet"

# Run the frontend (app)
docker exec -d leyfis-dev bash -c "cd /workspace/app/apps/app && yarn dev"

# Run the admin console
docker exec -d leyfis-dev bash -c "cd /workspace/app/apps/admin && yarn dev"
```

**Frontend runs at:** `localhost:3000` (app) and `localhost:3001` (admin)

---

## Repository Structure

```
leyfis-protocol/
├── programs/
│   ├── leyfis-gate/src/lib.rs      Gate Program — 7 instructions, 7 errors
│   └── test-vault/src/lib.rs       Minimal test vault (demo only)
├── tests/
│   └── leyfis-gate.ts              8 Anchor tests (all passing)
├── app/
│   ├── apps/app/                   app.leyfis.io — public portal + landing page
│   └── apps/admin/                 admin.leyfis.io — institutional console
├── scripts/
│   └── issue-attestation.ts        CLI to issue SAS attestations
├── Anchor.toml
└── README.md
```

---

## Compliance Alignment

| Standard | Coverage |
|----------|---------|
| FATF R.16 | Audit log exports wallet, vault, timestamp, outcome, tier, attestation ID, jurisdiction |
| FATF R.10 | KYC tier system maps to CDD / EDD / Enhanced Institutional tiers |
| MiCA | Jurisdiction filtering enforces geographic access control at protocol level |
| FINMA | Swiss jurisdiction (`CHE`) supported natively in attestation schema |

---

---

## Design Principles

**Stateless gate.** The Gate Program reads SAS attestations but never stores approval decisions. Every interaction is independently verified.

**Append-only audit log.** AuditEntry accounts are written once and never mutated. No one — including the vault operator — can alter or delete an entry.

**Vault-agnostic.** Leyfis wraps any Solana vault via CPI. No vault modification required. The vault never knows Leyfis exists.

**Separation of roles.** KYC issuers, vault operators, and compliance auditors operate independently. Leyfis enforces the boundaries between them.

**Protocol-level enforcement.** Compliance rules are enforced at the transaction layer, not in an off-chain API that can fail, be bypassed, or go stale.

---

## Roadmap

- Mainnet deployment
- Permissioned attestation schema registry
- Multi-vault operator dashboard
- MiCA Article 68 travel rule compliance module
- SDK for vault developers: `npm install @leyfis/gate-sdk`

---

*Leyfis (Old Norse) — formal grant of clearance. Permission to proceed.*

**Leyfis — Institutional compliance infrastructure on Solana.**
