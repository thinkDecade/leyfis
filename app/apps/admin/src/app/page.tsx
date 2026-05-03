"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AdminShell, useRole, ROLE_LABELS } from "@/components/AdminShell";
import { shortAddr, GATE_PROGRAM_ID, VAULT_PROGRAM_ID } from "@leyfis/shared";
import { ShieldCheck, Vault, BadgeCheck, BookOpen, ScrollText, Radio, Download, LayoutDashboard, ArrowRight, Lock, Loader2, UserSearch } from "lucide-react";

const m = { fontFamily:"DM Mono,monospace" };
const f = { fontFamily:"Inter,sans-serif" };

// All available screens with role access lists
const ALL_SCREENS = [
  { icon:Vault,      title:"Vault Dashboard",      subtitle:"Configure and monitor your vault",  href:"/vault",    roles:["super_admin","vault_operator"] },
  { icon:BadgeCheck, title:"Issue Attestation",    subtitle:"Issue on-chain KYC credentials",    href:"/issue",    roles:["super_admin","kyc_issuer"] },
  { icon:BookOpen,   title:"Attestation Registry", subtitle:"View and manage issued credentials",href:"/registry", roles:["super_admin","kyc_issuer"] },
  { icon:ScrollText, title:"Audit Log",            subtitle:"Browse immutable gate call history",href:"/audit",    roles:["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
  { icon:Radio,      title:"Live Feed",            subtitle:"Real-time gate activity monitor",   href:"/feed",     roles:["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
  { icon:Download,    title:"Compliance Export",        subtitle:"FATF R.16 CSV export for regulators",          href:"/export",   roles:["super_admin","vault_operator","compliance_auditor"] },
  { icon:UserSearch, title:"Profile Explorer",          subtitle:"Full compliance bureau profile for any wallet", href:"/profile",  roles:["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
];

const ROLE_CONTENT: Record<string,{ headline:string; desc:string }> = {
  super_admin:        { headline:"Protocol Administration", desc:"Full access. Configure vaults, manage issuers, monitor all compliance activity." },
  vault_operator:     { headline:"Vault Operations",        desc:"Configure and monitor your vault. Set compliance rules, pause the gate, and review all access activity." },
  kyc_issuer:         { headline:"Credential Issuance",     desc:"Issue and revoke on-chain attestations. Manage the credential registry for your institution." },
  compliance_auditor: { headline:"Compliance Audit",        desc:"Read-only access. Filter the audit log and export FATF R.16 compliance reports." },
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
          <div style={{ ...m, fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.10em", textTransform:"uppercase" }}>Institutional Operations Console</div>
        </div>
        <div style={{ position:"relative" }}>
          <h1 style={{ ...f, fontSize:"clamp(32px,3.5vw,48px)", fontWeight:800, letterSpacing:"-0.02em", lineHeight:1.1, marginBottom:"16px", color:"var(--text-1)" }}>The gateway to<br/><span style={{ color:"var(--accent)" }}>institutional</span><br/>DeFi access.</h1>
          <p style={{ ...f, fontSize:"14px", color:"var(--text-3)", lineHeight:1.75, maxWidth:"400px" }}>Connect your registered wallet to access the operations console. Role detection is automatic.</p>
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
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:"12px", padding:"13px 16px", border:"1px solid var(--border)", background:"var(--bg-1)" }}>
                <Icon size={14} color="var(--accent)" style={{ marginTop:"2px", flexShrink:0 }}/>
                <div>
                  <div style={{ ...f, fontSize:"13px", fontWeight:600, color:"var(--text-1)", marginBottom:"3px" }}>{item.t}</div>
                  <div style={{ ...m, fontSize:"11px", color:"var(--text-3)" }}>{item.d}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ position:"relative", display:"flex", gap:"24px" }}>
          {[["Gate", shortAddr(GATE_PROGRAM_ID,6)], ["Network","Solana devnet"]].map(([l,v]) => (
            <div key={l}>
              <div style={{ ...m, fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.10em", textTransform:"uppercase", marginBottom:"4px" }}>{l}</div>
              <div style={{ ...m, fontSize:"12px", color:"var(--text-2)" }}>{v}</div>
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
                <div style={{ width:"44px", height:"44px", background:"var(--danger-bg)", border:"1px solid var(--danger-border)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
                  <Lock size={18} color="var(--danger)"/>
                </div>
                <h2 style={{ ...f, fontSize:"18px", fontWeight:700, marginBottom:"6px", color:"var(--text-1)" }}>Wallet Not Registered</h2>
                <p style={{ ...f, fontSize:"13px", color:"var(--text-3)", lineHeight:1.65 }}>This wallet has no role in the Leyfis protocol</p>
              </div>
              <div style={{ background:"var(--bg-2)", border:"1px solid var(--border)", padding:"13px 16px", marginBottom:"20px" }}>
                <div style={{ ...m, fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"5px" }}>Connected wallet</div>
                <div style={{ ...m, fontSize:"12px", color:"var(--text-2)", fontWeight:500 }}>{walletAddr}</div>
              </div>
              <p style={{ ...f, fontSize:"13px", color:"var(--text-3)", lineHeight:1.75, marginBottom:"20px" }}>Contact your administrator to have this wallet registered as a Vault Operator, KYC Issuer, or Compliance Auditor.</p>
              <button
                onClick={onDisconnect}
                style={{ ...m, fontSize:"11px", letterSpacing:"0.08em", textTransform:"uppercase", background:"var(--bg-2)", color:"var(--text-2)", border:"1px solid var(--border)", padding:"12px 20px", cursor:"pointer", width:"100%", fontWeight:600 }}
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
                <h2 style={{ ...f, fontSize:"18px", fontWeight:700, marginBottom:"6px", color:"var(--text-1)" }}>Access Operations Console</h2>
                <p style={{ ...f, fontSize:"13px", color:"var(--text-3)", lineHeight:1.65 }}>Connect a registered institutional wallet</p>
              </div>
              <div style={{ display:"flex", justifyContent:"center", marginBottom:"24px" }}><WalletMultiButton/></div>
              <div style={{ display:"flex", flexDirection:"column", gap:"1px", background:"var(--border)" }}>
                <div style={{ ...m, fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.08em", textTransform:"uppercase", padding:"10px 14px", background:"var(--bg-2)" }}>Registered roles</div>
                {[["Vault Operator","Configure vaults"],["KYC Issuer","Issue credentials"],["Compliance Auditor","Read-only audit"]].map(([r,d]) => (
                  <div key={r} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 14px", background:"var(--bg-1)" }}>
                    <span style={{ ...f, fontSize:"13px", fontWeight:500, color:"var(--text-2)" }}>{r}</span>
                    <span style={{ ...m, fontSize:"11px", color:"var(--text-4)" }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ textAlign:"center", marginTop:"20px" }}>
            <p style={{ ...m, fontSize:"11px", color:"var(--text-4)", lineHeight:1.8 }}>Your wallet is your credential. No passwords.<br/>Role detection via on-chain registry.</p>
            <div style={{ height:"1px", background:"var(--border)", margin:"16px 0" }}/>
            <a href="https://leyfis-app.netlify.app" style={{ ...m, fontSize:"11px", color:"var(--accent)", letterSpacing:"0.08em", textTransform:"uppercase" }}>View Public Demo →</a>
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
      {/* Page header */}
      <div style={{ marginBottom:"36px" }}>
        <div style={{ ...m, fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"16px" }}>00 — OVERVIEW</div>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"16px", marginBottom:"10px" }}>
          <h1 style={{ ...f, fontSize:"28px", fontWeight:700, letterSpacing:"-0.025em", color:"var(--text-1)", lineHeight:1.15 }}>{content.headline}</h1>
          <span style={{ ...m, fontSize:"11px", padding:"5px 12px", background:"var(--accent-bg)", color:"var(--accent)", border:"1px solid var(--accent-border)", letterSpacing:"0.10em", textTransform:"uppercase", fontWeight:600, flexShrink:0, marginTop:"4px" }}>{ROLE_LABELS[role]}</span>
        </div>
        <p style={{ ...f, fontSize:"14px", color:"var(--text-3)", lineHeight:1.65, maxWidth:"540px" }}>{content.desc}</p>
      </div>

      {/* Module grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1px", marginBottom:"36px", background:"var(--border)" }}>
        {screens.map(s => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href}
              style={{ padding:"24px 28px", display:"flex", flexDirection:"column", gap:"16px", textDecoration:"none", background:"var(--bg-1)", transition:"background 0.12s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="var(--bg-2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="var(--bg-1)"; }}
            >
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ width:"34px", height:"34px", background:"var(--accent-bg)", border:"1px solid var(--accent-border)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon size={15} color="var(--accent)"/>
                </div>
                <ArrowRight size={14} color="var(--text-4)" style={{ marginTop:"2px" }}/>
              </div>
              <div>
                <div style={{ ...f, fontSize:"14px", fontWeight:600, color:"var(--text-1)", marginBottom:"5px", letterSpacing:"-0.01em" }}>{s.title}</div>
                <div style={{ ...m, fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.02em" }}>{s.subtitle}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Protocol status strip */}
      <div style={{ display:"flex", gap:"0", padding:"18px 0", borderTop:"1px solid var(--border)" }}>
        {[["Gate Program",shortAddr(GATE_PROGRAM_ID,8)],["Test Vault",shortAddr(VAULT_PROGRAM_ID,8)],["Network","Solana devnet"],["Wallet",shortAddr(publicKey.toBase58(),8)]].map(([l,v],i) => (
          <div key={l} style={{ flex:1, paddingRight:"28px", borderRight:i<3?"1px solid var(--border)":"none", marginRight:i<3?"28px":"0" }}>
            <div style={{ ...m, fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.10em", textTransform:"uppercase", marginBottom:"5px" }}>{l}</div>
            <div style={{ ...m, fontSize:"12px", color:"var(--text-2)", fontWeight:500 }}>{v}</div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
