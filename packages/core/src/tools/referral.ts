import type { ToolSpec } from './types.js';
import { str } from './types.js';

export function registerReferralTools(): ToolSpec[] {
  return [
    {
      name: 'referral_get_code', title: 'Get Referral Code', module: 'referral', isWrite: false, auth: 'jwt',
      description: 'Get (or auto-create) your referral code and shareable link.',
      inputSchema: { type: 'object', properties: {} },
      handler: async (_a, ctx) => ctx.client.authedGet('/referral/code'),
    },
    {
      name: 'referral_resolve', title: 'Resolve Referral Code', module: 'referral', isWrite: false, auth: 'none',
      description: 'Resolve a referral code to the referrer wallet address.',
      inputSchema: {
        type: 'object',
        properties: { code: { type: 'string', description: '8-char referral code' } },
        required: ['code'],
      },
      handler: async (a, ctx) => ctx.client.get('/referral/resolve', { code: str(a, 'code') }),
    },
    {
      name: 'referral_get_stats', title: 'Get Referral Stats', module: 'referral', isWrite: false, auth: 'jwt',
      description: 'Your referral stats: total referrals and recent referred wallets.',
      inputSchema: { type: 'object', properties: {} },
      handler: async (_a, ctx) => ctx.client.authedGet('/referral/stats'),
    },
    {
      name: 'referral_link', title: 'Link Referrer', module: 'referral', isWrite: true, auth: 'jwt',
      description: 'Link a referrer to your account by their code. One-time only; self-referral is rejected.',
      inputSchema: {
        type: 'object',
        properties: { code: { type: 'string', description: '8-char referral code' } },
        required: ['code'],
      },
      handler: async (a, ctx) => ctx.client.authedSend('POST', '/referral/link', { code: str(a, 'code') }),
    },
  ];
}
