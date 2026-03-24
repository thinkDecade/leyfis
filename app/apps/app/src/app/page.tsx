"use client";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { shortAddr, GATE_PROGRAM_ID, REASON_CODES, txUrl } from "@leyfis/shared";

type GateResult = {
  outcome: "approved" | "denied";
  reasonCode: number;
  signature?: string;
  error?: string;
  wallet: string;
  timestamp: number;
};

export default function Home() {
  const { publicKey } = useWallet();
  const [results, setResults] = useState<GateResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const callGate = async () => {
    if (!publicKey) return;
    setLoading(true);
    // TODO: wire to gate program in Phase 4
    setTimeout(() => {
      setResults(prev => [{
        outcome: "denied", reasonCode: 1,
        error: "NoAttestation ? wallet not verified",
        wallet: publicKey.toBase58(), timestamp: Date.now(),
      }, ...prev]);
      setLoading(false);
    }, 800);
  };

  return (
    <main style={{minHeight:"100vh",padding:"0 60px"}}>
      <div style={{position:"fixed",inset:"16px",border:"1px solid rgba(232,238,246,0.1)",pointerEvents:"none",zIndex:500}}/>
      <nav style={{position:"fixed",top:"16px",left:"16px",right:"16px",zIndex:400,padding:"18px 40px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(232,238,246,0.1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <svg width="20" height="20" viewBox="0 0 56 56" fill="none">
            <rect x="8" y="16" width="7" height="32" fill="#E8EEF6"/>
            <rect x="41" y="16" width="7" height="32" fill="#E8EEF6"/>
            <rect x="8" y="13" width="40" height="6" fill="#E8EEF6"/>
            <rect x="18" y="19" width="20" height="29" fill="#000"/>
            <rect x="18" y="44" width="20" height="1.5" fill="#8899BB"/>
          </svg>
          <span style={{fontFamily:"Arial,sans-serif",fontSize:"14px",fontWeight:700,letterSpacing:"0.22em"}}>LEYFIS</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"20px"}}>
          <a href="https://admin.leyfis.io" style={{fontFamily:"var(--mono)",fontSize:"10px",letterSpacing:"0.1em",color:"rgba(232,238,246,0.4)",textTransform:"uppercase"}}>Admin Panel</a>
          <WalletMultiButton />
        </div>
      </nav>

      <section style={{minHeight:"100vh",paddingTop:"140px",paddingBottom:"80px",display:"flex",flexDirection:"column",justifyContent:"center",borderBottom:"1px solid rgba(232,238,246,0.1)"}}>
        <div style={{fontFamily:"var(--mono)",fontSize:"10px",letterSpacing:"0.16em",color:"#1B4FD8",textTransform:"uppercase",marginBottom:"32px",display:"flex",alignItems:"center",gap:"10px"}}>
          <span style={{display:"block",width:"20px",height:"1px",background:"#1B4FD8"}}/>
          Live on Solana devnet
        </div>
        <h1 style={{fontSize:"clamp(64px,10vw,140px)",fontWeight:900,lineHeight:0.9,letterSpacing:"-0.02em",marginBottom:"32px"}}>
          <span style={{display:"block"}}>Institutional</span>
          <span style={{display:"block",color:"#1B4FD8"}}>Compliance.</span>
          <span style={{display:"block"}}>On-Chain.</span>
        </h1>
        <p style={{fontFamily:"var(--mono)",fontSize:"13px",lineHeight:1.9,color:"rgba(232,238,246,0.4)",maxWidth:"480px",marginBottom:"48px",letterSpacing:"0.04em"}}>
          Connect your wallet and attempt vault access. Leyfis checks your on-chain attestation and either grants or denies entry. Every call is recorded permanently.
        </p>
        <div style={{display:"flex",alignItems:"center",gap:"16px",marginBottom:"32px"}}>
          <WalletMultiButton />
          {publicKey && (
            <button onClick={callGate} disabled={loading} style={{fontFamily:"var(--mono)",fontSize:"12px",letterSpacing:"0.1em",textTransform:"uppercase",background:"#1B4FD8",color:"#E8EEF6",border:"none",padding:"14px 28px",cursor:"pointer",opacity:loading?0.5:1}}>
              {loading ? "Checking..." : "Attempt Vault Access ?"}
            </button>
          )}
        </div>
        {publicKey && <div style={{fontFamily:"var(--mono)",fontSize:"11px",color:"rgba(232,238,246,0.4)"}}>{shortAddr(publicKey.toBase58(), 8)}</div>}
      </section>

      {results.length > 0 && (
        <section style={{padding:"60px 0",borderBottom:"1px solid rgba(232,238,246,0.1)"}}>
          <div style={{fontFamily:"var(--mono)",fontSize:"9px",letterSpacing:"0.16em",color:"rgba(232,238,246,0.3)",textTransform:"uppercase",marginBottom:"20px"}}>Gate activity ? {results.length} calls</div>
          {results.map((r,i) => (
            <div key={i} style={{display:"grid",gridTemplateColumns:"120px 1fr 1fr 120px",gap:"24px",padding:"14px 0",borderBottom:"1px solid rgba(232,238,246,0.06)",fontFamily:"var(--mono)",fontSize:"11px",borderLeft:`2px solid ${r.outcome==="approved"?"#1B4FD8":"#C44444"}`,paddingLeft:"16px",marginBottom:"2px"}}>
              <span style={{color:r.outcome==="approved"?"#1B4FD8":"#C44444",fontWeight:700,fontSize:"10px",letterSpacing:"0.1em"}}>{r.outcome==="approved"?"? APPROVED":"? DENIED"}</span>
              <span style={{color:"rgba(232,238,246,0.5)"}}>{shortAddr(r.wallet)}</span>
              <span style={{color:"rgba(232,238,246,0.4)"}}>{r.error || REASON_CODES[r.reasonCode]}</span>
              <span style={{color:"rgba(232,238,246,0.3)"}}>{new Date(r.timestamp).toISOString().slice(11,19)} UTC</span>
            </div>
          ))}
        </section>
      )}

      <section style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderTop:"1px solid rgba(232,238,246,0.1)"}}>
        {[
          [results.length, "Gate calls"],
          [results.filter(r=>r.outcome==="approved").length, "Approved"],
          [results.filter(r=>r.outcome==="denied").length, "Denied"],
          [7, "Checks per call"],
        ].map(([v,l],i) => (
          <div key={i} style={{padding:"48px 60px",borderRight:"1px solid rgba(232,238,246,0.1)"}}>
            <div style={{fontSize:"clamp(40px,5vw,72px)",fontWeight:700,letterSpacing:"-0.02em",lineHeight:1,marginBottom:"8px",color:i===1?"#1B4FD8":i===2?"#C44444":"inherit"}}>{v}</div>
            <div style={{fontFamily:"var(--mono)",fontSize:"9px",letterSpacing:"0.16em",color:"rgba(232,238,246,0.3)",textTransform:"uppercase"}}>{l}</div>
          </div>
        ))}
      </section>

      <footer style={{padding:"24px 0",display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"1px solid rgba(232,238,246,0.1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"16px",fontFamily:"var(--mono)",fontSize:"9px",color:"rgba(232,238,246,0.2)"}}>
          <span style={{fontFamily:"Arial,sans-serif",fontSize:"11px",fontWeight:700,letterSpacing:"0.2em",color:"rgba(232,238,246,0.3)"}}>LEYFIS</span>
          <span>Gate: {shortAddr(GATE_PROGRAM_ID, 8)} ? devnet</span>
        </div>
        <div style={{display:"flex",gap:"24px"}}>
          {[["GitHub","https://github.com/thinkDecade/leyfis"],["Admin","https://admin.leyfis.io"]].map(([l,h]) => (
            <a key={l} href={h} target="_blank" rel="noreferrer" style={{fontFamily:"var(--mono)",fontSize:"9px",letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(232,238,246,0.3)"}}>{l}</a>
          ))}
        </div>
      </footer>
    </main>
  );
}
