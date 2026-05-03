/**
 * netlify/functions/mcp.ts
 * Netlify Function — Leyfis MCP HTTP endpoint.
 * Deployed at: https://leyfis-admin.netlify.app/mcp
 */
import serverless from "serverless-http";
import { app } from "../packages/leyfis-mcp/src/app.js";

export const handler = serverless(app);
