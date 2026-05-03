/**
 * netlify/functions/mcp.ts
 * Netlify Function — Leyfis MCP HTTP endpoint.
 * Uses InMemoryTransport to bridge HTTP ↔ MCP server (no SSE required).
 * Deployed at: https://leyfis-admin.netlify.app/mcp
 */
import type { Handler } from "@netlify/functions";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createLeyfisServer } from "../../packages/leyfis-mcp/dist/create-server.js";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Mcp-Session-Id",
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        service: "Leyfis MCP Server",
        version: "0.2.0",
        status: "ok",
        network: "solana-devnet",
        tools: [
          "leyfis_check_attestation",
          "leyfis_get_vault_config",
          "leyfis_get_audit_log",
          "leyfis_get_issuer_registry",
          "leyfis_simulate_gate",
          "leyfis_get_compliance_profile",
        ],
      }),
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }

  try {
    const requestBody = JSON.parse(event.body ?? "{}");

    // Bridge: InMemoryTransport lets us drive the MCP server in request/response
    // mode without needing SSE or streaming — perfect for serverless.
    const server = createLeyfisServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Capture the server's response before connecting (avoids race conditions)
    let resolveResponse: (value: unknown) => void;
    const responsePromise = new Promise<unknown>(resolve => {
      resolveResponse = resolve;
    });
    clientTransport.onmessage = (msg) => resolveResponse!(msg);

    // Connect server — sets serverTransport.onmessage = server's request handler
    await server.connect(serverTransport);

    // Send JSON-RPC request from the client side
    // clientTransport.send → serverTransport.onmessage → server processes
    // server responds via serverTransport.send → clientTransport.onmessage → promise resolves
    await clientTransport.send(requestBody);

    // Wait for response with a 25-second timeout (Netlify Functions limit: 26s)
    const response = await Promise.race([
      responsePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("MCP request timed out")), 25000)
      ),
    ]);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify(response),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Internal error", message: err?.message ?? "Unknown" }),
    };
  }
};
