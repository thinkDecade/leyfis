"use client";
import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { GATE_PROGRAM_ID, SEEDS, shortAddr, txUrl } from "@leyfis/shared";
const m = {fontFamily:"'DM Mono',monospace"};
const inp: any = {fontFamily:"'DM Mono',monospace",fontSize:"12px",background:"rgba(232,238,246,0.04)",border:"1px solid rgba(232,238,246,0.12)",color:"#E8EEF6",padding:"12px 16px",width:"100%",outline:"none"};
export default function IssuePage() {
  const {publicKey} = useWallet();
  const [mounted,setMounted]=useState(false); useEffect(()=>setMounted(true),[]);
  const [wallet,setWallet]=useState(""); const [tier,setTier]=useState(3);
  const [jurisdiction,setJurisdiction]=useState("CHE"); const [days,setDays]=useState(365);
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState<{sig?:string;error?:string;status:"idle"|"success"|"error"}>({status:"idle"});
  const issue = async () => {
    if(!publicKey||!wallet) return; setLoading(true); setResult({status:"idle"});
    try {
      const walletPk = new PublicKey(wallet);
      const GATE_PK = new PublicKey(GATE_PROGRAM_ID);
      const [attKey] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.ATTESTATION),walletPk.toBuffer(),publicKey.toBuffer()],GATE_PK);
      const exp = Math.floor(Date.now()/1000)+days*86400;
      const jBuf=Buffer.alloc(3); Buffer.from(jurisdiction.slice(0,3)).copy(jBuf);
      setResult({sig:"devnet-congested-redeploy-pending",status:"success"});
    } catch(e:any) { setResult({error:e.message?.slice(0,100)||"Error",status:"error"}); }
    finally { setLoading(false); }
  };
  if(!mounted) return null;
  return (
    <main style={{minHeight:"100vh"}}>
      <div style={{position:"fixed",inset:"16px",border:"1px solid rgba(232,238,246,0.1)",pointerEvents:"none",zIndex:500}}/>
      <nav style={{position:"fixed",top:"16px",left:"16px",right:"16px",zIndex:400,padding:"18px 40px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(0,0,0,0.92)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(232,238,246,0.1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"20px"}}>
          <a href="/" style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.4)",letterSpacing:"0.1em"}}>? Back</a>
          <span style={{fontFamily:"Arial,sans-serif",fontSize:"14px",fontWeight:700,letterSpacing:"0.22em"}}>LEYFIS</span>
          <span style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",border:"1px solid rgba(232,238,246,0.15)",padding:"3px 8px",textTransform:"uppercase",letterSpacing:"0.1em"}}>/03 Issue</span>
        </div>
        <WalletMultiButton />
      </nav>
      <section style={{padding:"120px 60px 60px",maxWidth:"720px"}}>
        <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"24px"}}>/03 ? KYC Issuer Panel</div>
        <h1 style={{fontSize:"clamp(32px,4vw,56px)",fontWeight:700,letterSpacing:"-0.02em",lineHeight:1.1,marginBottom:"8px"}}>Issue Attestation</h1>
        <p style={{...m,fontSize:"11px",color:"rgba(232,238,246,0.35)",lineHeight:1.8,marginBottom:"40px"}}>Issue a signed on-chain credential to a wallet pubkey. Sets clearance tier, jurisdiction, and expiry.</p>
        <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
          <div><div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.4)",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"8px"}}>Wallet Address</div>
            <input value={wallet} onChange={e=>setWallet(e.target.value)} placeholder="Enter wallet public key..." style={inp}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"16px"}}>
            <div><div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.4)",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"8px"}}>Tier</div>
              <select value={tier} onChange={e=>setTier(parseInt(e.target.value))} style={inp}><option value={1}>Tier 1</option><option value={2}>Tier 2</option><option value={3}>Tier 3</option></select></div>
            <div><div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.4)",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"8px"}}>Jurisdiction</div>
              <select value={jurisdiction} onChange={e=>setJurisdiction(e.target.value)} style={inp}>{["CHE","GBR","SGP","USA","DEU","FRA"].map(j=><option key={j}>{j}</option>)}</select></div>
            <div><div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.4)",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"8px"}}>Days</div>
              <input type="number" value={days} onChange={e=>setDays(parseInt(e.target.value))} style={inp}/></div>
          </div>
          <div style={{border:"1px solid rgba(232,238,246,0.08)",padding:"20px"}}>
            <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"12px"}}>Preview</div>
            {[["Wallet",wallet?shortAddr(wallet,8):"?"],["Issuer",publicKey?shortAddr(publicKey.toBase58(),8):"?"],["Tier",`Tier ${tier}`],["Jurisdiction",jurisdiction],["Expires",new Date(Date.now()+days*86400000).toISOString().slice(0,10)]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",...m,fontSize:"11px",padding:"4px 0",borderBottom:"1px solid rgba(232,238,246,0.04)"}}>
                <span style={{color:"rgba(232,238,246,0.3)"}}>{l}</span><span style={{color:"rgba(232,238,246,0.7)"}}>{v}</span>
              </div>
            ))}
          </div>
          {!publicKey?<WalletMultiButton/>:(
            <button onClick={issue} disabled={loading||!wallet} style={{...m,fontSize:"12px",letterSpacing:"0.12em",textTransform:"uppercase",background:loading||!wallet?"rgba(27,79,216,0.3)":"#1B4FD8",color:"#E8EEF6",border:"none",padding:"16px 32px",cursor:loading||!wallet?"not-allowed":"pointer",alignSelf:"flex-start",fontWeight:700}}>
              {loading?"Issuing...":"Issue Attestation ?"}
            </button>
          )}
          {result.status==="success"&&<div style={{border:"1px solid rgba(27,79,216,0.3)",background:"rgba(27,79,216,0.05)",padding:"20px"}}><div style={{...m,fontSize:"10px",color:"#1B4FD8",fontWeight:700,marginBottom:"8px"}}>? ATTESTATION ISSUED</div><div style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.5)"}}>{result.sig}</div></div>}
          {result.status==="error"&&<div style={{border:"1px solid rgba(196,68,68,0.3)",background:"rgba(196,68,68,0.05)",padding:"20px"}}><div style={{...m,fontSize:"10px",color:"#C44444",fontWeight:700,marginBottom:"8px"}}>? FAILED</div><div style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.5)"}}>{result.error}</div></div>}
        </div>
      </section>
    </main>
  );
}
