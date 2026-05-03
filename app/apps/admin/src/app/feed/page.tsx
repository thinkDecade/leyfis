"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { AdminShell } from "@/components/AdminShell";
import { GATE_PROGRAM_ID, VAULT_PROGRAM_ID, RPC_ENDPOINT, SEEDS, shortAddr, addressUrl, REASON_CODES } from "@leyfis/shared";

const m = { fontFamily: "'DM Mono', monospace" };
const f = { fontFamily: "'Inter', sans-serif" };

type FeedEntry = {
  wallet: string; outcome: "approved" | "denied"; reasonCode: number;
  tier: number; attestationId: string; timestamp: number; slot: number; nonce: number; isNew?: boolean;
};

const GATE = new PublicKey(GATE_PROGRAM_ID);
const VAULT = new PublicKey(VAULT_PROGRAM_ID);

async function fetchLatestNonce(): Promise<number> {
  try {
    const c = new Connection(RPC_ENDPOINT, "confirmed");
    const [vcPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.VAULT_CONFIG), VAULT.toBuffer()], GATE);
    const info = await c.getAccountInfo(vcPDA);
    if (!info) return 0;
    const d = info.data;
    const issuerCount = d.readUInt32LE(73);
    const jurOff = 77 + issuerCount * 32;
    const jurCount = d.readUInt32LE(jurOff);
    const pOff = jurOff + 4 + jurCount * 3;
    return Number(d.readBigUInt64LE(pOff + 9));
  } catch { return 0; }
}

async function fetchEntriesFrom(fromNonce: number, toNonce: number): Promise<FeedEntry[]> {
  if (toNonce <= fromNonce) return [];
  try {
    const c = new Connection(RPC_ENDPOINT, "confirmed");
    const [vcPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.VAULT_CONFIG), VAULT.toBuffer()], GATE);
    const entries: FeedEntry[] = [];
    for (let nonce = toNonce - 1; nonce >= fromNonce; nonce--) {
      try {
        const nb = Buffer.alloc(8); nb.writeBigUInt64LE(BigInt(nonce));
        const [auditPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.AUDIT_ENTRY), vcPDA.toBuffer(), nb], GATE);
        const info = await c.getAccountInfo(auditPDA);
        if (!info || info.data.length < 8) continue;
        const dd = info.data;
        entries.push({
          wallet: new PublicKey(dd.slice(8, 40)).toBase58(),
          outcome: dd[88] === 0 ? "approved" : "denied",
          reasonCode: dd[89],
          tier: dd[122],
          attestationId: new PublicKey(dd.slice(90, 122)).toBase58(),
          timestamp: Number(dd.readBigInt64LE(72)),
          slot: Number(dd.readBigUInt64LE(80)),
          nonce,
          isNew: true,
        });
      } catch { continue; }
    }
    return entries;
  } catch { return []; }
}

function timeAgo(ts: number) {
  const d = Math.floor(Date.now() / 1000 - ts);
  if (d < 5) return "just now";
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

function SectionLabel({ children }: { children: string }) {
  return <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>{children}</div>;
}

export default function FeedPage() {
  const [mounted, setMounted]     = useState(false);
  const [entries, setEntries]     = useState<FeedEntry[]>([]);
  const [live, setLive]           = useState(true);
  const [loading, setLoading]     = useState(true);
  const [lastPoll, setLastPoll]   = useState<Date | null>(null);
  const [newCount, setNewCount]   = useState(0);
  const lastNonce = useRef<number>(0);
  const [totalSeen, setTotalSeen] = useState(0);

  useEffect(() => setMounted(true), []);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    try {
      const nonce = await fetchLatestNonce();
      lastNonce.current = nonce;
      setTotalSeen(nonce);
      const initial = await fetchEntriesFrom(Math.max(0, nonce - 20), nonce);
      setEntries(initial.map(e => ({ ...e, isNew: false })));
      setLastPoll(new Date());
    } finally { setLoading(false); }
  }, []);

  const poll = useCallback(async () => {
    if (!live) return;
    try {
      const nonce = await fetchLatestNonce();
      if (nonce > lastNonce.current) {
        const newEntries = await fetchEntriesFrom(lastNonce.current, nonce);
        if (newEntries.length > 0) {
          setEntries(prev => [...newEntries, ...prev.map(e => ({ ...e, isNew: false }))].slice(0, 50));
          setNewCount(nc => nc + newEntries.length);
        }
        lastNonce.current = nonce;
        setTotalSeen(nonce);
      }
      setLastPoll(new Date());
    } catch { /* silent fail */ }
  }, [live]);

  useEffect(() => { if (mounted) initialLoad(); }, [mounted, initialLoad]);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(poll, 10000);
    return () => clearInterval(t);
  }, [live, poll]);

  // Clear new highlights after 3s
  useEffect(() => {
    const t = setTimeout(() => {
      setEntries(prev => prev.map(e => ({ ...e, isNew: false })));
    }, 3000);
    return () => clearTimeout(t);
  }, [newCount]);

  if (!mounted) return null;

  const approved     = entries.filter(e => e.outcome === "approved").length;
  const denied       = entries.filter(e => e.outcome === "denied").length;
  const approvalRate = entries.length > 0 ? Math.round(approved / entries.length * 100) : 0;

  return (
    <AdminShell current="/feed">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", paddingBottom: "24px", borderBottom: "1px solid var(--border)" }}>
        <div>
          <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "8px" }}>06 — Live Feed</div>
          <h1 style={{ ...f, fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)", marginBottom: "8px" }}>Live Gate Activity</h1>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: live ? "var(--success)" : "var(--text-4)", animation: live ? "pulse 2s infinite" : "none" }} />
              <span style={{ ...m, fontSize: "11px", color: live ? "var(--success)" : "var(--text-4)" }}>
                {live ? "Polling every 10s" : "Paused"}
              </span>
            </div>
            {lastPoll && <span style={{ ...m, fontSize: "12px", color: "var(--text-4)" }}>· {timeAgo(Math.floor(lastPoll.getTime() / 1000))}</span>}
          </div>
        </div>
        <button
          onClick={() => setLive(l => !l)}
          style={{ ...m, fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", background: live ? "var(--accent-bg)" : "var(--bg-1)", color: live ? "var(--accent)" : "var(--text-3)", border: `1px solid ${live ? "var(--accent)" : "var(--border)"}`, padding: "10px 20px", cursor: "pointer", fontWeight: 600 }}>
          {live ? "⏸ Pause" : "▶ Resume"}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "2px", marginBottom: "20px" }}>
        {[
          { label: "Lifetime Calls", value: totalSeen.toString(), color: "var(--text-1)", sub: "Total audit nonce" },
          { label: "Approved", value: approved.toString(), color: "var(--success)", sub: `${approvalRate}% of visible` },
          { label: "Rejected at Gate", value: denied.toString(), color: "var(--danger)", sub: `${100 - approvalRate}% of visible` },
          { label: "Showing", value: entries.length.toString(), color: "var(--text-1)", sub: "Last 50 on-chain" },
        ].map((s, i) => (
          <div key={i} style={{ border: "1px solid var(--border)", padding: "18px 24px", background: "var(--bg-1)" }}>
            <SectionLabel>{s.label}</SectionLabel>
            <div style={{ ...f, fontSize: "28px", fontWeight: 800, color: s.color, lineHeight: 1, marginBottom: "4px" }}>{s.value}</div>
            <div style={{ ...m, fontSize: "11px", color: "var(--text-4)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Feed */}
      <div style={{ border: "1px solid var(--border)", background: "var(--bg-1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <SectionLabel>Gate events</SectionLabel>
            <div style={{ ...f, fontSize: "14px", fontWeight: 600, color: "var(--text-1)" }}>
              On-chain audit stream
            </div>
          </div>
          {newCount > 0 && (
            <span style={{ ...m, fontSize: "11px", padding: "3px 10px", background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent)", letterSpacing: "0.08em" }}>
              +{newCount} new
            </span>
          )}
        </div>

        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "14px 72px 1fr 160px 80px 120px", gap: "14px", padding: "10px 20px", ...m, fontSize: "8px", color: "var(--text-4)", letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>
          <span></span><span>Result</span><span>Wallet</span><span>Reason</span><span>Tier</span><span>Time</span>
        </div>

        {loading ? (
          <div style={{ padding: "32px 20px", ...m, fontSize: "11px", color: "var(--text-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "1px", height: "20px", background: "var(--accent)", animation: "pulse 1s infinite" }} />
              Loading on-chain records...
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: "32px 20px" }}>
            <div style={{ ...f, fontSize: "15px", fontWeight: 600, color: "var(--text-2)", marginBottom: "6px" }}>Watching for gate activity...</div>
            <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", lineHeight: 1.7 }}>
              No gate calls recorded yet. The feed will update automatically when users interact with the vault.
              {live && " Polling every 10 seconds."}
            </div>
          </div>
        ) : (
          entries.map((e, i) => (
            <div key={`${e.nonce}-${i}`} style={{
              display: "grid", gridTemplateColumns: "14px 72px 1fr 160px 80px 120px",
              gap: "14px", padding: "13px 20px",
              borderBottom: i < entries.length - 1 ? "1px solid var(--border)" : "none",
              alignItems: "center",
              borderLeft: `3px solid ${e.outcome === "approved" ? "var(--success)" : "var(--danger)"}`,
              background: e.isNew ? (e.outcome === "approved" ? "rgba(22,163,74,0.04)" : "rgba(220,38,38,0.04)") : "transparent",
              transition: "background 1s ease",
            }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: e.isNew ? (e.outcome === "approved" ? "var(--success)" : "var(--danger)") : "transparent" }} />
              <span style={{ ...m, fontSize: "11px", fontWeight: 700, color: e.outcome === "approved" ? "var(--success)" : "var(--danger)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {e.outcome === "approved" ? "PASS" : "DENY"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <a href={`/profile?wallet=${e.wallet}`} style={{ ...m, fontSize: "12px", color: "var(--accent)", textDecoration: "none" }}>
                  {shortAddr(e.wallet, 8)}
                </a>
                <a href={addressUrl(e.wallet)} target="_blank" rel="noreferrer" style={{ color: "var(--text-4)", display: "flex", alignItems: "center" }} title="View on Explorer">
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M7 1h4v4M11 1L5 7M2 3H1v8h8V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </a>
              </span>
              <span style={{ ...m, fontSize: "12px", color: "var(--text-3)" }}>
                {REASON_CODES[e.reasonCode] || `Code ${e.reasonCode}`}
              </span>
              <span style={{ ...m, fontSize: "12px", color: "var(--text-3)" }}>
                {e.tier > 0 ? `Tier ${e.tier}` : "—"}
              </span>
              <span style={{ ...m, fontSize: "12px", color: "var(--text-4)" }}>
                {timeAgo(e.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
      `}</style>
    </AdminShell>
  );
}
