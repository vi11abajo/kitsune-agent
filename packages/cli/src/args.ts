// CLI argument parsing helpers, kept out of index.ts (which runs main() on import) so they are unit-testable.

export interface Globals {
  json: boolean;
  readOnly: boolean;
  profile?: string;
  rest: string[];
}

export function extractGlobals(argv: string[]): Globals {
  const rest: string[] = [];
  let json = false;
  let readOnly = false;
  let profile: string | undefined;
  let i = 0;
  for (; i < argv.length; i++) {
    const t = argv[i];
    // I-7: a `--` sentinel ends global-flag parsing. Everything after it is passed through
    // verbatim, so a tool arg whose name collides with a global can be escaped:
    //   kitsune call some_tool -- --profile <toolValue>
    if (t === '--') { i++; break; }
    if (t === '--json') json = true;
    else if (t === '--read-only') readOnly = true;
    else if (t === '--profile') profile = argv[++i];
    else rest.push(t);
  }
  for (; i < argv.length; i++) rest.push(argv[i]);
  return { json, readOnly, profile, rest };
}

function coerce(v: string): unknown {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

export interface ParsedTokens {
  positionals: string[];
  flags: Record<string, unknown>;
}

// Split tokens into positionals and "--key value" flag pairs (string/bool values).
export function parseTokens(tokens: string[]): ParsedTokens {
  const positionals: string[] = [];
  const flags: Record<string, unknown> = {};
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      const next = tokens[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = coerce(next);
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(t);
    }
  }
  return { positionals, flags };
}

// Parse "--key value" pairs into an args object (string/bool values).
export function parseFlags(tokens: string[]): Record<string, unknown> {
  return parseTokens(tokens).flags;
}

const FRIENDLY: Record<string, (positionals: string[]) => { tool: string; args: Record<string, unknown> }> = {
  'market price': (p) => ({ tool: 'market_get_price', args: { base: p[0], quote: p[1] } }),
  'market candles': (p) => ({ tool: 'market_get_candles', args: { base: p[0], quote: p[1] } }),
  'market indicators': (p) => ({ tool: 'market_get_indicators', args: { base: p[0], quote: p[1] } }),
};

/**
 * Resolve a friendly command ("market candles BTC USDT --interval 1h --limit 100") into a tool call.
 * Positionals fill the pair args; any "--key value" flags are merged on top (flags win on conflict).
 * Returns undefined for an unknown friendly command.
 */
export function resolveFriendly(key: string, tokens: string[]): { tool: string; args: Record<string, unknown> } | undefined {
  const friendly = FRIENDLY[key];
  if (!friendly) return undefined;
  const { positionals, flags } = parseTokens(tokens);
  const built = friendly(positionals);
  return { tool: built.tool, args: { ...built.args, ...flags } };
}
