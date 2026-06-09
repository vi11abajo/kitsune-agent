import type { Address } from 'viem';
import type { ToolSpec } from './types.js';
import { str, optStr, optNum } from './types.js';
import type { StrategyConfigInput } from '../chain/strategy-config.js';

function strategyConfigSchemaProps() {
  return {
    baseToken: { type: 'string', description: 'base token address' },
    quoteToken: { type: 'string', description: 'quote token address' },
    allowedExecutor: { type: 'string', description: 'executor address allowed to trade this strategy' },
    takeProfitBps: { type: 'number', description: 'take-profit in basis points' },
    stopLossBps: { type: 'number', description: 'stop-loss in basis points' },
    maxDcaCount: { type: 'number', description: 'max DCA buys' },
    maxTradesPerDay: { type: 'number', description: 'daily trade cap' },
    active: { type: 'boolean', description: 'whether the strategy is active' },
    firstBuyAmount: { type: 'string', description: 'first buy amount in base units (decimal string)' },
    maxPositionSize: { type: 'string', description: 'max position size in base units (decimal string)' },
    dcaMultiplier: { type: 'string', description: '1e18-scaled DCA multiplier (decimal string)' },
  };
}

function buildStrategyConfig(a: Record<string, unknown>): StrategyConfigInput {
  return {
    baseToken: str(a, 'baseToken') as Address,
    quoteToken: str(a, 'quoteToken') as Address,
    allowedExecutor: str(a, 'allowedExecutor') as Address,
    takeProfitBps: Number(a.takeProfitBps),
    stopLossBps: Number(a.stopLossBps),
    maxDcaCount: Number(a.maxDcaCount),
    maxTradesPerDay: Number(a.maxTradesPerDay),
    active: Boolean(a.active),
    firstBuyAmount: str(a, 'firstBuyAmount'),
    maxPositionSize: str(a, 'maxPositionSize'),
    dcaMultiplier: str(a, 'dcaMultiplier'),
  };
}

const CONFIG_REQUIRED = [
  'baseToken', 'quoteToken', 'allowedExecutor', 'takeProfitBps', 'stopLossBps',
  'maxDcaCount', 'maxTradesPerDay', 'active', 'firstBuyAmount', 'maxPositionSize', 'dcaMultiplier',
];

export function registerStrategyTools(): ToolSpec[] {
  return [
    // ---- reads (jwt) ----
    {
      name: 'strategy_list', title: 'List Strategies', module: 'strategy', isWrite: false, auth: 'jwt',
      description: 'List strategies in a vault.',
      inputSchema: { type: 'object', properties: { vault: { type: 'string' } }, required: ['vault'] },
      handler: async (a, ctx) => ctx.client.authedGet(`/vaults/${str(a, 'vault')}/strategies`),
    },
    {
      name: 'strategy_get', title: 'Get Strategy', module: 'strategy', isWrite: false, auth: 'jwt',
      description: 'Get a single strategy by vault + strategyId.',
      inputSchema: { type: 'object', properties: { vault: { type: 'string' }, strategyId: { type: 'string' } }, required: ['vault', 'strategyId'] },
      handler: async (a, ctx) => ctx.client.authedGet(`/vaults/${str(a, 'vault')}/strategies/${str(a, 'strategyId')}`),
    },
    {
      name: 'strategy_get_position', title: 'Get Strategy Position', module: 'strategy', isWrite: false, auth: 'jwt',
      description: 'Get the open position state for a strategy.',
      inputSchema: { type: 'object', properties: { vault: { type: 'string' }, strategyId: { type: 'string' } }, required: ['vault', 'strategyId'] },
      handler: async (a, ctx) => ctx.client.authedGet(`/vaults/${str(a, 'vault')}/strategies/${str(a, 'strategyId')}/position`),
    },
    {
      name: 'strategy_get_trades', title: 'Get Strategy Trades', module: 'strategy', isWrite: false, auth: 'jwt',
      description: 'Paginated trade history for a strategy.',
      inputSchema: {
        type: 'object',
        properties: { vault: { type: 'string' }, strategyId: { type: 'string' }, limit: { type: 'number' }, offset: { type: 'number' } },
        required: ['vault', 'strategyId'],
      },
      handler: async (a, ctx) =>
        ctx.client.authedGet(`/strategies/${str(a, 'vault')}/${str(a, 'strategyId')}/trades`, {
          limit: optNum(a, 'limit'), offset: optNum(a, 'offset'),
        }),
    },
    {
      name: 'strategy_get_metrics', title: 'Get Strategy Metrics', module: 'strategy', isWrite: false, auth: 'jwt',
      description: 'PnL, win rate and Sharpe for a strategy.',
      inputSchema: { type: 'object', properties: { vault: { type: 'string' }, strategyId: { type: 'string' } }, required: ['vault', 'strategyId'] },
      handler: async (a, ctx) => ctx.client.authedGet(`/strategies/${str(a, 'vault')}/${str(a, 'strategyId')}/metrics`),
    },

    // ---- on-chain writes (signer) ----
    {
      name: 'strategy_create', title: 'Create Strategy', module: 'strategy', isWrite: true, auth: 'signer',
      description: 'Create a new trading strategy in a vault on-chain. [CAUTION] Sends an on-chain transaction.',
      inputSchema: {
        type: 'object',
        properties: { vault: { type: 'string', description: 'UserVault address' }, ...strategyConfigSchemaProps() },
        required: ['vault', ...CONFIG_REQUIRED],
      },
      handler: async (a, ctx) => {
        const txHash = await ctx.chain.createStrategy(str(a, 'vault') as Address, buildStrategyConfig(a));
        return { txHash, status: 'submitted' };
      },
    },
    {
      name: 'strategy_update', title: 'Update Strategy', module: 'strategy', isWrite: true, auth: 'signer',
      description: 'Update an existing strategy config on-chain. [CAUTION] Sends an on-chain transaction.',
      inputSchema: {
        type: 'object',
        properties: { vault: { type: 'string' }, strategyId: { type: 'string' }, ...strategyConfigSchemaProps() },
        required: ['vault', 'strategyId', ...CONFIG_REQUIRED],
      },
      handler: async (a, ctx) => {
        const txHash = await ctx.chain.updateStrategy(str(a, 'vault') as Address, BigInt(str(a, 'strategyId')), buildStrategyConfig(a));
        return { txHash, status: 'submitted' };
      },
    },
    {
      name: 'strategy_pause', title: 'Pause Strategy', module: 'strategy', isWrite: true, auth: 'signer',
      description: 'Pause a strategy on-chain so the executor stops trading it. [CAUTION] Sends an on-chain transaction.',
      inputSchema: { type: 'object', properties: { vault: { type: 'string' }, strategyId: { type: 'string' } }, required: ['vault', 'strategyId'] },
      handler: async (a, ctx) => {
        const txHash = await ctx.chain.pauseStrategy(str(a, 'vault') as Address, BigInt(str(a, 'strategyId')));
        return { txHash, status: 'submitted' };
      },
    },
    {
      name: 'strategy_resume', title: 'Resume Strategy', module: 'strategy', isWrite: true, auth: 'signer',
      description: 'Resume a paused strategy on-chain. [CAUTION] Sends an on-chain transaction.',
      inputSchema: { type: 'object', properties: { vault: { type: 'string' }, strategyId: { type: 'string' } }, required: ['vault', 'strategyId'] },
      handler: async (a, ctx) => {
        const txHash = await ctx.chain.resumeStrategy(str(a, 'vault') as Address, BigInt(str(a, 'strategyId')));
        return { txHash, status: 'submitted' };
      },
    },
    {
      name: 'strategy_withdraw', title: 'Withdraw Strategy', module: 'strategy', isWrite: true, auth: 'signer',
      description: 'Withdraw the base token from a strategy position back to the vault owner. [CAUTION] Moves funds on-chain.',
      inputSchema: { type: 'object', properties: { vault: { type: 'string' }, strategyId: { type: 'string' } }, required: ['vault', 'strategyId'] },
      handler: async (a, ctx) => {
        const txHash = await ctx.chain.withdrawStrategy(str(a, 'vault') as Address, BigInt(str(a, 'strategyId')));
        return { txHash, status: 'submitted' };
      },
    },

    // ---- off-chain writes (jwt) ----
    {
      name: 'strategy_restart_cycle', title: 'Restart Strategy Cycle', module: 'strategy', isWrite: true, auth: 'jwt',
      description: 'Reset the DCA/grid cycle counters for a strategy (off-chain bookkeeping).',
      inputSchema: { type: 'object', properties: { vault: { type: 'string' }, strategyId: { type: 'string' } }, required: ['vault', 'strategyId'] },
      handler: async (a, ctx) =>
        ctx.client.authedSend('POST', `/vaults/${str(a, 'vault')}/strategies/${str(a, 'strategyId')}/restart-cycle`),
    },
    {
      name: 'strategy_set_metadata', title: 'Set Strategy Metadata', module: 'strategy', isWrite: true, auth: 'jwt',
      description: 'Update a strategy display name and/or tags (off-chain).',
      inputSchema: {
        type: 'object',
        properties: {
          vault: { type: 'string' }, strategyId: { type: 'string' },
          name: { type: 'string' }, tags: { type: 'array' },
        },
        required: ['vault', 'strategyId'],
      },
      handler: async (a, ctx) =>
        ctx.client.authedSend('PUT', `/vaults/${str(a, 'vault')}/strategies/${str(a, 'strategyId')}/metadata`, {
          name: optStr(a, 'name'), tags: a.tags,
        }),
    },
    {
      name: 'strategy_hide', title: 'Hide Strategy', module: 'strategy', isWrite: true, auth: 'jwt',
      description: 'Mark a strategy as hidden (off-chain).',
      inputSchema: { type: 'object', properties: { vault: { type: 'string' }, strategyId: { type: 'string' } }, required: ['vault', 'strategyId'] },
      handler: async (a, ctx) =>
        ctx.client.authedSend('POST', `/vaults/${str(a, 'vault')}/strategies/${str(a, 'strategyId')}/hide`),
    },
    {
      name: 'strategy_restore', title: 'Restore Strategy', module: 'strategy', isWrite: true, auth: 'jwt',
      description: 'Restore a previously hidden strategy (off-chain).',
      inputSchema: { type: 'object', properties: { vault: { type: 'string' }, strategyId: { type: 'string' } }, required: ['vault', 'strategyId'] },
      handler: async (a, ctx) =>
        ctx.client.authedSend('POST', `/vaults/${str(a, 'vault')}/strategies/${str(a, 'strategyId')}/restore`),
    },
  ];
}
