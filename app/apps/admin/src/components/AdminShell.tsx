"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect } from "react";
import { AdminRole, shortAddr } from "@leyfis/shared";
import {
  LayoutDashboard, ShieldCheck, Vault, BadgeCheck,
  BookOpen, ScrollText, Radio, Download,
  Sun, Moon, Wallet, ChevronRight
} from "lucide-react";

const ROLE_MAP: Record<string, AdminRole> = {
  "EGFbgXT1NC1ZGJgv33FRFdzKrKAc5hFLqqydS66eY4ht": "super_admin",
  "EDBYT2E8HGEKhTRmHHdrAYUJChi4RUQdbzAmuqB6QALU": "kyc_issuer",
  "DKF6Ey3KwCKE2bJGyoJpfeaonyfpkfZNHianQpAjF6uG": "compliance_auditor",
};

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin", vault_operator: "Vault Operator",
  kyc_issuer: "KYC Issuer", compliance_auditor: "Compliance Auditor", none: "No Access",
};

const ROLE_COLORS: Record<AdminRole, string> = {
  super_admin: "var(--accent)", vault_operator: "var(--accent)",
  kyc_issuer: "var(--accent)", compliance_auditor: "var(--muted)", none: "var(--text-4)",
};

const NAV = [
  { label:"Overview",   href:"/",         icon: LayoutDashboard, roles:["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
  { label:"Protocol",   href:"/protocol", icon: ShieldCheck,     roles:["super_admin"] },
  { label:"Vault",      href:"/vault",    icon: Vault,           roles:["super_admin","vault_operator"] },
  { label:"Issue",      href:"/issue",    icon: BadgeCheck,      roles:["super_admin","kyc_issuer"] },
  { label:"Registry",   href:"/registry", icon: BookOpen,        roles:["super_admin","kyc_issuer"] },
  { label:"Audit Log",  href:"/audit",    icon: ScrollText,      roles:["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
  { label:"Live Feed",  href:"/feed",     icon: Radio,           roles:["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
  { label:"Export",     href:"/export",   icon: Download,        roles:["super_admin","vault_operator","compliance_auditor"] },
];

export function useRole(): AdminRole {
  const { publicKey } = useWallet();
  if (!publicKey) return "none";
  return ROLE_MAP[publicKey.toBase58()] || "none";
}

export function useTheme() {
  const [theme, setTheme] = useState<"dark"|"light">("dark");
  useEffect(() => {
    const saved = localStorage.getItem("leyfis-theme") as "dark"|"light" || "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("leyfis-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };
  return { theme, toggle };
}

export function AdminShell({ children, current }: { children: React.ReactNode; current: string }) {
  const { publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const role = mounted && publicKey ? (ROLE_MAP[publicKey.toBase58()] || "none") : "none";
  const { theme, toggle } = useTheme();

  const sidebarStyle: React.CSSProperties = {
    width: "var(--sidebar-w)", flexShrink: 0,
    borderRight: "1px solid var(--border)",
    display: "flex", flexDirection: "column",
    position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 300,
    background: "var(--bg-1)",
  };

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"var(--bg)" }}>
      {/* Sidebar */}
      <aside style={sidebarStyle}>
        {/* Logo */}
        <div style={{ padding:"24px 20px 18px", borderBottom:"1px solid var(--border)" }}>
          <a href="/" style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{ width:"28px", height:"28px", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg width="14" height="14" viewBox="0 0 56 56" fill="none">
                <rect x="8" y="16" width="7" height="32" fill="white"/>
                <rect x="41" y="16" width="7" height="32" fill="white"/>
                <rect x="8" y="13" width="40" height="6" fill="white"/>
                <rect x="18" y="19" width="20" height="29" fill="var(--accent)"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily:"'Inter',sans-serif", fontSize:"12px", fontWeight:800, letterSpacing:"0.18em", color:"var(--text-1)" }}>LEYFIS</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"8px", color:"var(--text-4)", letterSpacing:"0.1em", textTransform:"uppercase", marginTop:"1px" }}>Admin Console</div>
            </div>
          </a>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:"8px 0", overflowY:"auto" }}>
          {NAV.map(item => {
            const Icon = item.icon;
            const accessible = role === "none" ? item.href === "/" : item.roles.includes(role);
            const active = current === item.href;
            return (
              <a key={item.href} href={accessible ? item.href : "#"}
                style={{
                  display:"flex", alignItems:"center", gap:"10px",
                  padding:"10px 20px", textDecoration:"none",
                  background: active ? "var(--accent-bg)" : "transparent",
                  borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                  opacity: accessible ? 1 : 0.3,
                  cursor: accessible ? "pointer" : "not-allowed",
                  transition: "background 0.15s, border-color 0.15s",
                }}>
                <Icon size={15} color={active ? "var(--accent)" : accessible ? "var(--text-3)" : "var(--text-4)"} strokeWidth={active ? 2.5 : 2} />
                <span style={{
                  fontFamily:"'Inter',sans-serif", fontSize:"12.5px", fontWeight: active ? 600 : 400,
                  color: active ? "var(--text-1)" : accessible ? "var(--text-2)" : "var(--text-4)",
                  letterSpacing:"0.01em",
                }}>
                  {item.label}
                </span>
                {active && <ChevronRight size={12} color="var(--accent)" style={{ marginLeft:"auto" }} />}
              </a>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding:"14px 20px", borderTop:"1px solid var(--border)" }}>
          {/* Theme toggle */}
          <button onClick={toggle} style={{
            display:"flex", alignItems:"center", gap:"8px", width:"100%",
            background:"var(--bg-2)", border:"1px solid var(--border)", padding:"8px 12px",
            cursor:"pointer", marginBottom:"12px", color:"var(--text-2)",
          }}>
            {theme === "dark"
              ? <Sun size={13} color="var(--text-3)" />
              : <Moon size={13} color="var(--text-3)" />}
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", letterSpacing:"0.08em", color:"var(--text-3)" }}>
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          </button>

          {mounted && publicKey && (
            <div style={{ marginBottom:"12px", padding:"10px 12px", background:"var(--bg-2)", border:"1px solid var(--border)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
                <Wallet size={11} color="var(--text-4)" />
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:"var(--text-4)", letterSpacing:"0.08em", textTransform:"uppercase" }}>Connected</span>
              </div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:"var(--text-2)", marginBottom:"3px" }}>
                {shortAddr(publicKey.toBase58(), 6)}
              </div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"9px", color:ROLE_COLORS[role], letterSpacing:"0.06em", fontWeight:500 }}>
                {ROLE_LABELS[role]}
              </div>
            </div>
          )}
          {mounted && <WalletMultiButton style={{ width:"100%", justifyContent:"center", fontSize:"10px" }} />}
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, marginLeft:"var(--sidebar-w)", minHeight:"100vh", background:"var(--bg)" }}>
        {/* Topbar */}
        <div style={{
          position:"sticky", top:0, zIndex:200,
          padding:"12px 36px",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          background:"var(--bg-1)",
          borderBottom:"1px solid var(--border)",
          backdropFilter:"blur(12px)",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
            {NAV.find(n => n.href === current) && (() => {
              const item = NAV.find(n => n.href === current)!;
              const Icon = item.icon;
              return (
                <>
                  <Icon size={14} color="var(--text-3)" />
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"11px", color:"var(--text-3)", letterSpacing:"0.1em", textTransform:"uppercase" }}>
                    {item.label}
                  </span>
                </>
              );
            })()}
          </div>
          <div style={{ display:"flex", gap:"20px", alignItems:"center" }}>
            <a href="http://localhost:3000" target="_blank" rel="noreferrer"
              style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:"var(--text-4)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
              Public Demo ?
            </a>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"var(--accent)" }} />
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", color:"var(--text-4)", letterSpacing:"0.06em" }}>devnet</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding:"36px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
