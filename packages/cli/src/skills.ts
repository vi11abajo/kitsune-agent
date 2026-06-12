import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

export interface SkillInfo {
  name: string;
  version: string;
  dir: string;
}

/**
 * Locate the skills shipped with this CLI.
 * Packaged install: <package-root>/skills (copied next to dist/ at build time).
 * Repo checkout:    <repo-root>/agent-skills.
 */
export function bundledSkillsDir(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url)); // dist/ (built) or src/ (tests)
  const candidates = [
    path.resolve(here, '..', 'skills'),
    path.resolve(here, '..', '..', '..', 'agent-skills'),
  ];
  for (const c of candidates) {
    if (listSkills(c).length > 0) return c;
  }
  return null;
}

/** Skill folders are kitsune-* directories containing a SKILL.md. */
export function listSkills(root: string): SkillInfo[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const skills: SkillInfo[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || !e.name.startsWith('kitsune-')) continue;
    const dir = path.join(root, e.name);
    const skillMd = path.join(dir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;
    const head = fs.readFileSync(skillMd, 'utf8').slice(0, 2000);
    const version = /version:\s*"([^"]+)"/.exec(head)?.[1] ?? '?';
    skills.push({ name: e.name, version, dir });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export function defaultInstallDir(): string {
  return path.join(os.homedir(), '.claude', 'skills');
}

export function projectInstallDir(cwd = process.cwd()): string {
  return path.join(cwd, '.claude', 'skills');
}

/** Copy every bundled skill into targetDir (overwrites existing copies). */
export function installSkills(root: string, targetDir: string): SkillInfo[] {
  const skills = listSkills(root);
  fs.mkdirSync(targetDir, { recursive: true });
  for (const s of skills) {
    fs.cpSync(s.dir, path.join(targetDir, s.name), { recursive: true, force: true });
  }
  return skills;
}

/** Write one <name>.zip per skill into outDir (for Claude Desktop / claude.ai upload). */
export function zipSkills(root: string, outDir: string): { name: string; file: string }[] {
  const skills = listSkills(root);
  fs.mkdirSync(outDir, { recursive: true });
  const out: { name: string; file: string }[] = [];
  for (const s of skills) {
    const entries: { name: string; data: Buffer }[] = [];
    collectFiles(s.dir, `${s.name}/`, entries);
    const file = path.join(outDir, `${s.name}.zip`);
    fs.writeFileSync(file, buildZip(entries));
    out.push({ name: s.name, file });
  }
  return out;
}

function collectFiles(dir: string, prefix: string, out: { name: string; data: Buffer }[]): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collectFiles(p, `${prefix}${e.name}/`, out);
    else if (e.isFile()) out.push({ name: `${prefix}${e.name}`, data: fs.readFileSync(p) });
  }
}

// ---- minimal ZIP writer (store method — no compression; fine for markdown skills) ----

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Fixed DOS timestamp (1980-01-01) keeps archives deterministic.
const DOS_TIME = 0;
const DOS_DATE = 0x21;

export function buildZip(entries: { name: string; data: Buffer }[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(e.name.replaceAll('\\', '/'), 'utf8');
    const crc = crc32(e.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);            // version needed
    local.writeUInt16LE(0, 6);             // flags
    local.writeUInt16LE(0, 8);             // method: store
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(e.data.length, 18); // compressed size (= raw, store)
    local.writeUInt32LE(e.data.length, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);            // extra len
    chunks.push(local, name, e.data);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);              // made by
    cen.writeUInt16LE(20, 6);              // version needed
    cen.writeUInt16LE(0, 8);               // flags
    cen.writeUInt16LE(0, 10);              // method
    cen.writeUInt16LE(DOS_TIME, 12);
    cen.writeUInt16LE(DOS_DATE, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(e.data.length, 20);
    cen.writeUInt32LE(e.data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt16LE(0, 30);              // extra
    cen.writeUInt16LE(0, 32);              // comment
    cen.writeUInt16LE(0, 34);              // disk start
    cen.writeUInt16LE(0, 36);              // internal attrs
    cen.writeUInt32LE(0, 38);              // external attrs
    cen.writeUInt32LE(offset, 42);         // local header offset
    central.push(Buffer.concat([cen, name]));

    offset += local.length + name.length + e.data.length;
  }

  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);                // disk
  eocd.writeUInt16LE(0, 6);                // cd disk
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);          // cd offset
  eocd.writeUInt16LE(0, 20);               // comment len

  return Buffer.concat([...chunks, cd, eocd]);
}
