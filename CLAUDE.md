# LEYFIS — Project Intelligence
> This file is read by Claude Desktop at the start of every session.
> Keep it updated as the build progresses. It is the single source of truth.

---

## What Leyfis Is

Leyfis is an institutional compliance infrastructure that operates on Solana.
It sits between any DeFi vault and the outside world — enforcing KYC/AML access control
at the protocol level via cryptographically signed on-chain attestations.

**Not** a vault. **Not** a KYC provider. **Not** a library.
An institutional product that institutions deploy and their users pass through.

- **app.leyfis.io** — Public demo surface (end users, judges)
- **admin.leyfis.io** — Role-gated operations surface (operators, issuers, auditors, regulators)

**Hackathon:** StableHacks 2026 · Track: Institutional Permissioned DeFi Vaults
**Demo Day:** April 8, 2026 · Zurich
**Build window:** 48 hours from clock start

---

## Repository Structure

```
leyfis-protocol/
├── CLAUDE.md                          ← this file — update as you build
├── README.md
├── programs/
│   ├── leyfis-gate/                   ← Gate Program (Rust/Anchor)
│   │   └── src/
│   │       └── lib.rs
│   └── test-vault/                    ← Test vault for demo wrapping
│       └── src/
│           └── lib.rs
├── tests/
│   └── leyfis-gate.ts                 ← Anchor test suite (8 test cases)
├── scripts/
│   └── issue-attestation.ts           ← CLI: issue SAS attestation to wallet
├── app/                               ← Next.js monorepo
│   ├── src/app/page.tsx               ← app.leyfis.io (public demo)
│   └── src/app/admin/page.tsx         ← admin.leyfis.io (role-gated)
├── Anchor.toml
└── package.json
```

---

## Architecture

```
OFF-CHAIN
  KYC Provider (AMINA Bank / Blockpass / mock issuer)
    └── Issues SAS attestation to wallet pubkey

ON-CHAIN — Leyfis Gate Program
  User wallet submits tx to Gate Program
    └── 1. Check VaultConfig.paused → if true: reject (GatePaused)
    └── 2. Derive SAS PDA from [wallet_pubkey, issuer_pubkey, schema_uid]
    └── 3. Read LeyfisAttestation account
    └── 4. Validate: exists → not revoked → not expired → trusted issuer → tier >= min_tier
    └── 5a. PASS: CPI to target vault with original accounts + instruction data
    └── 5b. FAIL: return LeyfisError with reason code
    └── 6. Write AuditEntry (ALWAYS — approved and denied)

STORAGE
  AuditLog account — append-only, publicly readable, never mutable
  IssuerRegistry account — maps issuer pubkeys to authorised roles
```

---

## Program IDs

```
Gate Program:    [PENDING — update after: anchor deploy --provider.cluster devnet]
Test Vault:      [PENDING — update after deploy]
Network:         devnet
RPC Endpoint:    [PENDING — paste Helius/QuickNode endpoint here]
```

**Update these immediately after every deploy. Do not proceed without recording them.**

---

## Wallet Addresses

```
Deployer wallet (super admin):    [PENDING]
Demo Wallet A (no attestation):   [PENDING]
Demo Wallet B (Tier 3 / AMINA):   [PENDING]
Admin wallet (vault operator):    [PENDING]
KYC Issuer wallet:                [PENDING]
```

---

## Account Structs — Exact Specification

### VaultConfig
```rust
pub struct VaultConfig {
    pub authority:             Pubkey,       // vault operator — only this wallet can mutate
    pub vault_program:         Pubkey,       // target vault program ID
    pub min_tier:              u8,           // minimum attestation tier required (1/2/3)
    pub trusted_issuers:       Vec<Pubkey>,  // approved attestation issuers for this vault
    pub allowed_jurisdictions: Vec<[u8; 3]>, // ISO 3166 codes — empty = all allowed
    pub paused:                bool,         // NEW v1.1 — gate checks this first
    pub registered_at:         i64,          // Unix timestamp of vault registration
    pub bump:                  u8,
}
```

### AuditEntry
```rust
pub struct AuditEntry {
    pub wallet:         Pubkey,         // wallet that attempted vault interaction
    pub vault:          Pubkey,         // target vault program ID
    pub timestamp:      i64,            // Unix timestamp
    pub slot:           u64,            // Solana slot number
    pub outcome:        GateOutcome,    // Approved | Denied
    pub reason_code:    u8,             // see reason codes below
    pub attestation_id: Pubkey,         // SAS attestation PDA (or default if none found)
    pub tier:           u8,             // attestation tier (0 if no attestation)
}

// reason_code values
// 0 = approved
// 1 = NoAttestation
// 2 = AttestationExpired
// 3 = AttestationRevoked
// 4 = UntrustedIssuer
// 5 = TierInsufficient
// 6 = JurisdictionBlocked
// 7 = GatePaused
```

### IssuerRegistry
```rust
pub struct IssuerRegistry {
    pub authority: Pubkey,           // super admin (deployer wallet)
    pub issuers:   Vec<IssuerEntry>,
}

pub struct IssuerEntry {
    pub pubkey:      Pubkey,         // issuer wallet address
    pub vault:       Pubkey,         // vault they're authorised for
    pub registered:  i64,            // Unix timestamp
    pub active:      bool,           // false = revoked
}
```

### LeyfisAttestation (SAS account — read only, never written by Gate Program)
```rust
pub struct LeyfisAttestation {
    pub wallet:       Pubkey,        // verified wallet address
    pub issuer:       Pubkey,        // trusted issuer (e.g. AMINA Bank wallet)
    pub tier:         u8,            // 1=retail 2=accredited 3=institutional
    pub issued_at:    i64,           // Unix timestamp
    pub expires_at:   i64,           // Unix timestamp — 0 = never expires
    pub kyc_ref:      [u8; 32],      // off-chain KYC reference hash (privacy-preserving)
    pub jurisdiction: [u8; 3],       // ISO 3166 country code e.g. b"CHE"
    pub revoked:      bool,          // issuer can flip this at any time
}
```

---

## Complete Instruction Set

### Original (v1.0)
```rust
// Called once by vault operator at deployment
initialize_vault_config(
    min_tier: u8,
    trusted_issuers: Vec<Pubkey>,
) -> Result<()>

// Core gate — called by end users on every vault interaction
gate(
    vault_instruction_data: Vec<u8>,  // forwarded to vault via CPI if approved
) -> Result<()>
```

### New (v1.1 — admin layer)
```rust
// Vault operator: update settings post-deploy
update_vault_config(
    min_tier: Option<u8>,
    trusted_issuers: Option<Vec<Pubkey>>,
) -> Result<()>

// Vault operator: emergency kill switch
pause_gate() -> Result<()>
unpause_gate() -> Result<()>

// Super admin / operator: manage issuer registry
register_issuer(
    issuer_pubkey: Pubkey,
    vault_pubkey: Pubkey,
) -> Result<()>

revoke_issuer(
    issuer_pubkey: Pubkey,
) -> Result<()>
```

---

## Error Codes

```rust
#[error_code]
pub enum LeyfisError {
    #[msg("Gate is paused by vault operator")]
    GatePaused,              // reason_code: 7

    #[msg("No attestation found for this wallet")]
    NoAttestation,           // reason_code: 1

    #[msg("Attestation has expired")]
    AttestationExpired,      // reason_code: 2

    #[msg("Attestation has been revoked")]
    AttestationRevoked,      // reason_code: 3

    #[msg("Issuer not in trusted issuers list")]
    UntrustedIssuer,         // reason_code: 4

    #[msg("Clearance tier insufficient for this vault")]
    TierInsufficient,        // reason_code: 5

    #[msg("Wallet jurisdiction not permitted for this vault")]
    JurisdictionBlocked,     // reason_code: 6
}
```

---

## Validation Order in gate() — Never Change This

```
1. Check VaultConfig.paused           → return GatePaused
2. Derive SAS PDA                     → derive from [wallet, issuer, schema_uid]
3. Load attestation account           → return NoAttestation if missing
4. Check attestation.revoked          → return AttestationRevoked
5. Check attestation.expires_at       → return AttestationExpired
6. Check issuer in trusted_issuers    → return UntrustedIssuer
7. Check tier >= min_tier             → return TierInsufficient
8. Check jurisdiction if configured   → return JurisdictionBlocked
9. Write AuditEntry (outcome=Denied, reason_code=N) on any failure above
10. Execute CPI to vault_program
11. Write AuditEntry (outcome=Approved, reason_code=0)
```

---

## Four Admin Roles

| Role | Wallet identity | Key capabilities |
|------|----------------|------------------|
| Super Admin | Deployer wallet | Register operators/issuers, global whitelist, full read |
| Vault Operator | VaultConfig.authority | Config vault, pause/unpause, view audit log |
| KYC Issuer | IssuerRegistry entry | Issue/revoke attestations, view issued attestations |
| Compliance Auditor | Registered read-only wallet | Filter log, export FATF CSV, no write access |

---

## Eight Admin Screens (admin.leyfis.io)

| # | Screen | Role(s) | Priority |
|---|--------|---------|----------|
| 0 | Role detection gate | All | CRITICAL |
| 1 | Protocol overview | Super Admin | DEMO DAY |
| 2 | Vault operator dashboard | Operator | DEMO DAY |
| 3 | Attestation issuer panel | KYC Issuer | DEMO DAY |
| 4 | Active attestations registry | KYC Issuer | DEMO DAY |
| 5 | Audit log explorer | Operator / Issuer / Auditor | DEMO DAY |
| 6 | Real-time gate activity feed | Operator / Issuer / Auditor | DEMO DAY |
| 7 | Compliance report exporter | Operator / Auditor | DEMO DAY |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Solana devnet (mainnet post-hackathon) |
| Smart contracts | Rust + Anchor Framework v0.30+ |
| Credential layer | Solana Attestation Service (SAS) — mainnet since May 2025 |
| Frontend | Next.js 14 + TypeScript |
| Wallet adapter | @solana/wallet-adapter-react |
| On-chain client | @coral-xyz/anchor + @solana/web3.js |
| Real-time feed | Solana WebSocket (connection.onLogs) |
| Deployment | Vercel (two projects: app + admin, one monorepo) |
| AI partner | Claude Desktop with MCP (Filesystem + Desktop Commander + GitHub + Memory) |

---

## Brand System

```
Primary bg:   #0A0F1C  (Void — dark navy)
Primary text: #E8EEF6  (Ice — near white)
Approved:     #0F6E56  (Teal — access granted)
Denied:       #7A1F1F  (Crimson — access rejected)
Muted text:   #3D5070  (Horizon)
Secondary:    #8899BB  (Frost)
Light bg:     #F7F8FA  (for documents / light surfaces)

Font: Arial (all weights)
Wordmark: LEYFIS in all-caps, tracking +220
```

---

## Anchor Test Cases — All 8 Must Pass

```typescript
// 1. APPROVED: wallet with valid Tier 3 attestation passes gate
// 2. DENIED:   wallet with no attestation → NoAttestation error
// 3. DENIED:   wallet with expired attestation → AttestationExpired error
// 4. DENIED:   wallet with revoked attestation → AttestationRevoked error
// 5. DENIED:   wallet with Tier 1 attestation on Tier 3 vault → TierInsufficient error
// 6. DENIED:   wallet with attestation from untrusted issuer → UntrustedIssuer error
// 7. DENIED:   gate paused by operator → GatePaused error (even Tier 3 wallet rejected)
// 8. APPROVED: update_vault_config lowers min_tier → previously rejected wallet now passes
```

---

## Demo Day Script — 4-Role Story (5 minutes total)

```
ROLE 1 — Super Admin (your deployer wallet) — 30 seconds
  Open admin.leyfis.io → protocol overview
  Register a new issuer wallet live on-chain
  Show: 1 vault registered, 1 issuer registered

ROLE 2 — KYC Issuer (issuer wallet) — 45 seconds
  Switch to issuer wallet in admin panel
  Issue Tier 3 institutional attestation to Demo Wallet B
  → wallet: [Wallet B pubkey], tier: 3, expiry: 12 months, jurisdiction: CHE
  Show attestation appear in active registry

ROLE 3 — End User — 60 seconds
  Open app.leyfis.io in new tab
  Wallet A: click "Interact with Vault" → ACCESS DENIED (NoAttestation)
  Wallet B: click "Interact with Vault" → ACCESS GRANTED
  Show both AuditEntries appear in admin live feed simultaneously

ROLE 4 — Vault Operator (admin wallet) — 45 seconds
  Switch to operator wallet in admin panel
  Dashboard: 2 gate calls, 50% approval, 1 denied
  Change min_tier to Institutional live → save on-chain
  Show audit log filtered by "denied"

ROLE 5 — Compliance Auditor — 30 seconds
  Switch to auditor wallet
  Filter audit log: today, all outcomes
  Export CSV → open spreadsheet
  Show FATF R.16 fields: wallet, timestamp, outcome, tier, attestation_id, jurisdiction
  "This is what you hand to FINMA."
```

---

## Rules Claude Must Follow During the 48-Hour Build

### Code rules
- **Never change account structs without flagging it explicitly** — struct changes break deserialization across all tests and scripts
- **Always write AuditEntry on BOTH approve and deny paths** — this is the compliance guarantee; missing it breaks the FATF story
- **Always validate in this exact order:** paused → exists → not revoked → not expired → issuer → tier → jurisdiction
- **Never expose a mutation instruction on AuditLog** — it must be append-only; judges and regulators must be able to trust it
- **Gate Program must be stateless with respect to approval** — only reads SAS, never caches or stores approval decisions
- **All instructions must be authority-checked** — no instruction should be callable by an arbitrary wallet
- **CPI accounts must include all accounts the vault instruction requires** — use remaining_accounts for vault CPI

### Workflow rules
- **One conversation per module** — Gate Program, Test Vault, Frontend, Admin Panel, Tests each get their own conversation
- **Paste-back loop for debugging** — always include current code + exact error + what was tried
- **Run anchor build before anchor test** — never skip the build step
- **Record program IDs in this file immediately after every deploy** — never proceed with PENDING IDs in production code
- **Security review before every devnet deploy** — paste full lib.rs and ask for: unauthorised callers, missing account constraints, CPI safety, Softstack audit readiness

### Scope rules
- **Never add features not in the PRD during the 48-hour build**
- **Cut scope in this order if behind:** animations → mobile responsive → attestation registry UI → WebSocket feed (use polling) → super admin screen → jurisdiction filtering
- **Never cut:** gate() instruction, 8 Anchor tests, two-wallet demo panel, KYC issuer panel, operator dashboard, audit log explorer, CSV export

### Quality gates — do not cross these without passing
- **H6:**  anchor build green · 4 wallets funded · SAS docs read
- **H18:** anchor test passes all 8 · gate deployed to devnet · program ID recorded
- **H30:** full E2E flow verified in CLI · pause tested · audit log populated on devnet
- **H42:** app.leyfis.io live · admin.leyfis.io live · all 4 roles testable end-to-end
- **H45:** CODE FREEZE — no new features after this point

---

## Current Build Stage

```
[ ] Phase 1 — Environment setup        (H0–H6)
[ ] Phase 2 — Gate program             (H6–H18)
[ ] Phase 3 — Integration layer        (H22–H30)
[ ] Phase 4 — Frontend + admin panel   (H30–H42)
[ ] Phase 5 — Polish + submit          (H45–H48)
```

**Update the [ ] to [x] as phases complete.**

---

## Open Issues & Decisions Log

```
[Add any unresolved decisions, bugs, or architectural questions here as you build]
[Format: DATE TIME — ISSUE — RESOLUTION or PENDING]

Example:
2026-03-23 09:00 — SAS schema_uid format unclear from docs — PENDING investigation
```

---

## Useful Commands

```bash
# Build
anchor build

# Test (run from repo root)
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Check account on devnet
solana account [PROGRAM_ID] --url devnet

# Fund wallet from devnet faucet
solana airdrop 2 [WALLET_ADDRESS] --url devnet

# Check wallet balance
solana balance [WALLET_ADDRESS] --url devnet

# View logs
solana logs --url devnet [PROGRAM_ID]
```

---

*Leyfis (Old Norse) — formal grant of clearance. Permission to proceed.*
*PRD v1.1 · StableHacks 2026 · Build window: 48 hours*
