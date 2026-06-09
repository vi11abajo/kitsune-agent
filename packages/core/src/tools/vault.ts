import type { Address } from 'viem';
import type { ToolSpec } from './types.js';
import { str } from './types.js';

export function registerVaultTools(): ToolSpec[] {
  return [
    {
      name: 'vault_list', title: 'List Vaults', module: 'vault', isWrite: false, auth: 'jwt',
      description: 'List the vaults owned by an address.',
      inputSchema: {
        type: 'object',
        properties: { owner: { type: 'string', description: 'owner wallet address' } },
        required: ['owner'],
      },
      handler: async (a, ctx) => ctx.client.authedGet(`/vaults/${str(a, 'owner')}`),
    },
    {
      name: 'vault_get_balances', title: 'Vault Balances', module: 'vault', isWrite: false, auth: 'jwt',
      description: 'Token balances held in a vault.',
      inputSchema: {
        type: 'object',
        properties: { vault: { type: 'string', description: 'vault address' } },
        required: ['vault'],
      },
      handler: async (a, ctx) => ctx.client.authedGet(`/vaults/${str(a, 'vault')}/balances`),
    },
    {
      name: 'vault_get_allocations', title: 'Vault Allocations', module: 'vault', isWrite: false, auth: 'jwt',
      description: 'Position / allocation breakdown for a vault.',
      inputSchema: {
        type: 'object',
        properties: { vault: { type: 'string', description: 'vault address' } },
        required: ['vault'],
      },
      handler: async (a, ctx) => ctx.client.authedGet(`/vaults/${str(a, 'vault')}/allocations`),
    },
    {
      name: 'vault_create', title: 'Create Vault', module: 'vault', isWrite: true, auth: 'signer',
      description: 'Deploy a new UserVault for your wallet via the VaultFactory. [CAUTION] Sends an on-chain transaction.',
      inputSchema: {
        type: 'object',
        properties: {
          dexRouter: { type: 'string', description: 'DEX router address' },
          oracle: { type: 'string', description: 'price oracle address' },
        },
        required: ['dexRouter', 'oracle'],
      },
      handler: async (a, ctx) => {
        const txHash = await ctx.chain.createVault(str(a, 'dexRouter') as Address, str(a, 'oracle') as Address);
        return { txHash, status: 'submitted' };
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
        const txHash = await ctx.chain.withdraw(str(a, 'vault') as Address, str(a, 'token') as Address, BigInt(str(a, 'amount')));
        return { txHash, status: 'submitted' };
      },
    },
  ];
}
