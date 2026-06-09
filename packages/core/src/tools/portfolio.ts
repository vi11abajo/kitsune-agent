import type { ToolSpec } from './types.js';
import { str, optStr, optNum } from './types.js';

export function registerPortfolioTools(): ToolSpec[] {
  return [
    {
      name: 'portfolio_get', title: 'Get Portfolio', module: 'portfolio', isWrite: false, auth: 'jwt',
      description: 'Aggregated portfolio metrics across an owner\'s vaults.',
      inputSchema: {
        type: 'object',
        properties: { owner: { type: 'string', description: 'owner wallet address' } },
        required: ['owner'],
      },
      handler: async (a, ctx) => ctx.client.authedGet(`/portfolio/${str(a, 'owner')}`),
    },
    {
      name: 'portfolio_get_activity', title: 'Get Vault Activity', module: 'portfolio', isWrite: false, auth: 'jwt',
      description: 'Recent trade + strategy-event activity for a vault (paginated). page starts at 1; pageSize max 100.',
      inputSchema: {
        type: 'object',
        properties: {
          vault: { type: 'string', description: 'vault address' },
          page: { type: 'number' }, pageSize: { type: 'number' },
        },
        required: ['vault'],
      },
      handler: async (a, ctx) =>
        ctx.client.authedGet(`/activity/${str(a, 'vault')}`, { page: optNum(a, 'page'), pageSize: optNum(a, 'pageSize') }),
    },
    {
      name: 'leaderboard_get', title: 'Get Leaderboard', module: 'portfolio', isWrite: false, auth: 'none',
      description: 'Public leaderboard of top shared strategies ranked by real performance. sort one of roi,winRate,sharpe,copies (default roi). Optional pair filter (e.g. WPROS/USDC).',
      inputSchema: {
        type: 'object',
        properties: {
          sort: { type: 'string', description: 'roi | winRate | sharpe | copies (default roi)' },
          pair: { type: 'string', description: 'optional trading pair filter, e.g. WPROS/USDC' },
          page: { type: 'number' }, pageSize: { type: 'number' },
        },
      },
      handler: async (a, ctx) =>
        ctx.client.get('/marketplace/leaderboard', {
          sort: optStr(a, 'sort'), pair: optStr(a, 'pair'),
          page: optNum(a, 'page'), pageSize: optNum(a, 'pageSize'),
        }),
    },
  ];
}
