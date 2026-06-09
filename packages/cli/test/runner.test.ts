import { describe, it, expect, vi } from 'vitest';
import { runTool } from '../src/runner.js';

describe('cli runTool', () => {
  it('dispatches market price to the catalog handler', async () => {
    const client = { get: vi.fn().mockResolvedValue({ price: 7 }) };
    const out = await runTool('market_get_price', { base: 'BTC', quote: 'USDT' }, { client, chain: {}, config: {} } as any);
    expect(client.get).toHaveBeenCalledWith('/prices/BTC/USDT');
    expect(out).toEqual({ price: 7 });
  });

  it('throws on unknown tool', async () => {
    await expect(runTool('nope_tool', {}, {} as any)).rejects.toThrow(/Unknown tool/);
  });
});
