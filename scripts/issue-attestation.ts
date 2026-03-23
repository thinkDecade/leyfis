/**
 * Leyfis — CLI: Issue SAS Attestation to a Wallet
 * ─────────────────────────────────────────────────
 * Usage:
 *   ts-node scripts/issue-attestation.ts \
 *     --wallet  <WALLET_PUBKEY>         \
 *     --tier    <1|2|3>                 \
 *     --expiry  <days>                  \
 *     --jurisdiction <CHE|USA|DEU|...>  \
 *     --issuer-keypair <PATH_TO_ISSUER_KEYPAIR_JSON>
 *
 * Examples:
 *   # Issue Tier 3 institutional attestation (1 year, Switzerland)
 *   ts-node scripts/issue-attestation.ts \
 *     --wallet  DemoWalletBPubkeyHere \
 *     --tier    3 \
 *     --expiry  365 \
 *     --jurisdiction CHE \
 *     --issuer-keypair ~/.config/solana/leyfis/kyc-issuer.json
 *
 *   # Issue never-expiring attestation (expiry=0)
 *   ts-node scripts/issue-attestation.ts \
 *     --wallet  WalletPubkeyHere \
 *     --tier    2 \
 *     --expiry  0 \
 *     --jurisdiction USA \
 *     --issuer-keypair ~/.config/solana/leyfis/kyc-issuer.json
 *
 * Environment:
 *   ANCHOR_PROVIDER_URL  — RPC endpoint (defaults to devnet)
 *   GATE_PROGRAM_ID      — Gate program ID (or set in .env)
 */

import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  Connection,
  clusterApiUrl,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─────────────────────────────────────────────────────────────────────────────
// ARGS PARSING
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(): {
  wallet: string;
  tier: number;
  expiryDays: number;
  jurisdiction: string;
  issuerKeypairPath: string;
  revoke: boolean;
} {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const wallet            = get("--wallet");
  const tierStr           = get("--tier");
  const expiryStr         = get("--expiry");
  const jurisdiction      = get("--jurisdiction");
  const issuerKeypairPath = get("--issuer-keypair");
  const revoke            = args.includes("--revoke");

  if (!wallet) {
    console.error("Error: --wallet <PUBKEY> is required");
    process.exit(1);
  }
  if (!issuerKeypairPath) {
    console.error("Error: --issuer-keypair <PATH> is required");
    process.exit(1);
  }

  if (!revoke) {
    if (!tierStr)      { console.error("Error: --tier <1|2|3> is required");    process.exit(1); }
    if (expiryStr === undefined) { console.error("Error: --expiry <days> is required (0 = never)"); process.exit(1); }
    if (!jurisdiction) { console.error("Error: --jurisdiction <ISO3> is required"); process.exit(1); }
    if (jurisdiction.length !== 3) {
      console.error("Error: jurisdiction must be exactly 3 characters (ISO 3166-1 alpha-3), e.g. CHE");
      process.exit(1);
    }
  }

  return {
    wallet:            wallet,
    tier:              parseInt(tierStr ?? "3", 10),
    expiryDays:        parseInt(expiryStr ?? "365", 10),
    jurisdiction:      (jurisdiction ?? "CHE").toUpperCase(),
    issuerKeypairPath: issuerKeypairPath,
    revoke,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function loadKeypair(filePath: string): Keypair {
  const expanded = filePath.replace("~", os.homedir());
  const resolved = path.resolve(expanded);
  const raw = JSON.parse(fs.readFileSync(resolved, "utf-8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function attestationPda(
  wallet: PublicKey,
  issuer: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("attestation"), wallet.toBuffer(), issuer.toBuffer()],
    programId
  );
}

function tierLabel(tier: number): string {
  return tier === 1 ? "Retail (1)" : tier === 2 ? "Accredited (2)" : "Institutional (3)";
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  // Load issuer keypair
  const issuerKp = loadKeypair(args.issuerKeypairPath);
  console.log("\n  Issuer :    ", issuerKp.publicKey.toBase58());
  console.log("  Wallet :    ", args.wallet);

  // Setup provider
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL ?? clusterApiUrl("devnet");
  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = new anchor.Wallet(issuerKp);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  // Load IDL
  const idlPath = path.join(__dirname, "..", "target", "idl", "leyfis_gate.json");
  if (!fs.existsSync(idlPath)) {
    console.error("\n  Error: IDL not found at", idlPath);
    console.error("  Run `anchor build` first to generate the IDL.");
    process.exit(1);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  // Determine program ID
  const programIdStr =
    process.env.GATE_PROGRAM_ID ??
    (idl.metadata?.address as string | undefined);

  if (!programIdStr || programIdStr === "LEYFIS_GATE_PROGRAM_ID") {
    console.error("\n  Error: Gate program ID not set.");
    console.error("  Set GATE_PROGRAM_ID env var or update Anchor.toml after deploy.");
    process.exit(1);
  }

  const programId = new PublicKey(programIdStr);
  const program = new anchor.Program(idl, provider);

  const walletPubkey = new PublicKey(args.wallet);
  const [attKey] = attestationPda(walletPubkey, issuerKp.publicKey, programId);

  // ── REVOKE MODE ──────────────────────────────────────────────────────
  if (args.revoke) {
    console.log("\n  Action:     REVOKE attestation");
    console.log("  PDA:       ", attKey.toBase58());

    // Check it exists
    const existing = await connection.getAccountInfo(attKey);
    if (!existing) {
      console.error("\n  Error: No attestation found at", attKey.toBase58());
      process.exit(1);
    }

    const sig = await (program.methods as any)
      .revokeAttestation()
      .accounts({
        attestation: attKey,
        issuer:      issuerKp.publicKey,
      })
      .signers([issuerKp])
      .rpc();

    console.log("\n  ✓ Attestation revoked");
    console.log("  Signature:", sig);
    return;
  }

  // ── ISSUE MODE ───────────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = args.expiryDays === 0 ? 0 : now + args.expiryDays * 24 * 3600;
  const kycRef = Array(32).fill(0); // placeholder — production would hash the KYC reference

  console.log("\n  Action:     ISSUE attestation");
  console.log("  Tier:      ", tierLabel(args.tier));
  console.log("  Expires:   ", expiresAt === 0 ? "never" : new Date(expiresAt * 1000).toISOString());
  console.log("  Jurisdiction:", args.jurisdiction);
  console.log("  PDA:       ", attKey.toBase58());

  // Check if attestation already exists
  const existing = await connection.getAccountInfo(attKey);
  if (existing) {
    console.warn("\n  Warning: Attestation already exists at this PDA.");
    console.warn("  Each wallet+issuer pair can only have one attestation.");
    console.warn("  Use --revoke first if you need to reissue.");
    process.exit(1);
  }

  const jurisdictionBytes = Array.from(Buffer.from(args.jurisdiction.padEnd(3, " ")));

  const sig = await (program.methods as any)
    .issueTestAttestation(
      args.tier,
      new anchor.BN(expiresAt),
      kycRef,
      jurisdictionBytes
    )
    .accounts({
      attestation:   attKey,
      wallet:        walletPubkey,
      issuer:        issuerKp.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([issuerKp])
    .rpc();

  console.log("\n  ✓ Attestation issued successfully");
  console.log("  Signature:", sig);
  console.log("  PDA:      ", attKey.toBase58());
  console.log("");
  console.log("  ── Attestation details ─────────────────────────────────");
  console.log("  Wallet:      ", walletPubkey.toBase58());
  console.log("  Issuer:      ", issuerKp.publicKey.toBase58());
  console.log("  Tier:        ", tierLabel(args.tier));
  console.log("  Jurisdiction:", args.jurisdiction);
  console.log("  Expires:     ", expiresAt === 0 ? "never" : new Date(expiresAt * 1000).toISOString());
  console.log("  ─────────────────────────────────────────────────────────");
  console.log("");
  console.log("  View on Solana Explorer:");
  console.log(`  https://explorer.solana.com/address/${attKey.toBase58()}?cluster=devnet`);
  console.log("");
}

main().catch((err) => {
  console.error("\n  Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
