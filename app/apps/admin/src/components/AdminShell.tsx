"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect, useCallback } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { AdminRole, shortAddr, GATE_PROGRAM_ID, RPC_ENDPOINT, SEEDS } from "@leyfis/shared";
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

  const handleDisconnect = async () => { await disconnect(); setShowDisconnect(false); };

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"var(--bg)" }}>
      <aside style={{ width:"var(--sidebar-w)", flexShrink:0, borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", position:"fixed", top:0, left:0, bottom:0, zIndex:300, background:"var(--bg-1)" }}>
        <div style={{ padding:"24px 20px 20px", borderBottom:"1px solid var(--border)" }}>
          <a href="/" style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <div style={{ width:"32px", height:"32px", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 56 56" fill="none"><rect x="8" y="16" width="7" height="32" fill="white"/><rect x="41" y="16" width="7" height="32" fill="white"/><rect x="8" y="13" width="40" height="6" fill="white"/><rect x="18" y="19" width="20" height="29" fill="var(--accent)"/></svg>
            </div>
            <div>
              <div style={{ fontFamily:"Inter,sans-serif", fontSize:"13px", fontWeight:800, letterSpacing:"0.2em", color:"var(--text-1)", lineHeight:1 }}>LEYFIS</div>
              <div style={{ fontFamily:"DM Mono,monospace", fontSize:"9px", color:"var(--text-4)", letterSpacing:"0.1em", textTransform:"uppercase", marginTop:"3px" }}>Admin Console</div>
            </div>
          </a>
        </div>
        <nav style={{ flex:1, padding:"10px 0", overflowY:"auto" }}>
          {loading && mounted && publicKey ? (
            <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"14px 20px" }}>
              <Loader2 size={14} color="var(--text-4)" style={{ animation:"spin 1s linear infinite" }}/>
              <span style={{ fontFamily:"DM Mono,monospace", fontSize:"10px", color:"var(--text-4)", letterSpacing:"0.08em" }}>Detecting role...</span>
            </div>
          ) : NAV.map(item => {
            const Icon = item.icon;
            const accessible = role !== "none" && item.roles.includes(role);
            const active = current === item.href;
            return (
              <a key={item.href} href={accessible ? item.href : "#"} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"11px 20px", textDecoration:"none", background:active?"var(--accent-bg)":"transparent", borderLeft:active?"2px solid var(--accent)":"2px solid transparent", opacity:accessible?1:0.25, cursor:accessible?"pointer":"not-allowed", transition:"background 0.15s" }}>
                <Icon size={16} color={active?"var(--accent)":accessible?"var(--text-3)":"var(--text-4)"} strokeWidth={active?2.5:1.8}/>
                <span style={{ fontFamily:"Inter,sans-serif", fontSize:"13px", fontWeight:active?600:400, color:active?"var(--text-1)":accessible?"var(--text-2)":"var(--text-4)", letterSpacing:"-0.01em" }}>{item.label}</span>
                {active && <ChevronRight size={13} color="var(--accent)" style={{ marginLeft:"auto" }}/>}
              </a>
            );
          })}
        </nav>
        <div style={{ padding:"16px 20px", borderTop:"1px solid var(--border)" }}>
          <button onClick={toggle} style={{ display:"flex", alignItems:"center", gap:"8px", width:"100%", background:"var(--bg-2)", border:"1px solid var(--border)", padding:"9px 12px", cursor:"pointer", marginBottom:"10px" }}>
            {theme==="dark"?<Sun size={13} color="var(--text-3)"/>:<Moon size={13} color="var(--text-3)"/>}
            <span style={{ fontFamily:"DM Mono,monospace", fontSize:"10px", letterSpacing:"0.08em", color:"var(--text-3)" }}>{theme==="dark"?"Light Mode":"Dark Mode"}</span>
          </button>
          {mounted && publicKey ? (
            <div style={{ background:"var(--bg-2)", border:"1px solid var(--border)", padding:"12px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"6px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                  <Wallet size={11} color="var(--text-4)"/>
                  <span style={{ fontFamily:"DM Mono,monospace", fontSize:"9px", color:"var(--text-4)", letterSpacing:"0.08em", textTransform:"uppercase" }}>Connected</span>
                </div>
                <button onClick={()=>setShowDisconnect(true)} style={{ display:"flex", alignItems:"center", gap:"4px", background:"none", border:"none", cursor:"pointer", padding:"2px 6px" }}>
                  <LogOut size={11} color="var(--text-4)"/>
                  <span style={{ fontFamily:"DM Mono,monospace", fontSize:"9px", color:"var(--text-4)", letterSpacing:"0.06em" }}>Sign out</span>
                </button>
              </div>
              <div style={{ fontFamily:"DM Mono,monospace", fontSize:"10px", color:"var(--text-2)", marginBottom:"3px", fontWeight:500 }}>{shortAddr(publicKey.toBase58(),8)}</div>
              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                {loading?<Loader2 size={10} color="var(--text-4)" style={{ animation:"spin 1s linear infinite" }}/>:<div style={{ width:"6px", height:"6px", borderRadius:"50%", background:role!=="none"?"var(--accent)":"var(--text-4)", flexShrink:0 }}/>}
                <span style={{ fontFamily:"DM Mono,monospace", fontSize:"10px", color:ROLE_COLORS[role], letterSpacing:"0.04em", fontWeight:600 }}>{loading?"Detecting...":ROLE_LABELS[role]}</span>
              </div>
            </div>
          ) : mounted && <WalletMultiButton style={{ width:"100%", justifyContent:"center", fontSize:"11px" }}/>}
        </div>
      </aside>
      {showDisconnect && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(4px)" }}>
          <div style={{ background:"var(--bg-1)", border:"1px solid var(--border-2)", padding:"32px", maxWidth:"360px", width:"100%" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px" }}><LogOut size={18} color="var(--text-2)"/><span style={{ fontFamily:"Inter,sans-serif", fontSize:"16px", fontWeight:700, color:"var(--text-1)" }}>Sign Out</span></div>
            <p style={{ fontFamily:"DM Mono,monospace", fontSize:"12px", color:"var(--text-2)", lineHeight:1.7, marginBottom:"24px" }}>Disconnect your wallet from Leyfis Admin Console?</p>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={handleDisconnect} style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", letterSpacing:"0.08em", textTransform:"uppercase", background:"var(--text-1)", color:"var(--bg)", border:"none", padding:"11px 20px", cursor:"pointer", fontWeight:700, flex:1 }}>Sign Out</button>
              <button onClick={()=>setShowDisconnect(false)} style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", letterSpacing:"0.08em", textTransform:"uppercase", background:"transparent", color:"var(--text-3)", border:"1px solid var(--border)", padding:"11px 20px", cursor:"pointer", flex:1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <main style={{ flex:1, marginLeft:"var(--sidebar-w)", minHeight:"100vh", background:"var(--bg)" }}>
        <div style={{ position:"sticky", top:0, zIndex:200, padding:"14px 36px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--bg-1)", borderBottom:"1px solid var(--border)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            {(()=>{ const item=NAV.find(n=>n.href===current); if(!item) return null; const Icon=item.icon; return <><Icon size={15} color="var(--text-3)"/><span style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", color:"var(--text-3)", letterSpacing:"0.12em", textTransform:"uppercase" }}>{item.label}</span></>; })()}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:"var(--accent)" }}/>
            <span style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.06em" }}>Solana devnet</span>
          </div>
        </div>
        <div style={{ padding:"40px" }}>{children}</div>
      </main>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
