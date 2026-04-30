import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface NLConfigRequest {
  instruction: string;
  currentConfig: {
    minTier: number;
    allowedJurisdictions: string[];
    paused: boolean;
  };
}

interface ConfigDelta {
  min_tier: number | null;
  allowed_jurisdictions: string[] | null;
}

interface NLConfigResponse {
  proposed_delta: ConfigDelta;
  explanation: string;
  warnings: string[];
  confidence: "high" | "medium" | "low";
}

const ALL_JURISDICTIONS = ["CHE", "GBR", "SGP", "USA", "DEU", "FRA", "LUX", "ARE", "HKG", "JPN"];

function buildPrompt(req: NLConfigRequest): string {
  const { instruction, currentConfig } = req;
  const jurDisplay = currentConfig.allowedJurisdictions.length > 0
    ? currentConfig.allowedJurisdictions.join(", ")
    : "all jurisdictions";
  const tierLabel = currentConfig.minTier === 3 ? "Institutional" : currentConfig.minTier === 2 ? "Enhanced DD" : "Basic KYC";

  return `You are a compliance configuration assistant for the Leyfis Protocol, a KYC-gated DeFi vault on Solana.

CURRENT VAULT CONFIGURATION:
- Minimum KYC tier: ${currentConfig.minTier} (${tierLabel})
- Allowed jurisdictions: ${jurDisplay}
- Gate status: ${currentConfig.paused ? "PAUSED" : "ACTIVE"}

TIER DEFINITIONS:
- Tier 1 = Basic KYC (retail, name + ID verified)
- Tier 2 = Enhanced Due Diligence (accredited investor + source of funds)
- Tier 3 = Institutional (full FATF institutional, AML policy, beneficial ownership)

AVAILABLE JURISDICTIONS: ${ALL_JURISDICTIONS.join(", ")}

OPERATOR INSTRUCTION: "${instruction}"

Parse this plain-English instruction and return a JSON object with EXACTLY these fields:
{
  "proposed_delta": {
    "min_tier": <1|2|3|null — null means no change>,
    "allowed_jurisdictions": <["ISO3",...] | null — null means no change, empty array means all permitted>
  },
  "explanation": "<1-2 sentences explaining what will change and why>",
  "warnings": ["<any compliance or operational risks — empty array if none>"],
  "confidence": "<high|medium|low>"
}

Rules:
- Only include jurisdictions from the available list above
- If the instruction is ambiguous, set confidence to "low" and explain in warnings
- If the instruction would lower security (reduce tier, open jurisdictions), add a warning
- If the instruction mentions "FATF high risk" countries (Iran, North Korea, Myanmar) being removed, confidence should be high
- If nothing needs to change, set both delta fields to null
- Return ONLY the JSON object — no other text`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: NLConfigRequest;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 }); }

  if (!body.instruction?.trim()) {
    return new Response(JSON.stringify({ error: "instruction is required" }), { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: buildPrompt(body) }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const jsonStart = text.indexOf("{");
    const jsonEnd   = text.lastIndexOf("}") + 1;
    const result: NLConfigResponse = JSON.parse(jsonStart >= 0 ? text.slice(jsonStart, jsonEnd) : text);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Parsing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
