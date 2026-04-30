import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  Connection, PublicKey, Keypair, Transaction, TransactionInstruction,
  SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { readFileSync } from "fs";
import * as crypto from "crypto";

// ── Config ────────────────────────────────────────────────────────────────────

const RPC    = process.env.LEYFIS_RPC    ?? "https://devnet.helius-rpc.com/?api-key=2414c8d2-3eff-4fda-9c74-b8c0f93d768b";
const GATE   = new PublicKey(process.env.LEYFIS_GATE_PROGRAM ?? "Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP");
const VAULT  = new PublicKey(process.env.LEYFIS_VAULT_PROGRAM ?? "88x1hxWW6mMDpQQwuR3sCDgnmbHwHmQBdWYZQhcedNaJ");

const conn = new Connection(RPC, "confirmed");

function loadKeypair(): Keypair | null {
  const path = process.env.LEYFIS_KEYPAIR_PATH;
  const json = process.env.LEYFIS_KEYPAIR_JSON;
  if (json) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(json)));
  if (path) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
  return null;
}

// ── PDA helpers ───────────────────────────────────────────────────────────────

const [vaultConfigKey] = PublicKey.findProgramAddressSync([Buffer.from("vault_config"), VAULT.toBuffer()], GATE);
const [registryKey]    = PublicKey.findProgramAddressSync([Buffer.from("issuer_registry")], GATE);
const [treasuryKey]    = PublicKey.findProgramAddressSync([Buffer.from("treasury")], GATE);
const [treasuryCfgKey] = PublicKey.findProgramAddressSync([Buffer.from("treasury_config")], GATE);

function auditEntryPDA(nonce: bigint) {
  const b = Buffer.alloc(8); b.writeBigUInt64LE(nonce);
  return PublicKey.findProgramAddressSync([Buffer.from("audit_entry"), vaultConfigKey.toBuffer(), b], GATE)[0];
}
function attestationPDA(wallet: PublicKey, issuer: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("attestation"), wallet.toBuffer(), issuer.toBuffer()], GATE)[0];
}

// ── Discriminator helpers ─────────────────────────────────────────────────────

function disc(name: string): Buffer {
  return Buffer.from(crypto.createHash("sha256").update(`global:${name}`).digest()).slice(0, 8);
}
const DISC = {
  pause_gate:          disc("pause_gate"),
  unpause_gate:        disc("unpause_gate"),
  update_vault_config: disc("update_vault_config"),
  issue_attestation:   disc("issue_test_attestation"),
  revoke_attestation:  disc("revoke_attestation"),
  update_treasury:     disc("update_treasury_config"),
};

// ── Account decoders ──────────────────────────────────────────────────────────

const REASON: Record<number, string> = {
  0:"Approved", 1:"NoAttestation", 2:"AttestationExpired",
  3:"AttestationRevoked", 4:"UntrustedIssuer", 5:"TierInsufficient",
  6:"JurisdictionBlocked", 7:"GatePaused",
};
const JD = ["CHE","GBR","SGP","USA","DEU","FRA","LUX","ARE","HKG","JPN"];

function decodePubkey(buf: Buffer, off: number) { return new PublicKey(buf.slice(off, off + 32)).toBase58(); }
function decodeI64(buf: Buffer, off: number) { return Number(buf.readBigInt64LE(off)); }
function decodeU64(buf: Buffer, off: number) { return Number(buf.readBigUInt64LE(off)); }

interface VaultConfig {
  authority: string; vaultProgram: string; minTier: number;
  trustedIssuers: string[]; allowedJurisdictions: string[];
  paused: boolean; registeredAt: number; auditNonce: number;
}

function decodeVaultConfig(data: Buffer): VaultConfig {
  let off = 8; // skip discriminator
  const authority    = decodePubkey(data, off); off += 32;
  const vaultProgram = decodePubkey(data, off); off += 32;
  const minTier      = data[off]; off += 1;
  const numIssuers   = data.readUInt32LE(off); off += 4;
  const trustedIssuers: string[] = [];
  for (let i = 0; i < numIssuers; i++) { trustedIssuers.push(decodePubkey(data, off)); off += 32; }
  const numJuris = data.readUInt32LE(off); off += 4;
  const allowedJurisdictions: string[] = [];
  for (let i = 0; i < numJuris; i++) {
    const bytes = data.slice(off, off + 3);
    allowedJurisdictions.push(Buffer.from(bytes).toString("ascii").replace(/\0/g, ""));
    off += 3;
  }
  const paused       = data[off] !== 0; off += 1;
  const registeredAt = decodeI64(data, off); off += 8;
  const auditNonce   = decodeU64(data, off);
  return { authority, vaultProgram, minTier, trustedIssuers, allowedJurisdictions, paused, registeredAt, auditNonce };
}

interface AuditEntry {
  wallet: string; vault: string; timestamp: number; slot: number;
  outcome: string; reasonCode: number; reason: string; attestationId: string; tier: number;
}

function decodeAuditEntry(data: Buffer): AuditEntry {
  let off = 8;
  const wallet        = decodePubkey(data, off); off += 32;
  const vault         = decodePubkey(data, off); off += 32;
  const timestamp     = decodeI64(data, off); off += 8;
  const slot          = decodeU64(data, off); off += 8;
  const outcomeVal    = data[off]; off += 1;
  const reasonCode    = data[off]; off += 1;
  const attestationId = decodePubkey(data, off); off += 32;
  const tier          = data[off];
  const outcome       = outcomeVal === 0 ? "Approved" : "Denied";
  return { wallet, vault, timestamp, slot, outcome, reasonCode, reason: REASON[reasonCode] ?? "Unknown", attestationId, tier };
}

interface IssuerEntry { pubkey: string; vault: string; registered: number; active: boolean; }

function decodeIssuerRegistry(data: Buffer): { authority: string; issuers: IssuerEntry[] } {
  let off = 8;
  const authority  = decodePubkey(data, off); off += 32;
  const numIssuers = data.readUInt32LE(off); off += 4;
  const issuers: IssuerEntry[] = [];
  for (let i = 0; i < numIssuers; i++) {
    const pubkey     = decodePubkey(data, off); off += 32;
    const vault      = decodePubkey(data, off); off += 32;
    const registered = decodeI64(data, off); off += 8;
    const active     = data[off] !== 0; off += 1;
    issuers.push({ pubkey, vault, registered, active });
  }
  return { authority, issuers };
}

interface Attestation {
  wallet: string; issuer: string; tier: number; issuedAt: number;
  expiresAt: number; jurisdiction: string; revoked: boolean;
}

function decodeAttestation(data: Buffer): Attestation {
  let off = 8;
  const wallet       = decodePubkey(data, off); off += 32;
  const issuer       = decodePubkey(data, off); off += 32;
  const tier         = data[off]; off += 1;
  const issuedAt     = decodeI64(data, off); off += 8;
  const expiresAt    = decodeI64(data, off); off += 8;
  off += 32; // kyc_ref
  const jurisdictionBytes = data.slice(off, off + 3); off += 3;
  const jurisdiction = Buffer.from(jurisdictionBytes).toString("ascii").replace(/\0/g, "");
  const revoked      = data[off] !== 0;
  return { wallet, issuer, tier, issuedAt, expiresAt, jurisdiction, revoked };
}

// ── Transaction helpers ───────────────────────────────────────────────────────

function encodeOptionU8(v: number | null): Buffer {
  return v === null ? Buffer.from([0]) : Buffer.from([1, v]);
}
function encodeU64LE(v: bigint): Buffer {
  const b = Buffer.alloc(8); b.writeBigUInt64LE(v); return b;
}
function encodeI64LE(v: number): Buffer {
  const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(v)); return b;
}

async function sendTx(kp: Keypair, ix: TransactionInstruction): Promise<string> {
  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(conn, tx, [kp], { commitment: "confirmed" });
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function getProtocolStatus() {
  const info = await conn.getAccountInfo(vaultConfigKey);
  if (!info) return { error: "VaultConfig account not found. Gate may not be initialized." };
  const vc = decodeVaultConfig(info.data as Buffer);
  const tierNames: Record<number, string> = { 1:"Tier 1 - Basic", 2:"Tier 2 - Enhanced", 3:"Tier 3 - Institutional" };
  return {
    programId: GATE.toBase58(),
    vaultConfigPDA: vaultConfigKey.toBase58(),
    paused: vc.paused,
    minTier: vc.minTier,
    minTierLabel: tierNames[vc.minTier] ?? `Tier ${vc.minTier}`,
    vaultProgram: vc.vaultProgram,
    authority: vc.authority,
    trustedIssuers: vc.trustedIssuers,
    allowedJurisdictions: vc.allowedJurisdictions.length > 0 ? vc.allowedJurisdictions : ["All jurisdictions permitted"],
    registeredAt: new Date(vc.registeredAt * 1000).toISOString(),
    totalGateCalls: vc.auditNonce,
    network: "devnet",
  };
}

async function getAuditLog(limit = 20) {
  const info = await conn.getAccountInfo(vaultConfigKey);
  if (!info) return { error: "VaultConfig not found" };
  const vc = decodeVaultConfig(info.data as Buffer);
  const total = vc.auditNonce;
  const start = Math.max(0, total - limit);
  const entries: AuditEntry[] = [];

  const pdas = [];
  for (let i = start; i < total; i++) pdas.push(auditEntryPDA(BigInt(i)));

  const accounts = await conn.getMultipleAccountsInfo(pdas);
  for (const acc of accounts) {
    if (acc?.data) entries.push(decodeAuditEntry(acc.data as Buffer));
  }
  entries.sort((a, b) => b.timestamp - a.timestamp);

  const approved = entries.filter(e => e.outcome === "Approved").length;
  const denied   = entries.filter(e => e.outcome === "Denied").length;

  return {
    totalGateCalls: total,
    showing: entries.length,
    approvalRate: entries.length > 0 ? `${((approved / entries.length) * 100).toFixed(1)}%` : "N/A",
    approved, denied,
    entries: entries.map(e => ({
      wallet: e.wallet,
      outcome: e.outcome,
      reason: e.reason,
      tier: e.tier,
      timestamp: new Date(e.timestamp * 1000).toISOString(),
      slot: e.slot,
    })),
  };
}

async function checkWalletAccess(walletAddress: string) {
  let wallet: PublicKey;
  try { wallet = new PublicKey(walletAddress); } catch {
    return { error: `Invalid wallet address: ${walletAddress}` };
  }

  const vcInfo = await conn.getAccountInfo(vaultConfigKey);
  if (!vcInfo) return { error: "VaultConfig not found" };
  const vc = decodeVaultConfig(vcInfo.data as Buffer);

  if (vc.paused) {
    return { wallet: walletAddress, access: "DENIED", reason: "GatePaused", detail: "Gate is currently paused by the vault operator." };
  }

  // Try each trusted issuer
  for (const issuerStr of vc.trustedIssuers) {
    const issuer = new PublicKey(issuerStr);
    const attKey = attestationPDA(wallet, issuer);
    const attInfo = await conn.getAccountInfo(attKey);
    if (!attInfo || attInfo.data.length < 10) continue;

    const att = decodeAttestation(attInfo.data as Buffer);
    const now = Math.floor(Date.now() / 1000);

    if (att.revoked) return { wallet: walletAddress, access: "DENIED", reason: "AttestationRevoked", issuer: issuerStr, tier: att.tier };
    if (att.expiresAt !== 0 && now > att.expiresAt) return { wallet: walletAddress, access: "DENIED", reason: "AttestationExpired", issuer: issuerStr, tier: att.tier, expiredAt: new Date(att.expiresAt * 1000).toISOString() };
    if (att.tier < vc.minTier) return { wallet: walletAddress, access: "DENIED", reason: "TierInsufficient", issuer: issuerStr, walletTier: att.tier, requiredTier: vc.minTier };
    if (vc.allowedJurisdictions.length > 0 && !vc.allowedJurisdictions.includes(att.jurisdiction)) {
      return { wallet: walletAddress, access: "DENIED", reason: "JurisdictionBlocked", jurisdiction: att.jurisdiction };
    }

    return {
      wallet: walletAddress, access: "APPROVED",
      tier: att.tier, issuer: issuerStr,
      jurisdiction: att.jurisdiction,
      expiresAt: att.expiresAt === 0 ? "Never" : new Date(att.expiresAt * 1000).toISOString(),
    };
  }

  return { wallet: walletAddress, access: "DENIED", reason: "NoAttestation", detail: "No valid attestation found from any trusted issuer." };
}

async function getIssuerRegistry() {
  const info = await conn.getAccountInfo(registryKey);
  if (!info) return { error: "IssuerRegistry not found. Run initialize_issuer_registry first." };
  const registry = decodeIssuerRegistry(info.data as Buffer);
  return {
    authority: registry.authority,
    totalIssuers: registry.issuers.length,
    activeIssuers: registry.issuers.filter(i => i.active).length,
    issuers: registry.issuers.map(i => ({
      pubkey: i.pubkey,
      vault: i.vault,
      status: i.active ? "active" : "revoked",
      registeredAt: new Date(i.registered * 1000).toISOString(),
    })),
  };
}

async function getTreasuryStats() {
  const info = await conn.getAccountInfo(treasuryCfgKey);
  if (!info || info.data.length < 65) return { error: "Treasury not initialized.", treasuryPDA: treasuryKey.toBase58() };
  const d = info.data as Buffer;
  const authority       = decodePubkey(d, 8);
  const feeLamports     = decodeU64(d, 40);
  const totalCollected  = decodeU64(d, 48);
  const lastUpdated     = decodeI64(d, 56);
  const treasuryBalance = await conn.getBalance(treasuryKey);
  return {
    treasuryPDA: treasuryKey.toBase58(),
    configPDA: treasuryCfgKey.toBase58(),
    authority,
    feeLamports,
    feeSOL: feeLamports / LAMPORTS_PER_SOL,
    feeUSD: `~$${(feeLamports / LAMPORTS_PER_SOL * 150).toFixed(5)}`,
    totalCollectedLamports: totalCollected,
    totalCollectedSOL: totalCollected / LAMPORTS_PER_SOL,
    treasuryBalanceLamports: treasuryBalance,
    lastUpdated: new Date(lastUpdated * 1000).toISOString(),
  };
}

async function generateComplianceReport() {
  const log = await getAuditLog(200);
  if ("error" in log) return log;

  const byReason: Record<string, number> = {};
  const byJurisdiction: Record<string, number> = {};
  const byTier: Record<number, number> = {};

  for (const e of log.entries) {
    byReason[e.reason] = (byReason[e.reason] ?? 0) + 1;
    if (e.tier > 0) byTier[e.tier] = (byTier[e.tier] ?? 0) + 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    reportType: "FATF R.16 Gate Activity Summary",
    programId: GATE.toBase58(),
    network: "devnet",
    summary: {
      totalGateCalls: log.totalGateCalls,
      analyzed: log.showing,
      approved: log.approved,
      denied: log.denied,
      approvalRate: log.approvalRate,
    },
    denialBreakdown: byReason,
    tierDistribution: byTier,
    recentEntries: log.entries.slice(0, 50).map(e => ({
      timestamp: e.timestamp,
      wallet: e.wallet,
      outcome: e.outcome,
      reason: e.reason,
      tier: e.tier,
    })),
    fatfFields: {
      R16_correspondent_screening: "Gate enforces KYC attestation on every interaction",
      R16_transaction_monitoring: `${log.totalGateCalls} gate calls logged on-chain`,
      R16_record_keeping: "All AuditEntry accounts are immutable on-chain",
      R16_suspicious_activity: `${log.denied} denied interactions recorded`,
    },
  };

  return report;
}

// ── Write operations ──────────────────────────────────────────────────────────

async function pauseGate() {
  const kp = loadKeypair();
  if (!kp) return { error: "No keypair configured. Set LEYFIS_KEYPAIR_PATH or LEYFIS_KEYPAIR_JSON." };
  const ix = new TransactionInstruction({
    programId: GATE,
    keys: [{ pubkey: vaultConfigKey, isSigner: false, isWritable: true }, { pubkey: kp.publicKey, isSigner: true, isWritable: false }],
    data: DISC.pause_gate,
  });
  const sig = await sendTx(kp, ix);
  return { success: true, action: "Gate paused", signature: sig, explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet` };
}

async function unpauseGate() {
  const kp = loadKeypair();
  if (!kp) return { error: "No keypair configured." };
  const ix = new TransactionInstruction({
    programId: GATE,
    keys: [{ pubkey: vaultConfigKey, isSigner: false, isWritable: true }, { pubkey: kp.publicKey, isSigner: true, isWritable: false }],
    data: DISC.unpause_gate,
  });
  const sig = await sendTx(kp, ix);
  return { success: true, action: "Gate unpaused", signature: sig, explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet` };
}

async function updateVaultConfig(minTier: number | null, trustedIssuers: string[] | null) {
  const kp = loadKeypair();
  if (!kp) return { error: "No keypair configured." };

  const tierBuf = encodeOptionU8(minTier);
  let issuerBuf: Buffer;
  if (trustedIssuers === null) {
    issuerBuf = Buffer.from([0]);
  } else {
    issuerBuf = Buffer.alloc(1 + 4 + trustedIssuers.length * 32);
    issuerBuf[0] = 1;
    issuerBuf.writeUInt32LE(trustedIssuers.length, 1);
    trustedIssuers.forEach((k, i) => new PublicKey(k).toBuffer().copy(issuerBuf, 5 + i * 32));
  }

  const ix = new TransactionInstruction({
    programId: GATE,
    keys: [{ pubkey: vaultConfigKey, isSigner: false, isWritable: true }, { pubkey: kp.publicKey, isSigner: true, isWritable: false }],
    data: Buffer.concat([DISC.update_vault_config, tierBuf, issuerBuf]),
  });
  const sig = await sendTx(kp, ix);
  return {
    success: true,
    action: "VaultConfig updated",
    changes: { minTier: minTier ?? "unchanged", trustedIssuers: trustedIssuers ?? "unchanged" },
    signature: sig,
    explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
  };
}

async function issueAttestation(walletAddress: string, tier: number, jurisdictionCode: string, expiresInDays: number) {
  const kp = loadKeypair();
  if (!kp) return { error: "No keypair configured." };

  let wallet: PublicKey;
  try { wallet = new PublicKey(walletAddress); } catch { return { error: `Invalid wallet: ${walletAddress}` }; }

  const jc = jurisdictionCode.toUpperCase().slice(0, 3).padEnd(3, "\0");
  const jurisdictionBytes = Buffer.from(jc, "ascii");
  const now       = Math.floor(Date.now() / 1000);
  const expiresAt = expiresInDays > 0 ? now + expiresInDays * 86400 : 0;
  const kycRef    = Buffer.alloc(32);

  const [attKey] = PublicKey.findProgramAddressSync(
    [Buffer.from("attestation"), wallet.toBuffer(), kp.publicKey.toBuffer()], GATE
  );

  const tierBuf    = Buffer.from([tier]);
  const expiresBuf = encodeI64LE(expiresAt);
  const ix = new TransactionInstruction({
    programId: GATE,
    keys: [
      { pubkey: attKey,              isSigner: false, isWritable: true  },
      { pubkey: wallet,              isSigner: false, isWritable: false },
      { pubkey: kp.publicKey,        isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([DISC.issue_attestation, tierBuf, expiresBuf, kycRef, jurisdictionBytes]),
  });
  const sig = await sendTx(kp, ix);
  return {
    success: true,
    action: "Attestation issued",
    attestationPDA: attKey.toBase58(),
    wallet: walletAddress, issuer: kp.publicKey.toBase58(),
    tier, jurisdiction: jurisdictionCode.toUpperCase(),
    expiresAt: expiresAt === 0 ? "Never" : new Date(expiresAt * 1000).toISOString(),
    signature: sig,
    explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
  };
}

async function revokeAttestation(walletAddress: string, issuerAddress?: string) {
  const kp = loadKeypair();
  if (!kp) return { error: "No keypair configured." };

  let wallet: PublicKey;
  try { wallet = new PublicKey(walletAddress); } catch { return { error: `Invalid wallet: ${walletAddress}` }; }

  const issuer = issuerAddress ? new PublicKey(issuerAddress) : kp.publicKey;
  const attKey = attestationPDA(wallet, issuer);

  const ix = new TransactionInstruction({
    programId: GATE,
    keys: [
      { pubkey: attKey,        isSigner: false, isWritable: true  },
      { pubkey: kp.publicKey, isSigner: true,  isWritable: false },
    ],
    data: DISC.revoke_attestation,
  });
  const sig = await sendTx(kp, ix);
  return { success: true, action: "Attestation revoked", wallet: walletAddress, attestationPDA: attKey.toBase58(), signature: sig, explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet` };
}

async function setProtocolFee(feeLamports: number) {
  const kp = loadKeypair();
  if (!kp) return { error: "No keypair configured." };
  const optFee = Buffer.concat([Buffer.from([1]), encodeU64LE(BigInt(feeLamports))]);
  const ix = new TransactionInstruction({
    programId: GATE,
    keys: [
      { pubkey: treasuryCfgKey, isSigner: false, isWritable: true  },
      { pubkey: kp.publicKey,   isSigner: true,  isWritable: false },
    ],
    data: Buffer.concat([DISC.update_treasury, optFee]),
  });
  const sig = await sendTx(kp, ix);
  return { success: true, action: "Protocol fee updated", feeLamports, feeSOL: feeLamports / LAMPORTS_PER_SOL, signature: sig };
}

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "leyfis-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_protocol_status",
      description: "Get the current status of the Leyfis gate: paused state, minimum KYC tier required, trusted issuers, total gate calls, and vault configuration.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_audit_log",
      description: "Retrieve recent gate call audit entries from the on-chain audit log. Shows wallet addresses, outcomes (Approved/Denied), denial reasons, tiers, and timestamps.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of recent entries to fetch (default: 20, max: 200)" },
        },
      },
    },
    {
      name: "check_wallet_access",
      description: "Check whether a specific wallet would be approved or denied by the gate, and explain exactly why (which attestation check failed or passed).",
      inputSchema: {
        type: "object",
        required: ["wallet"],
        properties: {
          wallet: { type: "string", description: "Solana wallet address (base58 pubkey) to check" },
        },
      },
    },
    {
      name: "get_issuer_registry",
      description: "List all KYC issuers registered with the Leyfis protocol — their wallet addresses, which vault they're authorised for, status (active/revoked), and registration date.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_treasury_stats",
      description: "Get protocol treasury statistics: fee per approved gate call, total fees collected, and current treasury balance.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "generate_compliance_report",
      description: "Generate a FATF R.16 compliance summary report from the on-chain audit log. Includes approval rates, denial breakdowns by reason, tier distribution, and regulatory field mappings.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "pause_gate",
      description: "Emergency: pause the Leyfis gate. All gate() calls will be rejected immediately until unpaused. Requires vault operator keypair (LEYFIS_KEYPAIR_PATH env var).",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "unpause_gate",
      description: "Resume normal operation by unpausing the Leyfis gate. Requires vault operator keypair.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "update_vault_config",
      description: "Update gate configuration: change minimum KYC tier required (1=Basic, 2=Enhanced, 3=Institutional) and/or update the list of trusted KYC issuers. Requires vault operator keypair.",
      inputSchema: {
        type: "object",
        properties: {
          min_tier:        { type: "number", description: "New minimum tier (1, 2, or 3). Omit to leave unchanged." },
          trusted_issuers: { type: "array", items: { type: "string" }, description: "Array of issuer pubkeys. Omit to leave unchanged." },
        },
      },
    },
    {
      name: "issue_attestation",
      description: "Issue a KYC attestation to a wallet address. Sets the tier, jurisdiction, and expiry. Requires an issuer keypair (LEYFIS_KEYPAIR_PATH env var).",
      inputSchema: {
        type: "object",
        required: ["wallet", "tier", "jurisdiction"],
        properties: {
          wallet:          { type: "string", description: "Wallet address to attest" },
          tier:            { type: "number", description: "KYC tier: 1 (Basic), 2 (Enhanced), 3 (Institutional)" },
          jurisdiction:    { type: "string", description: "ISO 3166 country code, e.g. CHE, GBR, SGP" },
          expires_in_days: { type: "number", description: "Days until expiry. 0 = never expires. Default: 365" },
        },
      },
    },
    {
      name: "revoke_attestation",
      description: "Revoke a previously issued KYC attestation. The wallet will be denied on the next gate call. Requires issuer keypair.",
      inputSchema: {
        type: "object",
        required: ["wallet"],
        properties: {
          wallet: { type: "string", description: "Wallet address whose attestation to revoke" },
          issuer: { type: "string", description: "Issuer pubkey (defaults to keypair public key)" },
        },
      },
    },
    {
      name: "set_protocol_fee",
      description: "Update the protocol fee charged per approved gate() call (in lamports). Current fee: 5000 lamports ≈ $0.001. Requires treasury authority keypair.",
      inputSchema: {
        type: "object",
        required: ["fee_lamports"],
        properties: {
          fee_lamports: { type: "number", description: "Fee in lamports (1 SOL = 1,000,000,000 lamports). Set to 0 to disable fees." },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  let result: unknown;

  try {
    switch (name) {
      case "get_protocol_status":   result = await getProtocolStatus(); break;
      case "get_audit_log":         result = await getAuditLog((args as any)?.limit ?? 20); break;
      case "check_wallet_access":   result = await checkWalletAccess((args as any).wallet); break;
      case "get_issuer_registry":   result = await getIssuerRegistry(); break;
      case "get_treasury_stats":    result = await getTreasuryStats(); break;
      case "generate_compliance_report": result = await generateComplianceReport(); break;
      case "pause_gate":            result = await pauseGate(); break;
      case "unpause_gate":          result = await unpauseGate(); break;
      case "update_vault_config":   result = await updateVaultConfig((args as any)?.min_tier ?? null, (args as any)?.trusted_issuers ?? null); break;
      case "issue_attestation":     result = await issueAttestation((args as any).wallet, (args as any).tier, (args as any).jurisdiction, (args as any).expires_in_days ?? 365); break;
      case "revoke_attestation":    result = await revokeAttestation((args as any).wallet, (args as any)?.issuer); break;
      case "set_protocol_fee":      result = await setProtocolFee((args as any).fee_lamports); break;
      default: result = { error: `Unknown tool: ${name}` };
    }
  } catch (e: any) {
    result = { error: e?.message ?? String(e) };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
