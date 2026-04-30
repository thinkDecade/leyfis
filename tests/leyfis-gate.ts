import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import { LeyfisGate } from "../target/types/leyfis_gate";
import { TestVault }  from "../target/types/test_vault";
import {
  PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL,
  Transaction, TransactionInstruction, sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as crypto from "crypto";
import * as fs from "fs";
import { assert } from "chai";
import BN from "bn.js";

// ── Helpers ──────────────────────────────────────────────────────────────────
function ixDiscriminator(name: string): Buffer {
  return crypto.createHash("sha256").update(`global:${name}`).digest().slice(0, 8);
}
const GATE_DISC = ixDiscriminator("gate");

function vaultConfigPda(vaultProgram: PublicKey, gateId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("vault_config"), vaultProgram.toBuffer()], gateId);
}
function auditEntryPda(vcKey: PublicKey, nonce: bigint, gateId: PublicKey) {
  const b = Buffer.alloc(8); b.writeBigUInt64LE(nonce);
  return PublicKey.findProgramAddressSync([Buffer.from("audit_entry"), vcKey.toBuffer(), b], gateId);
}
function attestationPda(wallet: PublicKey, issuer: PublicKey, gateId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("attestation"), wallet.toBuffer(), issuer.toBuffer()], gateId);
}
function issuerRegistryPda(gateId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("issuer_registry")], gateId);
}
function vaultStatePda(vaultId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("vault_state")], vaultId);
}
function treasuryPda(gateId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("treasury")], gateId);
}
function treasuryConfigPda(gateId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("treasury_config")], gateId);
}

// Manually encode gate() instruction to bypass Anchor borsh u64 bug
// gate(vault_instruction_data: bytes, audit_nonce: u64)
// bytes = 4-byte LE length prefix + data
// u64   = 8-byte LE
function encodeGateIx(ixData: Buffer, nonce: bigint): Buffer {
  const interact = ixDiscriminator("interact");
  // bytes: 4-byte length prefix + interact discriminator
  const bytesLen = Buffer.alloc(4);
  bytesLen.writeUInt32LE(interact.length, 0);
  // u64 nonce: 8 bytes LE
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(nonce, 0);
  return Buffer.concat([GATE_DISC, bytesLen, interact, nonceBuf]);
}

async function fundFromDeployer(conn: anchor.web3.Connection, deployer: Keypair, to: PublicKey, sol = 0.1) {
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: deployer.publicKey, toPubkey: to, lamports: Math.floor(sol * LAMPORTS_PER_SOL) })
  );
  await sendAndConfirmTransaction(conn, tx, [deployer]);
}

async function expectLeyfisError(p: Promise<unknown>, errorName: string) {
  try {
    await p;
    assert.fail(`Expected ${errorName} but tx succeeded`);
  } catch (err: any) {
    if (err instanceof AnchorError) {
      assert.equal(err.error.errorCode.code, errorName, `Expected ${errorName}, got ${err.error.errorCode.code}`);
    } else if (err?.logs) {
      const log = err.logs.join("\n");
      assert.include(log, errorName, `Expected ${errorName} in logs`);
    } else {
      throw err;
    }
  }
}

// ── Suite ────────────────────────────────────────────────────────────────────
describe("leyfis-gate", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const gateProgram  = anchor.workspace.LeyfisGate as Program<LeyfisGate>;
  const vaultProgram = anchor.workspace.TestVault  as Program<TestVault>;
  const operator     = (provider.wallet as anchor.Wallet).payer;

  const issuer  = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync("/workspace/keys/issuer.json",   "utf8"))));
  const walletA = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync("/workspace/keys/wallet-a.json", "utf8"))));
  const walletB = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync("/workspace/keys/wallet-b.json", "utf8"))));

  const badIssuer       = Keypair.generate();
  const expiredWallet   = Keypair.generate();
  const revokedWallet   = Keypair.generate();
  const untrustedWallet = Keypair.generate();
  const walletC         = Keypair.generate();

  let vaultConfigKey:    PublicKey;
  let vaultStateKey:     PublicKey;
  let registryKey:       PublicKey;
  let treasuryKey:       PublicKey;
  let treasuryConfigKey: PublicKey;

  async function issueAtt(wallet: Keypair, issuerKp: Keypair, tier: number, expiresAt: number): Promise<PublicKey> {
    const [attKey] = attestationPda(wallet.publicKey, issuerKp.publicKey, gateProgram.programId);
    await gateProgram.methods
      .issueTestAttestation(tier, new anchor.BN(expiresAt), Array.from(Buffer.alloc(32)), [67, 72, 69])
      .accounts({ attestation: attKey, wallet: wallet.publicKey, issuer: issuerKp.publicKey, systemProgram: SystemProgram.programId })
      .signers([issuerKp]).rpc();
    return attKey;
  }

  // Raw tx callGate — bypasses Anchor borsh u64 encoding bug
  async function callGate(callerWallet: Keypair, attestationKey: PublicKey): Promise<string> {
    const vc    = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    const nonce = BigInt(vc.auditNonce.toString());
    const [auditEntryKey] = auditEntryPda(vaultConfigKey, nonce, gateProgram.programId);

    const data = encodeGateIx(ixDiscriminator("interact"), nonce);

    const ix = new TransactionInstruction({
      programId: gateProgram.programId,
      keys: [
        { pubkey: vaultConfigKey,            isSigner: false, isWritable: true  },
        { pubkey: attestationKey,            isSigner: false, isWritable: false },
        { pubkey: auditEntryKey,             isSigner: false, isWritable: true  },
        { pubkey: callerWallet.publicKey,    isSigner: true,  isWritable: true  },
        { pubkey: vaultProgram.programId,    isSigner: false, isWritable: false },
        { pubkey: treasuryKey,               isSigner: false, isWritable: true  },
        { pubkey: treasuryConfigKey,         isSigner: false, isWritable: true  },
        { pubkey: SystemProgram.programId,   isSigner: false, isWritable: false },
        // remaining accounts
        { pubkey: vaultStateKey,             isSigner: false, isWritable: true  },
        { pubkey: callerWallet.publicKey,    isSigner: true,  isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    return sendAndConfirmTransaction(provider.connection, tx, [callerWallet], { commitment: "confirmed" });
  }

  before(async () => {
    const conn = provider.connection;
    console.log("\n  Funding test wallets from deployer...");
    await Promise.all([
      fundFromDeployer(conn, operator, badIssuer.publicKey,       0.1),
      fundFromDeployer(conn, operator, expiredWallet.publicKey,   0.1),
      fundFromDeployer(conn, operator, revokedWallet.publicKey,   0.1),
      fundFromDeployer(conn, operator, untrustedWallet.publicKey, 0.1),
      fundFromDeployer(conn, operator, walletC.publicKey,         0.1),
    ]);

    [vaultConfigKey]    = vaultConfigPda(vaultProgram.programId, gateProgram.programId);
    [vaultStateKey]     = vaultStatePda(vaultProgram.programId);
    [registryKey]       = issuerRegistryPda(gateProgram.programId);
    [treasuryKey]       = treasuryPda(gateProgram.programId);
    [treasuryConfigKey] = treasuryConfigPda(gateProgram.programId);

    // Initialize test vault state if not exists
    const vsInfo = await conn.getAccountInfo(vaultStateKey);
    if (!vsInfo) {
      console.log("  Initializing test vault state...");
      await vaultProgram.methods.initialize()
        .accounts({ vaultState: vaultStateKey, operator: operator.publicKey, systemProgram: SystemProgram.programId }).rpc();
      console.log("  Test vault initialized");
    } else {
      console.log("  Test vault state exists");
    }

    const vcInfo = await conn.getAccountInfo(vaultConfigKey);
    if (vcInfo) {
      console.log("  VaultConfig exists on devnet — skipping init");
      const vc = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
      if (vc.paused) {
        await gateProgram.methods.unpauseGate().accounts({ vaultConfig: vaultConfigKey, authority: operator.publicKey }).rpc();
        console.log("  Gate unpaused");
      }
      // Reset min_tier to 3 for clean test run
      if (vc.minTier !== 3) {
        await gateProgram.methods.updateVaultConfig(3, null).accounts({ vaultConfig: vaultConfigKey, authority: operator.publicKey }).rpc();
        console.log("  min_tier reset to 3");
      }
    } else {
      console.log("  Initializing fresh...");
      await vaultProgram.methods.initialize().accounts({ vaultState: vaultStateKey, operator: operator.publicKey, systemProgram: SystemProgram.programId }).rpc();
      await gateProgram.methods.initializeIssuerRegistry().accounts({ issuerRegistry: registryKey, authority: operator.publicKey, systemProgram: SystemProgram.programId }).rpc();
      await gateProgram.methods.initializeVaultConfig(3, [issuer.publicKey]).accounts({ vaultConfig: vaultConfigKey, authority: operator.publicKey, vaultProgram: vaultProgram.programId, systemProgram: SystemProgram.programId }).rpc();
      await gateProgram.methods.registerIssuer(issuer.publicKey, vaultProgram.programId).accounts({ issuerRegistry: registryKey, authority: operator.publicKey }).rpc();
    }

    // Initialize treasury if not exists (fee = 0 for tests — no SOL required from callers)
    const tcInfo = await conn.getAccountInfo(treasuryConfigKey);
    if (!tcInfo) {
      console.log("  Initializing treasury...");
      await gateProgram.methods.initializeTreasury(new anchor.BN(0))
        .accounts({ treasuryConfig: treasuryConfigKey, treasury: treasuryKey,
          authority: operator.publicKey, systemProgram: SystemProgram.programId }).rpc();
      console.log("  Treasury initialized with fee=0");
    } else {
      console.log("  Treasury config exists");
    }

    // Ensure walletB has Tier 3 attestation
    const [attBKey] = attestationPda(walletB.publicKey, issuer.publicKey, gateProgram.programId);
    if (!await conn.getAccountInfo(attBKey)) {
      await issueAtt(walletB, issuer, 3, Math.floor(Date.now() / 1000) + 365 * 86400);
      console.log("  Issued Tier 3 attestation for walletB");
    }

    // Ensure walletC has Tier 1 attestation
    const [attCKey] = attestationPda(walletC.publicKey, issuer.publicKey, gateProgram.programId);
    if (!await conn.getAccountInfo(attCKey)) {
      await issueAtt(walletC, issuer, 1, Math.floor(Date.now() / 1000) + 365 * 86400);
      console.log("  Issued Tier 1 attestation for walletC");
    }

    console.log("\n  ─────────────────────────────────────");
    console.log("  Gate :", gateProgram.programId.toBase58());
    console.log("  Vault:", vaultProgram.programId.toBase58());
    console.log("  VC   :", vaultConfigKey.toBase58());
    console.log("  ─────────────────────────────────────\n");
  });

  it("TEST 1 — APPROVED: Tier 3 wallet passes gate and CPI executes", async () => {
    const [attBKey] = attestationPda(walletB.publicKey, issuer.publicKey, gateProgram.programId);
    const vcBefore   = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    const nonceBefore = vcBefore.auditNonce.toNumber();
    await callGate(walletB, attBKey);
    const vcAfter = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    assert.equal(vcAfter.auditNonce.toNumber(), nonceBefore + 1);
    const [auditKey] = auditEntryPda(vaultConfigKey, BigInt(nonceBefore), gateProgram.programId);
    const entry = await gateProgram.account.auditEntry.fetch(auditKey);
    assert.deepEqual(entry.outcome, { approved: {} });
    assert.equal(entry.reasonCode, 0);
    assert.equal(entry.tier, 3);
    assert.equal(entry.wallet.toBase58(), walletB.publicKey.toBase58());
    console.log("    ✓ AuditEntry written — outcome: approved, tier: 3");
  });

  it("TEST 2 — DENIED: no attestation → NoAttestation", async () => {
    await expectLeyfisError(callGate(walletA, SystemProgram.programId), "NoAttestation");
    console.log("    ✓ NoAttestation correctly thrown");
  });

  it("TEST 3 — DENIED: expired attestation → AttestationExpired", async () => {
    const expiredAttKey = await issueAtt(expiredWallet, issuer, 3, 1);
    await expectLeyfisError(callGate(expiredWallet, expiredAttKey), "AttestationExpired");
    console.log("    ✓ AttestationExpired correctly thrown");
  });

  it("TEST 4 — DENIED: revoked attestation → AttestationRevoked", async () => {
    const revokedAttKey = await issueAtt(revokedWallet, issuer, 3, Math.floor(Date.now() / 1000) + 365 * 86400);
    await gateProgram.methods.revokeAttestation().accounts({ attestation: revokedAttKey, issuer: issuer.publicKey }).signers([issuer]).rpc();
    await expectLeyfisError(callGate(revokedWallet, revokedAttKey), "AttestationRevoked");
    console.log("    ✓ AttestationRevoked correctly thrown");
  });

  it("TEST 5 — DENIED: Tier 1 on Tier 3 vault → TierInsufficient", async () => {
    const [attCKey] = attestationPda(walletC.publicKey, issuer.publicKey, gateProgram.programId);
    await expectLeyfisError(callGate(walletC, attCKey), "TierInsufficient");
    console.log("    ✓ TierInsufficient correctly thrown");
  });

  it("TEST 6 — DENIED: untrusted issuer → UntrustedIssuer", async () => {
    const untrustedAttKey = await issueAtt(untrustedWallet, badIssuer, 3, Math.floor(Date.now() / 1000) + 365 * 86400);
    await expectLeyfisError(callGate(untrustedWallet, untrustedAttKey), "UntrustedIssuer");
    console.log("    ✓ UntrustedIssuer correctly thrown");
  });

  it("TEST 7 — DENIED: gate paused → GatePaused (Tier 3 wallet still rejected)", async () => {
    await gateProgram.methods.pauseGate().accounts({ vaultConfig: vaultConfigKey, authority: operator.publicKey }).rpc();
    try {
      const vc = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
      assert.isTrue(vc.paused);
      const [attBKey] = attestationPda(walletB.publicKey, issuer.publicKey, gateProgram.programId);
      await expectLeyfisError(callGate(walletB, attBKey), "GatePaused");
      console.log("    ✓ GatePaused correctly thrown for Tier 3 wallet");
    } finally {
      await gateProgram.methods.unpauseGate().accounts({ vaultConfig: vaultConfigKey, authority: operator.publicKey }).rpc();
    }
    const vc2 = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    assert.isFalse(vc2.paused);
  });

  it("TEST 8 — APPROVED: lower min_tier → previously denied wallet now passes", async () => {
    const [attCKey] = attestationPda(walletC.publicKey, issuer.publicKey, gateProgram.programId);
    await expectLeyfisError(callGate(walletC, attCKey), "TierInsufficient");
    await gateProgram.methods.updateVaultConfig(1, null).accounts({ vaultConfig: vaultConfigKey, authority: operator.publicKey }).rpc();
    const vcUpdated = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    assert.equal(vcUpdated.minTier, 1);
    const nonceBefore = vcUpdated.auditNonce.toNumber();
    await callGate(walletC, attCKey);
    const [auditKey] = auditEntryPda(vaultConfigKey, BigInt(nonceBefore), gateProgram.programId);
    const entry = await gateProgram.account.auditEntry.fetch(auditKey);
    assert.deepEqual(entry.outcome, { approved: {} });
    assert.equal(entry.tier, 1);
    console.log("    ✓ walletC (Tier 1) approved after min_tier lowered to 1");
    // Restore
    await gateProgram.methods.updateVaultConfig(3, null).accounts({ vaultConfig: vaultConfigKey, authority: operator.publicKey }).rpc();
    console.log("    ✓ min_tier restored to 3");
  });
});
