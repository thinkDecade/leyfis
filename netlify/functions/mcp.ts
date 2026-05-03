/**
 * netlify/functions/mcp.ts
 * Netlify Function — wraps the Leyfis MCP Express app with serverless-http.
 * Deployed to leyfis-admin.netlify.app/.netlify/functions/mcp
 * (redirected to /mcp via netlify.toml)
 */
import serverless from "serverless-http";
import { app } from "../../app/packages/leyfis-mcp/src/app.js";

export const handler = serverless(app);
