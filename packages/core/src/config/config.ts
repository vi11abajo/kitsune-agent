import { parseToml } from './toml.js';
import { DEFAULT_API_URL, DEFAULT_RPC_URL, DEFAULT_CHAIN_ID, DEFAULT_SIWE_DOMAIN, DEFAULT_MODULES, type ModuleId } from '../constants.js';

export interface CliFlags {
  profile?: string;
  modules?: ModuleId[];
  readOnly?: boolean;
}

export interface KitsuneConfig {
  profile: string;
  apiUrl: string;
  chainId: number;
  rpcUrl: string;
  privateKey?: string;
  walletAddress?: string;
  siweDomain: string;
  hasSigner: boolean;
  readOnly: boolean;
  modules: ModuleId[];
}

export function resolveConfig(
  tomlText: string | null,
  flags: CliFlags,
  env: Record<string, string | undefined> = process.env,
): KitsuneConfig {
  const toml = tomlText ? parseToml(tomlText) : {};
  const profileName = flags.profile ?? toml.default_profile ?? 'mainnet';
  const p = toml.profiles?.[profileName] ?? {};

  const privateKey = env.KITSUNE_PRIVATE_KEY ?? p.private_key;
  const walletAddress = env.KITSUNE_WALLET_ADDRESS ?? p.wallet_address;
  const hasSigner = Boolean(privateKey);

  return {
    profile: profileName,
    apiUrl: env.KITSUNE_API_URL ?? p.api_url ?? DEFAULT_API_URL,
    chainId: p.chain_id ?? DEFAULT_CHAIN_ID,
    rpcUrl: env.KITSUNE_RPC_URL ?? p.rpc_url ?? DEFAULT_RPC_URL,
    privateKey,
    walletAddress,
    siweDomain: env.KITSUNE_SIWE_DOMAIN ?? p.siwe_domain ?? DEFAULT_SIWE_DOMAIN,
    hasSigner,
    readOnly: flags.readOnly ?? false,
    modules: flags.modules ?? DEFAULT_MODULES,
  };
}
