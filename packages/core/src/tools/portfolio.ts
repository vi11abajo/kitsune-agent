import type { ToolSpec } from './types.js';
import { str, optStr } from './types.js';

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
      description: 'Recent trade activity for a vault.',
      inputSchema: {
        type: 'object',
        properties: { vault: { type: 'string', description: 'vault address' } },
        required: ['vault'],
      },
      handler: async (a, ctx) => ctx.client.authedGet(`/activity/${str(a, 'vault')}`),
    },
    {
      name: 'leaderboard_get', title: 'Get Leaderboard', module: 'portfolio', isWrite: false, auth: 'none',
      description: 'Top strategies/traders leaderboard. period one of weekly,monthly,all-time.',
      inputSchema: {
        type: 'object',
        properties: { period: { type: 'string', description: 'weekly | monthly | all-time' } },
      },
      handler: async (a, ctx) => ctx.client.get('/marketplace/leaderboard', { period: optStr(a, 'period') }),
    },
  ];
}
