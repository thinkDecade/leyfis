"use client";
import { useEffect } from "react";
import { track } from "@leyfis/shared";

const m = { fontFamily: "'DM Mono', monospace" };
const f = { fontFamily: "'Inter', sans-serif" };

// ─── Feature comparison data ──────────────────────────────────────────────────
const ROWS = [
  { feature: "Protocol-level vault enforcement",         starter: true,          institutional: true,           enterprise: true },
  { feature: "Admin operations console",                 starter: true,          institutional: true,           enterprise: true },
  { feature: "Role-based access (4 roles)",              starter: true,          institutional: true,           enterprise: true },
  { feature: "Real-time gate activity feed",             starter: true,          institutional: true,           enterprise: true },
  { feature: "On-chain audit log (tamper-proof)",        starter: true,          institutional: true,           enterprise: true },
  { feature: "FATF R.16 CSV export",                    starter: true,          institutional: true,           enterprise: true },
  { feature: "Number of vaults",                        starter: "1",           institutional: "5",            enterprise: "Unlimited" },
  { feature: "Number of users",                         starter: "5",           institutional: "Unlimited",    enterprise: "Unlimited" },
  { feature: "AI compliance report generation",         starter: false,         institutional: true,           enterprise: true },
  { feature: "Multi-vault analytics",                   starter: false,         institutional: true,           enterprise: true },
  { feature: "Compliance Time Machine",                 starter: false,         institutional: true,           enterprise: true },
  { feature: "Regulatory Intelligence Agent",           starter: "Add-on",      institutional: "Add-on",       enterprise: "Add-on" },
  { feature: "Developer API access",                    starter: false,         institutional: "50K calls/mo", enterprise: "Unlimited" },
  { feature: "Custom SLAs and uptime guarantees",       starter: false,         institutional: false,          enterprise: true },
  { feature: "White-label option",                      starter: false,         institutional: false,          enterprise: true },
  { feature: "Dedicated support",                       starter: false,         institutional: false,          enterprise: true },
  { feature: "Custom regulatory feeds",                 starter: false,         institutional: false,          enterprise: true },
];

const FAQS = [
  {
    q: "How is Leyfis different from Chainalysis KYT?",
    a: "Chainalysis monitors and alerts. Leyfis enforces — it is architecturally impossible to bypass. A wallet that fails the gate cannot interact with the vault, regardless of how the transaction is constructed. Chainalysis costs $50K–$300K/year for institutional contracts. Leyfis Starter is $30K/year and provides enforcement that Chainalysis cannot offer. The two products are complementary: use Chainalysis for portfolio monitoring and Leyfis for protocol-level enforcement.",
  },
  {
    q: "What is a gate() call?",
    a: "Every interaction with a Leyfis-gated vault routes through the gate() instruction on-chain. The gate validates seven compliance checks in sequence (attestation existence, revocation status, expiry, issuer trust, credential tier, jurisdiction eligibility, and gate pause state) before allowing the vault interaction to proceed. Every call — approved or denied — writes a permanent audit entry. A gate() call is a single vault interaction attempt.",
  },
  {
    q: "We already have a KYC provider. Do we still need Leyfis?",
    a: "Yes. Your KYC provider verifies identity. Leyfis enforces those verifications at the protocol level. Without Leyfis, a wallet that your KYC provider has flagged can still interact directly with your vault's smart contract — there is no on-chain barrier. Leyfis is the enforcement layer that makes your KYC provider's decisions binding at the protocol level.",
  },
  {
    q: "What happens to the audit log if we stop using Leyfis?",
    a: "Nothing. The audit log is permanently stored on Solana. It cannot be deleted, modified, or removed by anyone, including Leyfis. Every gate call ever made is permanently on-chain and publicly verifiable. You own the audit record — it belongs to you and your regulator, not to us.",
  },
  {
    q: "Is this available on Solana mainnet?",
    a: "The current deployment is on Solana devnet for the pilot phase. Mainnet deployment is planned for Q3 2026 as part of the institutional pilot with AMINA Bank. Enterprise customers joining the pilot will deploy on mainnet from day one.",
  },
];

type RowValue = boolean | string;

function Check() {
  return <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "rgba(22,163,74,0.12)", border: "1px solid rgba(22,163,74,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="var(--success, #16a34a)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>;
}

function X() {
  return <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><div style={{ width: "8px", height: "1px", background: "var(--text-4, #3D5070)" }} /></div>;
}

function Cell({ value }: { value: RowValue }) {
  if (value === true)  return <Check />;
  if (value === false) return <X />;
  return <span style={{ ...m, fontSize: "10px", color: "var(--accent, #4A80D4)", letterSpacing: "0.04em" }}>{value}</span>;
}

function PlanCard({ name, price, sub, annual, highlight, features, cta }: {
  name: string; price: string; sub: string; annual: string;
  highlight?: boolean; features: string[]; cta: string;
}) {
  return (
    <div style={{ border: `1px solid ${highlight ? "var(--accent, #4A80D4)" : "var(--border, #1E2A3B)"}`, background: highlight ? "rgba(74,128,212,0.04)" : "var(--bg-1, #0D1524)", padding: "32px 28px", display: "flex", flexDirection: "column", gap: "20px", position: "relative" }}>
      {highlight && (
        <div style={{ position: "absolute", top: "-1px", left: "50%", transform: "translateX(-50%)", background: "var(--accent, #4A80D4)", padding: "3px 16px" }}>
          <span style={{ ...m, fontSize: "9px", color: "white", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>Most popular</span>
        </div>
      )}
      <div>
        <div style={{ ...m, fontSize: "9px", color: "var(--text-4, #3D5070)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "8px" }}>{name}</div>
        <div style={{ ...f, fontSize: "32px", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-1, #E8EEF6)", lineHeight: 1, marginBottom: "4px" }}>{price}</div>
        <div style={{ ...m, fontSize: "10px", color: "var(--text-4, #3D5070)" }}>{sub}</div>
        <div style={{ ...m, fontSize: "9px", color: "var(--accent, #4A80D4)", marginTop: "6px" }}>{annual}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {features.map((feat, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <Check />
            <span style={{ ...m, fontSize: "10px", color: "var(--text-2, #8899BB)", lineHeight: 1.5 }}>{feat}</span>
          </div>
        ))}
      </div>

      <a
        href="mailto:contact@leyfis.io"
        style={{ ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: highlight ? "var(--accent, #4A80D4)" : "transparent", color: highlight ? "white" : "var(--accent, #4A80D4)", border: `1px solid var(--accent, #4A80D4)`, padding: "13px 20px", cursor: "pointer", fontWeight: 700, textAlign: "center", textDecoration: "none", display: "block", marginTop: "auto" }}
      >
        {cta}
      </a>
    </div>
  );
}

export default function PricingPage() {
  useEffect(() => { track({ event: "pricing_page_viewed" }); }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #0A0F1C)", color: "var(--text-1, #E8EEF6)" }}>

      {/* Nav */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg, #0A0F1C)", borderBottom: "1px solid var(--border, #1E2A3B)" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
          <div style={{ width: "28px", height: "28px", background: "var(--accent, #4A80D4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 56 56" fill="none"><rect x="8" y="16" width="7" height="32" fill="white"/><rect x="41" y="16" width="7" height="32" fill="white"/><rect x="8" y="13" width="40" height="6" fill="white"/><rect x="18" y="19" width="20" height="29" fill="var(--accent, #4A80D4)"/></svg>
          </div>
          <span style={{ ...f, fontSize: "13px", fontWeight: 800, letterSpacing: "0.2em", color: "var(--text-1, #E8EEF6)" }}>LEYFIS</span>
        </a>
        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          <a href="/portal" style={{ ...m, fontSize: "11px", color: "var(--text-3, #8899BB)", textDecoration: "none", letterSpacing: "0.06em" }}>Demo</a>
          <a href="mailto:contact@leyfis.io" style={{ ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--accent, #4A80D4)", color: "white", padding: "8px 18px", textDecoration: "none", fontWeight: 700 }}>Request pilot</a>
        </div>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 40px" }}>

        {/* Hero */}
        <div style={{ padding: "80px 0 64px", textAlign: "center" }}>
          <div style={{ ...m, fontSize: "10px", color: "var(--accent, #4A80D4)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "20px" }}>Institutional compliance infrastructure</div>
          <h1 style={{ ...f, fontSize: "48px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, color: "var(--text-1, #E8EEF6)", marginBottom: "20px" }}>
            Enforcement infrastructure.<br />Not monitoring software.
          </h1>
          <p style={{ ...m, fontSize: "12px", color: "var(--text-3, #8899BB)", lineHeight: 1.9, maxWidth: "560px", margin: "0 auto 12px" }}>
            Chainalysis monitors and alerts. Leyfis enforces — at the protocol level.
            Bypass is architecturally impossible. Every approved gate call is permanently logged on Solana.
          </p>
          <div style={{ ...m, fontSize: "10px", color: "var(--text-4, #3D5070)", letterSpacing: "0.06em" }}>
            Chainalysis KYT: $50K–$300K/year · Leyfis Starter: $30K/year · All plans include protocol-level enforcement
          </div>
        </div>

        {/* Pricing cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2px", marginBottom: "80px" }}>
          <PlanCard
            name="Starter"
            price="$2,500"
            sub="per month · billed annually"
            annual="$30,000/year · 2 months free with annual plan"
            features={[
              "1 vault",
              "5 users",
              "Full admin operations console",
              "Role-based access (4 roles)",
              "On-chain audit log",
              "FATF R.16 CSV export",
              "Real-time gate activity feed",
              "Protocol fee on approved calls",
            ]}
            cta="Request access"
          />
          <PlanCard
            name="Institutional"
            price="$8,000"
            sub="per month · billed annually"
            annual="$96,000/year · 2 months free with annual plan"
            highlight
            features={[
              "5 vaults",
              "Unlimited users",
              "Everything in Starter",
              "AI compliance report generation",
              "Multi-vault analytics",
              "Compliance Time Machine",
              "Developer API (50K calls/month)",
              "Regulatory Intelligence add-on eligible",
            ]}
            cta="Request pilot"
          />
          <PlanCard
            name="Enterprise"
            price="Custom"
            sub="from $15,000/month"
            annual="Annual contract · custom terms available"
            features={[
              "Unlimited vaults",
              "Unlimited users",
              "Everything in Institutional",
              "Unlimited API calls",
              "Custom SLAs and uptime guarantee",
              "White-label option",
              "Dedicated support team",
              "Custom regulatory feeds",
            ]}
            cta="Talk to us"
          />
        </div>

        {/* Regulatory Intelligence add-on */}
        <div style={{ border: "1px solid var(--border, #1E2A3B)", padding: "40px", background: "var(--bg-1, #0D1524)", marginBottom: "80px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "40px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "300px" }}>
              <div style={{ ...m, fontSize: "9px", color: "var(--text-4, #3D5070)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "10px" }}>Add-on · Available on any plan</div>
              <h2 style={{ ...f, fontSize: "22px", fontWeight: 700, color: "var(--text-1, #E8EEF6)", marginBottom: "12px" }}>Regulatory Intelligence</h2>
              <p style={{ ...m, fontSize: "11px", color: "var(--text-3, #8899BB)", lineHeight: 1.85 }}>
                AI-monitored regulatory feeds across FATF, FINMA, MiCA, MAS, and FinCEN.
                Detects relevant changes and proposes vault parameter updates — one click to apply on-chain.
                Your compliance officer sees the same update 10 seconds after publication, not 3 weeks later.
              </p>
            </div>
            <div style={{ display: "flex", gap: "2px" }}>
              {[
                { name: "Starter", price: "+$3,000/mo", features: ["AI compliance reports", "3 jurisdictions monitored", "Proposal queue"] },
                { name: "Pro", price: "+$8,000/mo", features: ["Unlimited jurisdictions", "Anomaly detection", "Custom alert thresholds"] },
              ].map((t, i) => (
                <div key={i} style={{ border: "1px solid var(--border, #1E2A3B)", padding: "24px", background: "var(--bg-2, #111827)", minWidth: "200px" }}>
                  <div style={{ ...m, fontSize: "9px", color: "var(--text-4, #3D5070)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>{t.name}</div>
                  <div style={{ ...f, fontSize: "20px", fontWeight: 800, color: "var(--accent, #4A80D4)", marginBottom: "16px" }}>{t.price}</div>
                  {t.features.map((feat, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <Check />
                      <span style={{ ...m, fontSize: "10px", color: "var(--text-2, #8899BB)" }}>{feat}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comparison table */}
        <div style={{ marginBottom: "80px" }}>
          <div style={{ ...m, fontSize: "9px", color: "var(--text-4, #3D5070)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "8px" }}>Full comparison</div>
          <h2 style={{ ...f, fontSize: "24px", fontWeight: 700, color: "var(--text-1, #E8EEF6)", marginBottom: "32px" }}>Every feature, every plan</h2>

          <div style={{ border: "1px solid var(--border, #1E2A3B)" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 120px", gap: "1px", background: "var(--border, #1E2A3B)", borderBottom: "1px solid var(--border, #1E2A3B)" }}>
              <div style={{ background: "var(--bg-1, #0D1524)", padding: "14px 20px" }} />
              {["Starter", "Institutional", "Enterprise"].map(name => (
                <div key={name} style={{ background: "var(--bg-1, #0D1524)", padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ ...m, fontSize: "9px", color: "var(--text-3, #8899BB)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{name}</div>
                </div>
              ))}
            </div>
            {/* Rows */}
            {ROWS.map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 120px", borderBottom: i < ROWS.length - 1 ? "1px solid var(--border, #1E2A3B)" : "none" }}>
                <div style={{ padding: "13px 20px", background: "var(--bg-1, #0D1524)" }}>
                  <span style={{ ...m, fontSize: "10px", color: "var(--text-2, #8899BB)" }}>{row.feature}</span>
                </div>
                {([row.starter, row.institutional, row.enterprise] as RowValue[]).map((val, j) => (
                  <div key={j} style={{ padding: "13px 16px", background: j === 1 ? "rgba(74,128,212,0.03)" : "var(--bg-1, #0D1524)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Cell value={val} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* What you're replacing */}
        <div style={{ marginBottom: "80px", padding: "48px 40px", background: "var(--bg-1, #0D1524)", border: "1px solid var(--border, #1E2A3B)" }}>
          <div style={{ ...m, fontSize: "9px", color: "var(--text-4, #3D5070)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>ROI case</div>
          <h2 style={{ ...f, fontSize: "22px", fontWeight: 700, color: "var(--text-1, #E8EEF6)", marginBottom: "32px" }}>What you're replacing</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2px" }}>
            {[
              { label: "Chainalysis KYT (monitoring only)", cost: "$50K–$300K/year", note: "Monitors and alerts. Cannot enforce at the protocol level. Bypass possible by calling the contract directly.", bad: true },
              { label: "Manual compliance analyst time", cost: "$250–$400/hour", note: "FATF report generation: 14 analyst hours per report. With Leyfis AI: 10 seconds. Every report is an evidence-grade audit artefact.", bad: true },
              { label: "Leyfis Institutional", cost: "$96K/year", note: "Protocol-level enforcement that cannot be bypassed. AI reports in 10 seconds. Permanent on-chain audit trail. FATF R.16 aligned out of the box.", bad: false },
            ].map((item, i) => (
              <div key={i} style={{ padding: "24px", border: `1px solid ${item.bad ? "var(--border, #1E2A3B)" : "rgba(22,163,74,0.3)"}`, background: item.bad ? "var(--bg-2, #111827)" : "rgba(22,163,74,0.04)" }}>
                <div style={{ ...m, fontSize: "9px", color: "var(--text-4, #3D5070)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>{item.label}</div>
                <div style={{ ...f, fontSize: "22px", fontWeight: 800, color: item.bad ? "var(--danger, #7A1F1F)" : "var(--success, #0F6E56)", marginBottom: "12px", lineHeight: 1 }}>{item.cost}</div>
                <div style={{ ...m, fontSize: "10px", color: "var(--text-3, #8899BB)", lineHeight: 1.75 }}>{item.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: "80px" }}>
          <div style={{ ...m, fontSize: "9px", color: "var(--text-4, #3D5070)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "8px" }}>Common questions</div>
          <h2 style={{ ...f, fontSize: "22px", fontWeight: 700, color: "var(--text-1, #E8EEF6)", marginBottom: "32px" }}>FAQ</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ border: "1px solid var(--border, #1E2A3B)", padding: "24px 28px", background: "var(--bg-1, #0D1524)" }}>
                <div style={{ ...f, fontSize: "14px", fontWeight: 600, color: "var(--text-1, #E8EEF6)", marginBottom: "10px" }}>{faq.q}</div>
                <div style={{ ...m, fontSize: "11px", color: "var(--text-3, #8899BB)", lineHeight: 1.85 }}>{faq.a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA footer */}
        <div style={{ padding: "64px 40px", textAlign: "center", border: "1px solid var(--border, #1E2A3B)", marginBottom: "80px", background: "var(--bg-1, #0D1524)" }}>
          <div style={{ ...m, fontSize: "9px", color: "var(--text-4, #3D5070)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "16px" }}>Ready to enforce compliance</div>
          <h2 style={{ ...f, fontSize: "28px", fontWeight: 800, color: "var(--text-1, #E8EEF6)", letterSpacing: "-0.02em", marginBottom: "14px" }}>Request a pilot deployment</h2>
          <p style={{ ...m, fontSize: "11px", color: "var(--text-3, #8899BB)", lineHeight: 1.85, maxWidth: "480px", margin: "0 auto 32px" }}>
            We deploy alongside your existing infrastructure. Pilot deployments are on Solana devnet.
            No credit card. Annual contract signed before mainnet deployment.
          </p>
          <a
            href="mailto:contact@leyfis.io?subject=Pilot deployment request"
            style={{ ...m, fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase", background: "var(--accent, #4A80D4)", color: "white", padding: "16px 40px", fontWeight: 700, textDecoration: "none", display: "inline-block" }}
          >
            Contact us — contact@leyfis.io
          </a>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border, #1E2A3B)", padding: "24px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ ...f, fontSize: "13px", fontWeight: 800, letterSpacing: "0.2em", color: "var(--text-4, #3D5070)" }}>LEYFIS</span>
        <span style={{ ...m, fontSize: "9px", color: "var(--text-4, #3D5070)", letterSpacing: "0.08em" }}>Institutional compliance infrastructure for Solana · contact@leyfis.io</span>
        <div style={{ display: "flex", gap: "20px" }}>
          <a href="/portal" style={{ ...m, fontSize: "10px", color: "var(--text-4, #3D5070)", textDecoration: "none" }}>Demo</a>
          <a href="/pricing" style={{ ...m, fontSize: "10px", color: "var(--text-4, #3D5070)", textDecoration: "none" }}>Pricing</a>
        </div>
      </div>
    </div>
  );
}
