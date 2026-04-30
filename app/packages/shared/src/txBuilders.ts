import {
  PublicKey, TransactionInstruction, SystemProgram,
  Connection, Transaction, SendOptions,
} from "@solana/web3.js";

export const DISC = {
  pause_gate:                 Buffer.from([79, 180, 185, 205, 226, 110,  38, 175]),
  unpause_gate:               Buffer.from([89, 195,  99, 240, 139,  38, 223, 165]),
  update_vault_config:        Buffer.from([122,   3,  21, 222, 158, 255, 238, 157]),
  issue_test_attestation:     Buffer.from([150, 135, 145,  54,  84,   7,  39,  28]),
  revoke_attestation:         Buffer.from([ 12, 156, 103, 161, 194, 246, 211, 179]),
  register_issuer:            Buffer.from([145, 117,  52,  59, 189,  27, 127,  18]),
  revoke_issuer:              Buffer.from([ 17, 145,  62, 240,  50, 135, 145, 181]),
  initialize_vault_config:    Buffer.from([199,  95,  61, 130, 239, 178,  88, 193]),
  initialize_issuer_registry: Buffer.from([157, 206,  75,  32, 236, 128, 138, 167]),
  initialize_treasury:        Buffer.from([124, 186, 211, 195,  85, 165, 129, 166]),
  update_treasury_config:     Buffer.from([129, 100, 213,  18,  68, 118, 249, 154]),
  withdraw_treasury:          Buffer.from([ 40,  63, 122, 158, 144, 216,  83,  96]),
} as const;

export function findVaultConfigPDA(vaultProgram: PublicKey, gateProgram: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_config"), vaultProgram.toBuffer()], gateProgram
  );
}
export function findIssuerRegistryPDA(gateProgram: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("issuer_registry")], gateProgram);
}
export function findAttestationPDA(wallet: PublicKey, issuer: PublicKey, gateProgram: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("attestation"), wallet.toBuffer(), issuer.toBuffer()], gateProgram
  );
}
export function findAuditEntryPDA(vaultConfigKey: PublicKey, nonce: bigint, gateProgram: PublicKey) {
  const b = Buffer.alloc(8); b.writeBigUInt64LE(nonce);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("audit_entry"), vaultConfigKey.toBuffer(), b], gateProgram
  );
}

export function findTreasuryPDA(gateProgram: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("treasury")], gateProgram);
}
export function findTreasuryConfigPDA(gateProgram: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("treasury_config")], gateProgram);
}

function encodeOptionU8(v: number | null) {
  return v === null ? Buffer.from([0]) : Buffer.from([1, v]);
}
function encodeOptionVecPubkeys(keys: PublicKey[] | null) {
  if (keys === null) return Buffer.from([0]);
  const buf = Buffer.alloc(1 + 4 + keys.length * 32);
  buf[0] = 1; buf.writeUInt32LE(keys.length, 1);
  keys.forEach((k, i) => k.toBuffer().copy(buf, 5 + i * 32));
  return buf;
}
function encodeI64LE(v: number) {
  const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(v)); return b;
}

export function buildPauseGateIx(gate: PublicKey, vcPDA: PublicKey, authority: PublicKey): TransactionInstruction {
  return new TransactionInstruction({ programId: gate,
    keys: [{ pubkey: vcPDA, isSigner: false, isWritable: true }, { pubkey: authority, isSigner: true, isWritable: false }],
    data: DISC.pause_gate });
}
export function buildUnpauseGateIx(gate: PublicKey, vcPDA: PublicKey, authority: PublicKey): TransactionInstruction {
  return new TransactionInstruction({ programId: gate,
    keys: [{ pubkey: vcPDA, isSigner: false, isWritable: true }, { pubkey: authority, isSigner: true, isWritable: false }],
    data: DISC.unpause_gate });
}
export function buildUpdateVaultConfigIx(
  gate: PublicKey, vcPDA: PublicKey, authority: PublicKey,
  minTier: number | null, trustedIssuers: PublicKey[] | null
): TransactionInstruction {
  return new TransactionInstruction({ programId: gate,
    keys: [{ pubkey: vcPDA, isSigner: false, isWritable: true }, { pubkey: authority, isSigner: true, isWritable: false }],
    data: Buffer.concat([DISC.update_vault_config, encodeOptionU8(minTier), encodeOptionVecPubkeys(trustedIssuers)]) });
}
export function buildIssueAttestationIx(
  gate: PublicKey, attPDA: PublicKey, wallet: PublicKey, issuer: PublicKey,
  tier: number, expiresAt: number, kycRef: Uint8Array, jurisdiction: Uint8Array
): TransactionInstruction {
  const kr = Buffer.alloc(32); Buffer.from(kycRef).copy(kr, 0, 0, Math.min(kycRef.length, 32));
  const jr = Buffer.alloc(3);  Buffer.from(jurisdiction).copy(jr, 0, 0, 3);
  return new TransactionInstruction({ programId: gate,
    keys: [
      { pubkey: attPDA,                    isSigner: false, isWritable: true  },
      { pubkey: wallet,                    isSigner: false, isWritable: false },
      { pubkey: issuer,                    isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId,   isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([DISC.issue_test_attestation, Buffer.from([tier]), encodeI64LE(expiresAt), kr, jr]) });
}
export function buildRevokeAttestationIx(gate: PublicKey, attPDA: PublicKey, issuer: PublicKey): TransactionInstruction {
  return new TransactionInstruction({ programId: gate,
    keys: [{ pubkey: attPDA, isSigner: false, isWritable: true }, { pubkey: issuer, isSigner: true, isWritable: false }],
    data: DISC.revoke_attestation });
}
export function buildRegisterIssuerIx(
  gate: PublicKey, registryPDA: PublicKey, authority: PublicKey,
  issuerKey: PublicKey, vaultKey: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({ programId: gate,
    keys: [{ pubkey: registryPDA, isSigner: false, isWritable: true }, { pubkey: authority, isSigner: true, isWritable: false }],
    data: Buffer.concat([DISC.register_issuer, issuerKey.toBuffer(), vaultKey.toBuffer()]) });
}
export function buildRevokeIssuerIx(
  gate: PublicKey, registryPDA: PublicKey, authority: PublicKey,
  issuerKey: PublicKey, vaultKey: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({ programId: gate,
    keys: [{ pubkey: registryPDA, isSigner: false, isWritable: true }, { pubkey: authority, isSigner: true, isWritable: false }],
    data: Buffer.concat([DISC.revoke_issuer, issuerKey.toBuffer(), vaultKey.toBuffer()]) });
}

export function buildInitializeTreasuryIx(
  gate: PublicKey, authority: PublicKey, feeLamports: bigint
): TransactionInstruction {
  const [treasuryConfig] = findTreasuryConfigPDA(gate);
  const [treasury]       = findTreasuryPDA(gate);
  const feeBuf = Buffer.alloc(8); feeBuf.writeBigUInt64LE(feeLamports);
  return new TransactionInstruction({ programId: gate,
    keys: [
      { pubkey: treasuryConfig,            isSigner: false, isWritable: true  },
      { pubkey: treasury,                  isSigner: false, isWritable: true  },
      { pubkey: authority,                 isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId,   isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([DISC.initialize_treasury, feeBuf]) });
}
export function buildUpdateTreasuryConfigIx(
  gate: PublicKey, authority: PublicKey, feeLamports: bigint | null
): TransactionInstruction {
  const [treasuryConfig] = findTreasuryConfigPDA(gate);
  const optFee = feeLamports === null
    ? Buffer.from([0])
    : Buffer.concat([Buffer.from([1]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(feeLamports); return b; })()]);
  return new TransactionInstruction({ programId: gate,
    keys: [
      { pubkey: treasuryConfig, isSigner: false, isWritable: true  },
      { pubkey: authority,      isSigner: true,  isWritable: false },
    ],
    data: Buffer.concat([DISC.update_treasury_config, optFee]) });
}
export function buildWithdrawTreasuryIx(
  gate: PublicKey, authority: PublicKey, amountLamports: bigint
): TransactionInstruction {
  const [treasuryConfig] = findTreasuryConfigPDA(gate);
  const [treasury]       = findTreasuryPDA(gate);
  const amtBuf = Buffer.alloc(8); amtBuf.writeBigUInt64LE(amountLamports);
  return new TransactionInstruction({ programId: gate,
    keys: [
      { pubkey: treasuryConfig,            isSigner: false, isWritable: false },
      { pubkey: treasury,                  isSigner: false, isWritable: true  },
      { pubkey: authority,                 isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId,   isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([DISC.withdraw_treasury, amtBuf]) });
}

export async function sendAdminTx(
  connection: Connection, instruction: TransactionInstruction,
  payer: PublicKey, signTransaction: (tx: Transaction) => Promise<Transaction>,
  opts?: SendOptions
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction();
  tx.recentBlockhash = blockhash; tx.feePayer = payer; tx.add(instruction);
  const signed = await signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, ...opts });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}
