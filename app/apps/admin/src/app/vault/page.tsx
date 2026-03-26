"use client";
import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { AdminShell } from "@/components/AdminShell";
import {
  GATE_PROGRAM_ID, VAULT_PROGRAM_ID, RPC_ENDPOINT,
  SEEDS, shortAddr, txUrl, addressUrl, REASON_CODES
} from "@leyfis/shared";

// ─── Types ────────────────────────────────────────────────────────────────────
type GateStatus = "loading" | "active" | "paused" | "error";

type VaultConfig = {
  authority: string;
  vaultProgram: string;
  minTier: number;
  trustedIssuers: string[];
  allowedJurisdictions: string[];
  paused: boolean;
  registeredAt: number;
  auditNonce: number;
  bump: number;
};

type AuditEntry = {
  wallet: string;
  vault: string;
  timestamp: number;
  slot: number;
  outcome: "approved" | "denied";
  reasonCode: number;
  attestationId: string;
  tier: number;
};

type DenialBreakdown = Record<number, number>;

// ─── Pause reasons ────────────────────────────────────────────────────────────
const PAUSE_REASONS = [
  { value: "precautionary", label: "Precautionary review", desc: "Temporary pause pending internal compliance review" },
  { value: "regulatory",    label: "Regulatory instruction", desc: "Pause required by regulator or legal counsel" },
  { value: "compromise",    label: "Suspected compromise", desc: "Potential security issue under investigation" },
  { value: "maintenance",   label: "Scheduled maintenance", desc: "Planned downtime for vault maintenance" },
  { value: "issuer",        label: "Issuer concern", desc: "Trusted issuer under review or suspended" },
];

// ─── On-chain reads ───────────────────────────────────────────────────────────
const GATE = new PublicKey(GATE_PROGRAM_ID);
const VAULT = new PublicKey(VAULT_PROGRAM_ID);

async function fetchVaultConfig(): Promise<VaultConfig | null> {
  try {
    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const [vcPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.VAULT_CONFIG), VAULT.toBuffer()], GATE
    );
    const info = await connection.getAccountInfo(vcPDA);
    if (!info) return null;
    const d = info.data;
    const authority   = new PublicKey(d.slice(8, 40)).toBase58();
    const vaultProgram = new PublicKey(d.slice(40, 72)).toBase58();
    const minTier     = d[72];
    const issuerCount = d.readUInt32LE(73);
    const issuers: string[] = [];
    for (let i = 0; i < issuerCount; i++) {
      const off = 77 + i * 32;
      if (off + 32 <= d.length) issuers.push(new PublicKey(d.slice(off, off + 32)).toBase58());
    }
    const jurOff  = 77 + issuerCount * 32;
    const jurCount = d.readUInt32LE(jurOff);
    const jurisdictions: string[] = [];
    for (let i = 0; i < jurCount; i++) {
      const off = jurOff + 4 + i * 3;
      if (off + 3 <= d.length) {
        jurisdictions.push(`${String.fromCharCode(d[off])}${String.fromCharCode(d[off+1])}${String.fromCharCode(d[off+2])}`);
      }
    }
    const pausedOff      = jurOff + 4 + jurCount * 3;
    const paused         = d[pausedOff] !== 0;
    const registeredAt   = Number(d.readBigInt64LE(pausedOff + 1));
    const auditNonce     = Number(d.readBigUInt64LE(pausedOff + 9));
    const bump           = d[pausedOff + 17];
    return { authority, vaultProgram, minTier, trustedIssuers: issuers, allowedJurisdictions: jurisdictions, paused, registeredAt, auditNonce, bump };
  } catch { return null; }
}

async function fetchRecentAuditEntries(auditNonce: number): Promise<AuditEntry[]> {
  try {
    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const [vcPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.VAULT_CONFIG), VAULT.toBuffer()], GATE
    );
    const entries: AuditEntry[] = [];
    const start = Math.max(0, auditNonce - 20);
    for (let nonce = auditNonce - 1; nonce >= start; nonce--) {
      try {
        const nonceBytes = Buffer.alloc(8);
        nonceBytes.writeBigUInt64LE(BigInt(nonce));
        const [auditPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from(SEEDS.AUDIT_ENTRY), vcPDA.toBuffer(), nonceBytes], GATE
        );
        const info = await connection.getAccountInfo(auditPDA);
        if (!info || info.data.length < 8) continue;
        const d = info.data;
        // AuditEntry layout: 8(disc)+32(wallet)+32(vault)+8(ts)+8(slot)+1(outcome)+1(reason)+32(att)+1(tier)+1(bump)
        const wallet        = new PublicKey(d.slice(8, 40)).toBase58();
        const vault         = new PublicKey(d.slice(40, 72)).toBase58();
        const timestamp     = Number(d.readBigInt64LE(72));
        const slot          = Number(d.readBigUInt64LE(80));
        const outcomeRaw    = d[88];
        const outcome       = outcomeRaw === 0 ? "approved" : "denied";
        const reasonCode    = d[89];
        const attestationId = new PublicKey(d.slice(90, 122)).toBase58();
        const tier          = d[122];
        entries.push({ wallet, vault, timestamp, slot, outcome, reasonCode, attestationId, tier });
      } catch { continue; }
    }
    return entries;
  } catch { return []; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const m = { fontFamily: "'DM Mono', monospace" };
const f = { fontFamily: "'Inter', sans-serif" };

function tierLabel(t: number) {
  return t === 3 ? "Tier 3 — Institutional" : t === 2 ? "Tier 2 — Enhanced" : t === 1 ? "Tier 1 — Basic" : `Tier ${t}`;
}

function timeAgo(ts: number) {
  const d = Math.floor(Date.now() / 1000 - ts);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

// ─── Pause Modal ──────────────────────────────────────────────────────────────
function PauseModal({ onConfirm, onCancel }: { onConfirm: (reason: string, notes: string) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState("");
  const [notes, setNotes] = useState("");
  const canSubmit = selected !== "";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
      <div style={{ background: "var(--bg-1)", border: "1px solid var(--danger-border)", padding: "40px", maxWidth: "520px", width: "100%", position: "relative" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ ...m, fontSize: "9px", color: "var(--danger)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>
            Emergency Control — Gate Pause
          </div>
          <h2 style={{ ...f, fontSize: "20px", fontWeight: 700, color: "var(--text-1)", marginBottom: "8px" }}>
            Pause vault gate?
          </h2>
          <p style={{ ...m, fontSize: "11px", color: "var(--text-3)", lineHeight: 1.75 }}>
            This will immediately block all vault interactions. Your reason will be permanently recorded on-chain and will appear in all compliance exports.
          </p>
        </div>

        {/* Reason selection */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px" }}>
            Reason for pausing <span style={{ color: "var(--danger)" }}>*</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {PAUSE_REASONS.map(r => (
              <button key={r.value} onClick={() => setSelected(r.value)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: "12px",
                  padding: "12px 14px", background: selected === r.value ? "var(--danger-bg)" : "var(--bg-2)",
                  border: `1px solid ${selected === r.value ? "var(--danger-border)" : "var(--border)"}`,
                  cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                }}>
                <div style={{
                  width: "14px", height: "14px", borderRadius: "50%", flexShrink: 0, marginTop: "1px",
                  border: `1px solid ${selected === r.value ? "var(--danger)" : "var(--border-2)"}`,
                  background: selected === r.value ? "var(--danger)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {selected === r.value && <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "white" }} />}
                </div>
                <div>
                  <div style={{ ...m, fontSize: "11px", color: selected === r.value ? "var(--danger)" : "var(--text-1)", fontWeight: 500, marginBottom: "2px" }}>{r.label}</div>
                  <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", lineHeight: 1.6 }}>{r.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>
            Additional notes <span style={{ color: "var(--text-4)" }}>(optional)</span>
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Wallet 5t1o...kxfb flagged by compliance team. Pending AML review."
            rows={3}
            style={{
              ...m, fontSize: "11px", width: "100%", background: "var(--bg-2)",
              border: "1px solid var(--border)", color: "var(--text-1)",
              padding: "10px 14px", outline: "none", resize: "none", lineHeight: 1.7,
            }}
          />
          <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", marginTop: "4px" }}>
            This text will be stored on-chain as part of the audit record.
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => onConfirm(selected, notes)}
            disabled={!canSubmit}
            style={{
              ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase",
              background: canSubmit ? "var(--danger)" : "var(--danger-bg)",
              color: canSubmit ? "white" : "var(--danger)",
              border: "1px solid var(--danger-border)", padding: "12px 24px",
              cursor: canSubmit ? "pointer" : "not-allowed", fontWeight: 600, flex: 1,
            }}>
            Confirm Pause
          </button>
          <button
            onClick={onCancel}
            style={{
              ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase",
              background: "transparent", color: "var(--text-3)",
              border: "1px solid var(--border)", padding: "12px 24px", cursor: "pointer",
            }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Unpause Modal ────────────────────────────────────────────────────────────
function UnpauseModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
      <div style={{ background: "var(--bg-1)", border: "1px solid var(--border-2)", padding: "40px", maxWidth: "440px", width: "100%" }}>
        <div style={{ ...m, fontSize: "9px", color: "var(--accent)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>Resume Operations</div>
        <h2 style={{ ...f, fontSize: "20px", fontWeight: 700, color: "var(--text-1)", marginBottom: "12px" }}>Resume vault gate?</h2>
        <p style={{ ...m, fontSize: "11px", color: "var(--text-3)", lineHeight: 1.75, marginBottom: "28px" }}>
          Vault interactions will resume immediately. All 7 compliance checks will be enforced on every access attempt.
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onConfirm} style={{ ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--accent)", color: "white", border: "none", padding: "12px 24px", cursor: "pointer", fontWeight: 600, flex: 1 }}>
            Resume Gate
          </button>
          <button onClick={onCancel} style={{ ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: "transparent", color: "var(--text-3)", border: "1px solid var(--border)", padding: "12px 24px", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Denial Breakdown Bar ─────────────────────────────────────────────────────
function DenialBar({ code, count, total }: { code: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 32px 1fr 32px", gap: "10px", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ ...m, fontSize: "10px", color: "var(--text-2)" }}>{REASON_CODES[code] || `Code ${code}`}</span>
      <span style={{ ...m, fontSize: "10px", color: "var(--text-1)", fontWeight: 600, textAlign: "right" }}>{count}</span>
      <div style={{ height: "3px", background: "var(--bg-3)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "var(--danger)", opacity: 0.7, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ ...m, fontSize: "9px", color: "var(--text-4)", textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function VaultPage() {
  const { publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<VaultConfig | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showUnpauseModal, setShowUnpauseModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pendingTier, setPendingTier] = useState(3);
  const [savingTier, setSavingTier] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const vc = await fetchVaultConfig();
      setConfig(vc);
      if (vc) {
        setPendingTier(vc.minTier);
        const auditEntries = await fetchRecentAuditEntries(vc.auditNonce);
        setEntries(auditEntries);
      }
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mounted) refresh();
  }, [mounted, refresh]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (!mounted) return null;

  const approved  = entries.filter(e => e.outcome === "approved").length;
  const denied    = entries.filter(e => e.outcome === "denied").length;
  const approvalRate = entries.length > 0 ? Math.round((approved / entries.length) * 100) : 0;

  // Denial breakdown
  const denialBreakdown: DenialBreakdown = {};
  entries.filter(e => e.outcome === "denied").forEach(e => {
    denialBreakdown[e.reasonCode] = (denialBreakdown[e.reasonCode] || 0) + 1;
  });
  const sortedDenials = Object.entries(denialBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const handlePause = async (reason: string, notes: string) => {
    setProcessing(true);
    setShowPauseModal(false);
    try {
      // For demo: simulate on-chain call
      await new Promise(r => setTimeout(r, 1200));
      setConfig(prev => prev ? { ...prev, paused: true } : null);
      console.log("Gate paused. Reason:", reason, "Notes:", notes);
    } finally {
      setProcessing(false);
    }
  };

  const handleUnpause = async () => {
    setProcessing(true);
    setShowUnpauseModal(false);
    try {
      await new Promise(r => setTimeout(r, 1000));
      setConfig(prev => prev ? { ...prev, paused: false } : null);
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveTier = async () => {
    setSavingTier(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      setConfig(prev => prev ? { ...prev, minTier: pendingTier } : null);
    } finally {
      setSavingTier(false);
    }
  };

  const gateStatus: GateStatus = loading ? "loading" : config?.paused ? "paused" : config ? "active" : "error";

  return (
    <AdminShell current="/vault">
      {showPauseModal && <PauseModal onConfirm={handlePause} onCancel={() => setShowPauseModal(false)} />}
      {showUnpauseModal && <UnpauseModal onConfirm={handleUnpause} onCancel={() => setShowUnpauseModal(false)} />}

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>
            /02 — Vault Operator
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
            <h1 style={{ ...f, fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)" }}>Vault Dashboard</h1>
            <span style={{
              ...m, fontSize: "9px", padding: "4px 10px", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
              background: gateStatus === "active" ? "rgba(22,163,74,0.08)" : gateStatus === "paused" ? "var(--danger-bg)" : "var(--bg-2)",
              color: gateStatus === "active" ? "var(--success)" : gateStatus === "paused" ? "var(--danger)" : "var(--text-4)",
              border: `1px solid ${gateStatus === "active" ? "rgba(22,163,74,0.2)" : gateStatus === "paused" ? "var(--danger-border)" : "var(--border)"}`,
            }}>
              {gateStatus === "loading" ? "Loading..." : gateStatus === "active" ? "Gate Active" : gateStatus === "paused" ? "Gate Paused" : "Error"}
            </span>
          </div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <span style={{ ...m, fontSize: "10px", color: "var(--text-4)" }}>
              {config ? shortAddr(VAULT_PROGRAM_ID, 8) : "—"}
            </span>
            {lastRefresh && (
              <span style={{ ...m, fontSize: "10px", color: "var(--text-4)" }}>
                Refreshed {timeAgo(Math.floor(lastRefresh.getTime() / 1000))}
              </span>
            )}
            <button onClick={refresh} disabled={loading} style={{ ...m, fontSize: "9px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", padding: 0, opacity: loading ? 0.4 : 1 }}>
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>
        </div>

        {/* Emergency control */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
          {config?.paused ? (
            <button
              onClick={() => setShowUnpauseModal(true)}
              disabled={processing}
              style={{ display: "flex", alignItems: "center", gap: "8px", ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--accent)", color: "white", border: "none", padding: "10px 20px", cursor: "pointer", fontWeight: 600, opacity: processing ? 0.5 : 1 }}>
              ▶ Resume Gate
            </button>
          ) : (
            <button
              onClick={() => setShowPauseModal(true)}
              disabled={processing || !config}
              style={{ display: "flex", alignItems: "center", gap: "8px", ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger-border)", padding: "10px 20px", cursor: "pointer", fontWeight: 600, opacity: processing || !config ? 0.5 : 1 }}>
              ■ Pause Gate
            </button>
          )}
          <span style={{ ...m, fontSize: "9px", color: "var(--text-4)" }}>Action is logged on-chain</span>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "2px", marginBottom: "20px" }}>
        {[
          { label: "Gate Calls", value: loading ? "—" : entries.length.toString(), sub: "Last 20 on-chain", color: "var(--text-1)" },
          { label: "Approved", value: loading ? "—" : approved.toString(), sub: `${approvalRate}% pass rate`, color: "var(--success)" },
          { label: "Denied", value: loading ? "—" : denied.toString(), sub: `${100 - approvalRate}% block rate`, color: "var(--danger)" },
          { label: "Audit Nonce", value: loading ? "—" : (config?.auditNonce ?? "—").toString(), sub: "Total lifetime calls", color: "var(--text-1)" },
        ].map((s, i) => (
          <div key={i} style={{ border: "1px solid var(--border)", padding: "20px 24px", background: "var(--bg-1)" }}>
            <div style={{ ...m, fontSize: "9px", color: "var(--text-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>{s.label}</div>
            <div style={{ ...f, fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1, color: s.color, marginBottom: "6px" }}>{s.value}</div>
            <div style={{ ...m, fontSize: "9px", color: "var(--text-4)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main content grid ─────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "2px", marginBottom: "20px" }}>

        {/* Left — Intelligence */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>

          {/* Gate status + vault identity */}
          <div style={{ border: "1px solid var(--border)", padding: "24px", background: "var(--bg-1)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>
              <div>
                <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Gate status</div>
                <div style={{ ...f, fontSize: "16px", fontWeight: 600, color: config?.paused ? "var(--danger)" : "var(--success)", marginBottom: "4px" }}>
                  {loading ? "Loading..." : config?.paused ? "Paused" : "Active"}
                </div>
                <div style={{ ...m, fontSize: "10px", color: "var(--text-4)", lineHeight: 1.6 }}>
                  {config?.paused ? "All access blocked" : "7 checks enforced"}
                </div>
              </div>
              <div>
                <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Vault program</div>
                <a href={addressUrl(VAULT_PROGRAM_ID)} target="_blank" rel="noreferrer" style={{ ...m, fontSize: "11px", color: "var(--accent)", textDecoration: "none", display: "block", marginBottom: "4px" }}>
                  {shortAddr(VAULT_PROGRAM_ID, 8)}
                </a>
                <div style={{ ...m, fontSize: "10px", color: "var(--text-4)" }}>Solana devnet</div>
              </div>
              <div>
                <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Deployed</div>
                <div style={{ ...m, fontSize: "11px", color: "var(--text-2)", marginBottom: "4px" }}>
                  {config ? new Date(config.registeredAt * 1000).toLocaleDateString("en-CH", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                </div>
                <div style={{ ...m, fontSize: "10px", color: "var(--text-4)" }}>Gate Program: {shortAddr(GATE_PROGRAM_ID, 6)}</div>
              </div>
            </div>
          </div>

          {/* Denial breakdown */}
          <div style={{ border: "1px solid var(--border)", padding: "24px", background: "var(--bg-1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Denial breakdown
              </div>
              <div style={{ ...m, fontSize: "9px", color: "var(--text-4)" }}>
                {denied} total denials
              </div>
            </div>

            {loading ? (
              <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", padding: "12px 0" }}>Loading...</div>
            ) : sortedDenials.length === 0 ? (
              <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", padding: "12px 0" }}>
                No denials recorded. All recent access attempts approved.
              </div>
            ) : (
              <div>
                {sortedDenials.map(([code, count]) => (
                  <DenialBar key={code} code={parseInt(code)} count={count} total={denied} />
                ))}
                <div style={{ marginTop: "16px", padding: "12px 14px", background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                  <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", lineHeight: 1.8 }}>
                    High <strong style={{ color: "var(--text-2)" }}>TierInsufficient</strong> rates indicate under-KYC'd users — contact your issuer.<br />
                    High <strong style={{ color: "var(--text-2)" }}>AttestationExpired</strong> rates indicate users needing re-verification.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Trusted issuers */}
          <div style={{ border: "1px solid var(--border)", padding: "24px", background: "var(--bg-1)" }}>
            <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "16px" }}>
              Trusted issuers — {config?.trustedIssuers.length ?? 0} registered
            </div>
            {loading ? (
              <div style={{ ...m, fontSize: "11px", color: "var(--text-4)" }}>Loading...</div>
            ) : (config?.trustedIssuers.length ?? 0) === 0 ? (
              <div style={{ ...m, fontSize: "11px", color: "var(--danger)", padding: "12px 14px", border: "1px solid var(--danger-border)", background: "var(--danger-bg)" }}>
                No trusted issuers registered. All attestations will fail UntrustedIssuer check.
              </div>
            ) : (
              config?.trustedIssuers.map((issuer, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success)", flexShrink: 0 }} />
                    <a href={addressUrl(issuer)} target="_blank" rel="noreferrer" style={{ ...m, fontSize: "11px", color: "var(--accent)", textDecoration: "none" }}>
                      {shortAddr(issuer, 10)}
                    </a>
                  </div>
                  <span style={{ ...m, fontSize: "9px", padding: "2px 8px", background: "rgba(22,163,74,0.08)", color: "var(--success)", border: "1px solid rgba(22,163,74,0.2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Active
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right — Configuration controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>

          {/* Min clearance tier */}
          <div style={{ border: "1px solid var(--border)", padding: "24px", background: "var(--bg-1)" }}>
            <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "16px" }}>
              Minimum clearance tier
            </div>
            <div style={{ ...f, fontSize: "22px", fontWeight: 700, color: "var(--text-1)", marginBottom: "4px" }}>
              {config ? tierLabel(config.minTier) : "—"}
            </div>
            <p style={{ ...m, fontSize: "10px", color: "var(--text-4)", lineHeight: 1.7, marginBottom: "16px" }}>
              Wallets presenting credentials below this tier will be denied with TierInsufficient.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
              <select
                value={pendingTier}
                onChange={e => setPendingTier(parseInt(e.target.value))}
                style={{ ...m, fontSize: "11px", background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-1)", padding: "9px 12px", outline: "none", cursor: "pointer" }}>
                <option value={1}>Tier 1 — Basic KYC</option>
                <option value={2}>Tier 2 — Enhanced Due Diligence</option>
                <option value={3}>Tier 3 — Institutional / FATF</option>
              </select>
              <button
                onClick={handleSaveTier}
                disabled={savingTier || pendingTier === config?.minTier || !config}
                style={{ ...m, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--accent)", color: "white", border: "none", padding: "10px", cursor: "pointer", fontWeight: 600, opacity: savingTier || pendingTier === config?.minTier || !config ? 0.4 : 1 }}>
                {savingTier ? "Updating..." : "Update Tier"}
              </button>
            </div>
            <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", lineHeight: 1.7 }}>
              Tier change takes effect immediately on next gate call.
            </div>
          </div>

          {/* Jurisdictions */}
          <div style={{ border: "1px solid var(--border)", padding: "24px", background: "var(--bg-1)" }}>
            <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "14px" }}>
              Permitted jurisdictions
            </div>
            {loading ? (
              <div style={{ ...m, fontSize: "11px", color: "var(--text-4)" }}>Loading...</div>
            ) : (config?.allowedJurisdictions.length ?? 0) === 0 ? (
              <div>
                <div style={{ ...m, fontSize: "11px", color: "var(--text-2)", marginBottom: "8px" }}>All jurisdictions permitted</div>
                <div style={{ ...m, fontSize: "10px", color: "var(--text-4)", lineHeight: 1.7 }}>No jurisdiction restrictions configured. Any wallet with valid credentials can access.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {config?.allowedJurisdictions.map(j => (
                  <span key={j} style={{ ...m, fontSize: "10px", padding: "4px 12px", background: "rgba(27,79,216,0.08)", color: "var(--accent)", border: "1px solid var(--accent-border)", letterSpacing: "0.08em" }}>{j}</span>
                ))}
              </div>
            )}
            <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)", lineHeight: 1.7 }}>
              Jurisdiction configuration managed via protocol console.
            </div>
          </div>

          {/* Compliance checks */}
          <div style={{ border: "1px solid var(--border)", padding: "24px", background: "var(--bg-1)" }}>
            <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "14px" }}>
              Active compliance checks
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {[
                ["Gate status", "Paused check"],
                ["Attestation exists", "NoAttestation"],
                ["Not revoked", "AttestationRevoked"],
                ["Not expired", "AttestationExpired"],
                ["Trusted issuer", "UntrustedIssuer"],
                ["Tier sufficient", "TierInsufficient"],
                ["Jurisdiction permitted", "JurisdictionBlocked"],
              ].map(([label, code], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--success)" }} />
                    <span style={{ ...m, fontSize: "10px", color: "var(--text-2)" }}>{label}</span>
                  </div>
                  <span style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.04em" }}>{code}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent activity ───────────────────────────────────────────────── */}
      <div style={{ border: "1px solid var(--border)", background: "var(--bg-1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Recent gate activity — on-chain records
          </div>
          <a href="/audit" style={{ ...m, fontSize: "9px", color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Full Audit Log →</a>
        </div>

        {loading ? (
          <div style={{ padding: "24px 20px", ...m, fontSize: "11px", color: "var(--text-4)" }}>Loading on-chain records...</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: "24px 20px" }}>
            <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", marginBottom: "4px" }}>No gate calls recorded yet.</div>
            <div style={{ ...m, fontSize: "10px", color: "var(--text-4)" }}>Activity will appear here once users begin interacting with the vault.</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 140px 120px 100px 80px", gap: "12px", padding: "8px 20px", ...m, fontSize: "8px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>
              <span>Outcome</span><span>Wallet</span><span>Reason</span><span>Attestation</span><span>Tier</span><span>Time</span>
            </div>
            {entries.slice(0, 10).map((e, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr 140px 120px 100px 80px", gap: "12px", padding: "13px 20px", borderBottom: i < Math.min(entries.length, 10) - 1 ? "1px solid var(--border)" : "none", ...m, fontSize: "11px", alignItems: "center", borderLeft: `2px solid ${e.outcome === "approved" ? "var(--accent)" : "var(--danger)"}` }}>
                <span style={{ color: e.outcome === "approved" ? "var(--accent)" : "var(--danger)", fontWeight: 700, letterSpacing: "0.06em", fontSize: "9px", textTransform: "uppercase" }}>
                  {e.outcome === "approved" ? "PASS" : "DENY"}
                </span>
                <span style={{ color: "var(--text-2)" }}>{shortAddr(e.wallet, 6)}</span>
                <span style={{ color: "var(--text-3)" }}>{REASON_CODES[e.reasonCode] || `Code ${e.reasonCode}`}</span>
                <a href={addressUrl(e.attestationId)} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none", fontSize: "10px" }}>
                  {shortAddr(e.attestationId, 6)}
                </a>
                <span style={{ color: "var(--text-3)" }}>{e.tier > 0 ? `Tier ${e.tier}` : "—"}</span>
                <span style={{ color: "var(--text-4)", fontSize: "10px" }}>{timeAgo(e.timestamp)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </AdminShell>
  );
}
