/**
 * http-server.ts
 * Express HTTP server entry point — starts a long-running server.
 * For serverless (Netlify Functions) use, import { app } from ./app.js instead.
 */
import { app } from "./app.js";

const PORT = Number(process.env.PORT ?? 3010);

app.listen(PORT, () => {
  console.log(`[leyfis-mcp] HTTP server listening on port ${PORT}`);
  console.log(`[leyfis-mcp] POST /mcp  — MCP endpoint`);
  console.log(`[leyfis-mcp] GET  /health — health check`);
});
