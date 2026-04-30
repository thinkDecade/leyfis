# LEYFIS — Living Build Document
**Last updated:** 2026-04-30  
**Repo:** https://github.com/thinkDecade/leyfis (private)  
**Live:** https://leyfis-app.netlify.app · https://leyfis-admin.netlify.app  
**Deadline:** Colosseum Frontier Hackathon — May 11, 2026  
**Active branch:** `phase/1-foundation` → merge to `main` when clean

> This document is the single source of truth for build state, feature progress, and session context.  
> Read this at the start of every session before touching any file.  
> Update it at the end of every session before stopping.

---

## What Leyfis Is

Institutional compliance infrastructure on Solana. A protocol-level gate that sits between any DeFi vault and the outside world — enforcing KYC/AML access control via cryptographically signed on-chain attestations.

**Three layers:**
1. **Gate Program** — Anchor program on Solana. Every vault interaction passes through it. Bypass is architecturally impossible.
2. **Admin Platform** (`admin.leyfis.io`) — Role-gated operations console for Super Admins, Vault Operators, KYC Issuers, Compliance Auditors.
3. **Intelligence Layer** — AI agents that read audit data, generate FATF reports, monitor regulatory feeds, and propose vault parameter updates. AI proposes. Operator signs. Chain enforces.

**One sentence:** Leyfis is the missing enforcement layer between KYC issuers and DeFi vaults on Solana — and the compliance layer for the entire Solana AI agent economy.

---

## System State — Verified 2026-04-30

### Program IDs
```
Gate Program:    Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP  ← LIVE on devnet ✅
Test Vault:      88x1hxWW6mMDpQQwuR3sCDgnmbHwHmQBdWYZQhcedNaJ
Network:         Solana devnet
RPC:             https://devnet.helius-rpc.com/?api-key=2414c8d2-3eff-4fda-9c74-b8c0f93d768b
```

### PDAs
```
VaultConfig PDA:    B1vJ1Pwo8SGYg5emXoGBgqHQqBEcmBJa83cAfLJjAatj  ← initialized ✅
IssuerRegistry PDA: F8NXMpzRPpz1C6HpmgMEaBzqeX7aGyRE9w6eKhdBT3zd  ← initialized ✅
```

### Wallet Addresses (keys in `keys/` — gitignored)
```
deployer  (super admin):   EGFbgXT1NC1ZGJgv33FRFdzKrKAc5hFLqqydS66eY4ht  — 1.29 SOL
issuer    (KYC issuer):    EDBYT2E8HGEKhTRmHHdrAYUJChi4RUQdbzAmuqB6QALU  — 0.97 SOL
wallet-a  (no attest.):   5t1okyeKtcRDQwiq3LT3uSBKQgUEuPTZBBSj15is9fjS  — 2.00 SOL
wallet-b  (Tier 3/CHE):   64je9DfojWKRt3EoxXPcq1DCWqyFNknQ7XWTxF7ekxfb  — 0.96 SOL
auditor   (read-only):     DKF6Ey3KwCKE2bJGyoJpfeaonyfpkfZNHianQpAjF6uG  — 0.50 SOL
```

### Wallet B Attestation (demo critical)
```
PDA:         3LY931C2fvNwFpt58WSW3e2wvNanne31siPTvZUzL6Ku
Tier:        3 (Institutional)
Jurisdiction: CHE
Issued:      2026-03-25
Expires:     2027-03-25  (329 days remaining)
Revoked:     false
Status:      VALID ✅
```

### Dev Environment
```
Docker container:  leyfis-dev  (start via Docker Desktop)
Solana CLI:        3.1.10
Anchor CLI:        0.30.1
Exec into:         docker exec leyfis-dev bash
Workspace:         /workspace
Keys:              /workspace/keys/
```

---

## Repository Structure

```
leyfis-protocol/
├── LEYFIS_BUILD.md                          ← THIS FILE — update every session
├── CLAUDE.md                                ← project ground truth (also keep updated)
├── programs/
│   ├── leyfis-gate/src/lib.rs               ← COMPLETE — 10 instructions, 506 lines
│   └── test-vault/src/lib.rs                ← COMPLETE — CPI target vault
├── tests/leyfis-gate.ts                     ← COMPLETE — 8 test cases (need green run)
├── scripts/
│   ├── init.ts                              ← CLI: initialize vault + registry
│   ├── issue-attestation.ts                 ← CLI: issue attestation to any wallet
│   └── issue-wb.ts                          ← CLI: issue Tier 3 to wallet-b
├── app/
│   ├── apps/admin/src/app/
│   │   ├── page.tsx                         ← role detection + dashboard home
│   │   ├── vault/page.tsx                   ← vault operator dashboard ✅ WIRED
│   │   ├── issue/page.tsx                   ← KYC issuer panel ✅ WIRED
│   │   ├── registry/page.tsx                ← attestation registry
│   │   ├── audit/page.tsx                   ← audit log + CSV link (no AI report yet)
│   │   ├── feed/page.tsx                    ← real-time gate feed
│   │   ├── export/page.tsx                  ← FATF CSV export
│   │   ├── superadmin/page.tsx              ← super admin overview
│   │   ├── regulatory/page.tsx              ← ❌ NOT YET BUILT
│   │   └── timemachine/page.tsx             ← ❌ NOT YET BUILT
│   ├── apps/app/src/app/
│   │   ├── page.tsx                         ← public landing page
│   │   └── portal/page.tsx                  ← two-wallet demo (preflight partial)
│   └── packages/shared/src/
│       ├── index.ts                         ← constants, types, helpers
│       └── txBuilders.ts                    ← ✅ NEW — manual instruction builders
└── Dockerfile.dev
```

---

## Feature Status

### ✅ Complete

**Gate Program**
- All 10 instructions implemented and deployed on devnet
- Validation order fixed (paused → exists → not revoked → not expired → issuer → tier → jurisdiction)
- AuditEntry written on both approve and deny paths — never skipped
- GateEvent emitted on every gate call for WebSocket subscriptions
- Authority checks on all mutation instructions

**Test Vault** — CPI target for demo, complete

**8 Anchor Tests** — all written, need a green `anchor test` run to confirm still passing

**`txBuilders.ts`** — manual Anchor instruction builders, no IDL dependency
- All 9 discriminators (sha256 verified)
- PDA helpers: findVaultConfigPDA, findIssuerRegistryPDA, findAttestationPDA, findAuditEntryPDA
- Instruction builders: pause, unpause, updateVaultConfig, issueAttestation, revokeAttestation, registerIssuer, revokeIssuer
- `sendAdminTx` helper

**Admin Panel — wired screens**
- Role detection gate — on-chain, no server
- Vault operator dashboard — pause/unpause/tier all call real on-chain tx
- KYC issuer panel — issues real on-chain attestations via txBuilders
- Attestation registry — reads devnet data
- Audit log explorer — reads AuditEntry PDAs
- Real-time feed — WebSocket subscription to gate program logs
- FATF CSV export — generates compliant CSV from AuditEntry data
- Super admin overview

**Public App**
- Landing page
- Two-wallet demo panel (portal) — Wallet A denied, Wallet B approved

**On-chain state (devnet)**
- VaultConfig initialized ✅
- IssuerRegistry initialized ✅
- Wallet B: Tier 3, CHE, valid 329 days ✅
- All 5 demo wallets funded ✅

---

### 🔴 Not Yet Built — Priority Order

---

#### PRIORITY 1 — Leyfis MCP Server
**Why first:** MCPay won $25K at Cypherpunk for MCP payment infrastructure. Beneat MCP won for agent risk enforcement. Leyfis MCP is the compliance equivalent. Repositions the entire product from "bank tool" to "compliance layer for the Solana agent economy." Every autonomous trading bot and portfolio manager becomes a potential consumer.

**What to build:**
- New package: `app/packages/leyfis-mcp/`
- Node.js server using `@modelcontextprotocol/sdk`
- 5 read-only tools:
  - `check_compliance(wallet, vault)` — simulate gate validation, return pass/fail + reason code
  - `get_audit_log(vault, from, to, limit)` — fetch AuditEntry PDAs
  - `get_vault_config(vault)` — read VaultConfig
  - `get_attestation(wallet, issuer?)` — read LeyfisAttestation
  - `get_regulatory_proposals(vault, status?)` — return pending proposals
- Deploy to Railway or Fly.io free tier
- Test with Claude Desktop: "Check if wallet X would pass the AMINA vault"

**Files to create:**
- `app/packages/leyfis-mcp/src/server.ts`
- `app/packages/leyfis-mcp/package.json`

---

#### PRIORITY 2 — AI Compliance Report Generator
**Why second:** Single Anthropic API call against existing audit log data. Highest impact-to-build-time ratio. Demo moment: 3 days of manual report writing → 10 seconds. Judges understand this immediately.

**What to build:**
- Add "Generate Compliance Report" button to `audit/page.tsx`
- Read current `entries` array → serialize to JSON
- Call Anthropic API (`claude-sonnet-4-5-20251001`)
- Stream FATF R.16 narrative report into styled panel below table
- "Export .txt" and "Copy" buttons
- System prompt: FATF compliance analyst, 6-section report structure

**Files to modify:**
- `app/apps/admin/src/app/audit/page.tsx`

**Key detail:** Anthropic API key must be server-side. Use a Next.js API route (`/api/compliance-report`) to proxy the call — never expose the key in client code.

---

#### PRIORITY 3 — Regulatory Intelligence Agent + Proposal Queue
**Why third:** Forward-looking angle. Not just reporting what happened — detecting what's changing and proposing what to do. One seed FATF proposal is enough for the demo. Turns Leyfis from a tool into a platform.

**What to build:**
- New admin screen: `app/apps/admin/src/app/regulatory/page.tsx`
- Add nav entry to `AdminShell.tsx`: `{ label: "Regulatory", href: "/regulatory", icon: Globe, roles: ["super_admin","vault_operator"] }`
- Proposal Queue: cards with source, summary, proposed change, urgency, Apply/Dismiss buttons
- Apply → previews `update_vault_config` delta → operator signs on-chain
- Dismiss → marks dismissed with optional note, persists in localStorage
- Seed with 1 realistic FATF CHE proposal on first render
- "Scan Regulatory Updates" button → calls Claude API → top 3 relevant developments for the vault's jurisdictions

**RegulatoryProposal type** (defined in spec Section 9.1 — replicate exactly)

**Files to create/modify:**
- `app/apps/admin/src/app/regulatory/page.tsx` — new
- `app/apps/admin/src/components/AdminShell.tsx` — add nav entry

---

#### PRIORITY 4 — Pre-Flight Compliance Simulator
**Why fourth:** Partially built. Validation logic exists in `portal/page.tsx`. Completing it is mostly UI wiring. Doubles as the developer tool story — agents call `check_compliance` before spending SOL on a transaction that will fail.

**Current state:** `portal/page.tsx` has the gate validation logic (NoAttestation, TierInsufficient checks) but the "Check My Access" button/card UI per spec is not complete.

**What to build:**
- "Check My Access" card above the two-wallet panel in `portal/page.tsx`
- Read VaultConfig + derive attestation PDA + run 8-step validation in TypeScript
- Display: green pass card (tier, jurisdiction, expiry) or red denial card (reason + resolution instructions)
- Read-only, no transaction, no gas

**Files to modify:**
- `app/apps/app/src/app/portal/page.tsx`

---

#### PRIORITY 5 — Natural Language Vault Configuration
**Why fifth:** Strong product story for banks — compliance officers don't think in `min_tier: 3`. One Claude API call translates plain English to `update_vault_config` parameters. Prevents configuration errors. Banks misconfigure compliance systems constantly.

**What to build:**
- Text input in `vault/page.tsx` operator dashboard: "Describe your compliance rules in plain English"
- On submit: call Claude API with current vault config + operator input
- Claude returns structured JSON: `{ proposed_delta: { min_tier, allowed_jurisdictions }, explanation, warnings }`
- Preview panel shows exact diff
- "Apply" → constructs `update_vault_config` tx → operator signs
- "Cancel" → discards, no tx

**Files to modify:**
- `app/apps/admin/src/app/vault/page.tsx`

---

#### PRIORITY 6 — Compliance Time Machine
**Why sixth:** Most architecturally unique feature Leyfis can offer — no other compliance system can do this because they overwrite state. But most complex to build and hardest to explain in a 3-minute pitch. Build if time permits after #1–5.

**What to build:**
- New admin screen: `app/apps/admin/src/app/timemachine/page.tsx`
- Date-time picker → "Reconstruct State"
- Fetch all `update_vault_config`, `pause_gate`, `unpause_gate` txns via `getSignaturesForAddress`
- Replay config changes in sequence up to selected timestamp
- Show: what min_tier was active, which issuers trusted, paused state
- Historical wallet query: "Would this wallet have passed at [timestamp]?"

**Files to create:**
- `app/apps/admin/src/app/timemachine/page.tsx`

---

### 💡 Suggestions — Consider Adding

These are not in the spec but strengthen the submission:

1. **Protocol fee treasury PDA** — Collect 0.001 SOL per approved gate call. Even if only a few calls happen on devnet, showing a treasury balance makes the business model tangible to judges.

2. **Wallet B "why it works" breakdown** — On the portal page, after Wallet B passes, show a breakdown card: "Tier 3 ≥ min_tier 3 ✓ · CHE jurisdiction allowed ✓ · Issuer trusted ✓ · Not expired ✓ · Not revoked ✓". Makes the compliance logic visible to non-technical judges.

3. **Live gate call counter on landing page** — Pull `auditNonce` from VaultConfig and display "X total gate calls enforced" on `app.leyfis.io`. Social proof, updates in real-time, costs nothing to build.

4. **MCP server Claude Desktop demo script** — A pre-written sequence of prompts to run in Claude Desktop during the tech demo video. Shows the MCP integration working end-to-end without improvising live.

---

## Build Sprint — 11 Days to May 11

| Days | Feature | Branch | Status |
|------|---------|--------|--------|
| 1–3 | MCP Server — 5 tools, deploy | `feature/mcp-server` | ⬜ Not started |
| 3–5 | AI Compliance Report Generator | `feature/ai-reports` | ⬜ Not started |
| 5–7 | Regulatory Intelligence Agent | `feature/regulatory-intel` | ⬜ Not started |
| 7–8 | Pre-flight Simulator | `feature/preflight` | ⬜ Not started |
| 8–9 | Natural Language Vault Config | `feature/nl-config` | ⬜ Not started |
| 9–10 | Compliance Time Machine | `feature/timemachine` | ⬜ Not started |
| 10–11 | Submission prep | `main` | ⬜ Not started |

---

## Session Log

### 2026-04-30 — Session 1 (Claude Code)
**What was done:**
- Set up proper branching workflow — `phase/1-foundation` branch created
- Applied 4 pending file changes from previous Claude session:
  - Created `txBuilders.ts` — manual instruction builders, all 9 discriminators
  - Wired `vault/page.tsx` — replaced 3 `setTimeout` mocks with real `pause_gate`, `unpause_gate`, `update_vault_config` calls
  - Fixed `issue/page.tsx` — replaced broken `/api/idl` fetch with `buildIssueAttestationIx` + `findAttestationPDA`
  - Updated `shared/index.ts` — added `export * from "./txBuilders"`
- Added `.gitattributes` — fixed CRLF/LF line ending noise on Windows
- Verified gate program `Cskp4zg7...` is live on devnet (executable: true) via Helius RPC
- Confirmed program ID mismatch from handover doc is resolved — `lib.rs` already correct
- Updated `CLAUDE.md` — cleared all `[PENDING]` values, recorded real IDs
- Started Docker Desktop, confirmed `leyfis-dev` container running
- Verified all 5 wallet pubkeys, funded deployer (1.29 SOL) and auditor (0.5 SOL) via transfer from issuer
- Decoded Wallet B attestation — Tier 3, CHE, valid 329 days ✅
- Confirmed VaultConfig and IssuerRegistry PDAs both initialized on devnet
- Full feature audit against spec — identified all 6 AI features as not yet built
- Created prioritized build plan (Priority 1–6) with 11-day sprint schedule
- Created this build document

**Commits on `phase/1-foundation`:**
- `80f9e99` feat: wire real on-chain tx builders, fix mocked vault handlers and broken IDL fetch
- `ef2bbe3` docs: update CLAUDE.md — confirm program IDs live on devnet, fix hackathon metadata

**Next session should start with:**
1. Merge `phase/1-foundation` → `main` (create PR on GitHub)
2. Create `feature/mcp-server` branch
3. Build the Leyfis MCP Server (Priority 1)

---

## Inviolable Rules

These do not change. Read before touching any file.

**On-chain:**
- Account struct field order is fixed — changing it breaks all deserialization
- AuditEntry has no update or delete instruction — append-only forever
- AuditEntry written on BOTH approve and deny paths — never conditional
- Validation order is fixed — never reorder (paused → exists → revoked → expired → issuer → tier → jurisdiction)
- Gate is stateless — reads attestation on every call, never caches

**Frontend:**
- `/api/idl` does not exist — never try to fetch it
- All instruction encoding uses `txBuilders.ts` — never Anchor IDL in browser code
- Both apps on Netlify — not Vercel
- Admin role detection is fully on-chain — no server, no database
- Anthropic API key is server-side only — never in client code

**AI layer:**
- AI never signs, broadcasts, or initiates any transaction
- Every on-chain change requires human operator to review and sign
- Proposals are text + parameter JSON only — never pre-signed
- Audit log data passed to AI contains wallet pubkeys only — public chain data

---

## Open Issues

```
2026-04-30 — anchor test not run yet this session
  Action: docker exec leyfis-dev bash -c "cd /workspace && anchor test"
  Must be green before recording demo videos.

2026-04-30 — Anthropic API key not yet added to admin app
  Needed for: AI Compliance Report Generator, Regulatory Intel, NL Config
  Action: add ANTHROPIC_API_KEY to Netlify environment variables for admin app
  Never commit to repo.

2026-04-30 — Netlify auto-deploy not verified after today's changes
  Action: check leyfis-admin.netlify.app reflects vault/page.tsx and issue/page.tsx fixes
  Should be automatic from main branch push.

2026-04-30 — phase/1-foundation not yet merged to main
  Action: create PR on GitHub, merge, then start feature/mcp-server branch.

2026-04-30 — issuer wallet balance low after funding transfers (0.97 SOL)
  Monitor: if issuer drops below 0.5 SOL, airdrop or transfer from wallet-a
  Command: docker exec leyfis-dev bash -c "solana airdrop 2 EDBYT2E8HGEKhTRmHHdrAYUJChi4RUQdbzAmuqB6QALU --url devnet"
```

---

*Leyfis — institutional compliance infrastructure for Solana.*  
*Build document maintained by Claude Code. Update at the end of every session.*
