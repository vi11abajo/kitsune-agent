import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import * as os from 'node:os';

const PKG = '@kitsune-ai/agent-cli';
const TTL_MS = 24 * 60 * 60 * 1000; // re-check npm at most once a day

function cacheFile(): string {
  return path.join(os.homedir(), '.kitsune', '.update-check.json');
}

export function installedVersion(): string {
  try {
    const p = fileURLToPath(new URL('../package.json', import.meta.url));
    return (JSON.parse(readFileSync(p, 'utf8')).version as string) || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** semver-ish compare of x.y.z → -1 | 0 | 1 (pre-release suffixes ignored). */
export function cmpVersions(a: string, b: string): number {
  const pa = a.split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

async function fetchLatest(timeoutMs = 2500): Promise<string | null> {
  try {
    const r = await fetch(`https://registry.npmjs.org/${PKG}/latest`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    const j = (await r.json()) as { version?: string };
    return typeof j.version === 'string' ? j.version : null;
  } catch {
    return null;
  }
}

/** Latest published version, cached on disk for a day. Best-effort; never throws. */
export async function getLatest(force = false): Promise<string | null> {
  const file = cacheFile();
  if (!force) {
    try {
      const c = JSON.parse(readFileSync(file, 'utf8')) as { checkedAt: number; latest: string };
      if (Date.now() - c.checkedAt < TTL_MS) return c.latest;
    } catch {
      /* no / stale cache */
    }
  }
  const latest = await fetchLatest();
  if (latest) {
    try {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify({ checkedAt: Date.now(), latest }));
    } catch {
      /* read-only home — fine, just skip caching */
    }
  }
  return latest;
}

/**
 * If the installed CLI is behind the latest npm release, return a warning string (for stderr),
 * else null. Keeps agents/users from running against stale protocol data baked into an old kit.
 */
export async function updateNotice(force = false): Promise<string | null> {
  const current = installedVersion();
  const latest = await getLatest(force);
  if (latest && cmpVersions(current, latest) < 0) {
    return (
      `⚠ kitsune ${current} is outdated — latest is ${latest}. ` +
      `An old kit can carry stale protocol addresses/schemas; update before on-chain actions:\n` +
      `  npm i -g ${PKG}@latest && kitsune skills install`
    );
  }
  return null;
}
