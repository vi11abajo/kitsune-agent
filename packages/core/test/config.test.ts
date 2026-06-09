import { describe, it, expect } from 'vitest';
import { resolveConfig } from '../src/config/config.js';

const TOML = `
default_profile = "testnet"
[profiles.testnet]
api_url     = "https://api.kitsune.finance/api"
chain_id    = 688689
rpc_url     = "https://atlantic.dplabs-internal.com"
private_key = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" # well-known Anvil/Hardhat test key #1 — not a secret
[profiles.readonly]
api_url        = "https://api.kitsune.finance/api"
wallet_address = "0xabc0000000000000000000000000000000000001"
`;

describe('resolveConfig', () => {
  it('loads the default profile and detects a signer', () => {
    const cfg = resolveConfig(TOML, {});
    expect(cfg.profile).toBe('testnet');
    expect(cfg.apiUrl).toBe('https://api.kitsune.finance/api');
    expect(cfg.hasSigner).toBe(true);
    expect(cfg.readOnly).toBe(false);
  });
  it('a profile with only wallet_address has no signer', () => {
    const cfg = resolveConfig(TOML, { profile: 'readonly' });
    expect(cfg.hasSigner).toBe(false);
    expect(cfg.walletAddress).toBe('0xabc0000000000000000000000000000000000001');
  });
  it('--read-only forces readOnly even with a signer', () => {
    const cfg = resolveConfig(TOML, { readOnly: true });
    expect(cfg.hasSigner).toBe(true);
    expect(cfg.readOnly).toBe(true);
  });
  it('env private key overrides TOML', () => {
    const cfg = resolveConfig(TOML, {}, { KITSUNE_PRIVATE_KEY: '0x' + '11'.repeat(32) });
    expect(cfg.privateKey).toBe('0x' + '11'.repeat(32));
  });
});
