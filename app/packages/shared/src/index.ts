export const GATE_PROGRAM_ID  = "Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP";
export const VAULT_PROGRAM_ID = "88x1hxWW6mMDpQQwuR3sCDgnmbHwHmQBdWYZQhcedNaJ";
export const RPC_ENDPOINT     = "https://devnet.helius-rpc.com/?api-key=2414c8d2-3eff-4fda-9c74-b8c0f93d768b";
export const NETWORK          = "devnet";
export const EXPLORER_BASE    = "https://explorer.solana.com";

export const VAULT_CONFIG_PDA    = "B1vJ1Pwo8SGYg5emXoGBgqHQqBEcmBJa83cAfLJjAatj";
export const ISSUER_REGISTRY_PDA = "F8NXMpzRPpz1C6HpmgMEaBzqeX7aGyRE9w6eKhdBT3zd";

export const SEEDS = {
  VAULT_CONFIG:    "vault_config",
  ISSUER_REGISTRY: "issuer_registry",
  ATTESTATION:     "attestation",
  AUDIT_ENTRY:     "audit_entry",
} as const;

export const REASON_CODES: Record<number, string> = {
  0: "Approved", 1: "NoAttestation", 2: "AttestationExpired",
  3: "AttestationRevoked", 4: "UntrustedIssuer",
  5: "TierInsufficient", 6: "JurisdictionBlocked", 7: "GatePaused",
};

export type AdminRole = "super_admin" | "vault_operator" | "kyc_issuer" | "compliance_auditor" | "none";

export const TIERS: Record<number, string> = {
  1: "Tier 1 - Basic", 2: "Tier 2 - Enhanced", 3: "Tier 3 - Institutional",
};

export const JURISDICTIONS = ["CHE","GBR","SGP","USA","DEU","FRA","LUX","ARE","HKG","JPN"] as const;

export const txUrl      = (sig: string)  => `${EXPLORER_BASE}/tx/${sig}?cluster=${NETWORK}`;
export const addressUrl = (addr: string) => `${EXPLORER_BASE}/address/${addr}?cluster=${NETWORK}`;
export const shortAddr  = (addr: string, chars = 4) => `${addr.slice(0,chars)}...${addr.slice(-chars)}`;
export const formatTs   = (ts: number)   => new Date(ts*1000).toISOString().replace("T"," ").slice(0,19)+" UTC";
export * from "./txBuilders";
