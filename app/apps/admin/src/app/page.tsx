"use client";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AdminShell, useRole } from "@/components/AdminShell";
import { shortAddr, GATE_PROGRAM_ID, VAULT_PROGRAM_ID } from "@leyfis/shared";

const SCREENS = [
  {num:"/01",title:"Protocol Overview",  role:"Super Admin",       href:"/protocol",roles:["super_admin"]},
  {num:"/02",title:"Vault Dashboard",    role:"Vault Operator",    href:"/vault",   roles:["super_admin","vault_operator"]},
  {num:"/03",title:"Issue Attestation",  role:"KYC Issuer",        href:"/issue",   roles:["super_admin","kyc_issuer"]},
  {num:"/04",title:"Attestation Registry",role:"KYC Issuer",       href:"/registry",roles:["super_admin","kyc_issuer"]},
  {num:"/05",title:"Audit Log",          role:"All Roles",         href:"/audit",   roles:["super_admin","vault_operator","kyc_issuer","compliance_auditor"]},
  {num:"/06",title:"Live Feed",          role:"All Roles",         href:"/feed",    roles:["super_admin","vault_operator","kyc_issuer","compliance_auditor"]},
  {num:"/07",title:"Export",             role:"Operator/Auditor",  href:"/export",  roles:["super_admin","vault_operator","compliance_auditor"]},
];

const ROLE_DESCS: Record<string,string> = {
  super_admin:"Full protocol authority. Register operators, issuers, and manage all vaults.",
  vault_operator:"Configure and monitor your vault. Set compliance rules and manage access.",
  kyc_issuer:"Issue and revoke on-chain attestations. Manage the credential registry.",
  compliance_auditor:"Read-only access. Filter audit log and export FATF R.16 reports.",
  none:"This wallet is not registered. Connect a registered wallet to access the admin panel.",
};

const m = {fontFamily:"'DM Mono',monospace"};

export default function AdminHome() {
  const {publicKey} = useWallet();
  const [mounted,setMounted]=useState(false); useEffect(()=>setMounted(true),[]);
  const role = useRole();

  if (!mounted) return null;

  if (!publicKey) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#000"}}>
      <div style={{position:"fixed",inset:"16px",border:"1px solid rgba(232,238,246,0.08)",pointerEvents:"none",zIndex:500}}/>
      <div style={{maxWidth:"480px",padding:"40px",textAlign:"center"}}>
        <svg width="32" height="32" viewBox="0 0 56 56" fill="none" style={{marginBottom:"24px"}}>
          <rect x="8" y="16" width="7" height="32" fill="#E8EEF6"/><rect x="41" y="16" width="7" height="32" fill="#E8EEF6"/>
          <rect x="8" y="13" width="40" height="6" fill="#E8EEF6"/><rect x="18" y="19" width="20" height="29" fill="#000"/>
          <rect x="18" y="44" width="20" height="1.5" fill="#8899BB"/>
        </svg>
        <div style={{fontFamily:"Arial,sans-serif",fontSize:"11px",fontWeight:700,letterSpacing:"0.22em",color:"rgba(232,238,246,0.4)",marginBottom:"32px"}}>LEYFIS ADMIN</div>
        <h1 style={{fontSize:"clamp(32px,4vw,48px)",fontWeight:700,letterSpacing:"-0.02em",lineHeight:1.1,marginBottom:"16px"}}>Connect your wallet to continue.</h1>
        <p style={{...m,fontSize:"11px",color:"rgba(232,238,246,0.35)",lineHeight:1.8,marginBottom:"32px",letterSpacing:"0.04em"}}>Your wallet is your credential. Leyfis detects your role automatically.</p>
        <WalletMultiButton />
        <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.2)",marginTop:"24px",lineHeight:1.8}}>
          Registered roles: Super Admin ? Vault Operator ? KYC Issuer ? Compliance Auditor
        </div>
      </div>
    </div>
  );

  return (
    <AdminShell current="/">
      <div style={{marginBottom:"32px"}}>
        <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"16px"}}>/00 ? Dashboard</div>
        <h1 style={{fontSize:"clamp(28px,3vw,40px)",fontWeight:700,letterSpacing:"-0.02em",marginBottom:"8px"}}>Welcome back.</h1>
        <div style={{...m,fontSize:"11px",color:"rgba(232,238,246,0.4)",lineHeight:1.7}}>{ROLE_DESCS[role]}</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"2px",marginBottom:"32px"}}>
        {SCREENS.map(s => {
          const accessible = s.roles.includes(role);
          return (
            <a key={s.num} href={accessible ? s.href : "#"} style={{border:"1px solid rgba(232,238,246,0.08)",padding:"24px",display:"flex",flexDirection:"column",gap:"8px",textDecoration:"none",opacity:accessible?1:0.3,cursor:accessible?"pointer":"not-allowed",transition:"border-color 0.15s, background 0.15s"}}
              onMouseEnter={e=>{ if(accessible)(e.currentTarget as HTMLElement).style.borderColor="rgba(27,79,216,0.3)"; }}
              onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.borderColor="rgba(232,238,246,0.08)"; }}>
              <span style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.1em"}}>{s.num}</span>
              <span style={{fontSize:"13px",fontWeight:700,letterSpacing:"-0.01em",textTransform:"uppercase",color:"#E8EEF6"}}>{s.title}</span>
              <span style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.06em"}}>{s.role}</span>
              <span style={{...m,fontSize:"9px",color:accessible?"#1B4FD8":"rgba(232,238,246,0.2)",marginTop:"auto",letterSpacing:"0.1em"}}>{accessible?"Open ?":"Locked"}</span>
            </a>
          );
        })}
      </div>

      <div style={{display:"flex",gap:"32px",padding:"20px 0",borderTop:"1px solid rgba(232,238,246,0.06)"}}>
        {[["Gate Program",shortAddr(GATE_PROGRAM_ID,8)],["Test Vault",shortAddr(VAULT_PROGRAM_ID,8)],["Network","devnet"],["Wallet",shortAddr(publicKey.toBase58(),8)]].map(([l,v])=>(
          <div key={l}><div style={{...m,fontSize:"9px",letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(232,238,246,0.25)",marginBottom:"4px"}}>{l}</div><div style={{...m,fontSize:"11px",color:"rgba(232,238,246,0.5)"}}>{v}</div></div>
        ))}
      </div>
    </AdminShell>
  );
}
