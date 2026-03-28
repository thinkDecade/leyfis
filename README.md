# Leyfis

**On-chain compliance middleware for institutional DeFi vaults.**

Leyfis is a Solana program that sits between any wallet and any DeFi vault. It reads cryptographically signed KYC/AML attestations stored on-chain, enforces a fixed sequence of compliance checks, and either forwards the vault instruction or rejects it with a reason code. Every outcome is written to an immutable, publicly readable audit log.

No off-chain API. No compliance team in the loop. No manual review. Just protocol.

---

## Live

| Surface | URL |
|---------|-----|
| Public Portal | [leyfis-app.netlify.app](https://leyfis-app.netlify.app) |
| Admin Console | [leyfis-admin.netlify.app](https://leyfis-admin.netlify.app) |

**Gate Program on Solana devnet**
```
Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP
```
[View on Solana Explorer](https://explorer.solana.com/address/Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP?cluster=devnet)

---

## The Problem

Institutional capital cannot enter DeFi because compliance has no on-chain address.

Banks spend years and millions building KYC/AML infrastructure. That work lives in internal systems that no blockchain can query. DeFi vaults are permissionless by design. They cannot distinguish a verified institutional investor from a sanctioned wallet. One wrong transaction creates regulatory exposure for the entire institution.

The result is that institutional capital sits on the sideline. Not because DeFi is too risky, but because the compliance layer does not exist.

Leyfis builds it.

---

## How It Works

### The Core Gate Flow

```
KYC Provider issues signed attestation on Solana
  wallet:       64je...xfb
  tier:         3 (Institutional)
  jurisdiction: CHE
  expires:      2027-03-26
  kyc_ref:      AML-2026-00142

         |
         v

User submits vault interaction
  transaction sent to Leyfis Gate Program
  not directly to the vault

         |
         v

Gate runs 7 checks in fixed order
  01  Gate active          GatePaused check
  02  Attestation exists   NoAttestation check
  03  Not revoked          AttestationRevoked check
  04  Not expired          AttestationExpired check
  05  Issuer trusted       UntrustedIssuer check
  06  Tier sufficient      TierInsufficient check
  07  Jurisdiction valid   JurisdictionBlocked check

         |                           |
    All 7 pass                  Any check fails
         |                           |
         v                           v

  CPI to vault program        Return error with reason code
  instruction forwarded       transaction reverts atomically
  atomically, unchanged       no on-chain footprint created

         |
         v

  AuditEntry written on-chain
  wallet, vault, outcome, tier, attestation ID, slot, timestamp
```

### Attestation Issuance Flow

```
KYC Provider connects issuer wallet to Admin Console
  enters wallet address, tier, jurisdiction, validity, KYC reference
  submits one Solana transaction

Gate Program writes LeyfisAttestation PDA
  derived from [wallet, issuer]
  immutable once written
  revocable only by the issuing wallet

Wallet now carries a portable credential
  valid across any Leyfis-gated vault
  no re-KYC required on each protocol
  one attestation, unlimited access where eligible
```

### Vault Configuration Flow

```
Vault Operator deploys vault program
  calls initialize_vault_config
    min_tier:              3 (Institutional)
    trusted_issuers:       [EDBYT2E8...]
    allowed_jurisdictions: [CHE, DEU, SGP]

Gate Program writes VaultConfig PDA
  all future gate calls read this config

Operator updates rules without a contract upgrade
  update_vault_config(min_tier, trusted_issuers)
  pause_gate() / unpause_gate()
  changes take effect on the next gate call
```

### Audit Trail Flow

```
Every gate call writes an AuditEntry PDA
  indexed by [vault_config, nonce]
  written atomically with the gate result

AuditEntry contains
  wallet          Solana public key
  vault           vault program address
  outcome         Approved | Denied
  reason_code     0 = approved, 1-7 = denial reason
  attestation_id  SAS attestation PDA
  tier            KYC tier at time of gate call
  timestamp       Unix timestamp
  slot            Solana slot number

Compliance Auditor reads the log directly from chain
  no permission request
  no intermediary
  tamper-proof by protocol

One-click FATF R.16 CSV export
  all 11 fields, all records, filterable by date and outcome
  independently verifiable on Solana Explorer
```

---

## The 7 Compliance Checks

Enforced on every gate call, in this exact order. The sequence never changes.

| # | Check | Error | Meaning |
|---|-------|-------|---------|
| 01 | Gate active | `GatePaused` | Operator has paused vault access |
| 02 | Attestation exists | `NoAttestation` | No credential found for this wallet |
| 03 | Not revoked | `AttestationRevoked` | Issuer has revoked this credential |
| 04 | Not expired | `AttestationExpired` | Credential has passed its expiry |
| 05 | Trusted issuer | `UntrustedIssuer` | Issuer not on vault approved list |
| 06 | Tier sufficient | `TierInsufficient` | Wallet tier below vault minimum |
| 07 | Jurisdiction eligible | `JurisdictionBlocked` | Wallet jurisdiction not permitted |

---

## Four Roles

Each role is detected automatically when a wallet connects to the admin console. No passwords. No manual assignment. The wallet is the credential.

```
Super Admin
  Identity:  deployer wallet (VaultConfig authority)
  Can do:    register and revoke issuers, configure vault,
             access all admin screens

Vault Operator
  Identity:  VaultConfig.authority
  Can do:    set min_tier, manage trusted issuers, pause/unpause
             the gate, view audit log, export CSV, monitor live feed

KYC Issuer
  Identity:  wallet registered in IssuerRegistry
  Can do:    issue attestations, revoke attestations,
             view the issuance registry

Compliance Auditor
  Identity:  registered read-only wallet
  Can do:    filter audit log, export FATF R.16 CSV,
             view live gate feed
```

---

## Admin Console

All screens live at [leyfis-admin.netlify.app](https://leyfis-admin.netlify.app).

| Screen | Route | Access |
|--------|-------|--------|
| Login and role detection | `/` | All |
| Vault operator dashboard | `/vault` | Operator, Super Admin |
| Issue attestation | `/issue` | KYC Issuer, Super Admin |
| Attestation registry | `/registry` | KYC Issuer, Super Admin |
| On-chain audit log | `/audit` | All |
| Live gate activity feed | `/feed` | All |
| FATF R.16 compliance export | `/export` | Operator, Auditor, Super Admin |
| Super admin panel | `/superadmin` | Super Admin |

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
    pub tier:           u8,          // attestation tier at gate call time
}
```

### LeyfisAttestation (SAS, read-only)
```rust
pub struct LeyfisAttestation {
    pub wallet:       Pubkey,    // verified wallet address
    pub issuer:       Pubkey,    // KYC provider wallet
    pub tier:         u8,        // 1=retail 2=accredited 3=institutional
    pub issued_at:    i64,
    pub expires_at:   i64,       // 0 = never expires
    pub kyc_ref:      [u8; 32],  // off-chain KYC reference hash
    pub jurisdiction: [u8; 3],   // ISO 3166 country code, e.g. b"CHE"
    pub revoked:      bool,
}
```

---

## Instructions

```rust
// Vault setup, called once by vault operator at deployment
initialize_vault_config(min_tier, trusted_issuers)

// Vault management, callable any time by vault operator
update_vault_config(min_tier, trusted_issuers)
pause_gate()
unpause_gate()

// Issuer management, callable by super admin only
register_issuer(issuer_pubkey, vault_pubkey)
revoke_issuer(issuer_pubkey)

// Core gate, called by end users on every vault interaction
gate(vault_instruction_data)
```

---

## Test Suite

8 Anchor tests, all passing:

```
APPROVED  Wallet with valid Tier 3 attestation passes gate, CPI executes
DENIED    Wallet with no attestation                         NoAttestation
DENIED    Wallet with expired attestation                    AttestationExpired
DENIED    Wallet with revoked attestation                    AttestationRevoked
DENIED    Wallet with Tier 1 on Tier 3 vault                 TierInsufficient
DENIED    Wallet with untrusted issuer                       UntrustedIssuer
DENIED    Gate paused, Tier 3 wallet still rejected          GatePaused
APPROVED  update_vault_config lowers min_tier, denied wallet now passes
```

```bash
docker exec leyfis-dev bash -c "cd /workspace/leyfis-gate && anchor test"
```

---

## Deployed Accounts

| Account | Address |
|---------|---------|
| Gate Program | `Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP` |
| Test Vault | `88x1hxWW6mMDpQQwuR3sCDgnmbHwHmQBdWYZQhcedNaJ` |
| VaultConfig PDA | `B1vJ1Pwo8SGYg5emXoGBgqHQqBEcmBJa83cAfLJjAatj` |
| IssuerRegistry PDA | `F8NXMpzRPpz1C6HpmgMEaBzqeX7aGyRE9w6eKhdBT3zd` |

| Wallet | Role | Address |
|--------|------|---------|
| Deployer | Super Admin | `EGFbgXT1NC1ZGJgv33FRFdzKrKAc5hFLqqydS66eY4ht` |
| Issuer | KYC Issuer | `EDBYT2E8HGEKhTRmHHdrAYUJChi4RUQdbzAmuqB6QALU` |
| Wallet A | End User, Tier 1, denied | `5t1okyeKtcRDQwiq3LT3uSBKQgUEuPTZBBSj15is9fjS` |
| Wallet B | End User, Tier 3, approved | `64je9DfojWKRt3EoxXPcq1DCWqyFNknQ7XWTxF7ekxfb` |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Solana devnet |
| Smart contracts | Rust, Anchor Framework v0.30.1 |
| Credential layer | Solana Attestation Service (SAS) |
| Frontend | Next.js 14, TypeScript |
| Wallet adapter | @solana/wallet-adapter-react |
| On-chain client | @coral-xyz/anchor, @solana/web3.js |
| Deployment | Netlify, two projects, one monorepo |
| Dev environment | Docker Desktop on Windows |
| RPC | Helius devnet |

---

## Local Development

**Prerequisites:** Docker Desktop, Node.js 18+, Rust toolchain

```bash
git clone https://github.com/thinkDecade/leyfis.git
cd leyfis

# Start the dev container
./start.bat

# Build the Gate Program
docker exec leyfis-dev bash -c "cd /workspace/leyfis-gate && anchor build"

# Run all 8 tests
docker exec leyfis-dev bash -c "cd /workspace/leyfis-gate && anchor test"

# Deploy to devnet
docker exec leyfis-dev bash -c "cd /workspace/leyfis-gate && anchor deploy --provider.cluster devnet"

# Start the public app  (localhost:3000)
docker exec -d leyfis-dev bash -c "cd /workspace/app/apps/app && yarn dev"

# Start the admin console  (localhost:3001)
docker exec -d leyfis-dev bash -c "cd /workspace/app/apps/admin && yarn dev"
```

---

## Repository Structure

```
leyfis-protocol/
  programs/
    leyfis-gate/src/lib.rs    Gate Program. 7 instructions, 7 errors, 8/8 tests.
    test-vault/src/lib.rs     Minimal test vault used in demo.
  tests/
    leyfis-gate.ts            Anchor test suite. All passing.
  app/
    apps/app/                 Public portal and landing page.
    apps/admin/               Institutional operations console.
  scripts/
    issue-attestation.ts      CLI for issuing SAS attestations.
  Anchor.toml
  README.md
```

---

## Compliance Alignment

| Standard | Coverage |
|----------|---------|
| FATF R.16 | Audit log captures wallet, vault, timestamp, outcome, tier, attestation ID, and jurisdiction on every gate call. One-click CSV export. |
| FATF R.10 | KYC tier system maps to CDD, Enhanced Due Diligence, and Full Institutional tiers. |
| MiCA | Jurisdiction filtering enforces geographic access control at the protocol level, not in application logic. |
| FINMA | Swiss jurisdiction code CHE is a native field in the attestation schema. |

---

## Design Principles

**Stateless gate.** The Gate Program reads SAS attestations but never caches or stores approval decisions. Every vault interaction is independently verified from current on-chain state.

**Append-only audit log.** AuditEntry accounts are written once and never mutated. Not by the vault operator. Not by Leyfis. Not by anyone.

**Vault-agnostic.** Leyfis wraps any Solana vault via CPI. No vault modification is required. The vault receives the instruction unchanged and has no knowledge of the compliance layer in front of it.

**Separation of roles.** KYC issuers, vault operators, and compliance auditors operate in independent scopes. Leyfis enforces the boundaries between them at the program level.

**Protocol-level enforcement.** Compliance rules live in a Solana program, not in an off-chain API that can fail, be bypassed, or be selectively applied. The rules run on every transaction, without exception.

---

## Roadmap

- Mainnet deployment
- Permissioned attestation schema registry
- Multi-vault operator dashboard
- MiCA Article 68 travel rule compliance module
- SDK for vault developers: `npm install @leyfis/gate-sdk`

---

*Leyfis (Old Norse) — formal grant of clearance. Permission to proceed.*
