"use client";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AdminShell } from "@/components/AdminShell";
import { shortAddr } from "@leyfis/shared";
import { BadgeCheck, BadgeX, Search, Filter, RotateCcw, ExternalLink, Clock, Globe, Shield } from "lucide-react";

const m = {fontFamily:"'DM Mono',monospace"};
const f = {fontFamily:"'Inter',sans-serif"};

const ATTESTATIONS = [
  { wallet:"64je9DfojWKRt3EoxXPcq1DCWqyFNknQ7XWTxF7ekxfb", issuer:"EDBYT2E8HGEKhTRmHHdrAYUJChi4RUQdbzAmuqB6QALU", tier:3, jurisdiction:"CHE", issued:"2026-03-25", expires:"2027-03-25", status:"active",  kycRef:"amina-kyc-00291" },
  { wallet:"5t1okyeKtcRDQwiq3LT3uSBKQgUEuPTZBBSj15is9fjS", issuer:"EDBYT2E8HGEKhTRmHHdrAYUJChi4RUQdbzAmuqB6QALU", tier:2, jurisdiction:"GBR", issued:"2026-03-24", expires:"2027-03-24", status:"active",  kycRef:"amina-kyc-00187" },
  { wallet:"7xKm9PrQwLm3nF8dY2vT6hBsJpNqE4cR1oA5uW9zX", issuer:"7xKm9P...3Rqw",                                     tier:1, jurisdiction:"SGP", issued:"2026-03-20", expires:"2026-09-20", status:"active",  kycRef:"bp-00044" },
  { wallet:"9mZpL2nKqR8wF3sE6dT1vA4uB7cX5yJ0hN", issuer:"EDBYT2E8HGEKhTRmHHdrAYUJChi4RUQdbzAmuqB6QALU",          tier:3, jurisdiction:"CHE", issued:"2026-03-10", expires:"2027-03-10", status:"revoked", kycRef:"amina-kyc-00099" },
  { wallet:"3kRmQ9pLwN6sE2dF8vT5hA1uB4cX7yJ", issuer:"4NpLw8...9Fvz",                                              tier:1, jurisdiction:"DEU", issued:"2026-02-15", expires:"2026-08-15", status:"expired", kycRef:"ss-00012" },
];

const TIER_COLORS: Record<number,{bg:string;color:string;border:string}> = {
  1: {bg:"rgba(136,153,187,0.1)", color:"var(--muted)",  border:"rgba(136,153,187,0.2)"},
  2: {bg:"var(--accent-bg)",      color:"var(--accent)", border:"var(--accent-border)"},
  3: {bg:"var(--accent-bg)",      color:"var(--accent)", border:"var(--accent-border)"},
};

const STATUS_COLORS: Record<string,{bg:string;color:string;border:string}> = {
  active:  {bg:"rgba(22,163,74,0.08)",  color:"var(--success)", border:"rgba(22,163,74,0.2)"},
  revoked: {bg:"var(--danger-bg)",      color:"var(--danger)",  border:"var(--danger-border)"},
  expired: {bg:"rgba(136,153,187,0.08)",color:"var(--muted)",   border:"rgba(136,153,187,0.2)"},
};

function Badge({label,bg,color,border}:{label:string;bg:string;color:string;border:string}) {
  return (
    <span style={{...m,fontSize:"9px",padding:"3px 8px",background:bg,color,border:`1px solid ${border}`,display:"inline-block",letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:500}}>
      {label}
    </span>
  );
}

export default function RegistryPage() {
  const {publicKey} = useWallet();
  const [mounted,setMounted]=useState(false); useEffect(()=>setMounted(true),[]);
  const [search,setSearch]=useState("");
  const [statusF,setStatusF]=useState<"all"|"active"|"revoked"|"expired">("all");
  const [tierF,setTierF]=useState<"all"|"1"|"2"|"3">("all");
  const [selected,setSelected]=useState<string|null>(null);

  const filtered = ATTESTATIONS.filter(a => {
    if(statusF!=="all" && a.status!==statusF) return false;
    if(tierF!=="all" && a.tier!==parseInt(tierF)) return false;
    if(search && !a.wallet.toLowerCase().includes(search.toLowerCase()) && !a.kycRef.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedAttestation = ATTESTATIONS.find(a=>a.wallet===selected);

  if(!mounted) return null;
  return (
    <AdminShell current="/registry">
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"28px"}}>
        <div>
          <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:"10px"}}>/04 ? KYC Issuer</div>
          <h1 style={{...f,fontSize:"26px",fontWeight:700,letterSpacing:"-0.02em",marginBottom:"4px",color:"var(--text-1)"}}>Attestation Registry</h1>
          <p style={{...m,fontSize:"11px",color:"var(--text-3)",lineHeight:1.6}}>All on-chain credentials issued through this console.</p>
        </div>
        <div style={{display:"flex",gap:"12px",alignItems:"center"}}>
          {[["All",ATTESTATIONS.length],["Active",ATTESTATIONS.filter(a=>a.status==="active").length],["Revoked",ATTESTATIONS.filter(a=>a.status==="revoked").length]].map(([l,v])=>(
            <div key={l} style={{textAlign:"center",padding:"10px 16px",border:"1px solid var(--border)",background:"var(--bg-1)"}}>
              <div style={{...f,fontSize:"18px",fontWeight:700,color:"var(--text-1)"}}>{v}</div>
              <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.08em",textTransform:"uppercase",marginTop:"2px"}}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:"10px",marginBottom:"16px",flexWrap:"wrap",alignItems:"center"}}>
        <div style={{position:"relative",flex:"1",minWidth:"200px"}}>
          <Search size={13} color="var(--text-4)" style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)"}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search wallet or KYC ref..."
            style={{...m,fontSize:"11px",background:"var(--bg-1)",border:"1px solid var(--border)",color:"var(--text-1)",padding:"9px 12px 9px 34px",width:"100%",outline:"none"}}/>
        </div>
        <div style={{display:"flex",gap:"4px"}}>
          {(["all","active","revoked","expired"] as const).map(s=>(
            <button key={s} onClick={()=>setStatusF(s)} style={{...m,fontSize:"9px",letterSpacing:"0.08em",textTransform:"uppercase",padding:"8px 12px",background:statusF===s?"var(--accent)":"var(--bg-1)",color:statusF===s?"white":"var(--text-3)",border:`1px solid ${statusF===s?"var(--accent)":"var(--border)"}`,cursor:"pointer"}}>
              {s}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:"4px"}}>
          {(["all","1","2","3"] as const).map(t=>(
            <button key={t} onClick={()=>setTierF(t)} style={{...m,fontSize:"9px",letterSpacing:"0.08em",textTransform:"uppercase",padding:"8px 12px",background:tierF===t?"var(--accent)":"var(--bg-1)",color:tierF===t?"white":"var(--text-3)",border:`1px solid ${tierF===t?"var(--accent)":"var(--border)"}`,cursor:"pointer"}}>
              {t==="all"?"All Tiers":`T${t}`}
            </button>
          ))}
        </div>
        {(search||statusF!=="all"||tierF!=="all") && (
          <button onClick={()=>{setSearch("");setStatusF("all");setTierF("all");}} style={{display:"flex",alignItems:"center",gap:"6px",...m,fontSize:"9px",color:"var(--text-3)",background:"none",border:"1px solid var(--border)",padding:"8px 12px",cursor:"pointer"}}>
            <RotateCcw size={11}/> Reset
          </button>
        )}
        <span style={{...m,fontSize:"9px",color:"var(--text-4)",marginLeft:"auto"}}>{filtered.length} records</span>
      </div>

      <div style={{display:"grid",gridTemplateColumns:selected?"1fr 340px":"1fr",gap:"2px"}}>
        {/* Table */}
        <div style={{border:"1px solid var(--border)",background:"var(--bg-1)"}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 60px 80px 100px 90px 80px",gap:"12px",padding:"10px 16px",...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase",borderBottom:"1px solid var(--border)"}}>
            <span>Wallet</span><span>Issuer</span><span>Tier</span><span>Jurisdiction</span><span>Status</span><span>Expires</span><span></span>
          </div>
          {filtered.length===0 ? (
            <div style={{padding:"40px",textAlign:"center",...m,fontSize:"11px",color:"var(--text-4)"}}>No attestations match filters</div>
          ) : filtered.map((a,i) => (
            <div key={i} onClick={()=>setSelected(selected===a.wallet?null:a.wallet)}
              style={{display:"grid",gridTemplateColumns:"2fr 1fr 60px 80px 100px 90px 80px",gap:"12px",padding:"13px 16px",borderBottom:i<filtered.length-1?"1px solid var(--border)":"none",...m,fontSize:"10px",alignItems:"center",cursor:"pointer",background:selected===a.wallet?"var(--accent-bg)":"transparent",borderLeft:`2px solid ${selected===a.wallet?"var(--accent)":a.status==="active"?"var(--accent)":a.status==="revoked"?"var(--danger)":"var(--border-2)"}`,transition:"background 0.1s"}}>
              <div>
                <div style={{...m,fontSize:"10px",color:"var(--text-1)",fontWeight:500}}>{shortAddr(a.wallet,8)}</div>
                <div style={{...m,fontSize:"9px",color:"var(--text-4)",marginTop:"2px"}}>{a.kycRef}</div>
              </div>
              <span style={{color:"var(--text-3)"}}>{shortAddr(a.issuer,6)}</span>
              <Badge label={`T${a.tier}`} {...TIER_COLORS[a.tier]}/>
              <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                <Globe size={10} color="var(--text-4)"/>
                <span style={{color:"var(--text-2)"}}>{a.jurisdiction}</span>
              </div>
              <Badge label={a.status} {...STATUS_COLORS[a.status]}/>
              <span style={{color:a.status==="expired"?"var(--danger)":"var(--text-3)"}}>{a.expires}</span>
              <div style={{display:"flex",justifyContent:"flex-end"}}>
                {a.status==="active" && publicKey && (
                  <button onClick={e=>{e.stopPropagation();}} style={{...m,fontSize:"9px",color:"var(--danger)",background:"none",border:"1px solid var(--danger-border)",padding:"4px 8px",cursor:"pointer",letterSpacing:"0.06em"}}>
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selectedAttestation && (
          <div style={{border:"1px solid var(--border)",background:"var(--bg-1)",padding:"24px",position:"sticky",top:"80px",alignSelf:"start"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"20px"}}>
              <div style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Attestation Detail</div>
              <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",color:"var(--text-4)",cursor:"pointer",fontSize:"18px",lineHeight:1}}>?</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"20px",padding:"14px",background:"var(--bg-2)",border:"1px solid var(--border)"}}>
              {selectedAttestation.status==="active"
                ? <BadgeCheck size={20} color="var(--accent)"/>
                : <BadgeX size={20} color="var(--danger)"/>}
              <div>
                <div style={{...f,fontSize:"13px",fontWeight:600,color:"var(--text-1)",marginBottom:"2px"}}>
                  {selectedAttestation.status==="active" ? "Valid Credential" : selectedAttestation.status==="revoked" ? "Revoked" : "Expired"}
                </div>
                <div style={{...m,fontSize:"9px",color:"var(--text-4)"}}>Tier {selectedAttestation.tier} ? {selectedAttestation.jurisdiction}</div>
              </div>
            </div>
            {[
              ["Wallet",    shortAddr(selectedAttestation.wallet,10)],
              ["Issuer",    shortAddr(selectedAttestation.issuer,10)],
              ["KYC Ref",   selectedAttestation.kycRef],
              ["Tier",      `Tier ${selectedAttestation.tier}`],
              ["Jurisdiction", selectedAttestation.jurisdiction],
              ["Issued",    selectedAttestation.issued],
              ["Expires",   selectedAttestation.expires],
              ["Status",    selectedAttestation.status.toUpperCase()],
            ].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                <span style={{...m,fontSize:"9px",color:"var(--text-4)",letterSpacing:"0.06em",textTransform:"uppercase"}}>{l}</span>
                <span style={{...m,fontSize:"10px",color:"var(--text-2)",fontWeight:500}}>{v}</span>
              </div>
            ))}
            <div style={{marginTop:"16px",display:"flex",flexDirection:"column",gap:"8px"}}>
              {selectedAttestation.status==="active" && (
                <button style={{...m,fontSize:"10px",letterSpacing:"0.08em",textTransform:"uppercase",background:"var(--danger-bg)",color:"var(--danger)",border:"1px solid var(--danger-border)",padding:"10px",cursor:"pointer",width:"100%",fontWeight:600}}>
                  Revoke Attestation
                </button>
              )}
              <a href={`https://explorer.solana.com/address/${selectedAttestation.wallet}?cluster=devnet`} target="_blank" rel="noreferrer"
                style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",...m,fontSize:"10px",letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--text-3)",border:"1px solid var(--border)",padding:"10px",background:"var(--bg-2)"}}>
                <ExternalLink size={11}/> View on Explorer
              </a>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
