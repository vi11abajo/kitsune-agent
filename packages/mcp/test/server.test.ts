import { describe, it, expect } from 'vitest';
import { buildMcpToolList } from '../src/server.js';

describe('mcp tool list', () => {
  it('exposes read-only annotations derived from isWrite', () => {
    const list = buildMcpToolList({ modules: ['market', 'strategy'], readOnly: false } as any);
    const price = list.find(t => t.name === 'market_get_price')!;
    expect(price.annotations.readOnlyHint).toBe(true);
    const pause = list.find(t => t.name === 'strategy_pause')!;
    expect(pause.annotations.readOnlyHint).toBe(false);
    expect(pause.annotations.destructiveHint).toBe(true);
  });
});
