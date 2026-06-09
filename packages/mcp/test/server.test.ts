import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { MODULES, type KitsuneConfig } from '@kitsune-ai/agent-core';
import { buildMcpToolList, createServer } from '../src/server.js';

describe('mcp tool list', () => {
  it('exposes read-only annotations derived from isWrite', () => {
    const list = buildMcpToolList({ modules: ['market', 'strategy'], readOnly: false } as any);
    const price = list.find(t => t.name === 'market_get_price')!;
    expect(price.annotations.readOnlyHint).toBe(true);
    const pause = list.find(t => t.name === 'strategy_pause')!;
    expect(pause.annotations.readOnlyHint).toBe(false);
    expect(pause.annotations.destructiveHint).toBe(true);
  });
});

describe('hardened server (readOnly, no signer)', () => {
  const hardenedConfig: KitsuneConfig = {
    profile: 'public',
    apiUrl: 'https://api.kitsune.finance/api',
    chainId: 1672,
    rpcUrl: 'https://rpc.pharos.xyz',
    siweDomain: 'kitsune.finance',
    hasSigner: false,
    readOnly: true,
    modules: [...MODULES],
  };

  it('rejects tools/call for write tools by name', async () => {
    const server = createServer(hardenedConfig);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.1' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const list = await client.listTools();
    expect(list.tools.some(t => t.name === 'vault_withdraw')).toBe(false);
    expect(list.tools.some(t => t.name === 'strategy_create')).toBe(false);

    const withdraw = await client.callTool({
      name: 'vault_withdraw',
      arguments: { vault: '0x2222222222222222222222222222222222222222', token: '0x1111111111111111111111111111111111111111', amount: '1' },
    });
    expect(withdraw.isError).toBe(true);
    expect((withdraw.content as Array<{ text: string }>)[0].text).toContain('Unknown tool: vault_withdraw');

    const create = await client.callTool({ name: 'strategy_create', arguments: {} });
    expect(create.isError).toBe(true);
    expect((create.content as Array<{ text: string }>)[0].text).toContain('Unknown tool: strategy_create');

    await client.close();
    await server.close();
  });
});
