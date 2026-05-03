/**
 * app.ts
 * Express app — exported for both the HTTP server (http-server.ts)
 * and the Netlify Function (netlify/functions/mcp.ts).
 */
import express, { Request, Response, NextFunction } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createLeyfisServer } from "./create-server.js";

export const app = express();

// ── CORS + OPTIONS preflight ───────────────────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Mcp-Session-Id");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// ── JSON body ──────────────────────────────────────────────────────────────────
app.use(express.json());

// ── Health ─────────────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "leyfis-mcp", version: "0.2.0", network: "solana-devnet" });
});

// ── MCP endpoint ───────────────────────────────────────────────────────────────
app.post("/mcp", async (req: Request, res: Response) => {
  try {
    const server    = createLeyfisServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    console.error("[leyfis-mcp] POST /mcp error:", err?.message ?? err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal MCP server error", message: err?.message ?? "Unknown" });
    }
  }
});

// ── Root info ──────────────────────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.json({
    service:     "Leyfis MCP Server",
    version:     "0.2.0",
    description: "Read-only Solana compliance tools for AI agents via Model Context Protocol",
    endpoints:   { health: "GET /health", mcp: "POST /mcp (MCP StreamableHTTP)" },
    tools: [
      "leyfis_check_attestation",
      "leyfis_get_vault_config",
      "leyfis_get_audit_log",
      "leyfis_get_issuer_registry",
      "leyfis_simulate_gate",
      "leyfis_get_compliance_profile",
    ],
    network: "solana-devnet",
  });
});
