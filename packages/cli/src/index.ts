import { resolveConfig, readConfigFile, KitsuneApiClient, KitsuneChain, allToolSpecs } from '@kitsune-ai/agent-core';
import { privateKeyToAccount } from 'viem/accounts';
import { extractGlobals, parseFlags, resolveFriendly } from './args.js';
import { runTool } from './runner.js';
import { buildClientRegistration, buildRemoteRegistration, SUPPORTED_CLIENTS, DEFAULT_REMOTE_URL } from './setup.js';

function printHelp(): void {
  console.log(`kitsune — Kitsune Agent CLI

Usage:
  kitsune market price <BASE> <QUOTE>           Quick price lookup
  kitsune call <tool> --args '<json>'           Run any tool with JSON args
  kitsune call <tool> --key value ...           Run any tool with flag args
  kitsune tools                                 List all available tools
  kitsune setup --client <${SUPPORTED_CLIENTS.join('|')}> [--remote] [--npx]

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
