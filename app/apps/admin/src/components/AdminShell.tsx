"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect } from "react";
import { AdminRole, shortAddr, GATE_PROGRAM_ID } from "@leyfis/shared";

// Known wallets for demo ? maps pubkey to role
const ROLE_MAP: Record<string, AdminRole> = {
  "EGFbgXT1NC1ZGJgv33FRFdzKrKAc5hFLqqydS66eY4ht": "super_admin",
  "EDBYT2E8HGEKhTRmHHdrAYUJChi4RUQdbzAmuqB6QALU": "kyc_issuer",
  "DKF6Ey3KwCKE2bJGyoJpfeaonyfpkfZNHianQpAjF6uG": "compliance_auditor",
};

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  vault_operator: "Vault Operator",
  kyc_issuer: "KYC Issuer",
  compliance_auditor: "Compliance Auditor",
  none: "No Role",
};

const ROLE_COLORS: Record<AdminRole, string> = {
  super_admin: "#1B4FD8",
  vault_operator: "#1B4FD8",
  kyc_issuer: "#1B4FD8",
  compliance_auditor: "#8899BB",
  none: "#3D5070",
};

const NAV_ITEMS = [
  { num: "00", label: "Overview",         href: "/",         roles: ["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
  { num: "01", label: "Protocol",         href: "/protocol", roles: ["super_admin"] },
  { num: "02", label: "Vault",            href: "/vault",    roles: ["super_admin","vault_operator"] },
  { num: "03", label: "Issue",            href: "/issue",    roles: ["super_admin","kyc_issuer"] },
  { num: "04", label: "Registry",         href: "/registry", roles: ["super_admin","kyc_issuer"] },
  { num: "05", label: "Audit Log",        href: "/audit",    roles: ["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
  { num: "06", label: "Live Feed",        href: "/feed",     roles: ["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
  { num: "07", label: "Export",           href: "/export",   roles: ["super_admin","vault_operator","compliance_auditor"] },
];

export function useRole(): AdminRole {
  const { publicKey } = useWallet();
  if (!publicKey) return "none";
  return ROLE_MAP[publicKey.toBase58()] || "none";
}

export function AdminShell({ children, current }: { children: React.ReactNode; current: string }) {
  const { publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const role = mounted && publicKey ? (ROLE_MAP[publicKey.toBase58()] || "none") : "none";
  const m = { fontFamily: "'DM Mono',monospace" };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#000" }}>
      {/* Sidebar */}
      <aside style={{ width: "220px", flexShrink: 0, borderRight: "1px solid rgba(232,238,246,0.08)", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 300, background: "#000" }}>
        {/* Logo */}
        <div style={{ padding: "28px 24px 20px", borderBottom: "1px solid rgba(232,238,246,0.06)" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
            <svg width="18" height="18" viewBox="0 0 56 56" fill="none">
              <rect x="8" y="16" width="7" height="32" fill="#E8EEF6"/>
              <rect x="41" y="16" width="7" height="32" fill="#E8EEF6"/>
              <rect x="8" y="13" width="40" height="6" fill="#E8EEF6"/>
              <rect x="18" y="19" width="20" height="29" fill="#000"/>
              <rect x="18" y="44" width="20" height="1.5" fill="#8899BB"/>
            </svg>
            <span style={{ fontFamily: "Arial,sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.22em", color: "#E8EEF6" }}>LEYFIS</span>
          </a>
          <div style={{ ...m, fontSize: "9px", color: "rgba(232,238,246,0.25)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "6px" }}>Admin</div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "12px 0", overflowY: "auto" }}>
          {NAV_ITEMS.map(item => {
            const accessible = role === "none" ? item.href === "/" : item.roles.includes(role);
            const active = current === item.href;
            return (
              <a key={item.href} href={accessible ? item.href : "#"}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 24px",
                  textDecoration: "none",
                  background: active ? "rgba(27,79,216,0.08)" : "transparent",
                  borderLeft: active ? "2px solid #1B4FD8" : "2px solid transparent",
                  opacity: accessible ? 1 : 0.3,
                  cursor: accessible ? "pointer" : "not-allowed",
                  transition: "background 0.15s",
                }}>
                <span style={{ ...m, fontSize: "9px", color: active ? "#1B4FD8" : "rgba(232,238,246,0.3)", letterSpacing: "0.1em", width: "20px" }}>{item.num}</span>
                <span style={{ ...m, fontSize: "11px", color: active ? "#E8EEF6" : accessible ? "rgba(232,238,246,0.6)" : "rgba(232,238,246,0.3)", letterSpacing: "0.04em" }}>{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Bottom ? wallet + role */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(232,238,246,0.06)" }}>
          {mounted && (
            <>
              {publicKey && (
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ ...m, fontSize: "9px", color: "rgba(232,238,246,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Connected</div>
                  <div style={{ ...m, fontSize: "10px", color: "rgba(232,238,246,0.6)" }}>{shortAddr(publicKey.toBase58(), 6)}</div>
                  <div style={{ ...m, fontSize: "9px", color: ROLE_COLORS[role], marginTop: "4px", letterSpacing: "0.08em" }}>{ROLE_LABELS[role]}</div>
                </div>
              )}
              <WalletMultiButton style={{ width: "100%", fontSize: "10px", padding: "8px 12px", justifyContent: "center" }} />
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: "220px", minHeight: "100vh" }}>
        {/* Top bar */}
        <div style={{ position: "sticky", top: 0, zIndex: 200, padding: "14px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(232,238,246,0.06)" }}>
          <div style={{ ...m, fontSize: "10px", color: "rgba(232,238,246,0.3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {NAV_ITEMS.find(n => n.href === current)?.label || "Admin"}
          </div>
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <a href="http://localhost:3000" target="_blank" rel="noreferrer" style={{ ...m, fontSize: "9px", color: "rgba(232,238,246,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>Public Demo</a>
            <div style={{ ...m, fontSize: "9px", color: "rgba(232,238,246,0.2)", letterSpacing: "0.08em" }}>devnet</div>
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding: "40px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
