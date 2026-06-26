import type { ToolSpec } from './types.js';
import { optStr, optNum, addr } from './types.js';

export function registerExecutorTools(): ToolSpec[] {
  return [
    {
      name: 'executor_list', title: 'List Executors', module: 'executor', isWrite: false, auth: 'none',
      description: 'List registered executors (the keepers that run strategies on-chain). Use one of these addresses as allowedExecutor when creating a strategy. By default only active executors are returned.',
      inputSchema: {
        type: 'object',
        properties: {
          active: { type: 'boolean', description: 'set false to include inactive executors (default true)' },
          chainId: { type: 'number' },
        },
      },
      // Public: the executor registry is global on-chain data, so this needs no sign-in (auth: 'none').
      handler: async (a, ctx) =>
        ctx.client.get('/executors', {
          active: typeof a.active === 'boolean' ? String(a.active) : undefined,
          chainId: optNum(a, 'chainId'),
        }),
    },
    {
      name: 'executor_get', title: 'Get Executor', module: 'executor', isWrite: false, auth: 'jwt',
      description: 'Get an executor by address, including pending / completed / failed job counts.',
      inputSchema: {
        type: 'object',
        properties: { address: { type: 'string', description: 'executor address' }, chainId: { type: 'number' } },
        required: ['address'],
      },
      handler: async (a, ctx) =>
        ctx.client.authedGet(`/executors/${addr(a, 'address')}`, { chainId: optNum(a, 'chainId') }),
    },
    {
      name: 'executor_get_jobs', title: 'Get Executor Jobs', module: 'executor', isWrite: false, auth: 'jwt',
      description: 'Paginated job history for an executor. status one of PENDING,PROCESSING,CONFIRMED,FAILED. page starts at 1; pageSize max 100.',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'executor address' },
          status: { type: 'string', description: 'PENDING | PROCESSING | CONFIRMED | FAILED' },
          page: { type: 'number' }, pageSize: { type: 'number' }, chainId: { type: 'number' },
        },
        required: ['address'],
      },
      handler: async (a, ctx) =>
        ctx.client.authedGet(`/executors/${addr(a, 'address')}/jobs`, {
          status: optStr(a, 'status'),
          page: optNum(a, 'page'),
          pageSize: optNum(a, 'pageSize'),
          chainId: optNum(a, 'chainId'),
        }),
    },
  ];
}
