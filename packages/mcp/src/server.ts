import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { buildTools, KitsuneApiClient, KitsuneChain, type KitsuneConfig } from '@kitsune/agent-core';
import { privateKeyToAccount } from 'viem/accounts';

export function buildMcpToolList(config: KitsuneConfig) {
  return buildTools(config).map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: {
      title: t.title,
      readOnlyHint: !t.isWrite,
      destructiveHint: t.isWrite,
      idempotentHint: !t.isWrite,
      openWorldHint: true,
    },
  }));
}

export function createServer(config: KitsuneConfig): Server {
  const account = config.privateKey ? privateKeyToAccount(config.privateKey as `0x${string}`) : undefined;
  const client = new KitsuneApiClient({
    apiUrl: config.apiUrl,
    siweDomain: config.siweDomain,
    chainId: config.chainId,
    signer: account ? { address: account.address, signMessage: (a) => account.signMessage(a) } : undefined,
  });
  const chain = new KitsuneChain({ rpcUrl: config.rpcUrl, privateKey: config.privateKey as `0x${string}` | undefined });
  const tools = buildTools(config);
  const toolMap = new Map(tools.map(t => [t.name, t]));

  const server = new Server({ name: 'kitsune-agent-mcp', version: '0.1.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: buildMcpToolList(config) }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = toolMap.get(req.params.name);
    if (!tool) {
      return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }] };
    }
    try {
      const data = await tool.handler(req.params.arguments ?? {}, { client, chain, config });
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true, data }) }] };
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: JSON.stringify({ ok: false, message: (e as Error).message }) }] };
    }
  });

  return server;
}
