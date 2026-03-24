"use client";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AdminRole, shortAddr, GATE_PROGRAM_ID, VAULT_PROGRAM_ID } from "@leyfis/shared";

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin", vault_operator: "Vault Operator",
  kyc_issuer: "KYC Issuer", compliance_auditor: "Compliance Auditor", none: "No Role",
};

const SCREENS = [
  { num:"/01", title:"Protocol Overview",    role:"Super Admin",        href:"/protocol",  roles:["super_admin"] },
  { num:"/02", title:"Vault Dashboard",      role:"Vault Operator",     href:"/vault",     roles:["vault_operator","super_admin"] },
  { num:"/03", title:"Issue Attestation",    role:"KYC Issuer",         href:"/issue",     roles:["kyc_issuer","super_admin"] },
  { num:"/04", title:"Attestation Registry", role:"KYC Issuer",         href:"/registry",  roles:["kyc_issuer","super_admin"] },
  { num:"/05", title:"Audit Log",            role:"All Roles",          href:"/audit",     roles:["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
  { num:"/06", title:"Live Gate Feed",       role:"All Roles",          href:"/feed",      roles:["super_admin","vault_operator","kyc_issuer","compliance_auditor"] },
  { num:"/07", title:"Compliance Export",    role:"Operator / Auditor", href:"/export",    roles:["vault_operator","compliance_auditor","super_admin"] },
];

const mono = { fontFamily:"'DM Mono',monospace" };
const rule = { borderColor:"rgba(232,238,246,0.1)" };

export default function AdminHome() {
  const { publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // TODO: detect role from IssuerRegistry on-chain
  const role: AdminRole = "none";
  if (!mounted) return null;

  if (!publicKey) return (
    <main style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{position:"fixed",inset:"16px",border:"1px solid rgba(232,238,246,0.1)",pointerEvents:"none",zIndex:500}}/>
      <div style={{maxWidth:"560px",padding:"40px"}}>
        <div style={{...mono,fontSize:"10px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.1em",marginBottom:"32px"}}>/00</div>
        <h1 style={{fontSize:"clamp(40px,5vw,72px)",fontWeight:700,letterSpacing:"-0.02em",lineHeight:1.0,marginBottom:"24px"}}>Connect your<br/>wallet to continue.</h1>
        <p style={{...mono,fontSize:"11px",lineHeight:1.9,color:"rgba(232,238,246,0.35)",marginBottom:"40px",letterSpacing:"0.04em"}}>
          Your wallet is your credential. Leyfis detects your role automatically and routes you to the correct operational surface.
        </p>
        <WalletMultiButton />
      </div>
    </main>
  );

  return (
    <main style={{minHeight:"100vh"}}>
      <div style={{position:"fixed",inset:"16px",border:"1px solid rgba(232,238,246,0.1)",pointerEvents:"none",zIndex:500}}/>
      <nav style={{position:"fixed",top:"16px",left:"16px",right:"16px",zIndex:400,padding:"18px 40px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(232,238,246,0.1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <svg width="20" height="20" viewBox="0 0 56 56" fill="none">
            <rect x="8" y="16" width="7" height="32" fill="#E8EEF6"/>
            <rect x="41" y="16" width="7" height="32" fill="#E8EEF6"/>
            <rect x="8" y="13" width="40" height="6" fill="#E8EEF6"/>
            <rect x="18" y="19" width="20" height="29" fill="#000"/>
            <rect x="18" y="44" width="20" height="1.5" fill="#8899BB"/>
          </svg>
          <span style={{fontFamily:"Arial,sans-serif",fontSize:"14px",fontWeight:700,letterSpacing:"0.22em"}}>LEYFIS</span>
          <span style={{...mono,fontSize:"9px",letterSpacing:"0.16em",color:"rgba(232,238,246,0.3)",textTransform:"uppercase",border:"1px solid rgba(232,238,246,0.15)",padding:"3px 8px"}}>Admin</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"24px"}}>
          <a href="https://app.leyfis.io" style={{...mono,fontSize:"10px",letterSpacing:"0.1em",color:"rgba(232,238,246,0.4)",textTransform:"uppercase"}}>Public Demo</a>
          <WalletMultiButton />
        </div>
      </nav>

      <section style={{padding:"120px 60px 60px"}}>
        <div style={{border:"1px solid rgba(232,238,246,0.1)",padding:"40px",marginBottom:"40px"}}>
          <div style={{...mono,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"16px"}}>/00 ? Role Detection</div>
          <div style={{...mono,fontSize:"14px",color:"rgba(232,238,246,0.6)",marginBottom:"16px"}}>{shortAddr(publicKey.toBase58(), 8)}</div>
          <div style={{display:"inline-flex",...mono,fontSize:"10px",letterSpacing:"0.12em",textTransform:"uppercase",padding:"6px 14px",borderRadius:"2px",marginBottom:"16px",background:"rgba(232,238,246,0.05)",color:"rgba(232,238,246,0.3)",border:"1px solid rgba(232,238,246,0.1)"}}>
            {ROLE_LABELS[role]}
          </div>
          <div style={{...mono,fontSize:"11px",color:"rgba(232,238,246,0.35)",lineHeight:1.7}}>
            {role === "none" ? "This wallet is not registered in the Leyfis protocol. Contact your Super Admin." : "Role detected. Select a screen below."}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"2px",marginBottom:"40px"}}>
          {SCREENS.map(s => {
            const locked = !s.roles.includes(role);
            return (
              <a key={s.num} href={locked ? "#" : s.href} style={{border:"1px solid rgba(232,238,246,0.1)",padding:"28px 24px",display:"flex",flexDirection:"column",gap:"8px",opacity:locked?0.4:1,cursor:locked?"not-allowed":"pointer",textDecoration:"none"}}>
                <span style={{...mono,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.1em"}}>{s.num}</span>
                <span style={{fontSize:"14px",fontWeight:700,letterSpacing:"-0.01em",textTransform:"uppercase"}}>{s.title}</span>
                <span style={{...mono,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.08em"}}>{s.role}</span>
                <span style={{...mono,fontSize:"9px",color:locked?"rgba(232,238,246,0.2)":"#1B4FD8",marginTop:"auto",letterSpacing:"0.1em"}}>{locked?"Locked":"?"}</span>
              </a>
            );
          })}
        </div>

        <div style={{display:"flex",gap:"48px",padding:"28px 0",borderTop:"1px solid rgba(232,238,246,0.1)"}}>
          {[["Gate Program",shortAddr(GATE_PROGRAM_ID,8)],["Test Vault",shortAddr(VAULT_PROGRAM_ID,8)],["Network","devnet"]].map(([l,v]) => (
            <div key={l}>
              <div style={{...mono,fontSize:"9px",letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(232,238,246,0.3)",marginBottom:"4px"}}>{l}</div>
              <div style={{...mono,fontSize:"12px",color:"rgba(232,238,246,0.6)"}}>{v}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
