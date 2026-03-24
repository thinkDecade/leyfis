"use client";
import { useState, useEffect } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { GATE_PROGRAM_ID, VAULT_PROGRAM_ID, shortAddr, REASON_CODES } from "@leyfis/shared";
import { MOCK_AUDIT, AuditEntry } from "../../hooks/useLeyfis";
const m = {fontFamily:"'DM Mono',monospace"};
export default function VaultPage() {
  const [mounted,setMounted]=useState(false); useEffect(()=>setMounted(true),[]);
  const [paused,setPaused]=useState(false); const [minTier,setMinTier]=useState(3);
  const [pendingTier,setPendingTier]=useState(3); const [saving,setSaving]=useState(false);
  const entries: AuditEntry[] = MOCK_AUDIT;
  const approved=entries.filter(e=>e.outcome==="approved").length;
  const denied=entries.filter(e=>e.outcome==="denied").length;
  const togglePause=async()=>{ setSaving(true); await new Promise(r=>setTimeout(r,800)); setPaused(p=>!p); setSaving(false); };
  const saveTier=async()=>{ setSaving(true); await new Promise(r=>setTimeout(r,800)); setMinTier(pendingTier); setSaving(false); };
  if(!mounted) return null;
  return (
    <main style={{minHeight:"100vh"}}>
      <div style={{position:"fixed",inset:"16px",border:"1px solid rgba(232,238,246,0.1)",pointerEvents:"none",zIndex:500}}/>
      <nav style={{position:"fixed",top:"16px",left:"16px",right:"16px",zIndex:400,padding:"18px 40px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(0,0,0,0.92)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(232,238,246,0.1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"20px"}}>
          <a href="/" style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.4)",letterSpacing:"0.1em"}}>? Back</a>
          <span style={{fontFamily:"Arial,sans-serif",fontSize:"14px",fontWeight:700,letterSpacing:"0.22em"}}>LEYFIS</span>
          <span style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",border:"1px solid rgba(232,238,246,0.15)",padding:"3px 8px",textTransform:"uppercase",letterSpacing:"0.1em"}}>/02 Vault</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <div style={{...m,fontSize:"9px",padding:"4px 12px",background:paused?"rgba(196,68,68,0.15)":"rgba(27,79,216,0.12)",color:paused?"#C44444":"#1B4FD8",border:`1px solid ${paused?"rgba(196,68,68,0.3)":"rgba(27,79,216,0.3)"}`,letterSpacing:"0.1em",textTransform:"uppercase"}}>
            {paused?"? PAUSED":"? ACTIVE"}
          </div>
          <WalletMultiButton />
        </div>
      </nav>
      <section style={{padding:"120px 60px 40px"}}>
        <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"24px"}}>/02 ? Vault Operator</div>
        <h1 style={{fontSize:"clamp(32px,4vw,56px)",fontWeight:700,letterSpacing:"-0.02em",marginBottom:"48px"}}>Vault Dashboard</h1>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",marginBottom:"32px",borderTop:"1px solid rgba(232,238,246,0.08)"}}>
          {[[entries.length,"Total","#E8EEF6"],[approved,"Approved","#1B4FD8"],[denied,"Denied","#C44444"],[entries.length>0?Math.round(approved/entries.length*100)+"%":"?","Rate","#E8EEF6"]].map(([v,l,c],i)=>(
            <div key={i} style={{padding:"32px 40px",borderRight:"1px solid rgba(232,238,246,0.08)",borderBottom:"1px solid rgba(232,238,246,0.08)"}}>
              <div style={{fontSize:"clamp(32px,4vw,56px)",fontWeight:700,letterSpacing:"-0.02em",color:c as string,lineHeight:1,marginBottom:"8px"}}>{v}</div>
              <div style={{...m,fontSize:"9px",letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(232,238,246,0.3)"}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px",marginBottom:"32px"}}>
          <div style={{border:"1px solid rgba(232,238,246,0.1)",padding:"32px"}}>
            <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"16px"}}>Gate Status</div>
            <div style={{fontSize:"24px",fontWeight:700,marginBottom:"8px",color:paused?"#C44444":"#E8EEF6"}}>{paused?"Paused":"Active"}</div>
            <div style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.35)",lineHeight:1.7,marginBottom:"24px"}}>{paused?"All vault interactions blocked.":"All interactions pass through compliance checks."}</div>
            <button onClick={togglePause} disabled={saving} style={{...m,fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",background:paused?"#1B4FD8":"rgba(196,68,68,0.15)",color:paused?"#E8EEF6":"#C44444",border:`1px solid ${paused?"#1B4FD8":"rgba(196,68,68,0.4)"}`,padding:"12px 24px",cursor:"pointer"}}>
              {saving?"Saving...":paused?"Unpause Gate":"Pause Gate"}
            </button>
          </div>
          <div style={{border:"1px solid rgba(232,238,246,0.1)",padding:"32px"}}>
            <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"16px"}}>Min Clearance Tier</div>
            <div style={{fontSize:"24px",fontWeight:700,marginBottom:"8px"}}>Tier {minTier}</div>
            <div style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.35)",lineHeight:1.7,marginBottom:"24px"}}>Wallets below this tier are rejected with TierInsufficient.</div>
            <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
              <select value={pendingTier} onChange={e=>setPendingTier(parseInt(e.target.value))} style={{...m,fontSize:"11px",background:"rgba(232,238,246,0.04)",border:"1px solid rgba(232,238,246,0.12)",color:"#E8EEF6",padding:"10px 16px",outline:"none"}}>
                <option value={1}>Tier 1</option><option value={2}>Tier 2</option><option value={3}>Tier 3</option>
              </select>
              <button onClick={saveTier} disabled={saving||pendingTier===minTier} style={{...m,fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",background:"#1B4FD8",color:"#E8EEF6",border:"none",padding:"10px 20px",cursor:"pointer",opacity:saving||pendingTier===minTier?0.5:1}}>
                {saving?"Saving...":"Save"}
              </button>
            </div>
          </div>
        </div>
        <div style={{border:"1px solid rgba(232,238,246,0.1)",padding:"32px"}}>
          <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"20px"}}>Recent Activity</div>
          {entries.map((e,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 120px",gap:"20px",padding:"10px 0",borderBottom:"1px solid rgba(232,238,246,0.06)",...m,fontSize:"10px",borderLeft:`2px solid ${e.outcome==="approved"?"#1B4FD8":"#C44444"}`,paddingLeft:"12px"}}>
              <span style={{color:e.outcome==="approved"?"#1B4FD8":"#C44444",fontWeight:700}}>{e.outcome==="approved"?"? PASS":"? DENY"}</span>
              <span style={{color:"rgba(232,238,246,0.5)"}}>{e.wallet}</span>
              <span style={{color:"rgba(232,238,246,0.4)"}}>{REASON_CODES[e.reasonCode]}</span>
              <span style={{color:"rgba(232,238,246,0.3)"}}>{new Date(e.timestamp*1000).toISOString().slice(11,19)} UTC</span>
            </div>
          ))}
          <a href="/audit" style={{...m,fontSize:"10px",color:"#1B4FD8",letterSpacing:"0.1em",textTransform:"uppercase",display:"inline-block",marginTop:"16px"}}>Full audit log ?</a>
        </div>
      </section>
    </main>
  );
}
