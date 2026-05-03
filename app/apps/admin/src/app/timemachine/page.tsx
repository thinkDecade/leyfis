"use client";
import { useState, useCallback } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { AdminShell } from "@/components/AdminShell";
import {
  GATE_PROGRAM_ID, VAULT_PROGRAM_ID, RPC_ENDPOINT,
  SEEDS, shortAddr, addressUrl, REASON_CODES,
} from "@leyfis/shared";

// ─── Types ────────────────────────────────────────────────────────────────────
type AuditEntry = {
  wallet: string; vault: string; timestamp: number; slot: number;
  outcome: "approved" | "denied"; reasonCode: number; attestationId: string; tier: number;
};

type Snapshot = {
  asOf: number;
  totalCalls: number;
  approved: number;
  denied: number;
  approvalRate: number;
  denialBreakdown: Record<number, number>;
  topDenialCode: number | null;
  entries: AuditEntry[];
};

const GATE = new PublicKey(GATE_PROGRAM_ID);
const VAULT = new PublicKey(VAULT_PROGRAM_ID);

const m = { fontFamily: "'DM Mono', monospace" };
const f = { fontFamily: "'Inter', sans-serif" };

function tierLabel(t: number) {
  return t === 3 ? "Tier 3 — Institutional" : t === 2 ? "Tier 2 — Enhanced" : t === 1 ? "Tier 1 — Basic" : `Tier ${t}`;
}

async function fetchAuditNonce(): Promise<number> {
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  const [vcPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.VAULT_CONFIG), VAULT.toBuffer()], GATE);
  const info = await connection.getAccountInfo(vcPDA);
  if (!info) return 0;
  const d = info.data;
  const minTier = d[72];
  const issuerCount = d.readUInt32LE(73);
  const jurOff = 77 + issuerCount * 32;
  const jurCount = d.readUInt32LE(jurOff);
  const pOff = jurOff + 4 + jurCount * 3;
  void minTier;
  return Number(d.readBigUInt64LE(pOff + 9));
}

async function fetchAllEntries(auditNonce: number): Promise<AuditEntry[]> {
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  const [vcPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.VAULT_CONFIG), VAULT.toBuffer()], GATE);
  const entries: AuditEntry[] = [];
  for (let nonce = 0; nonce < auditNonce; nonce++) {
    try {
      const nonceBytes = Buffer.alloc(8);
      nonceBytes.writeBigUInt64LE(BigInt(nonce));
      const [auditPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.AUDIT_ENTRY), vcPDA.toBuffer(), nonceBytes], GATE);
      const info = await connection.getAccountInfo(auditPDA);
      if (!info || info.data.length < 8) continue;
      const d = info.data;
      entries.push({
        wallet: new PublicKey(d.slice(8, 40)).toBase58(),
        vault: new PublicKey(d.slice(40, 72)).toBase58(),
        timestamp: Number(d.readBigInt64LE(72)),
        slot: Number(d.readBigUInt64LE(80)),
        outcome: d[88] === 0 ? "approved" : "denied",
        reasonCode: d[89],
        attestationId: new PublicKey(d.slice(90, 122)).toBase58(),
        tier: d[122],
      });
    } catch { continue; }
  }
  return entries;
}

function buildSnapshot(entries: AuditEntry[], asOfTs: number): Snapshot {
  const filtered = entries.filter(e => e.timestamp <= asOfTs);
  const approved = filtered.filter(e => e.outcome === "approved").length;
  const denied = filtered.filter(e => e.outcome === "denied").length;
  const denialBreakdown: Record<number, number> = {};
  filtered.filter(e => e.outcome === "denied").forEach(e => {
    denialBreakdown[e.reasonCode] = (denialBreakdown[e.reasonCode] || 0) + 1;
  });
  const sorted = Object.entries(denialBreakdown).sort(([, a], [, b]) => b - a);
  return {
    asOf: asOfTs,
    totalCalls: filtered.length,
    approved,
    denied,
    approvalRate: filtered.length > 0 ? Math.round((approved / filtered.length) * 100) : 0,
    denialBreakdown,
    topDenialCode: sorted.length > 0 ? parseInt(sorted[0][0]) : null,
    entries: filtered.slice().reverse().slice(0, 15),
  };
}

function SectionLabel({ children }: { children: string }) {
  return <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>{children}</div>;
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", padding: "20px 24px", background: "var(--bg-1)" }}>
      <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px" }}>{label}</div>
      <div style={{ ...f, fontSize: "30px", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1, color, marginBottom: "6px" }}>{value}</div>
      <div style={{ ...m, fontSize: "12px", color: "var(--text-4)" }}>{sub}</div>
    </div>
  );
}

// ─── Preset shortcuts ─────────────────────────────────────────────────────────
const PRESETS = [
  { label: "1 hour ago",  offset: 3600 },
  { label: "24 hours ago", offset: 86400 },
  { label: "7 days ago",  offset: 7 * 86400 },
  { label: "30 days ago", offset: 30 * 86400 },
];

export default function TimeMachinePage() {
  const [dateInput, setDateInput] = useState(() => {
    const now = new Date();
    now.setHours(now.getHours() - 24);
    return now.toISOString().slice(0, 16);
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [allEntries, setAllEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const run = useCallback(async (tsOverride?: number) => {
    setLoading(true); setError(null); setSnapshot(null);
    try {
      const asOfTs = tsOverride ?? Math.floor(new Date(dateInput).getTime() / 1000);

      let entries = allEntries;
      if (!entries) {
        setProgress("Reading audit nonce...");
        const nonce = await fetchAuditNonce();
        setProgress(`Fetching ${nonce} audit entries from chain...`);
        entries = await fetchAllEntries(nonce);
        setAllEntries(entries);
        setFetched(true);
      }

      setProgress("Building snapshot...");
      setSnapshot(buildSnapshot(entries, asOfTs));
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, [dateInput, allEntries]);

  const applyPreset = (offset: number) => {
    const ts = Math.floor(Date.now() / 1000) - offset;
    const d = new Date(ts * 1000);
    setDateInput(d.toISOString().slice(0, 16));
    if (fetched && allEntries) {
      setSnapshot(buildSnapshot(allEntries, ts));
    }
  };

  const asOfDisplay = snapshot
    ? new Date(snapshot.asOf * 1000).toLocaleString("en-CH", { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <AdminShell current="/timemachine">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "32px", paddingBottom: "24px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "8px" }}>08 — Compliance Time Machine</div>
        <h1 style={{ ...f, fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)", marginBottom: "10px" }}>Compliance Time Machine</h1>
        <div style={{ ...m, fontSize: "11px", color: "var(--text-3)", lineHeight: 1.7, maxWidth: "640px" }}>
          Replay the on-chain audit log at any historical point in time. Select a date and time to see the approval rate, denial breakdown, and gate activity as it stood at that moment.
        </div>
      </div>

      {/* ── Time selector ───────────────────────────────────────────────── */}
      <div style={{ border: "1px solid var(--border)", padding: "28px", background: "var(--bg-1)", marginBottom: "20px" }}>
        <SectionLabel>Select point in time</SectionLabel>

        {/* Presets */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.offset)}
              style={{ ...m, fontSize: "12px", letterSpacing: "0.08em", padding: "7px 14px", background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-3)", cursor: "pointer" }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Date &amp; time (local)</div>
            <input
              type="datetime-local"
              value={dateInput}
              onChange={e => { setDateInput(e.target.value); setSnapshot(null); }}
              style={{ ...m, fontSize: "12px", background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-1)", padding: "10px 14px", outline: "none", minWidth: "260px" }}
            />
          </div>
          <button
            onClick={() => run()}
            disabled={loading}
            style={{ ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--accent)", color: "white", border: "none", padding: "11px 28px", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, opacity: loading ? 0.5 : 1 }}
          >
            {loading ? (progress || "Loading...") : fetched ? "Replay →" : "Load Audit Log →"}
          </button>
        </div>

        {fetched && (
          <div style={{ ...m, fontSize: "12px", color: "var(--success)", marginTop: "12px" }}>
            {allEntries?.length ?? 0} audit entries loaded. Change the date and click Replay → to re-slice instantly.
          </div>
        )}
        {error && (
          <div style={{ ...m, fontSize: "12px", color: "var(--danger)", marginTop: "12px", padding: "10px 14px", background: "var(--danger-bg)", border: "1px solid var(--danger-border)" }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Snapshot results ────────────────────────────────────────────── */}
      {snapshot && (
        <>
          {/* Snapshot header */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
            <div style={{ ...m, fontSize: "12px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Snapshot as of</div>
            <div style={{ ...m, fontSize: "13px", color: "var(--accent)", fontWeight: 600 }}>{asOfDisplay}</div>
            <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", padding: "3px 10px", border: "1px solid var(--border)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {snapshot.totalCalls} gate calls
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "2px", marginBottom: "20px" }}>
            <StatBox
              label="Gate Calls"
              value={snapshot.totalCalls.toString()}
              sub="Up to selected point in time"
              color="var(--text-1)"
            />
            <StatBox
              label="Approved"
              value={snapshot.approved.toString()}
              sub={`${snapshot.approvalRate}% approval rate`}
              color="var(--success)"
            />
            <StatBox
              label="Denied"
              value={snapshot.denied.toString()}
              sub={`${100 - snapshot.approvalRate}% block rate`}
              color="var(--danger)"
            />
            <StatBox
              label="Top Denial Reason"
              value={snapshot.topDenialCode !== null ? (REASON_CODES[snapshot.topDenialCode] ?? `Code ${snapshot.topDenialCode}`) : "—"}
              sub={snapshot.topDenialCode !== null ? `${snapshot.denialBreakdown[snapshot.topDenialCode]} occurrences` : "No denials"}
              color={snapshot.topDenialCode !== null ? "var(--danger)" : "var(--text-4)"}
            />
          </div>

          {/* Two-column: denial breakdown + entry list */}
          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "2px", marginBottom: "20px" }}>

            {/* Denial breakdown */}
            <div style={{ border: "1px solid var(--border)", padding: "24px", background: "var(--bg-1)" }}>
              <SectionLabel>Denial breakdown</SectionLabel>
              <div style={{ ...f, fontSize: "15px", fontWeight: 600, color: "var(--text-1)", marginBottom: "16px" }}>
                {snapshot.denied === 0 ? "No denials" : `${snapshot.denied} denial${snapshot.denied !== 1 ? "s" : ""}`}
              </div>
              {snapshot.denied === 0 ? (
                <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", lineHeight: 1.7 }}>
                  All gate calls approved up to this point in time.
                </div>
              ) : (
                Object.entries(snapshot.denialBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([code, count]) => {
                    const pct = snapshot.denied > 0 ? Math.round((count / snapshot.denied) * 100) : 0;
                    return (
                      <div key={code} style={{ display: "grid", gridTemplateColumns: "1fr 30px 40px", gap: "10px", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                        <span style={{ ...m, fontSize: "12px", color: "var(--text-2)", lineHeight: 1.4 }}>{REASON_CODES[parseInt(code)] || `Code ${code}`}</span>
                        <span style={{ ...m, fontSize: "12px", color: "var(--text-1)", fontWeight: 600, textAlign: "right" }}>{count}</span>
                        <span style={{ ...m, fontSize: "11px", color: "var(--text-4)", textAlign: "right" }}>{pct}%</span>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Entry list */}
            <div style={{ border: "1px solid var(--border)", background: "var(--bg-1)" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)" }}>
                <SectionLabel>Gate activity at this timestamp</SectionLabel>
                <div style={{ ...f, fontSize: "15px", fontWeight: 600, color: "var(--text-1)" }}>
                  {snapshot.entries.length === 0 ? "No calls recorded before this time" : `Last ${snapshot.entries.length} calls`}
                </div>
              </div>

              {snapshot.entries.length === 0 ? (
                <div style={{ padding: "24px", ...m, fontSize: "11px", color: "var(--text-4)", lineHeight: 1.7 }}>
                  No gate calls were recorded before the selected timestamp. Try moving the time forward.
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 160px 80px 100px", gap: "12px", padding: "10px 24px", ...m, fontSize: "8px", color: "var(--text-4)", letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>
                    <span>Result</span><span>Wallet</span><span>Reason</span><span>Tier</span><span>Time</span>
                  </div>
                  {snapshot.entries.map((e, i) => {
                    const d = Math.floor(Date.now() / 1000 - e.timestamp);
                    const timeAgo = d < 60 ? `${d}s ago` : d < 3600 ? `${Math.floor(d / 60)}m ago` : d < 86400 ? `${Math.floor(d / 3600)}h ago` : `${Math.floor(d / 86400)}d ago`;
                    return (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 160px 80px 100px", gap: "12px", padding: "12px 24px", borderBottom: i < snapshot.entries.length - 1 ? "1px solid var(--border)" : "none", ...m, fontSize: "11px", alignItems: "center", borderLeft: `3px solid ${e.outcome === "approved" ? "var(--success)" : "var(--danger)"}` }}>
                        <span style={{ color: e.outcome === "approved" ? "var(--success)" : "var(--danger)", fontWeight: 700, letterSpacing: "0.06em", fontSize: "11px", textTransform: "uppercase" }}>
                          {e.outcome === "approved" ? "PASS" : "DENY"}
                        </span>
                        <a href={addressUrl(e.wallet)} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>{shortAddr(e.wallet, 6)}</a>
                        <span style={{ color: "var(--text-3)" }}>{REASON_CODES[e.reasonCode] || `Code ${e.reasonCode}`}</span>
                        <span style={{ color: "var(--text-3)" }}>{e.tier > 0 ? `Tier ${e.tier}` : "—"}</span>
                        <span style={{ color: "var(--text-4)", fontSize: "12px" }}>{timeAgo}</span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* Tier distribution from this point */}
          {snapshot.approved > 0 && (
            <div style={{ border: "1px solid var(--border)", padding: "24px", background: "var(--bg-1)", marginBottom: "20px" }}>
              <SectionLabel>Approved wallet tier distribution</SectionLabel>
              <div style={{ ...f, fontSize: "15px", fontWeight: 600, color: "var(--text-1)", marginBottom: "16px" }}>
                {snapshot.approved} approved access{snapshot.approved !== 1 ? "es" : ""}
              </div>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                {[1, 2, 3].map(tier => {
                  const count = snapshot.entries.filter(e => e.outcome === "approved" && e.tier === tier).length;
                  const allApproved = snapshot.entries.filter(e => e.outcome === "approved");
                  const pct = allApproved.length > 0 ? Math.round((count / allApproved.length) * 100) : 0;
                  return (
                    <div key={tier} style={{ flex: 1, minWidth: "160px", border: "1px solid var(--border)", padding: "16px 20px", background: "var(--bg-2)" }}>
                      <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>{tierLabel(tier)}</div>
                      <div style={{ ...f, fontSize: "24px", fontWeight: 700, color: count > 0 ? "var(--success)" : "var(--text-4)", marginBottom: "4px" }}>{count}</div>
                      <div style={{ ...m, fontSize: "12px", color: "var(--text-4)" }}>{pct}% of approved</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FATF note */}
          <div style={{ padding: "18px 24px", border: "1px solid var(--border)", background: "var(--bg-1)", display: "flex", gap: "16px", alignItems: "flex-start" }}>
            <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0, marginTop: "2px" }}>FATF note</div>
            <div style={{ ...m, fontSize: "11px", color: "var(--text-3)", lineHeight: 1.75 }}>
              All data displayed here is sourced directly from the on-chain append-only audit log. Records cannot be modified or deleted. This snapshot is suitable for presenting to regulators under FATF Recommendation 16 as evidence of access controls at any historical point in time.
            </div>
          </div>
        </>
      )}

      {!snapshot && !loading && (
        <div style={{ border: "1px solid var(--border)", padding: "48px 40px", background: "var(--bg-1)", textAlign: "center" }}>
          <div style={{ ...m, fontSize: "32px", color: "var(--text-4)", marginBottom: "16px" }}>◷</div>
          <div style={{ ...f, fontSize: "17px", fontWeight: 600, color: "var(--text-2)", marginBottom: "8px" }}>Select a timestamp above</div>
          <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", lineHeight: 1.7, maxWidth: "400px", margin: "0 auto" }}>
            The audit log will be loaded once and then sliced client-side — replaying across different timestamps is instant.
          </div>
        </div>
      )}
    </AdminShell>
  );
}
