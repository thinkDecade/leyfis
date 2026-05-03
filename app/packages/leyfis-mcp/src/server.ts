#!/usr/bin/env node
/**
 * server.ts — stdio entry point for Claude Desktop / local MCP clients.
 * All tool logic lives in create-server.ts.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLeyfisServer } from "./create-server.js";

const server    = createLeyfisServer();
const transport = new StdioServerTransport();
await server.connect(transport);
