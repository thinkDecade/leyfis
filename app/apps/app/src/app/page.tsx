"use client";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

// ─── Rive lazy loaded ─────────────────────────────────────────────────────────
const RiveGate = dynamic(() => import("./RiveGate"), { ssr: false, loading: () => <div style={{ width: "100%", height: "100%" }} /> });

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function useCounter(target: number, running: boolean, duration = 1600) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!running) return;
    const steps = 36; let i = 0;
    const t = setInterval(() => { i++; setN(Math.round((i / steps) * target)); if (i >= steps) clearInterval(t); }, duration / steps);
    return () => clearInterval(t);
  }, [running, target, duration]);
  return n;
}

// ─── Components ───────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const { ref, visible } = useInView();
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(24px)", transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

// Animated gate — CSS canvas
function GateAnimation({ approved }: { approved: boolean }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes drawPillar { from { scaleY: 0; opacity: 0; } to { scaleY: 1; opacity: 1; } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 20px rgba(27,79,216,0.3); } 50% { box-shadow: 0 0 60px rgba(27,79,216,0.7); } }
        @keyframes approvedGlow { 0%,100% { box-shadow: 0 0 20px rgba(15,110,86,0.3); } 50% { box-shadow: 0 0 60px rgba(15,110,86,0.8); } }
        @keyframes scanLine { 0% { top: 0%; opacity: 0.8; } 100% { top: 100%; opacity: 0; } }
        @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.6; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes drawLintel { from { width: 0; } to { width: calc(100% + 2px); } }
      `}</style>
      <div style={{ position: "relative", width: "180px", height: "220px" }}>
        {/* Left pillar */}
        <div style={{ position: "absolute", left: 0, bottom: 0, width: "18px", height: "200px", background: approved ? "#0F6E56" : "#1B4FD8", animation: `${approved ? "approvedGlow" : "glow"} 2s infinite`, transition: "background 0.8s ease", borderRadius: "2px 2px 0 0" }} />
        {/* Right pillar */}
        <div style={{ position: "absolute", right: 0, bottom: 0, width: "18px", height: "200px", background: approved ? "#0F6E56" : "#1B4FD8", animation: `${approved ? "approvedGlow" : "glow"} 2s infinite 0.3s`, transition: "background 0.8s ease", borderRadius: "2px 2px 0 0" }} />
        {/* Lintel */}
        <div style={{ position: "absolute", top: 0, left: 0, height: "18px", background: approved ? "#0F6E56" : "#1B4FD8", animation: "drawLintel 1s ease forwards, " + (approved ? "approvedGlow" : "glow") + " 2s infinite 0.6s", transition: "background 0.8s ease", borderRadius: "2px", width: "calc(100% + 2px)" }} />
        {/* Scan line */}
        {!approved && (
          <div style={{ position: "absolute", left: "18px", right: "18px", height: "2px", background: "rgba(27,79,216,0.6)", animation: "scanLine 2s linear infinite", top: "18px" }} />
        )}
        {/* Approved state */}
        {approved && (
          <>
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "40px", height: "40px", borderRadius: "50%", border: "2px solid #0F6E56", animation: "pulse-ring 1.5s ease-out infinite" }} />
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", fontFamily: "'Unbounded', sans-serif", fontSize: "28px", fontWeight: 900, color: "#0F6E56" }}>✓</div>
          </>
        )}
      </div>
    </div>
  );
}

// Audience card
function AudienceCard({ label, headline, outcomes, stat, statLabel, cta, href, accent }: {
  label: string; headline: string; outcomes: string[]; stat: string; statLabel: string; cta: string; href: string; accent: string;
}) {
  const { ref, visible } = useInView(0.1);
  const mono = "'DM Mono', monospace";
  const display = "'Unbounded', sans-serif";

  return (
    <section ref={ref} style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      padding: "0 10vw", borderTop: "1px solid rgba(232,238,246,0.07)",
      opacity: visible ? 1 : 0, transition: "opacity 0.5s ease",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8vw", width: "100%", alignItems: "center" }}>
        {/* Left */}
        <div>
          <div style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "0.2em", color: accent, textTransform: "uppercase", marginBottom: "24px", opacity: 0.8 }}>{label}</div>
          <h2 style={{ fontFamily: display, fontSize: "clamp(28px, 4vw, 52px)", fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.02em", color: "#E8EEF6", marginBottom: "48px" }}>
            {headline}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0", marginBottom: "48px" }}>
            {outcomes.map((o, i) => (
              <div key={i} style={{ display: "flex", gap: "16px", alignItems: "flex-start", padding: "14px 0", borderBottom: "1px solid rgba(232,238,246,0.06)" }}>
                <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: accent, flexShrink: 0, marginTop: "6px" }} />
                <span style={{ fontFamily: mono, fontSize: "12px", color: "rgba(232,238,246,0.5)", lineHeight: 1.8, fontWeight: 300 }}>{o}</span>
              </div>
            ))}
          </div>
          <Link href={href} style={{ fontFamily: mono, fontSize: "10px", letterSpacing: "0.14em", color: accent, textDecoration: "none", border: `1px solid ${accent}`, padding: "12px 24px", display: "inline-block", transition: "all 0.15s", textTransform: "uppercase" }}>
            {cta} →
          </Link>
        </div>
        {/* Right — big stat */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right" }}>
          <div style={{ fontFamily: display, fontSize: "clamp(80px, 12vw, 160px)", fontWeight: 900, color: accent, lineHeight: 0.9, letterSpacing: "-0.04em", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)", transition: "opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s" }}>
            {stat}
          </div>
          <div style={{ fontFamily: mono, fontSize: "11px", color: "rgba(232,238,246,0.35)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "12px" }}>{statLabel}</div>
        </div>
      </div>
    </section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [gateApproved, setGateApproved] = useState(false);
  const mono = "'DM Mono', monospace";
  const display = "'Unbounded', sans-serif";
  const blue = "#1B4FD8";
  const teal = "#0F6E56";
  const ice = "#E8EEF6";

  useEffect(() => {
    setMounted(true);
    // Cycle gate approved/denied for demo
    const t = setInterval(() => setGateApproved(p => !p), 3000);
    return () => clearInterval(t);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Unbounded:wght@400;700;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #000; color: ${ice}; font-family: ${mono}; overflow-x: hidden; }
        ::selection { background: ${blue}; color: #fff; }
        a { color: inherit; text-decoration: none; }

        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }

        .nav-cta { transition: background 0.15s, opacity 0.15s; }
        .nav-cta:hover { opacity: 0.8; }

        /* Problem split */
        @keyframes glitch {
          0% { clip-path: inset(20% 0 60% 0); transform: translate(-2px, 0); }
          20% { clip-path: inset(50% 0 10% 0); transform: translate(2px, 0); }
          40% { clip-path: inset(70% 0 5% 0); transform: translate(-1px, 0); }
          60% { clip-path: inset(10% 0 85% 0); transform: translate(1px, 0); }
          80% { clip-path: inset(40% 0 45% 0); transform: translate(-2px, 0); }
          100% { clip-path: inset(20% 0 60% 0); transform: translate(0, 0); }
        }
        .glitch-overlay {
          position: absolute; inset: 0;
          background: rgba(122, 31, 31, 0.06);
          animation: glitch 3.5s infinite;
          pointer-events: none;
        }
        @keyframes check-draw {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: "60px", padding: "0 10vw", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(232,238,246,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <svg width="22" height="22" viewBox="0 0 56 56" fill="none">
            <rect x="8" y="16" width="7" height="32" fill={ice}/>
            <rect x="41" y="16" width="7" height="32" fill={ice}/>
            <rect x="8" y="13" width="40" height="6" fill={ice}/>
            <rect x="18" y="19" width="20" height="29" fill="#000"/>
            <rect x="18" y="44" width="20" height="1.5" fill={blue}/>
          </svg>
          <span style={{ fontFamily: display, fontSize: "13px", fontWeight: 700, letterSpacing: "0.2em" }}>LEYFIS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
          {[["#problem","Problem"],["#how","How"],["#for","For whom"]].map(([h, l]) => (
            <a key={h} href={h} style={{ fontFamily: mono, fontSize: "10px", letterSpacing: "0.12em", color: "rgba(232,238,246,0.4)", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = ice)}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(232,238,246,0.4)")}
            >{l}</a>
          ))}
          <Link href="/portal" className="nav-cta" style={{ fontFamily: mono, fontSize: "10px", letterSpacing: "0.12em", background: blue, color: "#fff", padding: "9px 20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: teal, animation: "blink 2s infinite", display: "inline-block" }}/>
            LAUNCH DEMO
          </Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "120px 10vw 80px", position: "relative", overflow: "hidden" }}>
        {/* Subtle grid */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(232,238,246,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(232,238,246,0.025) 1px, transparent 1px)`, backgroundSize: "100px 100px", pointerEvents: "none" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8vw", alignItems: "center", position: "relative", zIndex: 1 }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "0.2em", color: "rgba(232,238,246,0.3)", marginBottom: "32px", animation: "fadeIn 0.6s ease forwards" }}>
              — COMPLIANCE INFRASTRUCTURE FOR INSTITUTIONAL DEFI
            </div>
            <h1 style={{ fontFamily: display, fontSize: "clamp(48px, 8vw, 112px)", fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.025em", marginBottom: "40px", animation: "fadeIn 0.6s ease 0.1s both" }}>
              <span style={{ display: "block", color: ice }}>Institutional</span>
              <span style={{ display: "block", color: blue }}>Compliance.</span>
              <span style={{ display: "block", color: ice }}>On-Chain.</span>
            </h1>
            <p style={{ fontFamily: mono, fontSize: "14px", color: "rgba(232,238,246,0.45)", lineHeight: 1.85, maxWidth: "420px", marginBottom: "48px", fontWeight: 300, animation: "fadeIn 0.6s ease 0.2s both" }}>
              KYC/AML access control at the protocol level.<br/>
              Not in a spreadsheet. Not in a PDF.<br/>
              On-chain. Permanent. Auditable.
            </p>
            <div style={{ display: "flex", gap: "16px", animation: "fadeIn 0.6s ease 0.3s both" }}>
              <Link href="/portal" style={{ fontFamily: mono, fontSize: "11px", letterSpacing: "0.12em", background: blue, color: "#fff", padding: "14px 32px", display: "inline-block" }}>
                ACCESS VAULTS →
              </Link>
              <Link href="/admin" style={{ fontFamily: mono, fontSize: "11px", letterSpacing: "0.12em", color: "rgba(232,238,246,0.4)", padding: "14px 32px", border: "1px solid rgba(232,238,246,0.1)", display: "inline-block" }}>
                ADMIN CONSOLE
              </Link>
            </div>
          </div>

          {/* Gate animation */}
          <div style={{ height: "340px", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.8s ease 0.4s both" }}>
            <GateAnimation approved={gateApproved} />
            <div style={{ position: "absolute", right: "10vw", bottom: "180px", fontFamily: mono, fontSize: "10px", color: gateApproved ? teal : blue, letterSpacing: "0.12em", transition: "color 0.8s ease" }}>
              {gateApproved ? "ACCESS GRANTED" : "VERIFYING..."}
            </div>
          </div>
        </div>

        {/* Ticker */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, overflow: "hidden", borderTop: "1px solid rgba(232,238,246,0.05)", padding: "12px 0" }}>
          <div style={{ display: "flex", animation: "ticker 20s linear infinite", width: "max-content" }}>
            {[...Array(2)].map((_, i) => (
              <div key={i} style={{ display: "flex" }}>
                {["7 COMPLIANCE CHECKS","<400MS VALIDATION","SOLANA DEVNET LIVE","FATF R.16 ALIGNED","AMINA BANK PILOT","8/8 ANCHOR TESTS","IMMUTABLE AUDIT LOG","TIER-GATED ACCESS"].map((item, j) => (
                  <span key={j} style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "0.16em", color: "rgba(232,238,246,0.2)", padding: "0 40px", borderRight: "1px solid rgba(232,238,246,0.05)", whiteSpace: "nowrap" }}>{item}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM ──────────────────────────────────────────────────────── */}
      <section id="problem" style={{ minHeight: "100vh", display: "flex", alignItems: "center", borderTop: "1px solid rgba(232,238,246,0.07)", padding: "80px 10vw" }}>
        <div style={{ width: "100%" }}>
          <Reveal>
            <div style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "0.2em", color: "rgba(232,238,246,0.3)", marginBottom: "64px" }}>/01 THE PROBLEM</div>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginBottom: "80px" }}>
            {/* TODAY */}
            <Reveal delay={0}>
              <div style={{ padding: "48px", background: "#0A0000", border: "1px solid rgba(122,31,31,0.3)", position: "relative", minHeight: "400px" }}>
                <div className="glitch-overlay" />
                <div style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "0.2em", color: "rgba(122,31,31,0.8)", marginBottom: "32px" }}>TODAY</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {[
                    "Your KYC data lives in spreadsheets.",
                    "Your vault is open to any wallet.",
                    "One sanctioned wallet = regulatory incident.",
                    "Compliance team can't review every transaction.",
                  ].map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <span style={{ fontFamily: mono, fontSize: "11px", color: "rgba(122,31,31,0.8)", marginTop: "2px", flexShrink: 0 }}>✕</span>
                      <span style={{ fontFamily: mono, fontSize: "13px", color: "rgba(232,238,246,0.5)", lineHeight: 1.6, fontWeight: 300 }}>{t}</span>
                    </div>
                  ))}
                </div>
                {/* Glitch text overlay */}
                <div style={{ position: "absolute", bottom: "32px", left: "48px", fontFamily: display, fontSize: "clamp(28px, 3vw, 40px)", fontWeight: 900, color: "rgba(122,31,31,0.15)", lineHeight: 1 }}>EXPOSED</div>
              </div>
            </Reveal>

            {/* WITH LEYFIS */}
            <Reveal delay={120}>
              <div style={{ padding: "48px", background: "#000A06", border: "1px solid rgba(15,110,86,0.3)", position: "relative", minHeight: "400px" }}>
                <div style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "0.2em", color: "rgba(15,110,86,0.8)", marginBottom: "32px" }}>WITH LEYFIS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {[
                    "KYC credentials live on-chain. Immutable.",
                    "Every wallet checked. Every time. Automatically.",
                    "Sanctioned wallets blocked before the transaction.",
                    "Compliance enforced at protocol level. Always.",
                  ].map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <span style={{ fontFamily: mono, fontSize: "11px", color: teal, marginTop: "2px", flexShrink: 0 }}>✓</span>
                      <span style={{ fontFamily: mono, fontSize: "13px", color: "rgba(232,238,246,0.7)", lineHeight: 1.6, fontWeight: 300 }}>{t}</span>
                    </div>
                  ))}
                </div>
                <div style={{ position: "absolute", bottom: "32px", left: "48px", fontFamily: display, fontSize: "clamp(28px, 3vw, 40px)", fontWeight: 900, color: "rgba(15,110,86,0.12)", lineHeight: 1 }}>PROTECTED</div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={200}>
            <div style={{ borderTop: "1px solid rgba(232,238,246,0.07)", paddingTop: "48px" }}>
              <p style={{ fontFamily: display, fontSize: "clamp(20px, 3vw, 32px)", fontWeight: 700, color: ice, lineHeight: 1.2, maxWidth: "700px" }}>
                The problem is not your compliance team.{" "}
                <span style={{ color: blue }}>The problem is that compliance has no on-chain address.</span>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how" style={{ borderTop: "1px solid rgba(232,238,246,0.07)", padding: "80px 10vw", background: "#020202" }}>
        <Reveal>
          <div style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "0.2em", color: "rgba(232,238,246,0.3)", marginBottom: "64px" }}>/02 HOW IT WORKS</div>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8vw", alignItems: "start" }}>
          <div>
            {[
              { n: "01", t: "Attest", d: "KYC provider issues a signed credential on Solana. Tier, jurisdiction, expiry. One transaction." },
              { n: "02", t: "Gate", d: "7 checks fire on every vault interaction. Under 400ms. Any failure = blocked. No exceptions." },
              { n: "03", t: "Authorize", d: "All checks pass. Gate CPIs to vault. Atomic. No proxy. No custody. Invisible to compliant users." },
              { n: "04", t: "Audit", d: "Every outcome written immutably on-chain. FATF R.16 CSV export. No manual logging. Ever." },
            ].map(({ n, t, d }, i) => (
              <Reveal key={n} delay={i * 80}>
                <div style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: "24px", padding: "32px 0", borderBottom: "1px solid rgba(232,238,246,0.06)", alignItems: "start" }}>
                  <span style={{ fontFamily: display, fontSize: "11px", fontWeight: 400, color: "rgba(232,238,246,0.2)", paddingTop: "4px" }}>{n}</span>
                  <div>
                    <div style={{ fontFamily: display, fontSize: "18px", fontWeight: 700, color: ice, marginBottom: "8px" }}>{t}</div>
                    <div style={{ fontFamily: mono, fontSize: "12px", color: "rgba(232,238,246,0.4)", lineHeight: 1.7, fontWeight: 300 }}>{d}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* 7 checks */}
          <Reveal delay={200}>
            <div style={{ position: "sticky", top: "80px" }}>
              <div style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "0.16em", color: "rgba(232,238,246,0.25)", marginBottom: "20px" }}>7 CHECKS · EVERY GATE CALL · IN ORDER</div>
              <div style={{ border: "1px solid rgba(232,238,246,0.07)" }}>
                {[
                  ["Gate status","GatePaused"],
                  ["Attestation exists","NoAttestation"],
                  ["Not revoked","AttestationRevoked"],
                  ["Not expired","AttestationExpired"],
                  ["Trusted issuer","UntrustedIssuer"],
                  ["Tier sufficient","TierInsufficient"],
                  ["Jurisdiction eligible","JurisdictionBlocked"],
                ].map(([label, code], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: i < 6 ? "1px solid rgba(232,238,246,0.05)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: teal }} />
                      <span style={{ fontFamily: mono, fontSize: "11px", color: "rgba(232,238,246,0.6)" }}>{label}</span>
                    </div>
                    <span style={{ fontFamily: mono, fontSize: "9px", color: blue, letterSpacing: "0.06em" }}>{code}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── AUDIENCE SECTIONS ─────────────────────────────────────────────── */}
      <div id="for">
        <Reveal style={{ padding: "80px 10vw 0", borderTop: "1px solid rgba(232,238,246,0.07)" }}>
          <div style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "0.2em", color: "rgba(232,238,246,0.3)" }}>/03 BUILT FOR</div>
        </Reveal>

        <AudienceCard
          label="Banks & Asset Managers"
          headline={"Launch compliant\nvaults in hours,\nnot quarters."}
          outcomes={[
            "Your KYC'd clients get immediate on-chain access — no manual whitelisting, no PDF review",
            "One sanctioned wallet triggers instant revocation — before it touches a single transaction",
            "FATF R.16 CSV export for regulators — one click, independently verifiable on Solana",
          ]}
          stat="<2s"
          statLabel="time to verify any wallet"
          cta="Access Vaults"
          href="/portal"
          accent={blue}
        />

        <AudienceCard
          label="Vault Operators"
          headline={"Stop saying\nyour vault\nis compliant."}
          outcomes={[
            "Every vault interaction gated — 7 checks, every time, no exceptions, no manual review",
            "Pause in one transaction — documented reason, permanent on-chain record",
            "Change compliance rules without touching the contract — live, immediate effect",
          ]}
          stat="7"
          statLabel="compliance checks on every call"
          cta="See the Dashboard"
          href="/admin"
          accent={teal}
        />

        <AudienceCard
          label="KYC / AML Providers"
          headline={"Your KYC\nbecomes\non-chain rails."}
          outcomes={[
            "Issue signed attestations on Solana — your verified clients access compliant vaults instantly",
            "Tier 1 Basic, Tier 2 Enhanced, Tier 3 Institutional — with jurisdiction and expiry",
            "Revoke any credential in one transaction — if circumstances change, access changes immediately",
          ]}
          stat="∞"
          statLabel="vaults your credentials unlock"
          cta="Issue Credentials"
          href="/admin"
          accent="#8899BB"
        />

        <AudienceCard
          label="Regulators & Auditors"
          headline={"Independent\nverification.\nNo permission needed."}
          outcomes={[
            "Every gate call recorded permanently on Solana — read it directly, no access request needed",
            "Tamper-proof by protocol — not by policy, not by IT security controls, not by anyone's word",
            "FATF R.16 aligned fields — timestamp, wallet, vault, outcome, reason code, attestation ID",
          ]}
          stat="0"
          statLabel="databases you need to trust"
          cta="View Audit Log"
          href="/admin"
          accent="#E8EEF6"
        />
      </div>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", borderTop: "1px solid rgba(232,238,246,0.07)", padding: "80px 10vw", textAlign: "center" }}>
        <Reveal>
          <div style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "0.2em", color: "rgba(232,238,246,0.25)", marginBottom: "40px" }}>THE INFRASTRUCTURE EXISTS.</div>
          <h2 style={{ fontFamily: display, fontSize: "clamp(44px, 8vw, 104px)", fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.025em", marginBottom: "48px" }}>
            <span style={{ display: "block", color: ice }}>Your institutional vault</span>
            <span style={{ display: "block", color: blue }}>goes live today.</span>
          </h2>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/portal" style={{ fontFamily: mono, fontSize: "12px", letterSpacing: "0.12em", background: blue, color: "#fff", padding: "16px 40px", display: "inline-block" }}>
              ACCESS YOUR VAULTS →
            </Link>
            <Link href="/admin" style={{ fontFamily: mono, fontSize: "12px", letterSpacing: "0.12em", color: "rgba(232,238,246,0.4)", padding: "16px 40px", border: "1px solid rgba(232,238,246,0.1)", display: "inline-block" }}>
              OPEN INSTITUTIONAL CONSOLE
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ padding: "24px 10vw", borderTop: "1px solid rgba(232,238,246,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: display, fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", color: "rgba(232,238,246,0.2)" }}>LEYFIS</span>
        <div style={{ display: "flex", gap: "32px" }}>
          {[["Vaults","/portal"],["Admin","/admin"],["GitHub","https://github.com/thinkDecade/leyfis"],["Explorer",`https://explorer.solana.com/address/Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP?cluster=devnet`]].map(([l,h]) => (
            <a key={l as string} href={h as string} target={(h as string).startsWith("http") ? "_blank" : undefined} rel="noreferrer" style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "0.12em", color: "rgba(232,238,246,0.2)", textTransform: "uppercase" }}>{l}</a>
          ))}
        </div>
      </footer>
    </>
  );
}
