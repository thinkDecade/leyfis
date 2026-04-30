import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ScanRequest {
  minTier: number;
  jurisdictions: string[];
  issuerCount: number;
  paused: boolean;
}

function buildPrompt(req: ScanRequest): string {
  const { minTier, jurisdictions, issuerCount, paused } = req;
  const jurDisplay = jurisdictions.length > 0 ? jurisdictions.join(", ") : "all jurisdictions";
  const tierLabel  = minTier === 3 ? "Tier 3 (Institutional)" : minTier === 2 ? "Tier 2 (Enhanced DD)" : "Tier 1 (Basic KYC)";

  return `You are a regulatory intelligence analyst monitoring compliance requirements for a DeFi vault operator using the Leyfis Protocol on Solana.

CURRENT VAULT CONFIGURATION:
- Minimum KYC tier required: ${tierLabel}
- Active jurisdictions: ${jurDisplay}
- Trusted issuers: ${issuerCount}
- Gate status: ${paused ? "PAUSED" : "ACTIVE"}
- Protocol: Leyfis Gate (on-chain KYC enforcement, Solana devnet)

Generate exactly 3 regulatory intelligence items relevant to this vault's configuration. Each item must be a real or realistic regulatory development from FATF, FINMA, FCA, MAS, or BIS that would require an operational response from the vault operator.

Return your response as a JSON array of exactly 3 objects. Each object must have these exact fields:
{
  "source": "FATF" | "FINMA" | "FCA" | "MAS" | "BIS" | "EBA",
  "title": "Short title (under 80 chars)",
  "summary": "1-2 sentence summary of the development",
  "fullText": "2-3 sentence detailed explanation of implications",
  "proposedChange": {
    "min_tier": 1 | 2 | 3 | null,
    "add_jurisdictions": ["ISO3"] | null,
    "remove_jurisdictions": ["ISO3"] | null
  },
  "urgency": "high" | "medium" | "low",
  "jurisdiction": "CHE" | "GBR" | "SGP" | "USA" | "EUR" | "GLOBAL",
  "effectiveDate": "YYYY-MM-DD"
}

Rules:
- proposedChange fields should be non-null only when the development clearly requires a specific config change
- effectiveDate must be between 2026-05-01 and 2026-12-31
- At least one item must be urgency "high"
- Make items substantively different from each other — one on jurisdiction changes, one on tier requirements, one on systemic risk
- Do not include any text outside the JSON array — return only the raw JSON`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured on server." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: ScanRequest;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 }); }

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: buildPrompt(body) }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
    const jsonStart = text.indexOf("[");
    const jsonEnd   = text.lastIndexOf("]") + 1;
    const proposals = JSON.parse(jsonStart >= 0 ? text.slice(jsonStart, jsonEnd) : text);

    return new Response(JSON.stringify(proposals), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Scan failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
