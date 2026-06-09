import type { ToolSpec } from './types.js';
import { str, optStr, optNum } from './types.js';

export function registerMarketplaceTools(): ToolSpec[] {
  return [
    {
      name: 'marketplace_list', title: 'List Marketplace', module: 'marketplace', isWrite: false, auth: 'none',
      description: 'Browse active strategies shared to the marketplace. sort one of popular,newest,rating (default popular). Optional pair filter (e.g. WPROS/USDC).',
      inputSchema: {
        type: 'object',
        properties: {
          pair: { type: 'string', description: 'filter by trading pair, e.g. WPROS/USDC' },
          sort: { type: 'string', description: 'popular | newest | rating (default popular)' },
          page: { type: 'number' }, pageSize: { type: 'number' },
        },
      },
      handler: async (a, ctx) =>
        ctx.client.get('/marketplace', {
          pair: optStr(a, 'pair'), sort: optStr(a, 'sort'),
          page: optNum(a, 'page'), pageSize: optNum(a, 'pageSize'),
        }),
    },
    {
      name: 'marketplace_get', title: 'Get Marketplace Strategy', module: 'marketplace', isWrite: false, auth: 'none',
      description: 'Get a marketplace strategy by its public id.',
      inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'public strategy id' } }, required: ['id'] },
      handler: async (a, ctx) => ctx.client.get(`/marketplace/${str(a, 'id')}`),
    },
    {
      name: 'marketplace_share', title: 'Share To Marketplace', module: 'marketplace', isWrite: true, auth: 'jwt',
      description: 'Publish a strategy to the marketplace. name and tradingPair are required. strategyType is dca|grid|recurring (default dca). sourceStrategyId (if given) is a number.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' }, tradingPair: { type: 'string', description: 'e.g. WPROS/USDC' },
          description: { type: 'string' },
          strategyType: { type: 'string', description: 'dca | grid | recurring (default dca)' },
          config: { type: 'object', description: 'optional strategy config snapshot' },
          tags: { type: 'array' },
          backtestPnl: { type: 'number' }, backtestWinRate: { type: 'number' },
          sourceVaultAddress: { type: 'string' }, sourceStrategyId: { type: 'number' },
        },
        required: ['name', 'tradingPair'],
      },
      handler: async (a, ctx) =>
        ctx.client.authedSend('POST', '/marketplace', {
          name: str(a, 'name'),
          tradingPair: str(a, 'tradingPair'),
          description: optStr(a, 'description'),
          strategyType: optStr(a, 'strategyType'),
          config: a.config,
          tags: a.tags,
          backtestPnl: optNum(a, 'backtestPnl'),
          backtestWinRate: optNum(a, 'backtestWinRate'),
          sourceVaultAddress: optStr(a, 'sourceVaultAddress'),
          sourceStrategyId: optNum(a, 'sourceStrategyId'),
        }),
    },
    {
      name: 'marketplace_copy', title: 'Copy Marketplace Strategy', module: 'marketplace', isWrite: true, auth: 'jwt',
      description: 'Record a copy of a marketplace strategy (increments its copy count and returns its publicId). The actual on-chain deployment into your vault is done separately with strategy_create (+ strategy_set_metadata).',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'public strategy id' },
        },
        required: ['id'],
      },
      handler: async (a, ctx) =>
        ctx.client.authedSend('POST', `/marketplace/${str(a, 'id')}/copy`),
    },
    {
      name: 'marketplace_delist', title: 'Delist Marketplace Strategy', module: 'marketplace', isWrite: true, auth: 'jwt',
      description: 'Delist one of your strategies from the marketplace.',
      inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'public strategy id' } }, required: ['id'] },
      handler: async (a, ctx) => ctx.client.authedSend('POST', `/marketplace/${str(a, 'id')}/delist`),
    },
  ];
}
