"use client";
import { AdminShell } from "../../components/AdminShell";
import { useState, useEffect } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { VAULT_PROGRAM_ID, REASON_CODES } from "@leyfis/shared";
import { MOCK_AUDIT, AuditEntry } from "../../hooks/useLeyfis";
const m = {fontFamily:"'DM Mono',monospace"};
const EXTRA: AuditEntry[] = Array.from({length:20},(_,i)=>({wallet:i%3===0?"64je9DfojWKRt3EoxXPcq1DCWqyFNknQ7XWTxF7ekxfb":"5t1okyeKtcRDQwiq3LT3uSBKQgUEuPTZBBSj15is9fjS",vault:VAULT_PROGRAM_ID,timestamp:Math.floor(Date.now()/1000)-(i+1)*400,slot:450558600-i*50,outcome:(i%3===0?"approved":"denied") as any,reasonCode:i%3===0?0:i%5===0?2:1,attestationId:i%3===0?"Ax7mPqR9kLw3":"11111111111111111111111111111111",tier:i%3===0?3:0}));
const ALL: AuditEntry[] = [...MOCK_AUDIT,...EXTRA];
function toCSV(es: AuditEntry[]): string {
  const sep = "\n";
  const hdr = "timestamp_utc,wallet_address,vault_address,outcome,reason_code,reason,tier,attestation_id,slot";
  const rows = es.map(e=>[new Date(e.timestamp*1000).toISOString(),e.wallet,e.vault,e.outcome,e.reasonCode,REASON_CODES[e.reasonCode]||"Unknown",e.tier,e.attestationId,e.slot].join(","));
  return [hdr,...rows].join(sep);
}
export default function ExportPage() {
  const [mounted,setMounted]=useState(false); useEffect(()=>setMounted(true),[]);
  const [from,setFrom]=useState(new Date(Date.now()-7*86400000).toISOString().slice(0,10));
  const [to,setTo]=useState(new Date().toISOString().slice(0,10));
  const [outcomeF,setOutcomeF]=useState<"all"|"approved"|"denied">("all");
  const [exporting,setExporting]=useState(false);
  const inp:any={...m,fontSize:"12px",background:"rgba(232,238,246,0.04)",border:"1px solid rgba(232,238,246,0.12)",color:"#E8EEF6",padding:"12px 16px",width:"100%",outline:"none",colorScheme:"dark"};
  const filtered=ALL.filter(e=>{
    const d=new Date(e.timestamp*1000).toISOString().slice(0,10);
    if(d<from||d>to)return false;
    if(outcomeF!=="all"&&e.outcome!==outcomeF)return false;
    return true;
  });
  const doExport=async()=>{
    setExporting(true);
    await new Promise(r=>setTimeout(r,600));
    const csv=toCSV(filtered);
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=`leyfis-audit-${from}-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };
  if(!mounted)return null;
  return (
    <main style={{minHeight:"100vh"}}>
      <div style={{position:"fixed",inset:"16px",border:"1px solid rgba(232,238,246,0.1)",pointerEvents:"none",zIndex:500}}/>
      <nav style={{position:"fixed",top:"16px",left:"16px",right:"16px",zIndex:400,padding:"18px 40px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(0,0,0,0.92)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(232,238,246,0.1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"20px"}}>
          <a href="/" style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.4)",letterSpacing:"0.1em"}}>? Back</a>
          <span style={{fontFamily:"Arial,sans-serif",fontSize:"14px",fontWeight:700,letterSpacing:"0.22em"}}>LEYFIS</span>
          <span style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",border:"1px solid rgba(232,238,246,0.15)",padding:"3px 8px",textTransform:"uppercase"}}>/07 Export</span>
        </div>
        <WalletMultiButton/>
      </nav>
      <section style={{padding:"120px 60px 60px",maxWidth:"900px"}}>
        <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"24px"}}>/07 ? Compliance Export</div>
        <h1 style={{fontSize:"clamp(32px,4vw,56px)",fontWeight:700,letterSpacing:"-0.02em",marginBottom:"8px"}}>Compliance Export</h1>
        <p style={{...m,fontSize:"11px",color:"rgba(232,238,246,0.35)",lineHeight:1.8,marginBottom:"40px"}}>Export FATF R.16 aligned audit records for regulatory reporting.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"16px",marginBottom:"28px"}}>
          <div><div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"8px"}}>From</div><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={inp}/></div>
          <div><div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"8px"}}>To</div><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={inp}/></div>
          <div><div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"8px"}}>Outcome</div>
            <select value={outcomeF} onChange={e=>setOutcomeF(e.target.value as any)} style={inp}><option value="all">All</option><option value="approved">Approved</option><option value="denied">Denied</option></select></div>
        </div>
        <div style={{border:"1px solid rgba(232,238,246,0.1)",padding:"24px",marginBottom:"28px"}}>
          <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"16px"}}>Preview ? {filtered.length} records</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px",...m,fontSize:"9px",color:"rgba(232,238,246,0.25)",letterSpacing:"0.08em",textTransform:"uppercase",borderBottom:"1px solid rgba(232,238,246,0.08)",paddingBottom:"8px",marginBottom:"8px"}}>
            <span>timestamp</span><span>wallet</span><span>outcome</span><span>tier</span><span>reason</span>
          </div>
          {filtered.slice(0,5).map((e,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px",padding:"6px 0",borderBottom:"1px solid rgba(232,238,246,0.04)",...m,fontSize:"9px",color:"rgba(232,238,246,0.45)"}}>
              <span>{new Date(e.timestamp*1000).toISOString().slice(0,19)}</span>
              <span>{e.wallet.slice(0,12)}...</span>
              <span style={{color:e.outcome==="approved"?"#1B4FD8":"#C44444",fontWeight:700}}>{e.outcome.toUpperCase()}</span>
              <span>{e.tier>0?`T${e.tier}`:"?"}</span>
              <span>{REASON_CODES[e.reasonCode]}</span>
            </div>
          ))}
          {filtered.length>5&&<div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.2)",marginTop:"10px"}}>+{filtered.length-5} more in export</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"16px",flexWrap:"wrap"}}>
          <button onClick={doExport} disabled={exporting||filtered.length===0} style={{...m,fontSize:"12px",letterSpacing:"0.12em",textTransform:"uppercase",background:filtered.length===0?"rgba(27,79,216,0.3)":"#1B4FD8",color:"#E8EEF6",border:"none",padding:"16px 32px",cursor:"pointer",fontWeight:700}}>
            {exporting?"Generating...":`Export ${filtered.length} Records ?`}
          </button>
          <div style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.3)",lineHeight:1.7}}>FATF R.16: wallet ? timestamp ? outcome ? tier ? attestation_id ? jurisdiction ? tx_hash</div>
        </div>
      </section>
    </main>
  );
}
