import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import fs from "fs";

const GATE_PROGRAM_ID = new PublicKey("Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP");
const VAULT_PROGRAM_ID = new PublicKey("88x1hxWW6mMDpQQwuR3sCDgnmbHwHmQBdWYZQhcedNaJ");
const RPC = "https://devnet.helius-rpc.com/?api-key=2414c8d2-3eff-4fda-9c74-b8c0f93d768b";

async function main() {
  const connection = new anchor.web3.Connection(RPC, "confirmed");
  const deployerRaw = JSON.parse(fs.readFileSync("/workspace/keys/deployer.json", "utf8"));
  const deployer = Keypair.fromSecretKey(Uint8Array.from(deployerRaw));
  const issuerRaw = JSON.parse(fs.readFileSync("/workspace/keys/issuer.json", "utf8"));
  const issuer = Keypair.fromSecretKey(Uint8Array.from(issuerRaw));

  const wallet = new anchor.Wallet(deployer);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync("/workspace/target/idl/leyfis_gate.json", "utf8"));
  const program = new anchor.Program(idl, provider);

  console.log("Deployer:", deployer.publicKey.toBase58());
  console.log("Issuer:  ", issuer.publicKey.toBase58());

  const [vaultConfigPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_config"), VAULT_PROGRAM_ID.toBuffer()],
    GATE_PROGRAM_ID
  );
  const [issuerRegistryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("issuer_registry")],
    GATE_PROGRAM_ID
  );

  console.log("VaultConfig PDA:    ", vaultConfigPDA.toBase58());
  console.log("IssuerRegistry PDA: ", issuerRegistryPDA.toBase58());

  // 1. Initialize VaultConfig
  try {
    const existing = await connection.getAccountInfo(vaultConfigPDA);
    if (existing) {
      console.log("VaultConfig already exists - skipping");
    } else {
      const tx = await program.methods
        .initializeVaultConfig(3, [issuer.publicKey])
        .accounts({
          vaultConfig: vaultConfigPDA,
          authority: deployer.publicKey,
          vaultProgram: VAULT_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([deployer])
        .rpc();
      console.log("VaultConfig initialized:", tx);
    }
  } catch(e: any) { console.error("VaultConfig error:", e.message); }

  // 2. Initialize IssuerRegistry
  try {
    const existing = await connection.getAccountInfo(issuerRegistryPDA);
    if (existing) {
      console.log("IssuerRegistry already exists - skipping");
    } else {
      const tx = await program.methods
        .initializeIssuerRegistry()
        .accounts({
          issuerRegistry: issuerRegistryPDA,
          authority: deployer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([deployer])
        .rpc();
      console.log("IssuerRegistry initialized:", tx);
    }
  } catch(e: any) { console.error("IssuerRegistry error:", e.message); }

  // 3. Register issuer
  try {
    const tx = await program.methods
      .registerIssuer(issuer.publicKey, VAULT_PROGRAM_ID)
      .accounts({
        issuerRegistry: issuerRegistryPDA,
        authority: deployer.publicKey,
      })
      .signers([deployer])
      .rpc();
    console.log("Issuer registered:", tx);
  } catch(e: any) { console.error("RegisterIssuer error:", e.message); }

  console.log("\n=== DONE ===");
  console.log("VaultConfig:    ", vaultConfigPDA.toBase58());
  console.log("IssuerRegistry: ", issuerRegistryPDA.toBase58());
}

main().catch(console.error);
