import { resolveConfig, readConfigFile, KitsuneApiClient, KitsuneChain, allToolSpecs } from '@kitsune/agent-core';
import { privateKeyToAccount } from 'viem/accounts';
import { runTool } from './runner.js';
import { buildClientRegistration, SUPPORTED_CLIENTS } from './setup.js';

interface Globals {
  json: boolean;
  readOnly: boolean;
  profile?: string;
  rest: string[];
}

function extractGlobals(argv: string[]): Globals {
  const rest: string[] = [];
  let json = false;
  let readOnly = false;
  let profile: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--json') json = true;
    else if (t === '--read-only') readOnly = true;
    else if (t === '--profile') profile = argv[++i];
    else rest.push(t);
  }
  return { json, readOnly, profile, rest };
}

function coerce(v: string): unknown {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

// Parse "--key value" pairs into an args object (string/bool values).
function parseFlags(tokens: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      const next = tokens[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out[key] = coerce(next);
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

const FRIENDLY: Record<string, (r: string[]) => { tool: string; args: Record<string, unknown> }> = {
  'market price': (r) => ({ tool: 'market_get_price', args: { base: r[0], quote: r[1] } }),
  'market candles': (r) => ({ tool: 'market_get_candles', args: { base: r[0], quote: r[1] } }),
  'market indicators': (r) => ({ tool: 'market_get_indicators', args: { base: r[0], quote: r[1] } }),
};

function printHelp(): void {
  console.log(`kitsune — Kitsune Agent CLI

Usage:
  kitsune market price <BASE> <QUOTE>           Quick price lookup
  kitsune call <tool> --args '<json>'           Run any tool with JSON args
  kitsune call <tool> --key value ...           Run any tool with flag args
  kitsune tools                                 List all available tools
  kitsune setup --client <${SUPPORTED_CLIENTS.join('|')}>

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
      console.error(`Usage: kitsune setup --client <${SUPPORTED_CLIENTS.join('|')}>`);
      process.exit(1);
    }
    const r = buildClientRegistration(client, profile ?? 'testnet');
    console.log(`Add this to ${r.configHint}:\n`);
    console.log(JSON.stringify(r.registration, null, 2));
    return;
  }

  // tools — local listing
  if (rest[0] === 'tools') {
    for (const t of allToolSpecs()) console.log(`${t.name}\t[${t.auth}]\t${t.title}`);
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
    const friendly = FRIENDLY[key];
    if (!friendly) {
      console.error(`Unknown command: ${key}. Try "kitsune tools" or "kitsune call <tool>".`);
      process.exit(1);
    }
    const built = friendly(rest.slice(2));
    toolName = built.tool;
    args = built.args;
  }

  const config = resolveConfig(readConfigFile(), { profile, readOnly });
  const account = config.privateKey ? privateKeyToAccount(config.privateKey as `0x${string}`) : undefined;
  const client = new KitsuneApiClient({
    apiUrl: config.apiUrl,
    siweDomain: config.siweDomain,
    chainId: config.chainId,
    signer: account ? { address: account.address, signMessage: (a) => account.signMessage(a) } : undefined,
  });
  const chain = new KitsuneChain({ rpcUrl: config.rpcUrl, privateKey: config.privateKey as `0x${string}` | undefined });

  const out = await runTool(toolName, args, { client, chain, config });
  console.log(json ? JSON.stringify(out) : JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
