import { defineChain } from 'viem';

export const MODULES = ['market', 'vault', 'strategy', 'portfolio', 'marketplace'] as const;
export type ModuleId = (typeof MODULES)[number];

export const DEFAULT_MODULES: ModuleId[] = ['market', 'vault', 'strategy', 'portfolio', 'marketplace'];

export const PHAROS_MAINNET = defineChain({
  id: 1672,
  name: 'Pharos',
  nativeCurrency: { decimals: 18, name: 'Pharos', symbol: 'PROS' },
  rpcUrls: { default: { http: ['https://rpc.pharos.xyz'] } },
  blockExplorers: { default: { name: 'PharosScan', url: 'https://www.pharosscan.xyz' } },
});

export const PHAROS_ATLANTIC = defineChain({
  id: 688689,
  name: 'Pharos Atlantic',
  nativeCurrency: { decimals: 18, name: 'PHRS', symbol: 'PHRS' },
  rpcUrls: { default: { http: ['https://atlantic.dplabs-internal.com'] } },
  blockExplorers: { default: { name: 'Pharos Explorer', url: 'https://atlantic.pharosscan.xyz' } },
});

export interface ChainAddresses {
  vaultFactory: `0x${string}`;
  executorRegistry: `0x${string}`;
  defaultDexRouter: `0x${string}`;
  defaultOracle: `0x${string}`;
  defaultExecutor: `0x${string}`;
}

export const ADDRESSES_BY_CHAIN: Record<number, ChainAddresses> = {
  // Pharos Mainnet (default)
  1672: {
    vaultFactory: '0xeEAeec3354dBeE663966b4EDAF6B47bc378Eca90',
    executorRegistry: '0x16672445b12da078AC446D02c96b81a9686674e4',
    defaultDexRouter: '0x151CD4688Da2a0F6eec0F1D590C288D0e301ef6B',
    defaultOracle: '0xA3D35f18edEcc2A0dE239a871B90f233d972c6fe',
    defaultExecutor: '0x049e88506b69324604D076c3E31be0e70Cb059f5',
  },
  // Pharos Atlantic (testnet)
  688689: {
    vaultFactory: '0x1518C8FE94AD3567b7b106386e384b4dD82E1Fb6',
    executorRegistry: '0x96afA8e3bad400994Db1E430C682E29aa2fFed6C',
    defaultDexRouter: '0x538FA000321828949439c7CC0cE6a52368235EA8',
    defaultOracle: '0x74513A93eF98d07C088507092540E14F65Ff44cc',
    defaultExecutor: '0x049e88506b69324604D076c3E31be0e70Cb059f5',
  },
};

export const DEFAULT_CHAIN_ID = 1672; // Pharos Mainnet

export function chainFor(chainId: number) {
  return chainId === PHAROS_ATLANTIC.id ? PHAROS_ATLANTIC : PHAROS_MAINNET;
}

export function addressesFor(chainId: number): ChainAddresses {
  return ADDRESSES_BY_CHAIN[chainId] ?? ADDRESSES_BY_CHAIN[DEFAULT_CHAIN_ID];
}

export const DEFAULT_API_URL = 'https://api.kitsune.finance/api';
export const DEFAULT_RPC_URL = 'https://rpc.pharos.xyz';
export const DEFAULT_SIWE_DOMAIN = 'kitsune.finance';
