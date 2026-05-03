"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ─── Scroll reveal ────────────────────────────────────────────
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect(); } },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    if (el.getBoundingClientRect().top < window.innerHeight) setV(true);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, v };
}

function Fade({ children, delay = 0, style }: {
  children: React.ReactNode; delay?: number; style?: React.CSSProperties;
}) {
  const { ref, v } = useInView();
  return (
    <div ref={ref} style={{
      opacity: v ? 1 : 0,
      transform: v ? "none" : "translateY(18px)",
      transition: `opacity 0.55s ${delay}ms, transform 0.55s ${delay}ms`,
      ...style,
    }}>{children}</div>
  );
}

// ─── Design tokens — Swiss institutional ──────────────────────
const D = {
  // Surfaces
  bg:       "#F7F8FA",   // off-white base
  bg1:      "#F0F2F7",   // subtle section tint
  bg2:      "#FFFFFF",   // card surface (pure white)
  bgDark:   "#0A0F1C",   // MCP terminal, dark elements

  // Ink (CLAUDE.md deep navy, not pitch-black)
  ink:      "#0A0F1C",
  ink70:    "rgba(10,15,28,0.70)",
  ink50:    "rgba(10,15,28,0.50)",
  ink30:    "rgba(10,15,28,0.30)",
  ink15:    "rgba(10,15,28,0.15)",
  ink08:    "rgba(10,15,28,0.08)",
  ink04:    "rgba(10,15,28,0.04)",

  // Brand blue — CLAUDE.md canonical #1B4FD8 (was purple #5B4CF5)
  indigo:   "#1B4FD8",
  indigoDk: "#163FAD",
  indigo20: "rgba(27,79,216,0.20)",
  indigo12: "rgba(27,79,216,0.12)",
  indigo06: "rgba(27,79,216,0.06)",

  // Status — CLAUDE.md Teal (unified to one value)
  teal:     "#0F6E56",
  tealBt:   "#0F6E56",
  teal20:   "rgba(15,110,86,0.20)",
  teal10:   "rgba(15,110,86,0.10)",

  // Status — CLAUDE.md Crimson (not pure red)
  red:      "#7A1F1F",
  red10:    "rgba(122,31,31,0.10)",

  amber:    "#B45309",
  amber10:  "rgba(180,83,9,0.10)",
  amber20:  "rgba(180,83,9,0.20)",

  rule:     "rgba(10,15,28,0.08)",
  shadow:   "0 1px 3px rgba(10,15,28,0.05),0 4px 16px rgba(10,15,28,0.04)",
  shadowMd: "0 2px 8px rgba(10,15,28,0.08),0 8px 24px rgba(10,15,28,0.06)",

  // Typography — Inter only (Unbounded removed)
  mono:    "'DM Mono',monospace",
  display: "'Inter',sans-serif",   // was Unbounded — now Inter 700
  sans:    "'Inter',sans-serif",

  ice:     "#E8EEF6",
  ice30:   "rgba(232,238,246,0.30)",
  ice10:   "rgba(232,238,246,0.10)",
};

// ─── Gate animation ───────────────────────────────────────────
function Gate({ approved, size = 200 }: { approved: boolean; size?: number }) {
  const w = size * 0.1, h = size, gap = size * 0.5, total = gap + w * 2;
  const c = approved ? D.tealBt : D.indigo;
  return (
    <div style={{ position:"relative", width:total, height:h, margin:"0 auto" }}>
      <style>{`
        @keyframes gPulse{0%,100%{opacity:.75}50%{opacity:1}}
        @keyframes gScan{0%{top:${w}px;opacity:.7}80%{opacity:.2}100%{top:${h-4}px;opacity:0}}
        @keyframes gPop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes gRing{from{transform:translate(-50%,-50%) scale(.5);opacity:.8}to{transform:translate(-50%,-50%) scale(2.2);opacity:0}}
      `}</style>
      <div style={{ position:"absolute",left:0,top:0,width:w,height:h,background:c,borderRadius:"2px",animation:"gPulse 2.5s infinite",transition:"background .7s" }}/>
      <div style={{ position:"absolute",right:0,top:0,width:w,height:h,background:c,borderRadius:"2px",animation:"gPulse 2.5s infinite .4s",transition:"background .7s" }}/>
      <div style={{ position:"absolute",left:0,top:0,width:total,height:w,background:c,borderRadius:"2px",animation:"gPulse 2.5s infinite .2s",transition:"background .7s" }}/>
      {!approved && <div style={{ position:"absolute",left:w+2,right:w+2,top:w,height:"2px",background:"rgba(91,76,245,.45)",animation:"gScan 1.8s ease-in infinite" }}/>}
      {approved && <>
        <div style={{ position:"absolute",left:"50%",top:"55%",width:size*.3,height:size*.3,borderRadius:"50%",border:`1.5px solid ${D.tealBt}`,animation:"gRing 1.5s ease-out infinite" }}/>
        <div style={{ position:"absolute",left:"50%",top:"55%",transform:"translate(-50%,-50%)",fontFamily:D.display,fontSize:size*.24,fontWeight:900,color:D.tealBt,animation:"gPop .35s ease",lineHeight:1 }}>✓</div>
      </>}
    </div>
  );
}

// ─── MCP terminal — cycling exchange demo ─────────────────────
const MCP_EX = [
  {
    cmd: "Pause the gate for the EU vault",
    res: "Gate paused. VaultConfig updated.\nVault: 88x1...NaJ  ·  Slot: 312,847,291\nAudit entry written.",
  },
  {
    cmd: "Who was denied access in the last hour?",
    res: "3 denials in the last 60 minutes:\n  2× NoAttestation  ·  1× TierInsufficient\nMost recent: 5t1o...fjS at 14:31:58",
  },
  {
    cmd: "Export FATF R.16 report for this week",
    res: "compliance_report_2026-W18.csv ready.\n47 entries  ·  41 approved  ·  6 denied\nFields: wallet, vault, timestamp, outcome, tier, jurisdiction",
  },
];

function McpTerminal() {
  const [idx, setIdx] = useState(0);
  const [vis, setVis] = useState(true);
  useEffect(() => {
    const t = setInterval(() => {
      setVis(false);
      setTimeout(() => { setIdx(i => (i + 1) % MCP_EX.length); setVis(true); }, 380);
    }, 4800);
    return () => clearInterval(t);
  }, []);
  const ex = MCP_EX[idx];
  return (
    <div style={{ background:D.bgDark, overflow:"hidden", border:"1px solid rgba(232,238,246,0.08)", boxShadow:"0 16px 56px rgba(0,0,0,0.22)" }}>
      <div style={{ padding:"13px 20px", borderBottom:"1px solid rgba(232,238,246,0.06)", display:"flex", alignItems:"center", gap:"7px" }}>
        {["#FF5F57","#FFBD2E","#28C840"].map(c => <div key={c} style={{ width:11, height:11, borderRadius:"50%", background:c }}/>)}
        <span style={{ fontFamily:D.mono, fontSize:"11px", color:"rgba(232,238,246,.28)", marginLeft:8, letterSpacing:".05em" }}>leyfis — claude mcp</span>
      </div>
      <div style={{ padding:"28px", minHeight:210, opacity:vis?1:0, transition:"opacity .32s" }}>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontFamily:D.mono, fontSize:"11px", color:"rgba(27,79,216,.6)", letterSpacing:".08em", marginBottom:8 }}>You</div>
          <div style={{ fontFamily:D.mono, fontSize:"13px", color:D.ice, lineHeight:1.65 }}>{ex.cmd}</div>
        </div>
        <div style={{ borderLeft:`2px solid ${D.indigo}`, paddingLeft:16 }}>
          <div style={{ fontFamily:D.mono, fontSize:"11px", color:"rgba(27,79,216,.9)", letterSpacing:".08em", marginBottom:8 }}>Leyfis</div>
          <div style={{ fontFamily:D.mono, fontSize:"12px", color:"rgba(232,238,246,.65)", lineHeight:1.85, whiteSpace:"pre-line" }}>{ex.res}</div>
        </div>
      </div>
      <div style={{ padding:"0 28px 20px", display:"flex", gap:6 }}>
        {MCP_EX.map((_, i) => (
          <div key={i} style={{ width:i===idx?18:6, height:6, borderRadius:3, background:i===idx?D.indigo:"rgba(232,238,246,.15)", transition:"all .3s" }}/>
        ))}
      </div>
    </div>
  );
}

// ─── Live audit feed ──────────────────────────────────────────
const FEED = [
  { t:"14:32:17", ok:true,  w:"64je...xfb", note:"Tier 3 · CHE" },
  { t:"14:32:11", ok:false, w:"5t1o...fjS",  note:"NoAttestation" },
  { t:"14:31:58", ok:true,  w:"64je...xfb", note:"Tier 3 · CHE" },
  { t:"14:31:44", ok:false, w:"8m2p...3kR",  note:"TierInsufficient" },
  { t:"14:31:12", ok:true,  w:"3q9n...7dL", note:"Tier 2 · DEU" },
  { t:"14:30:58", ok:false, w:"9f1m...2vX",  note:"AttestationRevoked" },
  { t:"14:30:33", ok:true,  w:"2h8x...5pW", note:"Tier 3 · SGP" },
  { t:"14:30:11", ok:true,  w:"7g4l...9aQ", note:"Tier 2 · CHE" },
  { t:"14:29:47", ok:false, w:"4c2k...1nB",  note:"AttestationExpired" },
  { t:"14:29:22", ok:true,  w:"64je...xfb", note:"Tier 3 · CHE" },
  { t:"14:28:58", ok:true,  w:"6r5s...8yM", note:"Tier 3 · USA" },
  { t:"14:28:44", ok:false, w:"1b9t...4zO",  note:"UntrustedIssuer" },
];

function AuditFeed() {
  const rows = [...FEED, ...FEED];
  const rowH = 50;
  const totalH = FEED.length * rowH;
  return (
    <div style={{ position:"relative", height:340, overflow:"hidden", borderRadius:12, border:`1px solid ${D.rule}`, background:D.bg2 }}>
      <div style={{ position:"absolute",top:0,left:0,right:0,height:56,background:`linear-gradient(${D.bg2},transparent)`,zIndex:2,pointerEvents:"none" }}/>
      <div style={{ position:"absolute",bottom:0,left:0,right:0,height:56,background:`linear-gradient(transparent,${D.bg2})`,zIndex:2,pointerEvents:"none" }}/>
      <style>{`@keyframes feedScroll{0%{transform:translateY(0)}100%{transform:translateY(-${totalH}px)}}`}</style>
      <div style={{ animation:`feedScroll ${FEED.length * 3}s linear infinite` }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display:"grid", gridTemplateColumns:"72px 100px 1fr 1fr", gap:16, alignItems:"center", padding:"13px 24px", borderBottom:`1px solid ${D.rule}`, height:rowH }}>
            <span style={{ fontFamily:D.mono, fontSize:"11px", color:D.ink30 }}>{r.t}</span>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <div style={{ width:6,height:6,borderRadius:"50%",background:r.ok?D.tealBt:D.red,flexShrink:0 }}/>
              <span style={{ fontFamily:D.mono, fontSize:"11px", color:r.ok?D.teal:D.red, fontWeight:500, letterSpacing:".06em" }}>{r.ok?"APPROVED":"DENIED"}</span>
            </div>
            <span style={{ fontFamily:D.mono, fontSize:"11px", color:D.ink50 }}>{r.w}</span>
            <span style={{ fontFamily:D.mono, fontSize:"11px", color:D.ink30, textAlign:"right" }}>{r.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Card hover helpers ───────────────────────────────────────
const onHover  = (e: React.MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = D.shadowMd; el.style.transform = "translateY(-2px)"; };
const onLeave  = (e: React.MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = "none"; el.style.transform = ""; };

// ─── Main ─────────────────────────────────────────────────────
export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [approved, setApproved] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setApproved(p => !p), 3200);
    return () => clearInterval(t);
  }, []);
  if (!mounted) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Inter:wght@300;400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{background:${D.bg};color:${D.ink};font-family:${D.sans};overflow-x:hidden;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
        a{color:inherit;text-decoration:none}
        ::selection{background:${D.indigo12};color:${D.indigo}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.15}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav style={{ position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"0 8vw",height:"60px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(247,248,250,.95)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${D.rule}` }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <svg width="22" height="22" viewBox="0 0 56 56" fill="none">
            <rect x="8"  y="16" width="7"  height="32" fill={D.ink}/>
            <rect x="41" y="16" width="7"  height="32" fill={D.ink}/>
            <rect x="8"  y="13" width="40" height="6"  fill={D.ink}/>
            <rect x="18" y="19" width="20" height="29" fill={D.bg}/>
            <rect x="18" y="44" width="20" height="1.5" fill={D.indigo}/>
          </svg>
          <span style={{ fontFamily:D.sans,fontSize:"12px",fontWeight:700,letterSpacing:".22em",color:D.ink }}>LEYFIS</span>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:4 }}>
          {[["#how","How it works"],["#roles","Roles"],["#mcp","MCP"],["#audit","Audit"]].map(([h,l]) => (
            <a key={h} href={h} style={{ fontFamily:D.sans,fontSize:"13px",fontWeight:500,color:D.ink50,padding:"6px 14px",transition:"color .15s" }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color=D.ink)}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color=D.ink50)}
            >{l}</a>
          ))}
          <div style={{ width:1,height:20,background:D.rule,margin:"0 8px" }}/>
          <Link href="/portal" style={{ fontFamily:D.sans,fontSize:"13px",fontWeight:500,color:D.ink70,padding:"7px 16px",border:`1px solid ${D.rule}`,transition:"all .15s" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background=D.ink08)}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background="transparent")}
          >Access Vaults</Link>
          <Link href="/admin" style={{ fontFamily:D.sans,fontSize:"13px",fontWeight:600,background:D.indigo,color:"#fff",padding:"7px 18px",display:"flex",alignItems:"center",gap:7,marginLeft:4,transition:"opacity .15s" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity=".88")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity="1")}
          >
            <span style={{ width:6,height:6,borderRadius:"50%",background:"rgba(255,255,255,.8)",animation:"blink 2s infinite",flexShrink:0 }}/>
            Admin Console
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section style={{ minHeight:"100vh",padding:"100px 8vw 96px",display:"flex",flexDirection:"column",justifyContent:"center",position:"relative",overflow:"hidden",background:D.bg }}>
        {/* Grid */}
        <div style={{ position:"absolute",inset:0,backgroundImage:`linear-gradient(${D.ink08} 1px,transparent 1px),linear-gradient(90deg,${D.ink08} 1px,transparent 1px)`,backgroundSize:"80px 80px",pointerEvents:"none",opacity:.45 }}/>
        {/* Glow */}
        <div style={{ position:"absolute",top:"10%",left:"2%",width:"55%",height:"70%",background:`radial-gradient(ellipse at 30% 50%,${D.indigo06} 0%,transparent 68%)`,pointerEvents:"none" }}/>

        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8vw",alignItems:"center",position:"relative",zIndex:1 }}>
          {/* Copy */}
          <div style={{ animation:"fadeUp .65s ease both" }}>
            {/* Pill */}
            <div style={{ display:"inline-flex",alignItems:"center",gap:8,background:D.indigo12,border:`1px solid ${D.indigo20}`,padding:"5px 14px",marginBottom:32 }}>
              <span style={{ width:5,height:5,borderRadius:"50%",background:D.indigo,flexShrink:0 }}/>
              <span style={{ fontFamily:D.mono,fontSize:"11px",color:D.indigo,letterSpacing:".10em" }}>LEYFIS FOR THE AGENTIC ECONOMY</span>
            </div>
            <h1 style={{ fontFamily:D.display,fontSize:"clamp(36px,4.8vw,68px)",fontWeight:700,lineHeight:1.0,letterSpacing:"-.030em",marginBottom:28 }}>
              <span style={{ display:"block",color:D.ink }}>The compliance</span>
              <span style={{ display:"block",color:D.indigo }}>layer for</span>
              <span style={{ display:"block",color:D.ink }}>institutions</span>
              <span style={{ display:"block",color:D.ink }}>and agents.</span>
            </h1>
            <p style={{ fontFamily:D.sans,fontSize:"17px",color:D.ink50,lineHeight:1.75,maxWidth:420,marginBottom:40 }}>
              On-chain KYC/AML enforcement before every vault interaction. Seven checks. Every time. Protocol-level. Immutable.
            </p>
            <div style={{ display:"flex",gap:12,flexWrap:"wrap",marginBottom:48 }}>
              <Link href="/portal" style={{ fontFamily:D.sans,fontSize:"14px",fontWeight:600,background:D.indigo,color:"#fff",padding:"13px 28px",transition:"all .15s" }}
                onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.background=D.indigoDk; el.style.transform="translateY(-1px)"; }}
                onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.background=D.indigo; el.style.transform=""; }}
              >Access Vaults →</Link>
              <Link href="/admin" style={{ fontFamily:D.sans,fontSize:"14px",fontWeight:500,color:D.ink70,border:`1px solid ${D.ink15}`,padding:"13px 28px",transition:"all .15s" }}
                onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.borderColor=D.ink30; el.style.background=D.ink08; }}
                onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.borderColor=D.ink15; el.style.background="transparent"; }}
              >Admin Console</Link>
            </div>
            {/* Stats strip */}
            <div style={{ display:"flex",gap:0,paddingTop:24,borderTop:`1px solid ${D.rule}` }}>
              {[["8 / 8","Tests passing"],["7","Compliance checks"],["< 400ms","Gate validation"],["FATF R.16","Aligned"]].map(([n,l],i) => (
                <div key={l} style={{ paddingRight:28,marginRight:28,borderRight:i<3?`1px solid ${D.rule}`:"none" }}>
                  <div style={{ fontFamily:D.sans,fontSize:"18px",fontWeight:700,color:D.ink,letterSpacing:"-.02em" }}>{n}</div>
                  <div style={{ fontFamily:D.mono,fontSize:"11px",color:D.ink30,letterSpacing:".08em",marginTop:4 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Gate visual */}
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:24,animation:"fadeUp .65s ease .15s both" }}>
            <Gate approved={approved} size={220}/>
            <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".16em",fontWeight:500,color:approved?D.teal:D.indigo,transition:"color .7s" }}>
              {approved ? "ACCESS GRANTED" : "VERIFYING..."}
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 20px",background:D.bg2,border:`1px solid ${D.rule}`,boxShadow:D.shadow }}>
              <span style={{ width:6,height:6,borderRadius:"50%",background:D.tealBt,animation:"blink 2s infinite" }}/>
              <span style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".10em",color:D.ink50 }}>DEVNET LIVE · GATE PROGRAM ACTIVE</span>
            </div>
          </div>
        </div>

      </section>

      {/* ── THE GAP ─────────────────────────────────────────── */}
      <section id="problem" style={{ padding:"96px 8vw",borderTop:`1px solid ${D.rule}`,background:D.bg1 }}>
        <Fade>
          <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".14em",color:D.ink30,textTransform:"uppercase",marginBottom:48 }}>01 — The Gap</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6vw",alignItems:"start",marginBottom:40 }}>
            <div>
              <h2 style={{ fontFamily:D.display,fontSize:"clamp(24px,3.2vw,44px)",fontWeight:700,lineHeight:1.05,letterSpacing:"-.025em",color:D.ink,marginBottom:22 }}>
                Compliance exists.<br/><span style={{ color:D.indigo }}>DeFi can't read it.</span>
              </h2>
              <p style={{ fontFamily:D.sans,fontSize:"16px",color:D.ink50,lineHeight:1.75,marginBottom:18 }}>
                Banks have spent years building KYC/AML infrastructure. That work lives in internal systems no blockchain can query.
              </p>
              <p style={{ fontFamily:D.sans,fontSize:"15px",fontWeight:600,color:D.ink,lineHeight:1.55 }}>
                DeFi vaults can't distinguish a verified institutional investor from a sanctioned wallet.{" "}
                <span style={{ color:D.indigo }}>Compliance has no on-chain address.</span>
              </p>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:3 }}>
              <div style={{ padding:"22px 26px",background:D.red10,border:"1px solid rgba(122,31,31,0.16)" }}>
                <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".12em",color:D.red,marginBottom:14 }}>WITHOUT LEYFIS</div>
                {["KYC data locked in spreadsheets and PDFs","Vault open to any wallet — verified or not","One sanctioned wallet exposes the entire institution","Compliance team reviews every transaction manually"].map((t,i) => (
                  <div key={i} style={{ display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid rgba(220,38,38,0.08)" }}>
                    <span style={{ color:D.red,fontSize:12,flexShrink:0 }}>✕</span>
                    <span style={{ fontFamily:D.sans,fontSize:13,color:D.ink50,lineHeight:1.65 }}>{t}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding:"22px 26px",background:D.teal10,border:`1px solid ${D.teal20}` }}>
                <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".12em",color:D.teal,marginBottom:14 }}>WITH LEYFIS</div>
                {["Signed attestations on Solana — always current, always on-chain","Every wallet checked automatically before execution","Sanctioned wallets blocked at the protocol layer","Audit log written on-chain. No manual review. No exceptions."].map((t,i) => (
                  <div key={i} style={{ display:"flex",gap:10,padding:"7px 0",borderBottom:`1px solid rgba(13,107,79,0.1)` }}>
                    <span style={{ color:D.teal,fontSize:12,flexShrink:0 }}>✓</span>
                    <span style={{ fontFamily:D.sans,fontSize:13,color:D.ink70,lineHeight:1.65 }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Fade>

        {/* Agentic callout */}
        <Fade delay={100}>
          <div style={{ padding:"28px 32px",background:D.indigo12,border:`1px solid ${D.indigo20}`,display:"flex",gap:28,alignItems:"flex-start" }}>
            <div style={{ flexShrink:0,width:48,height:48,background:D.indigo20,display:"flex",alignItems:"center",justifyContent:"center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={D.indigo} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73C11.4 5.39 11 4.74 11 4a2 2 0 0 1 2-2z"/>
                <circle cx="7.5" cy="14.5" r="1"/><circle cx="16.5" cy="14.5" r="1"/>
              </svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".10em",color:D.indigo,marginBottom:10,textTransform:"uppercase" }}>New · Leyfis for the Agentic Economy</div>
              <h3 style={{ fontFamily:D.display,fontSize:"18px",fontWeight:700,color:D.ink,marginBottom:10,letterSpacing:"-.015em" }}>Your AI agents inherit your compliance tier.</h3>
              <p style={{ fontFamily:D.sans,fontSize:"14px",color:D.ink50,lineHeight:1.75,maxWidth:680 }}>In the agentic economy, institutions deploy AI systems to execute on their behalf. Leyfis verifies them exactly as it verifies your human traders — on-chain, before execution, with a full immutable audit trail. Permissioned autonomy, without blind spots.</p>
            </div>
          </div>
        </Fade>
      </section>

      {/* ── HOW THE GATE WORKS ──────────────────────────────── */}
      <section id="how" style={{ padding:"96px 8vw",borderTop:`1px solid ${D.rule}`,background:D.bg2 }}>
        <Fade>
          <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".14em",color:D.ink30,textTransform:"uppercase",marginBottom:48 }}>02 — The Gate</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6vw",alignItems:"start",marginBottom:56 }}>
            <div>
              <h2 style={{ fontFamily:D.display,fontSize:"clamp(24px,3.2vw,44px)",fontWeight:700,lineHeight:1.05,letterSpacing:"-.025em",color:D.ink,marginBottom:22 }}>
                Seven checks.<br/>Every time.<br/><span style={{ color:D.indigo }}>No exceptions.</span>
              </h2>
              <p style={{ fontFamily:D.sans,fontSize:"16px",color:D.ink50,lineHeight:1.75 }}>
                Every vault interaction passes through the Leyfis Gate first. Seven checks fire in a fixed order. Any failure stops the transaction atomically — no partial state, no side effects. The gate cannot be bypassed.
              </p>
            </div>
            {/* Flow */}
            <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
              {[
                { from:"Wallet",      to:"Leyfis Gate",  note:"intercepts every call",       color:D.indigo },
                { from:"Leyfis Gate", to:"SAS Attest.",  note:"reads on-chain credential",   color:D.indigo },
                { from:"Gate",        to:"7 Checks",     note:"tier · issuer · expiry · geo", color:D.amber  },
                { from:"PASS",        to:"Vault",        note:"CPI forwarded atomically",     color:D.teal   },
                { from:"FAIL",        to:"Rejected",     note:"reason code + audit entry",    color:D.red    },
              ].map(({ from,to,note,color },i) => (
                <div key={i} style={{ display:"grid",gridTemplateColumns:"108px 14px 112px 1fr",gap:8,padding:"12px 18px",border:`1px solid ${D.rule}`,background:D.bg1,alignItems:"center" }}>
                  <span style={{ fontFamily:D.mono,fontSize:"11px",color,fontWeight:500,letterSpacing:".04em" }}>{from}</span>
                  <span style={{ fontFamily:D.mono,fontSize:"12px",color:D.ink30 }}>→</span>
                  <span style={{ fontFamily:D.mono,fontSize:"11px",color:D.ink,fontWeight:500,letterSpacing:".04em" }}>{to}</span>
                  <span style={{ fontFamily:D.mono,fontSize:"11px",color:D.ink30 }}>{note}</span>
                </div>
              ))}
            </div>
          </div>
        </Fade>

        {/* 4 steps */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:2,marginBottom:56 }}>
          {[
            { n:"01", t:"Attest",    d:"KYC provider issues a signed credential to the verified wallet. Tier, jurisdiction, expiry. One transaction. Immutable." },
            { n:"02", t:"Gate",      d:"Every vault interaction hits the Gate first. Seven checks fire in order. Any failure stops the transaction. No discretion." },
            { n:"03", t:"Authorize", d:"All checks pass. Leyfis CPIs to the vault with the original instruction unchanged. Atomic. Invisible to compliant users." },
            { n:"04", t:"Audit",     d:"Every outcome — approved or denied — writes an immutable AuditEntry on-chain. FATF R.16 CSV on demand." },
          ].map(({ n,t,d },i) => (
            <Fade key={n} delay={i*60}>
              <div style={{ padding:28,border:`1px solid ${D.rule}`,background:D.bg1,height:"100%",transition:"all .2s",cursor:"default" }}
                onMouseEnter={onHover} onMouseLeave={onLeave}>
                <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
                  <span style={{ fontFamily:D.mono,fontSize:"11px",color:D.ink15,letterSpacing:".04em" }}>{n}</span>
                  <span style={{ fontFamily:D.display,fontSize:"16px",fontWeight:700,color:D.ink }}>{t}</span>
                </div>
                <p style={{ fontFamily:D.sans,fontSize:"13px",color:D.ink50,lineHeight:1.75 }}>{d}</p>
              </div>
            </Fade>
          ))}
        </div>

        {/* 7 checks table */}
        <Fade>
          <div style={{ maxWidth:860,margin:"0 auto" }}>
            <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".12em",color:D.ink30,textAlign:"center",marginBottom:18,textTransform:"uppercase" }}>
              7 Compliance Checks — Enforced on Every Gate Call, in This Order
            </div>
            <div style={{ border:`1px solid ${D.rule}`,overflow:"hidden",boxShadow:D.shadow }}>
              {[
                ["01","Gate status",       "GatePaused",          "Gate is paused by vault operator"],
                ["02","Attestation exists","NoAttestation",       "No credential found for this wallet"],
                ["03","Not revoked",       "AttestationRevoked",  "Credential has been revoked by issuer"],
                ["04","Not expired",       "AttestationExpired",  "Credential validity has lapsed"],
                ["05","Trusted issuer",    "UntrustedIssuer",     "Issuer not on vault approved list"],
                ["06","Tier sufficient",   "TierInsufficient",    "Wallet tier below vault minimum"],
                ["07","Jurisdiction",      "JurisdictionBlocked", "Wallet jurisdiction not permitted"],
              ].map(([num,label,code,desc],i) => (
                <div key={i} style={{ display:"grid",gridTemplateColumns:"36px 1fr 1fr 1.4fr",gap:16,padding:"15px 22px",borderBottom:i<6?`1px solid ${D.rule}`:"none",background:D.bg2,alignItems:"center",transition:"background .12s",cursor:"default" }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background=D.indigo06)}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background=D.bg2)}
                >
                  <span style={{ fontFamily:D.mono,fontSize:"11px",color:D.ink15 }}>{num}</span>
                  <span style={{ fontFamily:D.sans,fontSize:"13px",fontWeight:500,color:D.ink }}>{label}</span>
                  <span style={{ fontFamily:D.mono,fontSize:"11px",color:D.indigo,letterSpacing:".04em" }}>{code}</span>
                  <span style={{ fontFamily:D.sans,fontSize:"12px",color:D.ink50 }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </Fade>
      </section>

      {/* ── FIVE STAKEHOLDERS BENTO ──────────────────────────── */}
      <section id="roles" style={{ padding:"96px 8vw",borderTop:`1px solid ${D.rule}`,background:D.bg1 }}>
        <Fade>
          <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".14em",color:D.ink30,textTransform:"uppercase",marginBottom:14 }}>03 — Built For</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr auto",gap:32,alignItems:"end",marginBottom:44 }}>
            <h2 style={{ fontFamily:D.display,fontSize:"clamp(24px,3.2vw,44px)",fontWeight:700,lineHeight:1.05,letterSpacing:"-.025em",color:D.ink }}>
              One gate.<br/><span style={{ color:D.indigo }}>Five stakeholders.</span><br/>All aligned.
            </h2>
            <p style={{ fontFamily:D.sans,fontSize:"14px",color:D.ink50,lineHeight:1.7,maxWidth:260,textAlign:"right" }}>
              Each role operates independently.<br/><span style={{ color:D.ink,fontWeight:500 }}>Leyfis keeps them in sync.</span>
            </p>
          </div>
        </Fade>

        {/* Row 1 — 5-col grid: span 2 + span 2 + span 1 */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:3,marginBottom:3 }}>
          {[
            { label:"Financial Institutions", color:D.indigo, span:2,
              headline:"Enter DeFi without regulatory exposure.",
              desc:"Deploy capital into on-chain strategies while maintaining full KYC/AML compliance.",
              points:["Enforce access at transaction level","Eliminate sanctioned wallet exposure","Auto-generate regulator-ready audit trails","Align with FATF and MiCA"] },
            { label:"Vault Operators", color:D.teal, span:2,
              headline:"Control who accesses your vault.",
              desc:"Define and enforce compliance rules without touching your existing vault architecture.",
              points:["Set minimum KYC tier per vault","Whitelist trusted KYC issuers","Pause / unpause access in one call","Monitor live gate activity"] },
            { label:"KYC Issuers", color:"#8899BB", span:1,
              headline:"Turn KYC into an on-chain primitive.",
              desc:"Issue verifiable credentials that control access to real financial infrastructure.",
              points:["Issue wallet attestations","Set tiers and expiries","Revoke in real time","View issuance registry"] },
          ].map(({ label,color,span,headline,desc,points },i) => (
            <Fade key={label} delay={i*70} style={{ gridColumn:`span ${span}` }}>
              <div style={{ padding:32,border:`1px solid ${D.rule}`,background:D.bg2,height:"100%",transition:"all .2s",cursor:"default" }}
                onMouseEnter={onHover} onMouseLeave={onLeave}>
                <div style={{ display:"flex",alignItems:"center",gap:9,marginBottom:18 }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:color }}/>
                  <span style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".10em",color,textTransform:"uppercase" }}>{label}</span>
                </div>
                <h3 style={{ fontFamily:D.display,fontSize:"clamp(14px,1.5vw,18px)",fontWeight:700,lineHeight:1.15,color:D.ink,marginBottom:10,letterSpacing:"-.012em" }}>{headline}</h3>
                <p style={{ fontFamily:D.sans,fontSize:"13px",color:D.ink50,lineHeight:1.7,marginBottom:18 }}>{desc}</p>
                {points.map((p,j) => (
                  <div key={j} style={{ display:"flex",gap:10,alignItems:"flex-start",padding:"8px 0",borderBottom:`1px solid ${D.rule}` }}>
                    <div style={{ width:4,height:4,borderRadius:"50%",background:color,flexShrink:0,marginTop:6 }}/>
                    <span style={{ fontFamily:D.sans,fontSize:"12px",color:D.ink50,lineHeight:1.6 }}>{p}</span>
                  </div>
                ))}
              </div>
            </Fade>
          ))}
        </div>

        {/* Row 2 — span 3 + span 2 */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:3 }}>
          {[
            { label:"Compliance Auditors", color:D.amber, span:3, bg:D.bg2, border:D.rule,
              headline:"Read-only access to everything.",
              desc:"Filter the audit log, monitor denials in real-time, and export FATF R.16 CSV reports for regulators and executive teams.",
              points:["Filter by date, outcome, wallet, tier","Export FATF R.16 CSV in one click","Monitor live gate activity feed","Read-only — zero write permissions, ever"] },
            { label:"AI Agents & Autonomous Systems", color:D.indigo, span:2, bg:D.indigo12, border:D.indigo20,
              headline:"Permissioned autonomy.",
              desc:"In the agentic economy, AI systems execute on behalf of institutions. Leyfis verifies each agent with the same rigor as human traders — on-chain, before execution.",
              points:["Agents inherit institutional attestation tier","Every agent interaction fully audited","Full compliance trail, zero blind spots","Same 7 checks on every agent call"] },
          ].map(({ label,color,span,bg,border,headline,desc,points },i) => (
            <Fade key={label} delay={i*80+200} style={{ gridColumn:`span ${span}` }}>
              <div style={{ padding:32,border:`1px solid ${border}`,background:bg,height:"100%",transition:"all .2s",cursor:"default" }}
                onMouseEnter={onHover} onMouseLeave={onLeave}>
                <div style={{ display:"flex",alignItems:"center",gap:9,marginBottom:18 }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:color }}/>
                  <span style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".10em",color,textTransform:"uppercase" }}>{label}</span>
                </div>
                <h3 style={{ fontFamily:D.display,fontSize:"clamp(14px,1.5vw,18px)",fontWeight:700,lineHeight:1.15,color:D.ink,marginBottom:10,letterSpacing:"-.012em" }}>{headline}</h3>
                <p style={{ fontFamily:D.sans,fontSize:"13px",color:D.ink50,lineHeight:1.7,marginBottom:18 }}>{desc}</p>
                <div style={{ display:"grid",gridTemplateColumns:span===3?"1fr 1fr":"1fr",gap:0 }}>
                  {points.map((p,j) => (
                    <div key={j} style={{ display:"flex",gap:10,alignItems:"flex-start",padding:"8px 0",borderBottom:`1px solid ${D.rule}` }}>
                      <div style={{ width:4,height:4,borderRadius:"50%",background:color,flexShrink:0,marginTop:6 }}/>
                      <span style={{ fontFamily:D.sans,fontSize:"12px",color:D.ink50,lineHeight:1.6 }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Fade>
          ))}
        </div>
      </section>

      {/* ── MCP SECTION ─────────────────────────────────────── */}
      <section id="mcp" style={{ padding:"96px 8vw",borderTop:`1px solid ${D.rule}`,background:D.bg }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8vw",alignItems:"center" }}>
          <Fade>
            <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".14em",color:D.ink30,textTransform:"uppercase",marginBottom:14 }}>04 — Natural Language Operations</div>
            <h2 style={{ fontFamily:D.display,fontSize:"clamp(24px,3.2vw,44px)",fontWeight:700,lineHeight:1.05,letterSpacing:"-.025em",color:D.ink,marginBottom:22 }}>
              Leyfis speaks<br/><span style={{ color:D.indigo }}>natural language.</span>
            </h2>
            <p style={{ fontFamily:D.sans,fontSize:"17px",color:D.ink50,lineHeight:1.75,marginBottom:32 }}>
              Claude Desktop connects directly to the Leyfis protocol via MCP. Compliance operators configure vaults, query audit logs, and generate regulatory reports in plain English — no CLI, no code.
            </p>
            <div style={{ display:"flex",flexDirection:"column",gap:2,marginBottom:28 }}>
              {["Pause and unpause gate access","Query audit log and filter by outcome","Issue and revoke on-chain attestations","Export FATF R.16 compliance reports","Update vault config and trusted issuers"].map((t,i) => (
                <div key={i} style={{ display:"flex",gap:12,alignItems:"center",padding:"12px 16px",border:`1px solid ${D.rule}`,background:D.bg2 }}>
                  <div style={{ width:6,height:6,borderRadius:"50%",background:D.indigo,flexShrink:0 }}/>
                  <span style={{ fontFamily:D.sans,fontSize:"13px",color:D.ink70 }}>{t}</span>
                </div>
              ))}
            </div>
            <div style={{ display:"inline-flex",alignItems:"center",gap:10,padding:"10px 16px",background:D.indigo12,border:`1px solid ${D.indigo20}` }}>
              <span style={{ fontFamily:D.mono,fontSize:"11px",color:D.indigo,letterSpacing:".05em" }}>12 MCP tools · No CLI · No Solana Explorer</span>
            </div>
          </Fade>
          <Fade delay={100}>
            <McpTerminal/>
          </Fade>
        </div>
      </section>

      {/* ── AUDIT FEED ──────────────────────────────────────── */}
      <section id="audit" style={{ padding:"96px 8vw",borderTop:`1px solid ${D.rule}`,background:D.bg1 }}>
        <Fade>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6vw",alignItems:"start",marginBottom:40 }}>
            <div>
              <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".14em",color:D.ink30,textTransform:"uppercase",marginBottom:14 }}>05 — The Audit is Public</div>
              <h2 style={{ fontFamily:D.display,fontSize:"clamp(22px,2.8vw,40px)",fontWeight:700,lineHeight:1.05,letterSpacing:"-.025em",color:D.ink,marginBottom:18 }}>
                Every decision is on-chain.<br/><span style={{ color:D.teal }}>Nothing is hidden.</span>
              </h2>
              <p style={{ fontFamily:D.sans,fontSize:"16px",color:D.ink50,lineHeight:1.75 }}>
                Every gate call — approved or denied — writes an immutable AuditEntry to Solana. Independently verifiable. Never mutable. Readable by anyone, including regulators.
              </p>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:8,paddingTop:32 }}>
              {[
                ["Audit entries written","on every gate call"],
                ["Mutation possible","never"],
                ["FATF R.16 export","one click"],
                ["Verification","Solana Explorer"],
              ].map(([label,value]) => (
                <div key={label} style={{ display:"flex",justifyContent:"space-between",padding:"13px 16px",border:`1px solid ${D.rule}`,background:D.bg2 }}>
                  <span style={{ fontFamily:D.sans,fontSize:"13px",color:D.ink50 }}>{label}</span>
                  <span style={{ fontFamily:D.mono,fontSize:"12px",color:D.ink,fontWeight:500 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          <AuditFeed/>
        </Fade>
      </section>

      {/* ── TECH STRIP ──────────────────────────────────────── */}
      <section style={{ padding:"36px 8vw",borderTop:`1px solid ${D.rule}`,background:D.bg2 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:24 }}>
          {[
            ["Blockchain","Solana devnet"],
            ["Smart contracts","Rust + Anchor v0.30"],
            ["Credentials","SAS Attestation Service"],
            ["RPC","Helius"],
            ["AI interface","Claude MCP · 12 tools"],
            ["Test coverage","8 / 8 passing"],
          ].map(([label,value]) => (
            <div key={label} style={{ textAlign:"center" }}>
              <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".10em",color:D.ink30,textTransform:"uppercase",marginBottom:5 }}>{label}</div>
              <div style={{ fontFamily:D.sans,fontSize:"13px",fontWeight:500,color:D.ink }}>{value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section style={{ padding:"120px 8vw",background:D.indigo,position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)",backgroundSize:"60px 60px",pointerEvents:"none" }}/>
        <div style={{ position:"absolute",top:"-20%",right:"-10%",width:"50%",height:"140%",background:"radial-gradient(ellipse at 60% 50%,rgba(255,255,255,0.06) 0%,transparent 65%)",pointerEvents:"none" }}/>
        <Fade>
          <div style={{ position:"relative",textAlign:"center",maxWidth:780,margin:"0 auto" }}>
            <h2 style={{ fontFamily:D.display,fontSize:"clamp(28px,4.2vw,60px)",fontWeight:700,lineHeight:1.0,letterSpacing:"-.025em",color:"#fff",marginBottom:24 }}>
              Your institution's next move<br/>into DeFi starts<br/>with a gate.
            </h2>
            <p style={{ fontFamily:D.sans,fontSize:"18px",color:"rgba(255,255,255,.7)",lineHeight:1.7,marginBottom:48,maxWidth:440,margin:"0 auto 48px" }}>
              Verify compliance. Enforce access. Audit everything.
            </p>
            <div style={{ display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap" }}>
              <Link href="/portal" style={{ fontFamily:D.sans,fontSize:"15px",fontWeight:600,background:"#fff",color:D.indigo,padding:"14px 36px",transition:"all .15s" }}
                onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.transform="translateY(-1px)"; el.style.opacity=".92"; }}
                onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.transform=""; el.style.opacity="1"; }}
              >Access Vaults →</Link>
              <Link href="/admin" style={{ fontFamily:D.sans,fontSize:"15px",fontWeight:500,color:"rgba(255,255,255,.88)",padding:"14px 36px",border:"1px solid rgba(255,255,255,.28)",transition:"all .15s" }}
                onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.background="rgba(255,255,255,.1)"; el.style.borderColor="rgba(255,255,255,.45)"; }}
                onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.background="transparent"; el.style.borderColor="rgba(255,255,255,.28)"; }}
              >Open Admin Console</Link>
            </div>
          </div>
        </Fade>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer style={{ padding:"24px 8vw",borderTop:`1px solid ${D.rule}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:D.bg,flexWrap:"wrap",gap:16 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <svg width="18" height="18" viewBox="0 0 56 56" fill="none">
            <rect x="8"  y="16" width="7"  height="32" fill={D.ink}/>
            <rect x="41" y="16" width="7"  height="32" fill={D.ink}/>
            <rect x="8"  y="13" width="40" height="6"  fill={D.ink}/>
            <rect x="18" y="19" width="20" height="29" fill={D.bg}/>
          </svg>
          <span style={{ fontFamily:D.sans,fontSize:"11px",fontWeight:700,letterSpacing:".22em",color:D.ink50 }}>LEYFIS</span>
        </div>
        <div style={{ display:"flex",gap:24 }}>
          {([["Vaults","/portal"],["Admin","/admin"],["GitHub","https://github.com/thinkDecade/leyfis"],["Explorer",`https://explorer.solana.com/address/Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP?cluster=devnet`]] as [string,string][]).map(([l,h]) => (
            <a key={l} href={h} target={h.startsWith("http")?"_blank":undefined} rel="noreferrer"
              style={{ fontFamily:D.sans,fontSize:"13px",fontWeight:500,color:D.ink30,transition:"color .15s" }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color=D.ink70)}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color=D.ink30)}
            >{l}</a>
          ))}
        </div>
        <span style={{ fontFamily:D.mono,fontSize:"11px",color:D.ink30 }}>Gate: Cskp4z…QZVP · Solana devnet</span>
      </footer>
    </>
  );
}
