import type { ToolSpec } from './types.js';
import { str, optStr } from './types.js';

export function registerMarketplaceTools(): ToolSpec[] {
  return [
    {
      name: 'marketplace_list', title: 'List Marketplace', module: 'marketplace', isWrite: false, auth: 'none',
      description: 'Browse active strategies shared to the marketplace.',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'filter, e.g. active' },
          tradingPair: { type: 'string', description: 'filter by pair, e.g. BTC/USDT' },
        },
      },
      handler: async (a, ctx) => ctx.client.get('/marketplace', { status: optStr(a, 'status'), tradingPair: optStr(a, 'tradingPair') }),
    },
    {
      name: 'marketplace_get', title: 'Get Marketplace Strategy', module: 'marketplace', isWrite: false, auth: 'none',
      description: 'Get a marketplace strategy by its public id.',
      inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'public strategy id' } }, required: ['id'] },
      handler: async (a, ctx) => ctx.client.get(`/marketplace/${str(a, 'id')}`),
    },
    {
      name: 'marketplace_share', title: 'Share To Marketplace', module: 'marketplace', isWrite: true, auth: 'jwt',
      description: 'Publish one of your strategies to the marketplace.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' }, description: { type: 'string' },
          sourceVaultAddress: { type: 'string' }, sourceStrategyId: { type: 'string' },
          tradingPair: { type: 'string' }, tags: { type: 'array' },
        },
        required: ['name', 'sourceVaultAddress', 'sourceStrategyId'],
      },
      handler: async (a, ctx) =>
        ctx.client.authedSend('POST', '/marketplace', {
          name: str(a, 'name'),
          description: optStr(a, 'description'),
          sourceVaultAddress: str(a, 'sourceVaultAddress'),
          sourceStrategyId: str(a, 'sourceStrategyId'),
          tradingPair: optStr(a, 'tradingPair'),
          tags: a.tags,
        }),
    },
    {
      name: 'marketplace_copy', title: 'Copy Marketplace Strategy', module: 'marketplace', isWrite: true, auth: 'jwt',
      description: 'Copy a marketplace strategy into one of your vaults.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'public strategy id' },
          vault: { type: 'string', description: 'destination vault address' },
        },
        required: ['id', 'vault'],
      },
      handler: async (a, ctx) =>
        ctx.client.authedSend('POST', `/marketplace/${str(a, 'id')}/copy`, { vault: str(a, 'vault') }),
    },
    {
      name: 'marketplace_delist', title: 'Delist Marketplace Strategy', module: 'marketplace', isWrite: true, auth: 'jwt',
      description: 'Delist one of your strategies from the marketplace.',
      inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'public strategy id' } }, required: ['id'] },
      handler: async (a, ctx) => ctx.client.authedSend('POST', `/marketplace/${str(a, 'id')}/delist`),
    },
  ];
}
