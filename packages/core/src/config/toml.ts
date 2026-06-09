import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse } from 'smol-toml';

export function configPath(): string {
  return join(homedir(), '.kitsune', 'config.toml');
}

export function readConfigFile(): string | null {
  const p = configPath();
  return existsSync(p) ? readFileSync(p, 'utf-8') : null;
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
