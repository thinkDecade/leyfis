"use client";
import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { AdminShell } from "@/components/AdminShell";
import {
  GATE_PROGRAM_ID, VAULT_PROGRAM_ID, RPC_ENDPOINT, SEEDS, shortAddr,
  buildUpdateVaultConfigIx, findVaultConfigPDA, sendAdminTx, track,
} from "@leyfis/shared";

const m = { fontFamily: "'DM Mono', monospace" };
const f = { fontFamily: "'Inter', sans-serif" };

// ─── Types ────────────────────────────────────────────────────────────────────

type ProposalStatus  = "pending" | "applied" | "dismissed";
type ProposalUrgency = "high" | "medium" | "low";

interface ProposedChange {
  min_tier?:              number | null;
  add_jurisdictions?:    string[] | null;
  remove_jurisdictions?: string[] | null;
}

interface RegulatoryProposal {
  id:             string;
  source:         string;
  title:          string;
  summary:        string;
  fullText:       string;
  proposedChange: ProposedChange;
  urgency:        ProposalUrgency;
  jurisdiction:   string;
  effectiveDate:  string;
  status:         ProposalStatus;
  dismissNote?:   string;
  scanned?:       boolean;
}

interface VaultConfig {
  minTier:              number;
  trustedIssuers:       string[];
  allowedJurisdictions: string[];
  paused:               boolean;
}

// ─── Seed proposal ───────────────────────────────────────────────────────────

const SEED_PROPOSALS: RegulatoryProposal[] = [
  {
    id: "fatf-2026-ch-tier3",
    source: "FATF",
    title: "FATF Recommendation 16 Amendment — Switzerland Institutional Threshold",
    summary: "FATF updated guidance requires all CHE-jurisdiction DeFi protocols to enforce Tier 3 (Institutional) credentials for transactions above CHF 1,000. Effective June 1, 2026.",
    fullText: "The Financial Action Task Force revised Recommendation 16 guidance in Q1 2026, mandating institutional-grade KYC (equivalent to Tier 3) for all virtual asset service providers operating under Swiss AMLA jurisdiction when processing transactions exceeding CHF 1,000. Compliance is required by June 1, 2026 or operators risk suspension of operating licences. The Leyfis Gate min_tier parameter must be set to 3 to satisfy this requirement.",
    proposedChange: { min_tier: 3 },
    urgency: "high",
    jurisdiction: "CHE",
    effectiveDate: "2026-06-01",
    status: "pending",
  },
];

// ─── On-chain reads ───────────────────────────────────────────────────────────

const GATE  = new PublicKey(GATE_PROGRAM_ID);
const VAULT = new PublicKey(VAULT_PROGRAM_ID);

async function fetchVaultConfig(): Promise<VaultConfig | null> {
  try {
    const conn = new Connection(RPC_ENDPOINT, "confirmed");
    const [vcPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.VAULT_CONFIG), VAULT.toBuffer()], GATE);
    const info = await conn.getAccountInfo(vcPDA);
    if (!info) return null;
    const d = info.data;
    const minTier     = d[72];
    const issuerCount = d.readUInt32LE(73);
    const issuers: string[] = [];
    for (let i = 0; i < issuerCount; i++) {
      const off = 77 + i * 32;
      if (off + 32 <= d.length) issuers.push(new PublicKey(d.slice(off, off + 32)).toBase58());
    }
    const jurOff   = 77 + issuerCount * 32;
    const jurCount = d.readUInt32LE(jurOff);
    const jurs: string[] = [];
    for (let i = 0; i < jurCount; i++) {
      const off = jurOff + 4 + i * 3;
      if (off + 3 <= d.length) jurs.push(String.fromCharCode(d[off], d[off+1], d[off+2]));
    }
    const pOff  = jurOff + 4 + jurCount * 3;
    const paused = d[pOff] !== 0;
    return { minTier, trustedIssuers: issuers, allowedJurisdictions: jurs, paused };
  } catch { return null; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "leyfis-regulatory-proposals";

function loadProposals(): RegulatoryProposal[] {
  if (typeof window === "undefined") return SEED_PROPOSALS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_PROPOSALS;
    const stored: RegulatoryProposal[] = JSON.parse(raw);
    const storedIds = new Set(stored.map(p => p.id));
    const merged = [...stored];
    for (const seed of SEED_PROPOSALS) {
      if (!storedIds.has(seed.id)) merged.unshift(seed);
    }
    return merged;
  } catch { return SEED_PROPOSALS; }
}

function saveProposals(proposals: RegulatoryProposal[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(proposals)); } catch {}
}

function urgencyColor(u: ProposalUrgency) {
  return u === "high" ? "var(--danger)" : u === "medium" ? "#C5930A" : "var(--success)";
}

function urgencyBg(u: ProposalUrgency) {
  return u === "high" ? "rgba(122,31,31,0.08)" : u === "medium" ? "rgba(197,147,10,0.06)" : "rgba(15,110,86,0.06)";
}

function urgencyBorder(u: ProposalUrgency) {
  return u === "high" ? "rgba(122,31,31,0.25)" : u === "medium" ? "rgba(197,147,10,0.2)" : "rgba(15,110,86,0.2)";
}

function SectionLabel({ children }: { children: string }) {
  return <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>{children}</div>;
}

function DeltaTag({ label }: { label: string }) {
  return <span style={{ ...m, fontSize: "9px", background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent)", padding: "3px 8px", letterSpacing: "0.06em" }}>{label}</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegulatoryPage() {
  const { publicKey, signTransaction } = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [proposals, setProposals]       = useState<RegulatoryProposal[]>([]);
  const [vaultConfig, setVaultConfig]   = useState<VaultConfig | null>(null);
  const [loadingVc, setLoadingVc]       = useState(true);
  const [scanning, setScanning]         = useState(false);
  const [scanError, setScanError]       = useState("");
  const [applying, setApplying]         = useState<string | null>(null);
  const [applyResult, setApplyResult]   = useState<{ id: string; sig?: string; error?: string } | null>(null);
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [dismissTarget, setDismissTarget] = useState<string | null>(null);
  const [dismissNote, setDismissNote]   = useState("");

  useEffect(() => {
    if (!mounted) return;
    setProposals(loadProposals());
    fetchVaultConfig().then(vc => { setVaultConfig(vc); setLoadingVc(false); });
  }, [mounted]);

  const updateProposal = useCallback((id: string, patch: Partial<RegulatoryProposal>) => {
    setProposals(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...patch } : p);
      saveProposals(next);
      return next;
    });
  }, []);

  const handleScan = async () => {
    if (!vaultConfig) return;
    setScanning(true); setScanError("");
    try {
      const res = await fetch("/api/regulatory-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minTier:      vaultConfig.minTier,
          jurisdictions: vaultConfig.allowedJurisdictions,
          issuerCount:  vaultConfig.trustedIssuers.length,
          paused:       vaultConfig.paused,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Scan failed" }));
        throw new Error(err.error);
      }
      const newProposals: RegulatoryProposal[] = await res.json();
      setProposals(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const toAdd = newProposals
          .filter((p: any) => !existingIds.has(p.id ?? `scan-${Date.now()}-${Math.random()}`))
          .map((p: any, i: number) => ({
            ...p,
            id:      p.id ?? `scan-${Date.now()}-${i}`,
            status:  "pending" as ProposalStatus,
            scanned: true,
          }));
        const merged = [...toAdd, ...prev];
        saveProposals(merged);
        return merged;
      });
    } catch (e: any) {
      setScanError(e?.message || "Regulatory scan failed. Check ANTHROPIC_API_KEY.");
    } finally { setScanning(false); }
  };

  const handleApply = async (proposal: RegulatoryProposal) => {
    if (!publicKey || !signTransaction || !vaultConfig) return;
    setApplying(proposal.id); setApplyResult(null);
    try {
      const conn    = new Connection(RPC_ENDPOINT, "confirmed");
      const gate    = new PublicKey(GATE_PROGRAM_ID);
      const [vcPDA] = findVaultConfigPDA(VAULT, gate);

      let newTier:    number | null = null;
      let newIssuers: PublicKey[] | null = null;

      if (proposal.proposedChange.min_tier != null) {
        newTier = proposal.proposedChange.min_tier;
      }

      const ix  = buildUpdateVaultConfigIx(gate, vcPDA, publicKey, newTier, newIssuers);
      const sig = await sendAdminTx(conn, ix, publicKey, signTransaction);

      updateProposal(proposal.id, { status: "applied" });
      track({ event: "regulatory_proposal_applied", proposal_id: proposal.id, tx_signature: sig });
      setApplyResult({ id: proposal.id, sig });
      if (newTier !== null) setVaultConfig(prev => prev ? { ...prev, minTier: newTier! } : prev);
    } catch (e: any) {
      setApplyResult({ id: proposal.id, error: (e?.message || "Transaction failed").slice(0, 200) });
    } finally { setApplying(null); }
  };

  const handleDismiss = (id: string) => {
    updateProposal(id, { status: "dismissed", dismissNote: dismissNote || undefined });
    track({ event: "regulatory_proposal_dismissed", proposal_id: id });
    setDismissTarget(null); setDismissNote("");
  };

  if (!mounted) return null;

  const pending   = proposals.filter(p => p.status === "pending");
  const actioned  = proposals.filter(p => p.status !== "pending");
  const highCount = pending.filter(p => p.urgency === "high").length;

  return (
    <AdminShell current="/regulatory">

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", paddingBottom: "24px", borderBottom: "1px solid var(--border)" }}>
        <div>
          <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "8px" }}>/08 — Regulatory Intelligence</div>
          <h1 style={{ ...f, fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)", marginBottom: "8px" }}>Regulatory Intelligence</h1>
          <p style={{ ...m, fontSize: "11px", color: "var(--text-3)", lineHeight: 1.7, maxWidth: "580px" }}>
            AI-monitored regulatory feed for your vault's jurisdictions. Proposals are reviewed by the operator and applied on-chain — AI proposes, you sign.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
          <button
            onClick={handleScan}
            disabled={scanning || !vaultConfig}
            style={{ ...m, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: scanning ? "var(--bg-2)" : "var(--accent)", color: scanning ? "var(--accent)" : "white", border: "1px solid var(--accent)", padding: "12px 20px", cursor: scanning || !vaultConfig ? "not-allowed" : "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
            {scanning ? "⟳ Scanning..." : "Scan Regulatory Updates →"}
          </button>
          {scanError && <span style={{ ...m, fontSize: "9px", color: "var(--danger)" }}>{scanError}</span>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "2px", alignItems: "start" }}>

        {/* Left — Proposal Queue */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>

          {/* Status bar */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "2px", marginBottom: "4px" }}>
            {[
              { label: "Pending review",    value: pending.length.toString(),          color: "var(--text-1)" },
              { label: "High urgency",      value: highCount.toString(),               color: highCount > 0 ? "var(--danger)" : "var(--text-4)" },
              { label: "Applied on-chain",  value: proposals.filter(p => p.status === "applied").length.toString(),   color: "var(--success)" },
              { label: "Dismissed",         value: proposals.filter(p => p.status === "dismissed").length.toString(), color: "var(--text-4)" },
            ].map((s, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", padding: "14px 20px", background: "var(--bg-1)" }}>
                <SectionLabel>{s.label}</SectionLabel>
                <div style={{ ...f, fontSize: "24px", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Pending proposals */}
          {pending.length === 0 ? (
            <div style={{ border: "1px solid var(--border)", padding: "32px 24px", background: "var(--bg-1)" }}>
              <div style={{ ...f, fontSize: "15px", fontWeight: 600, color: "var(--text-2)", marginBottom: "8px" }}>No pending proposals</div>
              <div style={{ ...m, fontSize: "11px", color: "var(--text-4)", lineHeight: 1.7 }}>
                Click "Scan Regulatory Updates" to fetch the latest regulatory developments for your vault's jurisdictions.
              </div>
            </div>
          ) : (
            pending.map(proposal => (
              <div key={proposal.id} style={{ border: `1px solid ${urgencyBorder(proposal.urgency)}`, background: urgencyBg(proposal.urgency) }}>
                {/* Card header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: `1px solid ${urgencyBorder(proposal.urgency)}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                    <span style={{ ...m, fontSize: "8px", fontWeight: 700, color: urgencyColor(proposal.urgency), border: `1px solid ${urgencyBorder(proposal.urgency)}`, padding: "3px 8px", letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0 }}>
                      {proposal.urgency.toUpperCase()}
                    </span>
                    <span style={{ ...m, fontSize: "9px", color: "var(--text-4)", flexShrink: 0 }}>{proposal.source}</span>
                    <span style={{ ...f, fontSize: "13px", fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proposal.title}</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0, marginLeft: "16px" }}>
                    <span style={{ ...m, fontSize: "9px", color: "var(--text-4)" }}>Effective {proposal.effectiveDate}</span>
                    <button onClick={() => setExpanded(expanded === proposal.id ? null : proposal.id)} style={{ ...m, fontSize: "9px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {expanded === proposal.id ? "Collapse" : "Details"}
                    </button>
                  </div>
                </div>

                {/* Summary */}
                <div style={{ padding: "16px 24px" }}>
                  <p style={{ ...m, fontSize: "11px", color: "var(--text-2)", lineHeight: 1.8, margin: 0, marginBottom: expanded === proposal.id ? "16px" : 0 }}>
                    {proposal.summary}
                  </p>

                  {expanded === proposal.id && (
                    <>
                      <p style={{ ...m, fontSize: "10px", color: "var(--text-3)", lineHeight: 1.8, margin: 0, marginBottom: "16px" }}>
                        {proposal.fullText}
                      </p>

                      {/* Proposed change delta */}
                      {(proposal.proposedChange.min_tier != null || (proposal.proposedChange.add_jurisdictions?.length ?? 0) > 0 || (proposal.proposedChange.remove_jurisdictions?.length ?? 0) > 0) && (
                        <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", padding: "14px 18px", marginBottom: "16px" }}>
                          <SectionLabel>Proposed vault config change</SectionLabel>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                            {proposal.proposedChange.min_tier != null && (
                              <DeltaTag label={`Set min_tier → ${proposal.proposedChange.min_tier} (${proposal.proposedChange.min_tier === 3 ? "Institutional" : proposal.proposedChange.min_tier === 2 ? "Enhanced DD" : "Basic"})`} />
                            )}
                            {proposal.proposedChange.add_jurisdictions?.map(j => (
                              <DeltaTag key={j} label={`Add jurisdiction: ${j}`} />
                            ))}
                            {proposal.proposedChange.remove_jurisdictions?.map(j => (
                              <DeltaTag key={j} label={`Remove jurisdiction: ${j}`} />
                            ))}
                          </div>
                          {vaultConfig && proposal.proposedChange.min_tier != null && (
                            <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", marginTop: "10px" }}>
                              Current: min_tier = {vaultConfig.minTier} → Proposed: {proposal.proposedChange.min_tier}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {(proposal.proposedChange.min_tier != null || (proposal.proposedChange.add_jurisdictions?.length ?? 0) > 0) && (
                      <>
                        {!publicKey ? (
                          <span style={{ ...m, fontSize: "9px", color: "var(--text-4)" }}>Connect wallet to apply</span>
                        ) : (
                          <button
                            onClick={() => handleApply(proposal)}
                            disabled={applying === proposal.id}
                            style={{ ...m, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: applying === proposal.id ? "var(--bg-2)" : "var(--accent)", color: applying === proposal.id ? "var(--accent)" : "white", border: "1px solid var(--accent)", padding: "9px 18px", cursor: applying === proposal.id ? "not-allowed" : "pointer", fontWeight: 600 }}>
                            {applying === proposal.id ? "⟳ Applying..." : "Apply On-Chain →"}
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => setDismissTarget(proposal.id)}
                      style={{ ...m, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", background: "none", border: "1px solid var(--border)", color: "var(--text-3)", padding: "9px 16px", cursor: "pointer" }}>
                      Dismiss
                    </button>
                    <span style={{ ...m, fontSize: "9px", color: "var(--text-4)", marginLeft: "auto" }}>
                      {proposal.jurisdiction} · {proposal.scanned ? "AI-detected" : "Seeded"}
                    </span>
                  </div>

                  {/* Apply result */}
                  {applyResult?.id === proposal.id && (
                    <div style={{ marginTop: "12px", padding: "12px 16px", border: `1px solid ${applyResult.error ? "var(--danger-border)" : "rgba(15,110,86,0.2)"}`, background: applyResult.error ? "var(--danger-bg)" : "rgba(15,110,86,0.04)" }}>
                      {applyResult.sig ? (
                        <div style={{ ...m, fontSize: "10px", color: "var(--success)" }}>
                          ✓ Applied — <a href={`https://explorer.solana.com/tx/${applyResult.sig}?cluster=devnet`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{shortAddr(applyResult.sig, 10)} →</a>
                        </div>
                      ) : (
                        <div style={{ ...m, fontSize: "10px", color: "var(--danger)" }}>✕ {applyResult.error}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Actioned proposals */}
          {actioned.length > 0 && (
            <div style={{ border: "1px solid var(--border)", background: "var(--bg-1)" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
                <SectionLabel>Actioned proposals</SectionLabel>
                <div style={{ ...f, fontSize: "13px", fontWeight: 600, color: "var(--text-2)" }}>{actioned.length} resolved</div>
              </div>
              {actioned.map((p, i) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "12px 20px", borderBottom: i < actioned.length - 1 ? "1px solid var(--border)" : "none", opacity: 0.7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                    <span style={{ ...m, fontSize: "8px", fontWeight: 700, color: p.status === "applied" ? "var(--success)" : "var(--text-4)", border: "1px solid var(--border)", padding: "2px 7px", letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>
                      {p.status === "applied" ? "APPLIED" : "DISMISSED"}
                    </span>
                    <span style={{ ...m, fontSize: "10px", color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                    <span style={{ ...m, fontSize: "9px", color: "var(--text-4)" }}>{p.source} · {p.jurisdiction}</span>
                    <button
                      onClick={() => updateProposal(p.id, { status: "pending", dismissNote: undefined })}
                      style={{ ...m, fontSize: "9px", color: "var(--text-4)", background: "none", border: "none", cursor: "pointer", padding: 0, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right — Vault context + instructions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", position: "sticky", top: "80px" }}>

          {/* Current vault config */}
          <div style={{ border: "1px solid var(--border)", padding: "20px", background: "var(--bg-1)" }}>
            <SectionLabel>Active vault config</SectionLabel>
            <div style={{ ...f, fontSize: "13px", fontWeight: 600, color: "var(--text-1)", marginBottom: "14px" }}>Current state</div>
            {loadingVc ? (
              <div style={{ ...m, fontSize: "10px", color: "var(--text-4)" }}>Loading...</div>
            ) : vaultConfig ? (
              <>
                {[
                  ["Min tier",      `Tier ${vaultConfig.minTier} — ${vaultConfig.minTier === 3 ? "Institutional" : vaultConfig.minTier === 2 ? "Enhanced" : "Basic"}`],
                  ["Gate status",   vaultConfig.paused ? "PAUSED" : "ACTIVE"],
                  ["Jurisdictions", vaultConfig.allowedJurisdictions.length > 0 ? vaultConfig.allowedJurisdictions.join(", ") : "All permitted"],
                  ["Issuers",       `${vaultConfig.trustedIssuers.length} trusted`],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{l}</span>
                    <span style={{ ...m, fontSize: "10px", color: l === "Gate status" && vaultConfig.paused ? "var(--danger)" : "var(--text-1)", fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ ...m, fontSize: "10px", color: "var(--danger)" }}>VaultConfig not found</div>
            )}
          </div>

          {/* How it works */}
          <div style={{ border: "1px solid var(--border)", padding: "20px", background: "var(--bg-1)" }}>
            <SectionLabel>How it works</SectionLabel>
            {[
              ["1. AI scans", "Claude monitors FATF, FINMA, FCA, MAS guidance for your vault's jurisdictions and generates proposals."],
              ["2. You review", "Read the full text, see the proposed config delta, decide to apply or dismiss."],
              ["3. You sign", "Clicking Apply constructs an update_vault_config transaction — you sign it in your wallet."],
              ["4. Chain enforces", "The new config takes effect immediately on-chain. Audit log records the change."],
            ].map(([step, desc]) => (
              <div key={step} style={{ marginBottom: "14px" }}>
                <div style={{ ...m, fontSize: "9px", color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>{step}</div>
                <div style={{ ...m, fontSize: "10px", color: "var(--text-3)", lineHeight: 1.7 }}>{desc}</div>
              </div>
            ))}
            <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", lineHeight: 1.7, borderTop: "1px solid var(--border)", paddingTop: "12px", marginTop: "4px" }}>
              AI never signs transactions. Every on-chain change requires your explicit signature. Proposals dismissed with a note are stored locally.
            </div>
          </div>
        </div>
      </div>

      {/* Dismiss modal */}
      {dismissTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDismissTarget(null)}>
          <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", padding: "28px", width: "420px", maxWidth: "90vw" }} onClick={e => e.stopPropagation()}>
            <div style={{ ...f, fontSize: "16px", fontWeight: 700, color: "var(--text-1)", marginBottom: "6px" }}>Dismiss proposal</div>
            <div style={{ ...m, fontSize: "10px", color: "var(--text-4)", marginBottom: "18px" }}>Add an optional note explaining why this was dismissed.</div>
            <textarea
              value={dismissNote}
              onChange={e => setDismissNote(e.target.value)}
              placeholder="e.g. Not applicable — vault operates under FCA jurisdiction only"
              rows={3}
              style={{ ...m, fontSize: "11px", background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-1)", padding: "10px 12px", width: "100%", resize: "vertical", outline: "none" }}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <button onClick={() => handleDismiss(dismissTarget)} style={{ ...m, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", background: "var(--bg-2)", color: "var(--text-2)", border: "1px solid var(--border)", padding: "10px 20px", cursor: "pointer", flex: 1 }}>
                Dismiss
              </button>
              <button onClick={() => setDismissTarget(null)} style={{ ...m, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", background: "var(--accent)", color: "white", border: "1px solid var(--accent)", padding: "10px 20px", cursor: "pointer", flex: 1 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
