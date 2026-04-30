"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { AdminShell } from "@/components/AdminShell";
import { GATE_PROGRAM_ID, VAULT_PROGRAM_ID, RPC_ENDPOINT, SEEDS, shortAddr, REASON_CODES, track } from "@leyfis/shared";

const m = { fontFamily: "'DM Mono', monospace" };
const f = { fontFamily: "'Inter', sans-serif" };
const inp: any = { ...m, fontSize: "12px", background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-1)", padding: "10px 14px", width: "100%", outline: "none" };

type AuditEntry = {
  wallet: string; vault: string; timestamp: number; slot: number;
  outcome: "approved" | "denied"; reasonCode: number; attestationId: string; tier: number; nonce: number;
};

const GATE = new PublicKey(GATE_PROGRAM_ID);
const VAULT = new PublicKey(VAULT_PROGRAM_ID);

const FATF_FIELDS = [
  { field: "timestamp_utc",       desc: "ISO 8601 transaction timestamp" },
  { field: "wallet_address",      desc: "Solana wallet public key" },
  { field: "vault_address",       desc: "Vault program address" },
  { field: "gate_program",        desc: "Leyfis gate program address" },
  { field: "outcome",             desc: "approved / denied" },
  { field: "reason_code",         desc: "Numeric reason code (0 = approved)" },
  { field: "reason",              desc: "Human-readable reason string" },
  { field: "tier",                desc: "Credential tier at time of gate call" },
  { field: "attestation_id",      desc: "On-chain attestation PDA address" },
  { field: "slot",                desc: "Solana slot number" },
  { field: "audit_nonce",         desc: "Sequential audit entry index" },
];

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
    return entries.sort((a, b) => b.timestamp - a.timestamp);
  } catch { return []; }
}

function toCSV(entries: AuditEntry[]): string {
  const header = FATF_FIELDS.map(f => f.field).join(",");
  const rows = entries.map(e => [
    new Date(e.timestamp * 1000).toISOString(),
    e.wallet,
    e.vault,
    GATE_PROGRAM_ID,
    e.outcome,
    e.reasonCode,
    REASON_CODES[e.reasonCode] || "Unknown",
    e.tier,
    e.attestationId,
    e.slot,
    e.nonce,
  ].map(v => `"${v}"`).join(","));
  return [header, ...rows].join("\n");
}

function SectionLabel({ children }: { children: string }) {
  return <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>{children}</div>;
}

type ReportStatus = "idle" | "generating" | "done" | "error";

export default function ExportPage() {
  const [mounted, setMounted]   = useState(false);
  useEffect(() => setMounted(true), []);
  const [entries, setEntries]   = useState<AuditEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState(false);
  const [from, setFrom]         = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo]             = useState(new Date().toISOString().slice(0, 10));
  const [outcomeF, setOutcomeF] = useState<"all" | "approved" | "denied">("all");
  const [reportText, setReportText] = useState("");
  const [reportStatus, setReportStatus] = useState<ReportStatus>("idle");
  const [copied, setCopied]     = useState(false);
  const reportRef               = useRef<HTMLDivElement>(null);
  const reportStartRef          = useRef<number>(0);
  const [reportMetrics, setReportMetrics] = useState<{ seconds: number; analystHours: number; costSaved: number } | null>(null);

  const generateReport = useCallback(async (data: AuditEntry[]) => {
    if (data.length === 0) return;
    setReportText("");
    setReportMetrics(null);
    setReportStatus("generating");
    reportStartRef.current = Date.now();
    try {
      const res = await fetch("/api/compliance-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: data, from, to }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) setReportText(prev => prev + dec.decode(value, { stream: !d }));
      }
      setReportStatus("done");
      const seconds = Math.round((Date.now() - reportStartRef.current) / 100) / 10;
      const analystHours = Math.max(2, Math.round(data.length / 50) * 2);
      const costSaved = analystHours * 300;
      setReportMetrics({ seconds, analystHours, costSaved });
      track({ event: "compliance_report_generated", entry_count: data.length, generation_seconds: seconds });
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e: any) {
      setReportText(e?.message || "Report generation failed");
      setReportStatus("error");
    }
  }, [from, to]);

  const copyReport = () => {
    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setEntries(await fetchAll()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (mounted) refresh(); }, [mounted, refresh]);

  if (!mounted) return null;

  const filtered = entries.filter(e => {
    const d = new Date(e.timestamp * 1000).toISOString().slice(0, 10);
    if (d < from || d > to) return false;
    if (outcomeF !== "all" && e.outcome !== outcomeF) return false;
    return true;
  });

  const doExport = async () => {
    setExporting(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      const csv = toCSV(filtered);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `leyfis-fatf-audit-${from}-to-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };

  const approved = filtered.filter(e => e.outcome === "approved").length;
  const denied   = filtered.filter(e => e.outcome === "denied").length;

  return (
    <AdminShell current="/export">
      {/* Header */}
      <div style={{ marginBottom: "32px", paddingBottom: "24px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "8px" }}>/07 — Compliance Export</div>
        <h1 style={{ ...f, fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)", marginBottom: "8px" }}>Compliance Export</h1>
        <p style={{ ...m, fontSize: "11px", color: "var(--text-3)", lineHeight: 1.7 }}>
          Export FATF R.16 aligned audit records for regulatory reporting. All data sourced directly from Solana — tamper-proof.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "2px", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>

          {/* Filters */}
          <div style={{ border: "1px solid var(--border)", padding: "24px", background: "var(--bg-1)" }}>
            <SectionLabel>Date range & filters</SectionLabel>
            <div style={{ ...f, fontSize: "15px", fontWeight: 600, color: "var(--text-1)", marginBottom: "20px" }}>
              Define export scope
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ ...m, fontSize: "9px", color: "var(--text-3)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>From</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...inp, colorScheme: "dark" }} />
              </div>
              <div>
                <label style={{ ...m, fontSize: "9px", color: "var(--text-3)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>To</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...inp, colorScheme: "dark" }} />
              </div>
              <div>
                <label style={{ ...m, fontSize: "9px", color: "var(--text-3)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Outcome</label>
                <select value={outcomeF} onChange={e => setOutcomeF(e.target.value as any)} style={inp}>
                  <option value="all">All outcomes</option>
                  <option value="approved">Approved only</option>
                  <option value="denied">Denied only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2px" }}>
            {[
              { label: "Records in range", value: filtered.length.toString(), color: "var(--text-1)" },
              { label: "Approved", value: approved.toString(), color: "var(--success)" },
              { label: "Denied", value: denied.toString(), color: "var(--danger)" },
            ].map((s, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", padding: "16px 20px", background: "var(--bg-1)" }}>
                <SectionLabel>{s.label}</SectionLabel>
                <div style={{ ...f, fontSize: "24px", fontWeight: 800, color: s.color, lineHeight: 1 }}>{loading ? "—" : s.value}</div>
              </div>
            ))}
          </div>

          {/* Preview table */}
          <div style={{ border: "1px solid var(--border)", background: "var(--bg-1)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <div>
                <SectionLabel>Export preview</SectionLabel>
                <div style={{ ...f, fontSize: "14px", fontWeight: 600, color: "var(--text-1)" }}>
                  {loading ? "Loading..." : `${filtered.length} records · showing first 6`}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 80px 80px 160px", gap: "10px", padding: "10px 20px", ...m, fontSize: "8px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>
              <span>Timestamp</span><span>Wallet</span><span>Outcome</span><span>Tier</span><span>Reason</span>
            </div>

            {loading ? (
              <div style={{ padding: "24px 20px", ...m, fontSize: "11px", color: "var(--text-4)" }}>Loading on-chain records...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "24px 20px", ...m, fontSize: "11px", color: "var(--text-4)" }}>
                No records match the selected date range and filters.
              </div>
            ) : (
              <>
                {filtered.slice(0, 6).map((e, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "160px 1fr 80px 80px 160px", gap: "10px", padding: "11px 20px", borderBottom: i < 5 && i < filtered.length - 1 ? "1px solid var(--border)" : "none", ...m, fontSize: "10px", color: "var(--text-2)", alignItems: "center", borderLeft: `3px solid ${e.outcome === "approved" ? "var(--success)" : "var(--danger)"}` }}>
                    <span style={{ color: "var(--text-4)" }}>{new Date(e.timestamp * 1000).toISOString().slice(0, 16).replace("T", " ")}</span>
                    <span>{shortAddr(e.wallet, 10)}</span>
                    <span style={{ color: e.outcome === "approved" ? "var(--success)" : "var(--danger)", fontWeight: 700, textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.06em" }}>{e.outcome === "approved" ? "PASS" : "DENY"}</span>
                    <span>{e.tier > 0 ? `Tier ${e.tier}` : "—"}</span>
                    <span style={{ color: "var(--text-3)" }}>{REASON_CODES[e.reasonCode] || `Code ${e.reasonCode}`}</span>
                  </div>
                ))}
                {filtered.length > 6 && (
                  <div style={{ padding: "12px 20px", ...m, fontSize: "10px", color: "var(--text-4)", borderTop: "1px solid var(--border)" }}>
                    + {filtered.length - 6} more records included in export
                  </div>
                )}
              </>
            )}
          </div>

          {/* Export button */}
          <div style={{ display: "flex", gap: "2px" }}>
            <button
              onClick={doExport}
              disabled={exporting || filtered.length === 0 || loading}
              style={{ ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: filtered.length === 0 || loading ? "var(--accent-bg)" : "var(--accent)", color: filtered.length === 0 || loading ? "var(--accent)" : "white", border: "1px solid var(--accent)", padding: "16px 28px", cursor: filtered.length === 0 || loading ? "not-allowed" : "pointer", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flex: 1 }}>
              ↓ {exporting ? "Generating CSV..." : `Export ${filtered.length} Records — FATF R.16`}
            </button>
            <button
              onClick={() => generateReport(filtered)}
              disabled={reportStatus === "generating" || filtered.length === 0 || loading}
              style={{ ...m, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--bg-1)", color: "var(--accent)", border: "1px solid var(--accent)", padding: "16px 24px", cursor: filtered.length === 0 || loading || reportStatus === "generating" ? "not-allowed" : "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", opacity: filtered.length === 0 || loading ? 0.4 : 1, whiteSpace: "nowrap" }}>
              {reportStatus === "generating" ? "⟳ Generating..." : "AI Report →"}
            </button>
          </div>

          {/* AI Report Output */}
          {(reportStatus !== "idle") && (
            <div ref={reportRef} style={{ border: "1px solid var(--border)", background: "var(--bg-1)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <SectionLabel>AI Compliance Report</SectionLabel>
                  <div style={{ ...f, fontSize: "14px", fontWeight: 600, color: "var(--text-1)" }}>
                    {reportStatus === "generating" ? "Claude is drafting your FATF R.16 report..." : reportStatus === "error" ? "Report generation failed" : "Report ready — copy or print for submission"}
                  </div>
                </div>
                {reportStatus === "done" && (
                  <button onClick={copyReport} style={{ ...m, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: copied ? "var(--success)" : "var(--bg-2)", color: copied ? "white" : "var(--accent)", border: `1px solid ${copied ? "var(--success)" : "var(--accent)"}`, padding: "8px 16px", cursor: "pointer" }}>
                    {copied ? "✓ Copied" : "Copy Text"}
                  </button>
                )}
              </div>
              <div style={{ padding: "24px 28px", ...m, fontSize: "11px", color: reportStatus === "error" ? "var(--danger)" : "var(--text-2)", lineHeight: 1.9, whiteSpace: "pre-wrap", minHeight: reportStatus === "generating" ? "120px" : "auto", position: "relative" }}>
                {reportStatus === "generating" && reportText === "" && (
                  <span style={{ color: "var(--text-4)", animation: "pulse 1.5s ease-in-out infinite" }}>Analyzing {filtered.length} records...</span>
                )}
                {reportText}
                {reportStatus === "generating" && reportText !== "" && (
                  <span style={{ opacity: 0.5 }}>▌</span>
                )}
              </div>
              {reportStatus === "done" && (
                <>
                  {reportMetrics && (
                    <div style={{ margin: "0 20px 0", padding: "16px 20px", background: "rgba(22,163,74,0.05)", border: "1px solid rgba(22,163,74,0.2)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>
                      <div>
                        <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Generated in</div>
                        <div style={{ ...f, fontSize: "20px", fontWeight: 800, color: "var(--success)", lineHeight: 1 }}>{reportMetrics.seconds}s</div>
                      </div>
                      <div>
                        <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Manual equivalent</div>
                        <div style={{ ...f, fontSize: "20px", fontWeight: 800, color: "var(--text-1)", lineHeight: 1 }}>{reportMetrics.analystHours} analyst hrs</div>
                      </div>
                      <div>
                        <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Estimated value</div>
                        <div style={{ ...f, fontSize: "20px", fontWeight: 800, color: "var(--text-1)", lineHeight: 1 }}>${reportMetrics.costSaved.toLocaleString()}</div>
                        <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", marginTop: "3px" }}>at $300/hr blended analyst rate</div>
                      </div>
                    </div>
                  )}
                  <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: "16px", alignItems: "center" }}>
                    <span style={{ ...m, fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Generated by Claude Haiku · FATF R.16 aligned · {new Date().toISOString().slice(0, 10)}</span>
                    <button onClick={() => { setReportText(""); setReportStatus("idle"); setReportMetrics(null); }} style={{ ...m, fontSize: "9px", color: "var(--text-4)", background: "none", border: "none", cursor: "pointer", padding: 0, letterSpacing: "0.08em", textTransform: "uppercase", marginLeft: "auto" }}>Clear</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right — FATF fields */}
        <div style={{ border: "1px solid var(--border)", background: "var(--bg-1)", padding: "24px", position: "sticky", top: "80px" }}>
          <SectionLabel>FATF R.16 fields</SectionLabel>
          <div style={{ ...f, fontSize: "15px", fontWeight: 600, color: "var(--text-1)", marginBottom: "20px" }}>
            {FATF_FIELDS.length} fields exported
          </div>
          {FATF_FIELDS.map((field, i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: i < FATF_FIELDS.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                <span style={{ ...m, fontSize: "10px", color: "var(--text-1)", fontWeight: 500 }}>{field.field}</span>
              </div>
              <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", paddingLeft: "13px", lineHeight: 1.5 }}>{field.desc}</div>
            </div>
          ))}
          <div style={{ marginTop: "20px", padding: "14px", background: "var(--bg-2)", border: "1px solid var(--border)" }}>
            <div style={{ ...m, fontSize: "9px", color: "var(--text-4)", marginBottom: "6px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Format</div>
            <div style={{ ...m, fontSize: "10px", color: "var(--text-2)", lineHeight: 1.7 }}>
              UTF-8 CSV · ISO 8601 timestamps<br />
              On-chain source — tamper-proof<br />
              Suitable for FINMA, FCA, MAS submission
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
