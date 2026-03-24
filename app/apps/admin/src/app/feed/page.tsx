"use client";
import { useState, useEffect, useRef } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { shortAddr, GATE_PROGRAM_ID, REASON_CODES } from "@leyfis/shared";
import { MOCK_AUDIT, AuditEntry } from "../../hooks/useLeyfis";
const m = {fontFamily:"'DM Mono',monospace"};
export default function FeedPage(){
  const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);
  const [entries,setEntries]=useState<AuditEntry[]>([...MOCK_AUDIT].reverse());
  const [live,setLive]=useState(true);const [total,setTotal]=useState(MOCK_AUDIT.length);
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
  if(!mounted)return null;
  return(
    <main style={{minHeight:"100vh"}}>
      <div style={{position:"fixed",inset:"16px",border:"1px solid rgba(232,238,246,0.1)",pointerEvents:"none",zIndex:500}}/>
      <nav style={{position:"fixed",top:"16px",left:"16px",right:"16px",zIndex:400,padding:"18px 40px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(0,0,0,0.92)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(232,238,246,0.1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"20px"}}>
          <a href="/" style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.4)",letterSpacing:"0.1em"}}>? Back</a>
          <span style={{fontFamily:"Arial,sans-serif",fontSize:"14px",fontWeight:700,letterSpacing:"0.22em"}}>LEYFIS</span>
          <span style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",border:"1px solid rgba(232,238,246,0.15)",padding:"3px 8px",textTransform:"uppercase"}}>/06 Feed</span>
        </div>
        <div style={{display:"flex",gap:"12px",alignItems:"center"}}>
          <button onClick={()=>setLive(l=>!l)} style={{...m,fontSize:"9px",letterSpacing:"0.12em",textTransform:"uppercase",background:live?"rgba(27,79,216,0.12)":"transparent",color:live?"#1B4FD8":"rgba(232,238,246,0.4)",border:`1px solid ${live?"rgba(27,79,216,0.3)":"rgba(232,238,246,0.15)"}`,padding:"6px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px"}}>
            <span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:live?"#1B4FD8":"rgba(232,238,246,0.3)"}}/>
            {live?"Live":"Paused"}
          </button>
          <WalletMultiButton/>
        </div>
      </nav>
      <section style={{padding:"120px 60px 60px"}}>
        <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"24px"}}>/06 ? Live Gate Feed</div>
        <h1 style={{fontSize:"clamp(32px,4vw,56px)",fontWeight:700,letterSpacing:"-0.02em",marginBottom:"40px"}}>Live Gate Activity</h1>
        <div style={{display:"flex",gap:"40px",padding:"16px 0",borderTop:"1px solid rgba(232,238,246,0.08)",borderBottom:"1px solid rgba(232,238,246,0.08)",marginBottom:"24px"}}>
          {[[total,"Seen"],[app,"Approved","#1B4FD8"],[den,"Denied","#C44444"],[entries.length>0?Math.round(app/entries.length*100)+"%":"?","Rate"]].map(([v,l,c],i)=>(
            <div key={i} style={{display:"flex",gap:"10px",alignItems:"baseline"}}><span style={{fontSize:"28px",fontWeight:700,color:(c as string)||"#E8EEF6"}}>{v}</span><span style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.1em",textTransform:"uppercase"}}>{l}</span></div>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"1px"}}>
          {entries.map((e,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"24px 90px 1fr 1fr 120px 50px",gap:"16px",padding:"11px 16px",borderBottom:"1px solid rgba(232,238,246,0.04)",...m,fontSize:"10px",borderLeft:`2px solid ${e.outcome==="approved"?"#1B4FD8":"#C44444"}`,background:i===0?"rgba(232,238,246,0.02)":"transparent"}}>
              <span style={{color:e.outcome==="approved"?"#1B4FD8":"#C44444",fontSize:"12px"}}>{e.outcome==="approved"?"?":"?"}</span>
              <span style={{color:e.outcome==="approved"?"#1B4FD8":"#C44444",fontWeight:700,letterSpacing:"0.06em",fontSize:"9px",textTransform:"uppercase"}}>{e.outcome}</span>
              <span style={{color:"rgba(232,238,246,0.6)"}}>{e.wallet}</span>
              <span style={{color:"rgba(232,238,246,0.4)"}}>{REASON_CODES[e.reasonCode]}</span>
              <span style={{color:"rgba(232,238,246,0.3)"}}>{new Date(e.timestamp*1000).toISOString().slice(11,19)} UTC</span>
              <span style={{color:"rgba(232,238,246,0.4)"}}>{e.tier>0?`T${e.tier}`:"?"}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
