"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AdminShell, useRole, ROLE_LABELS } from "@/components/AdminShell";
import { shortAddr, GATE_PROGRAM_ID, VAULT_PROGRAM_ID } from "@leyfis/shared";
import { ShieldCheck, Vault, BadgeCheck, BookOpen, ScrollText, Radio, Download, LayoutDashboard, ArrowRight, Lock, Loader2 } from "lucide-react";

const m = { fontFamily:"DM Mono,monospace" };
const f = { fontFamily:"Inter,sans-serif" };

// All available screens with role access lists
const ALL_SCREENS = [
  { icon:Vault,      title:"Vault Dashboard",      subtitle:"Configure and monitor your vault",  href:"/vault",    roles:["super_admin","vault_operator"] },
  { icon:BadgeCheck, title:"Issue Attestation",    subtitle:"Issue on-chain KYC credentials",    href:"/issue",    roles:["super_admin","kyc_issuer"] },
  { icon:BookOpen,   title:"Attestation Registry", subtitle:"View and manage issued credentials",href:"/registry", roles:["super_admin","kyc_issuer"] },
  { icon:ScrollText, title:"Audit Log",            subtitle:"Browse immutable gate call history",href:"/audit",    roles:["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
  { icon:Radio,      title:"Live Feed",            subtitle:"Real-time gate activity monitor",   href:"/feed",     roles:["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
  { icon:Download,   title:"Compliance Export",    subtitle:"FATF R.16 CSV export for regulators",href:"/export",  roles:["super_admin","vault_operator","compliance_auditor"] },
];

const ROLE_CONTENT: Record<string,{ headline:string; desc:string }> = {
  super_admin:        { headline:"Protocol Admin",    desc:"Full access. Configure vaults, manage issuers, monitor all compliance activity." },
  vault_operator:     { headline:"Vault Operator",    desc:"Configure and monitor your vault. Set compliance rules, pause the gate, and review all access activity." },
  kyc_issuer:         { headline:"KYC Issuer",        desc:"Issue and revoke on-chain attestations. Manage the credential registry for your institution." },
  compliance_auditor: { headline:"Compliance Auditor",desc:"Read-only access. Filter the audit log and export FATF R.16 compliance reports." },
};

// Connect / rejected screen shown before entering the shell
function ConnectScreen({ rejected, walletAddr, onDisconnect }: { rejected?: boolean; walletAddr?: string; onDisconnect?: () => void }) {
  return (
    <div style={{ minHeight:"100vh", display:"grid", gridTemplateColumns:"1fr 1fr", background:"var(--bg)" }}>
      {/* Left panel */}
      <div style={{ position:"relative", padding:"48px", display:"flex", flexDirection:"column", justifyContent:"space-between", borderRight:"1px solid var(--border)", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)", backgroundSize:"40px 40px", pointerEvents:"none", opacity:0.4 }}/>
        <div style={{ position:"relative" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px" }}>
            <div style={{ width:"28px", height:"28px", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="14" height="14" viewBox="0 0 56 56" fill="none"><rect x="8" y="16" width="7" height="32" fill="white"/><rect x="41" y="16" width="7" height="32" fill="white"/><rect x="8" y="13" width="40" height="6" fill="white"/><rect x="18" y="19" width="20" height="29" fill="var(--accent)"/></svg>
            </div>
            <span style={{ ...f, fontSize:"13px", fontWeight:800, letterSpacing:"0.18em", color:"var(--text-1)" }}>LEYFIS</span>
          </div>
          <div style={{ ...m, fontSize:"9px", color:"var(--text-4)", letterSpacing:"0.12em", textTransform:"uppercase" }}>Institutional Operations Console</div>
        </div>
        <div style={{ position:"relative" }}>
          <h1 style={{ ...f, fontSize:"clamp(32px,3.5vw,48px)", fontWeight:800, letterSpacing:"-0.02em", lineHeight:1.1, marginBottom:"16px", color:"var(--text-1)" }}>The gateway to<br/><span style={{ color:"var(--accent)" }}>institutional</span><br/>DeFi access.</h1>
          <p style={{ ...m, fontSize:"11px", color:"var(--text-3)", lineHeight:1.9, maxWidth:"400px" }}>Connect your registered wallet to access the operations console. Role detection is automatic.</p>
        </div>
        <div style={{ position:"relative", display:"flex", flexDirection:"column", gap:"10px" }}>
          {[
            { icon:ShieldCheck, t:"Protocol-level enforcement", d:"7-check validation on every interaction" },
            { icon:BadgeCheck,  t:"Role-gated access",          d:"Wallet-based auth with on-chain detection" },
            { icon:ScrollText,  t:"Immutable audit trail",       d:"Every gate call recorded permanently" },
            { icon:Download,    t:"FATF R.16 compliant",         d:"One-click CSV export for regulators" },
          ].map((item,i) => {
            const Icon = item.icon;
            return (
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:"12px", padding:"12px 14px", border:"1px solid var(--border)", background:"var(--bg-1)" }}>
                <Icon size={14} color="var(--accent)" style={{ marginTop:"2px", flexShrink:0 }}/>
                <div>
                  <div style={{ ...f, fontSize:"12px", fontWeight:600, color:"var(--text-1)", marginBottom:"2px" }}>{item.t}</div>
                  <div style={{ ...m, fontSize:"9px", color:"var(--text-3)" }}>{item.d}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ position:"relative", display:"flex", gap:"24px" }}>
          {[["Gate", shortAddr(GATE_PROGRAM_ID,6)], ["Network","Solana devnet"]].map(([l,v]) => (
            <div key={l}>
              <div style={{ ...m, fontSize:"9px", color:"var(--text-4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"3px" }}>{l}</div>
              <div style={{ ...m, fontSize:"10px", color:"var(--text-2)" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"48px" }}>
        <div style={{ width:"100%", maxWidth:"360px" }}>
          {rejected ? (
            // Wallet connected but not registered
            <div style={{ border:"1px solid var(--border)", background:"var(--bg-1)", padding:"36px", marginBottom:"20px" }}>
              <div style={{ textAlign:"center", marginBottom:"28px" }}>
                <div style={{ width:"44px", height:"44px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
                  <Lock size={18} color="#ef4444"/>
                </div>
                <h2 style={{ ...f, fontSize:"18px", fontWeight:700, marginBottom:"6px", color:"var(--text-1)" }}>Wallet Not Registered</h2>
                <p style={{ ...m, fontSize:"10px", color:"var(--text-3)", lineHeight:1.7 }}>This wallet has no role in the Leyfis protocol</p>
              </div>
              <div style={{ background:"var(--bg-2)", border:"1px solid var(--border)", padding:"12px 14px", marginBottom:"20px" }}>
                <div style={{ ...m, fontSize:"9px", color:"var(--text-4)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"4px" }}>Connected wallet</div>
                <div style={{ ...m, fontSize:"11px", color:"var(--text-2)", fontWeight:500 }}>{walletAddr}</div>
              </div>
              <p style={{ ...m, fontSize:"10px", color:"var(--text-3)", lineHeight:1.8, marginBottom:"20px" }}>Contact your administrator to have this wallet registered as a Vault Operator, KYC Issuer, or Compliance Auditor.</p>
              <button
                onClick={onDisconnect}
                style={{ ...m, fontSize:"10px", letterSpacing:"0.08em", textTransform:"uppercase", background:"var(--bg-2)", color:"var(--text-2)", border:"1px solid var(--border)", padding:"11px 20px", cursor:"pointer", width:"100%", fontWeight:600 }}
              >
                Try a Different Wallet
              </button>
            </div>
          ) : (
            // No wallet connected
            <div style={{ border:"1px solid var(--border)", background:"var(--bg-1)", padding:"36px", marginBottom:"20px" }}>
              <div style={{ textAlign:"center", marginBottom:"28px" }}>
                <div style={{ width:"44px", height:"44px", background:"var(--accent-bg)", border:"1px solid var(--accent-border)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
                  <LayoutDashboard size={18} color="var(--accent)"/>
                </div>
                <h2 style={{ ...f, fontSize:"18px", fontWeight:700, marginBottom:"6px", color:"var(--text-1)" }}>Access Admin Console</h2>
                <p style={{ ...m, fontSize:"10px", color:"var(--text-3)", lineHeight:1.7 }}>Connect a registered institutional wallet</p>
              </div>
              <div style={{ display:"flex", justifyContent:"center", marginBottom:"20px" }}><WalletMultiButton/></div>
              <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                <div style={{ ...m, fontSize:"9px", color:"var(--text-4)", textAlign:"center", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"4px" }}>Registered roles</div>
                {[["Vault Operator","Configure vaults"],["KYC Issuer","Issue credentials"],["Compliance Auditor","Read-only audit"]].map(([r,d]) => (
                  <div key={r} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 12px", border:"1px solid var(--border)", background:"var(--bg-2)" }}>
                    <span style={{ ...f, fontSize:"12px", fontWeight:500, color:"var(--text-2)" }}>{r}</span>
                    <span style={{ ...m, fontSize:"9px", color:"var(--text-4)" }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ textAlign:"center" }}>
            <p style={{ ...m, fontSize:"9px", color:"var(--text-4)", lineHeight:1.8 }}>Your wallet is your credential. No passwords.<br/>Role detection via on-chain registry.</p>
            <div style={{ height:"1px", background:"var(--border)", margin:"14px 0" }}/>
            <a href="https://leyfis-app.netlify.app" style={{ ...m, fontSize:"9px", color:"var(--accent)", letterSpacing:"0.08em", textTransform:"uppercase" }}>View Public Demo</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminHome() {
  const { publicKey, disconnect } = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { role, loading } = useRole();

  if (!mounted) return null;

  // No wallet connected
  if (!publicKey) return <ConnectScreen/>;

  // Role detection in progress
  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
        <Loader2 size={18} color="var(--accent)" style={{ animation:"spin 1s linear infinite" }}/>
        <span style={{ ...m, fontSize:"12px", color:"var(--text-3)", letterSpacing:"0.08em" }}>Verifying wallet role on-chain...</span>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // Wallet connected but no role
  if (role === "none") return (
    <ConnectScreen
      rejected
      walletAddr={shortAddr(publicKey.toBase58(), 10)}
      onDisconnect={() => disconnect()}
    />
  );

  // Authenticated — show role-specific dashboard
  const screens = ALL_SCREENS.filter(s => s.roles.includes(role));
  const content = ROLE_CONTENT[role];

  return (
    <AdminShell current="/">
      <div style={{ marginBottom:"28px" }}>
        <div style={{ ...m, fontSize:"9px", color:"var(--text-4)", letterSpacing:"0.16em", textTransform:"uppercase", marginBottom:"12px" }}>/00 - Dashboard</div>
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"6px" }}>
          <h1 style={{ ...f, fontSize:"26px", fontWeight:700, letterSpacing:"-0.02em", color:"var(--text-1)" }}>Welcome back.</h1>
          <span style={{ ...m, fontSize:"9px", padding:"4px 10px", background:"var(--accent-bg)", color:"var(--accent)", border:"1px solid var(--accent-border)", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:600 }}>{ROLE_LABELS[role]}</span>
        </div>
        <p style={{ ...m, fontSize:"11px", color:"var(--text-3)", lineHeight:1.6 }}>{content.desc}</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"2px", marginBottom:"28px" }}>
        {screens.map(s => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href}
              style={{ border:"1px solid var(--border)", padding:"20px 24px", display:"flex", flexDirection:"column", gap:"10px", textDecoration:"none", background:"var(--bg-1)", transition:"border-color 0.15s,background 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor="var(--accent-border)"; (e.currentTarget as HTMLElement).style.background="var(--accent-bg)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor="var(--border)"; (e.currentTarget as HTMLElement).style.background="var(--bg-1)"; }}
            >
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ width:"32px", height:"32px", background:"var(--accent-bg)", border:"1px solid var(--accent-border)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon size={14} color="var(--accent)"/>
                </div>
                <ArrowRight size={14} color="var(--text-4)"/>
              </div>
              <div>
                <div style={{ ...f, fontSize:"13px", fontWeight:600, color:"var(--text-1)", marginBottom:"3px" }}>{s.title}</div>
                <div style={{ ...m, fontSize:"9px", color:"var(--text-4)", letterSpacing:"0.04em" }}>{s.subtitle}</div>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={{ display:"flex", gap:"0", padding:"16px 0", borderTop:"1px solid var(--border)" }}>
        {[["Gate Program",shortAddr(GATE_PROGRAM_ID,8)],["Test Vault",shortAddr(VAULT_PROGRAM_ID,8)],["Network","Solana devnet"],["Wallet",shortAddr(publicKey.toBase58(),8)]].map(([l,v],i) => (
          <div key={l} style={{ flex:1, paddingRight:"24px", borderRight:i<3?"1px solid var(--border)":"none", marginRight:i<3?"24px":"0" }}>
            <div style={{ ...m, fontSize:"9px", color:"var(--text-4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"4px" }}>{l}</div>
            <div style={{ ...m, fontSize:"11px", color:"var(--text-2)", fontWeight:500 }}>{v}</div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
