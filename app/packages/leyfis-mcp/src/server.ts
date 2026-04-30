#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Connection, PublicKey, GetProgramAccountsFilter } from "@solana/web3.js";
import {
  DISC,
  decodeVaultConfig,
  decodeAttestation,
  decodeIssuerRegistry,
  decodeAuditEntry,
} from "./decoder.js";

const GATE_PROGRAM_ID  = "Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP";
const VAULT_PROGRAM_ID = "88x1hxWW6mMDpQQwuR3sCDgnmbHwHmQBdWYZQhcedNaJ";
const RPC_ENDPOINT     = process.env.HELIUS_RPC_URL ||
  "https://devnet.helius-rpc.com/?api-key=2414c8d2-3eff-4fda-9c74-b8c0f93d768b";
const NETWORK          = "devnet";
const EXPLORER_BASE    = "https://explorer.solana.com";

const gate    = new PublicKey(GATE_PROGRAM_ID);
const vault   = new PublicKey(VAULT_PROGRAM_ID);
const conn    = new Connection(RPC_ENDPOINT, "confirmed");

function txUrl(sig: string)   { return `${EXPLORER_BASE}/tx/${sig}?cluster=${NETWORK}`; }
function addrUrl(addr: string) { return `${EXPLORER_BASE}/address/${addr}?cluster=${NETWORK}`; }
function formatTs(ts: number) { return new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC"; }
function daysUntil(ts: number) { return Math.round((ts - Date.now() / 1000) / 86400); }

function findAttestationPDA(walletKey: PublicKey, issuerKey: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("attestation"), walletKey.toBuffer(), issuerKey.toBuffer()], gate
  );
}
function findVaultConfigPDA() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_config"), vault.toBuffer()], gate
  );
}
function findIssuerRegistryPDA() {
  return PublicKey.findProgramAddressSync([Buffer.from("issuer_registry")], gate);
}

async function getAccountData(pubkey: PublicKey): Promise<Buffer | null> {
  const info = await conn.getAccountInfo(pubkey);
  return info ? Buffer.from(info.data) : null;
}

const server = new Server(
  { name: "leyfis-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "leyfis_check_attestation",
      description: "Check if a wallet has a valid Leyfis KYC attestation on Solana devnet. Returns tier, expiry, jurisdiction, issuer and current validity status.",
      inputSchema: {
        type: "object",
        properties: {
          wallet_address: { type: "string", description: "Solana public key of the wallet to check (base58)" },
          issuer_address: { type: "string", description: "Solana public key of the KYC issuer (base58). Defaults to the Leyfis issuer wallet." },
        },
        required: ["wallet_address"],
      },
    },
    {
      name: "leyfis_get_vault_config",
      description: "Read the current Leyfis vault configuration: minimum KYC tier, pause status, trusted issuers list, and allowed jurisdictions.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "leyfis_get_audit_log",
      description: "Retrieve recent gate audit entries from the Leyfis protocol. Each entry records whether a wallet was approved or denied vault access, with the reason code.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Maximum number of entries to return (default 20, max 100)" },
          outcome_filter: { type: "string", enum: ["all", "approved", "denied"], description: "Filter by outcome (default: all)" },
          wallet_filter: { type: "string", description: "Optional — filter entries by wallet address" },
        },
      },
    },
    {
      name: "leyfis_get_issuer_registry",
      description: "List all KYC issuers registered in the Leyfis issuer registry, including their authorisation status and associated vault.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "leyfis_simulate_gate",
      description: "Simulate whether a wallet would pass the Leyfis compliance gate right now, without executing a transaction. Returns pass/fail with the specific reason if denied.",
      inputSchema: {
        type: "object",
        properties: {
          wallet_address: { type: "string", description: "Solana public key of the wallet to simulate (base58)" },
          issuer_address: { type: "string", description: "Solana public key of the KYC issuer (base58). Defaults to Leyfis issuer." },
        },
        required: ["wallet_address"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "leyfis_check_attestation") {
      const walletAddr  = args?.wallet_address as string;
      const issuerAddr  = (args?.issuer_address as string | undefined) ?? "FaPZMpBCb1RnSbvuMkqt8MxFWExf23vZ18E6nNbsFE3m";
      const walletKey   = new PublicKey(walletAddr);
      const issuerKey   = new PublicKey(issuerAddr);
      const [attPDA]    = findAttestationPDA(walletKey, issuerKey);
      const data        = await getAccountData(attPDA);

      if (!data) {
        return { content: [{ type: "text", text: JSON.stringify({
          wallet: walletAddr,
          issuer: issuerAddr,
          attestation_pda: attPDA.toBase58(),
          exists: false,
          valid: false,
          reason: "NoAttestation — no attestation account found for this wallet/issuer pair",
        }, null, 2) }] };
      }

      const att     = decodeAttestation(data);
      const now     = Math.floor(Date.now() / 1000);
      const expired = att.expiresAt > 0 && att.expiresAt < now;
      const valid   = !att.revoked && !expired;

      return { content: [{ type: "text", text: JSON.stringify({
        wallet:           att.wallet,
        issuer:           att.issuer,
        attestation_pda:  attPDA.toBase58(),
        explorer_url:     addrUrl(attPDA.toBase58()),
        exists:           true,
        valid,
        tier:             att.tier,
        tier_label:       att.tier === 3 ? "Institutional" : att.tier === 2 ? "Enhanced DD" : "Basic KYC",
        jurisdiction:     att.jurisdiction,
        kyc_ref:          att.kycRef || null,
        issued_at:        formatTs(att.issuedAt),
        expires_at:       att.expiresAt > 0 ? formatTs(att.expiresAt) : "never",
        days_remaining:   att.expiresAt > 0 ? daysUntil(att.expiresAt) : null,
        revoked:          att.revoked,
        expired,
        status:           att.revoked ? "REVOKED" : expired ? "EXPIRED" : "VALID",
      }, null, 2) }] };
    }

    if (name === "leyfis_get_vault_config") {
      const [vcPDA] = findVaultConfigPDA();
      const data    = await getAccountData(vcPDA);
      if (!data) throw new Error(`VaultConfig account not found at ${vcPDA.toBase58()}`);
      const vc = decodeVaultConfig(data);
      return { content: [{ type: "text", text: JSON.stringify({
        vault_config_pda:      vcPDA.toBase58(),
        explorer_url:          addrUrl(vcPDA.toBase58()),
        authority:             vc.authority,
        vault_program:         vc.vaultProgram,
        min_tier:              vc.minTier,
        min_tier_label:        vc.minTier === 3 ? "Institutional" : vc.minTier === 2 ? "Enhanced DD" : "Basic KYC",
        paused:                vc.paused,
        status:                vc.paused ? "PAUSED — gate is rejecting all transactions" : "ACTIVE",
        trusted_issuers:       vc.trustedIssuers,
        trusted_issuer_count:  vc.trustedIssuers.length,
        allowed_jurisdictions: vc.allowedJurisdictions.length > 0 ? vc.allowedJurisdictions : "all jurisdictions permitted",
        registered_at:         formatTs(vc.registeredAt),
        bump:                  vc.bump,
      }, null, 2) }] };
    }

    if (name === "leyfis_get_issuer_registry") {
      const [regPDA] = findIssuerRegistryPDA();
      const data     = await getAccountData(regPDA);
      if (!data) throw new Error(`IssuerRegistry account not found at ${regPDA.toBase58()}`);
      const reg = decodeIssuerRegistry(data);
      return { content: [{ type: "text", text: JSON.stringify({
        registry_pda:   regPDA.toBase58(),
        explorer_url:   addrUrl(regPDA.toBase58()),
        authority:      reg.authority,
        total_issuers:  reg.issuers.length,
        active_issuers: reg.issuers.filter(i => i.active).length,
        issuers: reg.issuers.map(i => ({
          pubkey:     i.pubkey,
          vault:      i.vault,
          active:     i.active,
          status:     i.active ? "AUTHORISED" : "REVOKED",
          registered: formatTs(i.registered),
        })),
      }, null, 2) }] };
    }

    if (name === "leyfis_get_audit_log") {
      const limit         = Math.min(Number(args?.limit ?? 20), 100);
      const outcomeFilter = (args?.outcome_filter as string | undefined) ?? "all";
      const walletFilter  = args?.wallet_filter as string | undefined;

      const discFilter: GetProgramAccountsFilter = {
        memcmp: { offset: 0, bytes: Buffer.from(DISC.AuditEntry).toString("base64"), encoding: "base64" },
      };

      const accounts = await conn.getProgramAccounts(gate, {
        filters: [discFilter],
        dataSlice: undefined,
      });

      let entries = accounts.map(({ pubkey, account }) => {
        try {
          const e = decodeAuditEntry(Buffer.from(account.data));
          return { pda: pubkey.toBase58(), ...e };
        } catch { return null; }
      }).filter(Boolean) as Array<ReturnType<typeof decodeAuditEntry> & { pda: string }>;

      if (outcomeFilter !== "all") {
        const target = outcomeFilter === "approved" ? "Approved" : "Denied";
        entries = entries.filter(e => e.outcome === target);
      }
      if (walletFilter) {
        entries = entries.filter(e => e.wallet === walletFilter);
      }

      // sort newest first
      entries.sort((a, b) => b.timestamp - a.timestamp);
      const page = entries.slice(0, limit);

      return { content: [{ type: "text", text: JSON.stringify({
        total_matching:  entries.length,
        returned:        page.length,
        outcome_filter:  outcomeFilter,
        wallet_filter:   walletFilter ?? "none",
        entries: page.map(e => ({
          pda:            e.pda,
          wallet:         e.wallet,
          vault:          e.vault,
          timestamp:      formatTs(e.timestamp),
          slot:           e.slot,
          outcome:        e.outcome,
          reason_code:    e.reasonCode,
          reason:         e.reasonName,
          attestation_id: e.attestationId,
          tier:           e.tier,
        })),
      }, null, 2) }] };
    }

    if (name === "leyfis_simulate_gate") {
      const walletAddr = args?.wallet_address as string;
      const issuerAddr = (args?.issuer_address as string | undefined) ?? "FaPZMpBCb1RnSbvuMkqt8MxFWExf23vZ18E6nNbsFE3m";
      const walletKey  = new PublicKey(walletAddr);
      const issuerKey  = new PublicKey(issuerAddr);

      // Step 1: vault config
      const [vcPDA]  = findVaultConfigPDA();
      const vcData   = await getAccountData(vcPDA);
      if (!vcData) throw new Error("VaultConfig not found — gate is not initialised");
      const vc = decodeVaultConfig(vcData);

      if (vc.paused) {
        return { content: [{ type: "text", text: JSON.stringify({
          wallet: walletAddr, issuer: issuerAddr,
          result: "DENIED", reason_code: 7, reason: "GatePaused",
          message: "The gate is currently paused by the vault operator. All transactions are rejected regardless of attestation status.",
          vault_config: { paused: true, min_tier: vc.minTier },
        }, null, 2) }] };
      }

      // Step 2: attestation
      const [attPDA] = findAttestationPDA(walletKey, issuerKey);
      const attData  = await getAccountData(attPDA);
      if (!attData) {
        return { content: [{ type: "text", text: JSON.stringify({
          wallet: walletAddr, issuer: issuerAddr,
          result: "DENIED", reason_code: 1, reason: "NoAttestation",
          message: `No attestation found at PDA ${attPDA.toBase58()}. The wallet has not been KYC-credentialed by this issuer.`,
          attestation_pda: attPDA.toBase58(),
        }, null, 2) }] };
      }

      const att = decodeAttestation(attData);
      const now = Math.floor(Date.now() / 1000);

      if (att.revoked) {
        return { content: [{ type: "text", text: JSON.stringify({
          wallet: walletAddr, issuer: issuerAddr,
          result: "DENIED", reason_code: 3, reason: "AttestationRevoked",
          message: "The KYC attestation for this wallet has been revoked by the issuer.",
          attestation: { tier: att.tier, jurisdiction: att.jurisdiction, revoked: true },
        }, null, 2) }] };
      }

      if (att.expiresAt > 0 && att.expiresAt < now) {
        return { content: [{ type: "text", text: JSON.stringify({
          wallet: walletAddr, issuer: issuerAddr,
          result: "DENIED", reason_code: 2, reason: "AttestationExpired",
          message: `Attestation expired ${formatTs(att.expiresAt)}. Days since expiry: ${Math.abs(daysUntil(att.expiresAt))}.`,
          attestation: { tier: att.tier, jurisdiction: att.jurisdiction, expired_at: formatTs(att.expiresAt) },
        }, null, 2) }] };
      }

      if (!vc.trustedIssuers.includes(issuerAddr)) {
        return { content: [{ type: "text", text: JSON.stringify({
          wallet: walletAddr, issuer: issuerAddr,
          result: "DENIED", reason_code: 4, reason: "UntrustedIssuer",
          message: `Issuer ${issuerAddr} is not in the vault's trusted issuers list.`,
          trusted_issuers: vc.trustedIssuers,
        }, null, 2) }] };
      }

      if (att.tier < vc.minTier) {
        return { content: [{ type: "text", text: JSON.stringify({
          wallet: walletAddr, issuer: issuerAddr,
          result: "DENIED", reason_code: 5, reason: "TierInsufficient",
          message: `Wallet has Tier ${att.tier} but vault requires Tier ${vc.minTier} (${vc.minTier === 3 ? "Institutional" : vc.minTier === 2 ? "Enhanced DD" : "Basic KYC"}).`,
          attestation: { tier: att.tier },
          vault_config:  { min_tier: vc.minTier },
        }, null, 2) }] };
      }

      if (vc.allowedJurisdictions.length > 0 && !vc.allowedJurisdictions.includes(att.jurisdiction)) {
        return { content: [{ type: "text", text: JSON.stringify({
          wallet: walletAddr, issuer: issuerAddr,
          result: "DENIED", reason_code: 6, reason: "JurisdictionBlocked",
          message: `Wallet jurisdiction ${att.jurisdiction} is not in the vault's allowed jurisdictions: ${vc.allowedJurisdictions.join(", ")}.`,
          attestation:   { jurisdiction: att.jurisdiction },
          vault_config:  { allowed_jurisdictions: vc.allowedJurisdictions },
        }, null, 2) }] };
      }

      return { content: [{ type: "text", text: JSON.stringify({
        wallet: walletAddr, issuer: issuerAddr,
        result: "APPROVED", reason_code: 0, reason: "Approved",
        message: "This wallet would pass the Leyfis gate. All compliance checks passed.",
        attestation: {
          pda:        attPDA.toBase58(),
          tier:       att.tier,
          tier_label: att.tier === 3 ? "Institutional" : att.tier === 2 ? "Enhanced DD" : "Basic KYC",
          jurisdiction: att.jurisdiction,
          expires_at:   att.expiresAt > 0 ? formatTs(att.expiresAt) : "never",
          days_remaining: att.expiresAt > 0 ? daysUntil(att.expiresAt) : null,
          kyc_ref:    att.kycRef || null,
        },
        vault_config: { min_tier: vc.minTier, paused: vc.paused, trusted_issuers: vc.trustedIssuers },
      }, null, 2) }] };
    }

    throw new Error(`Unknown tool: ${name}`);

  } catch (err: any) {
    return { content: [{ type: "text", text: JSON.stringify({
      error: err?.message ?? "Unknown error",
      tool: name,
    }, null, 2) }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
