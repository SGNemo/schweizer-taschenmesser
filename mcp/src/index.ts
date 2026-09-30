#!/usr/bin/env node
/**
 * Nemo MCP server (stdio). Configure with the environment variables
 * TASCHENMESSER_TOKEN (required) and TASCHENMESSER_URL (default http://127.0.0.1:47631).
 * stdout belongs to the protocol; messages go to stderr and never contain the token.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createApi } from './api.js';
import { ConfigError, readConfig } from './config.js';
import { createServer } from './server.js';

try {
  const config = readConfig(process.env);
  await createServer(createApi(config)).connect(new StdioServerTransport());
} catch (e) {
  process.stderr.write(`${e instanceof ConfigError ? e.message : 'Start fehlgeschlagen.'}\n`);
  process.exit(1);
}
