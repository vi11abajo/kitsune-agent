import { defineChain } from 'viem';

export const MODULES = ['market', 'vault', 'strategy', 'portfolio', 'marketplace', 'executor', 'referral', 'fees', 'notifications', 'agra'] as const;
export type ModuleId = (typeof MODULES)[number];

export const DEFAULT_MODULES: ModuleId[] = ['market', 'vault', 'strategy', 'portfolio', 'marketplace', 'executor', 'referral', 'fees', 'notifications', 'agra'];

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
  // Deposit/funding (source of truth = frontend/lib/contracts/config.ts).
  usdc: `0x${string}`; // the vault quote asset
  wrappedNative: `0x${string}`; // WPROS / WPHRS — wrap target for native-token deposits
  dodoApprove: `0x${string}`; // DODO approve proxy (spender) for swap-to-USDC on deposit
}

export const ADDRESSES_BY_CHAIN: Record<number, ChainAddresses> = {
  // Pharos Mainnet (default). Keep dexRouter/oracle in sync with the frontend's
  // DEFAULT_DEX_ROUTER / DEFAULT_ORACLE (frontend/lib/contracts/config.ts) — a vault created with
  // a stale router triggers the "Update Router" banner and won't execute strategies.
  1672: {
    vaultFactory: '0xeEAeec3354dBeE663966b4EDAF6B47bc378Eca90',
    executorRegistry: '0x16672445b12da078AC446D02c96b81a9686674e4',
    defaultDexRouter: '0xc46fc0e12C12D69BAaA110591C59e79365bFC54f', // DodoAdapter v3 (current; rollback v2 0x151CD4688Da2a0F6eec0F1D590C288D0e301ef6B)
    defaultOracle: '0x50E4553FfAF5DBaEBfE5461c252aa8E43920A2d4', // ExecutorPushOracle (current; rollback PharosPushFeedOracle 0x46bd32D30cC15F992c4968a4E62CEf0f3c61b875)
    defaultExecutor: '0x049e88506b69324604D076c3E31be0e70Cb059f5',
    usdc: '0xC879C018dB60520F4355C26eD1a6D572cdAC1815',
    wrappedNative: '0x52C48d4213107b20bC583832b0d951FB9CA8F0B0', // WPROS
    dodoApprove: '0xBF105f4ffBD3825f5433d074008B9A76237d849c',
  },
  // Pharos Atlantic (testnet)
  688689: {
    vaultFactory: '0x1518C8FE94AD3567b7b106386e384b4dD82E1Fb6',
    executorRegistry: '0x96afA8e3bad400994Db1E430C682E29aa2fFed6C',
    defaultDexRouter: '0x538FA000321828949439c7CC0cE6a52368235EA8',
    defaultOracle: '0x74513A93eF98d07C088507092540E14F65Ff44cc',
    defaultExecutor: '0x049e88506b69324604D076c3E31be0e70Cb059f5',
    usdc: '0xe0be08c77f415f577a1b3a9ad7a1df1479564ec8',
    wrappedNative: '0x838800b758277cc111b2d48ab01e5e164f8e9471', // WPHRS
    dodoApprove: '0x4Cf317b8918FbE8A890c01eDAb7d548555Ac2cE9',
  },
};

// DODO swap-route targets the deposit flow is allowed to call (defense-in-depth, mirrors
// frontend/lib/dodo.ts ALLOWED_DODO_TARGETS). The actual target comes from the backend route;
// we only execute it if it is one of these known proxies.
export const ALLOWED_DODO_TARGETS: string[] = [
  '0xf7177baf6442fb76b0833aeca3de8d4dc8ffd695', // Pharos mainnet DODO router (API target)
  '0x819829e5cf6e19f9fed92f6b4cc1edf45a2cc4a2', // DODO Route Proxy v2 (Atlantic testnet)
  '0x80465a300299e90132dfa2c7c3fc3a12424599bb', // DODO Route Proxy v1 (Atlantic testnet)
];

export const DEFAULT_CHAIN_ID = 1672; // Pharos Mainnet

export function chainFor(chainId: number) {
  return chainId === PHAROS_ATLANTIC.id ? PHAROS_ATLANTIC : PHAROS_MAINNET;
}

export function addressesFor(chainId: number): ChainAddresses {
  const addresses = ADDRESSES_BY_CHAIN[chainId];
  if (!addresses) {
    throw new Error(`Unsupported chain id: ${chainId}. Supported chain ids: ${Object.keys(ADDRESSES_BY_CHAIN).join(', ')}`);
  }
  return addresses;
}

export const DEFAULT_API_URL = 'https://api.kitsune.finance/api';
export const DEFAULT_RPC_URL = 'https://rpc.pharos.xyz';
export const DEFAULT_SIWE_DOMAIN = 'kitsune.finance';
