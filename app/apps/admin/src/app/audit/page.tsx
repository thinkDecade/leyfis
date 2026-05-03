"use client";
import { useState, useEffect, useCallback } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { AdminShell } from "@/components/AdminShell";
import { GATE_PROGRAM_ID, VAULT_PROGRAM_ID, RPC_ENDPOINT, SEEDS, shortAddr, addressUrl, REASON_CODES } from "@leyfis/shared";

const m = { fontFamily: "'DM Mono', monospace" };
const f = { fontFamily: "'Inter', sans-serif" };

type AuditEntry = {
  wallet: string; vault: string; timestamp: number; slot: number;
  outcome: "approved" | "denied"; reasonCode: number; attestationId: string; tier: number; nonce: number;
};

const GATE = new PublicKey(GATE_PROGRAM_ID);
const VAULT = new PublicKey(VAULT_PROGRAM_ID);

async function fetchAll(): Promise<AuditEntry[]> {
  try {
    const c = new Connection(RPC_ENDPOINT, "confirmed");
    const [vcPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.VAULT_CONFIG), VAULT.toBuffer()], GATE);
    const vcInfo = await c.getAccountInfo(vcPDA);
    if (!vcInfo) return [];
    const d = vcInfo.data;
    const issuerCount = d.readUInt32LE(73);
    const jurOff = 77 + issuerCount * 32;
    const jurCount = d.readUInt32LE(jurOff);
    const pOff = jurOff + 4 + jurCount * 3;
    const auditNonce = Number(d.readBigUInt64LE(pOff + 9));
    if (auditNonce === 0) return [];
    const entries: AuditEntry[] = [];
    const start = Math.max(0, auditNonce - 50);
    for (let nonce = auditNonce - 1; nonce >= start; nonce--) {
      try {
        const nb = Buffer.alloc(8); nb.writeBigUInt64LE(BigInt(nonce));
        const [auditPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.AUDIT_ENTRY), vcPDA.toBuffer(), nb], GATE);
        const info = await c.getAccountInfo(auditPDA);
        if (!info || info.data.length < 8) continue;
        const dd = info.data;
        entries.push({
          wallet: new PublicKey(dd.slice(8, 40)).toBase58(),
          vault: new PublicKey(dd.slice(40, 72)).toBase58(),
          timestamp: Number(dd.readBigInt64LE(72)),
          slot: Number(dd.readBigUInt64LE(80)),
          outcome: dd[88] === 0 ? "approved" : "denied",
          reasonCode: dd[89],
          attestationId: new PublicKey(dd.slice(90, 122)).toBase58(),
          tier: dd[122],
          nonce,
        });
      } catch { continue; }
    }
    return entries;
  } catch { return []; }
}

function timeAgo(ts: number) {
  const d = Math.floor(Date.now() / 1000 - ts);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(ts * 1000).toLocaleDateString("en-CH", { day: "2-digit", month: "short" });
}

function SectionLabel({ children }: { children: string }) {
  return <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>{children}</div>;
}

export default function AuditPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [entries, setEntries]   = useState<AuditEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "approved" | "denied">("all");
  const [search, setSearch]     = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const ae = await fetchAll();
      setEntries(ae);
      setLastRefresh(new Date());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (mounted) refresh(); }, [mounted, refresh]);

  if (!mounted) return null;

  const approved = entries.filter(e => e.outcome === "approved").length;
  const denied   = entries.filter(e => e.outcome === "denied").length;
  const filtered = entries.filter(e => {
    if (filter !== "all" && e.outcome !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.wallet.toLowerCase().includes(q) && !REASON_CODES[e.reasonCode]?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <AdminShell current="/audit">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", paddingBottom: "24px", borderBottom: "1px solid var(--border)" }}>
        <div>
          <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "8px" }}>/05 — Audit Log</div>
          <h1 style={{ ...f, fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)", marginBottom: "8px" }}>On-Chain Audit Log</h1>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span style={{ ...m, fontSize: "11px", color: "var(--text-3)" }}>Approved interactions recorded permanently on Solana. Rejected calls leave no on-chain footprint — by design.</span>
            {lastRefresh && <span style={{ ...m, fontSize: "10px", color: "var(--text-4)" }}>· {timeAgo(Math.floor(lastRefresh.getTime() / 1000))}</span>}
            <button onClick={refresh} disabled={loading} style={{ ...m, fontSize: "9px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, letterSpacing: "0.08em", textTransform: "uppercase", opacity: loading ? 0.4 : 1 }}>
              {loading ? "Loading..." : "↻ Refresh"}
            </button>
          </div>
        </div>
        <a href="/export" style={{ ...m, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", border: "1px solid var(--accent)", padding: "10px 18px", background: "var(--accent-bg)", textDecoration: "none" }}>
          Export CSV →
        </a>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "2px", marginBottom: "20px" }}>
        {[
          { label: "Total Records", value: loading ? "—" : entries.length.toString(), color: "var(--text-1)" },
          { label: "Approved", value: loading ? "—" : approved.toString(), color: "var(--success)" },
          { label: "Rejected at Gate", value: loading ? "—" : denied.toString(), color: "var(--danger)" },
          { label: "Approval Rate", value: loading || entries.length === 0 ? "—" : `${Math.round(approved / entries.length * 100)}%`, color: "var(--text-1)" },
        ].map((s, i) => (
          <div key={i} style={{ border: "1px solid var(--border)", padding: "18px 24px", background: "var(--bg-1)" }}>
            <SectionLabel>{s.label}</SectionLabel>
            <div style={{ ...f, fontSize: "28px", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Atomicity note */}
      <div style={{ ...m, fontSize: "10px", color: "var(--text-4)", padding: "10px 16px", background: "var(--bg-1)", border: "1px solid var(--border)", marginBottom: "12px", lineHeight: 1.6 }}>
        <span style={{ color: "var(--text-3)" }}>ℹ︎ </span>
        Solana transactions are atomic. Rejected wallets are stopped before any state is committed — no on-chain footprint is created. Denials are visible in transaction logs on Solana Explorer.
      </div>
      {/* Filters */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by wallet or reason..."
            style={{ ...m, fontSize: "11px", background: "var(--bg-1)", border: "1px solid var(--border)", color: "var(--text-1)", padding: "9px 12px 9px 12px", width: "100%", outline: "none" }}
          />
        </div>
        <div style={{ display: "flex", gap: "2px" }}>
          {(["all", "approved", "denied"] as const).map(f2 => (
            <button key={f2} onClick={() => setFilter(f2)} style={{ ...m, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", padding: "9px 16px", background: filter === f2 ? "var(--accent)" : "var(--bg-1)", color: filter === f2 ? "white" : "var(--text-3)", border: `1px solid ${filter === f2 ? "var(--accent)" : "var(--border)"}`, cursor: "pointer" }}>
              {f2 === "denied" ? "rejected" : f2}
            </button>
          ))}
        </div>
        <span style={{ ...m, fontSize: "9px", color: "var(--text-4)", marginLeft: "auto" }}>{filtered.length} records</span>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid var(--border)", background: "var(--bg-1)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 160px 140px 80px 120px 60px", gap: "12px", padding: "10px 20px", ...m, fontSize: "8px", color: "var(--text-4)", letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>
          <span>Result</span><span>Wallet</span><span>Reason</span><span>Attestation</span><span>Tier</span><span>Time</span><span>Slot</span>
        </div>

        {loading ? (
          <div style={{ padding: "32px 20px", ...m, fontSize: "11px", color: "var(--text-4)" }}>Loading on-chain records...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "32px 20px" }}>
            <div style={{ ...f, fontSize: "15px", fontWeight: 600, color: "var(--text-2)", marginBottom: "6px" }}>
              {entries.length === 0 ? "No gate calls recorded yet." : "No records match your filters."}
            </div>
            <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", lineHeight: 1.7 }}>
              {entries.length === 0
                ? "The audit log is append-only and tamper-proof. Records will appear here once users begin interacting with the vault."
                : "Try adjusting your search or filter."}
            </div>
          </div>
        ) : (
          filtered.map((e, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "72px 1fr 160px 140px 80px 120px 60px",
              gap: "12px", padding: "12px 20px",
              borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
              alignItems: "center",
              borderLeft: `3px solid ${e.outcome === "approved" ? "var(--success)" : "var(--danger)"}`,
              background: i % 2 === 1 ? "var(--bg-2)" : "transparent",
            }}>
              <span style={{ ...m, fontSize: "9px", fontWeight: 700, color: e.outcome === "approved" ? "var(--success)" : "var(--danger)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {e.outcome === "approved" ? "PASS" : "DENY"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <a href={`/profile?wallet=${e.wallet}`} style={{ ...m, fontSize: "10px", color: "var(--accent)", textDecoration: "none" }}>
                  {shortAddr(e.wallet, 8)}
                </a>
                <a href={addressUrl(e.wallet)} target="_blank" rel="noreferrer" style={{ color: "var(--text-4)", display: "flex", alignItems: "center" }} title="View on Explorer">
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M7 1h4v4M11 1L5 7M2 3H1v8h8V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </a>
              </span>
              <span style={{ ...m, fontSize: "10px", color: "var(--text-3)" }}>
                {REASON_CODES[e.reasonCode] || `Code ${e.reasonCode}`}
              </span>
              <a href={addressUrl(e.attestationId)} target="_blank" rel="noreferrer" style={{ ...m, fontSize: "10px", color: "var(--accent)", textDecoration: "none" }}>
                {shortAddr(e.attestationId, 8)}
              </a>
              <span style={{ ...m, fontSize: "10px", color: "var(--text-3)" }}>
                {e.tier > 0 ? `Tier ${e.tier}` : "—"}
              </span>
              <span style={{ ...m, fontSize: "10px", color: "var(--text-4)" }}>
                {timeAgo(e.timestamp)}
              </span>
              <span style={{ ...m, fontSize: "9px", color: "var(--text-4)" }}>
                {e.slot.toString().slice(-6)}
              </span>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}
