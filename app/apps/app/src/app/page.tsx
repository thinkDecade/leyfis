"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ─── Reveal hook ──────────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

// ─── Counter hook ─────────────────────────────────────────────────────────────
function useCounter(target: number, duration = 1800) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!started) return;
    const steps = 40;
    const step = target / steps;
    let current = 0;
    const t = setInterval(() => {
      current += step;
      if (current >= target) { setCount(target); clearInterval(t); }
      else setCount(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(t);
  }, [started, target, duration]);
  return { count, start: () => setStarted(true) };
}

// ─── Sections ─────────────────────────────────────────────────────────────────
function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(32px)",
      transition: "opacity 0.7s ease, transform 0.7s ease",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Stats strip ──────────────────────────────────────────────────────────────
function StatsStrip() {
  const { ref, visible } = useReveal();
  const calls = useCounter(10);
  const cleared = useCounter(10);
  const blocked = useCounter(0);

  useEffect(() => {
    if (visible) { calls.start(); cleared.start(); blocked.start(); }
  }, [visible]);

  return (
    <div ref={ref} style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto",
      borderTop: "1px solid rgba(232,238,246,0.1)",
      padding: "48px 64px",
    }}>
      {[
        { val: calls.count.toString(), label: "GATE CALLS PROCESSED" },
        { val: cleared.count.toString(), label: "WALLETS CLEARED" },
        { val: blocked.count.toString(), label: "ACCESS BLOCKED" },
      ].map(({ val, label }) => (
        <div key={label}>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: "clamp(48px,6vw,80px)", fontWeight: 900, color: "#E8EEF6", lineHeight: 1 }}>{val}</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "rgba(232,238,246,0.4)", letterSpacing: "0.16em", marginTop: "8px" }}>{label}</div>
        </div>
      ))}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", justifyContent: "center" }}>
        <Link href="/portal" style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "#E8EEF6", letterSpacing: "0.1em", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
          View live demo <span style={{ fontSize: "14px" }}>↓</span>
        </Link>
        <Link href="/admin" style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "rgba(232,238,246,0.4)", letterSpacing: "0.1em", textDecoration: "none" }}>
          Admin panel ↓
        </Link>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const mono = "'DM Mono', monospace";
  const display = "'Unbounded', sans-serif";
  const ice = "#E8EEF6";
  const dim = "rgba(232,238,246,0.35)";
  const rule = "rgba(232,238,246,0.08)";
  const blue = "#1B4FD8";
  const teal = "#0F6E56";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Unbounded:wght@300;400;700;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #000; color: ${ice}; font-family: ${mono}; overflow-x: hidden; }
        a { color: inherit; }
        ::selection { background: ${blue}; color: white; }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .nav-link:hover { color: ${ice} !important; }
        .cta-btn:hover { background: #1440B8 !important; }
        .sec-btn:hover { background: rgba(232,238,246,0.06) !important; }
        .step-row { border-bottom: 1px solid ${rule}; transition: background 0.2s; }
        .step-row:hover { background: rgba(232,238,246,0.02); }
        .role-card { border: 1px solid ${rule}; padding: 40px; transition: border-color 0.2s; }
        .role-card:hover { border-color: rgba(232,238,246,0.2); }
        .role-point { border-bottom: 1px solid ${rule}; padding: 10px 0; display: flex; gap: 12px; align-items: flex-start; }
      `}</style>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "20px 64px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${rule}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <svg width="28" height="28" viewBox="0 0 56 56" fill="none">
            <rect x="8" y="16" width="7" height="32" fill={ice}/>
            <rect x="41" y="16" width="7" height="32" fill={ice}/>
            <rect x="8" y="13" width="40" height="6" fill={ice}/>
            <rect x="18" y="19" width="20" height="29" fill="#000"/>
            <rect x="18" y="44" width="20" height="1.5" fill={blue}/>
          </svg>
          <span style={{ fontFamily: display, fontSize: "14px", fontWeight: 700, letterSpacing: "0.18em", color: ice }}>LEYFIS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
          {[["#problem","Problem"],["#how","How It Works"],["#roles","Roles"]].map(([href, label]) => (
            <a key={href} href={href} className="nav-link" style={{ fontFamily: mono, fontSize: "10px", letterSpacing: "0.12em", color: dim, textDecoration: "none", transition: "color 0.15s" }}>{label}</a>
          ))}
          <Link href="/portal" className="cta-btn" style={{ fontFamily: mono, fontSize: "10px", letterSpacing: "0.12em", background: blue, color: "white", padding: "10px 22px", textDecoration: "none", transition: "background 0.15s", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: teal, animation: "blink 2s infinite", display: "inline-block" }}/>
            LAUNCH DEMO
          </Link>
        </div>
      </nav>

      {/* TICKER */}
      <div style={{ marginTop: "60px", overflow: "hidden", borderBottom: `1px solid ${rule}`, padding: "14px 0", background: "#000" }}>
        <div style={{ display: "flex", animation: "ticker 22s linear infinite", width: "max-content" }}>
          {[...Array(2)].map((_, i) => (
            <div key={i} style={{ display: "flex", gap: "0" }}>
              {["Solana Attestation Service","FATF R.16 Compliant","Anchor v0.30.1","Devnet Live","Institutional Grade","KYC · AML · On-Chain","StableHacks 2026","AMINA Bank Pilot"].map((item, j) => (
                <span key={j} style={{ fontFamily: mono, fontSize: "10px", letterSpacing: "0.14em", color: dim, padding: "0 40px", borderRight: `1px solid ${rule}`, whiteSpace: "nowrap" }}>{item}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* HERO */}
      <section style={{ padding: "96px 64px 0", minHeight: "90vh", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "40px", alignItems: "flex-start", marginBottom: "48px" }}>
          <div style={{ fontFamily: mono, fontSize: "10px", letterSpacing: "0.18em", color: dim, textTransform: "uppercase" }}>
            — Compliance Infrastructure for Institutional DeFi
          </div>
          <div style={{ fontFamily: mono, fontSize: "10px", color: dim, letterSpacing: "0.1em", textAlign: "right", maxWidth: "280px", lineHeight: 1.8 }}>
            Your institution verified the user.<br/>
            Your vault still had no way to know.<br/>
            <span style={{ color: blue }}>Leyfis closes that gap.</span>
          </div>
        </div>
        <h1 style={{ fontFamily: display, fontSize: "clamp(56px, 10vw, 140px)", fontWeight: 900, lineHeight: 0.92, letterSpacing: "-0.02em", marginBottom: "64px" }}>
          <span style={{ display: "block", color: ice }}>Institutional</span>
          <span style={{ display: "block", color: blue }}>Compliance.</span>
          <span style={{ display: "block", color: ice }}>On-Chain.</span>
        </h1>
        <StatsStrip />
      </section>

      {/* PROBLEM */}
      <section id="problem" style={{ padding: "120px 64px", borderTop: `1px solid ${rule}` }}>
        <Section>
          <div style={{ fontFamily: mono, fontSize: "10px", letterSpacing: "0.18em", color: dim, marginBottom: "24px" }}>/01</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "80px", alignItems: "start" }}>
            <div>
              <h2 style={{ fontFamily: display, fontSize: "clamp(32px, 5vw, 64px)", fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.02em", color: ice, marginBottom: "40px" }}>
                Your legal team says the vault is compliant.<br/>
                <span style={{ color: "rgba(232,238,246,0.35)" }}>Your blockchain says it has no idea.</span>
              </h2>
              <p style={{ fontFamily: mono, fontSize: "13px", color: dim, lineHeight: 1.9, marginBottom: "24px", fontWeight: 300 }}>
                Banks and asset managers have spent years building KYC/AML infrastructure. That compliance data lives in spreadsheets, PDFs, and siloed internal systems. None of it can be read on-chain.
              </p>
              <p style={{ fontFamily: mono, fontSize: "13px", color: dim, lineHeight: 1.9, marginBottom: "24px", fontWeight: 300 }}>
                DeFi vaults are permissionless by design. They cannot tell a verified institutional investor from a sanctioned wallet. One wrong transaction — one wallet that slips through — and the entire institution faces regulatory exposure.
              </p>
              <p style={{ fontFamily: display, fontSize: "16px", fontWeight: 700, color: ice, lineHeight: 1.5 }}>
                The problem is not your compliance team.<br/>
                <span style={{ color: blue }}>The problem is that compliance has no on-chain address. Leyfis gives it one.</span>
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {[
                ["TODAY","Verified wallet enters vault with no compliance check","UNGUARDED"],
                ["TODAY","Sanctioned wallet enters the same vault unchallenged","NO BLOCK"],
                ["WITH LEYFIS","KYC-verified wallet passes gate and enters vault","CLEARED"],
                ["WITH LEYFIS","Unverified wallet is rejected before it reaches the vault","BLOCKED"],
              ].map(([tag, text, status], i) => {
                const isLeyfis = tag === "WITH LEYFIS";
                const isGood = status === "CLEARED";
                const statusColor = status === "UNGUARDED" || status === "NO BLOCK" ? "#7A1F1F"
                  : status === "CLEARED" ? teal : blue;
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 80px", gap: "16px", padding: "20px 0", borderTop: i === 0 ? `1px solid ${rule}` : "none", borderBottom: `1px solid ${rule}`, alignItems: "center" }}>
                    <span style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "0.12em", color: isLeyfis ? blue : "rgba(232,238,246,0.25)", textTransform: "uppercase" }}>{tag}</span>
                    <span style={{ fontFamily: mono, fontSize: "12px", color: isLeyfis ? ice : "rgba(232,238,246,0.4)", fontWeight: isLeyfis ? 400 : 300 }}>{text}</span>
                    <span style={{ fontFamily: mono, fontSize: "8px", letterSpacing: "0.1em", color: statusColor, textAlign: "right", border: `1px solid ${statusColor}`, padding: "3px 8px", textTransform: "uppercase" }}>{status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ padding: "120px 64px", borderTop: `1px solid ${rule}`, background: "#050505" }}>
        <Section>
          <div style={{ fontFamily: mono, fontSize: "10px", letterSpacing: "0.18em", color: dim, marginBottom: "24px" }}>/02</div>
          <h2 style={{ fontFamily: display, fontSize: "clamp(32px, 5vw, 64px)", fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.02em", color: ice, marginBottom: "24px" }}>
            Compliance enforced<br/>at the source.
          </h2>
          <p style={{ fontFamily: mono, fontSize: "13px", color: dim, lineHeight: 1.9, maxWidth: "640px", marginBottom: "64px", fontWeight: 300 }}>
            Every vault interaction passes through the Leyfis Gate. No off-chain roundtrip. No compliance team intervention. No database call that can fail, be hacked, or go stale. The gate reads a cryptographic attestation stored permanently on Solana, validates it in under 400ms, and either executes or rejects. Every outcome — approved or denied — is written immutably to chain. No exceptions.
          </p>
        </Section>

        {[
          { n: "01", title: "Attest", tag: "ON-CHAIN CREDENTIAL", copy: "Your KYC provider issues a signed on-chain attestation to the verified wallet. Tier 1, 2, or 3. Jurisdiction. Expiry. KYC case reference. All cryptographically bound on Solana in a single transaction. Revocable instantly if circumstances change. No spreadsheet to update. No PDF to re-issue. One transaction. Done." },
          { n: "02", title: "Validate", tag: "7 CHECKS · <400MS", copy: "The user's transaction hits the Leyfis Gate first. Seven compliance checks fire in fixed, auditable order — every single time. Gate status. Attestation existence. Revocation. Expiry. Issuer trust. Clearance tier. Jurisdiction. Any failure stops the transaction cold and logs a permanent denial record. No sanctioned wallet gets through. Ever." },
          { n: "03", title: "Authorize", tag: "ATOMIC · TRUSTLESS", copy: "All seven checks pass. Leyfis cross-program-invokes the vault directly, forwarding the original instruction data unchanged. The transaction executes atomically on Solana. No wrapping. No proxy. No custody. Compliance enforcement is invisible to compliant users — they just transact. Everyone else is stopped before they touch a single lamport." },
          { n: "04", title: "Audit", tag: "APPEND-ONLY · FOREVER", copy: "Every gate call — approved or denied — writes an immutable AuditEntry on-chain. Wallet. Vault. Timestamp. Slot. Outcome. Reason code. Attestation ID. Your compliance team exports FATF R.16 aligned CSV in one click. A regulator can independently verify every record directly on Solana without asking your institution for access. The ledger is the record. The record cannot be altered." },
        ].map(({ n, title, tag, copy }) => (
          <Section key={n}>
            <div className="step-row" style={{ display: "grid", gridTemplateColumns: "60px 200px 1fr 120px", gap: "32px", padding: "32px 0", alignItems: "start" }}>
              <span style={{ fontFamily: display, fontSize: "12px", fontWeight: 400, color: "rgba(232,238,246,0.25)", letterSpacing: "0.08em" }}>{n}</span>
              <span style={{ fontFamily: display, fontSize: "20px", fontWeight: 700, color: ice, lineHeight: 1.2 }}>{title}</span>
              <p style={{ fontFamily: mono, fontSize: "12px", color: dim, lineHeight: 1.85, fontWeight: 300 }}>{copy}</p>
              <span style={{ fontFamily: mono, fontSize: "8px", letterSpacing: "0.12em", color: blue, textAlign: "right", border: `1px solid ${blue}`, padding: "4px 10px", justifySelf: "end", alignSelf: "start" }}>{tag}</span>
            </div>
          </Section>
        ))}
      </section>

      {/* THE 7 CHECKS */}
      <Section style={{ padding: "80px 64px", borderTop: `1px solid ${rule}` }}>
        <div style={{ fontFamily: mono, fontSize: "10px", letterSpacing: "0.18em", color: dim, marginBottom: "24px" }}>THE 7 COMPLIANCE CHECKS — ENFORCED ON EVERY GATE CALL, IN ORDER</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0", border: `1px solid ${rule}` }}>
          {[
            ["Gate status","GatePaused"],
            ["Attestation exists","NoAttestation"],
            ["Not revoked","AttestationRevoked"],
            ["Not expired","AttestationExpired"],
            ["Trusted issuer","UntrustedIssuer"],
            ["Tier sufficient","TierInsufficient"],
            ["Jurisdiction eligible","JurisdictionBlocked"],
          ].map(([label, code], i) => (
            <div key={i} style={{ padding: "20px 16px", borderRight: i < 6 ? `1px solid ${rule}` : "none" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: teal, marginBottom: "12px" }}/>
              <div style={{ fontFamily: mono, fontSize: "11px", color: ice, marginBottom: "8px", lineHeight: 1.4 }}>{label}</div>
              <div style={{ fontFamily: mono, fontSize: "8px", color: blue, letterSpacing: "0.08em" }}>{code}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ROLES */}
      <section id="roles" style={{ padding: "120px 64px", borderTop: `1px solid ${rule}` }}>
        <Section>
          <div style={{ fontFamily: mono, fontSize: "10px", letterSpacing: "0.18em", color: dim, marginBottom: "24px" }}>/03</div>
          <h2 style={{ fontFamily: display, fontSize: "clamp(32px, 5vw, 64px)", fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.02em", color: ice, marginBottom: "16px" }}>
            Built for every institution<br/>that needs to prove compliance —<br/>
            <span style={{ color: "rgba(232,238,246,0.35)" }}>not just promise it.</span>
          </h2>
          <p style={{ fontFamily: mono, fontSize: "13px", color: dim, lineHeight: 1.9, maxWidth: "600px", marginBottom: "64px", fontWeight: 300 }}>
            Your KYC team issues credentials on-chain. Your vault operators set tier and jurisdiction rules. Your auditors and regulators read the immutable log — directly from Solana, no permission required. Leyfis enforces access between them at the protocol level, without discretion, without exceptions, without anyone in the middle.
          </p>
        </Section>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px" }}>
          {[
            {
              role: "Banks & Asset Managers",
              headline: "Launch institutional vaults without your legal team having a breakdown.",
              points: [
                "Deploy compliant vaults in hours, not quarters — compliance rules baked in at the protocol level",
                "KYC'd clients get immediate on-chain access — no manual whitelist management, no spreadsheets",
                "One sanctioned wallet triggers instant revocation — before it touches a single transaction",
                "FATF R.16 compliant CSV export for regulators — one click, no manual compilation",
                "FINMA, FCA, MAS alignment built in — demonstrate compliance to any regulator, instantly",
              ],
              cta: "Access Vaults",
              href: "/portal",
            },
            {
              role: "Vault Operators",
              headline: "Stop saying your vault is compliant. Start proving it.",
              points: [
                "Every single vault interaction gated — seven compliance checks, every time, no exceptions",
                "Pause the vault in one transaction — documented reason, permanent audit record",
                "Change min tier or jurisdiction rules without touching the contract — live, instant effect",
                "Live dashboard: approvals, denials, denial reasons, per-wallet history",
                "Audit log that no one — including you — can alter, delete, or retroactively modify",
              ],
              cta: "See the Dashboard",
              href: "/admin",
            },
            {
              role: "KYC / AML Providers",
              headline: "Turn your KYC database into on-chain infrastructure.",
              points: [
                "Issue signed attestations directly on Solana — your verified clients access compliant vaults instantly",
                "Tier-based credentials: Basic KYC, Enhanced Due Diligence, Full Institutional FATF",
                "Jurisdiction-aware — CHE, GBR, SGP, DEU, USA and more — ISO 3166-1 alpha-3",
                "Revoke any credential in one transaction — if circumstances change, so does access",
                "Your KYC work becomes on-chain infrastructure — permanent, portable, verifiable",
              ],
              cta: "Issue Credentials",
              href: "/admin",
            },
            {
              role: "Regulators & Auditors",
              headline: "Independent verification. No institution's word required.",
              points: [
                "Every gate call recorded permanently on Solana — read it directly, no access request needed",
                "FATF R.16 aligned fields — timestamp, wallet, vault, outcome, reason code, attestation ID",
                "Cross-reference attestation PDAs directly on-chain — verify issuer, tier, jurisdiction, expiry",
                "Tamper-proof by protocol — not by policy, not by promise, not by IT security controls",
                "Real-time audit trail — query historical records at any slot, for any wallet, at any time",
              ],
              cta: "View Audit Log",
              href: "/admin",
            },
          ].map(({ role, headline, points, cta, href }) => (
            <Section key={role}>
              <div className="role-card">
                <div style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "0.16em", color: blue, textTransform: "uppercase", marginBottom: "16px" }}>{role}</div>
                <h3 style={{ fontFamily: display, fontSize: "clamp(18px, 2vw, 24px)", fontWeight: 700, color: ice, marginBottom: "28px", lineHeight: 1.25, letterSpacing: "-0.01em" }}>{headline}</h3>
                <div style={{ marginBottom: "28px" }}>
                  {points.map((p, i) => (
                    <div key={i} className="role-point">
                      <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: teal, flexShrink: 0, marginTop: "5px" }}/>
                      <span style={{ fontFamily: mono, fontSize: "11px", color: dim, lineHeight: 1.8, fontWeight: 300 }}>{p}</span>
                    </div>
                  ))}
                </div>
                <Link href={href} style={{ fontFamily: mono, fontSize: "10px", letterSpacing: "0.12em", color: blue, textDecoration: "none", border: `1px solid ${rule}`, padding: "10px 20px", display: "inline-block", transition: "border-color 0.15s" }}>
                  {cta} →
                </Link>
              </div>
            </Section>
          ))}
        </div>
      </section>

      {/* PROOF */}
      <Section style={{ padding: "80px 64px", borderTop: `1px solid ${rule}`, background: "#050505" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0", border: `1px solid ${rule}` }}>
          {[
            ["Gate Program","Cskp4zg7...QZVP","Solana devnet"],
            ["Pilot Partner","AMINA Bank AG","StableHacks 2026"],
            ["Compliance standard","FATF R.16","Wire transfer tracing"],
            ["On-chain records","10 confirmed","Live audit entries"],
          ].map(([label, val, sub], i) => (
            <div key={i} style={{ padding: "28px 24px", borderRight: i < 3 ? `1px solid ${rule}` : "none" }}>
              <div style={{ fontFamily: mono, fontSize: "8px", letterSpacing: "0.14em", color: dim, textTransform: "uppercase", marginBottom: "10px" }}>{label}</div>
              <div style={{ fontFamily: display, fontSize: "14px", fontWeight: 700, color: ice, marginBottom: "4px" }}>{val}</div>
              <div style={{ fontFamily: mono, fontSize: "9px", color: dim }}>{sub}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* FINAL CTA */}
      <section style={{ padding: "160px 64px", borderTop: `1px solid ${rule}`, textAlign: "center" }}>
        <Section>
          <div style={{ fontFamily: mono, fontSize: "10px", letterSpacing: "0.18em", color: dim, marginBottom: "32px" }}>THE INFRASTRUCTURE EXISTS. THE COMPLIANCE PROBLEM IS SOLVED.</div>
          <h2 style={{ fontFamily: display, fontSize: "clamp(40px, 7vw, 96px)", fontWeight: 900, lineHeight: 0.92, letterSpacing: "-0.02em", color: ice, marginBottom: "16px" }}>
            Your institutional vault
          </h2>
          <h2 style={{ fontFamily: display, fontSize: "clamp(40px, 7vw, 96px)", fontWeight: 900, lineHeight: 0.92, letterSpacing: "-0.02em", color: blue, marginBottom: "40px" }}>
            goes live today.
          </h2>
          <p style={{ fontFamily: mono, fontSize: "14px", color: dim, lineHeight: 1.9, maxWidth: "480px", margin: "0 auto 56px", fontWeight: 300 }}>
            Not after your legal review. Not after your compliance team's six-month audit. Not after you rebuild your tech stack. Today. With credentials your KYC provider already issued.
          </p>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/portal" className="cta-btn" style={{ fontFamily: mono, fontSize: "12px", letterSpacing: "0.12em", background: blue, color: "white", padding: "16px 40px", textDecoration: "none", transition: "background 0.15s", fontWeight: 500 }}>
              ACCESS YOUR VAULTS →
            </Link>
            <Link href="/admin" className="sec-btn" style={{ fontFamily: mono, fontSize: "12px", letterSpacing: "0.12em", color: dim, padding: "16px 40px", textDecoration: "none", border: `1px solid ${rule}`, transition: "background 0.15s", fontWeight: 400 }}>
              OPEN INSTITUTIONAL CONSOLE
            </Link>
          </div>
        </Section>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "24px 64px", borderTop: `1px solid ${rule}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontFamily: display, fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", color: "rgba(232,238,246,0.3)" }}>LEYFIS</span>
          <span style={{ fontFamily: mono, fontSize: "10px", color: "rgba(232,238,246,0.2)", fontWeight: 300 }}>Institutional compliance infrastructure on Solana</span>
        </div>
        <div style={{ display: "flex", gap: "32px" }}>
          {[
            ["Vault Access", "/portal"],
            ["Admin Console", "/admin"],
            ["Gate Program", `https://explorer.solana.com/address/Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP?cluster=devnet`],
            ["GitHub", "https://github.com/thinkDecade/leyfis"],
          ].map(([label, href]) => (
            <a key={label as string} href={href as string} target={(href as string).startsWith("http") ? "_blank" : undefined} rel="noreferrer" style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "0.12em", color: "rgba(232,238,246,0.2)", textDecoration: "none", textTransform: "uppercase" }}>{label}</a>
          ))}
        </div>
      </footer>
    </>
  );
}
