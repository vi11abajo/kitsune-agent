import { describe, it, expect, vi } from 'vitest';
import { allToolSpecs, buildTools } from '../src/tools/index.js';
import { MODULES } from '../src/constants.js';
import { seg, addr, num } from '../src/tools/types.js';
import type { ToolContext } from '../src/tools/types.js';

function ctxWith(over: Partial<{ client: any; chain: any }>): ToolContext {
  return { client: over.client ?? {}, chain: over.chain ?? {}, config: {} } as unknown as ToolContext;
}

const find = (name: string) => allToolSpecs().find(t => t.name === name)!;

const OWNER = '0x1111111111111111111111111111111111111111';
const VAULT = '0x2222222222222222222222222222222222222222';
const EXECUTOR = '0x3333333333333333333333333333333333333333';

describe('tool catalog', () => {
  it('includes representative tools from every module', () => {
    const names = allToolSpecs().map(t => t.name);
    expect(names).toContain('market_get_price');
    expect(names).toContain('vault_list');
    expect(names).toContain('strategy_pause');
    expect(names).toContain('portfolio_get');
    expect(names).toContain('marketplace_list');
  });

  it('buildTools drops write tools in read-only mode', () => {
    const tools = buildTools({ modules: ['market', 'strategy'], readOnly: true });
    expect(tools.some(t => t.name === 'strategy_pause')).toBe(false);
    expect(tools.some(t => t.name === 'market_get_price')).toBe(true);
  });

  it('buildTools filters by module', () => {
    const tools = buildTools({ modules: ['market'], readOnly: false });
    expect(tools.every(t => t.module === 'market')).toBe(true);
  });

  it('buildTools hides auth-requiring tools when no signer', () => {
    const tools = buildTools({ modules: [...MODULES], readOnly: false, hasSigner: false });
    expect(tools.every(t => t.auth === 'none')).toBe(true);
    expect(tools.some(t => t.name === 'market_get_price')).toBe(true);
    expect(tools.some(t => t.name === 'leaderboard_get')).toBe(true);
    expect(tools.some(t => t.name === 'marketplace_list')).toBe(true);
    expect(tools.some(t => t.name === 'vault_list')).toBe(false);
    expect(tools.some(t => t.name === 'strategy_pause')).toBe(false);
    expect(tools.some(t => t.name === 'market_run_backtest')).toBe(false);
    expect(tools.some(t => t.name === 'referral_resolve')).toBe(true);
    expect(tools.some(t => t.name === 'executor_list')).toBe(false);
    expect(tools.some(t => t.name === 'fees_get_dashboard')).toBe(false);
  });

  // ---- read handlers ----
  it('market_get_price calls client.get with the price path', async () => {
    const client = { get: vi.fn().mockResolvedValue({ price: 42 }) };
    const out = await find('market_get_price').handler({ base: 'btc', quote: 'usdt' }, ctxWith({ client }));
    expect(client.get).toHaveBeenCalledWith('/prices/BTC/USDT');
    expect(out).toEqual({ price: 42 });
  });

  it('vault_list uses authedGet', async () => {
    const client = { authedGet: vi.fn().mockResolvedValue({ vaults: [] }) };
    await find('vault_list').handler({ owner: OWNER }, ctxWith({ client }));
    expect(client.authedGet).toHaveBeenCalledWith(`/vaults/${OWNER}`);
  });

  it('strategy_get_metrics uses authedGet with the strategies path', async () => {
    const client = { authedGet: vi.fn().mockResolvedValue({}) };
    await find('strategy_get_metrics').handler({ vault: VAULT, strategyId: '3' }, ctxWith({ client }));
    expect(client.authedGet).toHaveBeenCalledWith(`/strategies/${VAULT}/3/metrics`);
  });

  it('portfolio_get uses authedGet', async () => {
    const client = { authedGet: vi.fn().mockResolvedValue({}) };
    await find('portfolio_get').handler({ owner: OWNER }, ctxWith({ client }));
    expect(client.authedGet).toHaveBeenCalledWith(`/portfolio/${OWNER}`);
  });

  it('marketplace_list uses public get with pair/sort params', async () => {
    const client = { get: vi.fn().mockResolvedValue([]) };
    await find('marketplace_list').handler({ pair: 'WPROS/USDC', sort: 'newest' }, ctxWith({ client }));
    expect(client.get).toHaveBeenCalledWith('/marketplace', { pair: 'WPROS/USDC', sort: 'newest', page: undefined, pageSize: undefined });
  });

  // ---- write handlers ----
  it('market_run_backtest posts the config via authedSend', async () => {
    const client = { authedSend: vi.fn().mockResolvedValue({}) };
    const cfg = { pair: 'BTC/USDT', startDate: '2024-01-01', endDate: '2024-02-01' };
    await find('market_run_backtest').handler({ config: cfg }, ctxWith({ client }));
    expect(client.authedSend).toHaveBeenCalledWith('POST', '/backtest/run', cfg);
  });

  it('market_get_dodo_route uses authedGet and defaults userAddr to the wallet', async () => {
    const client = { authedGet: vi.fn().mockResolvedValue({}) };
    const chain = { address: '0xme' };
    await find('market_get_dodo_route').handler({ fromToken: '0xA', toToken: '0xB', fromAmount: '1000' }, ctxWith({ client, chain }));
    expect(client.authedGet).toHaveBeenCalledWith('/dodo/route', {
      fromTokenAddress: '0xA', toTokenAddress: '0xB', fromAmount: '1000', slippage: undefined, userAddr: '0xme',
    });
  });

  // A client whose vault holds `bal` base units of the quote token and has `alloc` committed.
  const fundedClient = (quote: string, bal: string, alloc = '0') => ({
    authedGet: vi.fn().mockImplementation((path: string) => {
      if (path.endsWith('/balances')) return Promise.resolve({ balances: [{ token: quote, symbol: 'USDC', decimals: 6, balance: bal }] });
      if (path.endsWith('/allocations')) return Promise.resolve({ [quote.toLowerCase()]: { allocated: alloc } });
      return Promise.resolve({});
    }),
  });

  it('strategy_create calls chain.createStrategy and returns a tx result', async () => {
    const chain = { createStrategy: vi.fn().mockResolvedValue('0xabc') };
    const client = fundedClient(VAULT, '5000000'); // exactly enough for maxPositionSize
    const out = await find('strategy_create').handler({
      vault: VAULT,
      baseToken: OWNER, quoteToken: VAULT, allowedExecutor: EXECUTOR,
      takeProfitBps: 500, stopLossBps: 1000, maxDcaCount: 5, maxTradesPerDay: 3, active: true,
      firstBuyAmount: '1000000', maxPositionSize: '5000000', dcaMultiplier: '15000',
    }, ctxWith({ chain, client }));
    expect(chain.createStrategy).toHaveBeenCalledTimes(1);
    const [vaultArg, cfgArg] = chain.createStrategy.mock.calls[0];
    expect(vaultArg).toBe(VAULT);
    expect(cfgArg.dcaMultiplier).toBe('15000');
    expect(out).toEqual({ txHash: '0xabc', status: 'submitted' });
  });

  it('strategy_create refuses when the vault lacks free funds (hard guard)', async () => {
    const chain = { createStrategy: vi.fn() };
    const client = fundedClient(VAULT, '1000000'); // only 1 USDC, strategy needs 5
    await expect(find('strategy_create').handler({
      vault: VAULT,
      baseToken: OWNER, quoteToken: VAULT, allowedExecutor: EXECUTOR,
      takeProfitBps: 500, stopLossBps: 1000, maxDcaCount: 5, maxTradesPerDay: 3, active: true,
      firstBuyAmount: '1000000', maxPositionSize: '5000000', dcaMultiplier: '15000',
    }, ctxWith({ chain, client }))).rejects.toThrow(/InsufficientVaultFunds/);
    expect(chain.createStrategy).not.toHaveBeenCalled();
  });

  it('strategy_create counts already-committed allocations as not free', async () => {
    const chain = { createStrategy: vi.fn() };
    const client = fundedClient(VAULT, '6000000', '5000000'); // 6 balance − 5 committed = 1 free
    await expect(find('strategy_create').handler({
      vault: VAULT,
      baseToken: OWNER, quoteToken: VAULT, allowedExecutor: EXECUTOR,
      takeProfitBps: 500, stopLossBps: 1000, maxDcaCount: 5, maxTradesPerDay: 3, active: true,
      firstBuyAmount: '1000000', maxPositionSize: '5000000', dcaMultiplier: '15000',
    }, ctxWith({ chain, client }))).rejects.toThrow(/InsufficientVaultFunds/);
    expect(chain.createStrategy).not.toHaveBeenCalled();
  });

  it('vault_deposit defaults the vault and forwards token/amount to chain.deposit', async () => {
    const chain = {
      address: OWNER,
      addresses: { usdc: '0xUSDC' },
      getVault: vi.fn().mockResolvedValue(VAULT),
      deposit: vi.fn().mockResolvedValue({ txHash: '0xdep', usdcDeposited: '200000000' }),
    };
    const out = await find('vault_deposit').handler({ amount: '200000000' }, ctxWith({ chain, client: {} }));
    expect(chain.getVault).toHaveBeenCalledWith(OWNER);
    const arg = chain.deposit.mock.calls[0][0];
    expect(arg.vault).toBe(VAULT);
    expect(arg.token).toBe('usdc');
    expect(arg.amount).toBe(200000000n);
    expect(out).toMatchObject({ txHash: '0xdep', status: 'submitted' });
  });

  it('vault_deposit accepts native PROS and an explicit vault', async () => {
    const chain = {
      address: OWNER,
      addresses: { usdc: '0xUSDC' },
      getVault: vi.fn(),
      deposit: vi.fn().mockResolvedValue({ txHash: '0xdep', usdcDeposited: '0' }),
    };
    await find('vault_deposit').handler({ amount: '1000000000000000000', token: 'native', vault: VAULT }, ctxWith({ chain, client: {} }));
    expect(chain.getVault).not.toHaveBeenCalled();
    const arg = chain.deposit.mock.calls[0][0];
    expect(arg.vault).toBe(VAULT);
    expect(arg.token).toBe('native');
  });

  it('vault_deposit fails clearly without a signer wallet', async () => {
    await expect(find('vault_deposit').handler({ amount: '1' }, ctxWith({ chain: {}, client: {} })))
      .rejects.toThrow(/signer wallet/);
  });

  it('strategy_create rejects a non-numeric takeProfitBps instead of passing NaN on-chain', async () => {
    const chain = { createStrategy: vi.fn() };
    await expect(find('strategy_create').handler({
      vault: VAULT,
      baseToken: OWNER, quoteToken: VAULT, allowedExecutor: EXECUTOR,
      takeProfitBps: 'oops', stopLossBps: 1000, maxDcaCount: 5, maxTradesPerDay: 3, active: true,
      firstBuyAmount: '1000000', maxPositionSize: '5000000', dcaMultiplier: '15000',
    }, ctxWith({ chain }))).rejects.toThrow(/takeProfitBps/);
    expect(chain.createStrategy).not.toHaveBeenCalled();
  });

  it('marketplace_share auto-fills authorAddress from the signer wallet', async () => {
    const client = { authedSend: vi.fn().mockResolvedValue({ publicId: 1 }) };
    const chain = { address: '0xMEWALLET' };
    await find('marketplace_share').handler({ name: 'My grid', tradingPair: 'WPROS/USDC', sourceStrategyId: 0 }, ctxWith({ client, chain }));
    expect(client.authedSend).toHaveBeenCalledWith('POST', '/marketplace', expect.objectContaining({
      authorAddress: '0xMEWALLET', name: 'My grid', tradingPair: 'WPROS/USDC', sourceStrategyId: 0,
    }));
  });

  it('marketplace_share fails clearly when there is no signer wallet', async () => {
    const client = { authedSend: vi.fn() };
    await expect(find('marketplace_share').handler({ name: 'x', tradingPair: 'WPROS/USDC' }, ctxWith({ client, chain: {} })))
      .rejects.toThrow(/signer wallet/);
    expect(client.authedSend).not.toHaveBeenCalled();
  });

  it('vault_create resolves router/oracle from the backend /config (no stale baked address)', async () => {
    const client = { get: vi.fn().mockResolvedValue({ dexRouter: '0xROUTER', oracle: '0xORACLE' }) };
    const chain = { createVault: vi.fn().mockResolvedValue('0xtx') };
    const ctx = { client, chain, config: { chainId: 1672 } } as unknown as ToolContext;
    const out = await find('vault_create').handler({}, ctx);
    expect(client.get).toHaveBeenCalledWith('/config', { chainId: 1672 });
    expect(chain.createVault).toHaveBeenCalledWith('0xROUTER', '0xORACLE');
    expect(out).toEqual({ txHash: '0xtx', status: 'submitted' });
  });

  it('vault_create falls back to the kit chain defaults when /config is unreachable', async () => {
    const client = { get: vi.fn().mockRejectedValue(new Error('offline')) };
    const chain = { createVault: vi.fn().mockResolvedValue('0xtx') };
    const ctx = { client, chain, config: { chainId: 1672 } } as unknown as ToolContext;
    await find('vault_create').handler({}, ctx);
    // both undefined → KitsuneChain.createVault applies its own baked defaults
    expect(chain.createVault).toHaveBeenCalledWith(undefined, undefined);
  });

  it('vault_create does not call /config when both addresses are passed explicitly', async () => {
    const client = { get: vi.fn() };
    const chain = { createVault: vi.fn().mockResolvedValue('0xtx') };
    const ctx = { client, chain, config: { chainId: 1672 } } as unknown as ToolContext;
    await find('vault_create').handler({ dexRouter: '0xA', oracle: '0xB' }, ctx);
    expect(client.get).not.toHaveBeenCalled();
    expect(chain.createVault).toHaveBeenCalledWith('0xA', '0xB');
  });

  it('marketplace_copy uses authedSend with the copy path (no body)', async () => {
    const client = { authedSend: vi.fn().mockResolvedValue({}) };
    await find('marketplace_copy').handler({ id: '7' }, ctxWith({ client }));
    expect(client.authedSend).toHaveBeenCalledWith('POST', '/marketplace/7/copy');
  });

  it('referral_resolve uses public get', async () => {
    const client = { get: vi.fn().mockResolvedValue({ address: '0xr' }) };
    await find('referral_resolve').handler({ code: 'ABCD2345' }, ctxWith({ client }));
    expect(client.get).toHaveBeenCalledWith('/referral/resolve', { code: 'ABCD2345' });
  });

  it('executor_get_jobs uses authedGet with pagination + status', async () => {
    const client = { authedGet: vi.fn().mockResolvedValue({}) };
    await find('executor_get_jobs').handler({ address: EXECUTOR, status: 'CONFIRMED', page: 2, pageSize: 50 }, ctxWith({ client }));
    expect(client.authedGet).toHaveBeenCalledWith(`/executors/${EXECUTOR}/jobs`, { status: 'CONFIRMED', page: 2, pageSize: 50, chainId: undefined });
  });

  it('strategy_set_config PUTs metadata without vault/strategyId in the body', async () => {
    const client = { authedSend: vi.fn().mockResolvedValue({}) };
    await find('strategy_set_config').handler({ vault: VAULT, strategyId: '3', strategyType: 'grid', gridCount: 20 }, ctxWith({ client }));
    expect(client.authedSend).toHaveBeenCalledWith('PUT', `/vaults/${VAULT}/strategies/3/metadata`, { strategyType: 'grid', gridCount: 20 });
  });

  it('notifications_set_preferences PUTs the args as body', async () => {
    const client = { authedSend: vi.fn().mockResolvedValue({}) };
    await find('notifications_set_preferences').handler({ notifyBuy: false }, ctxWith({ client }));
    expect(client.authedSend).toHaveBeenCalledWith('PUT', '/notifications/preferences', { notifyBuy: false });
  });

  it('agra_get_nav_history is public and defaults to the pALPHA market', async () => {
    const client = { get: vi.fn().mockResolvedValue([]) };
    await find('agra_get_nav_history').handler({ timeframe: 'day' }, ctxWith({ client }));
    expect(client.get).toHaveBeenCalledWith(
      '/agra/nav-history/0xE47E9bA4EA2320A6ed87246d02Fd5C38485Ed7d1',
      { timeframe: 'day', range: undefined },
    );
    expect(find('agra_get_nav_history').auth).toBe('none');
  });

  it('agra_get_nav_history rejects a malformed marketId', async () => {
    const client = { get: vi.fn() };
    await expect(find('agra_get_nav_history').handler({ marketId: '../x' }, ctxWith({ client })))
      .rejects.toThrow('Invalid address argument: marketId');
    expect(client.get).not.toHaveBeenCalled();
  });

  it('strategy_get_grid_orders hits the grid-orders path', async () => {
    const client = { authedGet: vi.fn().mockResolvedValue({ isGrid: true }) };
    await find('strategy_get_grid_orders').handler({ vault: VAULT, strategyId: '1' }, ctxWith({ client }));
    expect(client.authedGet).toHaveBeenCalledWith(`/vaults/${VAULT}/strategies/1/grid-orders`);
  });

  it('strategy_get_by_uuid encodes the uuid path segment', async () => {
    const client = { authedGet: vi.fn().mockResolvedValue({}) };
    await find('strategy_get_by_uuid').handler({ vault: VAULT, uuid: 'abc/../def' }, ctxWith({ client }));
    expect(client.authedGet).toHaveBeenCalledWith(`/vaults/${VAULT}/strategies/by-uuid/abc%2F..%2Fdef`);
  });

  it('strategy_list_trash lists hidden strategies', async () => {
    const client = { authedGet: vi.fn().mockResolvedValue([]) };
    await find('strategy_list_trash').handler({ vault: VAULT }, ctxWith({ client }));
    expect(client.authedGet).toHaveBeenCalledWith(`/vaults/${VAULT}/strategies/trash`);
  });
});

describe('path argument helpers', () => {
  it('seg URL-encodes path traversal attempts', () => {
    expect(seg({ id: '../auth/nonce' }, 'id')).toBe('..%2Fauth%2Fnonce');
    expect(seg({ id: 'a?b=c#d' }, 'id')).toBe('a%3Fb%3Dc%23d');
  });

  it('addr accepts a valid EVM address as-is', () => {
    expect(addr({ owner: OWNER }, 'owner')).toBe(OWNER);
  });

  it('addr rejects malformed addresses naming the argument', () => {
    expect(() => addr({ owner: '../auth/nonce' }, 'owner')).toThrow('Invalid address argument: owner');
    expect(() => addr({ owner: '0x123' }, 'owner')).toThrow('Invalid address argument: owner');
    expect(() => addr({}, 'owner')).toThrow('Missing or invalid string argument: owner');
  });

  it('num rejects NaN and non-finite values naming the argument', () => {
    expect(num({ bps: 500 }, 'bps')).toBe(500);
    expect(num({ bps: '500' }, 'bps')).toBe(500);
    expect(() => num({ bps: 'abc' }, 'bps')).toThrow('Missing or invalid number argument: bps');
    expect(() => num({ bps: Infinity }, 'bps')).toThrow('Missing or invalid number argument: bps');
    expect(() => num({}, 'bps')).toThrow('Missing or invalid number argument: bps');
  });
});

describe('path injection hardening', () => {
  it('vault_list rejects a path-traversing owner before any request is made', async () => {
    const client = { authedGet: vi.fn() };
    await expect(find('vault_list').handler({ owner: '../auth/nonce' }, ctxWith({ client }))).rejects.toThrow('Invalid address argument: owner');
    expect(client.authedGet).not.toHaveBeenCalled();
  });

  it('marketplace_get encodes the id so it cannot traverse paths', async () => {
    const client = { get: vi.fn().mockResolvedValue({}) };
    await find('marketplace_get').handler({ id: '../auth/nonce' }, ctxWith({ client }));
    expect(client.get).toHaveBeenCalledWith('/marketplace/..%2Fauth%2Fnonce');
  });

  it('strategy_get encodes the strategyId path segment', async () => {
    const client = { authedGet: vi.fn().mockResolvedValue({}) };
    await find('strategy_get').handler({ vault: VAULT, strategyId: '3/../../x' }, ctxWith({ client }));
    expect(client.authedGet).toHaveBeenCalledWith(`/vaults/${VAULT}/strategies/3%2F..%2F..%2Fx`);
  });

  it('market_get_price encodes base/quote path segments', async () => {
    const client = { get: vi.fn().mockResolvedValue({}) };
    await find('market_get_price').handler({ base: '../auth', quote: 'usdt' }, ctxWith({ client }));
    expect(client.get).toHaveBeenCalledWith('/prices/..%2FAUTH/USDT');
  });
});
