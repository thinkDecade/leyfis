"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { shortAddr, GATE_PROGRAM_ID, RPC_ENDPOINT, SEEDS } from "@leyfis/shared";
import { ShieldCheck, Activity, Users, Sun, Moon, Wallet, ChevronRight, LogOut, Loader2, Lock, ExternalLink } from "lucide-react";
import { useTheme } from "./AdminShell";

const m = { fontFamily:"DM Mono,monospace" };
const f = { fontFamily:"Inter,sans-serif" };

const SA_NAV = [
  { label:"Protocol Overview",   href:"/superadmin",          icon:ShieldCheck },
  { label:"Issuers & Operators", href:"/superadmin/issuers",  icon:Users },
  { label:"Protocol Activity",   href:"/superadmin/activity", icon:Activity },
];

async function checkIsSuperAdmin(walletAddress: string): Promise<boolean> {
  try {
    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const gateProgramId = new PublicKey(GATE_PROGRAM_ID);
    const VAULT_PROGRAM = new PublicKey("88x1hxWW6mMDpQQwuR3sCDgnmbHwHmQBdWYZQhcedNaJ");
    const [vaultConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.VAULT_CONFIG), VAULT_PROGRAM.toBuffer()],
      gateProgramId
    );
    const accountInfo = await connection.getAccountInfo(vaultConfigPDA);
    if (!accountInfo) return false;
    const authority = new PublicKey(accountInfo.data.slice(8, 40)).toBase58();
    return authority === walletAddress;
  } catch { return false; }
}

function AccessDenied({ reason }: { reason: "no_wallet"|"wrong_wallet" }) {
  const { toggle, theme } = useTheme();
  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px" }}>
      <div style={{ position:"fixed", inset:0, backgroundImage:"linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)", backgroundSize:"48px 48px", pointerEvents:"none", opacity:0.3 }}/>
      <div style={{ position:"relative", width:"100%", maxWidth:"440px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"48px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{ width:"28px", height:"28px", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="14" height="14" viewBox="0 0 56 56" fill="none"><rect x="8" y="16" width="7" height="32" fill="white"/><rect x="41" y="16" width="7" height="32" fill="white"/><rect x="8" y="13" width="40" height="6" fill="white"/><rect x="18" y="19" width="20" height="29" fill="var(--accent)"/></svg>
            </div>
            <span style={{ ...f, fontSize:"12px", fontWeight:800, letterSpacing:"0.2em", color:"var(--text-1)" }}>LEYFIS</span>
          </div>
          <button onClick={toggle} style={{ background:"none", border:"1px solid var(--border)", padding:"6px 10px", cursor:"pointer", display:"flex", alignItems:"center" }}>
            {theme==="dark"?<Sun size={12} color="var(--text-3)"/>:<Moon size={12} color="var(--text-3)"/>}
          </button>
        </div>
        <div style={{ width:"56px", height:"56px", background:"var(--danger-bg)", border:"1px solid var(--danger-border)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"24px" }}>
          <Lock size={22} color="var(--danger)"/>
        </div>
        <div style={{ ...m, fontSize:"11px", color:"var(--danger)", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"12px" }}>403 — Access Restricted</div>
        <h1 style={{ ...f, fontSize:"24px", fontWeight:700, letterSpacing:"-0.02em", color:"var(--text-1)", marginBottom:"12px", lineHeight:1.2 }}>Protocol Authority<br/>Required</h1>
        <p style={{ ...m, fontSize:"11px", color:"var(--text-3)", lineHeight:1.8, marginBottom:"32px" }}>
          {reason==="no_wallet"
            ? "This surface is restricted to the Leyfis protocol deployer wallet. Connect the authority wallet to proceed."
            : "The connected wallet does not match the on-chain protocol authority. Disconnect and reconnect with the deployer wallet."}
        </p>
        <div style={{ border:"1px solid var(--border)", background:"var(--bg-1)", padding:"18px 20px", marginBottom:"24px" }}>
          <div style={{ ...m, fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.10em", textTransform:"uppercase", marginBottom:"12px" }}>Authentication Check</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            {[["Route","/superadmin"],["Required","VaultConfig.authority"],["Gate Program",shortAddr(GATE_PROGRAM_ID,8)],["Status",reason==="no_wallet"?"No wallet":"Not authorized"]].map(([l,v],i)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", ...(i===3?{paddingTop:"10px",borderTop:"1px solid var(--border)"}:{}) }}>
                <span style={{ ...m, fontSize:"12px", color:"var(--text-3)" }}>{l}</span>
                <span style={{ ...m, fontSize:"12px", color:i===3?"var(--danger)":"var(--text-2)", fontWeight:i===3?600:400, letterSpacing:i===3?"0.06em":"0", textTransform:i===3?"uppercase":"none" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        {reason==="no_wallet"
          ? <div style={{ display:"flex", justifyContent:"center" }}><WalletMultiButton/></div>
          : <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={()=>window.location.reload()} style={{ ...m, fontSize:"11px", letterSpacing:"0.08em", textTransform:"uppercase", background:"var(--accent)", color:"white", border:"none", padding:"11px 20px", cursor:"pointer", fontWeight:600, flex:1 }}>Retry</button>
              <a href="/" style={{ ...m, fontSize:"11px", letterSpacing:"0.08em", textTransform:"uppercase", background:"transparent", color:"var(--text-3)", border:"1px solid var(--border)", padding:"11px 20px", cursor:"pointer", flex:1, textAlign:"center" }}>← Admin Home</a>
            </div>
        }
        <div style={{ marginTop:"40px", paddingTop:"20px", borderTop:"1px solid var(--border)" }}>
          <p style={{ ...m, fontSize:"11px", color:"var(--text-4)", lineHeight:1.8, textAlign:"center" }}>Access attempts are logged on-chain.<br/>Leyfis Protocol — Solana devnet</p>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function AuthChecking() {
  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"16px" }}>
        <Loader2 size={24} color="var(--accent)" style={{ animation:"spin 1s linear infinite" }}/>
        <span style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.10em", textTransform:"uppercase" }}>Verifying authority on-chain…</span>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export function SuperAdminShell({ children, current }: { children: React.ReactNode; current: string }) {
  const { publicKey, disconnect } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [authState, setAuthState] = useState<"checking"|"authorized"|"denied_no_wallet"|"denied_wrong_wallet">("checking");
  const [showDisconnect, setShowDisconnect] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    if (!publicKey) { setAuthState("denied_no_wallet"); return; }
    setAuthState("checking");
    checkIsSuperAdmin(publicKey.toBase58()).then(ok => setAuthState(ok?"authorized":"denied_wrong_wallet"));
  }, [publicKey, mounted]);

  if (!mounted || authState==="checking") return <AuthChecking/>;
  if (authState==="denied_no_wallet") return <AccessDenied reason="no_wallet"/>;
  if (authState==="denied_wrong_wallet") return <AccessDenied reason="wrong_wallet"/>;

  const handleDisconnect = async () => { await disconnect(); setShowDisconnect(false); };

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"var(--bg)" }}>
      <aside style={{ width:"var(--sidebar-w)", flexShrink:0, borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", position:"fixed", top:0, left:0, bottom:0, zIndex:300, background:"var(--bg-1)" }}>
        <div style={{ padding:"24px 24px 20px", borderBottom:"1px solid var(--border)" }}>
          <a href="/superadmin" style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"14px" }}>
            <div style={{ width:"32px", height:"32px", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 56 56" fill="none"><rect x="8" y="16" width="7" height="32" fill="white"/><rect x="41" y="16" width="7" height="32" fill="white"/><rect x="8" y="13" width="40" height="6" fill="white"/><rect x="18" y="19" width="20" height="29" fill="var(--accent)"/></svg>
            </div>
            <div>
              <div style={{ fontFamily:"Inter,sans-serif", fontSize:"13px", fontWeight:700, letterSpacing:"0.22em", color:"var(--text-1)", lineHeight:1 }}>LEYFIS</div>
              <div style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.08em", textTransform:"uppercase", marginTop:"4px" }}>Protocol Console</div>
            </div>
          </a>
          <div style={{ display:"flex", alignItems:"center", gap:"6px", padding:"7px 12px", background:"var(--accent-bg)", border:"1px solid var(--accent-border)" }}>
            <ShieldCheck size={11} color="var(--accent)"/>
            <span style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", color:"var(--accent)", letterSpacing:"0.10em", textTransform:"uppercase", fontWeight:600 }}>Super Admin</span>
          </div>
        </div>
        <nav style={{ flex:1, padding:"12px 0", overflowY:"auto" }}>
          {SA_NAV.map(item => {
            const Icon = item.icon;
            const active = current === item.href;
            return (
              <a key={item.href} href={item.href} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 24px", textDecoration:"none", background:active?"var(--accent-bg)":"transparent", borderLeft:active?"3px solid var(--accent)":"3px solid transparent", transition:"background 0.12s" }}>
                <Icon size={15} color={active?"var(--accent)":"var(--text-3)"} strokeWidth={active?2.2:1.7}/>
                <span style={{ fontFamily:"Inter,sans-serif", fontSize:"13px", fontWeight:active?600:400, color:active?"var(--text-1)":"var(--text-2)", letterSpacing:"-0.01em" }}>{item.label}</span>
                {active && <ChevronRight size={12} color="var(--accent)" style={{ marginLeft:"auto" }}/>}
              </a>
            );
          })}
          <div style={{ margin:"12px 24px", height:"1px", background:"var(--border)" }}/>
          <a href="/" style={{ display:"flex", alignItems:"center", gap:"10px", padding:"11px 24px", textDecoration:"none", opacity:0.5 }}>
            <ExternalLink size={13} color="var(--text-4)"/>
            <span style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.06em" }}>Institutional Console</span>
          </a>
        </nav>
        <div style={{ padding:"16px 24px", borderTop:"1px solid var(--border)" }}>
          <button onClick={toggle} style={{ display:"flex", alignItems:"center", gap:"8px", width:"100%", background:"var(--bg-2)", border:"1px solid var(--border)", padding:"10px 14px", cursor:"pointer", marginBottom:"10px" }}>
            {theme==="dark"?<Sun size={13} color="var(--text-3)"/>:<Moon size={13} color="var(--text-3)"/>}
            <span style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", letterSpacing:"0.08em", color:"var(--text-3)" }}>{theme==="dark"?"Light Mode":"Dark Mode"}</span>
          </button>
          {publicKey && (
            <div style={{ background:"var(--bg-2)", border:"1px solid var(--accent-border)", padding:"14px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"8px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                  <Wallet size={11} color="var(--accent)"/>
                  <span style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", color:"var(--accent)", letterSpacing:"0.08em", textTransform:"uppercase" }}>Authority</span>
                </div>
                <button onClick={()=>setShowDisconnect(true)} style={{ display:"flex", alignItems:"center", gap:"5px", background:"none", border:"none", cursor:"pointer", padding:"2px 4px" }}>
                  <LogOut size={11} color="var(--text-4)"/>
                  <span style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.06em" }}>Sign out</span>
                </button>
              </div>
              <div style={{ fontFamily:"DM Mono,monospace", fontSize:"12px", color:"var(--text-2)", fontWeight:500 }}>{shortAddr(publicKey.toBase58(),8)}</div>
            </div>
          )}
        </div>
      </aside>
      {showDisconnect && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(4px)" }}>
          <div style={{ background:"var(--bg-1)", border:"1px solid var(--border-2)", padding:"32px", maxWidth:"360px", width:"100%" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px" }}><LogOut size={18} color="var(--text-2)"/><span style={{ fontFamily:"Inter,sans-serif", fontSize:"16px", fontWeight:700, color:"var(--text-1)" }}>Sign Out</span></div>
            <p style={{ fontFamily:"DM Mono,monospace", fontSize:"12px", color:"var(--text-2)", lineHeight:1.7, marginBottom:"24px" }}>Disconnect the protocol authority wallet?</p>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={handleDisconnect} style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", letterSpacing:"0.08em", textTransform:"uppercase", background:"var(--text-1)", color:"var(--bg)", border:"none", padding:"11px 20px", cursor:"pointer", fontWeight:700, flex:1 }}>Sign Out</button>
              <button onClick={()=>setShowDisconnect(false)} style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", letterSpacing:"0.08em", textTransform:"uppercase", background:"transparent", color:"var(--text-3)", border:"1px solid var(--border)", padding:"11px 20px", cursor:"pointer", flex:1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <main style={{ flex:1, marginLeft:"var(--sidebar-w)", minHeight:"100vh", background:"var(--bg)" }}>
        <div style={{ position:"sticky", top:0, zIndex:200, padding:"0 40px", height:"56px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--bg-1)", borderBottom:"1px solid var(--border)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            {(()=>{ const item=SA_NAV.find(n=>n.href===current); if(!item) return null; const Icon=item.icon; return <><Icon size={14} color="var(--text-4)"/><span style={{ fontFamily:"Inter,sans-serif", fontSize:"14px", fontWeight:600, color:"var(--text-1)", letterSpacing:"-0.01em" }}>{item.label}</span></>; })()}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"7px", padding:"5px 12px", background:"var(--accent-bg)", border:"1px solid var(--accent-border)" }}>
              <ShieldCheck size={11} color="var(--accent)"/>
              <span style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", color:"var(--accent)", letterSpacing:"0.08em", textTransform:"uppercase" }}>Protocol Authority</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"var(--accent)" }}/>
              <span style={{ fontFamily:"DM Mono,monospace", fontSize:"11px", color:"var(--text-4)", letterSpacing:"0.06em" }}>Solana devnet</span>
            </div>
          </div>
        </div>
        <div style={{ padding:"48px" }}>{children}</div>
      </main>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
