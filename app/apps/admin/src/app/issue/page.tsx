"use client";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AdminShell } from "@/components/AdminShell";
import { shortAddr, SEEDS, GATE_PROGRAM_ID } from "@leyfis/shared";
import { CheckCircle2, AlertCircle, Send } from "lucide-react";

const m = {fontFamily:"'DM Mono',monospace"};
const f = {fontFamily:"'Inter',sans-serif"};
const inp = (err?:boolean):any => ({...m,fontSize:"12px",background:"var(--bg-2)",border:`1px solid ${err?"var(--danger-border)":"var(--border)"}`,color:"var(--text-1)",padding:"10px 14px",width:"100%",outline:"none"});

export default function IssuePage() {
  const {publicKey}=useWallet();
  const [mounted,setMounted]=useState(false); useEffect(()=>setMounted(true),[]);
  const [wallet,setWallet]=useState(""); const [tier,setTier]=useState(3);
  const [jurisdiction,setJurisdiction]=useState("CHE"); const [days,setDays]=useState(365);
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState<{sig?:string;error?:string;status:"idle"|"success"|"error"}>({status:"idle"});
  const [walletErr,setWalletErr]=useState("");

  const validate=(v:string)=>{ try{new PublicKey(v);setWalletErr("");return true;}catch{setWalletErr("Invalid Solana public key");return false;} };
  const issue=async()=>{
    if(!publicKey||!wallet||!validate(wallet))return;
    setLoading(true); setResult({status:"idle"});
    try{ await new Promise(r=>setTimeout(r,1200)); setResult({sig:"demo-mode-3xKw8mNpQr2vL9s...",status:"success"}); }
    catch(e:any){ setResult({error:e.message?.slice(0,120)||"Error",status:"error"}); }
    finally{setLoading(false);}
  };

  if(!mounted) return null;
  return (
    <AdminShell current="/issue">
      <div style={{marginBottom:"28px"}}>
        <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"10px"}}>/03 ? KYC Issuer Panel</div>
        <h1 style={{...f,fontSize:"26px",fontWeight:700,letterSpacing:"-0.02em",marginBottom:"4px",color:"var(--text-1)"}}>Issue Attestation</h1>
        <p style={{...m,fontSize:"11px",color:"var(--text-3)",lineHeight:1.6}}>Issue a signed on-chain credential. Sets clearance tier, jurisdiction and expiry.</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:"20px",alignItems:"start"}}>
        <div style={{border:"1px solid var(--border)",background:"var(--bg-1)",padding:"28px",display:"flex",flexDirection:"column",gap:"20px"}}>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"7px"}}>
              <label style={{...m,fontSize:"9px",color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Wallet Address</label>
              {walletErr&&<span style={{...m,fontSize:"9px",color:"var(--danger)",display:"flex",alignItems:"center",gap:"4px"}}><AlertCircle size={10}/>{walletErr}</span>}
            </div>
            <input value={wallet} onChange={e=>{setWallet(e.target.value);if(e.target.value)validate(e.target.value);}} placeholder="Enter Solana wallet public key..." style={inp(!!walletErr)}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"14px"}}>
            <div><label style={{...m,fontSize:"9px",color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase",display:"block",marginBottom:"7px"}}>Clearance Tier</label>
              <select value={tier} onChange={e=>setTier(parseInt(e.target.value))} style={inp()}><option value={1}>Tier 1 ? Basic</option><option value={2}>Tier 2 ? Enhanced</option><option value={3}>Tier 3 ? Institutional</option></select></div>
            <div><label style={{...m,fontSize:"9px",color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase",display:"block",marginBottom:"7px"}}>Jurisdiction</label>
              <select value={jurisdiction} onChange={e=>setJurisdiction(e.target.value)} style={inp()}>{["CHE","GBR","SGP","USA","DEU","FRA","LUX","ARE","HKG","JPN"].map(j=><option key={j}>{j}</option>)}</select></div>
            <div><label style={{...m,fontSize:"9px",color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase",display:"block",marginBottom:"7px"}}>Validity (days)</label>
              <input type="number" value={days} onChange={e=>setDays(parseInt(e.target.value)||365)} style={inp()}/></div>
          </div>
          {publicKey ? (
            <button onClick={issue} disabled={loading||!wallet||!!walletErr} style={{display:"flex",alignItems:"center",gap:"8px",...m,fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",background:loading||!wallet||!!walletErr?"var(--accent-bg)":"var(--accent)",color:loading||!wallet||!!walletErr?"var(--accent)":"white",border:"1px solid var(--accent)",padding:"12px 24px",cursor:loading||!wallet||!!walletErr?"not-allowed":"pointer",alignSelf:"flex-start",fontWeight:600}}>
              <Send size={13}/>{loading?"Issuing on-chain...":"Issue Attestation"}
            </button>
          ) : <div style={{...m,fontSize:"11px",color:"var(--danger)",display:"flex",alignItems:"center",gap:"6px"}}><AlertCircle size={13}/>Connect your issuer wallet to continue.</div>}
          {result.status==="success"&&(
            <div style={{border:"1px solid rgba(22,163,74,0.2)",background:"rgba(22,163,74,0.04)",padding:"18px",display:"flex",flexDirection:"column",gap:"8px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px",...f,fontSize:"13px",fontWeight:600,color:"var(--success)"}}><CheckCircle2 size={16}/>Attestation Issued</div>
              <div style={{...m,fontSize:"10px",color:"var(--text-3)",wordBreak:"break-all"}}>{result.sig}</div>
              <a href="/registry" style={{...m,fontSize:"10px",color:"var(--accent)",letterSpacing:"0.08em",textTransform:"uppercase"}}>View in Registry ?</a>
            </div>
          )}
          {result.status==="error"&&(
            <div style={{border:"1px solid var(--danger-border)",background:"var(--danger-bg)",padding:"18px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px",...f,fontSize:"13px",fontWeight:600,color:"var(--danger)",marginBottom:"6px"}}><AlertCircle size={16}/>Transaction Failed</div>
              <div style={{...m,fontSize:"10px",color:"var(--text-3)"}}>{result.error}</div>
            </div>
          )}
        </div>
        <div style={{border:"1px solid var(--border)",background:"var(--bg-1)",padding:"24px",position:"sticky",top:"80px"}}>
          <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"16px"}}>Attestation Preview</div>
          {[["Wallet",wallet?shortAddr(wallet,8):"?"],["Issuer",publicKey?shortAddr(publicKey.toBase58(),8):"?"],["Tier",`Tier ${tier}`],["Jurisdiction",jurisdiction],["Issued",new Date().toISOString().slice(0,10)],["Expires",new Date(Date.now()+days*86400000).toISOString().slice(0,10)],["Duration",`${days} days`]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid var(--border)"}}>
              <span style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.06em",textTransform:"uppercase"}}>{l}</span>
              <span style={{...m,fontSize:"10px",color:v==="?"?"var(--text-4)":"var(--text-1)",fontWeight:500}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
