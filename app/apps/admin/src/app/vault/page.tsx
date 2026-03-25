"use client";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AdminShell } from "@/components/AdminShell";
import { REASON_CODES } from "@leyfis/shared";
import { MOCK_AUDIT, AuditEntry } from "../../hooks/useLeyfis";
const m = {fontFamily:"'DM Mono',monospace"};

function ConfirmDialog({msg,onConfirm,onCancel}:{msg:string;onConfirm:()=>void;onCancel:()=>void}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
      <div style={{background:"#0A0A0A",border:"1px solid rgba(232,238,246,0.15)",padding:"32px",maxWidth:"400px",width:"100%"}}>
        <div style={{...m,fontSize:"9px",color:"#C44444",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"16px"}}>Confirm Action</div>
        <p style={{...m,fontSize:"12px",color:"rgba(232,238,246,0.7)",lineHeight:1.7,marginBottom:"24px"}}>{msg}</p>
        <div style={{display:"flex",gap:"12px"}}>
          <button onClick={onConfirm} style={{...m,fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",background:"#C44444",color:"#E8EEF6",border:"none",padding:"10px 20px",cursor:"pointer",flex:1}}>Confirm</button>
          <button onClick={onCancel} style={{...m,fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",background:"transparent",color:"rgba(232,238,246,0.5)",border:"1px solid rgba(232,238,246,0.15)",padding:"10px 20px",cursor:"pointer",flex:1}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function VaultPage() {
  const [mounted,setMounted]=useState(false); useEffect(()=>setMounted(true),[]);
  const [paused,setPaused]=useState(false); const [minTier,setMinTier]=useState(3);
  const [pendingTier,setPendingTier]=useState(3); const [saving,setSaving]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const entries: AuditEntry[] = MOCK_AUDIT;
  const approved=entries.filter(e=>e.outcome==="approved").length;
  const denied=entries.filter(e=>e.outcome==="denied").length;

  const doPause=async()=>{ setSaving(true); setConfirm(false); await new Promise(r=>setTimeout(r,800)); setPaused(p=>!p); setSaving(false); };
  const saveTier=async()=>{ setSaving(true); await new Promise(r=>setTimeout(r,800)); setMinTier(pendingTier); setSaving(false); };
  if(!mounted) return null;
  return (
    <AdminShell current="/vault">
      {confirm && <ConfirmDialog msg={paused?"Unpause the gate? Vault interactions will resume normally.":"Pause the gate? This will block ALL vault interactions immediately, regardless of attestation status."} onConfirm={doPause} onCancel={()=>setConfirm(false)}/>}
      <div style={{marginBottom:"32px"}}>
        <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"16px"}}>/02 ? Vault Operator</div>
        <div style={{display:"flex",alignItems:"center",gap:"16px",marginBottom:"4px"}}>
          <h1 style={{fontSize:"clamp(28px,3vw,40px)",fontWeight:700,letterSpacing:"-0.02em"}}>Vault Dashboard</h1>
          <div style={{...m,fontSize:"9px",padding:"4px 10px",background:paused?"rgba(196,68,68,0.15)":"rgba(27,79,216,0.1)",color:paused?"#C44444":"#1B4FD8",border:`1px solid ${paused?"rgba(196,68,68,0.3)":"rgba(27,79,216,0.25)"}`,letterSpacing:"0.1em",textTransform:"uppercase"}}>
            {paused?"PAUSED":"ACTIVE"}
          </div>
        </div>
        <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.25)",letterSpacing:"0.08em"}}>Demo data shown ? connect to devnet for live stats</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",marginBottom:"32px",border:"1px solid rgba(232,238,246,0.08)"}}>
        {[[entries.length,"Total","#E8EEF6"],[approved,"Approved","#1B4FD8"],[denied,"Denied","#C44444"],[entries.length>0?Math.round(approved/entries.length*100)+"%":"?","Rate","#E8EEF6"]].map(([v,l,c],i)=>(
          <div key={i} style={{padding:"28px 32px",borderRight:i<3?"1px solid rgba(232,238,246,0.08)":"none"}}>
            <div style={{fontSize:"clamp(28px,3vw,48px)",fontWeight:700,letterSpacing:"-0.02em",color:c as string,lineHeight:1,marginBottom:"6px"}}>{v}</div>
            <div style={{...m,fontSize:"9px",letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(232,238,246,0.3)"}}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px",marginBottom:"32px"}}>
        <div style={{border:"1px solid rgba(232,238,246,0.08)",padding:"28px"}}>
          <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"16px"}}>Gate Status</div>
          <div style={{fontSize:"22px",fontWeight:700,marginBottom:"8px",color:paused?"#C44444":"#E8EEF6"}}>{paused?"Paused":"Active"}</div>
          <div style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.35)",lineHeight:1.7,marginBottom:"20px"}}>{paused?"All vault interactions are blocked. No wallet can access the vault regardless of attestation status.":"Gate is running. All vault interactions pass through the 7-check compliance sequence."}</div>
          <button onClick={()=>setConfirm(true)} disabled={saving} style={{...m,fontSize:"10px",letterSpacing:"0.1em",textTransform:"uppercase",background:paused?"#1B4FD8":"transparent",color:paused?"#E8EEF6":"#C44444",border:`1px solid ${paused?"#1B4FD8":"rgba(196,68,68,0.4)"}`,padding:"10px 20px",cursor:"pointer",opacity:saving?0.5:1}}>
            {saving?"Processing...":(paused?"Unpause Gate":"Pause Gate")}
          </button>
        </div>
        <div style={{border:"1px solid rgba(232,238,246,0.08)",padding:"28px"}}>
          <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"16px"}}>Min Clearance Tier</div>
          <div style={{fontSize:"22px",fontWeight:700,marginBottom:"8px"}}>Tier {minTier}</div>
          <div style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.35)",lineHeight:1.7,marginBottom:"20px"}}>Wallets with attestations below this tier are rejected with TierInsufficient.</div>
          <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
            <select value={pendingTier} onChange={e=>setPendingTier(parseInt(e.target.value))} style={{...m,fontSize:"11px",background:"rgba(232,238,246,0.04)",border:"1px solid rgba(232,238,246,0.12)",color:"#E8EEF6",padding:"8px 14px",outline:"none",flex:1}}>
              <option value={1}>Tier 1 ? Basic</option><option value={2}>Tier 2 ? Enhanced</option><option value={3}>Tier 3 ? Institutional</option>
            </select>
            <button onClick={saveTier} disabled={saving||pendingTier===minTier} style={{...m,fontSize:"10px",letterSpacing:"0.1em",textTransform:"uppercase",background:"#1B4FD8",color:"#E8EEF6",border:"none",padding:"9px 18px",cursor:"pointer",opacity:saving||pendingTier===minTier?0.4:1}}>
              {saving?"Saving...":"Save"}
            </button>
          </div>
        </div>
      </div>

      <div style={{border:"1px solid rgba(232,238,246,0.08)",padding:"28px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"20px"}}>
          <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.12em",textTransform:"uppercase"}}>Recent Activity</div>
          <a href="/feed" style={{...m,fontSize:"9px",color:"#1B4FD8",letterSpacing:"0.1em",textTransform:"uppercase",textDecoration:"none"}}>Live Feed ?</a>
        </div>
        {entries.map((e,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"72px 1fr 1fr 110px",gap:"16px",padding:"10px 0",borderBottom:"1px solid rgba(232,238,246,0.04)",...m,fontSize:"10px",borderLeft:`2px solid ${e.outcome==="approved"?"#1B4FD8":"#C44444"}`,paddingLeft:"12px"}}>
            <span style={{color:e.outcome==="approved"?"#1B4FD8":"#C44444",fontWeight:700,letterSpacing:"0.06em"}}>{e.outcome==="approved"?"PASS":"DENY"}</span>
            <span style={{color:"rgba(232,238,246,0.5)"}}>{e.wallet}</span>
            <span style={{color:"rgba(232,238,246,0.4)"}}>{REASON_CODES[e.reasonCode]}</span>
            <span style={{color:"rgba(232,238,246,0.3)"}}>{new Date(e.timestamp*1000).toISOString().slice(11,19)} UTC</span>
          </div>
        ))}
        <a href="/audit" style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.4)",letterSpacing:"0.1em",textTransform:"uppercase",display:"inline-block",marginTop:"16px",textDecoration:"none"}}>Full audit log ?</a>
      </div>
    </AdminShell>
  );
}
