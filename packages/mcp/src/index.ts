import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { resolveConfig, readConfigFile, DEFAULT_MODULES, type ModuleId } from '@kitsune-ai/agent-core';
import { createServer } from './server.js';
import { startHttpServer } from './http.js';

async function main() {
  const { values } = parseArgs({
    options: {
      profile: { type: 'string' },
      modules: { type: 'string' },
      'read-only': { type: 'boolean' },
      // --- Streamable HTTP (public read-only) mode ---
      http: { type: 'boolean' },
      host: { type: 'string' },
      port: { type: 'string' },
      path: { type: 'string' },
      'rate-limit': { type: 'string' },
      'max-sessions': { type: 'string' },
      'docs-url': { type: 'string' },
    },
  });
  const modules = values.modules ? (values.modules.split(',') as ModuleId[]) : DEFAULT_MODULES;
  const config = resolveConfig(readConfigFile(), {
    profile: values.profile,
    modules,
    readOnly: values['read-only'],
  });

  // HTTP mode: a public, read-only server reachable over the network (no key, no install for clients).
  if (values.http) {
    await startHttpServer(config, {
      host: values.host ?? '127.0.0.1',
      port: values.port ? parseInt(values.port, 10) : 8788,
      path: values.path ?? '/mcp',
      rateLimitPerMin: values['rate-limit'] ? parseInt(values['rate-limit'], 10) : 60,
      maxSessions: values['max-sessions'] ? parseInt(values['max-sessions'], 10) : 500,
      sessionTtlMs: 10 * 60_000,
      docsUrl: values['docs-url'],
    });
    return;
  }

  // Default: local stdio server (full toolset, self-custody, signs locally).
  const server = createServer(config);
  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
