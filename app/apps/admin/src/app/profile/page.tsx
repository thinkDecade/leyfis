"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import {
  getComplianceProfile, ComplianceProfile, AttestationSummary, VaultFootprint,
  shortAddr, addressUrl, formatTs, REASON_CODES, TIERS,
} from "@leyfis/shared";

const m = { fontFamily: "'DM Mono', monospace" };
const f = { fontFamily: "'Inter', sans-serif" };

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", letterSpacing: "0.14em",
      textTransform: "uppercase", marginBottom: "6px" }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", padding: "20px 24px", background: "var(--bg-1)" }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ ...f, fontSize: "28px", fontWeight: 800, color: accent ?? "var(--text-1)",
        lineHeight: 1, marginBottom: "6px" }}>{value}</div>
      {sub && <div style={{ ...m, fontSize: "11px", color: "var(--text-4)" }}>{sub}</div>}
    </div>
  );
}

function TierBadge({ tier }: { tier: number }) {
  const colors: Record<number, string> = { 3: "var(--success)", 2: "var(--accent)", 1: "var(--muted)" };
  const labels: Record<number, string> = { 3: "Institutional", 2: "Enhanced DD", 1: "Basic KYC" };
  const c = colors[tier] ?? "var(--text-4)";
  return (
    <span style={{ ...m, fontSize: "11px", fontWeight: 700, color: c, letterSpacing: "0.08em",
      textTransform: "uppercase", border: `1px solid ${c}`, padding: "3px 8px", borderRadius: "2px" }}>
      {tier > 0 ? `Tier ${tier} — ${labels[tier] ?? "Unknown"}` : "No Tier"}
    </span>
  );
}

function timeAgo(ts: number) {
  const d = Math.floor(Date.now() / 1000 - ts);
  if (d < 60)    return `${d}s ago`;
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(ts * 1000).toLocaleDateString("en-CH", { day: "2-digit", month: "short", year: "2-digit" });
}

function copyToClipboard(text: string) {
  if (typeof navigator !== "undefined") navigator.clipboard.writeText(text).catch(() => {});
}

// ─── Denial bar chart ─────────────────────────────────────────────────────────

function DenialChart({ breakdown, total }: { breakdown: ComplianceProfile["denial_breakdown"]; total: number }) {
  const entries = [
    { label: "No Attestation",    value: breakdown.no_attestation,       code: 1 },
    { label: "Expired",           value: breakdown.expired,              code: 2 },
    { label: "Revoked",           value: breakdown.revoked,              code: 3 },
    { label: "Untrusted Issuer",  value: breakdown.untrusted_issuer,     code: 4 },
    { label: "Tier Insufficient", value: breakdown.tier_insufficient,    code: 5 },
    { label: "Jurisdiction",      value: breakdown.jurisdiction_blocked, code: 6 },
    { label: "Gate Paused",       value: breakdown.gate_paused,          code: 7 },
  ].filter(e => e.value > 0);

  if (entries.length === 0) return (
    <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", padding: "20px 0" }}>No denials recorded.</div>
  );

  const max = Math.max(...entries.map(e => e.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {entries.map(({ label, value, code }) => (
        <div key={code} style={{ display: "grid", gridTemplateColumns: "160px 1fr 40px", gap: "12px", alignItems: "center" }}>
          <span style={{ ...m, fontSize: "12px", color: "var(--text-3)" }}>{label}</span>
          <div style={{ background: "var(--bg-2)", borderRadius: "2px", height: "8px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(value / max) * 100}%`,
              background: "var(--danger)", borderRadius: "2px", transition: "width 0.6s ease" }}/>
          </div>
          <span style={{ ...m, fontSize: "12px", color: "var(--danger)", textAlign: "right" }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Attestation table ────────────────────────────────────────────────────────

function AttestationTable({ attestations }: { attestations: AttestationSummary[] }) {
  if (attestations.length === 0) return (
    <div style={{ padding: "24px 0" }}>
      <div style={{ ...f, fontSize: "14px", fontWeight: 600, color: "var(--text-2)", marginBottom: "6px" }}>No attestations found.</div>
      <div style={{ ...m, fontSize: "12px", color: "var(--text-4)", lineHeight: 1.7 }}>This wallet has not been issued a KYC credential by any registered issuer.</div>
    </div>
  );

  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--bg-1)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px 100px 140px 80px",
        gap: "12px", padding: "10px 20px", ...m, fontSize: "8px", color: "var(--text-4)",
        letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>
        <span>Status</span><span>Issuer</span><span>Tier</span>
        <span>Jurisdiction</span><span>Expires</span><span>Issued</span>
      </div>
      {attestations.map((att, i) => {
        const statusColor = att.status === "valid" ? "var(--success)"
          : att.status === "revoked" ? "var(--danger)" : "var(--muted)";
        return (
          <div key={att.pda} style={{
            display: "grid", gridTemplateColumns: "80px 1fr 80px 100px 140px 80px",
            gap: "12px", padding: "12px 20px", alignItems: "center",
            borderBottom: i < attestations.length - 1 ? "1px solid var(--border)" : "none",
            borderLeft: `3px solid ${statusColor}`,
            background: i % 2 === 1 ? "var(--bg-2)" : "transparent",
          }}>
            <span style={{ ...m, fontSize: "11px", fontWeight: 700, color: statusColor,
              letterSpacing: "0.08em", textTransform: "uppercase" }}>{att.status}</span>
            <a href={addressUrl(att.pda)} target="_blank" rel="noreferrer"
              style={{ ...m, fontSize: "12px", color: "var(--accent)", textDecoration: "none" }}
              title={att.issuer}>
              {shortAddr(att.issuer, 6)}
            </a>
            <TierBadge tier={att.tier} />
            <span style={{ ...m, fontSize: "12px", color: "var(--text-3)" }}>{att.jurisdiction || "—"}</span>
            <span style={{ ...m, fontSize: "12px", color: "var(--text-3)" }}>{att.expires_at > 0 ? formatTs(att.expires_at) : "Never"}</span>
            <span style={{ ...m, fontSize: "12px", color: "var(--text-4)" }}>{timeAgo(att.issued_at)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Gate history ─────────────────────────────────────────────────────────────

function GateHistoryTable({ profile }: { profile: ComplianceProfile }) {
  const [filter, setFilter] = useState<"all" | "approved" | "denied">("all");
  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
        {(["all", "approved", "denied"] as const).map(f2 => (
          <button key={f2} onClick={() => setFilter(f2)} style={{
            ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "8px 14px",
            background: filter === f2 ? "var(--accent)" : "var(--bg-1)",
            color: filter === f2 ? "white" : "var(--text-3)",
            border: `1px solid ${filter === f2 ? "var(--accent)" : "var(--border)"}`,
            cursor: "pointer",
          }}>
            {f2 === "denied" ? "rejected" : f2}
          </button>
        ))}
        <a href="/audit" style={{ ...m, fontSize: "11px", color: "var(--accent)", marginLeft: "auto",
          textDecoration: "none", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Full audit log →
        </a>
      </div>

      {profile.vault_history.length === 0 ? (
        <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", padding: "20px 0" }}>
          No gate interactions recorded for this wallet.
        </div>
      ) : (
        <div style={{ border: "1px solid var(--border)", background: "var(--bg-1)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 120px 120px",
            gap: "12px", padding: "10px 20px", ...m, fontSize: "8px", color: "var(--text-4)",
            letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>
            <span>Vault</span><span>Calls</span><span>Approved</span><span>Rate</span>
            <span>First Seen</span><span>Last Seen</span>
          </div>
          {profile.vault_history
            .filter(v => {
              if (filter === "approved") return v.approved_calls > 0;
              if (filter === "denied")   return v.total_calls - v.approved_calls > 0;
              return true;
            })
            .map((v, i) => (
              <div key={v.vault} style={{
                display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 120px 120px",
                gap: "12px", padding: "12px 20px", alignItems: "center",
                borderBottom: i < profile.vault_history.length - 1 ? "1px solid var(--border)" : "none",
                background: i % 2 === 1 ? "var(--bg-2)" : "transparent",
              }}>
                <a href={addressUrl(v.vault)} target="_blank" rel="noreferrer"
                  style={{ ...m, fontSize: "12px", color: "var(--accent)", textDecoration: "none" }}>
                  {shortAddr(v.vault, 8)}
                </a>
                <span style={{ ...m, fontSize: "12px", color: "var(--text-2)" }}>{v.total_calls}</span>
                <span style={{ ...m, fontSize: "12px", color: "var(--success)" }}>{v.approved_calls}</span>
                <span style={{ ...m, fontSize: "12px",
                  color: v.approval_rate >= 0.9 ? "var(--success)" : v.approval_rate >= 0.5 ? "var(--muted)" : "var(--danger)" }}>
                  {Math.round(v.approval_rate * 100)}%
                </span>
                <span style={{ ...m, fontSize: "12px", color: "var(--text-4)" }}>{timeAgo(v.first_interaction)}</span>
                <span style={{ ...m, fontSize: "12px", color: "var(--text-4)" }}>{timeAgo(v.last_interaction)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Vault footprint grid ─────────────────────────────────────────────────────

function VaultFootprintGrid({ vaults }: { vaults: VaultFootprint[] }) {
  if (vaults.length === 0) return (
    <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", padding: "20px 0" }}>
      No vault interactions on record.
    </div>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px" }}>
      {vaults.map(v => (
        <div key={v.vault} style={{ padding: "18px 20px", border: "1px solid var(--border)", background: "var(--bg-1)" }}>
          <SectionLabel>Vault</SectionLabel>
          <a href={addressUrl(v.vault)} target="_blank" rel="noreferrer"
            style={{ ...m, fontSize: "11px", color: "var(--accent)", textDecoration: "none", display: "block", marginBottom: "12px" }}>
            {shortAddr(v.vault, 8)}
          </a>
          <div style={{ display: "flex", gap: "24px" }}>
            {[
              { l: "Total Calls", v: v.total_calls.toString() },
              { l: "Approved",    v: v.approved_calls.toString() },
              { l: "Rate",        v: `${Math.round(v.approval_rate * 100)}%` },
            ].map(({ l, v: val }) => (
              <div key={l}>
                <div style={{ ...m, fontSize: "8px", color: "var(--text-4)", letterSpacing: "0.1em",
                  textTransform: "uppercase", marginBottom: "2px" }}>{l}</div>
                <div style={{ ...f, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", marginTop: "10px" }}>
            First seen {timeAgo(v.first_interaction)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Inner page (reads search params) ────────────────────────────────────────

function ProfileInner() {
  const searchParams = useSearchParams();
  const pubkey = searchParams.get("wallet") ?? "";

  const [mounted,  setMounted]  = useState(false);
  const [profile,  setProfile]  = useState<ComplianceProfile | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [copied,   setCopied]   = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !pubkey) return;
    setLoading(true);
    setError(null);
    setProfile(null);
    getComplianceProfile(pubkey)
      .then(p => { setProfile(p); setLoading(false); })
      .catch(e => { setError(e?.message ?? "Failed to load profile"); setLoading(false); });
  }, [mounted, pubkey]);

  if (!mounted) return null;

  function handleCopy() {
    copyToClipboard(pubkey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const approvalPct = profile && profile.approval_rate >= 0
    ? `${Math.round(profile.approval_rate * 100)}%` : "—";
  const approvalColor = profile
    ? profile.approval_rate >= 0.9 ? "var(--success)"
    : profile.approval_rate >= 0.5 ? "var(--muted)"
    : profile.approval_rate >= 0   ? "var(--danger)"
    : "var(--text-4)"
    : "var(--text-1)";

  if (!pubkey) return (
    <div style={{ padding: "48px 0", textAlign: "center" }}>
      <div style={{ ...f, fontSize: "18px", fontWeight: 600, color: "var(--text-2)", marginBottom: "8px" }}>
        No wallet specified
      </div>
      <div style={{ ...m, fontSize: "11px", color: "var(--text-4)" }}>
        Navigate here from the audit log, live feed, or attestation registry.
      </div>
    </div>
  );

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "32px", paddingBottom: "24px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", letterSpacing: "0.16em",
          textTransform: "uppercase", marginBottom: "10px" }}>
          /bureau — Compliance Profile
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", flexWrap: "wrap" }}>
          <h1 style={{ ...m, fontSize: "18px", fontWeight: 700, color: "var(--text-1)",
            letterSpacing: "0.04em", margin: 0 }}>
            {shortAddr(pubkey, 12)}
          </h1>
          <button onClick={handleCopy} style={{ ...m, fontSize: "11px", color: "var(--accent)",
            background: "none", border: "1px solid var(--accent)", padding: "4px 10px",
            cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <a href={`https://explorer.solana.com/address/${pubkey}?cluster=devnet`}
            target="_blank" rel="noreferrer"
            style={{ ...m, fontSize: "11px", color: "var(--text-3)", border: "1px solid var(--border)",
              padding: "4px 10px", textDecoration: "none", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Explorer ↗
          </a>
          <span style={{ ...m, fontSize: "11px", color: "var(--text-4)", padding: "4px 10px",
            border: "1px solid var(--border)", background: "var(--bg-1)" }}>
            Wallet
          </span>
        </div>
        <div style={{ ...m, fontSize: "12px", color: "var(--text-4)", lineHeight: 1.7 }}>
          Compliance profile derived from immutable on-chain data. Any counterparty can independently
          verify this profile from the same AuditEntry and attestation accounts.
        </div>
      </div>

      {loading && (
        <div style={{ padding: "48px 0", textAlign: "center" }}>
          <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", marginBottom: "8px" }}>
            Fetching on-chain compliance data...
          </div>
          <div style={{ ...m, fontSize: "11px", color: "var(--text-5)" }}>
            Scanning audit entries · Reading attestation accounts
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: "20px", background: "rgba(220,38,38,0.08)", border: "1px solid var(--danger)",
          ...m, fontSize: "11px", color: "var(--danger)", marginBottom: "24px" }}>
          {error}
        </div>
      )}

      {!loading && profile && (
        <>
          {/* Row 1: Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "2px", marginBottom: "24px" }}>
            <StatCard
              label="Compliance Score"
              value="—"
              sub="Coming soon · LCS model in development"
              accent="var(--text-4)"
            />
            <StatCard
              label="Highest Tier"
              value={profile.highest_tier > 0 ? `Tier ${profile.highest_tier}` : "None"}
              sub={TIERS[profile.highest_tier] ?? "No active attestation"}
              accent={profile.highest_tier === 3 ? "var(--success)"
                : profile.highest_tier >= 1 ? "var(--accent)" : "var(--text-4)"}
            />
            <StatCard
              label="Total Gate Calls"
              value={profile.total_gate_calls > 0 ? profile.total_gate_calls.toString() : "None"}
              sub={profile.total_gate_calls > 0
                ? `First seen ${timeAgo(profile.first_seen_timestamp!)}`
                : "No gate interactions recorded"}
            />
            <StatCard
              label="Approval Rate"
              value={approvalPct}
              sub={profile.total_gate_calls > 0
                ? `${profile.approved_calls} approved · ${profile.denied_calls} denied`
                : "No gate calls to measure"}
              accent={approvalColor}
            />
          </div>

          {/* Row 2: Attestations */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h2 style={{ ...f, fontSize: "15px", fontWeight: 700, color: "var(--text-1)", margin: 0 }}>Attestations</h2>
              <span style={{ ...m, fontSize: "11px", color: "var(--text-4)" }}>
                {profile.active_attestations} active · {profile.attestations.length} total
              </span>
            </div>
            <AttestationTable attestations={profile.attestations} />
          </div>

          {/* Row 3: Gate interaction history */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h2 style={{ ...f, fontSize: "15px", fontWeight: 700, color: "var(--text-1)", margin: 0 }}>Gate Interaction History</h2>
              {profile.last_seen_timestamp && (
                <span style={{ ...m, fontSize: "11px", color: "var(--text-4)" }}>
                  Last activity {timeAgo(profile.last_seen_timestamp)}
                </span>
              )}
            </div>
            <GateHistoryTable profile={profile} />
          </div>

          {/* Row 4: Vault footprint */}
          <div style={{ marginBottom: "32px" }}>
            <h2 style={{ ...f, fontSize: "15px", fontWeight: 700, color: "var(--text-1)", margin: "0 0 12px 0" }}>
              Vault Footprint
            </h2>
            <VaultFootprintGrid vaults={profile.vault_history} />
          </div>

          {/* Row 5: Denial analysis */}
          {profile.denied_calls > 0 && (
            <div style={{ marginBottom: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h2 style={{ ...f, fontSize: "15px", fontWeight: 700, color: "var(--text-1)", margin: 0 }}>Denial Analysis</h2>
                <span style={{ ...m, fontSize: "11px", color: "var(--text-4)" }}>
                  {profile.denied_calls} rejection{profile.denied_calls !== 1 ? "s" : ""} on record
                </span>
              </div>
              <div style={{ border: "1px solid var(--border)", padding: "20px 24px", background: "var(--bg-1)" }}>
                <DenialChart breakdown={profile.denial_breakdown} total={profile.denied_calls} />
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ ...m, fontSize: "11px", color: "var(--text-5)", padding: "16px 0",
            borderTop: "1px solid var(--border)", display: "flex", gap: "24px", flexWrap: "wrap" }}>
            <span>Profile computed {formatTs(profile.profile_timestamp)}</span>
            <span>·</span>
            <span>Data source: Solana devnet · Gate program{" "}
              <a href="https://explorer.solana.com/address/Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP?cluster=devnet"
                target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>
                Cskp4z...QZVP ↗
              </a>
            </span>
            <span>·</span>
            <span>Independently verifiable on Solana Explorer</span>
          </div>
        </>
      )}
    </>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  return (
    <AdminShell current="/profile">
      <div style={{ marginBottom: "32px", paddingBottom: "24px" }}>
        <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", letterSpacing: "0.16em",
          textTransform: "uppercase", marginBottom: "10px" }}>/bureau — Compliance Profile</div>
      </div>
      <Suspense fallback={
        <div style={{ padding: "48px 0", textAlign: "center", ...m, fontSize: "11px", color: "var(--text-4)" }}>
          Loading...
        </div>
      }>
        <ProfileInner />
      </Suspense>
    </AdminShell>
  );
}
