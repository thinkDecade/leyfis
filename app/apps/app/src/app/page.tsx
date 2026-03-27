"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const RiveGate = dynamic(() => import("./RiveGate"), { ssr: false });

// ─── Reveal — fires immediately if already in view ────────────────────────────
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect(); } },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    // Also fire immediately if already visible
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) setV(true);
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
      transform: v ? "none" : "translateY(20px)",
      transition: `opacity 0.6s ${delay}ms, transform 0.6s ${delay}ms`,
      ...style,
    }}>{children}</div>
  );
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const D = {
  bg:      "#000000",
  bg1:     "#060606",
  bg2:     "#0A0A0A",
  ice:     "#E8EEF6",
  ice50:   "rgba(232,238,246,0.5)",
  ice30:   "rgba(232,238,246,0.3)",
  ice15:   "rgba(232,238,246,0.15)",
  ice08:   "rgba(232,238,246,0.08)",
  blue:    "#1B4FD8",
  blue20:  "rgba(27,79,216,0.2)",
  teal:    "#0F6E56",
  teal10:  "rgba(15,110,86,0.1)",
  red:     "#7A1F1F",
  red10:   "rgba(122,31,31,0.1)",
  rule:    "rgba(232,238,246,0.07)",
  mono:    "'DM Mono', monospace",
  serif:   "'EB Garamond', Georgia, serif",
  display: "'Unbounded', sans-serif",
};

// ─── Gate animation CSS ────────────────────────────────────────────────────────
function Gate({ approved, size = 200 }: { approved: boolean; size?: number }) {
  const w = size * 0.1;
  const h = size;
  const gap = size * 0.5;
  const total = gap + w * 2;
  const c = approved ? D.teal : D.blue;
  return (
    <div style={{ position: "relative", width: total, height: h, margin: "0 auto" }}>
      <style>{`
        @keyframes gatePulse { 0%,100%{opacity:0.7} 50%{opacity:1} }
        @keyframes scanDown { 0%{top:${w}px;opacity:0.6} 80%{opacity:0.3} 100%{top:${h - 4}px;opacity:0} }
        @keyframes popIn { from{transform:scale(0.5);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes ringOut { from{transform:translate(-50%,-50%) scale(0.6);opacity:0.6} to{transform:translate(-50%,-50%) scale(2);opacity:0} }
      `}</style>
      {/* Left pillar */}
      <div style={{ position:"absolute", left:0, top:0, width:w, height:h, background:c, borderRadius:"1px", animation:"gatePulse 2.5s infinite", transition:"background 0.8s" }}/>
      {/* Right pillar */}
      <div style={{ position:"absolute", right:0, top:0, width:w, height:h, background:c, borderRadius:"1px", animation:"gatePulse 2.5s infinite 0.4s", transition:"background 0.8s" }}/>
      {/* Lintel */}
      <div style={{ position:"absolute", left:0, top:0, width:total, height:w, background:c, borderRadius:"1px", animation:"gatePulse 2.5s infinite 0.2s", transition:"background 0.8s" }}/>
      {/* Interior */}
      {!approved && (
        <div style={{ position:"absolute", left:w+2, right:w+2, top:w, height:"2px", background:`rgba(27,79,216,0.5)`, animation:"scanDown 1.8s ease-in infinite" }}/>
      )}
      {approved && (
        <>
          <div style={{ position:"absolute", left:"50%", top:"55%", width:size*0.28, height:size*0.28, borderRadius:"50%", border:`1.5px solid ${D.teal}`, animation:"ringOut 1.5s ease-out infinite" }}/>
          <div style={{ position:"absolute", left:"50%", top:"55%", transform:"translate(-50%,-50%)", fontFamily:D.display, fontSize:size*0.22, fontWeight:900, color:D.teal, animation:"popIn 0.4s ease", lineHeight:1 }}>✓</div>
        </>
      )}
    </div>
  );
}

// ─── Audience section ─────────────────────────────────────────────────────────
function AudienceSection({ id, index, label, heading, pain, solution, outcomes, stat, statLabel, cta, href, accent, flip }: {
  id: string; index: string; label: string; heading: string; pain: string; solution: string;
  outcomes: string[]; stat: string; statLabel: string; cta: string; href: string; accent: string; flip?: boolean;
}) {
  const { ref, v } = useInView(0.05);
  return (
    <section id={id} ref={ref} style={{ borderTop:`1px solid ${D.rule}`, padding:"96px 10vw", background: D.bg1 }}>
      <div style={{ display:"grid", gridTemplateColumns: flip ? "1fr 1fr" : "1fr 1fr", gap:"6vw", alignItems:"start" }}>
        {/* Left */}
        <div style={{ order: flip ? 2 : 1 }}>
          <div style={{
            opacity: v ? 1 : 0, transform: v ? "none" : "translateY(16px)",
            transition: "opacity 0.5s 0ms, transform 0.5s 0ms",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:"16px", marginBottom:"32px" }}>
              <span style={{ fontFamily:D.mono, fontSize:"9px", letterSpacing:"0.18em", color:D.ice30 }}>{index}</span>
              <span style={{ fontFamily:D.mono, fontSize:"9px", letterSpacing:"0.14em", color:accent, textTransform:"uppercase" }}>{label}</span>
            </div>
            <h2 style={{ fontFamily:D.display, fontSize:"clamp(24px,3.5vw,44px)", fontWeight:900, lineHeight:1.0, letterSpacing:"-0.02em", color:D.ice, marginBottom:"40px" }}>
              {heading}
            </h2>
          </div>

          {/* Pain + Solution */}
          <div style={{
            opacity: v ? 1 : 0, transform: v ? "none" : "translateY(16px)",
            transition: "opacity 0.5s 100ms, transform 0.5s 100ms",
          }}>
            <div style={{ marginBottom:"32px" }}>
              <div style={{ fontFamily:D.mono, fontSize:"8px", letterSpacing:"0.16em", color:D.red, textTransform:"uppercase", marginBottom:"10px" }}>The Problem</div>
              <p style={{ fontFamily:D.mono, fontSize:"13px", color:D.ice50, lineHeight:1.85, fontWeight:300 }}>{pain}</p>
            </div>
            <div style={{ marginBottom:"40px" }}>
              <div style={{ fontFamily:D.mono, fontSize:"8px", letterSpacing:"0.16em", color:D.teal, textTransform:"uppercase", marginBottom:"10px" }}>With Leyfis</div>
              <p style={{ fontFamily:D.mono, fontSize:"13px", color:D.ice, lineHeight:1.85, fontWeight:300 }}>{solution}</p>
            </div>
          </div>

          {/* Outcomes */}
          <div style={{
            opacity: v ? 1 : 0, transform: v ? "none" : "translateY(16px)",
            transition: "opacity 0.5s 180ms, transform 0.5s 180ms",
          }}>
            <div style={{ borderTop:`1px solid ${D.rule}`, paddingTop:"24px", marginBottom:"32px" }}>
              {outcomes.map((o, i) => (
                <div key={i} style={{ display:"flex", gap:"14px", alignItems:"flex-start", padding:"10px 0", borderBottom:`1px solid ${D.rule}` }}>
                  <div style={{ width:"4px", height:"4px", borderRadius:"50%", background:accent, flexShrink:0, marginTop:"7px" }}/>
                  <span style={{ fontFamily:D.mono, fontSize:"12px", color:D.ice50, lineHeight:1.8, fontWeight:300 }}>{o}</span>
                </div>
              ))}
            </div>
            <Link href={href} style={{
              fontFamily:D.mono, fontSize:"10px", letterSpacing:"0.12em", textTransform:"uppercase",
              color:accent, border:`1px solid ${accent}`, padding:"11px 24px", display:"inline-block",
              textDecoration:"none", transition:"all 0.15s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = accent; (e.currentTarget as HTMLElement).style.color = "#000"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = accent; }}
            >{cta} →</Link>
          </div>
        </div>

        {/* Right — stat */}
        <div style={{
          order: flip ? 1 : 2,
          display:"flex", flexDirection:"column", justifyContent:"flex-start", paddingTop:"64px",
          opacity: v ? 1 : 0, transform: v ? "none" : "translateY(20px)",
          transition: "opacity 0.6s 80ms, transform 0.6s 80ms",
        }}>
          <div style={{ fontFamily:D.display, fontSize:"clamp(72px,10vw,140px)", fontWeight:900, color:accent, lineHeight:0.88, letterSpacing:"-0.04em" }}>
            {stat}
          </div>
          <div style={{ fontFamily:D.mono, fontSize:"10px", letterSpacing:"0.14em", color:D.ice30, marginTop:"14px", textTransform:"uppercase" }}>{statLabel}</div>
          {/* Divider line */}
          <div style={{ width:"40px", height:"1px", background:accent, marginTop:"40px", opacity:0.5 }}/>
        </div>
      </div>
    </section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
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
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Unbounded:wght@400;700;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{background:${D.bg};color:${D.ice};font-family:${D.mono};overflow-x:hidden;-webkit-font-smoothing:antialiased}
        a{color:inherit;text-decoration:none}
        ::selection{background:${D.blue};color:#fff}
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
      `}</style>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav style={{
        position:"fixed", top:0, left:0, right:0, zIndex:100,
        padding:"0 10vw", height:"56px", display:"flex", alignItems:"center", justifyContent:"space-between",
        background:"rgba(0,0,0,0.92)", backdropFilter:"blur(16px)",
        borderBottom:`1px solid ${D.rule}`,
      }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <svg width="20" height="20" viewBox="0 0 56 56" fill="none">
            <rect x="8" y="16" width="7" height="32" fill={D.ice}/>
            <rect x="41" y="16" width="7" height="32" fill={D.ice}/>
            <rect x="8" y="13" width="40" height="6" fill={D.ice}/>
            <rect x="18" y="19" width="20" height="29" fill="#000"/>
            <rect x="18" y="44" width="20" height="1.5" fill={D.blue}/>
          </svg>
          <span style={{ fontFamily:D.display, fontSize:"12px", fontWeight:700, letterSpacing:"0.22em" }}>LEYFIS</span>
        </div>

        {/* Nav links */}
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          {[
            ["#problem","Problem"],
            ["#how","How it works"],
            ["#banks","Banks"],
            ["#operators","Vault Operators"],
            ["#kyc","KYC Providers"],
            ["#regulators","Regulators"],
          ].map(([h,l]) => (
            <a key={h} href={h} style={{ fontFamily:D.mono, fontSize:"9px", letterSpacing:"0.1em", color:D.ice30, padding:"6px 10px", transition:"color 0.15s" }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = D.ice)}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = D.ice30)}
            >{l}</a>
          ))}
          <div style={{ width:"1px", height:"20px", background:D.rule, margin:"0 8px" }}/>
          <Link href="/portal" style={{
            fontFamily:D.mono, fontSize:"9px", letterSpacing:"0.1em", color:D.ice50,
            border:`1px solid ${D.rule}`, padding:"7px 16px", transition:"all 0.15s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.ice30; (e.currentTarget as HTMLElement).style.color = D.ice; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.rule; (e.currentTarget as HTMLElement).style.color = D.ice50; }}
          >Access Vaults</Link>
          <Link href="/admin" style={{
            fontFamily:D.mono, fontSize:"9px", letterSpacing:"0.1em",
            background:D.blue, color:"#fff", padding:"7px 16px",
            display:"flex", alignItems:"center", gap:"7px", transition:"opacity 0.15s",
          }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = "1")}
          >
            <span style={{ width:"5px", height:"5px", borderRadius:"50%", background:D.teal, animation:"blink 2s infinite", flexShrink:0 }}/>
            Admin Console
          </Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ minHeight:"100vh", padding:"120px 10vw 0", display:"flex", flexDirection:"column", justifyContent:"center", position:"relative", overflow:"hidden" }}>
        {/* Grid bg */}
        <div style={{ position:"absolute", inset:0, backgroundImage:`linear-gradient(${D.rule} 1px,transparent 1px),linear-gradient(90deg,${D.rule} 1px,transparent 1px)`, backgroundSize:"80px 80px", pointerEvents:"none" }}/>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8vw", alignItems:"center", position:"relative", zIndex:1 }}>
          {/* Copy */}
          <div style={{ animation:"fadeUp 0.7s ease both" }}>
            <div style={{ fontFamily:D.mono, fontSize:"9px", letterSpacing:"0.2em", color:D.ice30, marginBottom:"28px" }}>
              — COMPLIANCE INFRASTRUCTURE · SOLANA
            </div>
            <h1 style={{ fontFamily:D.display, fontSize:"clamp(40px,6.5vw,88px)", fontWeight:900, lineHeight:0.92, letterSpacing:"-0.025em", marginBottom:"32px" }}>
              <span style={{ display:"block", color:D.ice }}>Institutional</span>
              <span style={{ display:"block", color:D.blue }}>Compliance.</span>
              <span style={{ display:"block", color:D.ice }}>On-Chain.</span>
            </h1>
            <p style={{ fontFamily:D.serif, fontSize:"19px", color:D.ice50, lineHeight:1.7, maxWidth:"380px", marginBottom:"40px", fontStyle:"italic" }}>
              On-chain compliance middleware for institutional DeFi vaults. Verifies KYC/AML attestations before execution.
            </p>
            <div style={{ display:"flex", gap:"12px", flexWrap:"wrap" }}>
              <Link href="/portal" style={{ fontFamily:D.mono, fontSize:"10px", letterSpacing:"0.12em", background:D.blue, color:"#fff", padding:"13px 28px", transition:"opacity 0.15s" }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity="0.85")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity="1")}
              >ACCESS VAULTS →</Link>
              <Link href="/admin" style={{ fontFamily:D.mono, fontSize:"10px", letterSpacing:"0.12em", color:D.ice30, border:`1px solid ${D.rule}`, padding:"13px 28px", transition:"all 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.ice30; (e.currentTarget as HTMLElement).style.color = D.ice; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.rule; (e.currentTarget as HTMLElement).style.color = D.ice30; }}
              >ADMIN CONSOLE</Link>
            </div>
          </div>

          {/* Gate */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"20px", animation:"fadeUp 0.7s ease 0.15s both" }}>
            <Gate approved={approved} size={220} />
            <div style={{ fontFamily:D.mono, fontSize:"9px", letterSpacing:"0.18em", color:approved ? D.teal : D.blue, transition:"color 0.8s" }}>
              {approved ? "ACCESS GRANTED" : "VERIFYING..."}
            </div>
            {/* Live badge */}
            <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"6px 16px", border:`1px solid ${D.rule}`, marginTop:"8px" }}>
              <span style={{ width:"5px", height:"5px", borderRadius:"50%", background:D.teal, animation:"blink 2s infinite" }}/>
              <span style={{ fontFamily:D.mono, fontSize:"9px", letterSpacing:"0.12em", color:D.ice30 }}>DEVNET LIVE · 10 GATE CALLS CONFIRMED</span>
            </div>
          </div>
        </div>

        {/* Ticker */}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, overflow:"hidden", borderTop:`1px solid ${D.rule}`, padding:"11px 0", background:D.bg }}>
          <div style={{ display:"flex", animation:"ticker 22s linear infinite", width:"max-content" }}>
            {[...Array(2)].map((_,i) => (
              <span key={i} style={{ display:"contents" }}>
                {["7 COMPLIANCE CHECKS","FATF R.16 ALIGNED","<400MS VALIDATION","AMINA BANK PILOT","SOLANA DEVNET","8/8 ANCHOR TESTS PASSING","IMMUTABLE AUDIT LOG","FINMA · FCA · MAS READY","TIER-GATED ACCESS"].map((t,j) => (
                  <span key={j} style={{ fontFamily:D.mono, fontSize:"8px", letterSpacing:"0.16em", color:D.ice15, padding:"0 36px", borderRight:`1px solid ${D.rule}`, whiteSpace:"nowrap" }}>{t}</span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM ──────────────────────────────────────────────────────── */}
      <section id="problem" style={{ padding:"96px 10vw", borderTop:`1px solid ${D.rule}` }}>
        <Fade>
          <div style={{ fontFamily:D.mono, fontSize:"8px", letterSpacing:"0.2em", color:D.ice30, marginBottom:"48px" }}>/01 THE GAP</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6vw", alignItems:"start" }}>
            {/* Left — statement */}
            <div>
              <h2 style={{ fontFamily:D.display, fontSize:"clamp(24px,3.5vw,44px)", fontWeight:900, lineHeight:1.0, letterSpacing:"-0.02em", color:D.ice, marginBottom:"28px" }}>
                Compliance exists.<br/>DeFi can't read it.
              </h2>
              <p style={{ fontFamily:D.serif, fontSize:"18px", color:D.ice50, lineHeight:1.75, marginBottom:"28px", fontStyle:"italic" }}>
                Banks have spent years building KYC/AML infrastructure. That work lives in internal systems no blockchain can query. DeFi vaults can't tell a verified institutional investor from a sanctioned wallet.
              </p>
              <p style={{ fontFamily:D.display, fontSize:"15px", fontWeight:700, color:D.ice, lineHeight:1.4 }}>
                The problem is not your compliance team.{" "}
                <span style={{ color:D.blue }}>The problem is that compliance has no on-chain address.</span>
              </p>
            </div>

            {/* Right — contrast */}
            <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
              <div style={{ padding:"24px 28px", background:D.red10, border:`1px solid rgba(122,31,31,0.2)` }}>
                <div style={{ fontFamily:D.mono, fontSize:"8px", letterSpacing:"0.16em", color:"rgba(200,80,80,0.8)", marginBottom:"16px" }}>TODAY — WITHOUT LEYFIS</div>
                {["KYC data locked in spreadsheets and PDFs","Vault open to any wallet, verified or not","One sanctioned wallet = institution-wide exposure","Compliance team manually reviews every transaction"].map((t,i) => (
                  <div key={i} style={{ display:"flex", gap:"10px", padding:"7px 0", borderBottom:`1px solid rgba(122,31,31,0.1)` }}>
                    <span style={{ color:"rgba(200,80,80,0.6)", fontSize:"11px", flexShrink:0, marginTop:"1px" }}>✕</span>
                    <span style={{ fontFamily:D.mono, fontSize:"12px", color:D.ice30, lineHeight:1.6, fontWeight:300 }}>{t}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding:"24px 28px", background:D.teal10, border:`1px solid rgba(15,110,86,0.2)` }}>
                <div style={{ fontFamily:D.mono, fontSize:"8px", letterSpacing:"0.16em", color:"rgba(30,180,120,0.8)", marginBottom:"16px" }}>WITH LEYFIS</div>
                {["Signed attestations on Solana — immutable, always current","Every wallet checked automatically on every interaction","Sanctioned wallets blocked before the transaction executes","Audit log written on-chain. No manual anything."].map((t,i) => (
                  <div key={i} style={{ display:"flex", gap:"10px", padding:"7px 0", borderBottom:`1px solid rgba(15,110,86,0.1)` }}>
                    <span style={{ color:D.teal, fontSize:"11px", flexShrink:0, marginTop:"1px" }}>✓</span>
                    <span style={{ fontFamily:D.mono, fontSize:"12px", color:D.ice50, lineHeight:1.6, fontWeight:300 }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Fade>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how" style={{ padding:"96px 10vw", borderTop:`1px solid ${D.rule}`, background:D.bg1 }}>
        <Fade>
          <div style={{ fontFamily:D.mono, fontSize:"8px", letterSpacing:"0.2em", color:D.ice30, marginBottom:"48px" }}>/02 THE SOLUTION</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6vw", alignItems:"start", marginBottom:"56px" }}>
            <div>
              <h2 style={{ fontFamily:D.display, fontSize:"clamp(22px,3vw,38px)", fontWeight:900, lineHeight:1.0, color:D.ice, marginBottom:"20px", letterSpacing:"-0.02em" }}>
                A gate between the wallet and the vault.
              </h2>
              <p style={{ fontFamily:D.serif, fontSize:"17px", color:D.ice50, lineHeight:1.75, marginBottom:"32px", fontStyle:"italic" }}>
                Leyfis enforces compliance at the point of execution using cryptographic attestations stored on-chain.
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:"0" }}>
                {["Attestation-based access control","Issuer verification","Tiered permissions","Real-time enforcement"].map((b,i) => (
                  <div key={i} style={{ display:"flex", gap:"12px", alignItems:"center", padding:"11px 0", borderBottom:`1px solid ${D.rule}` }}>
                    <div style={{ width:4, height:4, borderRadius:"50%", background:D.blue, flexShrink:0 }}/>
                    <span style={{ fontFamily:D.mono, fontSize:"12px", color:D.ice, fontWeight:300 }}>{b}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ paddingTop:"8px" }}>
              {/* Attestation flow SVG — inline */}
              <div style={{ fontFamily:D.mono, fontSize:"8px", letterSpacing:"0.14em", color:D.ice30, marginBottom:"16px" }}>EXECUTION FLOW</div>
              <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
                {[
                  { from:"WALLET", arrow:"→", to:"LEYFIS GATE", note:"intercepts every call" },
                  { from:"LEYFIS GATE", arrow:"→", to:"SAS ATTESTATION", note:"reads on-chain credential" },
                  { from:"LEYFIS GATE", arrow:"→", to:"7 CHECKS", note:"tier · issuer · expiry · jurisdiction" },
                  { from:"PASS", arrow:"→", to:"VAULT", note:"CPI forwarded, executes atomically" },
                  { from:"FAIL", arrow:"→", to:"REJECTED", note:"reason code written to audit log" },
                ].map(({from,arrow,to,note},i) => (
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"120px 16px 120px 1fr", gap:"8px", padding:"10px 16px", border:`1px solid ${D.rule}`, background:D.bg2, alignItems:"center" }}>
                    <span style={{ fontFamily:D.mono, fontSize:"9px", color: from === "PASS" ? D.teal : from === "FAIL" ? "rgba(200,80,80,0.7)" : D.blue, letterSpacing:"0.06em" }}>{from}</span>
                    <span style={{ fontFamily:D.mono, fontSize:"10px", color:D.ice30 }}>{arrow}</span>
                    <span style={{ fontFamily:D.mono, fontSize:"9px", color: to === "VAULT" ? D.teal : to === "REJECTED" ? "rgba(200,80,80,0.7)" : D.ice, letterSpacing:"0.06em", fontWeight: to === "VAULT" || to === "REJECTED" ? 500 : 300 }}>{to}</span>
                    <span style={{ fontFamily:D.mono, fontSize:"8px", color:D.ice15, letterSpacing:"0.04em" }}>{note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Fade>

        {/* Steps */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"2px", marginBottom:"64px" }}>
          {[
            { n:"01", t:"Attest", d:"Your KYC provider issues a signed credential to the verified wallet on Solana. Tier, jurisdiction, expiry, KYC reference. One transaction. Immutable." },
            { n:"02", t:"Gate", d:"Every vault interaction hits the Leyfis Gate first. Seven checks fire in fixed order. Any failure stops the transaction. No discretion. No exceptions." },
            { n:"03", t:"Authorize", d:"All seven checks pass. Leyfis CPIs to the vault, forwarding the instruction unchanged. Atomic. No proxy. No custody. Invisible to compliant users." },
            { n:"04", t:"Audit", d:"Every outcome — approved or denied — writes an immutable AuditEntry on-chain. FATF R.16 aligned CSV export on demand. The ledger is the record." },
          ].map(({ n, t, d }, i) => (
            <Fade key={n} delay={i * 60}>
              <div style={{ padding:"32px", border:`1px solid ${D.rule}`, background:D.bg2, height:"100%" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"16px", marginBottom:"16px" }}>
                  <span style={{ fontFamily:D.display, fontSize:"11px", fontWeight:400, color:D.ice15 }}>{n}</span>
                  <span style={{ fontFamily:D.display, fontSize:"18px", fontWeight:700, color:D.ice }}>{t}</span>
                </div>
                <p style={{ fontFamily:D.mono, fontSize:"12px", color:D.ice30, lineHeight:1.8, fontWeight:300 }}>{d}</p>
              </div>
            </Fade>
          ))}
        </div>

        {/* 7 checks — CENTERED */}
        <Fade>
          <div style={{ maxWidth:"800px", margin:"0 auto" }}>
            <div style={{ fontFamily:D.mono, fontSize:"8px", letterSpacing:"0.18em", color:D.ice30, textAlign:"center", marginBottom:"20px" }}>
              7 COMPLIANCE CHECKS — ENFORCED ON EVERY GATE CALL, IN THIS ORDER
            </div>
            <div style={{ border:`1px solid ${D.rule}` }}>
              {[
                ["01","Gate status","GatePaused","Gate is paused by vault operator"],
                ["02","Attestation exists","NoAttestation","No credential found for this wallet"],
                ["03","Not revoked","AttestationRevoked","Credential has been revoked"],
                ["04","Not expired","AttestationExpired","Credential has expired"],
                ["05","Trusted issuer","UntrustedIssuer","Issuer not on approved list"],
                ["06","Tier sufficient","TierInsufficient","Wallet tier below vault minimum"],
                ["07","Jurisdiction eligible","JurisdictionBlocked","Wallet jurisdiction not permitted"],
              ].map(([num, label, code, desc], i) => (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"36px 1fr 1fr 1fr", gap:"16px", padding:"14px 20px", borderBottom: i < 6 ? `1px solid ${D.rule}` : "none", alignItems:"center" }}>
                  <span style={{ fontFamily:D.mono, fontSize:"9px", color:D.ice15 }}>{num}</span>
                  <span style={{ fontFamily:D.mono, fontSize:"12px", color:D.ice }}>{label}</span>
                  <span style={{ fontFamily:D.mono, fontSize:"9px", color:D.blue, letterSpacing:"0.06em" }}>{code}</span>
                  <span style={{ fontFamily:D.mono, fontSize:"10px", color:D.ice30, fontWeight:300 }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </Fade>
      </section>

      {/* ── BUILT FOR EVERY ACTOR ─────────────────────────────────────────── */}
      <section id="for" style={{ padding: "96px 10vw", borderTop: `1px solid ${D.rule}` }}>
        <Fade>
          <div style={{ fontFamily: D.mono, fontSize: "8px", letterSpacing: "0.2em", color: D.ice30, marginBottom: "16px" }}>/03 BUILT FOR EVERY ACTOR IN THE STACK</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "40px", alignItems: "end", marginBottom: "64px" }}>
            <div>
              <h2 style={{ fontFamily: D.display, fontSize: "clamp(22px,3vw,40px)", fontWeight: 900, lineHeight: 1.0, color: D.ice, letterSpacing: "-0.02em", marginBottom: "16px" }}>
                One system.<br/>Four stakeholders.<br/><span style={{ color: D.blue }}>Aligned.</span>
              </h2>
              <p style={{ fontFamily: D.serif, fontSize: "17px", color: D.ice50, lineHeight: 1.75, maxWidth: "520px", fontStyle: "italic" }}>
                Leyfis connects institutions, operators, issuers, and users — enforcing compliance without breaking execution.
              </p>
            </div>
            <div style={{ fontFamily: D.mono, fontSize: "9px", color: D.ice30, letterSpacing: "0.12em", textAlign: "right", whiteSpace: "nowrap" }}>
              Each role operates independently.<br/>
              <span style={{ color: D.blue }}>Leyfis ensures they operate in sync.</span>
            </div>
          </div>
        </Fade>

        {/* 2×2 Card grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px" }}>

          {/* ── 1. Financial Institutions ── */}
          <Fade delay={0}>
            <div style={{ padding: "40px", border: `1px solid ${D.rule}`, background: D.bg2, display: "flex", flexDirection: "column", gap: "0" }}>
              {/* Icon + label */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={D.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M8 10v11M12 10v11M16 10v11M20 10v11"/>
                </svg>
                <span style={{ fontFamily: D.mono, fontSize: "8px", letterSpacing: "0.16em", color: D.blue, textTransform: "uppercase" }}>Financial Institutions</span>
              </div>
              {/* Headline */}
              <h3 style={{ fontFamily: D.display, fontSize: "clamp(16px,2vw,22px)", fontWeight: 900, lineHeight: 1.1, color: D.ice, letterSpacing: "-0.01em", marginBottom: "12px" }}>
                Enter DeFi without<br/>regulatory exposure.
              </h3>
              {/* Value */}
              <p style={{ fontFamily: D.serif, fontSize: "15px", color: D.ice50, lineHeight: 1.7, fontStyle: "italic", marginBottom: "24px" }}>
                Deploy capital into on-chain strategies while maintaining full compliance with KYC/AML requirements.
              </p>
              {/* Bullets */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0", marginBottom: "28px", flex: 1 }}>
                {[
                  "Enforce access control at transaction level",
                  "Eliminate exposure to sanctioned or unknown wallets",
                  "Generate regulator-ready audit trails automatically",
                  "Align with FATF and MiCA requirements",
                ].map((b, i) => (
                  <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "9px 0", borderBottom: `1px solid ${D.rule}` }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: D.blue, flexShrink: 0, marginTop: 6 }}/>
                    <span style={{ fontFamily: D.mono, fontSize: "11px", color: D.ice30, lineHeight: 1.7, fontWeight: 300 }}>{b}</span>
                  </div>
                ))}
              </div>
              {/* Outcome */}
              <div style={{ paddingTop: "16px", borderTop: `1px solid rgba(27,79,216,0.2)` }}>
                <span style={{ fontFamily: D.mono, fontSize: "10px", color: D.blue, letterSpacing: "0.06em" }}>
                  → DeFi access becomes deployable, not experimental.
                </span>
              </div>
            </div>
          </Fade>

          {/* ── 2. Vault Operators ── */}
          <Fade delay={80}>
            <div style={{ padding: "40px", border: `1px solid ${D.rule}`, background: D.bg2, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={D.teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
                <span style={{ fontFamily: D.mono, fontSize: "8px", letterSpacing: "0.16em", color: D.teal, textTransform: "uppercase" }}>Vault Operators</span>
              </div>
              <h3 style={{ fontFamily: D.display, fontSize: "clamp(16px,2vw,22px)", fontWeight: 900, lineHeight: 1.1, color: D.ice, letterSpacing: "-0.01em", marginBottom: "12px" }}>
                Control who accesses<br/>your vault — on-chain.
              </h3>
              <p style={{ fontFamily: D.serif, fontSize: "15px", color: D.ice50, lineHeight: 1.7, fontStyle: "italic", marginBottom: "24px" }}>
                Define and enforce compliance rules without modifying your vault architecture.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0", marginBottom: "28px", flex: 1 }}>
                {[
                  "Set minimum KYC tiers per vault",
                  "Whitelist trusted issuers",
                  "Pause/unpause access instantly",
                  "Monitor live gate activity and approvals",
                ].map((b, i) => (
                  <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "9px 0", borderBottom: `1px solid ${D.rule}` }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: D.teal, flexShrink: 0, marginTop: 6 }}/>
                    <span style={{ fontFamily: D.mono, fontSize: "11px", color: D.ice30, lineHeight: 1.7, fontWeight: 300 }}>{b}</span>
                  </div>
                ))}
              </div>
              <div style={{ paddingTop: "16px", borderTop: `1px solid rgba(15,110,86,0.2)` }}>
                <span style={{ fontFamily: D.mono, fontSize: "10px", color: D.teal, letterSpacing: "0.06em" }}>
                  → Permissioned vaults with zero manual overhead.
                </span>
              </div>
            </div>
          </Fade>

          {/* ── 3. KYC Issuers ── */}
          <Fade delay={120}>
            <div style={{ padding: "40px", border: `1px solid ${D.rule}`, background: D.bg2, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8899BB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <polyline points="9 12 11 14 15 10"/>
                </svg>
                <span style={{ fontFamily: D.mono, fontSize: "8px", letterSpacing: "0.16em", color: "#8899BB", textTransform: "uppercase" }}>KYC Issuers</span>
              </div>
              <h3 style={{ fontFamily: D.display, fontSize: "clamp(16px,2vw,22px)", fontWeight: 900, lineHeight: 1.1, color: D.ice, letterSpacing: "-0.01em", marginBottom: "12px" }}>
                Turn KYC into a usable<br/>on-chain primitive.
              </h3>
              <p style={{ fontFamily: D.serif, fontSize: "15px", color: D.ice50, lineHeight: 1.7, fontStyle: "italic", marginBottom: "24px" }}>
                Issue verifiable credentials that directly control access to financial infrastructure.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0", marginBottom: "28px", flex: 1 }}>
                {[
                  "Issue signed attestations tied to wallets",
                  "Set tiers, expiries, and jurisdictions",
                  "Revoke access in real time",
                  "Maintain a clear issuance registry",
                ].map((b, i) => (
                  <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "9px 0", borderBottom: `1px solid ${D.rule}` }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#8899BB", flexShrink: 0, marginTop: 6 }}/>
                    <span style={{ fontFamily: D.mono, fontSize: "11px", color: D.ice30, lineHeight: 1.7, fontWeight: 300 }}>{b}</span>
                  </div>
                ))}
              </div>
              <div style={{ paddingTop: "16px", borderTop: "1px solid rgba(136,153,187,0.2)" }}>
                <span style={{ fontFamily: D.mono, fontSize: "10px", color: "#8899BB", letterSpacing: "0.06em" }}>
                  → KYC becomes enforceable, not just recorded.
                </span>
              </div>
            </div>
          </Fade>

          {/* ── 4. End Users ── */}
          <Fade delay={160}>
            <div style={{ padding: "40px", border: `1px solid ${D.rule}`, background: D.bg2, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={D.ice} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                  <line x1="12" y1="12" x2="12.01" y2="12"/>
                  <path d="M8 12h.01M16 12h.01"/>
                </svg>
                <span style={{ fontFamily: D.mono, fontSize: "8px", letterSpacing: "0.16em", color: D.ice50, textTransform: "uppercase" }}>End Users</span>
              </div>
              <h3 style={{ fontFamily: D.display, fontSize: "clamp(16px,2vw,22px)", fontWeight: 900, lineHeight: 1.1, color: D.ice, letterSpacing: "-0.01em", marginBottom: "12px" }}>
                Access compliant DeFi —<br/>once verified.
              </h3>
              <p style={{ fontFamily: D.serif, fontSize: "15px", color: D.ice50, lineHeight: 1.7, fontStyle: "italic", marginBottom: "24px" }}>
                Complete KYC once and interact with multiple vaults seamlessly.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0", marginBottom: "28px", flex: 1 }}>
                {[
                  "One attestation unlocks multiple protocols",
                  "No repeated onboarding across platforms",
                  "Transparent approval or rejection at transaction time",
                  "Faster, predictable access to capital",
                ].map((b, i) => (
                  <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "9px 0", borderBottom: `1px solid ${D.rule}` }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: D.ice50, flexShrink: 0, marginTop: 6 }}/>
                    <span style={{ fontFamily: D.mono, fontSize: "11px", color: D.ice30, lineHeight: 1.7, fontWeight: 300 }}>{b}</span>
                  </div>
                ))}
              </div>
              <div style={{ paddingTop: "16px", borderTop: `1px solid rgba(232,238,246,0.1)` }}>
                <span style={{ fontFamily: D.mono, fontSize: "10px", color: D.ice50, letterSpacing: "0.06em" }}>
                  → A single identity gives you portable access across DeFi.
                </span>
              </div>
            </div>
          </Fade>

        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section style={{ padding:"120px 10vw", borderTop:`1px solid ${D.rule}`, display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", background:D.bg1 }}>
        <Fade>
          <h2 style={{ fontFamily:D.display, fontSize:"clamp(28px,4.5vw,64px)", fontWeight:900, lineHeight:0.95, letterSpacing:"-0.025em", marginBottom:"48px", maxWidth:"820px" }}>
            <span style={{ color:D.ice }}>Leyfis enables institutional capital to access DeFi </span>
            <span style={{ color:D.blue }}>without compromising compliance.</span>
          </h2>
          <div style={{ display:"flex", gap:"12px", justifyContent:"center", flexWrap:"wrap" }}>
            <Link href="/portal" style={{ fontFamily:D.mono, fontSize:"11px", letterSpacing:"0.12em", background:D.blue, color:"#fff", padding:"14px 36px", transition:"opacity 0.15s" }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity="0.85")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity="1")}
            >ACCESS YOUR VAULTS →</Link>
            <Link href="/admin" style={{ fontFamily:D.mono, fontSize:"11px", letterSpacing:"0.12em", color:D.ice30, border:`1px solid ${D.rule}`, padding:"14px 36px", transition:"all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.ice30; (e.currentTarget as HTMLElement).style.color = D.ice; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.rule; (e.currentTarget as HTMLElement).style.color = D.ice30; }}
            >OPEN INSTITUTIONAL CONSOLE</Link>
          </div>
        </Fade>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ padding:"20px 10vw", borderTop:`1px solid ${D.rule}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontFamily:D.display, fontSize:"10px", fontWeight:700, letterSpacing:"0.2em", color:D.ice30 }}>LEYFIS</span>
        <div style={{ display:"flex", gap:"28px" }}>
          {[["Vaults","/portal"],["Admin","/admin"],["GitHub","https://github.com/thinkDecade/leyfis"],["Explorer",`https://explorer.solana.com/address/Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP?cluster=devnet`]].map(([l,h]) => (
            <a key={l as string} href={h as string} target={(h as string).startsWith("http") ? "_blank" : undefined} rel="noreferrer"
              style={{ fontFamily:D.mono, fontSize:"9px", letterSpacing:"0.12em", color:D.ice30, textTransform:"uppercase", transition:"color 0.15s" }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = D.ice50)}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = D.ice30)}
            >{l}</a>
          ))}
        </div>
      </footer>
    </>
  );
}
