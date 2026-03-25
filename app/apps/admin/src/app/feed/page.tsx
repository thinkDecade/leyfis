"use client";
import { useState, useEffect, useRef } from "react";
import { AdminShell } from "@/components/AdminShell";
import { shortAddr, GATE_PROGRAM_ID, REASON_CODES } from "@leyfis/shared";
import { MOCK_AUDIT, AuditEntry } from "../../hooks/useLeyfis";
import { CheckCircle, XCircle, Wifi, WifiOff } from "lucide-react";

const m = {fontFamily:"'DM Mono',monospace"};
const f = {fontFamily:"'Inter',sans-serif"};

export default function FeedPage() {
  const [mounted,setMounted]=useState(false); useEffect(()=>setMounted(true),[]);
  const [entries,setEntries]=useState<AuditEntry[]>([...MOCK_AUDIT].reverse());
  const [live,setLive]=useState(true); const [total,setTotal]=useState(MOCK_AUDIT.length);
  const ref=useRef<any>(null);
  useEffect(()=>{
    if(!live){clearInterval(ref.current);return;}
    ref.current=setInterval(()=>{
      const ok=Math.random()>0.5;
      setEntries(p=>[{wallet:ok?"64je9Dfo...kxfb":"5t1okyeK...s9fjS",vault:shortAddr(GATE_PROGRAM_ID),timestamp:Math.floor(Date.now()/1000),slot:450558000+Math.floor(Math.random()*9999),outcome:ok?"approved":"denied",reasonCode:ok?0:[1,2,3,5][Math.floor(Math.random()*4)],attestationId:ok?"Ax7mPq...3kLw":"111...111",tier:ok?3:0},...p].slice(0,50));
      setTotal(n=>n+1);
    },3200);
    return()=>clearInterval(ref.current);
  },[live]);
  const app=entries.filter(e=>e.outcome==="approved").length;
  const den=entries.filter(e=>e.outcome==="denied").length;
  if(!mounted) return null;
  return (
    <AdminShell current="/feed">
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"28px"}}>
        <div>
          <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"10px"}}>/06 ? Live Feed</div>
          <h1 style={{...f,fontSize:"26px",fontWeight:700,letterSpacing:"-0.02em",marginBottom:"4px",color:"var(--text-1)"}}>Live Gate Activity</h1>
          <p style={{...m,fontSize:"11px",color:"var(--text-3)"}}>Real-time stream of gate events. Updates every 3.2 seconds.</p>
        </div>
        <button onClick={()=>setLive(l=>!l)} style={{display:"flex",alignItems:"center",gap:"8px",...m,fontSize:"10px",letterSpacing:"0.08em",textTransform:"uppercase",background:live?"var(--accent-bg)":"var(--bg-1)",color:live?"var(--accent)":"var(--text-3)",border:`1px solid ${live?"var(--accent-border)":"var(--border)"}`,padding:"9px 16px",cursor:"pointer",fontWeight:600}}>
          {live?<Wifi size={13}/>:<WifiOff size={13}/>}
          {live?"Live":"Paused"}
        </button>
      </div>

      <div style={{display:"flex",gap:"2px",marginBottom:"20px"}}>
        {[[total,"Seen","var(--text-1)"],[app,"Approved","var(--accent)"],[den,"Denied","var(--danger)"],[entries.length>0?Math.round(app/entries.length*100)+"%":"?","Rate","var(--text-1)"]].map(([v,l,c],i)=>(
          <div key={i} style={{border:"1px solid var(--border)",padding:"16px 24px",background:"var(--bg-1)",flex:1}}>
            <div style={{...f,fontSize:"24px",fontWeight:800,color:c as string,lineHeight:1,marginBottom:"4px"}}>{v}</div>
            <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase"}}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{border:"1px solid var(--border)",background:"var(--bg-1)"}}>
        <div style={{display:"grid",gridTemplateColumns:"20px 90px 1fr 1fr 110px 40px",gap:"12px",padding:"10px 16px",...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase",borderBottom:"1px solid var(--border)"}}>
          <span></span><span>Outcome</span><span>Wallet</span><span>Reason</span><span>Time</span><span>Tier</span>
        </div>
        {entries.map((e,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"20px 90px 1fr 1fr 110px 40px",gap:"12px",padding:"11px 16px",borderBottom:i<entries.length-1?"1px solid var(--border)":"none",alignItems:"center",borderLeft:`2px solid ${e.outcome==="approved"?"var(--accent)":"var(--danger)"}`,background:i===0?"var(--accent-bg)":"transparent",transition:"background 0.3s"}}>
            {e.outcome==="approved"?<CheckCircle size={11} color="var(--accent)"/>:<XCircle size={11} color="var(--danger)"/>}
            <span style={{...m,fontSize:"9px",color:e.outcome==="approved"?"var(--accent)":"var(--danger)",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase"}}>{e.outcome==="approved"?"PASS":"DENY"}</span>
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
