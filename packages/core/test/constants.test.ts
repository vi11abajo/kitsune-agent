import { describe, it, expect } from 'vitest';
import { MODULES, DEFAULT_MODULES, addressesFor, chainFor, PHAROS_MAINNET, PHAROS_ATLANTIC, DEFAULT_CHAIN_ID } from '../src/constants.js';

describe('constants', () => {
  it('lists all modules', () => {
    expect(MODULES).toEqual(['market', 'vault', 'strategy', 'portfolio', 'marketplace', 'executor', 'referral', 'fees', 'notifications', 'agra']);
  });
  it('defaults to Pharos mainnet + includes strategy module', () => {
    expect(DEFAULT_CHAIN_ID).toBe(1672);
    expect(PHAROS_MAINNET.id).toBe(1672);
    expect(DEFAULT_MODULES).toContain('market');
    expect(DEFAULT_MODULES).toContain('strategy');
  });
  it('resolves VaultFactory per chain', () => {
    expect(addressesFor(1672).vaultFactory).toBe('0xeEAeec3354dBeE663966b4EDAF6B47bc378Eca90');
    expect(addressesFor(688689).vaultFactory).toBe('0x1518C8FE94AD3567b7b106386e384b4dD82E1Fb6');
  });
  it('uses the CURRENT mainnet DEX router + oracle (keep in sync with frontend DEFAULT_DEX_ROUTER/ORACLE, else vaults get the Update-Router banner)', () => {
    expect(addressesFor(1672).defaultDexRouter).toBe('0xc46fc0e12C12D69BAaA110591C59e79365bFC54f');
    expect(addressesFor(1672).defaultOracle).toBe('0x50E4553FfAF5DBaEBfE5461c252aa8E43920A2d4');
  });
  it('pins the mainnet deposit addresses (keep in sync with frontend config.ts PHAROS_MAINNET_TOKENS / dodoApprove)', () => {
    const m = addressesFor(1672);
    expect(m.usdc).toBe('0xC879C018dB60520F4355C26eD1a6D572cdAC1815');
    expect(m.wrappedNative).toBe('0x52C48d4213107b20bC583832b0d951FB9CA8F0B0'); // WPROS
    expect(m.dodoApprove).toBe('0xBF105f4ffBD3825f5433d074008B9A76237d849c');
  });
  it('throws on unsupported chain ids instead of silently falling back', () => {
    expect(() => addressesFor(1)).toThrow('Unsupported chain id: 1. Supported chain ids: 1672, 688689');
  });
  it('still supports Pharos Atlantic testnet', () => {
    expect(PHAROS_ATLANTIC.id).toBe(688689);
    expect(chainFor(688689).id).toBe(688689);
    expect(chainFor(1672).id).toBe(1672);
  });
});
