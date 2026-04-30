"use client";
import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { AdminShell } from "@/components/AdminShell";
import {
  GATE_PROGRAM_ID, VAULT_PROGRAM_ID, RPC_ENDPOINT,
  SEEDS, shortAddr, addressUrl, REASON_CODES,
  buildPauseGateIx, buildUnpauseGateIx, buildUpdateVaultConfigIx,
  findVaultConfigPDA, sendAdminTx,
} from "@leyfis/shared";

// ─── Types ────────────────────────────────────────────────────────────────────
type VaultConfig = {
  authority: string; vaultProgram: string; minTier: number;
  trustedIssuers: string[]; allowedJurisdictions: string[];
  paused: boolean; registeredAt: number; auditNonce: number; bump: number;
};
type AuditEntry = {
  wallet: string; vault: string; timestamp: number; slot: number;
  outcome: "approved" | "denied"; reasonCode: number; attestationId: string; tier: number;
};

// ─── Pause reasons ────────────────────────────────────────────────────────────
const PAUSE_REASONS = [
  { value: "precautionary", label: "Precautionary review",    desc: "Temporary pause pending internal compliance review" },
  { value: "regulatory",    label: "Regulatory instruction",  desc: "Pause required by regulator or legal counsel" },
  { value: "compromise",    label: "Suspected compromise",    desc: "Potential security issue under investigation" },
  { value: "maintenance",   label: "Scheduled maintenance",   desc: "Planned downtime for vault maintenance" },
  { value: "issuer",        label: "Issuer concern",          desc: "Trusted issuer under review or suspended" },
];

// ─── On-chain reads ───────────────────────────────────────────────────────────
const GATE = new PublicKey(GATE_PROGRAM_ID);
const VAULT = new PublicKey(VAULT_PROGRAM_ID);

async function fetchVaultConfig(): Promise<VaultConfig | null> {
  try {
    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const [vcPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.VAULT_CONFIG), VAULT.toBuffer()], GATE);
    const info = await connection.getAccountInfo(vcPDA);
    if (!info) return null;
    const d = info.data;
    const authority    = new PublicKey(d.slice(8, 40)).toBase58();
    const vaultProgram = new PublicKey(d.slice(40, 72)).toBase58();
    const minTier      = d[72];
    const issuerCount  = d.readUInt32LE(73);
    const issuers: string[] = [];
    for (let i = 0; i < issuerCount; i++) {
      const off = 77 + i * 32;
      if (off + 32 <= d.length) issuers.push(new PublicKey(d.slice(off, off + 32)).toBase58());
    }
    const jurOff   = 77 + issuerCount * 32;
    const jurCount = d.readUInt32LE(jurOff);
    const jurisdictions: string[] = [];
    for (let i = 0; i < jurCount; i++) {
      const off = jurOff + 4 + i * 3;
      if (off + 3 <= d.length) jurisdictions.push(`${String.fromCharCode(d[off])}${String.fromCharCode(d[off+1])}${String.fromCharCode(d[off+2])}`);
    }
    const pOff         = jurOff + 4 + jurCount * 3;
    const paused       = d[pOff] !== 0;
    const registeredAt = Number(d.readBigInt64LE(pOff + 1));
    const auditNonce   = Number(d.readBigUInt64LE(pOff + 9));
    const bump         = d[pOff + 17];
    return { authority, vaultProgram, minTier, trustedIssuers: issuers, allowedJurisdictions: jurisdictions, paused, registeredAt, auditNonce, bump };
  } catch { return null; }
}

async function fetchRecentAuditEntries(auditNonce: number): Promise<AuditEntry[]> {
  try {
    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const [vcPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.VAULT_CONFIG), VAULT.toBuffer()], GATE);
    const entries: AuditEntry[] = [];
    const start = Math.max(0, auditNonce - 20);
    for (let nonce = auditNonce - 1; nonce >= start; nonce--) {
      try {
        const nonceBytes = Buffer.alloc(8);
        nonceBytes.writeBigUInt64LE(BigInt(nonce));
        const [auditPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.AUDIT_ENTRY), vcPDA.toBuffer(), nonceBytes], GATE);
        const info = await connection.getAccountInfo(auditPDA);
        if (!info || info.data.length < 8) continue;
        const d = info.data;
        const wallet        = new PublicKey(d.slice(8, 40)).toBase58();
        const vault         = new PublicKey(d.slice(40, 72)).toBase58();
        const timestamp     = Number(d.readBigInt64LE(72));
        const slot          = Number(d.readBigUInt64LE(80));
        const outcome       = d[88] === 0 ? "approved" : "denied";
        const reasonCode    = d[89];
        const attestationId = new PublicKey(d.slice(90, 122)).toBase58();
        const tier          = d[122];
        entries.push({ wallet, vault, timestamp, slot, outcome: outcome as "approved" | "denied", reasonCode, attestationId, tier });
      } catch { continue; }
    }
    return entries;
  } catch { return []; }
}

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

// ─── NL Config Panel ─────────────────────────────────────────────────────────
type NLDelta = { min_tier: number | null; allowed_jurisdictions: string[] | null };
type NLResult = { proposed_delta: NLDelta; explanation: string; warnings: string[]; confidence: "high" | "medium" | "low" };

function NLConfigPanel({ vaultConfig, publicKey, signTransaction, onApplied }: {
  vaultConfig: VaultConfig | null;
  publicKey: import("@solana/web3.js").PublicKey | null;
  signTransaction: ((tx: import("@solana/web3.js").Transaction) => Promise<import("@solana/web3.js").Transaction>) | undefined;
  onApplied: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<NLResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const handleParse = async () => {
    if (!instruction.trim() || !vaultConfig) return;
    setParsing(true); setResult(null); setError(null); setApplied(false);
    try {
      const res = await fetch("/api/nl-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction,
          currentConfig: { minTier: vaultConfig.minTier, allowedJurisdictions: vaultConfig.allowedJurisdictions, paused: vaultConfig.paused },
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Parse failed"); }
      setResult(await res.json());
    } catch (e: any) { setError(e?.message || "Unknown error"); }
    finally { setParsing(false); }
  };

  const handleApply = async () => {
    if (!result || !publicKey || !signTransaction || !vaultConfig) return;
    const { min_tier } = result.proposed_delta;
    if (min_tier === null) { setError("No tier change to apply. Jurisdiction changes must be applied via Super Admin."); return; }
    setApplying(true);
    try {
      const conn = new Connection(RPC_ENDPOINT, "confirmed");
      const [vcPDA] = findVaultConfigPDA(new PublicKey(VAULT_PROGRAM_ID), new PublicKey(GATE_PROGRAM_ID));
      const sig = await sendAdminTx(conn, buildUpdateVaultConfigIx(new PublicKey(GATE_PROGRAM_ID), vcPDA, publicKey, min_tier, null), publicKey, signTransaction);
      console.log("NL config applied:", sig);
      setApplied(true); setResult(null); setInstruction("");
      onApplied();
    } catch (e: any) { setError(e?.message || "Apply failed"); }
    finally { setApplying(false); }
  };

  const confidenceColor = (c: string) => c === "high" ? "var(--success)" : c === "medium" ? "var(--accent)" : "var(--danger)";

  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--bg-1)", marginBottom: "20px" }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <SectionLabel>AI Config — Natural Language</SectionLabel>
          <div style={{ ...f, fontSize: "15px", fontWeight: 600, color: "var(--text-1)" }}>Plain-English vault configuration</div>
        </div>
        <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.08em" }}>Powered by Claude Haiku</div>
      </div>

      <div style={{ padding: "24px" }}>
        <div style={{ ...m, fontSize: "10px", color: "var(--text-4)", lineHeight: 1.7, marginBottom: "16px" }}>
          Describe your compliance intent in plain English. Claude will parse the instruction and propose a configuration delta for your review before any on-chain change.
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
          <textarea
            value={instruction}
            onChange={e => { setInstruction(e.target.value); setResult(null); setError(null); setApplied(false); }}
            placeholder={`e.g. "Require institutional KYC for all Swiss transactions" or "Open access to Singapore and Japan"`}
            rows={2}
            style={{ ...m, fontSize: "12px", flex: 1, background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-1)", padding: "12px 14px", outline: "none", resize: "none", lineHeight: 1.65 }}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleParse(); }}
          />
          <button
            onClick={handleParse}
            disabled={!instruction.trim() || parsing || !vaultConfig}
            style={{ ...m, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--accent)", color: "white", border: "none", padding: "0 22px", cursor: !instruction.trim() || parsing || !vaultConfig ? "not-allowed" : "pointer", fontWeight: 600, opacity: !instruction.trim() || parsing || !vaultConfig ? 0.4 : 1, flexShrink: 0 }}
          >
            {parsing ? "Parsing..." : "Parse →"}
          </button>
        </div>

        {applied && (
          <div style={{ padding: "14px 16px", background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.25)", ...m, fontSize: "11px", color: "var(--success)", marginBottom: "12px" }}>
            Configuration applied on-chain.
          </div>
        )}

        {error && (
          <div style={{ padding: "14px 16px", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", ...m, fontSize: "11px", color: "var(--danger)", marginBottom: "12px" }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ border: "1px solid var(--border)", background: "var(--bg-2)" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ ...m, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-4)" }}>Proposed delta</div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: confidenceColor(result.confidence) }} />
                <span style={{ ...m, fontSize: "9px", color: confidenceColor(result.confidence), letterSpacing: "0.08em", textTransform: "uppercase" }}>{result.confidence} confidence</span>
              </div>
            </div>

            {/* Changes */}
            <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {result.proposed_delta.min_tier !== null ? (
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ ...m, fontSize: "10px", color: "var(--text-4)", width: "160px", flexShrink: 0 }}>Min clearance tier</span>
                  <span style={{ ...m, fontSize: "11px", color: "var(--text-3)", textDecoration: "line-through" }}>{tierLabel(vaultConfig?.minTier ?? 0)}</span>
                  <span style={{ ...m, fontSize: "10px", color: "var(--text-4)" }}>→</span>
                  <span style={{ ...m, fontSize: "11px", color: "var(--accent)", fontWeight: 600 }}>{tierLabel(result.proposed_delta.min_tier)}</span>
                </div>
              ) : null}

              {result.proposed_delta.allowed_jurisdictions !== null ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <span style={{ ...m, fontSize: "10px", color: "var(--text-4)", width: "160px", flexShrink: 0, marginTop: "3px" }}>Jurisdictions</span>
                  {result.proposed_delta.allowed_jurisdictions.length === 0 ? (
                    <span style={{ ...m, fontSize: "11px", color: "var(--accent)", fontWeight: 600 }}>All jurisdictions (open)</span>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {result.proposed_delta.allowed_jurisdictions.map(j => (
                        <span key={j} style={{ ...m, fontSize: "10px", padding: "3px 10px", background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent-border)", letterSpacing: "0.08em" }}>{j}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {result.proposed_delta.min_tier === null && result.proposed_delta.allowed_jurisdictions === null && (
                <div style={{ ...m, fontSize: "11px", color: "var(--text-4)" }}>No changes required. Current configuration already matches intent.</div>
              )}
              {result.proposed_delta.min_tier === null && result.proposed_delta.allowed_jurisdictions !== null && (
                <div style={{ ...m, fontSize: "10px", color: "var(--text-4)", marginTop: "4px", lineHeight: 1.65 }}>
                  Jurisdiction changes must be applied via Super Admin console (no on-chain apply available here).
                </div>
              )}

              <div style={{ paddingTop: "12px", borderTop: "1px solid var(--border)", ...m, fontSize: "11px", color: "var(--text-2)", lineHeight: 1.7 }}>
                {result.explanation}
              </div>

              {result.warnings.length > 0 && (
                <div style={{ padding: "12px 14px", background: "rgba(202,138,4,0.08)", border: "1px solid rgba(202,138,4,0.25)" }}>
                  {result.warnings.map((w, i) => (
                    <div key={i} style={{ ...m, fontSize: "10px", color: "#b45309", lineHeight: 1.7 }}>⚠ {w}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            {result.proposed_delta.min_tier !== null && (
              <div style={{ display: "flex", gap: "8px", padding: "14px 18px", borderTop: "1px solid var(--border)" }}>
                <button
                  onClick={handleApply}
                  disabled={applying || !publicKey || !signTransaction}
                  style={{ ...m, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--accent)", color: "white", border: "none", padding: "11px 22px", cursor: applying || !publicKey || !signTransaction ? "not-allowed" : "pointer", fontWeight: 600, opacity: applying || !publicKey || !signTransaction ? 0.4 : 1 }}
                >
                  {applying ? "Applying..." : "Apply On-Chain"}
                </button>
                <button
                  onClick={() => { setResult(null); setInstruction(""); }}
                  style={{ ...m, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: "transparent", color: "var(--text-3)", border: "1px solid var(--border)", padding: "11px 22px", cursor: "pointer" }}
                >
                  Discard
                </button>
                {!publicKey && <span style={{ ...m, fontSize: "10px", color: "var(--text-4)", alignSelf: "center", marginLeft: "8px" }}>Connect wallet to apply</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pause Modal ──────────────────────────────────────────────────────────────
function PauseModal({ onConfirm, onCancel }: { onConfirm: (r: string, n: string) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
      <div style={{ background: "var(--bg-1)", border: "1px solid var(--danger-border)", padding: "40px", maxWidth: "520px", width: "100%", position: "relative" }}>
        <div style={{ ...m, fontSize: "9px", color: "var(--danger)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>Emergency Control — Gate Pause</div>
        <h2 style={{ ...f, fontSize: "20px", fontWeight: 700, color: "var(--text-1)", marginBottom: "8px" }}>Pause vault gate?</h2>
        <p style={{ ...m, fontSize: "11px", color: "var(--text-3)", lineHeight: 1.75, marginBottom: "28px" }}>
          This will immediately block all vault interactions. Your reason will be permanently recorded on-chain and will appear in all compliance exports.
        </p>
        <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px" }}>
          Reason for pausing <span style={{ color: "var(--danger)" }}>*</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "20px" }}>
          {PAUSE_REASONS.map(r => (
            <button key={r.value} onClick={() => setSelected(r.value)} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px 14px", background: selected === r.value ? "var(--danger-bg)" : "var(--bg-2)", border: `1px solid ${selected === r.value ? "var(--danger-border)" : "var(--border)"}`, cursor: "pointer", textAlign: "left", transition: "all 0.12s" }}>
              <div style={{ width: "14px", height: "14px", borderRadius: "50%", flexShrink: 0, marginTop: "1px", border: `1px solid ${selected === r.value ? "var(--danger)" : "var(--border-2)"}`, background: selected === r.value ? "var(--danger)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {selected === r.value && <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "white" }} />}
              </div>
              <div>
                <div style={{ ...m, fontSize: "11px", color: selected === r.value ? "var(--danger)" : "var(--text-1)", fontWeight: 500, marginBottom: "2px" }}>{r.label}</div>
                <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", lineHeight: 1.6 }}>{r.desc}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>Additional notes <span style={{ color: "var(--text-4)", textTransform: "none", letterSpacing: 0 }}>(optional)</span></div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Wallet 5t1o...kxfb flagged by compliance team. Pending AML review." rows={3} style={{ ...m, fontSize: "11px", width: "100%", background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-1)", padding: "10px 14px", outline: "none", resize: "none", lineHeight: 1.7, marginBottom: "6px" }} />
        <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", marginBottom: "24px" }}>This text will be stored on-chain as part of the audit record.</div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => onConfirm(selected, notes)} disabled={!selected} style={{ ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: selected ? "var(--danger)" : "var(--danger-bg)", color: selected ? "white" : "var(--danger)", border: "1px solid var(--danger-border)", padding: "12px 24px", cursor: selected ? "pointer" : "not-allowed", fontWeight: 600, flex: 1 }}>Confirm Pause</button>
          <button onClick={onCancel} style={{ ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: "transparent", color: "var(--text-3)", border: "1px solid var(--border)", padding: "12px 24px", cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function UnpauseModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
      <div style={{ background: "var(--bg-1)", border: "1px solid var(--border-2)", padding: "40px", maxWidth: "440px", width: "100%" }}>
        <div style={{ ...m, fontSize: "9px", color: "var(--accent)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>Resume Operations</div>
        <h2 style={{ ...f, fontSize: "20px", fontWeight: 700, color: "var(--text-1)", marginBottom: "12px" }}>Resume vault gate?</h2>
        <p style={{ ...m, fontSize: "11px", color: "var(--text-3)", lineHeight: 1.75, marginBottom: "28px" }}>Vault interactions will resume immediately. All 7 compliance checks will be enforced on every access attempt.</p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onConfirm} style={{ ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--accent)", color: "white", border: "none", padding: "12px 24px", cursor: "pointer", fontWeight: 600, flex: 1 }}>Resume Gate</button>
          <button onClick={onCancel} style={{ ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: "transparent", color: "var(--text-3)", border: "1px solid var(--border)", padding: "12px 24px", cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, prominent }: { label: string; value: string; sub: string; color: string; prominent?: boolean }) {
  return (
    <div style={{ border: "1px solid var(--border)", padding: prominent ? "24px 28px" : "20px 24px", background: "var(--bg-1)", borderTop: prominent ? `2px solid ${color}` : "1px solid var(--border)" }}>
      <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "12px" }}>{label}</div>
      <div style={{ ...f, fontSize: prominent ? "36px" : "28px", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1, color, marginBottom: "8px" }}>{value}</div>
      <div style={{ ...m, fontSize: "10px", color: "var(--text-4)", lineHeight: 1.5 }}>{sub}</div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>{children}</div>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function VaultPage() {
  const { publicKey, signTransaction } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<VaultConfig | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPause, setShowPause] = useState(false);
  const [showUnpause, setShowUnpause] = useState(false);
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
        const ae = await fetchRecentAuditEntries(vc.auditNonce);
        setEntries(ae);
      }
      setLastRefresh(new Date());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (mounted) refresh(); }, [mounted, refresh]);
  useEffect(() => { const t = setInterval(refresh, 30000); return () => clearInterval(t); }, [refresh]);

  if (!mounted) return null;

  const approved     = entries.filter(e => e.outcome === "approved").length;
  const denied       = entries.filter(e => e.outcome === "denied").length;
  const approvalRate = entries.length > 0 ? Math.round((approved / entries.length) * 100) : 0;
  const denialMap: Record<number, number> = {};
  entries.filter(e => e.outcome === "denied").forEach(e => { denialMap[e.reasonCode] = (denialMap[e.reasonCode] || 0) + 1; });
  const sortedDenials = Object.entries(denialMap).sort(([, a], [, b]) => b - a).slice(0, 5);

  const handlePause = async (_reason: string, _notes: string) => {
    if (!publicKey || !signTransaction) return;
    setProcessing(true); setShowPause(false);
    try {
      const conn = new Connection(RPC_ENDPOINT, "confirmed");
      const [vcPDA] = findVaultConfigPDA(new PublicKey(VAULT_PROGRAM_ID), new PublicKey(GATE_PROGRAM_ID));
      const sig = await sendAdminTx(conn, buildPauseGateIx(new PublicKey(GATE_PROGRAM_ID), vcPDA, publicKey), publicKey, signTransaction);
      console.log("Paused:", sig); await refresh();
    } catch (e: any) { alert("Pause failed: " + (e?.message || "unknown")); }
    finally { setProcessing(false); }
  };

  const handleUnpause = async () => {
    if (!publicKey || !signTransaction) return;
    setProcessing(true); setShowUnpause(false);
    try {
      const conn = new Connection(RPC_ENDPOINT, "confirmed");
      const [vcPDA] = findVaultConfigPDA(new PublicKey(VAULT_PROGRAM_ID), new PublicKey(GATE_PROGRAM_ID));
      const sig = await sendAdminTx(conn, buildUnpauseGateIx(new PublicKey(GATE_PROGRAM_ID), vcPDA, publicKey), publicKey, signTransaction);
      console.log("Unpaused:", sig); await refresh();
    } catch (e: any) { alert("Unpause failed: " + (e?.message || "unknown")); }
    finally { setProcessing(false); }
  };

  const handleTier = async () => {
    if (!publicKey || !signTransaction) return;
    setSavingTier(true);
    try {
      const conn = new Connection(RPC_ENDPOINT, "confirmed");
      const [vcPDA] = findVaultConfigPDA(new PublicKey(VAULT_PROGRAM_ID), new PublicKey(GATE_PROGRAM_ID));
      const sig = await sendAdminTx(conn, buildUpdateVaultConfigIx(new PublicKey(GATE_PROGRAM_ID), vcPDA, publicKey, pendingTier, null), publicKey, signTransaction);
      console.log("Updated:", sig); await refresh();
    } catch (e: any) { alert("Update failed: " + (e?.message || "unknown")); }
    finally { setSavingTier(false); }
  };

  const gateActive = !loading && config && !config.paused;
  const gatePaused = !loading && config?.paused;

  return (
    <AdminShell current="/vault">
      {showPause   && <PauseModal   onConfirm={handlePause}   onCancel={() => setShowPause(false)} />}
      {showUnpause && <UnpauseModal onConfirm={handleUnpause} onCancel={() => setShowUnpause(false)} />}

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", paddingBottom: "24px", borderBottom: "1px solid var(--border)" }}>
        <div>
          <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "8px" }}>/02 — Vault Operator</div>
          <h1 style={{ ...f, fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)", marginBottom: "10px" }}>Vault Dashboard</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: gateActive ? "var(--success)" : gatePaused ? "var(--danger)" : "var(--text-4)" }} />
              <span style={{ ...m, fontSize: "11px", color: gateActive ? "var(--success)" : gatePaused ? "var(--danger)" : "var(--text-4)", fontWeight: 500 }}>
                {loading ? "Loading..." : gateActive ? "Gate active — 7 checks enforced" : gatePaused ? "Gate paused — all access blocked" : "Unable to read on-chain state"}
              </span>
            </div>
            {lastRefresh && (
              <>
                <span style={{ ...m, fontSize: "10px", color: "var(--text-4)" }}>·</span>
                <span style={{ ...m, fontSize: "10px", color: "var(--text-4)" }}>Refreshed {timeAgo(Math.floor(lastRefresh.getTime() / 1000))}</span>
                <button onClick={refresh} disabled={loading} style={{ ...m, fontSize: "9px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", padding: 0, opacity: loading ? 0.4 : 1 }}>
                  {loading ? "..." : "↻ Refresh"}
                </button>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
          {config?.paused ? (
            <button onClick={() => setShowUnpause(true)} disabled={processing} style={{ ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--accent)", color: "white", border: "none", padding: "11px 22px", cursor: "pointer", fontWeight: 600, opacity: processing ? 0.5 : 1 }}>
              ▶ Resume Gate
            </button>
          ) : (
            <button onClick={() => setShowPause(true)} disabled={processing || !config} style={{ ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger-border)", padding: "11px 22px", cursor: "pointer", fontWeight: 600, opacity: processing || !config ? 0.5 : 1 }}>
              ■ Pause Gate
            </button>
          )}
          <span style={{ ...m, fontSize: "9px", color: "var(--text-4)" }}>Action is permanently logged on-chain</span>
        </div>
      </div>

      {/* ── Row 1: Vault identity strip ─────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2px", marginBottom: "2px" }}>
        {/* Gate status */}
        <div style={{ border: "1px solid var(--border)", padding: "20px 24px", background: "var(--bg-1)", borderLeft: `3px solid ${gateActive ? "var(--success)" : gatePaused ? "var(--danger)" : "var(--border)"}` }}>
          <SectionLabel>Gate status</SectionLabel>
          <div style={{ ...f, fontSize: "18px", fontWeight: 700, color: gateActive ? "var(--success)" : gatePaused ? "var(--danger)" : "var(--text-4)", marginBottom: "4px", lineHeight: 1.2 }}>
            {loading ? "—" : gateActive ? "Active" : gatePaused ? "Paused" : "Unknown"}
          </div>
          <div style={{ ...m, fontSize: "10px", color: "var(--text-4)", lineHeight: 1.6 }}>
            {gateActive ? "7 compliance checks active" : gatePaused ? "All vault interactions blocked" : "—"}
          </div>
        </div>

        {/* Vault program */}
        <div style={{ border: "1px solid var(--border)", padding: "20px 24px", background: "var(--bg-1)" }}>
          <SectionLabel>Vault program</SectionLabel>
          <a href={addressUrl(VAULT_PROGRAM_ID)} target="_blank" rel="noreferrer" style={{ ...m, fontSize: "13px", color: "var(--accent)", textDecoration: "none", display: "block", marginBottom: "4px", fontWeight: 500 }}>
            {shortAddr(VAULT_PROGRAM_ID, 10)}
          </a>
          <div style={{ ...m, fontSize: "10px", color: "var(--text-4)" }}>Solana devnet</div>
        </div>

        {/* Deployed */}
        <div style={{ border: "1px solid var(--border)", padding: "20px 24px", background: "var(--bg-1)" }}>
          <SectionLabel>Deployed</SectionLabel>
          <div style={{ ...m, fontSize: "13px", color: "var(--text-1)", marginBottom: "4px", fontWeight: 500 }}>
            {config ? new Date(config.registeredAt * 1000).toLocaleDateString("en-CH", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
          </div>
          <div style={{ ...m, fontSize: "10px", color: "var(--text-4)" }}>Gate: {shortAddr(GATE_PROGRAM_ID, 8)}</div>
        </div>
      </div>

      {/* ── Row 2: Stats ──────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "2px", marginBottom: "20px" }}>
        <StatCard label="Gate Calls" value={loading ? "—" : entries.length.toString()} sub="Last 20 on-chain records" color="var(--text-1)" />
        <StatCard label="Approved" value={loading ? "—" : approved.toString()} sub={`${approvalRate}% approval rate`} color="var(--success)" prominent />
        <StatCard label="Denied" value={loading ? "—" : denied.toString()} sub={`${100 - approvalRate}% block rate`} color="var(--danger)" prominent />
        <StatCard label="Total Lifetime" value={loading ? "—" : (config?.auditNonce ?? "—").toString()} sub="Audit nonce — all-time calls" color="var(--text-1)" />
      </div>

      {/* ── Row 3: Main grid ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "2px", marginBottom: "20px" }}>

        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>

          {/* Denial breakdown */}
          <div style={{ border: "1px solid var(--border)", padding: "24px", background: "var(--bg-1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "20px" }}>
              <div>
                <SectionLabel>Denial breakdown</SectionLabel>
                <div style={{ ...f, fontSize: "15px", fontWeight: 600, color: "var(--text-1)" }}>
                  {loading ? "Loading..." : denied === 0 ? "No denials recorded" : `${denied} denial${denied > 1 ? "s" : ""} in last 20 calls`}
                </div>
              </div>
              {denied > 0 && <span style={{ ...m, fontSize: "10px", color: "var(--text-4)" }}>{denied} total</span>}
            </div>

            {loading ? (
              <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", padding: "8px 0" }}>Loading on-chain records...</div>
            ) : sortedDenials.length === 0 ? (
              <div style={{ ...m, fontSize: "11px", color: "var(--text-3)", padding: "16px 0", borderTop: "1px solid var(--border)" }}>
                All recent access attempts were approved. No denial reasons to report.
              </div>
            ) : (
              <>
                {sortedDenials.map(([code, count]) => {
                  const pct = denied > 0 ? Math.round((count / denied) * 100) : 0;
                  return (
                    <div key={code} style={{ display: "grid", gridTemplateColumns: "180px 36px 1fr 40px", gap: "12px", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                      <span style={{ ...m, fontSize: "11px", color: "var(--text-2)" }}>{REASON_CODES[parseInt(code)] || `Code ${code}`}</span>
                      <span style={{ ...m, fontSize: "12px", color: "var(--text-1)", fontWeight: 600, textAlign: "right" }}>{count}</span>
                      <div style={{ height: "4px", background: "var(--bg-3)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "var(--danger)", opacity: 0.65 }} />
                      </div>
                      <span style={{ ...m, fontSize: "9px", color: "var(--text-4)", textAlign: "right" }}>{pct}%</span>
                    </div>
                  );
                })}
                <div style={{ marginTop: "16px", padding: "14px 16px", background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                  <div style={{ ...m, fontSize: "10px", color: "var(--text-4)", lineHeight: 1.8 }}>
                    High <strong style={{ color: "var(--text-2)", fontWeight: 500 }}>TierInsufficient</strong> — users are under-credentialled. Contact your KYC issuer.
                    {" · "}High <strong style={{ color: "var(--text-2)", fontWeight: 500 }}>AttestationExpired</strong> — prompt users to renew credentials.
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Trusted issuers */}
          <div style={{ border: "1px solid var(--border)", padding: "24px", background: "var(--bg-1)" }}>
            <div style={{ marginBottom: "16px" }}>
              <SectionLabel>Trusted issuers</SectionLabel>
              <div style={{ ...f, fontSize: "15px", fontWeight: 600, color: "var(--text-1)" }}>
                {loading ? "—" : `${config?.trustedIssuers.length ?? 0} registered issuer${(config?.trustedIssuers.length ?? 0) !== 1 ? "s" : ""}`}
              </div>
            </div>

            {loading ? (
              <div style={{ ...m, fontSize: "11px", color: "var(--text-4)" }}>Loading...</div>
            ) : (config?.trustedIssuers.length ?? 0) === 0 ? (
              <div style={{ ...m, fontSize: "11px", color: "var(--danger)", padding: "12px 16px", border: "1px solid var(--danger-border)", background: "var(--danger-bg)" }}>
                No trusted issuers registered. All attestations will fail with UntrustedIssuer.
              </div>
            ) : (
              config?.trustedIssuers.map((issuer, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success)", flexShrink: 0 }} />
                    <div>
                      <a href={addressUrl(issuer)} target="_blank" rel="noreferrer" style={{ ...m, fontSize: "11px", color: "var(--accent)", textDecoration: "none", display: "block" }}>
                        {shortAddr(issuer, 12)}
                      </a>
                      <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", marginTop: "2px" }}>Registered issuer</div>
                    </div>
                  </div>
                  <span style={{ ...m, fontSize: "9px", padding: "3px 10px", background: "rgba(22,163,74,0.08)", color: "var(--success)", border: "1px solid rgba(22,163,74,0.2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Active</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column — Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>

          {/* Min clearance tier */}
          <div style={{ border: "1px solid var(--border)", padding: "24px", background: "var(--bg-1)" }}>
            <SectionLabel>Minimum clearance tier</SectionLabel>
            <div style={{ ...f, fontSize: "20px", fontWeight: 700, color: "var(--text-1)", marginBottom: "4px", lineHeight: 1.2 }}>
              {config ? tierLabel(config.minTier) : "—"}
            </div>
            <div style={{ ...m, fontSize: "10px", color: "var(--text-4)", lineHeight: 1.65, marginBottom: "20px" }}>
              Wallets with credentials below this tier are denied with TierInsufficient.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <select value={pendingTier} onChange={e => setPendingTier(parseInt(e.target.value))} style={{ ...m, fontSize: "11px", background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-1)", padding: "10px 12px", outline: "none", cursor: "pointer", width: "100%" }}>
                <option value={1}>Tier 1 — Basic KYC</option>
                <option value={2}>Tier 2 — Enhanced Due Diligence</option>
                <option value={3}>Tier 3 — Institutional / FATF</option>
              </select>
              <button onClick={handleTier} disabled={savingTier || pendingTier === config?.minTier || !config} style={{ ...m, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--accent)", color: "white", border: "none", padding: "11px", cursor: "pointer", fontWeight: 600, opacity: savingTier || pendingTier === config?.minTier || !config ? 0.4 : 1 }}>
                {savingTier ? "Updating..." : "Update Tier"}
              </button>
            </div>
            <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", marginTop: "10px", lineHeight: 1.65 }}>Effective immediately on next gate call.</div>
          </div>

          {/* Jurisdictions */}
          <div style={{ border: "1px solid var(--border)", padding: "24px", background: "var(--bg-1)" }}>
            <SectionLabel>Permitted jurisdictions</SectionLabel>
            <div style={{ ...f, fontSize: "15px", fontWeight: 600, color: "var(--text-1)", marginBottom: "12px" }}>
              {loading ? "—" : (config?.allowedJurisdictions.length ?? 0) === 0 ? "All jurisdictions" : `${config?.allowedJurisdictions.length} configured`}
            </div>
            {(config?.allowedJurisdictions.length ?? 0) === 0 ? (
              <div style={{ ...m, fontSize: "10px", color: "var(--text-4)", lineHeight: 1.7 }}>
                No restrictions configured. Any wallet with valid credentials may access regardless of jurisdiction.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {config?.allowedJurisdictions.map(j => (
                  <span key={j} style={{ ...m, fontSize: "10px", padding: "4px 12px", background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent-border)", letterSpacing: "0.08em" }}>{j}</span>
                ))}
              </div>
            )}
            <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", marginTop: "14px", paddingTop: "14px", borderTop: "1px solid var(--border)", lineHeight: 1.65 }}>
              Jurisdiction rules managed via Super Admin console.
            </div>
          </div>

          {/* Active compliance checks */}
          <div style={{ border: "1px solid var(--border)", padding: "24px", background: "var(--bg-1)" }}>
            <SectionLabel>Active compliance checks</SectionLabel>
            <div style={{ ...f, fontSize: "15px", fontWeight: 600, color: "var(--text-1)", marginBottom: "16px" }}>7 checks active</div>
            {[
              ["Gate status",           "GatePaused"],
              ["Attestation exists",    "NoAttestation"],
              ["Not revoked",           "AttestationRevoked"],
              ["Not expired",           "AttestationExpired"],
              ["Trusted issuer",        "UntrustedIssuer"],
              ["Tier sufficient",       "TierInsufficient"],
              ["Jurisdiction eligible", "JurisdictionBlocked"],
            ].map(([label, code], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--success)", flexShrink: 0 }} />
                  <span style={{ ...m, fontSize: "10px", color: "var(--text-2)" }}>{label}</span>
                </div>
                <span style={{ ...m, fontSize: "9px", color: "var(--text-4)" }}>{code}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 4: Natural Language Config ──────────────────────────────── */}
      <NLConfigPanel vaultConfig={config} publicKey={publicKey} signTransaction={signTransaction} onApplied={refresh} />

      {/* ── Row 5: Recent activity ───────────────────────────────────────── */}
      <div style={{ border: "1px solid var(--border)", background: "var(--bg-1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <SectionLabel>Recent gate activity</SectionLabel>
            <div style={{ ...f, fontSize: "15px", fontWeight: 600, color: "var(--text-1)" }}>On-chain audit records</div>
          </div>
          <a href="/audit" style={{ ...m, fontSize: "10px", color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Full Audit Log →</a>
        </div>

        {loading ? (
          <div style={{ padding: "24px", ...m, fontSize: "11px", color: "var(--text-4)" }}>Loading on-chain records...</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: "32px 24px" }}>
            <div style={{ ...f, fontSize: "15px", fontWeight: 600, color: "var(--text-2)", marginBottom: "6px" }}>No gate calls recorded yet.</div>
            <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", lineHeight: 1.7 }}>Activity will appear here once users begin interacting with the vault. The audit log is append-only and tamper-proof.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 160px 140px 80px 100px", gap: "16px", padding: "10px 24px", ...m, fontSize: "8px", color: "var(--text-4)", letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>
              <span>Result</span><span>Wallet</span><span>Reason</span><span>Attestation</span><span>Tier</span><span>Time</span>
            </div>
            {entries.slice(0, 10).map((e, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "72px 1fr 160px 140px 80px 100px", gap: "16px", padding: "13px 24px", borderBottom: i < Math.min(entries.length, 10) - 1 ? "1px solid var(--border)" : "none", ...m, fontSize: "11px", alignItems: "center", borderLeft: `3px solid ${e.outcome === "approved" ? "var(--success)" : "var(--danger)"}` }}>
                <span style={{ color: e.outcome === "approved" ? "var(--success)" : "var(--danger)", fontWeight: 700, letterSpacing: "0.06em", fontSize: "9px", textTransform: "uppercase" }}>
                  {e.outcome === "approved" ? "PASS" : "DENY"}
                </span>
                <span style={{ color: "var(--text-2)", fontSize: "11px" }}>{shortAddr(e.wallet, 6)}</span>
                <span style={{ color: "var(--text-3)", fontSize: "11px" }}>{REASON_CODES[e.reasonCode] || `Code ${e.reasonCode}`}</span>
                <a href={addressUrl(e.attestationId)} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none", fontSize: "10px" }}>
                  {shortAddr(e.attestationId, 6)}
                </a>
                <span style={{ color: "var(--text-3)", fontSize: "10px" }}>{e.tier > 0 ? `Tier ${e.tier}` : "—"}</span>
                <span style={{ color: "var(--text-4)", fontSize: "10px" }}>{timeAgo(e.timestamp)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </AdminShell>
  );
}
