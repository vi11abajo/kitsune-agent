import type { Address } from 'viem';
import type { ToolSpec } from './types.js';
import { str, optStr, addr } from './types.js';
import type { DepositToken, DepositRoute } from '../chain/chain.js';

export function registerVaultTools(): ToolSpec[] {
  return [
    {
      name: 'vault_list', title: 'Get Vault', module: 'vault', isWrite: false, auth: 'jwt',
      description: 'Get the vault owned by an address (returns its address, DEX router, oracle, createdAt, and strategyCount). 404 if the owner has no vault.',
      inputSchema: {
        type: 'object',
        properties: { owner: { type: 'string', description: 'owner wallet address' } },
        required: ['owner'],
      },
      handler: async (a, ctx) => ctx.client.authedGet(`/vaults/${addr(a, 'owner')}`),
    },
    {
      name: 'vault_get_balances', title: 'Vault Balances', module: 'vault', isWrite: false, auth: 'jwt',
      description: 'Token balances held in a vault.',
      inputSchema: {
        type: 'object',
        properties: { vault: { type: 'string', description: 'vault address' } },
        required: ['vault'],
      },
      handler: async (a, ctx) => ctx.client.authedGet(`/vaults/${addr(a, 'vault')}/balances`),
    },
    {
      name: 'vault_get_allocations', title: 'Vault Allocations', module: 'vault', isWrite: false, auth: 'jwt',
      description: 'Position / allocation breakdown for a vault.',
      inputSchema: {
        type: 'object',
        properties: { vault: { type: 'string', description: 'vault address' } },
        required: ['vault'],
      },
      handler: async (a, ctx) => ctx.client.authedGet(`/vaults/${addr(a, 'vault')}/allocations`),
    },
    {
      name: 'vault_create', title: 'Create Vault', module: 'vault', isWrite: true, auth: 'signer',
      description: 'Deploy a new UserVault for your wallet via the VaultFactory. Uses the chain default DEX router and oracle unless overridden. [CAUTION] Sends an on-chain transaction.',
      inputSchema: {
        type: 'object',
        properties: {
          dexRouter: { type: 'string', description: 'optional DEX router address (defaults to chain default)' },
          oracle: { type: 'string', description: 'optional price oracle address (defaults to chain default)' },
        },
      },
      handler: async (a, ctx) => {
        let dexRouter = optStr(a, 'dexRouter');
        let oracle = optStr(a, 'oracle');
        // Prefer the live canonical addresses from the backend so a vault is never created with a
        // stale router/oracle (which the dApp flags as "Update Router" and which blocks execution).
        // Fall back to the kit's baked chain defaults if /config is unreachable or old.
        if (!dexRouter || !oracle) {
          try {
            const cfg = (await ctx.client.get('/config', { chainId: ctx.config.chainId })) as { dexRouter?: string; oracle?: string };
            dexRouter = dexRouter ?? cfg?.dexRouter;
            oracle = oracle ?? cfg?.oracle;
          } catch {
            /* offline / older backend — KitsuneChain.createVault uses the baked chain defaults */
          }
        }
        const txHash = await ctx.chain.createVault(dexRouter as Address | undefined, oracle as Address | undefined);
        return { txHash, status: 'submitted' };
      },
    },
    {
      name: 'vault_deposit', title: 'Deposit Into Vault', module: 'vault', isWrite: true, auth: 'signer',
      description:
        'Fund your vault with USDC (the quote asset strategies trade). token is usdc | wpros | native (PROS) or a token address — wpros/native/other are auto-swapped to USDC via DODO first. amount is in the input token base units (USDC 6dp, WPROS/native 18dp). vault defaults to your own vault. For native PROS, leave some balance for gas. [CAUTION] Moves funds on-chain (may wrap + swap + transfer).',
      inputSchema: {
        type: 'object',
        properties: {
          amount: { type: 'string', description: 'amount of the input token in base units (decimal string)' },
          token: { type: 'string', description: 'usdc (default) | wpros | native | <token address>' },
          vault: { type: 'string', description: 'vault address (defaults to your vault)' },
        },
        required: ['amount'],
      },
      handler: async (a, ctx) => {
        const owner = ctx.chain.address;
        if (!owner) throw new Error('vault_deposit requires a signer wallet — add a private_key to your profile.');
        const vault = (optStr(a, 'vault') ? addr(a, 'vault') : await ctx.chain.getVault(owner)) as Address;
        const raw = (optStr(a, 'token') ?? 'usdc').toLowerCase();
        const token: DepositToken =
          raw === 'usdc' || raw === 'wpros' || raw === 'native' ? raw : (addr(a, 'token') as Address);
        const amount = BigInt(str(a, 'amount'));
        const usdc = ctx.chain.addresses.usdc;
        // DODO route provider (fresh per attempt) — same endpoint as market_get_dodo_route.
        const getRoute = async (fromToken: Address, fromAmount: bigint): Promise<DepositRoute> => {
          const resp = (await ctx.client.authedGet('/dodo/route', {
            fromTokenAddress: fromToken,
            toTokenAddress: usdc,
            fromAmount: fromAmount.toString(),
            slippage: 3,
            userAddr: owner,
          })) as { data?: { to?: string; data?: string; priceImpact?: string | number } };
          const r = resp?.data;
          if (!r?.to || !r?.data) throw new Error('Failed to get a DODO swap route for the deposit.');
          return {
            target: r.to as Address,
            callData: r.data as `0x${string}`,
            priceImpact: typeof r.priceImpact === 'string' ? parseFloat(r.priceImpact) : r.priceImpact ?? 0,
          };
        };
        const result = await ctx.chain.deposit({ vault, token, amount, getRoute });
        return { ...result, status: 'submitted' };
      },
    },
    {
      name: 'vault_withdraw', title: 'Withdraw From Vault', module: 'vault', isWrite: true, auth: 'signer',
      description: 'Withdraw a token balance from a vault to the owner. [CAUTION] Moves funds on-chain.',
      inputSchema: {
        type: 'object',
        properties: {
          vault: { type: 'string', description: 'vault address' },
          token: { type: 'string', description: 'token address to withdraw' },
          amount: { type: 'string', description: 'amount in base units (decimal string)' },
        },
        required: ['vault', 'token', 'amount'],
      },
      handler: async (a, ctx) => {
        const txHash = await ctx.chain.withdraw(addr(a, 'vault') as Address, addr(a, 'token') as Address, BigInt(str(a, 'amount')));
        return { txHash, status: 'submitted' };
      },
    },
  ];
}
