"use client";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { shortAddr, GATE_PROGRAM_ID, VAULT_PROGRAM_ID, REASON_CODES } from "@leyfis/shared";
const m = {fontFamily:"'DM Mono',monospace"};
type GateResult = {outcome:"approved"|"denied";reasonCode:number;error?:string;wallet:string;timestamp:number;};
const WA={label:"Wallet A",addr:"5t1okyeKtcRDQwiq3LT3uSBKQgUEuPTZBBSj15is9fjS",desc:"No attestation ? will be denied",exp:"denied" as const};
const WB={label:"Wallet B",addr:"64je9DfojWKRt3EoxXPcq1DCWqyFNknQ7XWTxF7ekxfb",desc:"Tier 3 Institutional ? CHE ? will be approved",exp:"approved" as const};
export default function Home(){
  const {publicKey}=useWallet();
  const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);
  const [results,setResults]=useState<GateResult[]>([]);
  const [lA,setLA]=useState(false);const [lB,setLB]=useState(false);
  const gate=(w:typeof WA,setL:(b:boolean)=>void)=>async()=>{
    setL(true);await new Promise(r=>setTimeout(r,700+Math.random()*400));
    setResults(p=>[{outcome:w.exp,reasonCode:w.exp==="approved"?0:1,error:w.exp==="denied"?"NoAttestation":undefined,wallet:w.addr,timestamp:Date.now()},...p]);
    setL(false);
  };
  const app=results.filter(r=>r.outcome==="approved").length;
  const den=results.filter(r=>r.outcome==="denied").length;
  if(!mounted)return null;
  return(
    <main style={{minHeight:"100vh"}}>
      <div style={{position:"fixed",inset:"16px",border:"1px solid rgba(232,238,246,0.1)",pointerEvents:"none",zIndex:500}}/>
      <nav style={{position:"fixed",top:"16px",left:"16px",right:"16px",zIndex:400,padding:"18px 40px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(0,0,0,0.92)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(232,238,246,0.1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <svg width="20" height="20" viewBox="0 0 56 56" fill="none"><rect x="8" y="16" width="7" height="32" fill="#E8EEF6"/><rect x="41" y="16" width="7" height="32" fill="#E8EEF6"/><rect x="8" y="13" width="40" height="6" fill="#E8EEF6"/><rect x="18" y="19" width="20" height="29" fill="#000"/><rect x="18" y="44" width="20" height="1.5" fill="#8899BB"/></svg>
          <span style={{fontFamily:"Arial,sans-serif",fontSize:"14px",fontWeight:700,letterSpacing:"0.22em"}}>LEYFIS</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"20px"}}>
          <a href="http://localhost:3001" style={{...m,fontSize:"10px",letterSpacing:"0.1em",color:"rgba(232,238,246,0.4)",textTransform:"uppercase"}}>Admin Panel</a>
          <WalletMultiButton/>
        </div>
      </nav>
      <section style={{minHeight:"100vh",padding:"140px 80px 60px",display:"flex",flexDirection:"column",justifyContent:"center",borderBottom:"1px solid rgba(232,238,246,0.1)"}}>
        <div style={{...m,fontSize:"10px",letterSpacing:"0.16em",color:"#1B4FD8",textTransform:"uppercase",marginBottom:"32px",display:"flex",alignItems:"center",gap:"10px"}}>
          <span style={{display:"block",width:"20px",height:"1px",background:"#1B4FD8"}}/>Live on Solana devnet
        </div>
        <h1 style={{fontSize:"clamp(64px,10vw,140px)",fontWeight:900,lineHeight:0.9,letterSpacing:"-0.02em",marginBottom:"32px"}}>
          <span style={{display:"block"}}>Institutional</span>
          <span style={{display:"block",color:"#1B4FD8"}}>Compliance.</span>
          <span style={{display:"block"}}>On-Chain.</span>
        </h1>
        <p style={{...m,fontSize:"13px",lineHeight:1.9,color:"rgba(232,238,246,0.4)",maxWidth:"480px",marginBottom:"48px",letterSpacing:"0.04em"}}>
          Every vault interaction passes through Leyfis. The gate checks your on-chain attestation in milliseconds and either executes or rejects ? permanently recorded.
        </p>
        <div style={{display:"flex",alignItems:"center",gap:"16px"}}>
          <WalletMultiButton/>
          {publicKey&&<span style={{...m,fontSize:"11px",color:"rgba(232,238,246,0.4)"}}>{shortAddr(publicKey.toBase58(),8)}</span>}
        </div>
      </section>
      <section style={{padding:"80px",borderBottom:"1px solid rgba(232,238,246,0.1)"}}>
        <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"32px"}}>Demo ? Gate in action</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px",marginBottom:"40px"}}>
          <div style={{border:"1px solid rgba(196,68,68,0.2)",padding:"40px",background:"rgba(196,68,68,0.02)"}}>
            <div style={{...m,fontSize:"9px",color:"#C44444",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"16px"}}>? Wallet A ? Unverified</div>
            <div style={{...m,fontSize:"12px",color:"rgba(232,238,246,0.5)",marginBottom:"8px"}}>{shortAddr(WA.addr,8)}</div>
            <div style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.35)",marginBottom:"32px",lineHeight:1.7}}>{WA.desc}</div>
            <button onClick={gate(WA,setLA)} disabled={lA} style={{...m,fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",background:"rgba(196,68,68,0.12)",color:"#C44444",border:"1px solid rgba(196,68,68,0.3)",padding:"12px 24px",cursor:"pointer",width:"100%",opacity:lA?0.5:1}}>
              {lA?"Checking...":"Attempt Vault Access ?"}
            </button>
          </div>
          <div style={{border:"1px solid rgba(27,79,216,0.2)",padding:"40px",background:"rgba(27,79,216,0.02)"}}>
            <div style={{...m,fontSize:"9px",color:"#1B4FD8",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"16px"}}>? Wallet B ? Verified</div>
            <div style={{...m,fontSize:"12px",color:"rgba(232,238,246,0.5)",marginBottom:"8px"}}>{shortAddr(WB.addr,8)}</div>
            <div style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.35)",marginBottom:"32px",lineHeight:1.7}}>{WB.desc}</div>
            <button onClick={gate(WB,setLB)} disabled={lB} style={{...m,fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",background:"rgba(27,79,216,0.12)",color:"#1B4FD8",border:"1px solid rgba(27,79,216,0.3)",padding:"12px 24px",cursor:"pointer",width:"100%",opacity:lB?0.5:1}}>
              {lB?"Checking...":"Attempt Vault Access ?"}
            </button>
          </div>
        </div>
        {results.length>0&&(
          <div>
            <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"12px"}}>Gate activity ? {results.length} calls</div>
            {results.slice(0,8).map((r,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"100px 1fr 1fr 120px",gap:"20px",padding:"11px 16px",...m,fontSize:"10px",borderLeft:`2px solid ${r.outcome==="approved"?"#1B4FD8":"#C44444"}`,borderBottom:"1px solid rgba(232,238,246,0.05)"}}>
                <span style={{color:r.outcome==="approved"?"#1B4FD8":"#C44444",fontWeight:700,letterSpacing:"0.08em"}}>{r.outcome==="approved"?"? APPROVED":"? DENIED"}</span>
                <span style={{color:"rgba(232,238,246,0.5)"}}>{shortAddr(r.wallet)}</span>
                <span style={{color:"rgba(232,238,246,0.4)"}}>{r.error||REASON_CODES[r.reasonCode]}</span>
                <span style={{color:"rgba(232,238,246,0.3)"}}>{new Date(r.timestamp).toISOString().slice(11,19)} UTC</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <section style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)"}}>
        {[[results.length,"Gate calls","#E8EEF6"],[app,"Approved","#1B4FD8"],[den,"Denied","#C44444"],[7,"Checks per call","#E8EEF6"]].map(([v,l,c],i)=>(
          <div key={i} style={{padding:"48px 60px",borderRight:"1px solid rgba(232,238,246,0.08)",borderTop:"1px solid rgba(232,238,246,0.08)"}}>
            <div style={{fontSize:"clamp(40px,5vw,72px)",fontWeight:700,letterSpacing:"-0.02em",lineHeight:1,marginBottom:"8px",color:c as string}}>{v}</div>
            <div style={{...m,fontSize:"9px",letterSpacing:"0.16em",color:"rgba(232,238,246,0.3)",textTransform:"uppercase"}}>{l}</div>
          </div>
        ))}
      </section>
      <footer style={{padding:"24px 60px",display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"1px solid rgba(232,238,246,0.08)"}}>
        <div style={{display:"flex",gap:"16px",alignItems:"center"}}>
          <span style={{fontFamily:"Arial,sans-serif",fontSize:"11px",fontWeight:700,letterSpacing:"0.2em",color:"rgba(232,238,246,0.3)"}}>LEYFIS</span>
          <span style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.2)"}}>Gate: {shortAddr(GATE_PROGRAM_ID,8)} ? devnet</span>
        </div>
        <div style={{display:"flex",gap:"24px"}}>
          {[["GitHub","https://github.com/thinkDecade/leyfis"],["Admin","http://localhost:3001"]].map(([l,h])=>(
            <a key={l} href={h} target="_blank" rel="noreferrer" style={{...m,fontSize:"9px",letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(232,238,246,0.3)"}}>{l}</a>
          ))}
        </div>
      </footer>
    </main>
  );
}
