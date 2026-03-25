"use client";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AdminShell } from "@/components/AdminShell";
import { shortAddr, txUrl, GATE_PROGRAM_ID, SEEDS } from "@leyfis/shared";
const m = {fontFamily:"'DM Mono',monospace"};
const inp:any={...m,fontSize:"12px",background:"rgba(232,238,246,0.04)",border:"1px solid rgba(232,238,246,0.1)",color:"#E8EEF6",padding:"10px 14px",width:"100%",outline:"none"};

export default function IssuePage() {
  const {publicKey}=useWallet();
  const [mounted,setMounted]=useState(false); useEffect(()=>setMounted(true),[]);
  const [wallet,setWallet]=useState(""); const [tier,setTier]=useState(3);
  const [jurisdiction,setJurisdiction]=useState("CHE"); const [days,setDays]=useState(365);
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState<{sig?:string;error?:string;status:"idle"|"success"|"error"}>({status:"idle"});
  const [walletError,setWalletError]=useState("");

  const validateWallet=(val:string)=>{
    try { new PublicKey(val); setWalletError(""); return true; }
    catch { setWalletError("Invalid Solana public key"); return false; }
  };

  const issue=async()=>{
    if(!publicKey||!wallet||!validateWallet(wallet)) return;
    setLoading(true); setResult({status:"idle"});
    try {
      // In demo: simulate success. Real call requires devnet redeploy.
      await new Promise(r=>setTimeout(r,1200));
      setResult({sig:"demo-mode-redeploy-pending-3xKw8mNpQr2...",status:"success"});
    } catch(e:any){ setResult({error:e.message?.slice(0,120)||"Unknown error",status:"error"}); }
    finally { setLoading(false); }
  };

  if(!mounted) return null;
  return (
    <AdminShell current="/issue">
      <div style={{marginBottom:"32px"}}>
        <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"16px"}}>/03 ? KYC Issuer Panel</div>
        <h1 style={{fontSize:"clamp(28px,3vw,40px)",fontWeight:700,letterSpacing:"-0.02em",marginBottom:"8px"}}>Issue Attestation</h1>
        <p style={{...m,fontSize:"11px",color:"rgba(232,238,246,0.35)",lineHeight:1.7}}>Issue a signed on-chain credential to a wallet. Sets clearance tier, jurisdiction, and expiry.</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:"24px",alignItems:"start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
              <label style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.5)",letterSpacing:"0.12em",textTransform:"uppercase"}}>Wallet Address</label>
              {walletError && <span style={{...m,fontSize:"9px",color:"#C44444"}}>{walletError}</span>}
            </div>
            <input value={wallet} onChange={e=>{setWallet(e.target.value);if(e.target.value)validateWallet(e.target.value);}} placeholder="Enter Solana wallet public key..." style={{...inp,borderColor:walletError?"rgba(196,68,68,0.4)":"rgba(232,238,246,0.1)"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"16px"}}>
            <div><label style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.5)",letterSpacing:"0.12em",textTransform:"uppercase",display:"block",marginBottom:"8px"}}>Clearance Tier</label>
              <select value={tier} onChange={e=>setTier(parseInt(e.target.value))} style={inp}><option value={1}>Tier 1 ? Basic</option><option value={2}>Tier 2 ? Enhanced</option><option value={3}>Tier 3 ? Institutional</option></select></div>
            <div><label style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.5)",letterSpacing:"0.12em",textTransform:"uppercase",display:"block",marginBottom:"8px"}}>Jurisdiction</label>
              <select value={jurisdiction} onChange={e=>setJurisdiction(e.target.value)} style={inp}>{["CHE","GBR","SGP","USA","DEU","FRA","LUX","ARE","HKG","JPN"].map(j=><option key={j}>{j}</option>)}</select></div>
            <div><label style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.5)",letterSpacing:"0.12em",textTransform:"uppercase",display:"block",marginBottom:"8px"}}>Validity (days)</label>
              <input type="number" value={days} onChange={e=>setDays(parseInt(e.target.value)||365)} style={inp}/></div>
          </div>
          {publicKey ? (
            <button onClick={issue} disabled={loading||!wallet||!!walletError} style={{...m,fontSize:"11px",letterSpacing:"0.12em",textTransform:"uppercase",background:loading||!wallet||!!walletError?"rgba(27,79,216,0.3)":"#1B4FD8",color:"#E8EEF6",border:"none",padding:"14px 28px",cursor:loading||!wallet||!!walletError?"not-allowed":"pointer",alignSelf:"flex-start",fontWeight:700}}>
              {loading?"Issuing on-chain...":"Issue Attestation"}
            </button>
          ) : <div style={{...m,fontSize:"10px",color:"rgba(196,68,68,0.7)"}}>Connect your issuer wallet to issue attestations.</div>}
          {result.status==="success"&&(
            <div style={{border:"1px solid rgba(27,79,216,0.25)",background:"rgba(27,79,216,0.04)",padding:"20px"}}>
              <div style={{...m,fontSize:"10px",color:"#1B4FD8",fontWeight:700,letterSpacing:"0.1em",marginBottom:"8px"}}>ATTESTATION ISSUED</div>
              <div style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.5)",marginBottom:"12px",wordBreak:"break-all"}}>{result.sig}</div>
              <a href="/registry" style={{...m,fontSize:"10px",color:"#1B4FD8",textDecoration:"none",letterSpacing:"0.08em"}}>View in Registry ?</a>
            </div>
          )}
          {result.status==="error"&&(
            <div style={{border:"1px solid rgba(196,68,68,0.25)",background:"rgba(196,68,68,0.04)",padding:"20px"}}>
              <div style={{...m,fontSize:"10px",color:"#C44444",fontWeight:700,marginBottom:"8px"}}>FAILED</div>
              <div style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.5)"}}>{result.error}</div>
            </div>
          )}
        </div>

        <div style={{border:"1px solid rgba(232,238,246,0.08)",padding:"24px",position:"sticky",top:"80px"}}>
          <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"16px"}}>Attestation Preview</div>
          {[["Wallet",wallet?shortAddr(wallet,8):"?"],["Issuer",publicKey?shortAddr(publicKey.toBase58(),8):"?"],["Tier",`Tier ${tier}`],["Jurisdiction",jurisdiction],["Issued",new Date().toISOString().slice(0,10)],["Expires",new Date(Date.now()+days*86400000).toISOString().slice(0,10)],["Duration",`${days} days`]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",...m,fontSize:"10px",padding:"8px 0",borderBottom:"1px solid rgba(232,238,246,0.04)"}}>
              <span style={{color:"rgba(232,238,246,0.3)"}}>{l}</span>
              <span style={{color:v==="?"?"rgba(232,238,246,0.2)":"rgba(232,238,246,0.7)"}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
