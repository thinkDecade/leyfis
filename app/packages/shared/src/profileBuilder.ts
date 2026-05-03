import { Connection, PublicKey } from "@solana/web3.js";

// Inline constants to avoid circular import with index.ts
const GATE_PROGRAM_ID  = "Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP";
const VAULT_PROGRAM_ID = "88x1hxWW6mMDpQQwuR3sCDgnmbHwHmQBdWYZQhcedNaJ";
const RPC_ENDPOINT     = "https://devnet.helius-rpc.com/?api-key=2414c8d2-3eff-4fda-9c74-b8c0f93d768b";
const SEEDS = {
  VAULT_CONFIG:    "vault_config",
  ISSUER_REGISTRY: "issuer_registry",
  ATTESTATION:     "attestation",
  AUDIT_ENTRY:     "audit_entry",
} as const;

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AttestationSummary {
  pda:          string;
  issuer:       string;
  tier:         number;
  jurisdiction: string;
  issued_at:    number;
  expires_at:   number;   // 0 = never expires
  revoked:      boolean;
  status:       "valid" | "expired" | "revoked";
}

export interface VaultFootprint {
  vault:              string;
  first_interaction:  number;
  last_interaction:   number;
  total_calls:        number;
  approved_calls:     number;
  approval_rate:      number;  // 0–1
}

export interface DenialBreakdown {
  no_attestation:       number;
  expired:              number;
  revoked:              number;
  untrusted_issuer:     number;
  tier_insufficient:    number;
  jurisdiction_blocked: number;
  gate_paused:          number;
}

export interface ComplianceProfile {
  entity:      string;
  entity_type: "wallet";

  // Credential summary
  highest_tier:        number;   // 0–3 (0 = no active attestation)
  active_attestations: number;
  attestations:        AttestationSummary[];

  // Behavioural record
  total_gate_calls: number;
  approved_calls:   number;
  denied_calls:     number;
  approval_rate:    number;    // 0–1; -1 if no calls yet
  denial_breakdown: DenialBreakdown;

  // Timeline
  first_seen_timestamp: number | null;
  last_seen_timestamp:  number | null;
  first_seen_slot:      number | null;
  last_seen_slot:       number | null;

  // Vault footprint
  vault_history: VaultFootprint[];

  // Freshness
  profile_timestamp: number;   // unix ts when this profile was computed
}

// ─── Internal raw types ───────────────────────────────────────────────────────

interface RawAuditEntry {
  pda:           string;
  wallet:        string;
  vault:         string;
  timestamp:     number;
  slot:          number;
  outcome:       "approved" | "denied";
  reasonCode:    number;
  attestationId: string;
  tier:          number;
}

interface RawAttestation {
  pda:          string;
  wallet:       string;
  issuer:       string;
  tier:         number;
  issuedAt:     number;
  expiresAt:    number;
  jurisdiction: string;
  revoked:      boolean;
}

// ─── Byte-level decoders ──────────────────────────────────────────────────────
// All offsets are verified against the deployed lib.rs on devnet.

/**
 * AuditEntry layout (total 84 bytes):
 *   [0-7]   discriminator
 *   [8-39]  wallet (Pubkey)
 *   [40-71] vault (Pubkey)
 *   [72-79] timestamp (i64 LE)
 *   [80-87] slot (u64 LE)
 *   [88]    outcome (u8: 0=Approved 1=Denied)
 *   [89]    reason_code (u8)
 *   [90-121] attestation_id (Pubkey)
 *   [122]   tier (u8)
 *   [123]   bump (u8)
 */
function decodeAuditEntry(pda: string, raw: Uint8Array): RawAuditEntry | null {
  try {
    const d = Buffer.from(raw);
    if (d.length < 124) return null;
    return {
      pda,
      wallet:        new PublicKey(d.slice(8,  40)).toBase58(),
      vault:         new PublicKey(d.slice(40, 72)).toBase58(),
      timestamp:     Number(d.readBigInt64LE(72)),
      slot:          Number(d.readBigUInt64LE(80)),
      outcome:       d[88] === 0 ? "approved" : "denied",
      reasonCode:    d[89],
      attestationId: new PublicKey(d.slice(90, 122)).toBase58(),
      tier:          d[122],
    };
  } catch { return null; }
}

/**
 * LeyfisAttestation layout (total 126 bytes):
 *   [0-7]   discriminator
 *   [8-39]  wallet (Pubkey)
 *   [40-71] issuer (Pubkey)
 *   [72]    tier (u8)
 *   [73-80] issued_at (i64 LE)
 *   [81-88] expires_at (i64 LE)
 *   [89-120] kyc_ref ([u8; 32])
 *   [121-123] jurisdiction ([u8; 3])
 *   [124]   revoked (bool)
 *   [125]   bump (u8)
 */
function decodeAttestation(pda: string, raw: Uint8Array): RawAttestation | null {
  try {
    const d = Buffer.from(raw);
    if (d.length < 126) return null;
    return {
      pda,
      wallet:       new PublicKey(d.slice(8,  40)).toBase58(),
      issuer:       new PublicKey(d.slice(40, 72)).toBase58(),
      tier:         d[72],
      issuedAt:     Number(d.readBigInt64LE(73)),
      expiresAt:    Number(d.readBigInt64LE(81)),
      jurisdiction: d.slice(121, 124).toString("ascii").replace(/\0/g, ""),
      revoked:      d[124] !== 0,
    };
  } catch { return null; }
}

/**
 * IssuerRegistry layout:
 *   [0-7]  discriminator
 *   [8-39] authority (Pubkey)
 *   [40-43] issuers Vec length (u32 LE)
 *   [44+]  IssuerEntry * n  (each 73 bytes: pubkey32 + vault32 + registered8 + active1)
 *   Returns active issuer pubkeys only.
 */
function decodeActiveIssuerPubkeys(raw: Uint8Array): string[] {
  try {
    const d   = Buffer.from(raw);
    const cnt = d.readUInt32LE(40);
    const out: string[] = [];
    let o = 44;
    for (let i = 0; i < cnt; i++) {
      const pubkey = new PublicKey(d.slice(o, o + 32)).toBase58();
      const active = d[o + 72] !== 0;   // offset within entry: 32+32+8=72
      if (active) out.push(pubkey);
      o += 73;                           // IssuerEntry::SIZE
    }
    return out;
  } catch { return []; }
}

/**
 * VaultConfig — extract audit_nonce only.
 * Layout after discriminator+auth+vault+min_tier+trusted_issuers_vec+jur_vec:
 *   pOff+0: paused (bool)
 *   pOff+1: registered_at (i64)
 *   pOff+9: audit_nonce (u64)  ← what we need
 */
function decodeAuditNonce(raw: Uint8Array): number {
  try {
    const d           = Buffer.from(raw);
    const issuerCount = d.readUInt32LE(73);
    const jurOff      = 77 + issuerCount * 32;
    const jurCount    = d.readUInt32LE(jurOff);
    const pOff        = jurOff + 4 + jurCount * 3;
    return Number(d.readBigUInt64LE(pOff + 9));
  } catch { return 0; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GATE_PK  = new PublicKey(GATE_PROGRAM_ID);
const VAULT_PK = new PublicKey(VAULT_PROGRAM_ID);

function getVaultConfigPDA(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.VAULT_CONFIG), VAULT_PK.toBuffer()], GATE_PK
  )[0];
}
function getIssuerRegistryPDA(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from(SEEDS.ISSUER_REGISTRY)], GATE_PK)[0];
}
function getAuditEntryPDA(vcPDA: PublicKey, nonce: number): PublicKey {
  const nb = Buffer.alloc(8);
  nb.writeBigUInt64LE(BigInt(nonce));
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.AUDIT_ENTRY), vcPDA.toBuffer(), nb], GATE_PK
  )[0];
}
function getAttestationPDA(wallet: PublicKey, issuer: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.ATTESTATION), wallet.toBuffer(), issuer.toBuffer()], GATE_PK
  )[0];
}

/** Fetch multiple accounts in parallel, batched to avoid RPC rate limits. */
async function fetchAccounts(
  conn: Connection,
  pdas: PublicKey[],
): Promise<Map<string, Uint8Array>> {
  const BATCH = 25;
  const result = new Map<string, Uint8Array>();
  for (let i = 0; i < pdas.length; i += BATCH) {
    const batch = pdas.slice(i, i + BATCH);
    const infos = await Promise.all(batch.map(pda => conn.getAccountInfo(pda).catch(() => null)));
    for (let j = 0; j < batch.length; j++) {
      const info = infos[j];
      if (info && info.data.length >= 8) {
        result.set(batch[j].toBase58(), info.data as Uint8Array);
      }
    }
  }
  return result;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Compute the full compliance bureau profile for a wallet address.
 * Derived entirely from immutable on-chain data — no additional state stored.
 * Any counterparty can independently derive the same profile from the same data.
 *
 * @param entity     Solana wallet pubkey (base58)
 * @param rpcEndpoint  Optional RPC override. Defaults to Helius devnet.
 * @param maxScan    Max audit entries to scan (newest first). Default 500.
 */
export async function getComplianceProfile(
  entity: string,
  rpcEndpoint: string = RPC_ENDPOINT,
  maxScan = 500,
): Promise<ComplianceProfile> {
  const conn      = new Connection(rpcEndpoint, "confirmed");
  const walletKey = new PublicKey(entity);
  const now       = Math.floor(Date.now() / 1000);

  const vcPDA  = getVaultConfigPDA();
  const regPDA = getIssuerRegistryPDA();

  // ── Fetch VaultConfig + IssuerRegistry in parallel ────────────────────
  const [vcInfo, regInfo] = await Promise.all([
    conn.getAccountInfo(vcPDA).catch(() => null),
    conn.getAccountInfo(regPDA).catch(() => null),
  ]);

  const auditNonce   = vcInfo  ? decodeAuditNonce(vcInfo.data as Uint8Array) : 0;
  const issuerPubkeys = regInfo ? decodeActiveIssuerPubkeys(regInfo.data as Uint8Array) : [];

  // ── Scan audit entries (newest first, up to maxScan) ──────────────────
  const scanStart = Math.max(0, auditNonce - maxScan);
  const auditPDAs: PublicKey[] = [];
  for (let n = auditNonce - 1; n >= scanStart; n--) {
    auditPDAs.push(getAuditEntryPDA(vcPDA, n));
  }

  const auditDataMap  = await fetchAccounts(conn, auditPDAs);
  const matchedEntries: RawAuditEntry[] = [];
  for (const [pda, raw] of auditDataMap) {
    const entry = decodeAuditEntry(pda, raw);
    if (entry && entry.wallet === entity) matchedEntries.push(entry);
  }
  matchedEntries.sort((a, b) => b.timestamp - a.timestamp);

  // ── Fetch attestations from all known active issuers ──────────────────
  const attPDAs = issuerPubkeys.map(addr =>
    getAttestationPDA(walletKey, new PublicKey(addr))
  );
  const attDataMap   = await fetchAccounts(conn, attPDAs);
  const attestations: AttestationSummary[] = [];
  for (const [pda, raw] of attDataMap) {
    const att = decodeAttestation(pda, raw);
    if (!att) continue;
    const expired = att.expiresAt > 0 && att.expiresAt < now;
    attestations.push({
      pda:          att.pda,
      issuer:       att.issuer,
      tier:         att.tier,
      jurisdiction: att.jurisdiction,
      issued_at:    att.issuedAt,
      expires_at:   att.expiresAt,
      revoked:      att.revoked,
      status:       att.revoked ? "revoked" : expired ? "expired" : "valid",
    });
  }

  // ── Aggregate ──────────────────────────────────────────────────────────
  const approved = matchedEntries.filter(e => e.outcome === "approved");
  const denied   = matchedEntries.filter(e => e.outcome === "denied");

  const denialBreakdown: DenialBreakdown = {
    no_attestation:       denied.filter(e => e.reasonCode === 1).length,
    expired:              denied.filter(e => e.reasonCode === 2).length,
    revoked:              denied.filter(e => e.reasonCode === 3).length,
    untrusted_issuer:     denied.filter(e => e.reasonCode === 4).length,
    tier_insufficient:    denied.filter(e => e.reasonCode === 5).length,
    jurisdiction_blocked: denied.filter(e => e.reasonCode === 6).length,
    gate_paused:          denied.filter(e => e.reasonCode === 7).length,
  };

  // Per-vault footprint
  const vaultMap = new Map<string, { first: number; last: number; total: number; ok: number }>();
  for (const e of matchedEntries) {
    const ex = vaultMap.get(e.vault);
    if (!ex) {
      vaultMap.set(e.vault, { first: e.timestamp, last: e.timestamp, total: 1,
        ok: e.outcome === "approved" ? 1 : 0 });
    } else {
      ex.total++;
      if (e.outcome === "approved") ex.ok++;
      if (e.timestamp < ex.first) ex.first = e.timestamp;
      if (e.timestamp > ex.last)  ex.last  = e.timestamp;
    }
  }
  const vault_history: VaultFootprint[] = Array.from(vaultMap.entries()).map(([vault, v]) => ({
    vault,
    first_interaction: v.first,
    last_interaction:  v.last,
    total_calls:       v.total,
    approved_calls:    v.ok,
    approval_rate:     v.total > 0 ? v.ok / v.total : 0,
  }));

  const activeAtts  = attestations.filter(a => a.status === "valid");
  const highestTier = activeAtts.length > 0 ? Math.max(...activeAtts.map(a => a.tier)) : 0;
  const total       = matchedEntries.length;

  return {
    entity,
    entity_type: "wallet",

    highest_tier:        highestTier,
    active_attestations: activeAtts.length,
    attestations,

    total_gate_calls: total,
    approved_calls:   approved.length,
    denied_calls:     denied.length,
    approval_rate:    total > 0 ? approved.length / total : -1,
    denial_breakdown: denialBreakdown,

    first_seen_timestamp: total > 0 ? matchedEntries[total - 1].timestamp : null,
    last_seen_timestamp:  total > 0 ? matchedEntries[0].timestamp         : null,
    first_seen_slot:      total > 0 ? matchedEntries[total - 1].slot      : null,
    last_seen_slot:       total > 0 ? matchedEntries[0].slot              : null,

    vault_history,
    profile_timestamp: now,
  };
}
