import { describe, it, expect } from 'vitest';
import { buildClientRegistration, SUPPORTED_CLIENTS } from '../src/setup.js';

describe('cli setup', () => {
  it('registers kitsune-mcp for a known client', () => {
    const r = buildClientRegistration('cursor');
    expect(r.registration.mcpServers.kitsune.command).toBe('kitsune-mcp');
    expect(r.registration.mcpServers.kitsune.args).toEqual(['--profile', 'mainnet']);
    expect(r.configHint).toContain('cursor');
  });

  it('honors a custom profile', () => {
    const r = buildClientRegistration('claude-desktop', 'live');
    expect(r.registration.mcpServers.kitsune.args).toEqual(['--profile', 'live']);
  });

  it('lists supported clients', () => {
    expect(SUPPORTED_CLIENTS).toContain('claude-desktop');
    expect(SUPPORTED_CLIENTS).toContain('vscode');
  });
});
