import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import fs from "fs";

const GATE = new PublicKey("Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP");
const VAULT = new PublicKey("88x1hxWW6mMDpQQwuR3sCDgnmbHwHmQBdWYZQhcedNaJ");
const RPC = "https://devnet.helius-rpc.com/?api-key=2414c8d2-3eff-4fda-9c74-b8c0f93d768b";
const WB = new PublicKey("64je9DfojWKRt3EoxXPcq1DCWqyFNknQ7XWTxF7ekxfb");

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const issuerRaw = JSON.parse(fs.readFileSync("/workspace/keys/issuer.json","utf8"));
  const issuer = Keypair.fromSecretKey(Uint8Array.from(issuerRaw));
  const wallet = new anchor.Wallet(issuer);
  const provider = new anchor.AnchorProvider(connection, wallet, {commitment:"confirmed"});
  anchor.setProvider(provider);
  const idl = JSON.parse(fs.readFileSync("/workspace/target/idl/leyfis_gate.json","utf8"));
  const program = new anchor.Program(idl, provider);

  const [attPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("attestation"), WB.toBuffer(), issuer.publicKey.toBuffer()],
    GATE
  );

  const existing = await connection.getAccountInfo(attPDA);
  if (existing) { console.log("Attestation already exists:", attPDA.toBase58()); return; }

  const kyc_ref = new Uint8Array(32);
  Buffer.from("amina-kyc-00001").copy(Buffer.from(kyc_ref));
  const expires_at = Math.floor(Date.now()/1000) + 365*24*3600;

  const tx = await program.methods
    .issueTestAttestation(3, new anchor.BN(expires_at), Array.from(kyc_ref), [67,72,69])
    .accounts({
      attestation: attPDA,
      wallet: WB,
      issuer: issuer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([issuer])
    .rpc();

  console.log("Attestation issued for Wallet B:", tx);
  console.log("Attestation PDA:", attPDA.toBase58());
}

main().catch(console.error);
