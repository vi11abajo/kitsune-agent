import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { bundledSkillsDir, listSkills, installSkills, zipSkills, buildZip, crc32 } from '../src/skills.js';

const tmpRoots: string[] = [];
function tmpDir(label: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `kitsune-skills-${label}-`));
  tmpRoots.push(d);
  return d;
}
afterAll(() => {
  for (const d of tmpRoots) fs.rmSync(d, { recursive: true, force: true });
});

describe('skills discovery', () => {
  it('finds the bundled skills dir (repo agent-skills or packaged skills/)', () => {
    const root = bundledSkillsDir();
    expect(root).toBeTruthy();
    const skills = listSkills(root!);
    expect(skills.length).toBe(11);
    const names = skills.map(s => s.name);
    expect(names).toContain('kitsune-market');
    expect(names).toContain('kitsune-strategy');
    expect(names).toContain('kitsune-agra');
    expect(names).toContain('kitsune-bridge');
  });

  it('parses skill versions from frontmatter', () => {
    const root = bundledSkillsDir()!;
    const market = listSkills(root).find(s => s.name === 'kitsune-market')!;
    expect(market.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('skills install', () => {
  it('copies all skills with their references into a target dir', () => {
    const root = bundledSkillsDir()!;
    const target = tmpDir('install');
    const installed = installSkills(root, target);
    expect(installed.length).toBe(11);
    expect(fs.existsSync(path.join(target, 'kitsune-market', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'kitsune-market', 'references', 'preflight.md'))).toBe(true);
    // bridge ships nested assets — recursion must keep them
    expect(fs.existsSync(path.join(target, 'kitsune-bridge', 'assets', 'networks.json'))).toBe(true);
  });

  it('overwrites an existing copy instead of failing', () => {
    const root = bundledSkillsDir()!;
    const target = tmpDir('overwrite');
    installSkills(root, target);
    const marker = path.join(target, 'kitsune-market', 'SKILL.md');
    fs.writeFileSync(marker, 'stale');
    installSkills(root, target);
    expect(fs.readFileSync(marker, 'utf8')).not.toBe('stale');
  });
});

describe('skills zip', () => {
  it('writes one valid zip per skill (folder-wrapped, store method)', () => {
    const root = bundledSkillsDir()!;
    const out = tmpDir('zip');
    const zips = zipSkills(root, out);
    expect(zips.length).toBe(11);
    const buf = fs.readFileSync(zips.find(z => z.name === 'kitsune-market')!.file);
    // local file header magic + EOCD magic present
    expect(buf.readUInt32LE(0)).toBe(0x04034b50);
    expect(buf.readUInt32LE(buf.length - 22)).toBe(0x06054b50);
    // entries are wrapped in the skill folder
    expect(buf.includes(Buffer.from('kitsune-market/SKILL.md'))).toBe(true);
  });

  it('buildZip produces a correct EOCD entry count and crc32 matches a known vector', () => {
    // CRC32("123456789") = 0xCBF43926 — the classic check value
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    const zip = buildZip([
      { name: 'a.txt', data: Buffer.from('hello') },
      { name: 'b/c.txt', data: Buffer.from('world') },
    ]);
    expect(zip.readUInt16LE(zip.length - 22 + 10)).toBe(2); // total entries in EOCD
  });
});
