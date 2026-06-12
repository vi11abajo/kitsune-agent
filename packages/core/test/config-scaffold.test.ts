import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { scaffoldConfig, CONFIG_TEMPLATE, parseToml, resolveConfig } from '../src/index.js';

const tmpRoots: string[] = [];
function tmpPath(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kitsune-cfg-'));
  tmpRoots.push(d);
  return path.join(d, 'nested', 'config.toml'); // nested → also proves mkdir -p
}
afterAll(() => {
  for (const d of tmpRoots) fs.rmSync(d, { recursive: true, force: true });
});

describe('config scaffolding', () => {
  it('creates the file with the template when absent (and makes parent dirs)', () => {
    const p = tmpPath();
    const r = scaffoldConfig(p);
    expect(r.created).toBe(true);
    expect(r.path).toBe(p);
    expect(fs.readFileSync(p, 'utf8')).toBe(CONFIG_TEMPLATE);
  });

  it('never overwrites an existing config', () => {
    const p = tmpPath();
    scaffoldConfig(p);
    fs.writeFileSync(p, 'default_profile = "mine"');
    const r = scaffoldConfig(p);
    expect(r.created).toBe(false);
    expect(fs.readFileSync(p, 'utf8')).toBe('default_profile = "mine"');
  });

  it('the template is valid TOML and resolves to a safe read-only config (empty key)', () => {
    const toml = parseToml(CONFIG_TEMPLATE);
    expect(toml.default_profile).toBe('mainnet');
    expect(toml.profiles?.mainnet?.chain_id).toBe(1672);
    // empty private_key placeholder must NOT be treated as a signer
    const cfg = resolveConfig(CONFIG_TEMPLATE, {}, {});
    expect(cfg.hasSigner).toBe(false);
    expect(cfg.chainId).toBe(1672);
  });
});
