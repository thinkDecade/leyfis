"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Connection, PublicKey } from "@solana/web3.js";
import { AdminRole, shortAddr, GATE_PROGRAM_ID, RPC_ENDPOINT, SEEDS, usePlan, track } from "@leyfis/shared";
import {
  LayoutDashboard, Vault, BadgeCheck,
  BookOpen, ScrollText, Radio, Download, Globe, History,
  Sun, Moon, Wallet, ChevronRight, LogOut, Loader2
} from "lucide-react";

async function fetchVaultAuthority(): Promise<string | null> {
  try {
    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const gateProgramId = new PublicKey(GATE_PROGRAM_ID);
    const VAULT_PROGRAM = new PublicKey("88x1hxWW6mMDpQQwuR3sCDgnmbHwHmQBdWYZQhcedNaJ");
    const [vaultConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.VAULT_CONFIG), VAULT_PROGRAM.toBuffer()],
      gateProgramId
    );
    const accountInfo = await connection.getAccountInfo(vaultConfigPDA);
    if (!accountInfo) return null;
    const authorityBytes = accountInfo.data.slice(8, 40);
    return new PublicKey(authorityBytes).toBase58();
  } catch {
    return null;
  }
}

async function fetchIssuerRole(walletAddress: string): Promise<AdminRole> {
  try {
    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const gateProgramId = new PublicKey(GATE_PROGRAM_ID);
    const [issuerRegistryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.ISSUER_REGISTRY)],
      gateProgramId
    );
    const accountInfo = await connection.getAccountInfo(issuerRegistryPDA);
    if (!accountInfo) return "none";
    const data = accountInfo.data;
    const issuerCount = data.readUInt32LE(40);
    const ENTRY_SIZE = 73;
    const base = 44;
    for (let i = 0; i < issuerCount; i++) {
      const offset = base + i * ENTRY_SIZE;
      if (offset + ENTRY_SIZE > data.length) break;
      const issuerPubkey = new PublicKey(data.slice(offset, offset + 32)).toBase58();
      const active = data[offset + 72] === 1;
      if (issuerPubkey === walletAddress && active) return "kyc_issuer";
    }
    return "none";
  } catch {
    return "none";
  }
}

export function useRole(): { role: AdminRole; loading: boolean } {
  const { publicKey } = useWallet();
  const [role, setRole] = useState<AdminRole>("none");
  const [loading, setLoading] = useState(false);

  const detectRole = useCallback(async (address: string) => {
    setLoading(true);
    try {
      const authority = await fetchVaultAuthority();
      if (authority && authority === address) { setRole("super_admin"); return; }
      const issuerRole = await fetchIssuerRole(address);
      if (issuerRole !== "none") { setRole(issuerRole); return; }
      setRole("none");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!publicKey) { setRole("none"); return; }
    detectRole(publicKey.toBase58());
  }, [publicKey, detectRole]);

  return { role, loading };
}

export function useTheme() {
  const [theme, setTheme] = useState<"dark"|"light">("dark");
  useEffect(() => {
    const saved = (localStorage.getItem("leyfis-theme") as "dark"|"light") || "dark";
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

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin", vault_operator: "Vault Operator",
  kyc_issuer: "KYC Issuer", compliance_auditor: "Compliance Auditor", none: "No Access",
};

const ROLE_COLORS: Record<AdminRole, string> = {
  super_admin: "var(--accent)", vault_operator: "var(--accent)",
  kyc_issuer: "var(--accent)", compliance_auditor: "var(--muted)", none: "var(--text-4)",
};

const NAV = [
  { label: "Overview",  href: "/",        icon: LayoutDashboard, roles: ["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
  { label: "Vault",     href: "/vault",    icon: Vault,           roles: ["super_admin","vault_operator"] },
  { label: "Issue",     href: "/issue",    icon: BadgeCheck,      roles: ["super_admin","kyc_issuer"] },
  { label: "Registry",  href: "/registry", icon: BookOpen,        roles: ["super_admin","kyc_issuer"] },
  { label: "Audit Log", href: "/audit",    icon: ScrollText,      roles: ["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
  { label: "Live Feed",   href: "/feed",       icon: Radio,   roles: ["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
  { label: "Export",      href: "/export",     icon: Download, roles: ["super_admin","vault_operator","compliance_auditor"] },
  { label: "Regulatory",    href: "/regulatory",   icon: Globe,    roles: ["super_admin","vault_operator"] },
  { label: "Time Machine",  href: "/timemachine",  icon: History,  roles: ["super_admin","vault_operator","compliance_auditor"] },
];

export function AdminShell({ children, current }: { children: React.ReactNode; current: string }) {
  const { publicKey, disconnect } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  useEffect(() => setMounted(true), []);
  const { role, loading } = useRole();
  const { theme, toggle } = useTheme();
  const plan = usePlan();

  useEffect(() => {
    if (publicKey && role !== "none" && !loading) {
      track({ event: "admin_session_start", role, wallet_truncated: publicKey.toBase58().slice(0, 8) });
    }
  }, [publicKey, role, loading]);

  const handleDisconnect = async () => { await disconnect(); setShowDisconnect(false); };

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"var(--bg)" }}>
      <aside style={{ width:"var(--sidebar-w)", flexShrink:0, borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", position:"fixed", top:0, left:0, bottom:0, zIndex:300, background:"var(--bg-1)" }}>
        {/* Logo */}
        <div style={{ padding:"24px 24px 20px", borderBottom:"1px solid var(--border)" }}>
          <Link href="/" style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <div style={{ width:"32px", height:"32px", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 56 56" fill="none"><rect x="8" y="16" width="7" height="32" fill="white"/><rect x="41" y="16" width="7" height="32" fill="white"/><rect x="8" y="13" width="40" height="6" fill="white"/><rect x="18" y="19" width="20" height="29" fill="var(--accent)"/></svg>
            </div>
            <div>
              <div style={{ fontFamily:"Inter,sans-serif", fontSize:"13px", fontWeight:700, letterSpacing:"0.22em", color:"var(--text-1)", lineHeight:1 }}>LEYFIS</div>
              <div style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.08em", textTransform:"uppercase", marginTop:"4px" }}>Operations Console</div>
            </div>
          </Link>
        </div>
        {/* Nav */}
        <nav style={{ flex:1, padding:"12px 0", overflowY:"auto" }}>
          {loading && mounted && publicKey ? (
            <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"14px 24px" }}>
              <Loader2 size={13} color="var(--text-4)" style={{ animation:"spin 1s linear infinite" }}/>
              <span style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.08em" }}>Detecting role…</span>
            </div>
          ) : NAV.filter(item => role !== "none" && item.roles.includes(role)).map(item => {
            const Icon = item.icon;
            const active = current === item.href;
            return (
              <Link key={item.href} href={item.href} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 24px", textDecoration:"none", background:active?"var(--accent-bg)":"transparent", borderLeft:active?"3px solid var(--accent)":"3px solid transparent", transition:"background 0.12s" }}>
                <Icon size={15} color={active?"var(--accent)":"var(--text-3)"} strokeWidth={active?2.2:1.7}/>
                <span style={{ fontFamily:"Inter,sans-serif", fontSize:"13px", fontWeight:active?600:400, color:active?"var(--text-1)":"var(--text-2)", letterSpacing:"-0.01em" }}>{item.label}</span>
                {active && <ChevronRight size={12} color="var(--accent)" style={{ marginLeft:"auto" }}/>}
              </Link>
            );
          })}
        </nav>
        {/* Footer */}
        <div style={{ padding:"16px 24px", borderTop:"1px solid var(--border)" }}>
          <button onClick={toggle} style={{ display:"flex", alignItems:"center", gap:"8px", width:"100%", background:"var(--bg-2)", border:"1px solid var(--border)", padding:"10px 14px", cursor:"pointer", marginBottom:"10px" }}>
            {theme==="dark"?<Sun size={13} color="var(--text-3)"/>:<Moon size={13} color="var(--text-3)"/>}
            <span style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", letterSpacing:"0.08em", color:"var(--text-3)" }}>{theme==="dark"?"Light Mode":"Dark Mode"}</span>
          </button>
          {mounted && publicKey ? (
            <div style={{ background:"var(--bg-2)", border:"1px solid var(--border)", padding:"14px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"8px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                  <Wallet size={11} color="var(--text-4)"/>
                  <span style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.08em", textTransform:"uppercase" }}>Connected</span>
                </div>
                <button onClick={()=>setShowDisconnect(true)} style={{ display:"flex", alignItems:"center", gap:"5px", background:"none", border:"none", cursor:"pointer", padding:"2px 4px" }}>
                  <LogOut size={11} color="var(--text-4)"/>
                  <span style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.06em" }}>Sign out</span>
                </button>
              </div>
              <div style={{ fontFamily:"DM Mono,monospace", fontSize:"12px", color:"var(--text-2)", marginBottom:"6px", fontWeight:500 }}>{shortAddr(publicKey.toBase58(),8)}</div>
              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                {loading?<Loader2 size={10} color="var(--text-4)" style={{ animation:"spin 1s linear infinite" }}/>:<div style={{ width:"6px", height:"6px", borderRadius:"50%", background:role!=="none"?"var(--accent)":"var(--text-4)", flexShrink:0 }}/>}
                <span style={{ fontFamily:"DM Mono,monospace", fontSize:"12px", color:ROLE_COLORS[role], letterSpacing:"0.04em", fontWeight:600 }}>{loading?"Detecting…":ROLE_LABELS[role]}</span>
              </div>
            </div>
          ) : mounted && <WalletMultiButton style={{ width:"100%", justifyContent:"center", fontSize:"11px" }}/>}
        </div>
      </aside>
      {showDisconnect && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.80)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(6px)" }}>
          <div style={{ background:"var(--bg-1)", border:"1px solid var(--border-2)", padding:"36px", maxWidth:"360px", width:"100%" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px" }}>
              <LogOut size={16} color="var(--text-3)"/>
              <span style={{ fontFamily:"Inter,sans-serif", fontSize:"16px", fontWeight:600, color:"var(--text-1)" }}>Sign Out</span>
            </div>
            <p style={{ fontFamily:"Inter,sans-serif", fontSize:"14px", color:"var(--text-3)", lineHeight:1.65, marginBottom:"28px" }}>Disconnect your wallet from the Leyfis Operations Console?</p>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={handleDisconnect} style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", letterSpacing:"0.08em", textTransform:"uppercase", background:"var(--text-1)", color:"var(--bg)", border:"none", padding:"12px 20px", cursor:"pointer", fontWeight:700, flex:1 }}>Sign Out</button>
              <button onClick={()=>setShowDisconnect(false)} style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", letterSpacing:"0.08em", textTransform:"uppercase", background:"transparent", color:"var(--text-3)", border:"1px solid var(--border)", padding:"12px 20px", cursor:"pointer", flex:1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <main style={{ flex:1, marginLeft:"var(--sidebar-w)", minHeight:"100vh", background:"var(--bg)" }}>
        {/* Top header */}
        <div style={{ position:"sticky", top:0, zIndex:200, padding:"0 40px", height:"56px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--bg-1)", borderBottom:"1px solid var(--border)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            {(()=>{ const item=NAV.find(n=>n.href===current); if(!item) return null; const Icon=item.icon; return <><Icon size={14} color="var(--text-4)"/><span style={{ fontFamily:"Inter,sans-serif", fontSize:"14px", fontWeight:600, color:"var(--text-1)", letterSpacing:"-0.01em" }}>{item.label}</span></>; })()}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"var(--accent)" }}/>
            <span style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.06em" }}>Solana devnet</span>
          </div>
        </div>
        {/* Trial banner */}
        {mounted && plan.tier === "trial" && plan.trialDaysRemaining !== undefined && (
          <div style={{ padding: "11px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", background: plan.trialDaysRemaining <= 10 ? "rgba(180,83,9,0.08)" : "var(--bg-2)", borderBottom: `1px solid ${plan.trialDaysRemaining <= 10 ? "rgba(180,83,9,0.28)" : "var(--border)"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: plan.trialDaysRemaining <= 10 ? "#B45309" : "var(--accent)", flexShrink: 0 }} />
              <span style={{ fontFamily: "DM Mono,monospace", fontSize: "11px", color: plan.trialDaysRemaining <= 10 ? "#B45309" : "var(--text-3)", letterSpacing: "0.05em" }}>
                30-day trial · {plan.trialDaysRemaining} days remaining · All features unlocked
              </span>
            </div>
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <a href="mailto:contact@leyfis.io?subject=Upgrade to Institutional" style={{ fontFamily: "DM Mono,monospace", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                Upgrade to Institutional — $8,000/mo →
              </a>
              <a href="mailto:contact@leyfis.io" style={{ fontFamily: "DM Mono,monospace", fontSize: "11px", letterSpacing: "0.06em", color: "var(--text-4)", textDecoration: "none" }}>
                Talk to us
              </a>
            </div>
          </div>
        )}
        <div style={{ padding:"48px" }}>{children}</div>
      </main>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
