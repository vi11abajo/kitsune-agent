import { describe, it, expect } from 'vitest';
import { MODULES, DEFAULT_MODULES, ADDRESSES, PHAROS_ATLANTIC } from '../src/constants.js';

describe('constants', () => {
  it('lists all modules', () => {
    expect(MODULES).toEqual(['market', 'vault', 'strategy', 'portfolio', 'marketplace']);
  });
  it('defaults to read-safe + strategy modules', () => {
    expect(DEFAULT_MODULES).toContain('market');
    expect(DEFAULT_MODULES).toContain('strategy');
  });
  it('knows the VaultFactory address', () => {
    expect(ADDRESSES.vaultFactory).toBe('0x1518C8FE94AD3567b7b106386e384b4dD82E1Fb6');
  });
  it('defines Pharos Atlantic chain id', () => {
    expect(PHAROS_ATLANTIC.id).toBe(688689);
  });
});
