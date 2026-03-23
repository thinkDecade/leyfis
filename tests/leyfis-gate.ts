import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import { LeyfisGate } from "../target/types/leyfis_gate";
import { TestVault }  from "../target/types/test_vault";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as crypto from "crypto";
import { assert } from "chai";

function ixDiscriminator(name: string): Buffer {
  return crypto.createHash("sha256").update(`global:${name}`).digest().slice(0, 8);
}
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
async function airdrop(conn: anchor.web3.Connection, pk: PublicKey, sol = 2) {
  const sig = await conn.requestAirdrop(pk, sol * LAMPORTS_PER_SOL);
  await conn.confirmTransaction(sig, "confirmed");
}
async function expectLeyfisError(p: Promise<unknown>, errorName: string) {
  try { await p; assert.fail(`Expected ${errorName} but succeeded`); }
  catch (err) {
    if (err instanceof AnchorError) {
      assert.equal(err.error.errorCode.code, errorName, `Expected ${errorName}, got ${err.error.errorCode.code}`);
    } else { throw err; }
  }
}

const KYC_REF = Buffer.alloc(32);
const JURISDICTION = Buffer.from("CHE");
const INTERACT_DISC = Buffer.from(ixDiscriminator("interact"));

describe("leyfis-gate", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const gateProgram  = anchor.workspace.LeyfisGate  as Program<LeyfisGate>;
  const vaultProgram = anchor.workspace.TestVault   as Program<TestVault>;

  const operator  = (provider.wallet as anchor.Wallet).payer;
  const issuer    = Keypair.generate();
  const badIssuer = Keypair.generate();
  const walletA   = Keypair.generate();
  const walletB   = Keypair.generate();
  const walletC   = Keypair.generate();

  let vaultConfigKey: PublicKey;
  let vaultStateKey:  PublicKey;
  let registryKey:    PublicKey;

  async function issueAtt(wallet: Keypair, issuerKp: Keypair, tier: number, expiresAt: number) {
    const [attKey] = attestationPda(wallet.publicKey, issuerKp.publicKey, gateProgram.programId);
    await gateProgram.methods
      .issueTestAttestation(tier, new anchor.BN(expiresAt), KYC_REF, JURISDICTION)
      .accounts({ attestation: attKey, wallet: wallet.publicKey, issuer: issuerKp.publicKey, systemProgram: SystemProgram.programId })
      .signers([issuerKp]).rpc();
    return attKey;
  }

  async function callGate(callerWallet: Keypair, attestationKey: PublicKey) {
    const vc = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    const nonce = BigInt(vc.auditNonce.toString());
    const [auditEntryKey] = auditEntryPda(vaultConfigKey, nonce, gateProgram.programId);
    return gateProgram.methods
      .gate(INTERACT_DISC, new anchor.BN(nonce.toString()))
      .accounts({ vaultConfig: vaultConfigKey, attestation: attestationKey, auditEntry: auditEntryKey,
                  wallet: callerWallet.publicKey, vaultProgram: vaultProgram.programId, systemProgram: SystemProgram.programId })
      .remainingAccounts([
        { pubkey: vaultStateKey,          isSigner: false, isWritable: true },
        { pubkey: callerWallet.publicKey, isSigner: true,  isWritable: false },
      ])
      .signers([callerWallet]).rpc();
  }

  before(async () => {
    const conn = provider.connection;
    await Promise.all([issuer, badIssuer, walletA, walletB, walletC].map(k => airdrop(conn, k.publicKey)));
    [vaultConfigKey] = vaultConfigPda(vaultProgram.programId, gateProgram.programId);
    [vaultStateKey]  = vaultStatePda(vaultProgram.programId);
    [registryKey]    = issuerRegistryPda(gateProgram.programId);

    await vaultProgram.methods.initialize()
      .accounts({ vaultState: vaultStateKey, operator: operator.publicKey, systemProgram: SystemProgram.programId }).rpc();

    await gateProgram.methods.initializeIssuerRegistry()
      .accounts({ issuerRegistry: registryKey, authority: operator.publicKey, systemProgram: SystemProgram.programId }).rpc();

    await gateProgram.methods.initializeVaultConfig(3, [issuer.publicKey])
      .accounts({ vaultConfig: vaultConfigKey, authority: operator.publicKey, vaultProgram: vaultProgram.programId, systemProgram: SystemProgram.programId }).rpc();

    await gateProgram.methods.registerIssuer(issuer.publicKey, vaultProgram.programId)
      .accounts({ issuerRegistry: registryKey, authority: operator.publicKey }).rpc();

    const exp = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
    await issueAtt(walletB, issuer, 3, exp);
    await issueAtt(walletC, issuer, 1, exp);

    console.log("\n  Setup complete");
    console.log("  Gate Program :", gateProgram.programId.toBase58());
    console.log("  Vault Program:", vaultProgram.programId.toBase58());
    console.log("  VaultConfig  :", vaultConfigKey.toBase58());
  });

  it("TEST 1 ? APPROVED: Tier 3 wallet passes gate", async () => {
    const [attKey] = attestationPda(walletB.publicKey, issuer.publicKey, gateProgram.programId);
    const vcBefore = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    const nonceBefore = vcBefore.auditNonce.toNumber();
    await callGate(walletB, attKey);
    const vcAfter = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    assert.equal(vcAfter.auditNonce.toNumber(), nonceBefore + 1);
    const [auditKey] = auditEntryPda(vaultConfigKey, BigInt(nonceBefore), gateProgram.programId);
    const entry = await gateProgram.account.auditEntry.fetch(auditKey);
    assert.deepEqual(entry.outcome, { approved: {} });
    assert.equal(entry.reasonCode, 0);
    assert.equal(entry.tier, 3);
    assert.equal(entry.wallet.toBase58(), walletB.publicKey.toBase58());
  });

  it("TEST 2 ? DENIED: no attestation ? NoAttestation", async () => {
    const vcBefore = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    const nonceBefore = vcBefore.auditNonce.toNumber();
    await expectLeyfisError(callGate(walletA, SystemProgram.programId), "NoAttestation");
    // Gate correctly rejected - error confirms deny path works
  });

  it("TEST 3 ? DENIED: expired attestation ? AttestationExpired", async () => {
    const expiredWallet = Keypair.generate();
    await airdrop(provider.connection, expiredWallet.publicKey);
    // Issue with expiry 1 year from now, then manually set expired via revokeAttestation workaround
    // Actually: issueTestAttestation may reject past expiry. Use 1 second from now then wait, or
    // use a far-future expiry but with a timestamp the program sees as expired.
    // Simplest: issue with expiry = 1 (epoch second 1, effectively expired)
    const expiredAttKey = await issueAtt(expiredWallet, issuer, 3, 1);
    const vcBefore = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    const nonceBefore = vcBefore.auditNonce.toNumber();
    await expectLeyfisError(callGate(expiredWallet, expiredAttKey), "AttestationExpired");
  });

  it("TEST 4 ? DENIED: revoked attestation ? AttestationRevoked", async () => {
    const revokedWallet = Keypair.generate();
    await airdrop(provider.connection, revokedWallet.publicKey);
    const exp = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
    const revokedAttKey = await issueAtt(revokedWallet, issuer, 3, exp);
    await gateProgram.methods.revokeAttestation()
      .accounts({ attestation: revokedAttKey, issuer: issuer.publicKey }).signers([issuer]).rpc();
    const vcBefore = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    const nonceBefore = vcBefore.auditNonce.toNumber();
    await expectLeyfisError(callGate(revokedWallet, revokedAttKey), "AttestationRevoked");
  });

  it("TEST 5 ? DENIED: Tier 1 attestation on Tier 3 vault ? TierInsufficient", async () => {
    const [attCKey] = attestationPda(walletC.publicKey, issuer.publicKey, gateProgram.programId);
    const vcBefore = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    const nonceBefore = vcBefore.auditNonce.toNumber();
    await expectLeyfisError(callGate(walletC, attCKey), "TierInsufficient");
  });

  it("TEST 6 ? DENIED: untrusted issuer ? UntrustedIssuer", async () => {
    const untrustedWallet = Keypair.generate();
    await airdrop(provider.connection, untrustedWallet.publicKey);
    const exp = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
    const untrustedAttKey = await issueAtt(untrustedWallet, badIssuer, 3, exp);
    const vcBefore = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    const nonceBefore = vcBefore.auditNonce.toNumber();
    await expectLeyfisError(callGate(untrustedWallet, untrustedAttKey), "UntrustedIssuer");
  });

  it("TEST 7 ? DENIED: gate paused ? GatePaused", async () => {
    await gateProgram.methods.pauseGate()
      .accounts({ vaultConfig: vaultConfigKey, authority: operator.publicKey }).rpc();
    try {
      const vcPaused = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
      assert.isTrue(vcPaused.paused);
      const [attBKey] = attestationPda(walletB.publicKey, issuer.publicKey, gateProgram.programId);
      await expectLeyfisError(callGate(walletB, attBKey), "GatePaused");
    } finally {
      // Always unpause so test 8 is not affected
      await gateProgram.methods.unpauseGate()
        .accounts({ vaultConfig: vaultConfigKey, authority: operator.publicKey }).rpc();
    }
    const vcUnpaused = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    assert.isFalse(vcUnpaused.paused);
  });

  it("TEST 8 ? APPROVED: lower min_tier via update_vault_config ? walletC passes", async () => {
    const [attCKey] = attestationPda(walletC.publicKey, issuer.publicKey, gateProgram.programId);
    const vcBefore = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    assert.equal(vcBefore.minTier, 3);
    await expectLeyfisError(callGate(walletC, attCKey), "TierInsufficient");
    await gateProgram.methods.updateVaultConfig(1, null)
      .accounts({ vaultConfig: vaultConfigKey, authority: operator.publicKey }).rpc();
    const vcUpdated = await gateProgram.account.vaultConfig.fetch(vaultConfigKey);
    assert.equal(vcUpdated.minTier, 1);
    const nonceBefore = vcUpdated.auditNonce.toNumber();
    await callGate(walletC, attCKey);
    const [auditKey] = auditEntryPda(vaultConfigKey, BigInt(nonceBefore), gateProgram.programId);
    const entry = await gateProgram.account.auditEntry.fetch(auditKey);
    assert.deepEqual(entry.outcome, { approved: {} });
    assert.equal(entry.reasonCode, 0);
    assert.equal(entry.tier, 1);
  });
});
