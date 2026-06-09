import type { ToolSpec } from './types.js';
import { optNum } from './types.js';

export function registerFeeTools(): ToolSpec[] {
  return [
    {
      name: 'fees_get_dashboard', title: 'Get Fees Dashboard', module: 'fees', isWrite: false, auth: 'jwt',
      description: 'Your fee-earnings dashboard: creator and referrer earned/claimed totals, referral count and link.',
      inputSchema: { type: 'object', properties: {} },
      handler: async (_a, ctx) => ctx.client.authedGet('/fees/dashboard'),
    },
    {
      name: 'fees_get_history', title: 'Get Fees History', module: 'fees', isWrite: false, auth: 'jwt',
      description: 'Daily-aggregated fee earnings (as creator or referrer). Optional chainId filter.',
      inputSchema: { type: 'object', properties: { chainId: { type: 'number' } } },
      handler: async (a, ctx) => ctx.client.authedGet('/fees/history', { chainId: optNum(a, 'chainId') }),
    },
  ];
}
