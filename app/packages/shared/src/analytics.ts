export type AnalyticsEvent =
  | { event: "gate_approved";                  vault: string; wallet_truncated: string; tier: number; slot: number }
  | { event: "gate_denied";                    vault: string; wallet_truncated: string; reason_code: number; slot: number }
  | { event: "admin_session_start";            role: string; wallet_truncated: string }
  | { event: "attestation_issued";             tier: number; jurisdiction: string; days: number }
  | { event: "attestation_revoked" }
  | { event: "vault_config_updated";           field: string }
  | { event: "gate_paused" }
  | { event: "gate_unpaused" }
  | { event: "compliance_report_generated";    entry_count: number; generation_seconds: number }
  | { event: "regulatory_proposal_viewed";     proposal_id: string }
  | { event: "regulatory_proposal_applied";    proposal_id: string; tx_signature: string }
  | { event: "regulatory_proposal_dismissed";  proposal_id: string }
  | { event: "mcp_tool_called";                tool: string }
  | { event: "api_request";                    endpoint: string; status: number }
  | { event: "upgrade_prompt_shown";           feature: string; current_plan: string }
  | { event: "upgrade_cta_clicked";            feature: string }
  | { event: "pricing_page_viewed" }
  | { event: "vault_deployed";                 operator_wallet: string; vault_program: string; min_tier: number; jurisdiction_count: number; tx_signature: string; timestamp: string };

export function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  console.log("[leyfis:analytics]", JSON.stringify(event));
  // Phase 2: send to analytics endpoint
  // fetch('/api/analytics', { method: 'POST', body: JSON.stringify(event) });
}
