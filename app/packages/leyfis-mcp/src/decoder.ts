import { createHash } from "node:crypto";
import { PublicKey } from "@solana/web3.js";

export function accountDisc(name: string): Buffer {
  return Buffer.from(createHash("sha256").update(`account:${name}`).digest()).slice(0, 8);
}

export const DISC = {
  VaultConfig:        accountDisc("VaultConfig"),
  AuditEntry:         accountDisc("AuditEntry"),
  LeyfisAttestation:  accountDisc("LeyfisAttestation"),
  IssuerRegistry:     accountDisc("IssuerRegistry"),
} as const;

function readPubkey(buf: Buffer, offset: number): PublicKey {
  return new PublicKey(buf.slice(offset, offset + 32));
}
function readI64(buf: Buffer, offset: number): number {
  return Number(buf.readBigInt64LE(offset));
}
function readU64(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset);
}

export interface VaultConfig {
  authority: string;
  vaultProgram: string;
  minTier: number;
  trustedIssuers: string[];
  allowedJurisdictions: string[];
  paused: boolean;
  registeredAt: number;
  bump: number;
}

export interface LeyfisAttestation {
  wallet: string;
  issuer: string;
  tier: number;
  issuedAt: number;
  expiresAt: number;
  kycRef: string;
  jurisdiction: string;
  revoked: boolean;
}

export interface IssuerEntry {
  pubkey: string;
  vault: string;
  registered: number;
  active: boolean;
}

export interface IssuerRegistry {
  authority: string;
  issuers: IssuerEntry[];
}

export interface AuditEntry {
  wallet: string;
  vault: string;
  timestamp: number;
  slot: string;
  outcome: "Approved" | "Denied";
  reasonCode: number;
  reasonName: string;
  attestationId: string;
  tier: number;
}

const REASON_NAMES: Record<number, string> = {
  0: "Approved", 1: "NoAttestation", 2: "AttestationExpired",
  3: "AttestationRevoked", 4: "UntrustedIssuer",
  5: "TierInsufficient", 6: "JurisdictionBlocked", 7: "GatePaused",
};

export function decodeVaultConfig(data: Buffer): VaultConfig {
  let o = 8; // skip discriminator
  const authority    = readPubkey(data, o).toBase58(); o += 32;
  const vaultProgram = readPubkey(data, o).toBase58(); o += 32;
  const minTier      = data[o++];

  const issuerCount  = data.readUInt32LE(o); o += 4;
  const trustedIssuers: string[] = [];
  for (let i = 0; i < issuerCount; i++) { trustedIssuers.push(readPubkey(data, o).toBase58()); o += 32; }

  const jurCount = data.readUInt32LE(o); o += 4;
  const allowedJurisdictions: string[] = [];
  for (let i = 0; i < jurCount; i++) {
    allowedJurisdictions.push(data.slice(o, o + 3).toString("ascii").replace(/\0/g, "")); o += 3;
  }

  const paused       = data[o++] !== 0;
  const registeredAt = readI64(data, o); o += 8;
  const bump         = data[o];
  return { authority, vaultProgram, minTier, trustedIssuers, allowedJurisdictions, paused, registeredAt, bump };
}

export function decodeAttestation(data: Buffer): LeyfisAttestation {
  let o = 8;
  const wallet      = readPubkey(data, o).toBase58(); o += 32;
  const issuer      = readPubkey(data, o).toBase58(); o += 32;
  const tier        = data[o++];
  const issuedAt    = readI64(data, o); o += 8;
  const expiresAt   = readI64(data, o); o += 8;
  const kycRef      = data.slice(o, o + 32).toString("utf8").replace(/\0/g, ""); o += 32;
  const jurisdiction = data.slice(o, o + 3).toString("ascii").replace(/\0/g, ""); o += 3;
  const revoked     = data[o] !== 0;
  return { wallet, issuer, tier, issuedAt, expiresAt, kycRef, jurisdiction, revoked };
}

export function decodeIssuerRegistry(data: Buffer): IssuerRegistry {
  let o = 8;
  const authority  = readPubkey(data, o).toBase58(); o += 32;
  const count      = data.readUInt32LE(o); o += 4;
  const issuers: IssuerEntry[] = [];
  for (let i = 0; i < count; i++) {
    const pubkey     = readPubkey(data, o).toBase58(); o += 32;
    const vault      = readPubkey(data, o).toBase58(); o += 32;
    const registered = readI64(data, o); o += 8;
    const active     = data[o++] !== 0;
    issuers.push({ pubkey, vault, registered, active });
  }
  return { authority, issuers };
}

export function decodeAuditEntry(data: Buffer): AuditEntry {
  let o = 8;
  const wallet        = readPubkey(data, o).toBase58(); o += 32;
  const vault         = readPubkey(data, o).toBase58(); o += 32;
  const timestamp     = readI64(data, o); o += 8;
  const slot          = readU64(data, o).toString(); o += 8;
  const outcomeRaw    = data[o++];
  const outcome       = outcomeRaw === 0 ? "Approved" : "Denied";
  const reasonCode    = data[o++];
  const attestationId = readPubkey(data, o).toBase58(); o += 32;
  const tier          = data[o];
  return { wallet, vault, timestamp, slot, outcome, reasonCode, reasonName: REASON_NAMES[reasonCode] ?? "Unknown", attestationId, tier };
}
