import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const RPC      = "https://devnet.helius-rpc.com/?api-key=2414c8d2-3eff-4fda-9c74-b8c0f93d768b";
const GATE_ID  = new PublicKey("Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP");
const VAULT_ID = new PublicKey("88x1hxWW6mMDpQQwuR3sCDgnmbHwHmQBdWYZQhcedNaJ");
const KEYS     = path.join(__dirname, "../keys");

const C = { g:"\x1b[32m", r:"\x1b[31m", t:"\x1b[36m", y:"\x1b[33m", b:"\x1b[1m", x:"\x1b[0m" };
const ok   = (m:string) => console.log(`${C.g}?${C.x} ${m}`);
const fail = (m:string) => console.log(`${C.r}?${C.x} ${m}`);
const info = (m:string) => console.log(`${C.t}?${C.x} ${m}`);
const warn = (m:string) => console.log(`${C.y}!${C.x} ${m}`);
const log  = (m:string) => console.log(m);
const hdr  = (m:string) => console.log(`\n${C.b}${C.t}${m}${C.x}\n${"?".repeat(m.length)}`);

function kpPath(name:string){ return path.join(KEYS, name.endsWith(".json")?name:name+".json"); }
function loadKp(name:string): Keypair {
  const p = kpPath(name);
  if(!fs.existsSync(p)) throw new Error(`Keypair not found: ${p}`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p,"utf-8"))));
}
function pda(seeds: Buffer[], prog: PublicKey){ return PublicKey.findProgramAddressSync(seeds, prog); }
function vcPda()  { return pda([Buffer.from("vault_config"), VAULT_ID.toBuffer()], GATE_ID); }
function regPda() { return pda([Buffer.from("issuer_registry")], GATE_ID); }
function attPda(wallet:PublicKey, issuer:PublicKey){ return pda([Buffer.from("attestation"), wallet.toBuffer(), issuer.toBuffer()], GATE_ID); }
function jurBytes(j:string){ const b=Buffer.alloc(3); Buffer.from(j.slice(0,3)).copy(b); return Array.from(b); }
function ts(n:number){ return new Date(n*1000).toISOString().replace("T"," ").slice(0,19)+" UTC"; }

function setup_provider(signerKp: Keypair){ 
  const conn = new Connection(RPC,"confirmed");
  const prov = new AnchorProvider(conn, new Wallet(signerKp), {commitment:"confirmed"});
  anchor.setProvider(prov);
  const idlRaw = JSON.parse(fs.readFileSync(path.join(__dirname,"../target/idl/leyfis_gate.json"),"utf-8"));
  // Force the devnet program ID at every level Anchor checks
  idlRaw.address = GATE_ID.toBase58();
  if (!idlRaw.metadata) idlRaw.metadata = {};
  idlRaw.metadata.address = GATE_ID.toBase58();
  const prog = new Program(idlRaw, prov) as any;
  return {conn, prov, prog};
}

async function airdropIfNeeded(conn:Connection, pk:PublicKey, min=0.5){
  const bal = await conn.getBalance(pk)/LAMPORTS_PER_SOL;
  if(bal < min){
    warn(`${pk.toBase58().slice(0,8)}... has ${bal.toFixed(3)} SOL ? needs funding via https://faucet.solana.com`);
  } else {
    ok(`${pk.toBase58().slice(0,8)}... ${bal.toFixed(3)} SOL`);
  }
}

async function cmdSetup(){
  hdr("SETUP ? Initialise on-chain accounts");
  const deployer = loadKp("deployer");
  const issuerKp = loadKp("issuer");
  const {conn, prog} = setup_provider(deployer);
  await airdropIfNeeded(conn, deployer.publicKey, 0.5);

  const [regKey]  = regPda();
  const [vcKey]   = vcPda();

  info("Initialising IssuerRegistry...");
  try {
    const ex = await prog.account.issuerRegistry.fetchNullable(regKey);
    if(ex){ warn("IssuerRegistry already exists ? skipping"); }
    else {
      const sig = await prog.methods.initializeIssuerRegistry()
        .accounts({issuerRegistry:regKey, authority:deployer.publicKey, systemProgram:SystemProgram.programId})
        .rpc();
      ok(`IssuerRegistry: ${sig}`);
    }
  } catch(e:any){ if(!e.message?.includes("already in use")) throw e; warn("Already exists"); }

  info("Initialising VaultConfig (min_tier=3)...");
  try {
    const ex = await prog.account.vaultConfig.fetchNullable(vcKey);
    if(ex){ warn("VaultConfig already exists ? skipping"); }
    else {
      const sig = await prog.methods.initializeVaultConfig(3, [issuerKp.publicKey])
        .accounts({vaultConfig:vcKey, authority:deployer.publicKey, vaultProgram:VAULT_ID, systemProgram:SystemProgram.programId})
        .rpc();
      ok(`VaultConfig: ${sig}`);
    }
  } catch(e:any){ if(!e.message?.includes("already in use")) throw e; warn("Already exists"); }

  info("Registering issuer...");
  const sig = await prog.methods.registerIssuer(issuerKp.publicKey, VAULT_ID)
    .accounts({issuerRegistry:regKey, authority:deployer.publicKey})
    .rpc();
  ok(`Issuer registered: ${sig}`);

  const vc  = await prog.account.vaultConfig.fetch(vcKey);
  log(`\nVaultConfig : ${vcKey.toBase58()}`);
  log(`Min tier    : ${vc.minTier}`);
  log(`Paused      : ${vc.paused}`);
  log(`Issuer      : ${issuerKp.publicKey.toBase58()}`);
}

async function cmdDemo(){
  hdr("DEMO SETUP ? Preparing wallets");
  const issuerKp = loadKp("issuer");
  const walletA  = loadKp("wallet-a");
  const walletB  = loadKp("wallet-b");
  const {conn, prog} = setup_provider(issuerKp);

  await airdropIfNeeded(conn, issuerKp.publicKey, 0.3);
  await airdropIfNeeded(conn, walletA.publicKey,  0.1);
  await airdropIfNeeded(conn, walletB.publicKey,  0.1);

  const [attAKey] = attPda(walletA.publicKey, issuerKp.publicKey);
  const [attBKey] = attPda(walletB.publicKey, issuerKp.publicKey);
  const exp = Math.floor(Date.now()/1000) + 365*24*3600;

  const exA = await prog.account.leyfisAttestation.fetchNullable(attAKey);
  if(exA && !exA.revoked){
    warn("Wallet A has active attestation ? revoking...");
    await prog.methods.revokeAttestation().accounts({attestation:attAKey, issuer:issuerKp.publicKey}).rpc();
    ok("Wallet A revoked");
  } else { ok("Wallet A: no attestation (will be DENIED)"); }

  const exB = await prog.account.leyfisAttestation.fetchNullable(attBKey);
  if(exB && !exB.revoked){ ok("Wallet B: already has Tier 3 attestation"); }
  else {
    const sig = await prog.methods.issueTestAttestation(3, new anchor.BN(exp), Array.from(Buffer.alloc(32)), jurBytes("CHE"))
      .accounts({attestation:attBKey, wallet:walletB.publicKey, issuer:issuerKp.publicKey, systemProgram:SystemProgram.programId})
      .rpc();
    ok(`Wallet B: Tier 3 CHE issued ? ${sig}`);
  }

  log("\n" + "?".repeat(56));
  log(`${C.b}DEMO READY${C.x}`);
  log("?".repeat(56));
  log(`${C.r}Wallet A (DENIED)${C.x}  : ${walletA.publicKey.toBase58()}`);
  log(`${C.g}Wallet B (APPROVED)${C.x}: ${walletB.publicKey.toBase58()}`);
  log(`Gate               : ${GATE_ID.toBase58()}`);
  log("?".repeat(56));
}

async function cmdIssue(wallet:string, tier:number, jur:string){
  hdr("ISSUE ? Create attestation");
  const walletPk = new PublicKey(wallet);
  const issuerKp = loadKp("issuer");
  const {conn, prog} = setup_provider(issuerKp);
  await airdropIfNeeded(conn, issuerKp.publicKey, 0.3);
  const [attKey] = attPda(walletPk, issuerKp.publicKey);
  const exp = Math.floor(Date.now()/1000) + 365*24*3600;
  const ex = await prog.account.leyfisAttestation.fetchNullable(attKey);
  if(ex && !ex.revoked){ warn("Active attestation already exists. Revoke first."); return; }
  const sig = await prog.methods.issueTestAttestation(tier, new anchor.BN(exp), Array.from(Buffer.alloc(32)), jurBytes(jur))
    .accounts({attestation:attKey, wallet:walletPk, issuer:issuerKp.publicKey, systemProgram:SystemProgram.programId})
    .rpc();
  ok(`Issued! Tier=${tier} Jurisdiction=${jur}`);
  log(`Sig     : ${sig}`);
  log(`Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

async function cmdRevoke(wallet:string){
  hdr("REVOKE ? Revoke attestation");
  const walletPk = new PublicKey(wallet);
  const issuerKp = loadKp("issuer");
  const {prog} = setup_provider(issuerKp);
  const [attKey] = attPda(walletPk, issuerKp.publicKey);
  const ex = await prog.account.leyfisAttestation.fetchNullable(attKey);
  if(!ex){ fail("No attestation found"); return; }
  if(ex.revoked){ warn("Already revoked"); return; }
  const sig = await prog.methods.revokeAttestation().accounts({attestation:attKey, issuer:issuerKp.publicKey}).rpc();
  ok(`Revoked: ${sig}`);
}

async function cmdStatus(wallet:string){
  hdr("STATUS ? Attestation check");
  const walletPk = new PublicKey(wallet);
  const issuerKp = loadKp("issuer");
  const {prog} = setup_provider(issuerKp);
  const [attKey] = attPda(walletPk, issuerKp.publicKey);
  const att = await prog.account.leyfisAttestation.fetchNullable(attKey);
  if(!att){ fail("No attestation found"); return; }
  const now = Math.floor(Date.now()/1000);
  const status = att.revoked ? `${C.r}REVOKED${C.x}` : att.expiresAt.toNumber()<now ? `${C.y}EXPIRED${C.x}` : `${C.g}ACTIVE${C.x}`;
  log(`Status  : ${status}`);
  log(`Tier    : ${att.tier}`);
  log(`Expires : ${ts(att.expiresAt.toNumber())}`);
  log(`PDA     : ${attKey.toBase58()}`);
}

async function cmdInspect(){
  hdr("INSPECT ? Protocol state");
  const deployer = loadKp("deployer");
  const {prog} = setup_provider(deployer);
  const [vcKey]  = vcPda();
  const [regKey] = regPda();
  const vc  = await prog.account.vaultConfig.fetchNullable(vcKey);
  const reg = await prog.account.issuerRegistry.fetchNullable(regKey);
  if(!vc){ fail("VaultConfig not found ? run: setup"); return; }
  log(`VaultConfig : ${vcKey.toBase58()}`);
  log(`Min tier    : ${vc.minTier}`);
  log(`Paused      : ${vc.paused}`);
  log(`Audit nonce : ${vc.auditNonce}`);
  log(`Issuers     : ${vc.trustedIssuers.map((k:any)=>k.toBase58()).join(", ")}`);
  if(reg){ log(`Registry    : ${reg.issuers.length} issuers registered`); }
}

async function main(){
  const argv = process.argv.slice(2);
  const cmd  = argv[0];
  const get  = (flag:string) => { const i=argv.indexOf(flag); return i>=0?argv[i+1]:undefined; };

  log(`\n${C.b}${C.t}LEYFIS${C.x} Attestation CLI ? devnet\n`);

  switch(cmd){
    case "setup":   await cmdSetup(); break;
    case "demo":    await cmdDemo(); break;
    case "issue":   await cmdIssue(get("--wallet")||"", parseInt(get("--tier")||"3"), get("--jurisdiction")||"CHE"); break;
    case "revoke":  await cmdRevoke(get("--wallet")||""); break;
    case "status":  await cmdStatus(get("--wallet")||""); break;
    case "inspect": await cmdInspect(); break;
    default:
      log("Commands: setup | demo | issue --wallet <PK> --tier <1|2|3> --jurisdiction <CHE> | revoke --wallet <PK> | status --wallet <PK> | inspect");
  }
}

main().catch(e=>{ console.error(`\x1b[31m?\x1b[0m ${e.message}`); process.exit(1); });
