import { resolveConfig, readConfigFile, scaffoldConfig, configPath, KitsuneApiClient, KitsuneChain, allToolSpecs } from '@kitsune-ai/agent-core';
import { privateKeyToAccount } from 'viem/accounts';
import { extractGlobals, parseFlags, resolveFriendly } from './args.js';
import { runTool } from './runner.js';
import { buildClientRegistration, buildRemoteRegistration, SUPPORTED_CLIENTS, DEFAULT_REMOTE_URL } from './setup.js';
import { bundledSkillsDir, listSkills, installSkills, zipSkills, defaultInstallDir, projectInstallDir } from './skills.js';

function printHelp(): void {
  console.log(`kitsune — Kitsune Agent CLI

Usage:
  kitsune market price <BASE> <QUOTE>           Quick price lookup
  kitsune call <tool> --args '<json>'           Run any tool with JSON args
  kitsune call <tool> --key value ...           Run any tool with flag args
  kitsune tools                                 List all available tools
  kitsune skills install [--project | --dir <path> | --zip <outdir>]
                                                Install the bundled Agent Skills
  kitsune skills list                           List the bundled Agent Skills
  kitsune config init                           Create ~/.kitsune/config.toml with placeholders
  kitsune config path                           Print the config file location
  kitsune setup --client <${SUPPORTED_CLIENTS.join('|')}> [--remote] [--npx]

skills install targets:
  (default)        ~/.claude/skills            (Claude Code, global)
  --project        ./.claude/skills            (Claude Code, this project)
  --dir <path>     any agent's skills folder   (Claude Agent SDK, custom)
  --zip <outdir>   one <skill>.zip per skill   (upload to Claude Desktop / claude.ai)

setup flags:
  --remote   connect to the hosted public read-only server (${DEFAULT_REMOTE_URL})
  --npx      local server via "npx @kitsune-ai/agent-mcp" (no global install)

Global flags: --json  --profile <name>  --read-only`);
}

async function main(): Promise<void> {
  const { json, readOnly, profile, rest } = extractGlobals(process.argv.slice(2));

  if (rest.length === 0 || rest[0] === 'help' || rest[0] === '--help') {
    printHelp();
    return;
  }

  // setup — local, no network
  if (rest[0] === 'setup') {
    const flags = parseFlags(rest.slice(1));
    const client = typeof flags.client === 'string' ? flags.client : '';
    if (!client) {
      console.error(`Usage: kitsune setup --client <${SUPPORTED_CLIENTS.join('|')}> [--remote] [--npx]`);
      process.exit(1);
    }
    const r = flags.remote
      ? buildRemoteRegistration(client)
      : buildClientRegistration(client, profile ?? 'mainnet', Boolean(flags.npx));
    if (r.note) console.log(`# ${r.note}\n`);
    if (r.cli) console.log(`${r.cli}\n`);
    console.log(`Add this to ${r.configHint}:\n`);
    console.log(JSON.stringify(r.registration, null, 2));
    return;
  }

  // config — scaffold / locate the credentials file, no network
  if (rest[0] === 'config') {
    const sub = rest[1];
    if (sub === 'path') {
      console.log(configPath());
      return;
    }
    if (sub === 'init') {
      const sc = scaffoldConfig();
      console.log(sc.created ? `Created ${sc.path}` : `Already exists: ${sc.path}`);
      console.log('Add your private_key (0x…) under [profiles.mainnet] — never paste it into a chat.');
      return;
    }
    console.error('Usage: kitsune config <init|path>');
    process.exit(1);
  }

  // skills — local install / listing, no network
  if (rest[0] === 'skills') {
    const sub = rest[1];
    if (sub !== 'install' && sub !== 'list') {
      console.error('Usage: kitsune skills <install|list> [--project | --dir <path> | --zip <outdir>]');
      process.exit(1);
    }
    const root = bundledSkillsDir();
    if (!root) {
      console.error('No bundled skills found (broken install?). Reinstall @kitsune-ai/agent-cli or clone the repo.');
      process.exit(1);
    }
    const flags = parseFlags(rest.slice(2));
    if (sub === 'list') {
      const skills = listSkills(root);
      if (json) console.log(JSON.stringify(skills.map(({ name, version }) => ({ name, version }))));
      else for (const s of skills) console.log(`${s.name}\tv${s.version}`);
      return;
    }
    if (typeof flags.zip === 'string') {
      const zips = zipSkills(root, flags.zip);
      for (const z of zips) console.log(`packed ${z.file}`);
      console.log(`\n${zips.length} skill zips written. Upload them in Claude Desktop / claude.ai → Settings → Capabilities.`);
      return;
    }
    const target = typeof flags.dir === 'string' ? flags.dir : flags.project ? projectInstallDir() : defaultInstallDir();
    const installed = installSkills(root, target);
    for (const s of installed) console.log(`installed ${s.name} v${s.version}`);
    console.log(`\n${installed.length} skills -> ${target}`);
    // First-run onboarding: make sure a credentials file exists so the key has a
    // home — agents must never be tempted to inline a key for lack of a config.
    const sc = scaffoldConfig();
    console.log(
      sc.created
        ? `\nCreated a starter config at ${sc.path}\n  → add your private_key there (0x…). Never paste a key into a chat.`
        : `\nConfig already present at ${sc.path}.`,
    );
    return;
  }

  // tools — local listing
  if (rest[0] === 'tools') {
    const specs = allToolSpecs();
    if (json) {
      console.log(JSON.stringify(specs.map(({ name, title, module, auth, isWrite }) => ({ name, title, module, auth, isWrite }))));
    } else {
      for (const t of specs) console.log(`${t.name}\t[${t.auth}]\t${t.title}`);
    }
    return;
  }

  // resolve the tool to run
  let toolName: string;
  let args: Record<string, unknown>;
  if (rest[0] === 'call') {
    toolName = rest[1];
    if (!toolName) {
      console.error("Usage: kitsune call <tool> [--args '{json}' | --key value ...]");
      process.exit(1);
    }
    const tokens = rest.slice(2);
    const argsIdx = tokens.indexOf('--args');
    args = argsIdx !== -1 ? JSON.parse(tokens[argsIdx + 1] ?? '{}') : parseFlags(tokens);
  } else {
    const key = rest.slice(0, 2).join(' ');
    const friendly = resolveFriendly(key, rest.slice(2));
    if (!friendly) {
      console.error(`Unknown command: ${key}. Try "kitsune tools" or "kitsune call <tool>".`);
      process.exit(1);
    }
    toolName = friendly.tool;
    args = friendly.args;
  }

  const config = resolveConfig(readConfigFile(), { profile, readOnly });
  const account = config.privateKey ? privateKeyToAccount(config.privateKey as `0x${string}`) : undefined;
  const client = new KitsuneApiClient({
    apiUrl: config.apiUrl,
    siweDomain: config.siweDomain,
    chainId: config.chainId,
    signer: account ? { address: account.address, signMessage: (a) => account.signMessage(a) } : undefined,
  });
  const chain = new KitsuneChain({ rpcUrl: config.rpcUrl, chainId: config.chainId, privateKey: config.privateKey as `0x${string}` | undefined });

  const out = await runTool(toolName, args, { client, chain, config });
  console.log(json ? JSON.stringify(out) : JSON.stringify(out, null, 2));
}

main().catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  // Success output goes to stdout; with --json keep failures machine-readable on stdout too.
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: false, error: message }));
  else console.error(message);
  process.exit(1);
});
