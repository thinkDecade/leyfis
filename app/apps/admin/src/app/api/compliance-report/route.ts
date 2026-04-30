import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

interface AuditEntry {
  wallet: string; vault: string; timestamp: number; slot: number;
  outcome: "approved" | "denied"; reasonCode: number;
  attestationId: string; tier: number; nonce: number;
}

interface ReportRequest {
  entries: AuditEntry[];
  from: string;
  to: string;
  jurisdiction?: string;
  institution?: string;
}

const REASON_NAMES: Record<number, string> = {
  0: "Approved", 1: "No Attestation", 2: "Attestation Expired",
  3: "Attestation Revoked", 4: "Untrusted Issuer",
  5: "Tier Insufficient", 6: "Jurisdiction Blocked", 7: "Gate Paused",
};

function buildPrompt(req: ReportRequest): string {
  const { entries, from, to } = req;
  const institution = req.institution || "Leyfis Protocol";
  const approved = entries.filter(e => e.outcome === "approved");
  const denied   = entries.filter(e => e.outcome === "denied");
  const approvalRate = entries.length > 0 ? Math.round(approved.length / entries.length * 100) : 0;

  const denialBreakdown = denied.reduce((acc, e) => {
    const reason = REASON_NAMES[e.reasonCode] ?? `Code ${e.reasonCode}`;
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const tierBreakdown = approved.reduce((acc, e) => {
    const tier = e.tier > 0 ? `Tier ${e.tier}` : "Unknown";
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const uniqueWallets = new Set(entries.map(e => e.wallet)).size;
  const deniedWallets = new Set(denied.map(e => e.wallet)).size;

  return `You are a compliance reporting specialist at a regulated financial infrastructure firm. Generate a formal FATF R.16 compliance report based on the on-chain audit data below.

AUDIT DATA SUMMARY
Period: ${from} to ${to}
Institution: ${institution}
Total gate interactions: ${entries.length}
Approved: ${approved.length} (${approvalRate}%)
Denied: ${denied.length} (${100 - approvalRate}%)
Unique wallets: ${uniqueWallets}
Unique wallets denied: ${deniedWallets}

DENIAL BREAKDOWN BY REASON:
${Object.entries(denialBreakdown).map(([r, n]) => `  ${r}: ${n}`).join("\n") || "  None"}

APPROVED TRANSACTION TIER DISTRIBUTION:
${Object.entries(tierBreakdown).map(([t, n]) => `  ${t}: ${n}`).join("\n") || "  None"}

DATA SOURCE: Solana blockchain (devnet) — immutable on-chain audit log
GATE PROGRAM: Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP

Generate a formal compliance report with these sections, using clear headings:

1. EXECUTIVE SUMMARY (2-3 sentences)
2. REPORTING PERIOD AND SCOPE
3. TRANSACTION ACTIVITY ANALYSIS (statistics, approval rate analysis)
4. DENIED ACCESS ANALYSIS (breakdown by reason, risk assessment)
5. CREDENTIAL TIER DISTRIBUTION (approved transactions by KYC tier)
6. FATF R.16 COMPLIANCE STATEMENT (formal statement of compliance)
7. RISK INDICATORS AND OBSERVATIONS (any patterns worth noting)
8. RECOMMENDATIONS (2-3 actionable items for regulatory posture)

Write in formal regulatory language suitable for submission to FINMA, FCA, or MAS. Be precise and factual. Do not use em dashes.`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured. Add it to Netlify environment variables." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: ReportRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  if (!Array.isArray(body.entries)) {
    return new Response(JSON.stringify({ error: "entries must be an array" }), { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(body);

  const stream = await client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
