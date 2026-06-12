import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { parse } from 'smol-toml';

export function configPath(): string {
  return join(homedir(), '.kitsune', 'config.toml');
}

export function readConfigFile(): string | null {
  const p = configPath();
  return existsSync(p) ? readFileSync(p, 'utf-8') : null;
}

/**
 * Starter config written on first run / `kitsune config init`.
 * private_key is left empty on purpose: an empty value resolves to read-only
 * (no signer), so a fresh install never holds a key and never crashes — the
 * user fills it in. SECURITY: the key belongs in this file only, never in chat.
 */
export const CONFIG_TEMPLATE = `# Kitsune Agent Trade Kit — credentials
# SECURITY: never paste your private key into a chat, a command line, or share it.
# It belongs in this file ONLY. Restrict the file to your user:
#   chmod 600 ~/.kitsune/config.toml

default_profile = "mainnet"

[profiles.mainnet]
api_url     = "https://api.kitsune.finance/api"
chain_id    = 1672
rpc_url     = "https://rpc.pharos.xyz"
private_key = ""              # 0x… — required ONLY for sign-in + on-chain tools; empty = read-only

# Pharos Atlantic testnet — risk-free
[profiles.testnet]
api_url     = "https://api.kitsune.finance/api"
chain_id    = 688689
rpc_url     = "https://atlantic.dplabs-internal.com"
private_key = ""

# Read-only identity: a public address, no key
[profiles.readonly]
wallet_address = ""
`;

/**
 * Create the config file with placeholders if it does not exist yet.
 * Never overwrites an existing config. Returns whether it was created.
 * `target` is overridable for testing; defaults to the real config path.
 */
export function scaffoldConfig(target: string = configPath()): { created: boolean; path: string } {
  if (existsSync(target)) return { created: false, path: target };
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, CONFIG_TEMPLATE, { encoding: 'utf-8', mode: 0o600 });
  try {
    chmodSync(target, 0o600); // best-effort; no-op on Windows
  } catch {
    /* non-POSIX filesystem — ignore */
  }
  return { created: true, path: target };
}

export interface RawProfile {
  api_url?: string;
  chain_id?: number;
  rpc_url?: string;
  private_key?: string;
  wallet_address?: string;
  siwe_domain?: string;
}

export interface RawToml {
  default_profile?: string;
  profiles?: Record<string, RawProfile>;
}

export function parseToml(text: string): RawToml {
  return parse(text) as RawToml;
}
