"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

// ─── Token constants ──────────────────────────────────────────────────────────
const GATE_PROGRAM = "Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP";

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    // Animate gate call counter
    const target = 10;
    let current = 0;
    const interval = setInterval(() => {
      current++;
      setCount(current);
      if (current >= target) clearInterval(interval);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=IBM+Plex+Mono:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --void:     #080C14;
          --void-1:   #0D1220;
          --void-2:   #131929;
          --ice:      #E8EEF6;
          --ice-2:    rgba(232,238,246,0.65);
          --ice-3:    rgba(232,238,246,0.35);
          --ice-4:    rgba(232,238,246,0.15);
          --border:   rgba(232,238,246,0.07);
          --border-2: rgba(232,238,246,0.13);
          --accent:   #1B4FD8;
          --accent-2: rgba(27,79,216,0.12);
          --teal:     #0F6E56;
          --teal-bg:  rgba(15,110,86,0.08);
          --serif:    'EB Garamond', Georgia, serif;
          --mono:     'IBM Plex Mono', monospace;
        }
        html, body { background: var(--void); color: var(--ice); font-family: var(--mono); }
        ::selection { background: var(--accent); color: white; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1; }
        }
        @keyframes scan {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }

        .fade-1 { animation: fadeUp 0.6s ease 0.1s both; }
        .fade-2 { animation: fadeUp 0.6s ease 0.25s both; }
        .fade-3 { animation: fadeUp 0.6s ease 0.4s both; }
        .fade-4 { animation: fadeUp 0.6s ease 0.55s both; }
        .fade-5 { animation: fadeUp 0.6s ease 0.7s both; }

        .btn-primary {
          display: inline-flex; align-items: center; gap: 10px;
          font-family: var(--mono); font-size: 11px; font-weight: 500;
          letter-spacing: 0.12em; text-transform: uppercase; text-decoration: none;
          background: var(--accent); color: white; border: none;
          padding: 14px 28px; cursor: pointer;
          transition: opacity 0.15s;
        }
        .btn-primary:hover { opacity: 0.85; }

        .btn-secondary {
          display: inline-flex; align-items: center; gap: 10px;
          font-family: var(--mono); font-size: 11px; font-weight: 500;
          letter-spacing: 0.12em; text-transform: uppercase; text-decoration: none;
          background: transparent; color: var(--ice-2);
          border: 1px solid var(--border-2);
          padding: 14px 28px; cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .btn-secondary:hover { border-color: var(--ice-4); color: var(--ice); }

        .card {
          border: 1px solid var(--border);
          background: var(--void-1);
          padding: 28px;
          transition: border-color 0.2s;
        }
        .card:hover { border-color: var(--border-2); }

        .tag {
          display: inline-block;
          font-family: var(--mono); font-size: 9px; font-weight: 500;
          letter-spacing: 0.12em; text-transform: uppercase;
          padding: 4px 10px;
          border: 1px solid var(--border-2);
          color: var(--ice-3);
        }

        .divider { border: none; border-top: 1px solid var(--border); }
      `}</style>

      <main style={{ minHeight: "100vh", background: "var(--void)" }}>

        {/* Subtle grid texture */}
        <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none", zIndex: 0 }} />

        {/* ── NAV ─────────────────────────────────────────────────────────── */}
        <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: "60px", padding: "0 48px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(8,12,20,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "24px", height: "24px", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 56 56" fill="none">
                <rect x="8" y="16" width="7" height="32" fill="white"/>
                <rect x="41" y="16" width="7" height="32" fill="white"/>
                <rect x="8" y="13" width="40" height="6" fill="white"/>
                <rect x="18" y="19" width="20" height="29" fill="#1B4FD8"/>
              </svg>
            </div>
            <span style={{ fontFamily: "var(--mono)", fontSize: "12px", fontWeight: 500, letterSpacing: "0.24em", color: "var(--ice)" }}>LEYFIS</span>
            <span className="tag" style={{ marginLeft: "8px" }}>Devnet Live</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Link href="/portal" className="btn-secondary" style={{ padding: "8px 18px", fontSize: "10px" }}>
              Access Portal
            </Link>
            <Link href="/admin" className="btn-primary" style={{ padding: "8px 18px", fontSize: "10px" }}>
              Institutional Console
            </Link>
          </div>
        </header>

        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <section style={{ position: "relative", zIndex: 1, paddingTop: "60px", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "80px 48px" }}>

            {/* Eyebrow */}
            <div className="fade-1" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--teal)", animation: "pulse 2s infinite" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--teal)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                Live on Solana devnet · {count} gate calls confirmed on-chain
              </span>
            </div>

            {/* Main headline */}
            <h1 className="fade-2" style={{ fontFamily: "var(--serif)", fontSize: "clamp(48px, 6.5vw, 88px)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.02em", color: "var(--ice)", marginBottom: "32px", maxWidth: "900px" }}>
              Institutional capital is waiting.<br />
              <em style={{ color: "var(--accent)", fontStyle: "italic" }}>Compliance is the last lock.</em>
            </h1>

            {/* Sub-headline */}
            <p className="fade-3" style={{ fontFamily: "var(--mono)", fontSize: "16px", color: "var(--ice-2)", lineHeight: 1.9, maxWidth: "560px", marginBottom: "48px", fontWeight: 300 }}>
              Leyfis enforces KYC/AML access control at the protocol level — not in a spreadsheet, not in a PDF, not in your legal team's inbox. On-chain. Permanent. Verifiable by any regulator, anywhere, instantly.
            </p>

            {/* CTAs */}
            <div className="fade-4" style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "64px" }}>
              <Link href="/portal" className="btn-primary">
                Access Vaults →
              </Link>
              <Link href="/admin" className="btn-secondary">
                Institutional Console
              </Link>
            </div>

            {/* Stats strip */}
            <div className="fade-5" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "2px", maxWidth: "800px" }}>
              {[
                ["7", "Compliance checks", "On every single vault interaction"],
                ["< 2s", "Verification time", "Attestation read from Solana"],
                ["∞", "Audit trail", "Immutable, tamper-proof, on-chain"],
                ["0", "Database needed", "Source of truth is the blockchain"],
              ].map(([v, l, sub]) => (
                <div key={l} style={{ borderTop: "1px solid var(--border-2)", paddingTop: "16px" }}>
                  <div style={{ fontFamily: "var(--serif)", fontSize: "32px", color: "var(--ice)", marginBottom: "4px", lineHeight: 1 }}>{v}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--ice-2)", fontWeight: 500, marginBottom: "4px" }}>{l}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--ice-3)", lineHeight: 1.6 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PROBLEM STATEMENT ─────────────────────────────────────────── */}
        <section style={{ position: "relative", zIndex: 1, borderTop: "1px solid var(--border)" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "96px 48px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "80px", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--accent)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "24px" }}>The problem</div>
                <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(32px, 3.5vw, 48px)", fontWeight: 400, lineHeight: 1.1, color: "var(--ice)", marginBottom: "24px", letterSpacing: "-0.02em" }}>
                  Your compliance team verified thousands of clients. Your DeFi vault can't read any of it.
                </h2>
                <p style={{ fontFamily: "var(--mono)", fontSize: "13px", color: "var(--ice-3)", lineHeight: 1.9, fontWeight: 300 }}>
                  Banks and asset managers have spent years building KYC/AML infrastructure. None of it talks to DeFi. Every new vault interaction requires manual review. Every sanctioned wallet that slips through is a regulatory incident. The compliance gap is killing institutional DeFi adoption — not because compliance is hard, but because nobody built the infrastructure to enforce it on-chain.
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {[
                  ["✗", "Manual whitelist management", "Wallet addresses maintained in spreadsheets. Updated manually. Error-prone. Not auditable."],
                  ["✗", "No on-chain evidence", "Regulators ask for proof of compliance. You send PDFs. They want blockchain records."],
                  ["✗", "Developer dependency", "Every compliance rule change requires a contract upgrade. Weeks of work. Budget approval."],
                  ["✗", "No real-time revocation", "A sanctioned wallet approved last month? You can't take it back. The vault is exposed."],
                ].map(([icon, title, desc]) => (
                  <div key={title} style={{ padding: "20px 24px", border: "1px solid var(--border)", background: "var(--void-1)", display: "grid", gridTemplateColumns: "20px 1fr", gap: "16px", alignItems: "start" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: "14px", color: "#9A2C2C", marginTop: "2px" }}>{icon}</span>
                    <div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--ice)", fontWeight: 500, marginBottom: "4px" }}>{title}</div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--ice-3)", lineHeight: 1.7, fontWeight: 300 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
        <section style={{ position: "relative", zIndex: 1, borderTop: "1px solid var(--border)", background: "var(--void-1)" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "96px 48px" }}>
            <div style={{ marginBottom: "64px" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--accent)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "16px" }}>How Leyfis works</div>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(32px, 3.5vw, 48px)", fontWeight: 400, lineHeight: 1.1, color: "var(--ice)", letterSpacing: "-0.02em", maxWidth: "600px" }}>
                The compliance layer your vault never had.
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px", marginBottom: "64px" }}>
              {[
                ["01", "Issue", "KYC providers issue signed on-chain attestations to verified wallets. Tier, jurisdiction, expiry — all cryptographically bound. No spreadsheet. No PDF. One Solana transaction."],
                ["02", "Gate", "Every vault interaction passes through Leyfis. Seven checks fire in order — paused, attested, revoked, expired, trusted issuer, tier, jurisdiction. All in under two seconds."],
                ["03", "Audit", "Every gate call writes an immutable AuditEntry on-chain. Approved or denied. Reason code. Tier. Attestation ID. Slot. Timestamp. Permanent. No one can alter it — including you."],
              ].map(([n, t, d]) => (
                <div key={n} className="card" style={{ padding: "36px" }}>
                  <div style={{ fontFamily: "var(--serif)", fontSize: "48px", color: "var(--border-2)", lineHeight: 1, marginBottom: "24px" }}>{n}</div>
                  <div style={{ fontFamily: "var(--serif)", fontSize: "22px", color: "var(--ice)", marginBottom: "14px" }}>{t}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "12px", color: "var(--ice-3)", lineHeight: 1.85, fontWeight: 300 }}>{d}</div>
                </div>
              ))}
            </div>

            {/* 7 checks */}
            <div style={{ border: "1px solid var(--border)", padding: "32px" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--ice-3)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "20px" }}>The 7 compliance checks — enforced on every gate call, in order</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
                {[
                  ["Gate status", "GatePaused"],
                  ["Attestation exists", "NoAttestation"],
                  ["Not revoked", "AttestationRevoked"],
                  ["Not expired", "AttestationExpired"],
                  ["Trusted issuer", "UntrustedIssuer"],
                  ["Tier sufficient", "TierInsufficient"],
                  ["Jurisdiction eligible", "JurisdictionBlocked"],
                ].map(([label, code], i) => (
                  <div key={i} style={{ padding: "16px 14px", background: "var(--void)", borderLeft: i === 0 ? "none" : "1px solid var(--border)" }}>
                    <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--teal)", marginBottom: "10px" }} />
                    <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--ice-2)", marginBottom: "6px", lineHeight: 1.4 }}>{label}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: "8px", color: "var(--ice-3)", letterSpacing: "0.06em" }}>{code}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── WHO IT'S FOR ───────────────────────────────────────────────── */}
        <section style={{ position: "relative", zIndex: 1, borderTop: "1px solid var(--border)" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "96px 48px" }}>
            <div style={{ marginBottom: "56px" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--accent)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "16px" }}>Built for</div>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(32px, 3.5vw, 48px)", fontWeight: 400, lineHeight: 1.1, color: "var(--ice)", letterSpacing: "-0.02em" }}>
                Every institution that needs to prove compliance — not just promise it.
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "2px" }}>
              {[
                {
                  role: "Banks & Asset Managers",
                  icon: "⬡",
                  headline: "Launch institutional vaults without your legal team having a breakdown.",
                  points: [
                    "Deploy compliant vaults in hours, not quarters",
                    "KYC'd clients get immediate on-chain access",
                    "FATF R.16 compliant CSV export for regulators",
                    "One sanctioned wallet triggers instant revocation",
                    "FINMA, FCA, MAS alignment built in",
                  ],
                  cta: "Enter the vault",
                  href: "/portal",
                },
                {
                  role: "Vault Operators",
                  icon: "⬡",
                  headline: "Stop saying your vault is compliant. Start proving it.",
                  points: [
                    "Gate enforces compliance on every single interaction",
                    "Pause the vault instantly — with a documented reason",
                    "Change compliance rules without touching the contract",
                    "Live dashboard: approvals, denials, denial reasons",
                    "Audit log that no one — including you — can alter",
                  ],
                  cta: "See the dashboard",
                  href: "/admin",
                },
                {
                  role: "KYC / AML Providers",
                  icon: "⬡",
                  headline: "Turn your KYC database into on-chain infrastructure.",
                  points: [
                    "Issue signed attestations directly on Solana",
                    "Your verified clients access compliant vaults instantly",
                    "Tier-based credentials: Basic, Enhanced, Institutional",
                    "Jurisdiction-aware — CHE, GBR, SGP, DEU and more",
                    "Revoke credentials in one transaction if circumstances change",
                  ],
                  cta: "Issue credentials",
                  href: "/admin",
                },
                {
                  role: "Regulators & Auditors",
                  icon: "⬡",
                  headline: "Independent verification. No bank's word required.",
                  points: [
                    "Every gate call recorded permanently on Solana",
                    "Read audit records without asking the institution",
                    "FATF R.16 aligned fields — timestamp, wallet, outcome, reason",
                    "Cross-reference attestation PDA directly on-chain",
                    "Tamper-proof by protocol — not by policy",
                  ],
                  cta: "View audit log",
                  href: "/admin",
                },
              ].map(({ role, headline, points, cta, href }) => (
                <div key={role} className="card" style={{ padding: "36px" }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--accent)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "16px" }}>{role}</div>
                  <h3 style={{ fontFamily: "var(--serif)", fontSize: "20px", color: "var(--ice)", marginBottom: "24px", lineHeight: 1.3, fontWeight: 400 }}>{headline}</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0", marginBottom: "28px" }}>
                    {points.map((p, i) => (
                      <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--teal)", flexShrink: 0, marginTop: "5px" }} />
                        <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--ice-3)", lineHeight: 1.7, fontWeight: 300 }}>{p}</span>
                      </div>
                    ))}
                  </div>
                  <Link href={href} className="btn-secondary" style={{ fontSize: "10px", padding: "10px 20px" }}>
                    {cta} →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PROOF STRIP ───────────────────────────────────────────────── */}
        <section style={{ position: "relative", zIndex: 1, borderTop: "1px solid var(--border)", background: "var(--void-1)" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "64px 48px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "2px" }}>
              {[
                ["Gate Program", GATE_PROGRAM.slice(0, 16) + "...", "Solana devnet"],
                ["Pilot Partner", "AMINA Bank AG", "StableHacks 2026"],
                ["Compliance standard", "FATF R.16", "Wire transfer tracing"],
                ["Audit entries", count.toString() + " confirmed", "Live on-chain records"],
              ].map(([l, v, sub]) => (
                <div key={l} style={{ padding: "24px", border: "1px solid var(--border)" }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "8px", color: "var(--ice-3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>{l}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "13px", color: "var(--ice)", fontWeight: 500, marginBottom: "4px" }}>{v}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--ice-3)" }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ──────────────────────────────────────────────────── */}
        <section style={{ position: "relative", zIndex: 1, borderTop: "1px solid var(--border)" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "120px 48px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--accent)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "24px" }}>
              The infrastructure exists. The compliance problem is solved.
            </div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(40px, 5vw, 64px)", fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.02em", color: "var(--ice)", marginBottom: "20px" }}>
              Your institutional vault<br />
              <em style={{ color: "var(--accent)", fontStyle: "italic" }}>goes live today.</em>
            </h2>
            <p style={{ fontFamily: "var(--mono)", fontSize: "14px", color: "var(--ice-3)", lineHeight: 1.9, maxWidth: "480px", margin: "0 auto 48px", fontWeight: 300 }}>
              Not after your legal review. Not after your compliance team's six-month audit. Not after you rebuild your tech stack. Today. With credentials your KYC provider already issued.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/portal" className="btn-primary" style={{ fontSize: "12px", padding: "16px 36px" }}>
                Access Your Vaults →
              </Link>
              <Link href="/admin" className="btn-secondary" style={{ fontSize: "12px", padding: "16px 36px" }}>
                Open Institutional Console
              </Link>
            </div>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid var(--border)", padding: "24px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: "10px", fontWeight: 500, letterSpacing: "0.24em", color: "var(--ice-3)" }}>LEYFIS</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--ice-3)", fontWeight: 300 }}>Institutional compliance infrastructure on Solana</span>
          </div>
          <div style={{ display: "flex", gap: "24px" }}>
            {[
              ["Vault Access", "/portal"],
              ["Admin Console", "/admin"],
              ["Gate Program", `https://explorer.solana.com/address/${GATE_PROGRAM}?cluster=devnet`],
              ["GitHub", "https://github.com/thinkDecade/leyfis"],
            ].map(([l, h]) => (
              <a key={l} href={h} style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--ice-3)", letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }} target={h.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{l}</a>
            ))}
          </div>
        </footer>
      </main>
    </>
  );
}
