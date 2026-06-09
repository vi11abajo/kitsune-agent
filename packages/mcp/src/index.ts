import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { resolveConfig, readConfigFile, DEFAULT_MODULES, type ModuleId } from '@kitsune-ai/agent-core';
import { createServer } from './server.js';

async function main() {
  const { values } = parseArgs({
    options: {
      profile: { type: 'string' },
      modules: { type: 'string' },
      'read-only': { type: 'boolean' },
    },
  });
  const modules = values.modules ? (values.modules.split(',') as ModuleId[]) : DEFAULT_MODULES;
  const config = resolveConfig(readConfigFile(), {
    profile: values.profile,
    modules,
    readOnly: values['read-only'],
  });
  const server = createServer(config);
  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
