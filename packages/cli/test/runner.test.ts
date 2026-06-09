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

  it('blocks write tools when --read-only is set', async () => {
    const ctx = { client: {}, chain: {}, config: { readOnly: true, hasSigner: true } } as any;
    await expect(runTool('vault_withdraw', { vault: '0x1', token: '0x2', amount: '1' }, ctx))
      .rejects.toThrow('Blocked: vault_withdraw is a write tool and --read-only is set');
  });

  it('still allows read tools when --read-only is set', async () => {
    const client = { get: vi.fn().mockResolvedValue({ price: 7 }) };
    const out = await runTool('market_get_price', { base: 'BTC', quote: 'USDT' }, { client, chain: {}, config: { readOnly: true } } as any);
    expect(out).toEqual({ price: 7 });
  });

  it('blocks jwt/signer tools when no signer is configured', async () => {
    const ctx = { client: {}, chain: {}, config: { hasSigner: false } } as any;
    await expect(runTool('vault_withdraw', {}, ctx)).rejects.toThrow(/requires a private key/);
    await expect(runTool('portfolio_get', {}, ctx)).rejects.toThrow(/requires a private key/);
  });

  it('reports unknown tool (not blocked) for typos even with --read-only', async () => {
    await expect(runTool('nope_tool', {}, { client: {}, chain: {}, config: { readOnly: true } } as any))
      .rejects.toThrow(/Unknown tool: nope_tool/);
  });
});
