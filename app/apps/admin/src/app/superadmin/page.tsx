"use client";
import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import {
  shortAddr, GATE_PROGRAM_ID, VAULT_PROGRAM_ID, RPC_ENDPOINT,
  findTreasuryConfigPDA, findTreasuryPDA,
  buildUpdateTreasuryConfigIx, buildWithdrawTreasuryIx, buildInitializeTreasuryIx,
  sendAdminTx,
} from "@leyfis/shared";
import { Connection } from "@solana/web3.js";
import { UserPlus, TrendingUp, TrendingDown, Minus, Activity, Users, Shield, Zap, Coins, ArrowDownToLine } from "lucide-react";

const m = { fontFamily:"DM Mono,monospace" };
const f = { fontFamily:"Inter,sans-serif" };

const STATS = [
  { label:"Total Gate Calls",    value:"2,847", delta:"+12%",  trend:"up",   icon:Zap,      sub:"Last 30 days" },
  { label:"Active Attestations", value:"1,923", delta:"+4%",   trend:"up",   icon:Shield,   sub:"Across all issuers" },
  { label:"Approval Rate",       value:"67.5%", delta:"-2.1%", trend:"down", icon:Activity, sub:"Gate pass rate" },
  { label:"Active Issuers",      value:"3",     delta:"—",     trend:"flat", icon:Users,    sub:"Registered & active" },
];
const ISSUERS = [
  { name:"AMINA Bank KYC",  addr:"EDBYT2...QALU", tier:3, attestations:1841, status:"active",  registered:"2026-03-25" },
  { name:"Blockpass Node",  addr:"7xKm9P...3Rqw", tier:2, attestations:67,   status:"active",  registered:"2026-03-24" },
  { name:"Sumsub Bridge",   addr:"4NpLw8...9Fvz", tier:1, attestations:15,   status:"revoked", registered:"2026-03-20" },
];
const RECENT_TX = [
  { type:"issuer_registered",  actor:"EGFbgX...Y4ht", target:"EDBYT2...QALU", ts:Date.now()/1000-180 },
  { type:"attestation_issued", actor:"EDBYT2...QALU", target:"64je9D...kxfb", ts:Date.now()/1000-600 },
  { type:"gate_paused",        actor:"EGFbgX...Y4ht", target:"Vault",          ts:Date.now()/1000-3600 },
  { type:"tier_updated",       actor:"EGFbgX...Y4ht", target:"min_tier=2",     ts:Date.now()/1000-7200 },
  { type:"issuer_revoked",     actor:"EGFbgX...Y4ht", target:"4NpLw8...9Fvz",  ts:Date.now()/1000-86400 },
];
const TX_META: Record<string,{color:string;label:string}> = {
  issuer_registered:{color:"var(--accent)",label:"Issuer Registered"},
  attestation_issued:{color:"var(--accent)",label:"Attestation Issued"},
  gate_paused:{color:"var(--danger)",label:"Gate Paused"},
  tier_updated:{color:"var(--muted)",label:"Tier Updated"},
  issuer_revoked:{color:"var(--danger)",label:"Issuer Revoked"},
};
function timeAgo(ts:number){const d=Math.floor(Date.now()/1000-ts);if(d<60)return`${d}s ago`;if(d<3600)return`${Math.floor(d/60)}m ago`;if(d<86400)return`${Math.floor(d/3600)}h ago`;return`${Math.floor(d/86400)}d ago`;}

interface TreasuryState { feeLamports: bigint; totalCollected: bigint; lastUpdated: number; initialized: boolean; }

function useTreasury() {
  const [data, setData] = useState<TreasuryState | null>(null);
  const [loading, setLoading] = useState(true);
  const conn = new Connection(RPC_ENDPOINT, "confirmed");
  const gatePk = new PublicKey(GATE_PROGRAM_ID);
  const [cfgKey] = findTreasuryConfigPDA(gatePk);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const info = await conn.getAccountInfo(cfgKey);
      if (!info || info.data.length < 65) { setData({ feeLamports: 0n, totalCollected: 0n, lastUpdated: 0, initialized: false }); }
      else {
        const d = info.data;
        const feeLamports    = d.readBigUInt64LE(40);
        const totalCollected = d.readBigUInt64LE(48);
        const lastUpdated    = Number(d.readBigInt64LE(56));
        setData({ feeLamports, totalCollected, lastUpdated, initialized: true });
      }
    } catch { setData(null); }
    setLoading(false);
  }, [cfgKey.toBase58()]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refresh: fetch };
}

function TreasuryPanel() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { data, loading, refresh } = useTreasury();
  const [newFee, setNewFee] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const gatePk = new PublicKey(GATE_PROGRAM_ID);
  const [treasuryKey] = findTreasuryPDA(gatePk);

  const act = async (fn: () => Promise<string>) => {
    if (!publicKey || !signTransaction) return;
    setBusy(true); setMsg(null);
    try {
      const sig = await fn();
      setMsg(`✓ ${sig.slice(0,16)}...`);
      await refresh();
    } catch (e: any) { setMsg(`Error: ${e?.message ?? "unknown"}`); }
    setBusy(false);
  };

  const sign = signTransaction as ((tx: import("@solana/web3.js").Transaction) => Promise<import("@solana/web3.js").Transaction>) | undefined;

  const handleInitTreasury = () => act(async () => {
    const ix = buildInitializeTreasuryIx(gatePk, publicKey!, 5000n);
    return sendAdminTx(connection, ix, publicKey!, sign!);
  });
  const handleUpdateFee = () => act(async () => {
    const ix = buildUpdateTreasuryConfigIx(gatePk, publicKey!, BigInt(newFee) || 0n);
    return sendAdminTx(connection, ix, publicKey!, sign!);
  });
  const handleWithdraw = () => act(async () => {
    const ix = buildWithdrawTreasuryIx(gatePk, publicKey!, BigInt(withdrawAmt) || 0n);
    return sendAdminTx(connection, ix, publicKey!, sign!);
  });

  const inp: any = { ...m, fontSize:"12px", background:"var(--bg-2)", border:"1px solid var(--border)",
    color:"var(--text-1)", padding:"8px 12px", width:"140px", outline:"none" };
  const btn: any = (disabled?: boolean) => ({ ...m, fontSize:"9px", letterSpacing:"0.1em", textTransform:"uppercase",
    background: disabled ? "var(--accent-bg)" : "var(--accent)", color: disabled ? "var(--accent)" : "white",
    border:"1px solid var(--accent)", padding:"8px 16px", cursor: disabled ? "not-allowed" : "pointer", fontWeight:600 });

  return (
    <div style={{ marginTop:"20px", border:"1px solid var(--border)", background:"var(--bg-1)", padding:"20px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <Coins size={14} color="var(--accent)" />
          <span style={{ ...m, fontSize:"9px", color:"var(--text-4)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Protocol Treasury</span>
        </div>
        {data?.initialized && (
          <span style={{ ...m, fontSize:"9px", padding:"3px 10px", background:"var(--accent-bg)", color:"var(--accent)", border:"1px solid var(--accent-border)" }}>LIVE</span>
        )}
      </div>

      {loading ? (
        <div style={{ ...m, fontSize:"11px", color:"var(--text-4)" }}>Loading treasury state...</div>
      ) : !data?.initialized ? (
        <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
          <div style={{ ...m, fontSize:"12px", color:"var(--text-3)" }}>Treasury not initialized.</div>
          <button onClick={handleInitTreasury} disabled={busy || !publicKey} style={btn(busy || !publicKey)}>
            Initialize (5000 lamports fee)
          </button>
        </div>
      ) : (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"2px", marginBottom:"20px" }}>
            {[
              { label:"Fee Per Gate Call", value:`${data.feeLamports.toLocaleString()} lamports`, sub:`≈ $${(Number(data.feeLamports) * 0.000000001 * 150).toFixed(4)}` },
              { label:"Total Collected",   value:`${data.totalCollected.toLocaleString()} lamports`, sub:`≈ $${(Number(data.totalCollected) * 0.000000001 * 150).toFixed(3)}` },
              { label:"Last Updated",      value:data.lastUpdated ? new Date(data.lastUpdated*1000).toLocaleDateString() : "—", sub:"UTC" },
            ].map((s,i) => (
              <div key={i} style={{ padding:"14px 16px", background:"var(--bg-2)", border:"1px solid var(--border)" }}>
                <div style={{ ...m, fontSize:"9px", color:"var(--text-4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"8px" }}>{s.label}</div>
                <div style={{ ...m, fontSize:"15px", color:"var(--text-1)", fontWeight:700, marginBottom:"4px" }}>{s.value}</div>
                <div style={{ ...m, fontSize:"9px", color:"var(--text-3)" }}>{s.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:"24px", flexWrap:"wrap" }}>
            <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
              <input value={newFee} onChange={e=>setNewFee(e.target.value)} placeholder="New fee (lamports)" style={inp} type="number" min="0"/>
              <button onClick={handleUpdateFee} disabled={busy || !publicKey || !newFee} style={btn(busy || !publicKey || !newFee)}>Update Fee</button>
            </div>
            <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
              <input value={withdrawAmt} onChange={e=>setWithdrawAmt(e.target.value)} placeholder="Amount (lamports)" style={inp} type="number" min="0"/>
              <button onClick={handleWithdraw} disabled={busy || !publicKey || !withdrawAmt} style={{ ...btn(busy || !publicKey || !withdrawAmt), display:"flex", alignItems:"center", gap:"6px" }}>
                <ArrowDownToLine size={11}/> Withdraw
              </button>
            </div>
          </div>
          {msg && <div style={{ ...m, fontSize:"10px", color: msg.startsWith("✓") ? "var(--accent)" : "var(--danger)", marginTop:"12px" }}>{msg}</div>}
        </>
      )}
      <div style={{ ...m, fontSize:"9px", color:"var(--text-4)", marginTop:"12px", paddingTop:"12px", borderTop:"1px solid var(--border)" }}>
        Treasury PDA: {shortAddr(treasuryKey.toBase58(), 8)} · collected from approved gate() calls only
      </div>
    </div>
  );
}

function RegisterModal({onClose}:{onClose:()=>void}){
  const [wallet,setWallet]=useState("");const [name,setName]=useState("");const [tier,setTier]=useState(3);const [loading,setLoading]=useState(false);const [done,setDone]=useState(false);
  const inp:any={...m,fontSize:"13px",background:"var(--bg-2)",border:"1px solid var(--border)",color:"var(--text-1)",padding:"10px 14px",width:"100%",outline:"none"};
  const submit=async()=>{if(!wallet||!name)return;setLoading(true);await new Promise(r=>setTimeout(r,1200));setDone(true);setLoading(false);};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(4px)"}}>
      <div style={{background:"var(--bg-1)",border:"1px solid var(--border-2)",padding:"40px",width:"100%",maxWidth:"480px",position:"relative"}}>
        <button onClick={onClose} style={{position:"absolute",top:"16px",right:"16px",background:"none",border:"none",color:"var(--text-3)",cursor:"pointer",fontSize:"20px",lineHeight:1}}>x</button>
        {!done?(<>
          <div style={{...m,fontSize:"9px",color:"var(--accent)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"12px"}}>Register KYC Issuer</div>
          <h2 style={{...f,fontSize:"20px",fontWeight:700,marginBottom:"24px",color:"var(--text-1)"}}>Add New Issuer</h2>
          <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
            <div><label style={{...m,fontSize:"9px",color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase",display:"block",marginBottom:"6px"}}>Issuer Wallet</label><input value={wallet} onChange={e=>setWallet(e.target.value)} placeholder="Solana pubkey..." style={inp}/></div>
            <div><label style={{...m,fontSize:"9px",color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase",display:"block",marginBottom:"6px"}}>Institution Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. AMINA Bank KYC Service" style={inp}/></div>
            <div><label style={{...m,fontSize:"9px",color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase",display:"block",marginBottom:"6px"}}>Max Clearance Tier</label>
              <select value={tier} onChange={e=>setTier(parseInt(e.target.value))} style={inp}><option value={1}>Tier 1 - Basic KYC</option><option value={2}>Tier 2 - Enhanced Due Diligence</option><option value={3}>Tier 3 - Institutional / FATF</option></select></div>
            <div style={{height:"1px",background:"var(--border)"}}/>
            <div style={{display:"flex",gap:"12px"}}>
              <button onClick={submit} disabled={loading||!wallet||!name} style={{...m,fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",background:loading||!wallet||!name?"var(--accent-bg)":"var(--accent)",color:loading||!wallet||!name?"var(--accent)":"white",border:"1px solid var(--accent)",padding:"11px 24px",cursor:loading||!wallet||!name?"not-allowed":"pointer",fontWeight:600,flex:1}}>{loading?"Registering...":"Register Issuer"}</button>
              <button onClick={onClose} style={{...m,fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",background:"transparent",color:"var(--text-3)",border:"1px solid var(--border)",padding:"11px 24px",cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        </>):(
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{width:"48px",height:"48px",background:"var(--accent-bg)",border:"1px solid var(--accent-border)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><UserPlus size={20} color="var(--accent)"/></div>
            <div style={{...f,fontSize:"16px",fontWeight:700,color:"var(--text-1)",marginBottom:"8px"}}>Issuer Registered</div>
            <div style={{...m,fontSize:"11px",color:"var(--text-2)",marginBottom:"4px"}}>{name}</div>
            <div style={{...m,fontSize:"9px",color:"var(--text-4)",marginBottom:"24px"}}>Demo mode - on-chain registration pending devnet redeploy</div>
            <button onClick={onClose} style={{...m,fontSize:"10px",color:"var(--text-3)",background:"none",border:"none",cursor:"pointer"}}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SuperAdminPage(){
  const {publicKey}=useWallet();
  const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);
  const [showRegister,setShowRegister]=useState(false);
  const [tab,setTab]=useState<"issuers"|"activity">("issuers");
  if(!mounted)return null;
  return(
    <SuperAdminShell current="/superadmin">
      {showRegister&&<RegisterModal onClose={()=>setShowRegister(false)}/>}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"28px"}}>
        <div>
          <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"10px"}}>/01 - Super Admin</div>
          <h1 style={{...f,fontSize:"26px",fontWeight:700,letterSpacing:"-0.02em",marginBottom:"4px",color:"var(--text-1)"}}>Protocol Overview</h1>
          <p style={{...m,fontSize:"11px",color:"var(--text-3)"}}>Institutional Middleware Control Centre{publicKey&&<span style={{color:"var(--text-4)",marginLeft:"12px"}}>- {shortAddr(publicKey.toBase58(),8)}</span>}</p>
        </div>
        <button onClick={()=>setShowRegister(true)} style={{display:"flex",alignItems:"center",gap:"8px",...m,fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",background:"var(--accent)",color:"white",border:"none",padding:"10px 20px",cursor:"pointer",fontWeight:600}}><UserPlus size={14}/> Register Issuer</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"2px",marginBottom:"20px"}}>
        {STATS.map((s,i)=>{const Icon=s.icon;return(
          <div key={i} style={{border:"1px solid var(--border)",padding:"20px 24px",background:"var(--bg-1)",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:"16px",right:"16px",opacity:0.12}}><Icon size={28} color="var(--accent)"/></div>
            <div style={{...m,fontSize:"9px",color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"10px"}}>{s.label}</div>
            <div style={{...f,fontSize:"28px",fontWeight:800,letterSpacing:"-0.02em",lineHeight:1,marginBottom:"10px",color:"var(--text-1)"}}>{s.value}</div>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              {s.trend==="up"?<TrendingUp size={12} color="var(--accent)"/>:s.trend==="down"?<TrendingDown size={12} color="var(--danger)"/>:<Minus size={12} color="var(--muted)"/>}
              <span style={{...m,fontSize:"9px",color:s.trend==="up"?"var(--accent)":s.trend==="down"?"var(--danger)":"var(--muted)",fontWeight:600}}>{s.delta}</span>
              <span style={{...m,fontSize:"9px",color:"var(--text-4)"}}>{s.sub}</span>
            </div>
          </div>
        );})}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",border:"1px solid var(--border)",marginBottom:"24px",background:"var(--bg-1)"}}>
        {[["Gate Program",shortAddr(GATE_PROGRAM_ID,10)],["Test Vault",shortAddr(VAULT_PROGRAM_ID,10)],["Network","Solana Devnet"],["Version","v0.1.0 - 7 checks"]].map(([l,v],i)=>(
          <div key={i} style={{padding:"14px 20px",borderRight:i<3?"1px solid var(--border)":"none"}}>
            <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"4px"}}>{l}</div>
            <div style={{...m,fontSize:"11px",color:"var(--text-2)",fontWeight:500}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",borderBottom:"1px solid var(--border)"}}>
        {(["issuers","activity"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{...m,fontSize:"10px",letterSpacing:"0.1em",textTransform:"uppercase",padding:"11px 20px",background:"none",border:"none",cursor:"pointer",color:tab===t?"var(--text-1)":"var(--text-3)",borderBottom:tab===t?"2px solid var(--accent)":"2px solid transparent",marginBottom:"-1px",fontWeight:tab===t?600:400}}>
            {t==="issuers"?"Active Issuers":"Recent Activity"}
          </button>
        ))}
      </div>
      {tab==="issuers"&&(
        <div style={{border:"1px solid var(--border)",borderTop:"none",background:"var(--bg-1)"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 140px 60px 100px 90px 100px",gap:"12px",padding:"10px 20px",...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase",borderBottom:"1px solid var(--border)"}}>
            <span>Institution</span><span>Address</span><span>Tier</span><span>Attestations</span><span>Status</span><span>Registered</span>
          </div>
          {ISSUERS.map((iss,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 140px 60px 100px 90px 100px",gap:"12px",padding:"15px 20px",borderBottom:i<ISSUERS.length-1?"1px solid var(--border)":"none",alignItems:"center",borderLeft:`2px solid ${iss.status==="active"?"var(--accent)":"var(--danger)"}`,background:"var(--bg-1)"}}>
              <div><div style={{...f,fontSize:"13px",fontWeight:600,color:"var(--text-1)",marginBottom:"2px"}}>{iss.name}</div><div style={{...m,fontSize:"9px",color:"var(--text-4)"}}>{iss.addr}</div></div>
              <span style={{...m,fontSize:"10px",color:"var(--text-3)"}}>{iss.addr}</span>
              <span style={{...m,fontSize:"9px",padding:"3px 8px",background:"var(--accent-bg)",color:"var(--accent)",border:"1px solid var(--accent-border)",display:"inline-block",textAlign:"center",letterSpacing:"0.06em"}}>T{iss.tier}</span>
              <span style={{...f,fontSize:"13px",color:"var(--text-2)",fontWeight:500}}>{iss.attestations.toLocaleString()}</span>
              <span style={{...m,fontSize:"9px",padding:"3px 8px",background:iss.status==="active"?"rgba(22,163,74,0.08)":"var(--danger-bg)",color:iss.status==="active"?"var(--success)":"var(--danger)",border:`1px solid ${iss.status==="active"?"rgba(22,163,74,0.2)":"var(--danger-border)"}`,display:"inline-block",letterSpacing:"0.06em",textTransform:"uppercase"}}>{iss.status}</span>
              <span style={{...m,fontSize:"10px",color:"var(--text-3)"}}>{iss.registered}</span>
            </div>
          ))}
          <div style={{padding:"12px 20px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{...m,fontSize:"9px",color:"var(--text-4)"}}>{ISSUERS.length} registered - {ISSUERS.filter(x=>x.status==="active").length} active</span>
            <button onClick={()=>setShowRegister(true)} style={{display:"flex",alignItems:"center",gap:"6px",...m,fontSize:"9px",letterSpacing:"0.08em",textTransform:"uppercase",background:"transparent",color:"var(--accent)",border:"1px solid var(--accent-border)",padding:"6px 14px",cursor:"pointer"}}><UserPlus size={11}/> Register New</button>
          </div>
        </div>
      )}
      {tab==="activity"&&(
        <div style={{border:"1px solid var(--border)",borderTop:"none",background:"var(--bg-1)"}}>
          <div style={{display:"grid",gridTemplateColumns:"160px 1fr 1fr 80px",gap:"12px",padding:"10px 20px",...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase",borderBottom:"1px solid var(--border)"}}>
            <span>Event</span><span>Actor</span><span>Target</span><span>When</span>
          </div>
          {RECENT_TX.map((tx,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"160px 1fr 1fr 80px",gap:"12px",padding:"13px 20px",borderBottom:i<RECENT_TX.length-1?"1px solid var(--border)":"none",alignItems:"center",borderLeft:`2px solid ${TX_META[tx.type].color}`}}>
              <span style={{...m,fontSize:"9px",color:TX_META[tx.type].color,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{TX_META[tx.type].label}</span>
              <span style={{...m,fontSize:"10px",color:"var(--text-2)"}}>{tx.actor}</span>
              <span style={{...m,fontSize:"10px",color:"var(--text-3)"}}>{tx.target}</span>
              <span style={{...m,fontSize:"10px",color:"var(--text-4)"}}>{timeAgo(tx.ts)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{marginTop:"20px",border:"1px solid var(--border)",background:"var(--bg-1)",padding:"20px"}}>
        <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"14px"}}>Network Integrity</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"2px"}}>
          {[{label:"RPC Latency",value:"14ms",ok:true},{label:"Block Production",value:"99.98%",ok:true},{label:"Devnet Status",value:"Degraded",ok:false}].map((r,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:"var(--bg-2)",border:"1px solid var(--border)"}}>
              <span style={{...m,fontSize:"10px",color:"var(--text-2)"}}>{r.label}</span>
              <span style={{...m,fontSize:"10px",color:r.ok?"var(--success)":"var(--danger)",fontWeight:700}}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
      <TreasuryPanel />
    </SuperAdminShell>
  );
}
