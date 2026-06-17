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
        ctx.client.get(`/prices/${encodeURIComponent(str(a, 'base').toUpperCase())}/${encodeURIComponent(str(a, 'quote').toUpperCase())}`),
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
        ctx.client.get(`/prices/${encodeURIComponent(str(a, 'base').toUpperCase())}/${encodeURIComponent(str(a, 'quote').toUpperCase())}/candles`, {
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
        ctx.client.get(`/prices/${encodeURIComponent(str(a, 'base').toUpperCase())}/${encodeURIComponent(str(a, 'quote').toUpperCase())}/indicators`),
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
      name: 'market_get_dodo_route', title: 'Get DODO Swap Route', module: 'market', isWrite: false, auth: 'jwt',
      description: 'Get a DODO swap route/quote on Pharos for swapping fromToken -> toToken. fromAmount is in base units (integer string) of fromToken. Requires sign-in. No funds are moved.',
      inputSchema: {
        type: 'object',
        properties: {
          fromToken: { type: 'string', description: 'sell token address (0x...)' },
          toToken: { type: 'string', description: 'buy token address (0x...)' },
          fromAmount: { type: 'string', description: 'amount to sell, in base units (integer string)' },
          slippage: { type: 'number', description: 'slippage % (0.1-50, default 1)' },
          userAddr: { type: 'string', description: 'swapper address (defaults to your wallet)' },
        },
        required: ['fromToken', 'toToken', 'fromAmount'],
      },
      handler: async (a, ctx) =>
        ctx.client.authedGet('/dodo/route', {
          fromTokenAddress: str(a, 'fromToken'),
          toTokenAddress: str(a, 'toToken'),
          fromAmount: str(a, 'fromAmount'),
          slippage: optNum(a, 'slippage'),
          userAddr: optStr(a, 'userAddr') ?? ctx.chain.address,
        }),
    },
    {
      name: 'market_get_grid_cost', title: 'Get Grid Cost Estimate', module: 'market', isWrite: false, auth: 'none',
      description: 'Round-trip cost estimate (costPct, PERCENT) for a grid on BASE/QUOTE token addresses, with recommendedMaxZones / recommendedMinStepPct and a source badge (measured|default). A grid is only profitable when its per-zone step return exceeds costPct: netPerCycle% = (per-zone step %) - costPct must be > 0. No funds moved.',
      inputSchema: {
        type: 'object',
        properties: {
          base: { type: 'string', description: 'base token address (0x...)' },
          quote: { type: 'string', description: 'quote token address (0x...)' },
          upper: { type: 'number', description: 'grid upper price (enables recommendations)' },
          lower: { type: 'number', description: 'grid lower price (enables recommendations)' },
          gridType: { type: 'string', description: 'arithmetic | geometric' },
          gridCount: { type: 'number', description: 'number of zones' },
        },
        required: ['base', 'quote'],
      },
      handler: async (a, ctx) =>
        ctx.client.get('/grid/cost-estimate', {
          base: str(a, 'base'),
          quote: str(a, 'quote'),
          upper: optNum(a, 'upper'),
          lower: optNum(a, 'lower'),
          gridType: optStr(a, 'gridType'),
          gridCount: optNum(a, 'gridCount'),
        }),
    },
    {
      name: 'market_run_backtest', title: 'Run Backtest', module: 'market', isWrite: false, auth: 'jwt',
      description: 'Run a strategy backtest simulation (no funds moved; requires sign-in). config requires: pair (BASE/QUOTE), strategyType (dca|grid|recurring), timeframe (1m..1d), startDate, endDate; plus strategy params (e.g. initialOrderAmount, dcaOrderAmount, takeProfitPercent, stopLossPercent, stopLossEnabled; grid: gridUpperPrice, gridLowerPrice, gridCount).',
      inputSchema: {
        type: 'object',
        properties: { config: { type: 'object', description: 'Backtest config: pair (BASE/QUOTE), startDate, endDate, and strategy parameters' } },
        required: ['config'],
      },
      handler: async (a, ctx) => ctx.client.authedSend('POST', '/backtest/run', a.config),
    },
  ];
}
