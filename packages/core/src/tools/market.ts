import type { ToolSpec } from './types.js';
import { str, optStr, optNum } from './types.js';

export function registerMarketTools(): ToolSpec[] {
  return [
    {
      name: 'market_get_price', title: 'Get Price', module: 'market', isWrite: false, auth: 'none',
      description: 'Current price and 24h stats for a BASE/QUOTE pair.',
      inputSchema: {
        type: 'object',
        properties: { base: { type: 'string', description: 'e.g. BTC' }, quote: { type: 'string', description: 'e.g. USDT' } },
        required: ['base', 'quote'],
      },
      handler: async (a, ctx) =>
        ctx.client.get(`/prices/${str(a, 'base').toUpperCase()}/${str(a, 'quote').toUpperCase()}`),
    },
    {
      name: 'market_get_candles', title: 'Get Candles', module: 'market', isWrite: false, auth: 'none',
      description: 'OHLCV candles. interval one of 1m,3m,5m,15m,30m,1h,4h,1d.',
      inputSchema: {
        type: 'object',
        properties: {
          base: { type: 'string' }, quote: { type: 'string' },
          interval: { type: 'string' }, limit: { type: 'number' },
        },
        required: ['base', 'quote'],
      },
      handler: async (a, ctx) =>
        ctx.client.get(`/prices/${str(a, 'base').toUpperCase()}/${str(a, 'quote').toUpperCase()}/candles`, {
          interval: optStr(a, 'interval'),
          limit: optNum(a, 'limit'),
        }),
    },
    {
      name: 'market_get_indicators', title: 'Get Indicators', module: 'market', isWrite: false, auth: 'none',
      description: 'RSI/MACD/EMA/Bollinger for a BASE/QUOTE pair.',
      inputSchema: {
        type: 'object',
        properties: { base: { type: 'string' }, quote: { type: 'string' } },
        required: ['base', 'quote'],
      },
      handler: async (a, ctx) =>
        ctx.client.get(`/prices/${str(a, 'base').toUpperCase()}/${str(a, 'quote').toUpperCase()}/indicators`),
    },
    {
      name: 'market_batch_prices', title: 'Batch Prices', module: 'market', isWrite: false, auth: 'none',
      description: 'Prices for up to 10 pairs at once. pairs = comma-separated BASE/QUOTE list.',
      inputSchema: {
        type: 'object',
        properties: { pairs: { type: 'string', description: 'e.g. "BTC/USDT,ETH/USDC" (max 10)' } },
        required: ['pairs'],
      },
      handler: async (a, ctx) => ctx.client.get('/prices/batch', { pairs: str(a, 'pairs') }),
    },
    {
      name: 'market_get_dodo_pools', title: 'Get DODO Pools', module: 'market', isWrite: false, auth: 'none',
      description: 'List DODO liquidity pools available on Pharos.',
      inputSchema: { type: 'object', properties: {} },
      handler: async (_a, ctx) => ctx.client.get('/dodo'),
    },
    {
      name: 'market_run_backtest', title: 'Run Backtest', module: 'market', isWrite: false, auth: 'jwt',
      description: 'Run a strategy backtest simulation. config = { pair, startDate, endDate, ...strategy params }. Requires sign-in (no funds moved).',
      inputSchema: {
        type: 'object',
        properties: { config: { type: 'object', description: 'Backtest config: pair (BASE/QUOTE), startDate, endDate, and strategy parameters' } },
        required: ['config'],
      },
      handler: async (a, ctx) => ctx.client.authedSend('POST', '/backtest/run', a.config),
    },
  ];
}
