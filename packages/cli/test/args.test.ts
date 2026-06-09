import { describe, it, expect } from 'vitest';
import { extractGlobals, parseFlags, parseTokens, resolveFriendly } from '../src/args.js';

describe('cli args', () => {
  it('extracts global flags and keeps the rest in order', () => {
    const g = extractGlobals(['--read-only', 'call', 'vault_list', '--json', '--profile', 'testnet', '--owner', '0x1']);
    expect(g.readOnly).toBe(true);
    expect(g.json).toBe(true);
    expect(g.profile).toBe('testnet');
    expect(g.rest).toEqual(['call', 'vault_list', '--owner', '0x1']);
  });

  it('splits positionals and flags', () => {
    const { positionals, flags } = parseTokens(['BTC', 'USDT', '--interval', '1h', '--limit', '100', '--force']);
    expect(positionals).toEqual(['BTC', 'USDT']);
    expect(flags).toEqual({ interval: '1h', limit: '100', force: true });
  });

  it('parseFlags coerces booleans', () => {
    expect(parseFlags(['--active', 'true', '--name', 'x'])).toEqual({ active: true, name: 'x' });
  });

  it('market candles keeps --interval/--limit flags', () => {
    const r = resolveFriendly('market candles', ['BTC', 'USDT', '--interval', '1h', '--limit', '100']);
    expect(r).toEqual({ tool: 'market_get_candles', args: { base: 'BTC', quote: 'USDT', interval: '1h', limit: '100' } });
  });

  it('market price and market indicators merge extra flags the same way', () => {
    expect(resolveFriendly('market price', ['BTC', 'USDT'])).toEqual({ tool: 'market_get_price', args: { base: 'BTC', quote: 'USDT' } });
    const r = resolveFriendly('market indicators', ['BTC', 'USDT', '--period', '14']);
    expect(r).toEqual({ tool: 'market_get_indicators', args: { base: 'BTC', quote: 'USDT', period: '14' } });
  });

  it('returns undefined for an unknown friendly command', () => {
    expect(resolveFriendly('market nope', ['BTC'])).toBeUndefined();
  });
});
