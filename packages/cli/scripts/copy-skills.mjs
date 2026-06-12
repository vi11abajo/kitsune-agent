// Copy the repo's agent-skills into packages/cli/skills so they ship in the npm tarball.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(pkgRoot, '..', '..', 'agent-skills');
const dst = path.join(pkgRoot, 'skills');

fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });

let n = 0;
for (const e of fs.readdirSync(src, { withFileTypes: true })) {
  if (!e.isDirectory() || !e.name.startsWith('kitsune-')) continue;
  fs.cpSync(path.join(src, e.name), path.join(dst, e.name), { recursive: true });
  n++;
}
console.log(`copy-skills: ${n} skills -> ${path.relative(pkgRoot, dst)}`);
