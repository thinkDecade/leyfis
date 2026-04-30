"use client";

const m = { fontFamily: "'DM Mono', monospace" };
const f = { fontFamily: "'Inter', sans-serif" };

const PLAN_LABELS: Record<"institutional" | "enterprise", string> = {
  institutional: "Institutional — $8,000/mo",
  enterprise:    "Enterprise — Custom pricing",
};

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  "AI Compliance Reports":     "Generate FATF R.16 narrative reports from audit data in under 10 seconds.",
  "Regulatory Intelligence":   "AI-monitored FATF, FINMA, MiCA, MAS feeds with one-click config updates.",
  "Compliance Time Machine":   "Replay vault compliance state at any historical timestamp.",
  "Multi-Vault Analytics":     "Unified metrics and audit logs across all registered vaults.",
  "Developer API":             "Programmatic compliance access via REST API and MCP server.",
};

interface UpgradePromptProps {
  feature: string;
  requiredPlan: "institutional" | "enterprise";
}

export function UpgradePrompt({ feature, requiredPlan }: UpgradePromptProps) {
  const desc = FEATURE_DESCRIPTIONS[feature] || `${feature} is available on higher plans.`;

  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--bg-1)", padding: "48px 40px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "20px" }}>
      <div style={{ width: "48px", height: "48px", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="4" y="9" width="12" height="9" rx="1" stroke="var(--text-4)" strokeWidth="1.5"/>
          <path d="M7 9V6a3 3 0 016 0v3" stroke="var(--text-4)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>

      <div>
        <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "8px" }}>
          {PLAN_LABELS[requiredPlan]} required
        </div>
        <div style={{ ...f, fontSize: "18px", fontWeight: 700, color: "var(--text-1)", marginBottom: "8px" }}>
          {feature}
        </div>
        <div style={{ ...m, fontSize: "11px", color: "var(--text-3)", lineHeight: 1.75, maxWidth: "380px" }}>
          {desc}
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
        <a
          href="mailto:contact@leyfis.io?subject=Upgrade enquiry"
          style={{ ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--accent)", color: "white", border: "none", padding: "12px 24px", cursor: "pointer", fontWeight: 700, textDecoration: "none", display: "inline-block" }}
        >
          Upgrade plan
        </a>
        <a
          href="mailto:contact@leyfis.io"
          style={{ ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: "transparent", color: "var(--text-3)", border: "1px solid var(--border)", padding: "12px 24px", textDecoration: "none", display: "inline-block" }}
        >
          Talk to us
        </a>
      </div>

      <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", marginTop: "4px" }}>
        contact@leyfis.io · leyfis.io/pricing
      </div>
    </div>
  );
}
