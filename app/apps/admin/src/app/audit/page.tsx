"use client";
import { useState, useEffect } from "react";
import { AdminShell } from "@/components/AdminShell";
import { VAULT_PROGRAM_ID, shortAddr, REASON_CODES } from "@leyfis/shared";
import { MOCK_AUDIT, AuditEntry } from "../../hooks/useLeyfis";
import { CheckCircle, XCircle, Search, SlidersHorizontal, ExternalLink } from "lucide-react";

const m = {fontFamily:"'DM Mono',monospace"};
const f = {fontFamily:"'Inter',sans-serif"};

const EXTRA: AuditEntry[] = Array.from({length:12},(_,i)=>({wallet:i%3===0?"64je9Dfo...kxfb":"5t1okyeK...s9fjS",vault:shortAddr(VAULT_PROGRAM_ID),timestamp:Math.floor(Date.now()/1000)-(i+1)*300,slot:450558600-i*50,outcome:(i%3===0?"approved":"denied") as any,reasonCode:i%3===0?0:i%5===0?2:1,attestationId:i%3===0?"Ax7mPq...3kLw":"111...111",tier:i%3===0?3:0}));

export default function AuditPage() {
  const [mounted,setMounted]=useState(false); useEffect(()=>setMounted(true),[]);
  const entries=[...MOCK_AUDIT,...EXTRA];
  const [filter,setFilter]=useState<"all"|"approved"|"denied">("all");
  const [search,setSearch]=useState("");
  const filtered=entries.filter(e=>{ if(filter!=="all"&&e.outcome!==filter)return false; if(search&&!e.wallet.toLowerCase().includes(search.toLowerCase()))return false; return true; });
  const approved=entries.filter(e=>e.outcome==="approved").length;
  const denied=entries.filter(e=>e.outcome==="denied").length;
  if(!mounted) return null;
  return (
    <AdminShell current="/audit">
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"28px"}}>
        <div>
          <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"10px"}}>/05 ? Audit Log</div>
          <h1 style={{...f,fontSize:"26px",fontWeight:700,letterSpacing:"-0.02em",marginBottom:"4px",color:"var(--text-1)"}}>On-Chain Audit Log</h1>
          <p style={{...m,fontSize:"11px",color:"var(--text-3)"}}>Immutable. Every gate call recorded permanently on-chain.</p>
        </div>
        <a href="/export" style={{...m,fontSize:"10px",letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--accent)",border:"1px solid var(--accent-border)",padding:"9px 16px",background:"var(--accent-bg)"}}>Export CSV ?</a>
      </div>

      <div style={{display:"flex",gap:"2px",marginBottom:"20px"}}>
        {[[entries.length,"Total","var(--text-1)"],[approved,"Approved","var(--accent)"],[denied,"Denied","var(--danger)"]].map(([v,l,c],i)=>(
          <div key={i} style={{border:"1px solid var(--border)",padding:"16px 24px",background:"var(--bg-1)",flex:1}}>
            <div style={{...f,fontSize:"24px",fontWeight:800,color:c as string,lineHeight:1,marginBottom:"4px"}}>{v}</div>
            <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase"}}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:"8px",marginBottom:"12px",alignItems:"center",flexWrap:"wrap"}}>
        <div style={{position:"relative",flex:1,minWidth:"200px"}}>
          <Search size={12} color="var(--text-4)" style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)"}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter by wallet..." style={{...m,fontSize:"11px",background:"var(--bg-1)",border:"1px solid var(--border)",color:"var(--text-1)",padding:"8px 12px 8px 32px",width:"100%",outline:"none"}}/>
        </div>
        <div style={{display:"flex",gap:"4px"}}>
          {(["all","approved","denied"] as const).map(f2=>(
            <button key={f2} onClick={()=>setFilter(f2)} style={{...m,fontSize:"9px",letterSpacing:"0.08em",textTransform:"uppercase",padding:"8px 14px",background:filter===f2?"var(--accent)":"var(--bg-1)",color:filter===f2?"white":"var(--text-3)",border:`1px solid ${filter===f2?"var(--accent)":"var(--border)"}`,cursor:"pointer"}}>{f2}</button>
          ))}
        </div>
        <span style={{...m,fontSize:"9px",color:"var(--text-4)",marginLeft:"auto"}}>{filtered.length} entries</span>
      </div>

      <div style={{border:"1px solid var(--border)",background:"var(--bg-1)"}}>
        <div style={{display:"grid",gridTemplateColumns:"90px 1fr 1fr 110px 50px",gap:"12px",padding:"10px 16px",...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase",borderBottom:"1px solid var(--border)"}}>
          <span>Outcome</span><span>Wallet</span><span>Reason</span><span>Timestamp</span><span>Tier</span>
        </div>
        {filtered.map((e,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"90px 1fr 1fr 110px 50px",gap:"12px",padding:"11px 16px",borderBottom:i<filtered.length-1?"1px solid var(--border)":"none",alignItems:"center",borderLeft:`2px solid ${e.outcome==="approved"?"var(--accent)":"var(--danger)"}`,background:i%2===0?"transparent":"var(--bg-2)"}}>
            <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
              {e.outcome==="approved"?<CheckCircle size={11} color="var(--accent)"/>:<XCircle size={11} color="var(--danger)"/>}
              <span style={{...m,fontSize:"9px",color:e.outcome==="approved"?"var(--accent)":"var(--danger)",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase"}}>{e.outcome==="approved"?"PASS":"DENY"}</span>
            </div>
            <span style={{...m,fontSize:"10px",color:"var(--text-2)"}}>{e.wallet}</span>
            <span style={{...m,fontSize:"10px",color:"var(--text-3)"}}>{REASON_CODES[e.reasonCode]}</span>
            <span style={{...m,fontSize:"10px",color:"var(--text-4)"}}>{new Date(e.timestamp*1000).toISOString().slice(11,19)} UTC</span>
            <span style={{...m,fontSize:"10px",color:"var(--text-3)"}}>{e.tier>0?`T${e.tier}`:"?"}</span>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
