import { describe, it, expect } from 'vitest';
import { MODULES, DEFAULT_MODULES, addressesFor, chainFor, PHAROS_MAINNET, PHAROS_ATLANTIC, DEFAULT_CHAIN_ID } from '../src/constants.js';

describe('constants', () => {
  it('lists all modules', () => {
    expect(MODULES).toEqual(['market', 'vault', 'strategy', 'portfolio', 'marketplace']);
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
  it('still supports Pharos Atlantic testnet', () => {
    expect(PHAROS_ATLANTIC.id).toBe(688689);
    expect(chainFor(688689).id).toBe(688689);
    expect(chainFor(1672).id).toBe(1672);
  });
});
