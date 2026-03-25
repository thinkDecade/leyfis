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
  none:"This wallet is not registered. Contact your Super Admin.",
};

const ROLE_BADGE: Record<string,{bg:string;color:string;border:string}> = {
  super_admin:      {bg:"rgba(27,79,216,0.12)",  color:"#1B4FD8", border:"rgba(27,79,216,0.3)"},
  vault_operator:   {bg:"rgba(27,79,216,0.12)",  color:"#1B4FD8", border:"rgba(27,79,216,0.3)"},
  kyc_issuer:       {bg:"rgba(27,79,216,0.12)",  color:"#1B4FD8", border:"rgba(27,79,216,0.3)"},
  compliance_auditor:{bg:"rgba(136,153,187,0.12)",color:"#8899BB",border:"rgba(136,153,187,0.3)"},
  none:             {bg:"rgba(61,80,112,0.12)",  color:"#3D5070", border:"rgba(61,80,112,0.3)"},
};

const ROLE_LABELS: Record<string,string> = {
  super_admin:"Super Admin", vault_operator:"Vault Operator",
  kyc_issuer:"KYC Issuer", compliance_auditor:"Compliance Auditor", none:"No Role",
};

const m = {fontFamily:"'DM Mono',monospace"};

const FEATURES = [
  {icon:"?", title:"Protocol-level enforcement", desc:"7-check validation on every vault interaction"},
  {icon:"?", title:"Role-gated access",           desc:"Wallet-based auth with on-chain role detection"},
  {icon:"?", title:"Immutable audit trail",        desc:"Every gate call recorded permanently on-chain"},
  {icon:"?", title:"FATF R.16 compliant",          desc:"One-click CSV export for regulatory reporting"},
];

export default function AdminHome() {
  const {publicKey} = useWallet();
  const [mounted,setMounted]=useState(false); useEffect(()=>setMounted(true),[]);
  const role = useRole();

  if (!mounted) return null;

  // ?? CONNECT PAGE (unauthenticated) ??????????????????????????????????????
  if (!publicKey) return (
    <div style={{minHeight:"100vh",display:"grid",gridTemplateColumns:"1fr 1fr",background:"#000"}}>

      {/* LEFT ? Brand panel */}
      <div style={{position:"relative",padding:"48px",display:"flex",flexDirection:"column",justifyContent:"space-between",borderRight:"1px solid rgba(232,238,246,0.06)",overflow:"hidden"}}>
        {/* Background grid */}
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(27,79,216,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(27,79,216,0.03) 1px,transparent 1px)",backgroundSize:"40px 40px",pointerEvents:"none"}}/>
        {/* Glow */}
        <div style={{position:"absolute",top:"-100px",left:"-100px",width:"400px",height:"400px",background:"radial-gradient(circle,rgba(27,79,216,0.08) 0%,transparent 70%)",pointerEvents:"none"}}/>

        {/* Logo */}
        <div style={{position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px"}}>
            <svg width="24" height="24" viewBox="0 0 56 56" fill="none">
              <rect x="8" y="16" width="7" height="32" fill="#E8EEF6"/>
              <rect x="41" y="16" width="7" height="32" fill="#E8EEF6"/>
              <rect x="8" y="13" width="40" height="6" fill="#E8EEF6"/>
              <rect x="18" y="19" width="20" height="29" fill="#000"/>
              <rect x="18" y="44" width="20" height="1.5" fill="#8899BB"/>
            </svg>
            <span style={{fontFamily:"Arial,sans-serif",fontSize:"16px",fontWeight:700,letterSpacing:"0.22em",color:"#E8EEF6"}}>LEYFIS</span>
          </div>
          <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.14em",textTransform:"uppercase"}}>Institutional Operations Console</div>
        </div>

        {/* Main headline */}
        <div style={{position:"relative"}}>
          <div style={{...m,fontSize:"9px",color:"#1B4FD8",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"20px",display:"flex",alignItems:"center",gap:"8px"}}>
            <span style={{display:"block",width:"16px",height:"1px",background:"#1B4FD8"}}/>
            Compliance infrastructure for institutional DeFi
          </div>
          <h1 style={{fontSize:"clamp(32px,3.5vw,52px)",fontWeight:700,letterSpacing:"-0.02em",lineHeight:1.1,marginBottom:"20px",color:"#E8EEF6"}}>
            The gateway to<br/>
            <span style={{color:"#1B4FD8"}}>institutional</span><br/>
            DeFi access.
          </h1>
          <p style={{...m,fontSize:"11px",color:"rgba(232,238,246,0.4)",lineHeight:1.9,maxWidth:"420px",letterSpacing:"0.04em"}}>
            Connect your registered wallet to access the Leyfis operations console. Role detection is automatic ? your wallet determines your access level.
          </p>
        </div>

        {/* Feature list */}
        <div style={{position:"relative",display:"flex",flexDirection:"column",gap:"16px"}}>
          {FEATURES.map((f,i) => (
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"16px",padding:"16px",border:"1px solid rgba(232,238,246,0.06)",background:"rgba(232,238,246,0.02)"}}>
              <span style={{fontSize:"16px",color:"#1B4FD8",flexShrink:0,marginTop:"1px"}}>{f.icon}</span>
              <div>
                <div style={{fontSize:"12px",fontWeight:700,letterSpacing:"-0.01em",marginBottom:"3px",color:"#E8EEF6"}}>{f.title}</div>
                <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.35)",letterSpacing:"0.04em"}}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom meta */}
        <div style={{position:"relative",display:"flex",gap:"24px"}}>
          {[["Gate Program",shortAddr(GATE_PROGRAM_ID,6)],["Network","Solana devnet"]].map(([l,v])=>(
            <div key={l}>
              <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.25)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"3px"}}>{l}</div>
              <div style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.45)"}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT ? Connect panel */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"48px",position:"relative"}}>
        <div style={{width:"100%",maxWidth:"380px"}}>

          {/* Card */}
          <div style={{border:"1px solid rgba(232,238,246,0.1)",background:"rgba(232,238,246,0.02)",padding:"40px",marginBottom:"24px"}}>
            <div style={{textAlign:"center",marginBottom:"32px"}}>
              <div style={{width:"48px",height:"48px",border:"1px solid rgba(232,238,246,0.1)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",background:"rgba(27,79,216,0.06)"}}>
                <svg width="20" height="20" viewBox="0 0 56 56" fill="none">
                  <rect x="8" y="16" width="7" height="32" fill="#1B4FD8"/>
                  <rect x="41" y="16" width="7" height="32" fill="#1B4FD8"/>
                  <rect x="8" y="13" width="40" height="6" fill="#1B4FD8"/>
                  <rect x="18" y="19" width="20" height="29" fill="#000"/>
                  <rect x="18" y="44" width="20" height="1.5" fill="#1B4FD8"/>
                </svg>
              </div>
              <h2 style={{fontSize:"20px",fontWeight:700,letterSpacing:"-0.02em",marginBottom:"8px"}}>Access Admin Console</h2>
              <p style={{...m,fontSize:"10px",color:"rgba(232,238,246,0.4)",lineHeight:1.7,letterSpacing:"0.04em"}}>Connect a registered institutional wallet to continue</p>
            </div>

            {/* Divider */}
            <div style={{height:"1px",background:"rgba(232,238,246,0.06)",marginBottom:"28px",position:"relative"}}>
              <span style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",...m,fontSize:"9px",color:"rgba(232,238,246,0.25)",background:"#000",padding:"0 12px",letterSpacing:"0.1em",textTransform:"uppercase",whiteSpace:"nowrap"}}>
                Connect Wallet
              </span>
            </div>

            <div style={{display:"flex",justifyContent:"center",marginBottom:"24px"}}>
              <WalletMultiButton />
            </div>

            {/* Role pills */}
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.25)",letterSpacing:"0.1em",textTransform:"uppercase",textAlign:"center",marginBottom:"4px"}}>Registered roles</div>
              {[
                {role:"Super Admin",       desc:"Full protocol control"},
                {role:"Vault Operator",    desc:"Configure and monitor vaults"},
                {role:"KYC Issuer",        desc:"Issue on-chain credentials"},
                {role:"Compliance Auditor",desc:"Read-only audit access"},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",border:"1px solid rgba(232,238,246,0.06)",background:"rgba(232,238,246,0.01)"}}>
                  <span style={{fontSize:"11px",fontWeight:600,color:"rgba(232,238,246,0.7)"}}>{r.role}</span>
                  <span style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.04em"}}>{r.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div style={{textAlign:"center"}}>
            <p style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.25)",lineHeight:1.8,letterSpacing:"0.04em"}}>
              Your wallet is your credential. No passwords.<br/>
              Role detection is automatic via on-chain registry.
            </p>
            <div style={{height:"1px",background:"rgba(232,238,246,0.06)",margin:"16px 0"}}/>
            <a href="http://localhost:3000" style={{...m,fontSize:"9px",color:"rgba(27,79,216,0.6)",letterSpacing:"0.1em",textTransform:"uppercase",textDecoration:"none"}}>
              View Public Demo
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  // ?? DASHBOARD (authenticated) ????????????????????????????????????????????
  return (
    <AdminShell current="/">
      <div style={{marginBottom:"32px"}}>
        <div style={{...m,fontSize:"9px",color:"rgba(232,238,246,0.3)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"16px"}}>/00 ? Dashboard</div>
        <div style={{display:"flex",alignItems:"center",gap:"16px",marginBottom:"8px"}}>
          <h1 style={{fontSize:"clamp(28px,3vw,40px)",fontWeight:700,letterSpacing:"-0.02em"}}>Welcome back.</h1>
          <div style={{...m,fontSize:"9px",padding:"4px 12px",background:ROLE_BADGE[role].bg,color:ROLE_BADGE[role].color,border:`1px solid ${ROLE_BADGE[role].border}`,letterSpacing:"0.1em",textTransform:"uppercase"}}>
            {ROLE_LABELS[role]}
          </div>
        </div>
        <div style={{...m,fontSize:"11px",color:"rgba(232,238,246,0.4)",lineHeight:1.7}}>{ROLE_DESCS[role]}</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"2px",marginBottom:"32px"}}>
        {SCREENS.map(s => {
          const accessible = s.roles.includes(role);
          return (
            <a key={s.num} href={accessible ? s.href : "#"}
              style={{border:"1px solid rgba(232,238,246,0.08)",padding:"24px",display:"flex",flexDirection:"column",gap:"8px",textDecoration:"none",opacity:accessible?1:0.3,cursor:accessible?"pointer":"not-allowed",transition:"border-color 0.15s"}}
              onMouseEnter={e=>{ if(accessible)(e.currentTarget as HTMLElement).style.borderColor="rgba(27,79,216,0.35)"; }}
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
          <div key={l}>
            <div style={{...m,fontSize:"9px",letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(232,238,246,0.25)",marginBottom:"4px"}}>{l}</div>
            <div style={{...m,fontSize:"11px",color:"rgba(232,238,246,0.5)"}}>{v}</div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
