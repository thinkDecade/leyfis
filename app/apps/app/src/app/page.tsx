"use client";
import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Connection, PublicKey } from "@solana/web3.js";
import { shortAddr, GATE_PROGRAM_ID, VAULT_PROGRAM_ID, RPC_ENDPOINT, SEEDS } from "@leyfis/shared";

// ─── Types ────────────────────────────────────────────────────────────────────
type ClearanceStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "cleared"; tier: number; issuer: string; jurisdiction: string; expires: string; attestationId: string }
  | { state: "blocked"; reasonCode: number; reason: string; tier: number; issuer?: string };

type Vault = {
  id: string;
  name: string;
  institution: string;
  description: string;
  strategy: string;
  tvl: string;
  apy: string;
  minTier: number;
  jurisdictions: string[];
  status: "active" | "paused";
  programId: string;
};

// ─── Mock Vault Registry ──────────────────────────────────────────────────────
const VAULTS: Vault[] = [
  {
    id: "amina-yield",
    name: "Institutional Yield Vault",
    institution: "AMINA Bank",
    description: "Conservative fixed-income strategy with full regulatory compliance. Optimised for institutional capital preservation with yield.",
    strategy: "Fixed Income",
    tvl: "$12.4M",
    apy: "4.2%",
    minTier: 3,
    jurisdictions: ["CHE", "GBR", "SGP"],
    status: "active",
    programId: VAULT_PROGRAM_ID,
  },
  {
    id: "amina-digital",
    name: "Digital Assets Access Vault",
    institution: "AMINA Bank",
    description: "Diversified exposure to blue-chip digital assets under Swiss regulatory framework. Quarterly rebalancing with full audit trail.",
    strategy: "Digital Assets",
    tvl: "$8.1M",
    apy: "7.8%",
    minTier: 2,
    jurisdictions: ["CHE", "GBR", "SGP", "DEU"],
    status: "active",
    programId: VAULT_PROGRAM_ID,
  },
];

// ─── Reason messages ──────────────────────────────────────────────────────────
const REASON_MESSAGES: Record<number, { title: string; detail: string; action: string }> = {
  1: { title: "No attestation found", detail: "Your wallet does not have an active KYC attestation on-chain.", action: "Contact your institution's KYC team to complete onboarding." },
  2: { title: "Attestation expired", detail: "Your KYC attestation has passed its expiry date.", action: "Contact your KYC provider to renew your credentials." },
  3: { title: "Attestation revoked", detail: "Your KYC attestation has been revoked by your issuer.", action: "Contact your institution's compliance team directly." },
  4: { title: "Untrusted issuer", detail: "Your attestation was issued by a party not registered with this vault.", action: "Ensure your KYC was completed through an authorised issuer." },
  5: { title: "Clearance tier insufficient", detail: "Your current clearance level does not meet the minimum required for these vaults.", action: "Request an enhanced KYC review from your institution." },
  6: { title: "Jurisdiction not permitted", detail: "Your registered jurisdiction is not authorised for these vaults.", action: "Contact your institution about jurisdiction eligibility." },
  7: { title: "Gate temporarily paused", detail: "Access is temporarily suspended by the vault operator.", action: "Please try again shortly or contact your vault operator." },
};

// ─── On-chain gate check ──────────────────────────────────────────────────────
const GATE = new PublicKey(GATE_PROGRAM_ID);
const VAULT = new PublicKey(VAULT_PROGRAM_ID);

async function checkGate(walletAddr: string): Promise<ClearanceStatus> {
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  const walletPubkey = new PublicKey(walletAddr);

  const [vcPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.VAULT_CONFIG), VAULT.toBuffer()], GATE
  );
  const vcInfo = await connection.getAccountInfo(vcPDA);
  if (!vcInfo) return { state: "blocked", reasonCode: 1, reason: "NoAttestation", tier: 0 };

  const data = vcInfo.data;
  if (data.length > 113 && data[113] !== 0) {
    return { state: "blocked", reasonCode: 7, reason: "GatePaused", tier: 0 };
  }

  const minTier = data[72];
  const issuerCount = data.readUInt32LE(73);
  const issuers: PublicKey[] = [];
  for (let i = 0; i < issuerCount; i++) {
    const offset = 77 + i * 32;
    if (offset + 32 <= data.length) issuers.push(new PublicKey(data.slice(offset, offset + 32)));
  }

  if (issuers.length === 0) return { state: "blocked", reasonCode: 1, reason: "NoAttestation", tier: 0 };

  for (const issuer of issuers) {
    const [attPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.ATTESTATION), walletPubkey.toBuffer(), issuer.toBuffer()], GATE
    );
    const attInfo = await connection.getAccountInfo(attPDA);
    if (!attInfo || attInfo.data.length < 125) continue;

    const att = Buffer.from(attInfo.data);
    const revoked = att[124] !== 0;
    if (revoked) return { state: "blocked", reasonCode: 3, reason: "AttestationRevoked", tier: 0, issuer: shortAddr(issuer.toBase58(), 6) };

    const expiresAt = att.readBigInt64LE(81);
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (expiresAt !== 0n && now > expiresAt) {
      return { state: "blocked", reasonCode: 2, reason: "AttestationExpired", tier: 0, issuer: shortAddr(issuer.toBase58(), 6) };
    }

    if (!issuers.map(i => i.toBase58()).includes(issuer.toBase58())) {
      return { state: "blocked", reasonCode: 4, reason: "UntrustedIssuer", tier: 0 };
    }

    const tier = att[72];
    if (tier < minTier) {
      return { state: "blocked", reasonCode: 5, reason: "TierInsufficient", tier, issuer: shortAddr(issuer.toBase58(), 6) };
    }

    // Parse jurisdiction [u8;3] at offset 8+32+32+1+8+8+32 = 121
    const jur = `${String.fromCharCode(att[121])}${String.fromCharCode(att[122])}${String.fromCharCode(att[123])}`;
    const expires = new Date(Number(expiresAt) * 1000).toISOString().slice(0, 10);

    return {
      state: "cleared",
      tier,
      issuer: shortAddr(issuer.toBase58(), 6),
      jurisdiction: jur,
      expires,
      attestationId: shortAddr(attPDA.toBase58(), 8),
    };
  }

  return { state: "blocked", reasonCode: 1, reason: "NoAttestation", tier: 0 };
}

// ─── Tier label ───────────────────────────────────────────────────────────────
function tierLabel(t: number) {
  return t === 3 ? "Tier 3 — Institutional" : t === 2 ? "Tier 2 — Enhanced" : t === 1 ? "Tier 1 — Basic" : "No Tier";
}

// ─── Vault Card ───────────────────────────────────────────────────────────────
function VaultCard({ vault, userTier, userJurisdiction }: { vault: Vault; userTier: number; userJurisdiction: string }) {
  const tierOk = userTier >= vault.minTier;
  const jurOk = vault.jurisdictions.includes(userJurisdiction);
  const accessible = tierOk && jurOk && vault.status === "active";

  return (
    <div style={{
      border: `1px solid ${accessible ? "rgba(15,110,86,0.3)" : "rgba(232,238,246,0.08)"}`,
      background: accessible ? "rgba(15,110,86,0.04)" : "rgba(232,238,246,0.02)",
      padding: "32px",
      position: "relative",
      transition: "border-color 0.2s, background 0.2s",
    }}>
      {/* Status indicator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: accessible ? "#0F6E56" : "rgba(232,238,246,0.2)",
          }} />
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: accessible ? "#0F6E56" : "rgba(232,238,246,0.3)" }}>
            {accessible ? "Active" : vault.status === "paused" ? "Paused" : "Access Restricted"}
          </span>
        </div>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "rgba(232,238,246,0.3)", letterSpacing: "0.08em" }}>
          {vault.institution}
        </span>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ fontFamily: "'DM Mono',monospace", fontSize: "15px", fontWeight: 500, color: "#E8EEF6", marginBottom: "8px", letterSpacing: "-0.01em" }}>
          {vault.name}
        </h3>
        <p style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "rgba(232,238,246,0.45)", lineHeight: 1.8 }}>
          {vault.description}
        </p>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "24px", paddingTop: "20px", borderTop: "1px solid rgba(232,238,246,0.06)" }}>
        {[["TVL", vault.tvl], ["APY", vault.apy], ["Strategy", vault.strategy]].map(([l, v]) => (
          <div key={l}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "rgba(232,238,246,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>{l}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "12px", color: "#E8EEF6", fontWeight: 500 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Requirements */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
        <span style={{
          fontFamily: "'DM Mono',monospace", fontSize: "9px", padding: "3px 10px",
          background: tierOk ? "rgba(15,110,86,0.12)" : "rgba(232,238,246,0.04)",
          color: tierOk ? "#0F6E56" : "rgba(232,238,246,0.3)",
          border: `1px solid ${tierOk ? "rgba(15,110,86,0.24)" : "rgba(232,238,246,0.08)"}`,
          letterSpacing: "0.06em",
        }}>
          {tierOk ? "✓" : "✗"} Tier {vault.minTier}+
        </span>
        {vault.jurisdictions.map(j => (
          <span key={j} style={{
            fontFamily: "'DM Mono',monospace", fontSize: "9px", padding: "3px 10px",
            background: j === userJurisdiction ? "rgba(15,110,86,0.12)" : "rgba(232,238,246,0.04)",
            color: j === userJurisdiction ? "#0F6E56" : "rgba(232,238,246,0.3)",
            border: `1px solid ${j === userJurisdiction ? "rgba(15,110,86,0.24)" : "rgba(232,238,246,0.08)"}`,
            letterSpacing: "0.06em",
          }}>
            {j}
          </span>
        ))}
      </div>

      {/* CTA */}
      {accessible ? (
        <a
          href={`https://explorer.solana.com/address/${vault.programId}?cluster=devnet`}
          target="_blank" rel="noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontFamily: "'DM Mono',monospace", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase",
            background: "#0F6E56", color: "white", border: "none",
            padding: "13px 20px", cursor: "pointer", textDecoration: "none", width: "100%", boxSizing: "border-box",
          }}>
          <span>Access Vault</span>
          <span style={{ fontSize: "14px" }}>→</span>
        </a>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: "'DM Mono',monospace", fontSize: "10px", letterSpacing: "0.08em",
          color: "rgba(232,238,246,0.2)", padding: "13px 20px",
          border: "1px solid rgba(232,238,246,0.06)", background: "rgba(232,238,246,0.02)",
        }}>
          <span>{!tierOk ? `Requires Tier ${vault.minTier}` : !jurOk ? "Jurisdiction not permitted" : "Vault paused"}</span>
          <span>—</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const { publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<ClearanceStatus>({ state: "idle" });

  useEffect(() => setMounted(true), []);

  const runCheck = useCallback(async (addr: string) => {
    setStatus({ state: "checking" });
    try {
      const result = await checkGate(addr);
      setStatus(result);
    } catch {
      setStatus({ state: "blocked", reasonCode: 1, reason: "NoAttestation", tier: 0 });
    }
  }, []);

  useEffect(() => {
    if (!publicKey || !mounted) { setStatus({ state: "idle" }); return; }
    runCheck(publicKey.toBase58());
  }, [publicKey, mounted, runCheck]);

  if (!mounted) return null;

  const cleared = status.state === "cleared";
  const blocked = status.state === "blocked";
  const checking = status.state === "checking";

  const accessibleVaults = cleared
    ? VAULTS.filter(v => status.state === "cleared" && (status as any).tier >= v.minTier && v.jurisdictions.includes((status as any).jurisdiction))
    : [];

  return (
    <main style={{ minHeight: "100vh", background: "#080C14", color: "#E8EEF6" }}>

      {/* Subtle grid texture */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(232,238,246,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(232,238,246,0.025) 1px,transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none", zIndex: 0 }} />

      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "0 48px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(8,12,20,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(232,238,246,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "28px", height: "28px", background: "#1B4FD8", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 56 56" fill="none">
              <rect x="8" y="16" width="7" height="32" fill="white" />
              <rect x="41" y="16" width="7" height="32" fill="white" />
              <rect x="8" y="13" width="40" height="6" fill="white" />
              <rect x="18" y="19" width="20" height="29" fill="#1B4FD8" />
            </svg>
          </div>
          <span style={{ fontFamily: "Arial, sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.22em", color: "#E8EEF6" }}>LEYFIS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          {cleared && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0F6E56" }} />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#0F6E56", letterSpacing: "0.08em" }}>
                {tierLabel((status as any).tier)}
              </span>
            </div>
          )}
          <a href="http://localhost:3001" style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(232,238,246,0.3)", textDecoration: "none" }}>
            Admin Console
          </a>
          <WalletMultiButton />
        </div>
      </nav>

      {/* ── STATE: NOT CONNECTED ─────────────────────────────────────────────── */}
      {!publicKey && (
        <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 48px", textAlign: "center" }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "#1B4FD8", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "32px", display: "flex", alignItems: "center", gap: "12px", justifyContent: "center" }}>
            <span style={{ display: "block", width: "24px", height: "1px", background: "#1B4FD8" }} />
            Institutional DeFi Access
            <span style={{ display: "block", width: "24px", height: "1px", background: "#1B4FD8" }} />
          </div>

          <h1 style={{ fontSize: "clamp(48px,7vw,96px)", fontWeight: 300, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: "24px", maxWidth: "720px", fontFamily: "Arial, sans-serif" }}>
            Your compliance,<br />
            <span style={{ color: "#1B4FD8", fontWeight: 700 }}>on-chain.</span>
          </h1>

          <p style={{ fontFamily: "'DM Mono',monospace", fontSize: "12px", color: "rgba(232,238,246,0.4)", maxWidth: "440px", lineHeight: 1.9, marginBottom: "48px", letterSpacing: "0.02em" }}>
            Connect your wallet. If your institution has verified you through Leyfis, you'll see the vaults you're cleared to access — instantly.
          </p>

          <div style={{ marginBottom: "64px" }}>
            <WalletMultiButton />
          </div>

          {/* How it works */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "2px", maxWidth: "720px", width: "100%", textAlign: "left" }}>
            {[
              ["01", "Connect", "Your wallet is your identity. No passwords, no accounts."],
              ["02", "Verify", "The gate reads your on-chain KYC attestation in seconds."],
              ["03", "Access", "See and enter the institutional vaults you're cleared for."],
            ].map(([n, t, d]) => (
              <div key={n} style={{ padding: "24px", border: "1px solid rgba(232,238,246,0.06)", background: "rgba(232,238,246,0.02)" }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "rgba(27,79,216,0.6)", letterSpacing: "0.12em", marginBottom: "12px" }}>{n}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "12px", color: "#E8EEF6", marginBottom: "8px", fontWeight: 500 }}>{t}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "rgba(232,238,246,0.35)", lineHeight: 1.8 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STATE: CHECKING ──────────────────────────────────────────────────── */}
      {publicKey && checking && (
        <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
          <div style={{ width: "1px", height: "48px", background: "linear-gradient(to bottom, transparent, rgba(27,79,216,0.6))", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "rgba(232,238,246,0.4)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
            Verifying clearance
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "rgba(232,238,246,0.2)", letterSpacing: "0.08em" }}>
            {shortAddr(publicKey.toBase58(), 8)} · Solana devnet
          </div>
          <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
        </div>
      )}

      {/* ── STATE: CLEARED ───────────────────────────────────────────────────── */}
      {publicKey && cleared && status.state === "cleared" && (
        <div style={{ position: "relative", zIndex: 1, padding: "96px 48px 64px" }}>

          {/* Subtle clearance strip */}
          <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "48px", paddingBottom: "24px", borderBottom: "1px solid rgba(232,238,246,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#0F6E56" }} />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#0F6E56", letterSpacing: "0.08em" }}>Verified</span>
            </div>
            <div style={{ width: "1px", height: "14px", background: "rgba(232,238,246,0.1)" }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "rgba(232,238,246,0.4)", letterSpacing: "0.06em" }}>{tierLabel(status.tier)}</span>
            <div style={{ width: "1px", height: "14px", background: "rgba(232,238,246,0.1)" }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "rgba(232,238,246,0.4)", letterSpacing: "0.06em" }}>{status.issuer}</span>
            <div style={{ width: "1px", height: "14px", background: "rgba(232,238,246,0.1)" }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "rgba(232,238,246,0.4)", letterSpacing: "0.06em" }}>{status.jurisdiction}</span>
            <div style={{ width: "1px", height: "14px", background: "rgba(232,238,246,0.1)" }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "rgba(232,238,246,0.3)", letterSpacing: "0.06em" }}>Expires {status.expires}</span>
          </div>

          {/* Section header */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "rgba(232,238,246,0.3)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "8px" }}>
              Available vaults
            </div>
            <h2 style={{ fontFamily: "Arial, sans-serif", fontSize: "28px", fontWeight: 700, letterSpacing: "-0.02em", color: "#E8EEF6" }}>
              {accessibleVaults.length > 0
                ? `${accessibleVaults.length} vault${accessibleVaults.length > 1 ? "s" : ""} available to you`
                : "No vaults match your current clearance"}
            </h2>
          </div>

          {/* Vault grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "2px", marginBottom: "48px" }}>
            {VAULTS.map(vault => (
              <VaultCard
                key={vault.id}
                vault={vault}
                userTier={status.tier}
                userJurisdiction={status.jurisdiction}
              />
            ))}
          </div>

          {/* Protocol strip */}
          <div style={{ display: "flex", gap: "32px", paddingTop: "24px", borderTop: "1px solid rgba(232,238,246,0.06)" }}>
            {[
              ["Gate Program", shortAddr(GATE_PROGRAM_ID, 8)],
              ["Attestation", status.attestationId],
              ["Network", "Solana devnet"],
              ["Last checked", "just now"],
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "rgba(232,238,246,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>{l}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "rgba(232,238,246,0.4)" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STATE: BLOCKED ───────────────────────────────────────────────────── */}
      {publicKey && blocked && status.state === "blocked" && (() => {
        const msg = REASON_MESSAGES[status.reasonCode] || REASON_MESSAGES[1];
        return (
          <div style={{ position: "relative", zIndex: 1, padding: "96px 48px 64px" }}>

            {/* Status strip */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "48px", paddingBottom: "24px", borderBottom: "1px solid rgba(232,238,246,0.06)" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "rgba(196,68,68,0.7)" }} />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "rgba(196,68,68,0.8)", letterSpacing: "0.08em" }}>Access restricted</span>
              <div style={{ width: "1px", height: "14px", background: "rgba(232,238,246,0.1)" }} />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "rgba(232,238,246,0.3)", letterSpacing: "0.06em" }}>{shortAddr(publicKey.toBase58(), 8)}</span>
            </div>

            <div style={{ maxWidth: "560px", marginBottom: "56px" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "rgba(196,68,68,0.6)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "16px" }}>
                {msg.title}
              </div>
              <h2 style={{ fontFamily: "Arial, sans-serif", fontSize: "28px", fontWeight: 700, letterSpacing: "-0.02em", color: "#E8EEF6", marginBottom: "16px", lineHeight: 1.2 }}>
                You don't currently have access to these vaults.
              </h2>
              <p style={{ fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "rgba(232,238,246,0.4)", lineHeight: 1.9, marginBottom: "24px" }}>
                {msg.detail}
              </p>
              <div style={{ padding: "16px 20px", border: "1px solid rgba(232,238,246,0.08)", background: "rgba(232,238,246,0.02)" }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "rgba(232,238,246,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>Next step</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "rgba(232,238,246,0.6)", lineHeight: 1.7 }}>{msg.action}</div>
              </div>
            </div>

            {/* Locked vaults — show what exists, grayed */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "rgba(232,238,246,0.2)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "24px" }}>
                Vaults requiring clearance
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "2px" }}>
                {VAULTS.map(vault => (
                  <div key={vault.id} style={{ border: "1px solid rgba(232,238,246,0.05)", padding: "32px", background: "rgba(232,238,246,0.01)", opacity: 0.5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(232,238,246,0.15)" }} />
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "rgba(232,238,246,0.25)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{vault.institution}</span>
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "14px", color: "rgba(232,238,246,0.4)", marginBottom: "20px" }}>{vault.name}</div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", padding: "3px 10px", background: "rgba(232,238,246,0.04)", color: "rgba(232,238,246,0.2)", border: "1px solid rgba(232,238,246,0.06)" }}>
                        Tier {vault.minTier}+ required
                      </span>
                    </div>
                    <div style={{ marginTop: "20px", padding: "12px 16px", border: "1px solid rgba(232,238,246,0.05)", fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "rgba(232,238,246,0.2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Access locked
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Protocol strip */}
            <div style={{ display: "flex", gap: "32px", paddingTop: "24px", borderTop: "1px solid rgba(232,238,246,0.06)", marginTop: "32px" }}>
              {[["Gate Program", shortAddr(GATE_PROGRAM_ID, 8)], ["Network", "Solana devnet"], ["Reason", `Code ${status.reasonCode}`]].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "rgba(232,238,246,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>{l}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "rgba(232,238,246,0.35)" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Footer */}
      <footer style={{ position: "relative", zIndex: 1, padding: "20px 48px", borderTop: "1px solid rgba(232,238,246,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "Arial, sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", color: "rgba(232,238,246,0.2)" }}>LEYFIS</span>
        <div style={{ display: "flex", gap: "24px" }}>
          {[["Solana Explorer", `https://explorer.solana.com/address/${GATE_PROGRAM_ID}?cluster=devnet`], ["Admin Console", "http://localhost:3001"]].map(([l, h]) => (
            <a key={l} href={h} target="_blank" rel="noreferrer" style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "rgba(232,238,246,0.2)", letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>{l}</a>
          ))}
        </div>
      </footer>
    </main>
  );
}
