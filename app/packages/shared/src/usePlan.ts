export type PlanTier = "starter" | "institutional" | "enterprise" | "trial" | "expired";

export interface PlanFeatures {
  aiComplianceReports: boolean;
  regulatoryIntelligence: boolean;
  multiVaultAnalytics: boolean;
  timeMachine: boolean;
  apiAccess: boolean;
  apiCallLimit: number;
}

export interface PlanState {
  tier: PlanTier;
  vaultLimit: number;
  trialDaysRemaining?: number;
  renewalDate?: string;
  features: PlanFeatures;
}

// MVP: all deployments are on trial with full access.
// Post-pilot: replace with fetch('/api/plan', { wallet }) and real tier enforcement.
export function usePlan(): PlanState {
  return {
    tier: "trial",
    vaultLimit: 999,
    trialDaysRemaining: 30,
    features: {
      aiComplianceReports: true,
      regulatoryIntelligence: true,
      multiVaultAnalytics: true,
      timeMachine: true,
      apiAccess: true,
      apiCallLimit: 50000,
    },
  };
}
