"use client";
import { useState, useEffect } from "react";
import { AdminShell } from "@/components/AdminShell";
import { VAULT_PROGRAM_ID, REASON_CODES } from "@leyfis/shared";
import { MOCK_AUDIT, AuditEntry } from "../../hooks/useLeyfis";
import { Download, FileText, Calendar, Filter } from "lucide-react";

const m = {fontFamily:"'DM Mono',monospace"};
const f = {fontFamily:"'Inter',sans-serif"};
const sep = "\n";

const EXTRA: AuditEntry[] = Array.from({length:20},(_,i)=>({wallet:i%3===0?"64je9DfojWKRt3EoxXPcq1DCWqyFNknQ7XWTxF7ekxfb":"5t1okyeKtcRDQwiq3LT3uSBKQgUEuPTZBBSj15is9fjS",vault:VAULT_PROGRAM_ID,timestamp:Math.floor(Date.now()/1000)-(i+1)*400,slot:450558600-i*50,outcome:(i%3===0?"approved":"denied") as any,reasonCode:i%3===0?0:i%5===0?2:1,attestationId:i%3===0?"Ax7mPqR9kLw3":"11111111111111111111111111111111",tier:i%3===0?3:0}));
const ALL: AuditEntry[] = [...MOCK_AUDIT,...EXTRA];

function toCSV(es:AuditEntry[]):string {
  const hdr="timestamp_utc,wallet_address,vault_address,outcome,reason_code,reason,tier,attestation_id,slot";
  const rows=es.map(e=>[new Date(e.timestamp*1000).toISOString(),e.wallet,e.vault,e.outcome,e.reasonCode,REASON_CODES[e.reasonCode]||"Unknown",e.tier,e.attestationId,e.slot].join(","));
  return [hdr,...rows].join(sep);
}

const FATF_FIELDS = ["timestamp_utc","wallet_address","vault_address","outcome","reason_code","reason","tier","attestation_id","slot"];

export default function ExportPage() {
  const [mounted,setMounted]=useState(false); useEffect(()=>setMounted(true),[]);
  const [from,setFrom]=useState(new Date(Date.now()-7*86400000).toISOString().slice(0,10));
  const [to,setTo]=useState(new Date().toISOString().slice(0,10));
  const [outcomeF,setOutcomeF]=useState<"all"|"approved"|"denied">("all");
  const [exporting,setExporting]=useState(false);
  const inp:any={...m,fontSize:"12px",background:"var(--bg-2)",border:"1px solid var(--border)",color:"var(--text-1)",padding:"10px 14px",width:"100%",outline:"none",colorScheme:"dark"};
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
  if(!mounted) return null;
  return (
    <AdminShell current="/export">
      <div style={{marginBottom:"28px"}}>
        <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"10px"}}>/07 ? Compliance Export</div>
        <h1 style={{...f,fontSize:"26px",fontWeight:700,letterSpacing:"-0.02em",marginBottom:"4px",color:"var(--text-1)"}}>Compliance Export</h1>
        <p style={{...m,fontSize:"11px",color:"var(--text-3)"}}>Export FATF R.16 aligned audit records for regulatory reporting.</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:"20px",alignItems:"start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
          <div style={{border:"1px solid var(--border)",background:"var(--bg-1)",padding:"24px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"20px"}}>
              <Calendar size={14} color="var(--text-3)"/>
              <span style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Date Range & Filters</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"14px"}}>
              <div><label style={{...m,fontSize:"9px",color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase",display:"block",marginBottom:"7px"}}>From</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={inp}/></div>
              <div><label style={{...m,fontSize:"9px",color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase",display:"block",marginBottom:"7px"}}>To</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={inp}/></div>
              <div><label style={{...m,fontSize:"9px",color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase",display:"block",marginBottom:"7px"}}>Outcome</label>
                <select value={outcomeF} onChange={e=>setOutcomeF(e.target.value as any)} style={inp}><option value="all">All outcomes</option><option value="approved">Approved only</option><option value="denied">Denied only</option></select></div>
            </div>
          </div>

          <div style={{border:"1px solid var(--border)",background:"var(--bg-1)"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <FileText size={13} color="var(--text-3)"/>
                <span style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Preview ? {filtered.length} records</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px",padding:"10px 16px",...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.08em",textTransform:"uppercase",borderBottom:"1px solid var(--border)"}}>
              <span>Timestamp</span><span>Wallet</span><span>Outcome</span><span>Tier</span><span>Reason</span>
            </div>
            {filtered.slice(0,6).map((e,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px",padding:"10px 16px",borderBottom:i<5?"1px solid var(--border)":"none",...m,fontSize:"9px",color:"var(--text-2)",alignItems:"center",borderLeft:`2px solid ${e.outcome==="approved"?"var(--accent)":"var(--danger)"}`}}>
                <span>{new Date(e.timestamp*1000).toISOString().slice(0,19)}</span>
                <span>{e.wallet.slice(0,12)}...</span>
                <span style={{color:e.outcome==="approved"?"var(--accent)":"var(--danger)",fontWeight:700,textTransform:"uppercase"}}>{e.outcome}</span>
                <span>{e.tier>0?`T${e.tier}`:"?"}</span>
                <span style={{color:"var(--text-3)"}}>{REASON_CODES[e.reasonCode]}</span>
              </div>
            ))}
            {filtered.length>6&&<div style={{padding:"10px 16px",...m,fontSize:"9px",color:"var(--text-4)"}}>+{filtered.length-6} more records in export</div>}
          </div>

          <button onClick={doExport} disabled={exporting||filtered.length===0} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",...m,fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",background:filtered.length===0?"var(--accent-bg)":"var(--accent)",color:filtered.length===0?"var(--accent)":"white",border:"1px solid var(--accent)",padding:"14px 28px",cursor:filtered.length===0?"not-allowed":"pointer",fontWeight:700}}>
            <Download size={14}/>{exporting?"Generating CSV...":`Export ${filtered.length} Records`}
          </button>
        </div>

        <div style={{border:"1px solid var(--border)",background:"var(--bg-1)",padding:"24px",position:"sticky",top:"80px"}}>
          <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"16px"}}>FATF R.16 Fields</div>
          {FATF_FIELDS.map((field,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 0",borderBottom:i<FATF_FIELDS.length-1?"1px solid var(--border)":"none"}}>
              <div style={{width:"5px",height:"5px",borderRadius:"50%",background:"var(--accent)",flexShrink:0}}/>
              <span style={{...m,fontSize:"10px",color:"var(--text-2)"}}>{field}</span>
            </div>
          ))}
          <div style={{marginTop:"16px",padding:"12px",background:"var(--bg-2)",border:"1px solid var(--border)"}}>
            <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.08em",marginBottom:"6px"}}>FORMAT</div>
            <div style={{...m,fontSize:"10px",color:"var(--text-2)"}}>UTF-8 CSV ? ISO 8601 timestamps</div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
