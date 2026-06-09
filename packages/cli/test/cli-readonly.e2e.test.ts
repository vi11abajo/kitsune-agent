import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const bin = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.js');

// Isolated home so the test never reads the developer's real ~/.kitsune/config.toml.
function run(args: string[]) {
  const home = mkdtempSync(join(tmpdir(), 'kitsune-cli-test-'));
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.KITSUNE_PRIVATE_KEY;
  return spawnSync(process.execPath, [bin, ...args], { env, encoding: 'utf-8' });
}

describe('kitsune binary (requires dist — run `pnpm build` first)', () => {
  it('--read-only + a write tool exits non-zero with the block message', () => {
    expect(existsSync(bin), `missing ${bin} — run \`pnpm build\` before \`pnpm test\``).toBe(true);
    const r = run(['--read-only', 'call', 'vault_withdraw', '--vault', '0x0000000000000000000000000000000000000001', '--token', '0x0000000000000000000000000000000000000002', '--amount', '1']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Blocked: vault_withdraw is a write tool and --read-only is set');
  });

  it('--json failures emit {"ok":false,...} and still exit 1', () => {
    const r = run(['--json', '--read-only', 'call', 'vault_withdraw']);
    expect(r.status).toBe(1);
    const parsed = JSON.parse(r.stdout.trim());
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain('Blocked: vault_withdraw');
  });

  it('tools --json emits a JSON array', () => {
    const r = run(['tools', '--json']);
    expect(r.status).toBe(0);
    const tools = JSON.parse(r.stdout.trim());
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.map((t: { name: string }) => t.name)).toContain('market_get_price');
  });
});
