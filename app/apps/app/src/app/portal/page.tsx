"use client";
import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Connection, PublicKey } from "@solana/web3.js";
import { shortAddr, GATE_PROGRAM_ID, VAULT_PROGRAM_ID, RPC_ENDPOINT, SEEDS } from "@leyfis/shared";

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const T = {
  dark: {
    bg:             "#080C14",
    bg1:            "#0D1220",
    bg2:            "#131929",
    border:         "rgba(232,238,246,0.07)",
    border2:        "rgba(232,238,246,0.13)",
    text1:          "#E8EEF6",
    text2:          "rgba(232,238,246,0.72)",
    text3:          "rgba(232,238,246,0.45)",
    text4:          "rgba(232,238,246,0.25)",
    accent:         "#1B4FD8",
    accentBg:       "rgba(27,79,216,0.08)",
    accentBorder:   "rgba(27,79,216,0.24)",
    approved:       "#0F6E56",
    approvedBg:     "rgba(15,110,86,0.08)",
    approvedBorder: "rgba(15,110,86,0.22)",
    danger:         "#9A2C2C",
    dangerBg:       "rgba(154,44,44,0.08)",
    dangerBorder:   "rgba(154,44,44,0.2)",
  },
  light: {
    bg:             "#F4F3EF",
    bg1:            "#ECEAE4",
    bg2:            "#E2E0D8",
    border:         "rgba(20,20,18,0.1)",
    border2:        "rgba(20,20,18,0.18)",
    text1:          "#141412",
    text2:          "rgba(20,20,18,0.72)",
    text3:          "rgba(20,20,18,0.48)",
    text4:          "rgba(20,20,18,0.28)",
    accent:         "#1C3D8A",
    accentBg:       "rgba(28,61,138,0.07)",
    accentBorder:   "rgba(28,61,138,0.2)",
    approved:       "#155C42",
    approvedBg:     "rgba(21,92,66,0.07)",
    approvedBorder: "rgba(21,92,66,0.2)",
    danger:         "#7A1F1F",
    dangerBg:       "rgba(122,31,31,0.06)",
    dangerBorder:   "rgba(122,31,31,0.16)",
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Theme = typeof T.dark;
type ClearanceStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "cleared"; tier: number; issuer: string; jurisdiction: string; expires: string; attestationId: string }
  | { state: "blocked"; reasonCode: number; reason: string; tier: number; issuer?: string };

type Vault = {
  id: string; name: string; institution: string; mandate: string;
  tvl: string; apy: string; minTier: number; jurisdictions: string[];
  status: "active" | "paused"; programId: string; inception: string;
};

// ─── Vault Registry ───────────────────────────────────────────────────────────
const VAULTS: Vault[] = [
  {
    id: "amina-yield",
    name: "AMINA Institutional Yield",
    institution: "AMINA Bank AG",
    mandate: "Conservative fixed-income strategy. Capital preservation with yield optimisation. Full FINMA regulatory compliance.",
    tvl: "CHF 12.4M", apy: "4.2%", minTier: 3,
    jurisdictions: ["CHE", "GBR", "SGP"],
    status: "active", programId: VAULT_PROGRAM_ID, inception: "Jan 2026",
  },
  {
    id: "amina-digital",
    name: "AMINA Digital Assets",
    institution: "AMINA Bank AG",
    mandate: "Regulated exposure to blue-chip digital assets. Quarterly rebalancing under Swiss DLT Act framework.",
    tvl: "CHF 8.1M", apy: "7.8%", minTier: 2,
    jurisdictions: ["CHE", "GBR", "SGP", "DEU"],
    status: "active", programId: VAULT_PROGRAM_ID, inception: "Feb 2026",
  },
];

// ─── Block reasons ────────────────────────────────────────────────────────────
const BLOCKS: Record<number, { heading: string; body: string; action: string }> = {
  1: { heading: "No credential on file", body: "Your wallet has no KYC attestation recorded on-chain. Your institution must issue one before vault access is granted.", action: "Contact your relationship manager or KYC team to initiate onboarding." },
  2: { heading: "Credential expired", body: "Your on-chain attestation has passed its validity date. Periodic renewal is required under institutional compliance standards.", action: "Request a credential refresh from your KYC provider." },
  3: { heading: "Credential revoked", body: "Your attestation was revoked by the issuing institution. This may require compliance review.", action: "Contact your institution's compliance office directly." },
  4: { heading: "Issuer not authorised", body: "Your credential was issued by a party not on the vault's approved issuer list.", action: "Confirm your onboarding was completed through an authorised institution." },
  5: { heading: "Clearance level insufficient", body: "Your credential tier does not meet the minimum threshold for these vaults.", action: "Request an enhanced due diligence review from your institution." },
  6: { heading: "Jurisdiction not eligible", body: "Your registered domicile is not permitted for these vaults at this time.", action: "Speak with your relationship manager about jurisdiction eligibility." },
  7: { heading: "Temporarily unavailable", body: "Vault access has been briefly suspended by the operator. No changes to your credential are needed.", action: "Please return shortly." },
};

// ─── On-chain check ───────────────────────────────────────────────────────────
const GATE = new PublicKey(GATE_PROGRAM_ID);
const VAULT_PROG = new PublicKey(VAULT_PROGRAM_ID);

async function checkGate(walletAddr: string): Promise<ClearanceStatus> {
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  const walletPubkey = new PublicKey(walletAddr);
  const [vcPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.VAULT_CONFIG), VAULT_PROG.toBuffer()], GATE);
  const vcInfo = await connection.getAccountInfo(vcPDA);
  if (!vcInfo) return { state: "blocked", reasonCode: 1, reason: "NoAttestation", tier: 0 };
  const data = vcInfo.data;
  if (data.length > 113 && data[113] !== 0) return { state: "blocked", reasonCode: 7, reason: "GatePaused", tier: 0 };
  const minTier = data[72];
  const issuerCount = data.readUInt32LE(73);
  const issuers: PublicKey[] = [];
  for (let i = 0; i < issuerCount; i++) {
    const offset = 77 + i * 32;
    if (offset + 32 <= data.length) issuers.push(new PublicKey(data.slice(offset, offset + 32)));
  }
  if (issuers.length === 0) return { state: "blocked", reasonCode: 1, reason: "NoAttestation", tier: 0 };
  for (const issuer of issuers) {
    const [attPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.ATTESTATION), walletPubkey.toBuffer(), issuer.toBuffer()], GATE);
    const attInfo = await connection.getAccountInfo(attPDA);
    if (!attInfo || attInfo.data.length < 125) continue;
    const att = Buffer.from(attInfo.data);
    if (att[124] !== 0) return { state: "blocked", reasonCode: 3, reason: "Revoked", tier: 0, issuer: shortAddr(issuer.toBase58(), 6) };
    const expiresAt = att.readBigInt64LE(81);
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (expiresAt !== 0n && now > expiresAt) return { state: "blocked", reasonCode: 2, reason: "Expired", tier: 0 };
    const tier = att[72];
    if (tier < minTier) return { state: "blocked", reasonCode: 5, reason: "TierInsufficient", tier };
    const jur = `${String.fromCharCode(att[121])}${String.fromCharCode(att[122])}${String.fromCharCode(att[123])}`;
    const expires = new Date(Number(expiresAt) * 1000).toISOString().slice(0, 10);
    return { state: "cleared", tier, issuer: shortAddr(issuer.toBase58(), 6), jurisdiction: jur, expires, attestationId: shortAddr(attPDA.toBase58(), 8) };
  }
  return { state: "blocked", reasonCode: 1, reason: "NoAttestation", tier: 0 };
}

function tierLabel(t: number) {
  return t === 3 ? "Institutional" : t === 2 ? "Enhanced" : t === 1 ? "Basic" : "—";
}

// ─── SVG: Gate Illustration ───────────────────────────────────────────────────
function GateIllustration({ c }: { c: Theme }) {
  return (
    <svg viewBox="0 0 480 320" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: "480px", opacity: 0.9 }}>
      {/* Ground line */}
      <line x1="40" y1="280" x2="440" y2="280" stroke={c.border2} strokeWidth="1"/>
      {/* Left pillar */}
      <rect x="80" y="100" width="40" height="180" stroke={c.text4} strokeWidth="1" fill="none"/>
      <rect x="72" y="90" width="56" height="16" stroke={c.text4} strokeWidth="1" fill="none"/>
      {/* Right pillar */}
      <rect x="360" y="100" width="40" height="180" stroke={c.text4} strokeWidth="1" fill="none"/>
      <rect x="352" y="90" width="56" height="16" stroke={c.text4} strokeWidth="1" fill="none"/>
      {/* Lintel */}
      <rect x="72" y="74" width="336" height="20" stroke={c.text3} strokeWidth="1" fill={c.accentBg}/>
      {/* Gate opening — subtle glow */}
      <rect x="120" y="100" width="240" height="180" fill={c.accentBg} opacity="0.4"/>
      {/* Gate bars — closed */}
      {[140, 168, 196, 224, 252, 280, 308, 336].map((x, i) => (
        <line key={i} x1={x} y1="100" x2={x} y2="280" stroke={c.border2} strokeWidth="1"/>
      ))}
      {/* Horizontal bar */}
      <line x1="120" y1="190" x2="360" y2="190" stroke={c.border} strokeWidth="0.5"/>
      {/* Leyfis mark on lintel */}
      <rect x="220" y="79" width="7" height="11" fill={c.accent}/>
      <rect x="253" y="79" width="7" height="11" fill={c.accent}/>
      <rect x="220" y="77" width="40" height="4" fill={c.accent}/>
      {/* Verified badge — bottom right */}
      <circle cx="380" cy="240" r="22" stroke={c.approved} strokeWidth="1" fill={c.approvedBg}/>
      <path d="M372 240l5 5 11-11" stroke={c.approved} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Data lines — left */}
      {[0, 1, 2, 3].map(i => (
        <line key={i} x1="20" y1={130 + i * 20} x2="72" y2={130 + i * 20} stroke={c.border} strokeWidth="0.5" strokeDasharray="3 3"/>
      ))}
      {/* Data lines — right */}
      {[0, 1, 2, 3].map(i => (
        <line key={i} x1="408" y1={130 + i * 20} x2="460" y2={130 + i * 20} stroke={c.border} strokeWidth="0.5" strokeDasharray="3 3"/>
      ))}
      {/* Small text labels */}
      <text x="20" y="127" fontSize="7" fill={c.text4} fontFamily="monospace">KYC</text>
      <text x="20" y="147" fontSize="7" fill={c.text4} fontFamily="monospace">TIER</text>
      <text x="20" y="167" fontSize="7" fill={c.text4} fontFamily="monospace">JUR</text>
      <text x="20" y="187" fontSize="7" fill={c.text4} fontFamily="monospace">EXP</text>
    </svg>
  );
}

// ─── SVG: Vault Icon ──────────────────────────────────────────────────────────
function VaultIcon({ c, size = 40 }: { c: Theme; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="4" y="6" width="32" height="28" rx="2" stroke={c.text3} strokeWidth="1"/>
      <circle cx="20" cy="20" r="8" stroke={c.accent} strokeWidth="1"/>
      <circle cx="20" cy="20" r="4" stroke={c.accent} strokeWidth="1"/>
      <line x1="20" y1="12" x2="20" y2="6" stroke={c.text3} strokeWidth="1"/>
      <line x1="20" y1="34" x2="20" y2="28" stroke={c.text3} strokeWidth="1"/>
      <line x1="28" y1="20" x2="34" y2="20" stroke={c.text3} strokeWidth="1"/>
      <line x1="6" y1="20" x2="12" y2="20" stroke={c.text3} strokeWidth="1"/>
      <rect x="32" y="16" width="4" height="8" rx="1" stroke={c.text4} strokeWidth="1"/>
    </svg>
  );
}

// ─── Vault Card ───────────────────────────────────────────────────────────────
function VaultCard({ vault, userTier, userJurisdiction, c }: { vault: Vault; userTier: number; userJurisdiction: string; c: Theme }) {
  const tierOk = userTier >= vault.minTier;
  const jurOk = vault.jurisdictions.includes(userJurisdiction);
  const accessible = tierOk && jurOk && vault.status === "active";
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ border: `1px solid ${hovered && accessible ? c.accentBorder : c.border}`, background: hovered && accessible ? c.accentBg : c.bg1, transition: "all 0.18s ease", display: "flex", flexDirection: "column", height: "100%" }}>

      <div style={{ padding: "28px 28px 0", flex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <VaultIcon c={c} size={36} />
            <div>
              <div style={{ fontSize: "10px", fontFamily: "var(--f-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: c.text4, marginBottom: "4px" }}>{vault.institution}</div>
              <h3 style={{ fontSize: "18px", fontFamily: "var(--f-serif)", fontWeight: 400, color: c.text1, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{vault.name}</h3>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: accessible ? c.approved : c.text4 }} />
            <span style={{ fontSize: "9px", fontFamily: "var(--f-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: accessible ? c.approved : c.text4 }}>
              {vault.status}
            </span>
          </div>
        </div>

        <p style={{ fontSize: "13px", fontFamily: "var(--f-mono)", color: c.text3, lineHeight: 1.8, marginBottom: "24px" }}>{vault.mandate}</p>

        {/* Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", borderTop: `1px solid ${c.border}`, borderLeft: `1px solid ${c.border}` }}>
          {[["AUM", vault.tvl], ["Target Return", vault.apy], ["Inception", vault.inception], ["Min. Clearance", `Tier ${vault.minTier}`]].map(([l, v], i) => (
            <div key={l} style={{ padding: "16px 18px", borderRight: `1px solid ${c.border}`, borderBottom: `1px solid ${c.border}` }}>
              <div style={{ fontSize: "8px", fontFamily: "var(--f-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: c.text4, marginBottom: "6px" }}>{l}</div>
              <div style={{ fontSize: "14px", fontFamily: "var(--f-mono)", color: c.text1, fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Jurisdictions */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 0", borderBottom: `1px solid ${c.border}` }}>
          <span style={{ fontSize: "8px", fontFamily: "var(--f-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: c.text4, flexShrink: 0 }}>Eligible</span>
          <div style={{ display: "flex", gap: "6px" }}>
            {vault.jurisdictions.map(j => (
              <span key={j} style={{
                fontSize: "9px", fontFamily: "var(--f-mono)", padding: "3px 10px",
                background: j === userJurisdiction ? c.approvedBg : "transparent",
                color: j === userJurisdiction ? c.approved : c.text3,
                border: `1px solid ${j === userJurisdiction ? c.approvedBorder : c.border}`,
                letterSpacing: "0.08em",
              }}>{j}</span>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      {accessible ? (
        <a href={`https://explorer.solana.com/address/${vault.programId}?cluster=devnet`} target="_blank" rel="noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "18px 28px", textDecoration: "none",
            background: hovered ? c.accent : "transparent",
            transition: "background 0.18s",
          }}>
          <span style={{ fontSize: "12px", fontFamily: "var(--f-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: hovered ? "#fff" : c.accent, fontWeight: 500 }}>
            Access Vault
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8h12M8 2l6 6-6 6" stroke={hovered ? "#fff" : c.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px" }}>
          <span style={{ fontSize: "11px", fontFamily: "var(--f-mono)", letterSpacing: "0.08em", color: c.text4 }}>
            {!tierOk ? `Requires Tier ${vault.minTier} clearance` : !jurOk ? "Jurisdiction not permitted" : "Unavailable"}
          </span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2.5" y="6" width="9" height="7" rx="1" stroke={c.text4} strokeWidth="1.2"/>
            <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke={c.text4} strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
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
  const [dark, setDark] = useState(true); // default: dark

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("leyfis-app-theme");
    setDark(saved !== "light");
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("leyfis-app-theme", next ? "dark" : "light");
  };

  const c = dark ? T.dark : T.light;

  const runCheck = useCallback(async (addr: string) => {
    setStatus({ state: "checking" });
    try {
      setStatus(await checkGate(addr));
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
    ? VAULTS.filter(v => (status as any).tier >= v.minTier && v.jurisdictions.includes((status as any).jurisdiction))
    : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
        :root { --f-serif: 'EB Garamond', Georgia, serif; --f-mono: 'IBM Plex Mono', monospace; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: ${c.bg}; }
        .wallet-adapter-button {
          font-family: var(--f-mono) !important;
          font-size: 11px !important;
          letter-spacing: 0.1em !important;
          height: 40px !important;
          padding: 0 24px !important;
          border-radius: 0 !important;
          background: ${c.accent} !important;
          color: #fff !important;
          border: none !important;
        }
        .wallet-adapter-button:not([disabled]):hover { opacity: 0.86 !important; }
        .wallet-adapter-button-trigger { background: ${c.accent} !important; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 0.2; } 50% { opacity: 1; } }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
      `}</style>

      <main style={{ minHeight: "100vh", background: c.bg, color: c.text1, transition: "background 0.25s, color 0.25s" }}>

        {/* ── NAV ──────────────────────────────────────────────────────────── */}
        <header style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          height: "60px", padding: "0 48px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: c.bg, borderBottom: `1px solid ${c.border}`,
          transition: "background 0.25s",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "24px", height: "24px", background: c.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="12" height="12" viewBox="0 0 56 56" fill="none">
                <rect x="8" y="16" width="7" height="32" fill="white"/>
                <rect x="41" y="16" width="7" height="32" fill="white"/>
                <rect x="8" y="13" width="40" height="6" fill="white"/>
                <rect x="18" y="19" width="20" height="29" fill={c.accent}/>
              </svg>
            </div>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: "12px", fontWeight: 500, letterSpacing: "0.24em", color: c.text1 }}>LEYFIS</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {cleared && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 14px", background: c.approvedBg, border: `1px solid ${c.approvedBorder}` }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <circle cx="5" cy="5" r="4" stroke={c.approved} strokeWidth="1"/>
                  <path d="M3 5l1.5 1.5L7 3.5" stroke={c.approved} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: "10px", fontFamily: "var(--f-mono)", letterSpacing: "0.08em", color: c.approved }}>
                  Tier {(status as any).tier} · {tierLabel((status as any).tier)}
                </span>
              </div>
            )}

            <button onClick={toggleTheme} title={dark ? "Light mode" : "Dark mode"} style={{ background: "none", border: `1px solid ${c.border}`, cursor: "pointer", padding: "8px 10px", color: c.text3, display: "flex", alignItems: "center" }}>
              {dark
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke={c.text3} strokeWidth="1.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke={c.text3} strokeWidth="1.5" strokeLinecap="round"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke={c.text3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>

            <WalletMultiButton/>
          </div>
        </header>

        {/* ── NOT CONNECTED ──────────────────────────────────────────────────── */}
        {!publicKey && (
          <div style={{ paddingTop: "60px", minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr" }}>

            {/* Left — Hero */}
            <div style={{ padding: "72px 56px 56px", display: "flex", flexDirection: "column", justifyContent: "space-between", borderRight: `1px solid ${c.border}` }}>
              <div>
                <div style={{ fontSize: "10px", fontFamily: "var(--f-mono)", letterSpacing: "0.18em", textTransform: "uppercase", color: c.text4, marginBottom: "48px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ display: "block", width: "24px", height: "1px", background: c.text4 }} />
                  Solana devnet · FINMA-aligned
                </div>

                {/* Large headline */}
                <h1 style={{ fontFamily: "var(--f-serif)", fontSize: "clamp(52px,5.5vw,76px)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.02em", color: c.text1, marginBottom: "28px" }}>
                  Institutional capital.<br />
                  Verified access.<br />
                  <em style={{ color: c.accent, fontStyle: "italic" }}>On-chain.</em>
                </h1>

                <p style={{ fontSize: "16px", fontFamily: "var(--f-mono)", color: c.text3, lineHeight: 1.85, maxWidth: "400px", marginBottom: "40px", fontWeight: 300 }}>
                  Leyfis reads your institution's on-chain KYC credential and grants you immediate access to the vaults you qualify for. No forms. No portals. No waiting.
                </p>

                {/* Connect button — BELOW the text */}
                <div style={{ marginBottom: "56px" }}>
                  <WalletMultiButton/>
                </div>
              </div>

              {/* Gate illustration */}
              <div style={{ paddingTop: "40px", borderTop: `1px solid ${c.border}` }}>
                <GateIllustration c={c} />
              </div>
            </div>

            {/* Right — Process + metadata */}
            <div style={{ padding: "72px 56px 56px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "11px", fontFamily: "var(--f-mono)", letterSpacing: "0.14em", textTransform: "uppercase", color: c.text4, marginBottom: "36px" }}>
                  How access works
                </div>

                {/* Formal numbered process */}
                <div>
                  {[
                    ["I.", "Connect your wallet", "Your wallet address is your identity. No account creation, no passwords, no email required."],
                    ["II.", "Credential verified on-chain", "Leyfis reads your institution's KYC attestation directly from the Solana blockchain. This takes under two seconds."],
                    ["III.", "Access granted immediately", "If your credential is valid and current, the vaults you qualify for appear at once. Nothing to click. Nothing to approve."],
                  ].map(([n, t, d]) => (
                    <div key={n} style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: "16px", padding: "24px 0", borderBottom: `1px solid ${c.border}` }}>
                      <span style={{ fontSize: "14px", fontFamily: "var(--f-serif)", color: c.text4, paddingTop: "2px" }}>{n}</span>
                      <div>
                        <div style={{ fontSize: "16px", fontFamily: "var(--f-serif)", color: c.text1, marginBottom: "8px", lineHeight: 1.2 }}>{t}</div>
                        <div style={{ fontSize: "13px", fontFamily: "var(--f-mono)", color: c.text3, lineHeight: 1.8, fontWeight: 300 }}>{d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                {/* Protocol metadata */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0", border: `1px solid ${c.border}`, marginBottom: "24px" }}>
                  {[["Gate Program", shortAddr(GATE_PROGRAM_ID, 8)], ["Network", "Solana devnet"], ["Standard", "FATF R.16"]].map(([l, v], i) => (
                    <div key={l} style={{ padding: "16px 20px", borderRight: i < 2 ? `1px solid ${c.border}` : "none" }}>
                      <div style={{ fontSize: "8px", fontFamily: "var(--f-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: c.text4, marginBottom: "4px" }}>{l}</div>
                      <div style={{ fontSize: "11px", fontFamily: "var(--f-mono)", color: c.text2 }}>{v}</div>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: "11px", fontFamily: "var(--f-mono)", color: c.text4, lineHeight: 1.8, fontWeight: 300 }}>
                  Leyfis does not store your wallet address or any personal data. Verification is performed against the Solana blockchain only.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── CHECKING ─────────────────────────────────────────────────────── */}
        {publicKey && checking && (
          <div style={{ paddingTop: "60px", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "1px", height: "56px", background: `linear-gradient(to bottom, transparent, ${c.accent})`, margin: "0 auto 24px", animation: "pulse 1.4s ease-in-out infinite" }} />
              <div style={{ fontSize: "12px", fontFamily: "var(--f-mono)", letterSpacing: "0.2em", textTransform: "uppercase", color: c.text3, marginBottom: "8px" }}>
                Verifying access
              </div>
              <div style={{ fontSize: "11px", fontFamily: "var(--f-mono)", color: c.text4 }}>{shortAddr(publicKey.toBase58(), 8)}</div>
            </div>
          </div>
        )}

        {/* ── CLEARED ──────────────────────────────────────────────────────── */}
        {publicKey && cleared && status.state === "cleared" && (
          <div style={{ paddingTop: "60px" }} className="fade-in">

            {/* Credential strip */}
            <div style={{ borderBottom: `1px solid ${c.border}`, padding: "0 48px", background: c.bg1, display: "flex", alignItems: "center", height: "48px", gap: "0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingRight: "24px", borderRight: `1px solid ${c.border}` }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke={c.approved} strokeWidth="1"/>
                  <path d="M4 6l1.5 1.5L8.5 4" stroke={c.approved} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: "10px", fontFamily: "var(--f-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: c.approved }}>Verified</span>
              </div>
              {[`Tier ${status.tier} — ${tierLabel(status.tier)}`, status.issuer, status.jurisdiction, `Expires ${status.expires}`, status.attestationId].map((v, i) => (
                <div key={i} style={{ padding: "0 20px", borderRight: i < 4 ? `1px solid ${c.border}` : "none" }}>
                  <span style={{ fontSize: "10px", fontFamily: "var(--f-mono)", color: c.text3, letterSpacing: "0.04em" }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Vaults */}
            <div style={{ padding: "52px 48px 64px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "36px", paddingBottom: "20px", borderBottom: `1px solid ${c.border}` }}>
                <div>
                  <div style={{ fontSize: "10px", fontFamily: "var(--f-mono)", letterSpacing: "0.16em", textTransform: "uppercase", color: c.text4, marginBottom: "10px" }}>Available to you</div>
                  <h2 style={{ fontFamily: "var(--f-serif)", fontSize: "36px", fontWeight: 400, letterSpacing: "-0.02em", color: c.text1 }}>
                    {accessibleVaults.length > 0
                      ? `${accessibleVaults.length} vault${accessibleVaults.length > 1 ? "s" : ""} match your credential`
                      : "No vaults match your current credential"}
                  </h2>
                </div>
                <div style={{ fontSize: "11px", fontFamily: "var(--f-mono)", color: c.text4 }}>
                  {new Date().toLocaleDateString("en-CH", { day: "2-digit", month: "long", year: "numeric" })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px", background: c.border, marginBottom: "40px" }}>
                {VAULTS.map(vault => (
                  <div key={vault.id} style={{ background: c.bg }}>
                    <VaultCard vault={vault} userTier={status.tier} userJurisdiction={status.jurisdiction} c={c} />
                  </div>
                ))}
              </div>

              {/* Protocol footnote */}
              <div style={{ display: "flex", gap: "48px", paddingTop: "24px", borderTop: `1px solid ${c.border}` }}>
                {[["Gate Program", shortAddr(GATE_PROGRAM_ID, 8)], ["Attestation", status.attestationId], ["Network", "Solana devnet"], ["Verified", "just now"]].map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: "8px", fontFamily: "var(--f-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: c.text4, marginBottom: "4px" }}>{l}</div>
                    <div style={{ fontSize: "11px", fontFamily: "var(--f-mono)", color: c.text3 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── BLOCKED ──────────────────────────────────────────────────────── */}
        {publicKey && blocked && status.state === "blocked" && (() => {
          const msg = BLOCKS[status.reasonCode] || BLOCKS[1];
          return (
            <div style={{ paddingTop: "60px" }} className="fade-in">
              {/* Strip */}
              <div style={{ borderBottom: `1px solid ${c.border}`, padding: "0 48px", background: c.bg1, display: "flex", alignItems: "center", height: "48px", gap: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: c.danger }} />
                  <span style={{ fontSize: "10px", fontFamily: "var(--f-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: c.danger }}>Access restricted</span>
                </div>
                <span style={{ fontSize: "10px", fontFamily: "var(--f-mono)", color: c.text4 }}>{shortAddr(publicKey.toBase58(), 8)}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "calc(100vh - 108px)" }}>
                <div style={{ padding: "60px 56px", borderRight: `1px solid ${c.border}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: "10px", fontFamily: "var(--f-mono)", letterSpacing: "0.16em", textTransform: "uppercase", color: c.danger, marginBottom: "24px" }}>{msg.heading}</div>
                    <h2 style={{ fontFamily: "var(--f-serif)", fontSize: "36px", fontWeight: 400, letterSpacing: "-0.02em", color: c.text1, marginBottom: "20px", lineHeight: 1.15 }}>
                      Access to these vaults is not currently available.
                    </h2>
                    <p style={{ fontSize: "15px", fontFamily: "var(--f-mono)", color: c.text3, lineHeight: 1.85, marginBottom: "32px", maxWidth: "420px", fontWeight: 300 }}>{msg.body}</p>
                    <div style={{ padding: "22px 24px", border: `1px solid ${c.border}`, background: c.bg1 }}>
                      <div style={{ fontSize: "9px", fontFamily: "var(--f-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: c.text4, marginBottom: "10px" }}>Recommended action</div>
                      <div style={{ fontSize: "14px", fontFamily: "var(--f-mono)", color: c.text2, lineHeight: 1.75, fontWeight: 300 }}>{msg.action}</div>
                    </div>
                  </div>
                  <div style={{ paddingTop: "28px", borderTop: `1px solid ${c.border}` }}>
                    {[["Reason code", `${status.reasonCode}`], ["Gate Program", shortAddr(GATE_PROGRAM_ID, 8)], ["Network", "Solana devnet"]].map(([l, v]) => (
                      <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${c.border}` }}>
                        <span style={{ fontSize: "11px", fontFamily: "var(--f-mono)", color: c.text4, letterSpacing: "0.06em" }}>{l}</span>
                        <span style={{ fontSize: "11px", fontFamily: "var(--f-mono)", color: c.text2 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: "60px 56px", background: c.bg1 }}>
                  <div style={{ fontSize: "10px", fontFamily: "var(--f-mono)", letterSpacing: "0.16em", textTransform: "uppercase", color: c.text4, marginBottom: "28px" }}>
                    Vaults requiring authorisation
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", background: c.border }}>
                    {VAULTS.map(vault => (
                      <div key={vault.id} style={{ background: c.bg1, padding: "28px", opacity: 0.5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                          <VaultIcon c={c} size={28} />
                          <div>
                            <div style={{ fontSize: "9px", fontFamily: "var(--f-mono)", color: c.text4, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>{vault.institution}</div>
                            <div style={{ fontFamily: "var(--f-serif)", fontSize: "18px", color: c.text2, lineHeight: 1.2 }}>{vault.name}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                          <span style={{ fontSize: "9px", fontFamily: "var(--f-mono)", padding: "3px 10px", border: `1px solid ${c.border}`, color: c.text4 }}>Tier {vault.minTier}+ required</span>
                          {vault.jurisdictions.map(j => <span key={j} style={{ fontSize: "9px", fontFamily: "var(--f-mono)", padding: "3px 10px", border: `1px solid ${c.border}`, color: c.text4 }}>{j}</span>)}
                        </div>
                        <div style={{ padding: "12px 16px", border: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "10px", fontFamily: "var(--f-mono)", color: c.text4, letterSpacing: "0.08em", textTransform: "uppercase" }}>Access locked</span>
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                            <rect x="2.5" y="6" width="9" height="7" rx="1" stroke={c.text4} strokeWidth="1.2"/>
                            <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke={c.text4} strokeWidth="1.2" strokeLinecap="round"/>
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Footer */}
        <footer style={{ padding: "18px 48px", borderTop: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: c.bg1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <span style={{ fontSize: "10px", fontFamily: "var(--f-mono)", fontWeight: 500, letterSpacing: "0.24em", color: c.text4 }}>LEYFIS</span>
            <span style={{ fontSize: "10px", fontFamily: "var(--f-mono)", color: c.text4, fontWeight: 300 }}>Institutional compliance infrastructure · Solana</span>
          </div>
          <div style={{ display: "flex", gap: "24px" }}>
            {[["Solana Explorer", `https://explorer.solana.com/address/${GATE_PROGRAM_ID}?cluster=devnet`], ["Admin Console", "http://localhost:3001"]].map(([l, h]) => (
              <a key={l} href={h} target="_blank" rel="noreferrer" style={{ fontSize: "10px", fontFamily: "var(--f-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: c.text4, textDecoration: "none" }}>{l}</a>
            ))}
          </div>
        </footer>
      </main>
    </>
  );
}
