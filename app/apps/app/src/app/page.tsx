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

// ─── Design tokens ────────────────────────────────────────────
const D = {
  bg:       "#F7F8FA",
  bg1:      "#F0F2F7",
  bg2:      "#FFFFFF",
  bgDark:   "#0A0F1C",

  ink:      "#0A0F1C",
  ink70:    "rgba(10,15,28,0.70)",
  ink50:    "rgba(10,15,28,0.50)",
  ink30:    "rgba(10,15,28,0.30)",
  ink15:    "rgba(10,15,28,0.15)",
  ink08:    "rgba(10,15,28,0.08)",
  ink04:    "rgba(10,15,28,0.04)",

  indigo:   "#1B4FD8",
  indigoDk: "#163FAD",
  indigo20: "rgba(27,79,216,0.20)",
  indigo12: "rgba(27,79,216,0.12)",
  indigo06: "rgba(27,79,216,0.06)",

  teal:     "#0F6E56",
  tealBt:   "#0F6E56",
  teal20:   "rgba(15,110,86,0.20)",
  teal10:   "rgba(15,110,86,0.10)",

  red:      "#7A1F1F",
  red10:    "rgba(122,31,31,0.10)",

  amber:    "#B45309",
  amber10:  "rgba(180,83,9,0.10)",
  amber20:  "rgba(180,83,9,0.20)",

  rule:     "rgba(10,15,28,0.08)",
  shadow:   "0 1px 3px rgba(10,15,28,0.05),0 4px 16px rgba(10,15,28,0.04)",
  shadowMd: "0 2px 8px rgba(10,15,28,0.08),0 8px 24px rgba(10,15,28,0.06)",

  mono:    "'DM Mono',monospace",
  display: "'Inter',sans-serif",
  sans:    "'Inter',sans-serif",

  ice:     "#E8EEF6",
};

// ─── MCP terminal ─────────────────────────────────────────────
const MCP_EX = [
  { cmd:"Pause the gate for the EU vault",         res:"Gate paused. VaultConfig updated.\nVault: 88x1...NaJ  ·  Slot: 312,847,291\nAudit entry written." },
  { cmd:"Who was denied access in the last hour?", res:"3 denials in the last 60 minutes:\n  2× NoAttestation  ·  1× TierInsufficient\nMost recent: 5t1o...fjS at 14:31:58" },
  { cmd:"Export FATF R.16 report for this week",   res:"compliance_report_2026-W18.csv ready.\n47 entries  ·  41 approved  ·  6 denied\nFields: wallet, vault, timestamp, outcome, tier, jurisdiction" },
];
function McpTerminal() {
  const [idx, setIdx] = useState(0);
  const [vis, setVis] = useState(true);
  useEffect(() => {
    const t = setInterval(() => { setVis(false); setTimeout(() => { setIdx(i=>(i+1)%MCP_EX.length); setVis(true); },380); },4800);
    return () => clearInterval(t);
  }, []);
  const ex = MCP_EX[idx];
  return (
    <div style={{ background:D.bgDark,border:"1px solid rgba(232,238,246,0.08)",boxShadow:"0 16px 56px rgba(0,0,0,0.22)" }}>
      <div style={{ padding:"13px 20px",borderBottom:"1px solid rgba(232,238,246,0.06)",display:"flex",alignItems:"center",gap:"7px" }}>
        {["#FF5F57","#FFBD2E","#28C840"].map(c=><div key={c} style={{ width:11,height:11,borderRadius:"50%",background:c }}/>)}
        <span style={{ fontFamily:D.mono,fontSize:"11px",color:"rgba(232,238,246,.28)",marginLeft:8,letterSpacing:".05em" }}>leyfis — claude mcp</span>
      </div>
      <div style={{ padding:"28px",minHeight:210,opacity:vis?1:0,transition:"opacity .32s" }}>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontFamily:D.mono,fontSize:"11px",color:"rgba(27,79,216,.6)",letterSpacing:".08em",marginBottom:8 }}>You</div>
          <div style={{ fontFamily:D.mono,fontSize:"13px",color:D.ice,lineHeight:1.65 }}>{ex.cmd}</div>
        </div>
        <div style={{ borderLeft:`2px solid ${D.indigo}`,paddingLeft:16 }}>
          <div style={{ fontFamily:D.mono,fontSize:"11px",color:"rgba(27,79,216,.9)",letterSpacing:".08em",marginBottom:8 }}>Leyfis</div>
          <div style={{ fontFamily:D.mono,fontSize:"12px",color:"rgba(232,238,246,.65)",lineHeight:1.85,whiteSpace:"pre-line" }}>{ex.res}</div>
        </div>
      </div>
      <div style={{ padding:"0 28px 20px",display:"flex",gap:6 }}>
        {MCP_EX.map((_,i)=><div key={i} style={{ width:i===idx?18:6,height:6,borderRadius:3,background:i===idx?D.indigo:"rgba(232,238,246,.15)",transition:"all .3s" }}/>)}
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
  const rows=[...FEED,...FEED]; const rowH=50; const totalH=FEED.length*rowH;
  return (
    <div style={{ position:"relative",height:340,overflow:"hidden",border:`1px solid ${D.rule}`,background:D.bg2 }}>
      <div style={{ position:"absolute",top:0,left:0,right:0,height:56,background:`linear-gradient(${D.bg2},transparent)`,zIndex:2,pointerEvents:"none" }}/>
      <div style={{ position:"absolute",bottom:0,left:0,right:0,height:56,background:`linear-gradient(transparent,${D.bg2})`,zIndex:2,pointerEvents:"none" }}/>
      <style>{`@keyframes feedScroll{0%{transform:translateY(0)}100%{transform:translateY(-${totalH}px)}}`}</style>
      <div style={{ animation:`feedScroll ${FEED.length*3}s linear infinite` }}>
        {rows.map((r,i)=>(
          <div key={i} style={{ display:"grid",gridTemplateColumns:"72px 100px 1fr 1fr",gap:16,alignItems:"center",padding:"13px 24px",borderBottom:`1px solid ${D.rule}`,height:rowH }}>
            <span style={{ fontFamily:D.mono,fontSize:"11px",color:D.ink30 }}>{r.t}</span>
            <div style={{ display:"flex",alignItems:"center",gap:7 }}>
              <div style={{ width:6,height:6,borderRadius:"50%",background:r.ok?D.tealBt:D.red,flexShrink:0 }}/>
              <span style={{ fontFamily:D.mono,fontSize:"11px",color:r.ok?D.teal:D.red,fontWeight:500,letterSpacing:".06em" }}>{r.ok?"APPROVED":"DENIED"}</span>
            </div>
            <span style={{ fontFamily:D.mono,fontSize:"11px",color:D.ink50 }}>{r.w}</span>
            <span style={{ fontFamily:D.mono,fontSize:"11px",color:D.ink30,textAlign:"right" }}>{r.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const onHover = (e:React.MouseEvent)=>{ const el=e.currentTarget as HTMLElement; el.style.boxShadow=D.shadowMd; el.style.transform="translateY(-2px)"; };
const onLeave = (e:React.MouseEvent)=>{ const el=e.currentTarget as HTMLElement; el.style.boxShadow="none"; el.style.transform=""; };

// ─── Shared slide layout ──────────────────────────────────────
// Each slide = inline grid with explicit 1fr 1fr — no className needed
const SLIDE: React.CSSProperties = { display:"grid", gridTemplateColumns:"1fr 1fr" };

// ─── Main ─────────────────────────────────────────────────────
export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive:true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!mounted) return null;

  const navInk   = scrolled ? D.ink   : D.ice;
  const navInk50 = scrolled ? D.ink50 : "rgba(232,238,246,0.55)";
  const navBg    = scrolled ? "rgba(247,248,250,0.96)" : "rgba(10,15,28,0.55)";
  const navBdr   = scrolled ? D.rule  : "rgba(232,238,246,0.08)";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Inter:wght@300;400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{background:${D.bg};color:${D.ink};font-family:${D.sans};overflow-x:hidden;-webkit-font-smoothing:antialiased}
        a{color:inherit;text-decoration:none}
        ::selection{background:${D.indigo12};color:${D.indigo}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.15}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav style={{ position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"0 8vw",height:"64px",display:"flex",alignItems:"center",justifyContent:"space-between",background:navBg,backdropFilter:"blur(20px)",borderBottom:`1px solid ${navBdr}`,transition:"background .3s,border-color .3s" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <svg width="22" height="22" viewBox="0 0 56 56" fill="none">
            <rect x="8"  y="16" width="7"  height="32" fill={navInk}/>
            <rect x="41" y="16" width="7"  height="32" fill={navInk}/>
            <rect x="8"  y="13" width="40" height="6"  fill={navInk}/>
            <rect x="18" y="19" width="20" height="29" fill={scrolled?D.bg:D.bgDark}/>
            <rect x="18" y="44" width="20" height="1.5" fill={D.indigo}/>
          </svg>
          <span style={{ fontFamily:D.sans,fontSize:"12px",fontWeight:700,letterSpacing:".22em",color:navInk,transition:"color .3s" }}>LEYFIS</span>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:4 }}>
          {[["#how","How it works"],["#roles","Roles"],["#mcp","MCP"],["#audit","Audit"]].map(([h,l])=>(
            <a key={h} href={h} style={{ fontFamily:D.sans,fontSize:"13px",fontWeight:500,color:navInk50,padding:"6px 14px",transition:"color .15s" }}
              onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color=navInk)}
              onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color=navInk50)}
            >{l}</a>
          ))}
          <div style={{ width:1,height:20,background:scrolled?D.rule:"rgba(232,238,246,0.15)",margin:"0 8px",transition:"background .3s" }}/>
          <Link href="/portal" style={{ fontFamily:D.sans,fontSize:"13px",fontWeight:500,color:navInk,padding:"7px 16px",border:`1px solid ${scrolled?D.rule:"rgba(232,238,246,0.20)"}`,transition:"all .15s" }}
            onMouseEnter={e=>((e.currentTarget as HTMLElement).style.background=scrolled?D.ink08:"rgba(232,238,246,0.08)")}
            onMouseLeave={e=>((e.currentTarget as HTMLElement).style.background="transparent")}
          >Access Vaults</Link>
          <Link href="/admin" style={{ fontFamily:D.sans,fontSize:"13px",fontWeight:600,background:D.indigo,color:"#fff",padding:"7px 18px",display:"flex",alignItems:"center",gap:7,marginLeft:4,transition:"opacity .15s" }}
            onMouseEnter={e=>((e.currentTarget as HTMLElement).style.opacity=".88")}
            onMouseLeave={e=>((e.currentTarget as HTMLElement).style.opacity="1")}
          >
            <span style={{ width:6,height:6,borderRadius:"50%",background:"rgba(255,255,255,.8)",animation:"blink 2s infinite",flexShrink:0 }}/>
            Admin Console
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section style={{ minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"flex-end",position:"relative",overflow:"hidden",background:D.bgDark }}>
        <div style={{ position:"absolute",inset:0,backgroundImage:"url('/hero-bg.jpg')",backgroundSize:"cover",backgroundPosition:"60% center",backgroundRepeat:"no-repeat",pointerEvents:"none" }}/>
        <div style={{ position:"absolute",inset:0,background:"linear-gradient(105deg,rgba(10,15,28,0.93) 0%,rgba(10,15,28,0.82) 38%,rgba(10,15,28,0.50) 62%,rgba(10,15,28,0.18) 100%)",pointerEvents:"none" }}/>
        <div style={{ position:"absolute",bottom:0,left:0,right:0,height:"220px",background:"linear-gradient(transparent,rgba(10,15,28,0.70))",pointerEvents:"none" }}/>
        <div style={{ position:"relative",zIndex:1,padding:"140px 8vw 72px" }}>
          <div style={{ animation:"fadeUp .55s ease both" }}>
            <div style={{ display:"inline-flex",alignItems:"center",gap:8,background:"rgba(27,79,216,0.18)",border:"1px solid rgba(27,79,216,0.38)",padding:"5px 16px",marginBottom:36 }}>
              <span style={{ width:5,height:5,borderRadius:"50%",background:D.indigo,flexShrink:0,animation:"blink 2.4s infinite" }}/>
              <span style={{ fontFamily:D.mono,fontSize:"11px",color:"rgba(100,140,255,0.92)",letterSpacing:".12em" }}>INSTITUTIONAL COMPLIANCE INFRASTRUCTURE · SOLANA DEVNET</span>
            </div>
          </div>
          <div style={{ animation:"fadeUp .65s ease .08s both" }}>
            <h1 style={{ fontFamily:D.display,fontSize:"clamp(40px,5.8vw,82px)",fontWeight:700,lineHeight:.97,letterSpacing:"-.035em",marginBottom:32,maxWidth:"740px" }}>
              <span style={{ display:"block",color:D.ice }}>The Credit Bureau</span>
              <span style={{ display:"block",color:D.ice }}>for the</span>
              <span style={{ display:"block",color:"#5B8EFF" }}>Agentic Economy.</span>
            </h1>
          </div>
          <div style={{ animation:"fadeUp .65s ease .16s both" }}>
            <p style={{ fontFamily:D.sans,fontSize:"18px",color:"rgba(232,238,246,0.58)",lineHeight:1.72,maxWidth:480,marginBottom:44 }}>
              On-chain KYC/AML enforcement before every vault interaction. Seven checks. Every time. Protocol-level. Immutable.
            </p>
          </div>
          <div style={{ animation:"fadeUp .65s ease .24s both" }}>
            <div style={{ display:"flex",gap:12,flexWrap:"wrap",marginBottom:60 }}>
              <Link href="/portal" style={{ fontFamily:D.sans,fontSize:"14px",fontWeight:600,background:D.indigo,color:"#fff",padding:"14px 32px",transition:"all .15s",letterSpacing:"-.01em" }}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background=D.indigoDk;el.style.transform="translateY(-1px)";}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background=D.indigo;el.style.transform="";}}
              >Access Vaults →</Link>
              <Link href="/admin" style={{ fontFamily:D.sans,fontSize:"14px",fontWeight:500,color:D.ice,border:"1px solid rgba(232,238,246,0.22)",padding:"14px 32px",transition:"all .15s",background:"rgba(232,238,246,0.06)",letterSpacing:"-.01em" }}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor="rgba(232,238,246,0.40)";el.style.background="rgba(232,238,246,0.12)";}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor="rgba(232,238,246,0.22)";el.style.background="rgba(232,238,246,0.06)";}}
              >Admin Console</Link>
            </div>
          </div>
          <div style={{ animation:"fadeUp .65s ease .32s both" }}>
            <div style={{ display:"flex",gap:0,paddingTop:24,borderTop:"1px solid rgba(232,238,246,0.10)" }}>
              {[["8 / 8","Tests passing"],["7","Compliance checks"],["< 400ms","Gate validation"],["FATF R.16","Aligned"]].map(([n,l],i)=>(
                <div key={l} style={{ paddingRight:32,marginRight:32,borderRight:i<3?"1px solid rgba(232,238,246,0.10)":"none" }}>
                  <div style={{ fontFamily:D.sans,fontSize:"19px",fontWeight:700,color:D.ice,letterSpacing:"-.02em" }}>{n}</div>
                  <div style={{ fontFamily:D.mono,fontSize:"11px",color:"rgba(232,238,246,0.35)",letterSpacing:".08em",marginTop:5 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          §01 THE GAP
          LEFT: text + comparison  |  RIGHT: dark image panel (padlock)
      ══════════════════════════════════════════════════════ */}
      <section id="problem" style={{ borderTop:`1px solid ${D.rule}` }}>
        <div style={{ ...SLIDE }}>

          {/* ── TEXT column ── */}
          <div style={{ padding:"88px 6vw 88px 8vw",background:D.bg1,display:"flex",flexDirection:"column",justifyContent:"center" }}>
            <Fade>
              <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".14em",color:D.ink30,textTransform:"uppercase",marginBottom:40 }}>01 — The Gap</div>
              <h2 style={{ fontFamily:D.display,fontSize:"clamp(26px,3vw,46px)",fontWeight:700,lineHeight:1.03,letterSpacing:"-.028em",color:D.ink,marginBottom:22 }}>
                Compliance exists.<br/><span style={{ color:D.indigo }}>DeFi can't read it.</span>
              </h2>
              <p style={{ fontFamily:D.sans,fontSize:"15px",color:D.ink50,lineHeight:1.78,marginBottom:14 }}>
                Banks have spent years building KYC/AML infrastructure. That work lives in internal systems no blockchain can query.
              </p>
              <p style={{ fontFamily:D.sans,fontSize:"15px",fontWeight:600,color:D.ink,lineHeight:1.55,marginBottom:36 }}>
                DeFi vaults can't distinguish a verified institutional investor from a sanctioned wallet.{" "}
                <span style={{ color:D.indigo }}>Compliance has no on-chain address.</span>
              </p>

              {/* WITHOUT / WITH */}
              <div style={{ display:"flex",flexDirection:"column",gap:3,marginBottom:28 }}>
                <div style={{ padding:"18px 22px",background:D.red10,border:"1px solid rgba(122,31,31,0.16)" }}>
                  <div style={{ fontFamily:D.mono,fontSize:"10px",letterSpacing:".12em",color:D.red,marginBottom:12 }}>WITHOUT LEYFIS</div>
                  {["KYC data locked in spreadsheets and PDFs","Vault open to any wallet — verified or not","One sanctioned wallet exposes the entire institution","Compliance team reviews every transaction manually"].map((t,i)=>(
                    <div key={i} style={{ display:"flex",gap:10,padding:"6px 0",borderBottom:"1px solid rgba(220,38,38,0.08)" }}>
                      <span style={{ color:D.red,fontSize:12,flexShrink:0 }}>✕</span>
                      <span style={{ fontFamily:D.sans,fontSize:12,color:D.ink50,lineHeight:1.65 }}>{t}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding:"18px 22px",background:D.teal10,border:`1px solid ${D.teal20}` }}>
                  <div style={{ fontFamily:D.mono,fontSize:"10px",letterSpacing:".12em",color:D.teal,marginBottom:12 }}>WITH LEYFIS</div>
                  {["Signed attestations on Solana — always current, always on-chain","Every wallet checked automatically before execution","Sanctioned wallets blocked at the protocol layer","Audit log written on-chain. No manual review. No exceptions."].map((t,i)=>(
                    <div key={i} style={{ display:"flex",gap:10,padding:"6px 0",borderBottom:`1px solid rgba(13,107,79,0.1)` }}>
                      <span style={{ color:D.teal,fontSize:12,flexShrink:0 }}>✓</span>
                      <span style={{ fontFamily:D.sans,fontSize:12,color:D.ink70,lineHeight:1.65 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agentic callout */}
              <div style={{ padding:"20px 24px",background:D.indigo12,border:`1px solid ${D.indigo20}`,display:"flex",gap:18,alignItems:"flex-start" }}>
                <div style={{ flexShrink:0,width:36,height:36,background:D.indigo20,display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.indigo} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73C11.4 5.39 11 4.74 11 4a2 2 0 0 1 2-2z"/>
                    <circle cx="7.5" cy="14.5" r="1"/><circle cx="16.5" cy="14.5" r="1"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontFamily:D.mono,fontSize:"10px",letterSpacing:".10em",color:D.indigo,marginBottom:7,textTransform:"uppercase" }}>New · Leyfis for the Agentic Economy</div>
                  <h3 style={{ fontFamily:D.display,fontSize:"14px",fontWeight:700,color:D.ink,marginBottom:7 }}>Your AI agents inherit your compliance tier.</h3>
                  <p style={{ fontFamily:D.sans,fontSize:"12px",color:D.ink50,lineHeight:1.7 }}>Leyfis verifies AI agents exactly as it verifies your human traders — on-chain, before execution, with a full immutable audit trail.</p>
                </div>
              </div>
            </Fade>
          </div>

          {/* ── IMAGE panel: padlock (compliance locked from DeFi) ── */}
          <div style={{ position:"relative",background:D.bgDark,overflow:"hidden",minHeight:560 }}>
            <div style={{ position:"absolute",inset:0,backgroundImage:"url('/img-gap.png')",backgroundSize:"contain",backgroundRepeat:"no-repeat",backgroundPosition:"center",opacity:0.72 }}/>
            <div style={{ position:"absolute",inset:0,background:"linear-gradient(to right,rgba(10,15,28,0.55) 0%,transparent 30%,transparent 70%,rgba(10,15,28,0.40) 100%),linear-gradient(to bottom,rgba(10,15,28,0.40) 0%,transparent 18%,transparent 82%,rgba(10,15,28,0.45) 100%)" }}/>
            <div style={{ position:"absolute",bottom:40,left:40,right:40 }}>
              <div style={{ fontFamily:D.mono,fontSize:"10px",letterSpacing:".12em",color:"rgba(232,238,246,0.30)",textTransform:"uppercase" }}>Compliance Infrastructure</div>
              <div style={{ fontFamily:D.sans,fontSize:"13px",fontWeight:500,color:"rgba(232,238,246,0.50)",marginTop:6 }}>On-chain credentials. Permissioned access.</div>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          §02 THE GATE
          LEFT: dark image panel (doc+checkmark)  |  RIGHT: text + 4-steps + 7-checks
      ══════════════════════════════════════════════════════ */}
      <section id="how" style={{ borderTop:`1px solid ${D.rule}` }}>
        <div style={{ ...SLIDE }}>

          {/* ── IMAGE panel: document + checkmark (attestation / gate) ── */}
          <div style={{ position:"relative",background:D.bgDark,overflow:"hidden",minHeight:600 }}>
            <div style={{ position:"absolute",inset:0,backgroundImage:"url('/img-gate.png')",backgroundSize:"contain",backgroundRepeat:"no-repeat",backgroundPosition:"center",opacity:0.68 }}/>
            <div style={{ position:"absolute",inset:0,background:"linear-gradient(to right,rgba(10,15,28,0.40) 0%,transparent 30%,transparent 70%,rgba(10,15,28,0.55) 100%),linear-gradient(to bottom,rgba(10,15,28,0.35) 0%,transparent 18%,transparent 82%,rgba(10,15,28,0.40) 100%)" }}/>
            {/* Eyebrow badge */}
            <div style={{ position:"absolute",top:40,left:40 }}>
              <div style={{ display:"inline-flex",alignItems:"center",gap:8,background:"rgba(27,79,216,0.22)",border:"1px solid rgba(27,79,216,0.38)",padding:"5px 14px" }}>
                <span style={{ width:5,height:5,borderRadius:"50%",background:D.indigo,flexShrink:0 }}/>
                <span style={{ fontFamily:D.mono,fontSize:"10px",color:"rgba(100,140,255,0.90)",letterSpacing:".10em" }}>SEVEN CHECKS · EVERY CALL</span>
              </div>
            </div>
            {/* Gate flow overlay */}
            <div style={{ position:"absolute",bottom:40,left:40,right:40 }}>
              {[
                { f:"Wallet →",    l:"Leyfis Gate",  c:"rgba(100,140,255,0.9)" },
                { f:"Gate →",      l:"7 Checks",     c:"rgba(212,140,0,0.9)"   },
                { f:"PASS →",      l:"Vault (CPI)",  c:"rgba(30,160,100,0.9)"  },
                { f:"FAIL →",      l:"Rejected",     c:"rgba(200,60,60,0.9)"   },
              ].map(({f,l,c},i)=>(
                <div key={i} style={{ display:"flex",alignItems:"center",gap:14,padding:"9px 16px",marginBottom:2,background:"rgba(10,15,28,0.75)",border:"1px solid rgba(232,238,246,0.07)",backdropFilter:"blur(6px)" }}>
                  <span style={{ fontFamily:D.mono,fontSize:"11px",color:"rgba(232,238,246,0.35)",minWidth:62 }}>{f}</span>
                  <span style={{ fontFamily:D.mono,fontSize:"12px",color:c,fontWeight:500 }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── TEXT column ── */}
          <div style={{ padding:"88px 8vw 72px 6vw",background:D.bg2,display:"flex",flexDirection:"column",justifyContent:"center" }}>
            <Fade>
              <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".14em",color:D.ink30,textTransform:"uppercase",marginBottom:36 }}>02 — The Gate</div>
              <h2 style={{ fontFamily:D.display,fontSize:"clamp(26px,3vw,46px)",fontWeight:700,lineHeight:1.03,letterSpacing:"-.028em",color:D.ink,marginBottom:22 }}>
                Seven checks.<br/>Every time.<br/><span style={{ color:D.indigo }}>No exceptions.</span>
              </h2>
              <p style={{ fontFamily:D.sans,fontSize:"15px",color:D.ink50,lineHeight:1.78,marginBottom:40 }}>
                Every vault interaction passes through the Leyfis Gate first. Seven checks fire in a fixed order. Any failure stops the transaction atomically — no partial state, no side effects. The gate cannot be bypassed.
              </p>

              {/* 4 steps */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:3,marginBottom:32 }}>
                {[
                  { n:"01",t:"Attest",    d:"KYC provider issues a signed credential. Tier, jurisdiction, expiry. One transaction. Immutable." },
                  { n:"02",t:"Gate",      d:"Every vault interaction hits the Gate first. Seven checks fire in order. Any failure stops the transaction." },
                  { n:"03",t:"Authorize", d:"All checks pass. Leyfis CPIs to the vault. Atomic. Invisible to compliant users." },
                  { n:"04",t:"Audit",     d:"Every outcome — approved or denied — writes an immutable AuditEntry on-chain." },
                ].map(({n,t,d})=>(
                  <div key={n} style={{ padding:"18px",border:`1px solid ${D.rule}`,background:D.bg1,transition:"all .2s",cursor:"default" }}
                    onMouseEnter={onHover} onMouseLeave={onLeave}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                      <span style={{ fontFamily:D.mono,fontSize:"10px",color:D.ink15 }}>{n}</span>
                      <span style={{ fontFamily:D.display,fontSize:"14px",fontWeight:700,color:D.ink }}>{t}</span>
                    </div>
                    <p style={{ fontFamily:D.sans,fontSize:"12px",color:D.ink50,lineHeight:1.7 }}>{d}</p>
                  </div>
                ))}
              </div>

              {/* 7 checks */}
              <div style={{ border:`1px solid ${D.rule}`,overflow:"hidden" }}>
                <div style={{ fontFamily:D.mono,fontSize:"10px",letterSpacing:".10em",color:D.ink30,padding:"10px 16px",borderBottom:`1px solid ${D.rule}`,textTransform:"uppercase",background:D.bg1 }}>
                  7 Checks — Enforced in This Order
                </div>
                {[
                  ["01","Gate paused",        "GatePaused"],
                  ["02","Attestation exists", "NoAttestation"],
                  ["03","Not revoked",        "AttestationRevoked"],
                  ["04","Not expired",        "AttestationExpired"],
                  ["05","Trusted issuer",     "UntrustedIssuer"],
                  ["06","Tier sufficient",    "TierInsufficient"],
                  ["07","Jurisdiction",       "JurisdictionBlocked"],
                ].map(([num,label,code],i)=>(
                  <div key={i} style={{ display:"grid",gridTemplateColumns:"28px 1fr auto",gap:12,padding:"10px 16px",borderBottom:i<6?`1px solid ${D.rule}`:"none",background:D.bg2,alignItems:"center",transition:"background .12s",cursor:"default" }}
                    onMouseEnter={e=>((e.currentTarget as HTMLElement).style.background=D.indigo06)}
                    onMouseLeave={e=>((e.currentTarget as HTMLElement).style.background=D.bg2)}
                  >
                    <span style={{ fontFamily:D.mono,fontSize:"10px",color:D.ink15 }}>{num}</span>
                    <span style={{ fontFamily:D.sans,fontSize:"12px",fontWeight:500,color:D.ink }}>{label}</span>
                    <span style={{ fontFamily:D.mono,fontSize:"10px",color:D.indigo,letterSpacing:".03em" }}>{code}</span>
                  </div>
                ))}
              </div>
            </Fade>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          §03 FIVE STAKEHOLDERS
          Dark header slide: text left | roles image right
          Then full-width bento grid below
      ══════════════════════════════════════════════════════ */}
      <section id="roles" style={{ borderTop:`1px solid ${D.rule}` }}>

        {/* Header slide */}
        <div style={{ ...SLIDE, minHeight:380 }}>

          {/* TEXT side — dark */}
          <div style={{ padding:"72px 6vw 72px 8vw",background:D.bgDark,display:"flex",flexDirection:"column",justifyContent:"center" }}>
            <Fade>
              <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".14em",color:"rgba(232,238,246,0.30)",textTransform:"uppercase",marginBottom:28 }}>03 — Built For</div>
              <h2 style={{ fontFamily:D.display,fontSize:"clamp(28px,3.5vw,54px)",fontWeight:700,lineHeight:1.02,letterSpacing:"-.030em",marginBottom:22 }}>
                <span style={{ color:D.ice }}>One gate.</span><br/>
                <span style={{ color:"#5B8EFF" }}>Five stakeholders.</span><br/>
                <span style={{ color:D.ice }}>All aligned.</span>
              </h2>
              <p style={{ fontFamily:D.sans,fontSize:"15px",color:"rgba(232,238,246,0.50)",lineHeight:1.78,maxWidth:400 }}>
                Each role operates independently with distinct permissions. Leyfis keeps them in sync — on-chain, in real time.
              </p>
            </Fade>
          </div>

          {/* IMAGE panel: people group (stakeholders) */}
          <div style={{ position:"relative",background:D.bgDark,overflow:"hidden" }}>
            <div style={{ position:"absolute",inset:0,backgroundImage:"url('/img-roles.png')",backgroundSize:"contain",backgroundRepeat:"no-repeat",backgroundPosition:"center",opacity:0.65 }}/>
            <div style={{ position:"absolute",inset:0,background:"linear-gradient(to right,rgba(10,15,28,0.60) 0%,transparent 30%,transparent 70%,rgba(10,15,28,0.35) 100%),linear-gradient(to bottom,rgba(10,15,28,0.30) 0%,transparent 20%,transparent 80%,rgba(10,15,28,0.30) 100%)" }}/>
            {/* Role pills */}
            <div style={{ position:"absolute",top:"50%",right:44,transform:"translateY(-50%)",display:"flex",flexDirection:"column",gap:7 }}>
              {[
                { label:"Financial Institutions", color:D.indigo },
                { label:"Vault Operators",        color:D.teal   },
                { label:"KYC Issuers",            color:"#8899BB"},
                { label:"Compliance Auditors",    color:D.amber  },
                { label:"AI Agents",              color:"#5B8EFF"},
              ].map(({label,color})=>(
                <div key={label} style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 14px",background:"rgba(10,15,28,0.75)",border:`1px solid ${color}44`,backdropFilter:"blur(8px)" }}>
                  <div style={{ width:5,height:5,borderRadius:"50%",background:color,flexShrink:0 }}/>
                  <span style={{ fontFamily:D.mono,fontSize:"10px",color:"rgba(232,238,246,0.70)",letterSpacing:".06em" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bento row 1 */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:3,background:D.bg1 }}>
          {[
            { label:"Financial Institutions",color:D.indigo,span:2,
              headline:"Enter DeFi without regulatory exposure.",
              desc:"Deploy capital into on-chain strategies while maintaining full KYC/AML compliance.",
              points:["Enforce access at transaction level","Eliminate sanctioned wallet exposure","Auto-generate regulator-ready audit trails","Align with FATF and MiCA"] },
            { label:"Vault Operators",color:D.teal,span:2,
              headline:"Control who accesses your vault.",
              desc:"Define and enforce compliance rules without touching your existing vault architecture.",
              points:["Set minimum KYC tier per vault","Whitelist trusted KYC issuers","Pause / unpause access in one call","Monitor live gate activity"] },
            { label:"KYC Issuers",color:"#8899BB",span:1,
              headline:"Turn KYC into an on-chain primitive.",
              desc:"Issue verifiable credentials that control access to real financial infrastructure.",
              points:["Issue wallet attestations","Set tiers and expiries","Revoke in real time","View issuance registry"] },
          ].map(({label,color,span,headline,desc,points},i)=>(
            <Fade key={label} delay={i*70} style={{ gridColumn:`span ${span}` }}>
              <div style={{ padding:28,border:`1px solid ${D.rule}`,background:D.bg2,height:"100%",transition:"all .2s",cursor:"default" }}
                onMouseEnter={onHover} onMouseLeave={onLeave}>
                <div style={{ display:"flex",alignItems:"center",gap:9,marginBottom:16 }}>
                  <div style={{ width:7,height:7,borderRadius:"50%",background:color }}/>
                  <span style={{ fontFamily:D.mono,fontSize:"10px",letterSpacing:".10em",color,textTransform:"uppercase" }}>{label}</span>
                </div>
                <h3 style={{ fontFamily:D.display,fontSize:"clamp(13px,1.4vw,17px)",fontWeight:700,lineHeight:1.15,color:D.ink,marginBottom:9 }}>{headline}</h3>
                <p style={{ fontFamily:D.sans,fontSize:"12px",color:D.ink50,lineHeight:1.7,marginBottom:16 }}>{desc}</p>
                {points.map((p,j)=>(
                  <div key={j} style={{ display:"flex",gap:10,alignItems:"flex-start",padding:"7px 0",borderBottom:`1px solid ${D.rule}` }}>
                    <div style={{ width:4,height:4,borderRadius:"50%",background:color,flexShrink:0,marginTop:5 }}/>
                    <span style={{ fontFamily:D.sans,fontSize:"12px",color:D.ink50,lineHeight:1.6 }}>{p}</span>
                  </div>
                ))}
              </div>
            </Fade>
          ))}
        </div>

        {/* Bento row 2 */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:3,marginTop:3,background:D.bg1 }}>
          {[
            { label:"Compliance Auditors",color:D.amber,span:3,bg:D.bg2,border:D.rule,
              headline:"Read-only access to everything.",
              desc:"Filter the audit log, monitor denials in real-time, and export FATF R.16 CSV reports for regulators and executive teams.",
              points:["Filter by date, outcome, wallet, tier","Export FATF R.16 CSV in one click","Monitor live gate activity feed","Read-only — zero write permissions, ever"] },
            { label:"AI Agents & Autonomous Systems",color:D.indigo,span:2,bg:D.indigo12,border:D.indigo20,
              headline:"Permissioned autonomy.",
              desc:"In the agentic economy, AI systems execute on behalf of institutions. Leyfis verifies each agent with the same rigor as human traders — on-chain, before execution.",
              points:["Agents inherit institutional attestation tier","Every agent interaction fully audited","Full compliance trail, zero blind spots","Same 7 checks on every agent call"] },
          ].map(({label,color,span,bg,border,headline,desc,points},i)=>(
            <Fade key={label} delay={i*80+200} style={{ gridColumn:`span ${span}` }}>
              <div style={{ padding:28,border:`1px solid ${border}`,background:bg,height:"100%",transition:"all .2s",cursor:"default" }}
                onMouseEnter={onHover} onMouseLeave={onLeave}>
                <div style={{ display:"flex",alignItems:"center",gap:9,marginBottom:16 }}>
                  <div style={{ width:7,height:7,borderRadius:"50%",background:color }}/>
                  <span style={{ fontFamily:D.mono,fontSize:"10px",letterSpacing:".10em",color,textTransform:"uppercase" }}>{label}</span>
                </div>
                <h3 style={{ fontFamily:D.display,fontSize:"clamp(13px,1.4vw,17px)",fontWeight:700,lineHeight:1.15,color:D.ink,marginBottom:9 }}>{headline}</h3>
                <p style={{ fontFamily:D.sans,fontSize:"12px",color:D.ink50,lineHeight:1.7,marginBottom:16 }}>{desc}</p>
                <div style={{ display:"grid",gridTemplateColumns:span===3?"1fr 1fr":"1fr",gap:0 }}>
                  {points.map((p,j)=>(
                    <div key={j} style={{ display:"flex",gap:10,alignItems:"flex-start",padding:"7px 0",borderBottom:`1px solid ${D.rule}` }}>
                      <div style={{ width:4,height:4,borderRadius:"50%",background:color,flexShrink:0,marginTop:5 }}/>
                      <span style={{ fontFamily:D.sans,fontSize:"12px",color:D.ink50,lineHeight:1.6 }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Fade>
          ))}
        </div>

      </section>

      {/* ══════════════════════════════════════════════════════
          §04 MCP — text left | terminal right  (unchanged)
      ══════════════════════════════════════════════════════ */}
      <section id="mcp" style={{ padding:"96px 8vw",borderTop:`1px solid ${D.rule}`,background:D.bg }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8vw",alignItems:"center" }}>
          <Fade>
            <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".14em",color:D.ink30,textTransform:"uppercase",marginBottom:14 }}>04 — Natural Language Operations</div>
            <h2 style={{ fontFamily:D.display,fontSize:"clamp(24px,3.2vw,44px)",fontWeight:700,lineHeight:1.05,letterSpacing:"-.025em",color:D.ink,marginBottom:22 }}>
              Leyfis speaks<br/><span style={{ color:D.indigo }}>natural language.</span>
            </h2>
            <p style={{ fontFamily:D.sans,fontSize:"16px",color:D.ink50,lineHeight:1.75,marginBottom:32 }}>
              Claude Desktop connects directly to the Leyfis protocol via MCP. Compliance operators configure vaults, query audit logs, and generate regulatory reports in plain English — no CLI, no code.
            </p>
            <div style={{ display:"flex",flexDirection:"column",gap:2,marginBottom:28 }}>
              {["Pause and unpause gate access","Query audit log and filter by outcome","Issue and revoke on-chain attestations","Export FATF R.16 compliance reports","Update vault config and trusted issuers"].map((t,i)=>(
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
          <Fade delay={100}><McpTerminal/></Fade>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          §05 THE AUDIT
          LEFT: text + stats  |  RIGHT: dark image panel (pie chart)
          Then full-width audit feed
      ══════════════════════════════════════════════════════ */}
      <section id="audit" style={{ borderTop:`1px solid ${D.rule}` }}>
        <div style={{ ...SLIDE, minHeight:520 }}>

          {/* ── TEXT column ── */}
          <div style={{ padding:"88px 6vw 72px 8vw",background:D.bg1,display:"flex",flexDirection:"column",justifyContent:"center" }}>
            <Fade>
              <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".14em",color:D.ink30,textTransform:"uppercase",marginBottom:36 }}>05 — The Audit is Public</div>
              <h2 style={{ fontFamily:D.display,fontSize:"clamp(26px,3vw,46px)",fontWeight:700,lineHeight:1.03,letterSpacing:"-.028em",color:D.ink,marginBottom:22 }}>
                Every decision is on-chain.<br/><span style={{ color:D.teal }}>Nothing is hidden.</span>
              </h2>
              <p style={{ fontFamily:D.sans,fontSize:"15px",color:D.ink50,lineHeight:1.78,marginBottom:40 }}>
                Every gate call — approved or denied — writes an immutable AuditEntry to Solana. Independently verifiable. Never mutable. Readable by anyone, including regulators.
              </p>
              <div style={{ display:"flex",flexDirection:"column",gap:3 }}>
                {[
                  ["Audit entries written","on every gate call"],
                  ["Mutation possible","never"],
                  ["FATF R.16 export","one click"],
                  ["Verification","Solana Explorer"],
                ].map(([label,value])=>(
                  <div key={label} style={{ display:"flex",justifyContent:"space-between",padding:"13px 18px",border:`1px solid ${D.rule}`,background:D.bg2 }}>
                    <span style={{ fontFamily:D.sans,fontSize:"13px",color:D.ink50 }}>{label}</span>
                    <span style={{ fontFamily:D.mono,fontSize:"12px",color:D.ink,fontWeight:500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </Fade>
          </div>

          {/* ── IMAGE panel: pie chart (aggregated audit data) ── */}
          <div style={{ position:"relative",background:D.bgDark,overflow:"hidden",minHeight:480 }}>
            <div style={{ position:"absolute",inset:0,backgroundImage:"url('/img-audit.png')",backgroundSize:"contain",backgroundRepeat:"no-repeat",backgroundPosition:"center",opacity:0.70 }}/>
            <div style={{ position:"absolute",inset:0,background:"linear-gradient(to right,rgba(10,15,28,0.50) 0%,transparent 30%,transparent 70%,rgba(10,15,28,0.40) 100%),linear-gradient(to bottom,rgba(10,15,28,0.35) 0%,transparent 18%,transparent 82%,rgba(10,15,28,0.40) 100%)" }}/>
            {/* Stats overlay */}
            <div style={{ position:"absolute",top:48,right:48 }}>
              <div style={{ padding:"18px 22px",background:"rgba(10,15,28,0.82)",border:"1px solid rgba(232,238,246,0.08)",backdropFilter:"blur(12px)" }}>
                <div style={{ fontFamily:D.mono,fontSize:"10px",letterSpacing:".10em",color:"rgba(232,238,246,0.30)",marginBottom:12,textTransform:"uppercase" }}>Live · Devnet</div>
                {[
                  { label:"Approved", value:"87%", color:D.teal   },
                  { label:"Denied",   value:"13%", color:D.red    },
                  { label:"Entries",  value:"∞",   color:D.indigo },
                ].map(({label,value,color})=>(
                  <div key={label} style={{ display:"flex",justifyContent:"space-between",gap:24,marginBottom:7 }}>
                    <span style={{ fontFamily:D.mono,fontSize:"11px",color:"rgba(232,238,246,0.45)" }}>{label}</span>
                    <span style={{ fontFamily:D.mono,fontSize:"13px",color,fontWeight:500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ position:"absolute",bottom:36,left:40 }}>
              <div style={{ fontFamily:D.mono,fontSize:"10px",letterSpacing:".10em",color:"rgba(232,238,246,0.28)",textTransform:"uppercase" }}>Immutable · On-Chain · FATF R.16</div>
            </div>
          </div>

        </div>

        {/* Audit feed — full width */}
        <div style={{ padding:"48px 8vw 72px",background:D.bg1,borderTop:`1px solid ${D.rule}` }}>
          <Fade>
            <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".12em",color:D.ink30,textAlign:"center",marginBottom:24,textTransform:"uppercase" }}>
              Live Gate Activity — Append-Only · Never Mutable
            </div>
            <AuditFeed/>
          </Fade>
        </div>
      </section>

      {/* ── TECH STRIP ──────────────────────────────────────────── */}
      <section style={{ padding:"36px 8vw",borderTop:`1px solid ${D.rule}`,background:D.bg2 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:24 }}>
          {[
            ["Blockchain","Solana devnet"],
            ["Smart contracts","Rust + Anchor v0.30"],
            ["Credentials","SAS Attestation Service"],
            ["RPC","Helius"],
            ["AI interface","Claude MCP · 12 tools"],
            ["Test coverage","8 / 8 passing"],
          ].map(([label,value])=>(
            <div key={label} style={{ textAlign:"center" }}>
              <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".10em",color:D.ink30,textTransform:"uppercase",marginBottom:5 }}>{label}</div>
              <div style={{ fontFamily:D.sans,fontSize:"13px",fontWeight:500,color:D.ink }}>{value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA — hero-style dark with bank + shield blended ── */}
      <section style={{ position:"relative",overflow:"hidden",background:D.bgDark,padding:"140px 8vw" }}>
        {/* Bank building — left blend */}
        <div style={{ position:"absolute",inset:0,backgroundImage:"url('/img-cta.png')",backgroundSize:"contain",backgroundRepeat:"no-repeat",backgroundPosition:"left center",opacity:0.30,pointerEvents:"none" }}/>
        {/* Shield/identity — right blend */}
        <div style={{ position:"absolute",inset:0,backgroundImage:"url('/img-identity.png')",backgroundSize:"contain",backgroundRepeat:"no-repeat",backgroundPosition:"right center",opacity:0.28,pointerEvents:"none" }}/>
        {/* Indigo radial center glow */}
        <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse at center,rgba(27,79,216,0.35) 0%,rgba(10,15,28,0.68) 55%,rgba(10,15,28,0.94) 100%)",pointerEvents:"none" }}/>
        {/* Grid texture */}
        <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.028) 1px,transparent 1px)",backgroundSize:"60px 60px",pointerEvents:"none" }}/>

        <Fade>
          <div style={{ position:"relative",zIndex:1,textAlign:"center",maxWidth:780,margin:"0 auto" }}>
            <div style={{ fontFamily:D.mono,fontSize:"11px",letterSpacing:".14em",color:"rgba(232,238,246,0.28)",textTransform:"uppercase",marginBottom:28 }}>Get Started</div>
            <h2 style={{ fontFamily:D.display,fontSize:"clamp(32px,4.8vw,68px)",fontWeight:700,lineHeight:.97,letterSpacing:"-.030em",color:"#fff",marginBottom:28 }}>
              Your institution's next move<br/>into DeFi starts<br/><span style={{ color:"#5B8EFF" }}>with a gate.</span>
            </h2>
            <p style={{ fontFamily:D.sans,fontSize:"18px",color:"rgba(232,238,246,0.52)",lineHeight:1.75,maxWidth:440,margin:"0 auto 52px" }}>
              Verify compliance. Enforce access. Audit everything.
            </p>
            <div style={{ display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap" }}>
              <Link href="/portal" style={{ fontFamily:D.sans,fontSize:"15px",fontWeight:600,background:"#fff",color:D.indigo,padding:"16px 44px",transition:"all .15s" }}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.transform="translateY(-2px)";el.style.boxShadow="0 8px 32px rgba(27,79,216,0.30)";}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.transform="";el.style.boxShadow="";}}
              >Access Vaults →</Link>
              <Link href="/admin" style={{ fontFamily:D.sans,fontSize:"15px",fontWeight:500,color:"rgba(255,255,255,.88)",padding:"16px 44px",border:"1px solid rgba(255,255,255,.22)",transition:"all .15s" }}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background="rgba(255,255,255,.08)";el.style.borderColor="rgba(255,255,255,.40)";}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background="transparent";el.style.borderColor="rgba(255,255,255,.22)";}}
              >Open Admin Console</Link>
            </div>
          </div>
        </Fade>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
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
          {([["Vaults","/portal"],["Admin","/admin"],["GitHub","https://github.com/thinkDecade/leyfis"],["Explorer",`https://explorer.solana.com/address/Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP?cluster=devnet`]] as [string,string][]).map(([l,h])=>(
            <a key={l} href={h} target={h.startsWith("http")?"_blank":undefined} rel="noreferrer"
              style={{ fontFamily:D.sans,fontSize:"13px",fontWeight:500,color:D.ink30,transition:"color .15s" }}
              onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color=D.ink70)}
              onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color=D.ink30)}
            >{l}</a>
          ))}
        </div>
        <span style={{ fontFamily:D.mono,fontSize:"11px",color:D.ink30 }}>Gate: Cskp4z…QZVP · Solana devnet</span>
      </footer>
    </>
  );
}
