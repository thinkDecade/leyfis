"use client";
import { useState, useEffect } from "react";
import { AdminShell } from "@/components/AdminShell";
import { REASON_CODES } from "@leyfis/shared";
import { MOCK_AUDIT, AuditEntry } from "../../hooks/useLeyfis";
import { PauseCircle, PlayCircle, AlertTriangle, TrendingUp, CheckCircle, XCircle, Settings2 } from "lucide-react";

const m = {fontFamily:"'DM Mono',monospace"};
const f = {fontFamily:"'Inter',sans-serif"};

function ConfirmDialog({msg,onConfirm,onCancel,danger}:{msg:string;onConfirm:()=>void;onCancel:()=>void;danger?:boolean}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(4px)"}}>
      <div style={{background:"var(--bg-1)",border:`1px solid ${danger?"var(--danger-border)":"var(--border-2)"}`,padding:"32px",maxWidth:"420px",width:"100%"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"16px"}}>
          <AlertTriangle size={18} color={danger?"var(--danger)":"var(--text-3)"}/>
          <span style={{...f,fontSize:"14px",fontWeight:600,color:"var(--text-1)"}}>Confirm Action</span>
        </div>
        <p style={{...m,fontSize:"12px",color:"var(--text-2)",lineHeight:1.7,marginBottom:"24px"}}>{msg}</p>
        <div style={{display:"flex",gap:"10px"}}>
          <button onClick={onConfirm} style={{...m,fontSize:"11px",letterSpacing:"0.08em",textTransform:"uppercase",background:danger?"var(--danger)":"var(--accent)",color:"white",border:"none",padding:"10px 20px",cursor:"pointer",fontWeight:600,flex:1}}>Confirm</button>
          <button onClick={onCancel} style={{...m,fontSize:"11px",letterSpacing:"0.08em",textTransform:"uppercase",background:"transparent",color:"var(--text-3)",border:"1px solid var(--border)",padding:"10px 20px",cursor:"pointer",flex:1}}>Cancel</button>
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
      {confirm && <ConfirmDialog danger={!paused} msg={paused?"Unpause the gate? Vault interactions will resume normally.":"Pause the gate? This will block ALL vault interactions immediately, regardless of attestation status."} onConfirm={doPause} onCancel={()=>setConfirm(false)}/>}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"28px"}}>
        <div>
          <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"10px"}}>/02 ? Vault Operator</div>
          <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"4px"}}>
            <h1 style={{...f,fontSize:"26px",fontWeight:700,letterSpacing:"-0.02em",color:"var(--text-1)"}}>Vault Dashboard</h1>
            <span style={{...m,fontSize:"9px",padding:"4px 10px",background:paused?"var(--danger-bg)":"rgba(22,163,74,0.08)",color:paused?"var(--danger)":"var(--success)",border:`1px solid ${paused?"var(--danger-border)":"rgba(22,163,74,0.2)"}`,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:600}}>
              {paused?"Paused":"Active"}
            </span>
          </div>
          <p style={{...m,fontSize:"10px",color:"var(--text-4)"}}>Demo data shown ? connect to devnet for live stats</p>
        </div>
        <button onClick={()=>setConfirm(true)} disabled={saving} style={{display:"flex",alignItems:"center",gap:"8px",...m,fontSize:"11px",letterSpacing:"0.08em",textTransform:"uppercase",background:paused?"var(--accent)":"var(--danger-bg)",color:paused?"white":"var(--danger)",border:`1px solid ${paused?"var(--accent)":"var(--danger-border)"}`,padding:"10px 18px",cursor:"pointer",fontWeight:600,opacity:saving?0.5:1}}>
          {paused?<PlayCircle size={14}/>:<PauseCircle size={14}/>}
          {saving?"Processing...":(paused?"Unpause Gate":"Pause Gate")}
        </button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"2px",marginBottom:"24px"}}>
        {[[entries.length,"Total Gate Calls","var(--text-1)",TrendingUp],[approved,"Approved","var(--accent)",CheckCircle],[denied,"Denied","var(--danger)",XCircle],[entries.length>0?Math.round(approved/entries.length*100)+"%":"?","Approval Rate","var(--text-1)",TrendingUp]].map(([v,l,c,Icon],i)=>(
          <div key={i} style={{border:"1px solid var(--border)",padding:"20px 24px",background:"var(--bg-1)",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:"14px",right:"14px",opacity:0.08}}><Icon size={28} color={c as string}/></div>
            <div style={{...m,fontSize:"9px",color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"8px"}}>{l}</div>
            <div style={{...f,fontSize:"28px",fontWeight:800,letterSpacing:"-0.02em",lineHeight:1,color:c as string}}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px",marginBottom:"24px"}}>
        <div style={{border:"1px solid var(--border)",padding:"24px",background:"var(--bg-1)"}}>
          <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"14px"}}>Gate Status</div>
          <div style={{...f,fontSize:"18px",fontWeight:700,marginBottom:"8px",color:paused?"var(--danger)":"var(--text-1)"}}>{paused?"Gate Paused":"Gate Active"}</div>
          <p style={{...m,fontSize:"11px",color:"var(--text-3)",lineHeight:1.7,marginBottom:"0"}}>{paused?"All vault interactions blocked. No wallet can pass the gate regardless of attestation.":"Gate running normally. All 7 compliance checks active on every interaction."}</p>
        </div>
        <div style={{border:"1px solid var(--border)",padding:"24px",background:"var(--bg-1)"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
            <Settings2 size={13} color="var(--text-4)"/>
            <span style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Min Clearance Tier</span>
          </div>
          <div style={{...f,fontSize:"18px",fontWeight:700,marginBottom:"8px",color:"var(--text-1)"}}>Tier {minTier}</div>
          <p style={{...m,fontSize:"11px",color:"var(--text-3)",lineHeight:1.7,marginBottom:"16px"}}>Wallets below this tier rejected with TierInsufficient.</p>
          <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
            <select value={pendingTier} onChange={e=>setPendingTier(parseInt(e.target.value))} style={{...m,fontSize:"11px",background:"var(--bg-2)",border:"1px solid var(--border)",color:"var(--text-1)",padding:"8px 12px",outline:"none",flex:1,cursor:"pointer"}}>
              <option value={1}>Tier 1 ? Basic</option><option value={2}>Tier 2 ? Enhanced</option><option value={3}>Tier 3 ? Institutional</option>
            </select>
            <button onClick={saveTier} disabled={saving||pendingTier===minTier} style={{...m,fontSize:"10px",letterSpacing:"0.08em",textTransform:"uppercase",background:"var(--accent)",color:"white",border:"none",padding:"9px 16px",cursor:"pointer",opacity:saving||pendingTier===minTier?0.4:1,fontWeight:600}}>
              {saving?"Saving...":"Save"}
            </button>
          </div>
        </div>
      </div>

      <div style={{border:"1px solid var(--border)",background:"var(--bg-1)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid var(--border)"}}>
          <span style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Recent Activity</span>
          <a href="/feed" style={{...m,fontSize:"9px",color:"var(--accent)",letterSpacing:"0.08em",textTransform:"uppercase"}}>Live Feed ?</a>
        </div>
        {entries.map((e,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 110px",gap:"16px",padding:"12px 20px",borderBottom:i<entries.length-1?"1px solid var(--border)":"none",...m,fontSize:"11px",alignItems:"center",borderLeft:`2px solid ${e.outcome==="approved"?"var(--accent)":"var(--danger)"}`}}>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
              {e.outcome==="approved"?<CheckCircle size={12} color="var(--accent)"/>:<XCircle size={12} color="var(--danger)"/>}
              <span style={{color:e.outcome==="approved"?"var(--accent)":"var(--danger)",fontWeight:700,letterSpacing:"0.04em",fontSize:"9px",textTransform:"uppercase"}}>{e.outcome==="approved"?"PASS":"DENY"}</span>
            </div>
            <span style={{color:"var(--text-2)"}}>{e.wallet}</span>
            <span style={{color:"var(--text-3)"}}>{REASON_CODES[e.reasonCode]}</span>
            <span style={{color:"var(--text-4)"}}>{new Date(e.timestamp*1000).toISOString().slice(11,19)} UTC</span>
          </div>
        ))}
        <div style={{padding:"12px 20px",borderTop:"1px solid var(--border)"}}>
          <a href="/audit" style={{...m,fontSize:"9px",color:"var(--text-3)",letterSpacing:"0.08em",textTransform:"uppercase"}}>Full Audit Log ?</a>
        </div>
      </div>
    </AdminShell>
  );
}
