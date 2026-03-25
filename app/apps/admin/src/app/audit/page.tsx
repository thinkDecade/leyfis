"use client";
import { AdminShell } from "../../components/AdminShell";
import { useState, useEffect } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { VAULT_PROGRAM_ID, shortAddr, REASON_CODES } from "@leyfis/shared";
import { MOCK_AUDIT, AuditEntry } from "../../hooks/useLeyfis";
const m = {fontFamily:"'DM Mono',monospace"};
const EXTRA: AuditEntry[] = Array.from({length:12},(_,i)=>({wallet:i%3===0?"64je9Dfo...kxfb":"5t1okyeK...s9fjS",vault:shortAddr(VAULT_PROGRAM_ID),timestamp:Math.floor(Date.now()/1000)-(i+1)*300,slot:450558600-i*50,outcome:(i%3===0?"approved":"denied") as any,reasonCode:i%3===0?0:i%5===0?2:1,attestationId:i%3===0?"Ax7mPq...3kLw":"111...111",tier:i%3===0?3:0}));
export default function AuditPage() {
  const [mounted,setMounted]=useState(false); useEffect(()=>setMounted(true),[]);
  const entries=[...MOCK_AUDIT,...EXTRA];
  const [filter,setFilter]=useState<"all"|"approved"|"denied">("all");
  const [search,setSearch]=useState("");
  const filtered=entries.filter(e=>{ if(filter!=="all"&&e.outcome!==filter)return false; if(search&&!e.wallet.toLowerCase().includes(search.toLowerCase()))return false; return true; });
  if(!mounted) return null;
  return (
    <main style={{minHeight:"100vh"}}>
      <div style={{position:"fixed",inset:"16px",border:"1px solid rgba(232,238,246,0.1)",pointerEvents:"none",zIndex:500}}/>
      <nav style={{position:"fixed",top:"16px",left:"16px",right:"16px",zIndex:400,padding:"18px 40px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(0,0,0,0.92)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(232,238,246,0.1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"20px"}}>
          <a href="/" style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.4)",letterSpacing:"0.1em"}}>? Back</a>
          <span style={{fontFamily:"Arial,sans-serif",fontSize:"14px",fontWeight:700,letterSpacing:"0.22em"}}>LEYFIS</span>
          <span style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",border:"1px solid rgba(232,238,246,0.15)",padding:"3px 8px",textTransform:"uppercase",letterSpacing:"0.1em"}}>/05 Audit Log</span>
        </div>
        <div style={{display:"flex",gap:"12px",alignItems:"center"}}>
          <a href="/export" style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.4)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Export CSV ?</a>
          <WalletMultiButton />
        </div>
      </nav>
      <section style={{padding:"120px 60px 60px"}}>
        <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"24px"}}>/05 ? Audit Log</div>
        <h1 style={{fontSize:"clamp(32px,4vw,56px)",fontWeight:700,letterSpacing:"-0.02em",marginBottom:"8px"}}>On-Chain Audit Log</h1>
        <p style={{...m,fontSize:"11px",color:"rgba(232,238,246,0.35)",lineHeight:1.8,marginBottom:"32px"}}>Immutable. Every gate call recorded permanently.</p>
        <div style={{display:"flex",gap:"32px",padding:"16px 0",borderTop:"1px solid rgba(232,238,246,0.08)",borderBottom:"1px solid rgba(232,238,246,0.08)",marginBottom:"20px"}}>
          {[[entries.length,"Total"],[entries.filter(e=>e.outcome==="approved").length,"Approved","#1B4FD8"],[entries.filter(e=>e.outcome==="denied").length,"Denied","#C44444"]].map(([v,l,c],i)=>(
            <div key={i} style={{display:"flex",gap:"10px",alignItems:"baseline"}}><span style={{fontSize:"28px",fontWeight:700,color:(c as string)||"#E8EEF6"}}>{v}</span><span style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.12em",textTransform:"uppercase"}}>{l}</span></div>
          ))}
        </div>
        <div style={{display:"flex",gap:"12px",marginBottom:"16px",flexWrap:"wrap"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter by wallet..." style={{...m,fontSize:"11px",background:"rgba(232,238,246,0.04)",border:"1px solid rgba(232,238,246,0.12)",color:"#E8EEF6",padding:"10px 16px",outline:"none",width:"260px"}} />
          {(["all","approved","denied"] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{...m,fontSize:"9px",letterSpacing:"0.12em",textTransform:"uppercase",background:filter===f?"#1B4FD8":"transparent",color:filter===f?"#E8EEF6":"rgba(232,238,246,0.4)",border:"1px solid",borderColor:filter===f?"#1B4FD8":"rgba(232,238,246,0.15)",padding:"8px 16px",cursor:"pointer"}}>{f}</button>
          ))}
          <span style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",marginLeft:"auto",alignSelf:"center"}}>{filtered.length} entries</span>
        </div>
        <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.25)",letterSpacing:"0.1em",textTransform:"uppercase",display:"grid",gridTemplateColumns:"80px 150px 1fr 120px 60px",gap:"16px",padding:"8px 12px",borderBottom:"1px solid rgba(232,238,246,0.1)"}}>
          <span>Outcome</span><span>Wallet</span><span>Reason</span><span>Timestamp</span><span>Tier</span>
        </div>
        {filtered.map((e,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"80px 150px 1fr 120px 60px",gap:"16px",padding:"11px 12px",borderBottom:"1px solid rgba(232,238,246,0.04)",...m,fontSize:"10px",borderLeft:`2px solid ${e.outcome==="approved"?"#1B4FD8":"#C44444"}`,background:i%2===0?"transparent":"rgba(232,238,246,0.01)"}}>
            <span style={{color:e.outcome==="approved"?"#1B4FD8":"#C44444",fontWeight:700,letterSpacing:"0.06em"}}>{e.outcome==="approved"?"? PASS":"? DENY"}</span>
            <span style={{color:"rgba(232,238,246,0.6)"}}>{e.wallet}</span>
            <span style={{color:"rgba(232,238,246,0.4)"}}>{REASON_CODES[e.reasonCode]}</span>
            <span style={{color:"rgba(232,238,246,0.3)"}}>{new Date(e.timestamp*1000).toISOString().slice(11,19)} UTC</span>
            <span style={{color:"rgba(232,238,246,0.4)"}}>{e.tier>0?`T${e.tier}`:"?"}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
