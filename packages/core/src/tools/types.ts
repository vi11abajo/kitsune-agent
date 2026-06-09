import type { ModuleId } from '../constants.js';
import type { KitsuneApiClient } from '../client/api-client.js';
import type { KitsuneChain } from '../chain/chain.js';
import type { KitsuneConfig } from '../config/config.js';

export interface JsonSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

export interface ToolContext {
  client: KitsuneApiClient;
  chain: KitsuneChain;
  config: KitsuneConfig;
}

/**
 * Auth requirement for a tool:
 * - 'none'   public endpoint, no credentials needed
 * - 'jwt'    needs a SIWE/JWT session (requires a private_key to sign in)
 * - 'signer' sends an on-chain transaction (requires a private_key)
 * Both 'jwt' and 'signer' require a local private key, so tools with either are
 * hidden when no signer is configured.
 */
export type ToolAuth = 'none' | 'jwt' | 'signer';

export interface ToolSpec {
  name: string;
  title: string;
  module: ModuleId;
  description: string;
  inputSchema: JsonSchema;
  isWrite: boolean;
  auth: ToolAuth;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

export function str(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string') throw new Error(`Missing or invalid string argument: ${key}`);
  return v;
}

export function optStr(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

export function optNum(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}
