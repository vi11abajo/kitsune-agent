import type { ToolSpec } from './types.js';
import { addr, optStr } from './types.js';

/** The only market the backend whitelists today: the pALPHA bond market on Kitsune USDC. */
const PALPHA_MARKET = '0xE47E9bA4EA2320A6ed87246d02Fd5C38485Ed7d1';

export function registerAgraTools(): ToolSpec[] {
  return [
    {
      name: 'agra_get_nav_history', title: 'Get pALPHA NAV History', module: 'agra', isWrite: false, auth: 'none',
      description:
        'NAV history for an Agra bond market (default: pALPHA on Kitsune USDC). ' +
        'timeframe: hour|day (default hour); range: 1w|1m|3m (default 1m).',
      inputSchema: {
        type: 'object',
        properties: {
          marketId: { type: 'string', description: `Agra market address (default ${PALPHA_MARKET} = pALPHA)` },
          timeframe: { type: 'string', enum: ['hour', 'day'] },
          range: { type: 'string', enum: ['1w', '1m', '3m'] },
        },
      },
      handler: async (a, ctx) => {
        const marketId = a.marketId === undefined ? PALPHA_MARKET : addr(a, 'marketId');
        return ctx.client.get(`/agra/nav-history/${marketId}`, {
          timeframe: optStr(a, 'timeframe'), range: optStr(a, 'range'),
        });
      },
    },
  ];
}
