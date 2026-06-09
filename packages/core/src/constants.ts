import { defineChain } from 'viem';

export const MODULES = ['market', 'vault', 'strategy', 'portfolio', 'marketplace'] as const;
export type ModuleId = (typeof MODULES)[number];

export const DEFAULT_MODULES: ModuleId[] = ['market', 'vault', 'strategy', 'portfolio', 'marketplace'];

export const ADDRESSES = {
  vaultFactory: '0x1518C8FE94AD3567b7b106386e384b4dD82E1Fb6',
  executorRegistry: '0x96afA8e3bad400994Db1E430C682E29aa2fFed6C',
} as const;

export const PHAROS_ATLANTIC = defineChain({
  id: 688689,
  name: 'Pharos Atlantic',
  nativeCurrency: { decimals: 18, name: 'PHRS', symbol: 'PHRS' },
  rpcUrls: { default: { http: ['https://atlantic.dplabs-internal.com'] } },
  blockExplorers: { default: { name: 'Pharos Explorer', url: 'https://atlantic.pharosscan.xyz' } },
});

export const DEFAULT_API_URL = 'https://api.kitsune.finance/api';
export const DEFAULT_SIWE_DOMAIN = 'kitsune.finance';
