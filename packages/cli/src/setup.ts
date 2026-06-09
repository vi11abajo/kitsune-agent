export interface SetupResult {
  client: string;
  configHint: string;
  registration: { mcpServers: Record<string, { command: string; args: string[] }> };
  cli?: string;
  note?: string;
}

export interface RemoteSetupResult {
  client: string;
  configHint: string;
  registration: { mcpServers: Record<string, { url: string } | { command: string; args: string[] }> };
  cli?: string;
  note: string;
}

/** Public, hosted, read-only Kitsune MCP endpoint. */
export const DEFAULT_REMOTE_URL = 'https://mcp.kitsune.finance/mcp';

// Typical MCP config locations per client. Versions vary — these are hints, not guarantees.
const CONFIG_HINTS: Record<string, string> = {
  'claude-desktop':
    'Claude Desktop config (Windows: %APPDATA%\\Claude\\claude_desktop_config.json, macOS: ~/Library/Application Support/Claude/claude_desktop_config.json)',
  'claude-code': 'Run: claude mcp add kitsune -- kitsune-mcp --profile mainnet  (or add to ~/.claude.json)',
  cursor: '~/.cursor/mcp.json',
  vscode: '.vscode/mcp.json (workspace) or VS Code settings.json',
  windsurf: '~/.codeium/windsurf/mcp_config.json',
};

export const SUPPORTED_CLIENTS = Object.keys(CONFIG_HINTS);

function assertSupportedClient(client: string): void {
  if (!SUPPORTED_CLIENTS.includes(client)) {
    throw new Error(`Unknown client: ${client}. Supported clients: ${SUPPORTED_CLIENTS.join(', ')}`);
  }
}

/**
 * Local full server (stdio): all tools, self-custody (signs locally with your key).
 * Pass npx=true to run without a global install via `npx @kitsune-ai/agent-mcp`.
 */
export function buildClientRegistration(client: string, profile = 'mainnet', npx = false): SetupResult {
  assertSupportedClient(client);
  const server = npx
    ? { command: 'npx', args: ['-y', '@kitsune-ai/agent-mcp', '--profile', profile] }
    : { command: 'kitsune-mcp', args: ['--profile', profile] };
  const cli =
    client === 'claude-code'
      ? npx
        ? `claude mcp add kitsune -- npx -y @kitsune-ai/agent-mcp --profile ${profile}`
        : `claude mcp add kitsune -- kitsune-mcp --profile ${profile}`
      : undefined;
  return {
    client,
    configHint: CONFIG_HINTS[client] ?? 'your MCP client config file',
    registration: { mcpServers: { kitsune: server } },
    cli,
    note: 'Local full server — all tools, self-custody (sign-in + on-chain txs are signed locally with your key).',
  };
}

/**
 * Public hosted server (Streamable HTTP): read-only, no install, no key.
 * URL-capable clients connect directly; stdio-only clients bridge with `mcp-remote`.
 */
export function buildRemoteRegistration(client: string, url = DEFAULT_REMOTE_URL): RemoteSetupResult {
  assertSupportedClient(client);
  const urlConfig = { mcpServers: { 'kitsune-remote': { url } } };
  const bridge = { mcpServers: { 'kitsune-remote': { command: 'npx', args: ['-y', 'mcp-remote', url] } } };
  const note = 'Public READ-ONLY Kitsune MCP — no install, no key (market data, leaderboard, marketplace browse).';
  switch (client) {
    case 'claude-code':
      return { client, configHint: 'Run (HTTP transport)', cli: `claude mcp add --transport http kitsune-remote ${url}`, registration: urlConfig, note };
    case 'cursor':
      return { client, configHint: '~/.cursor/mcp.json (URL transport)', registration: urlConfig, note };
    case 'vscode':
      return { client, configHint: '.vscode/mcp.json (URL transport)', registration: urlConfig, note };
    default:
      return { client, configHint: 'stdio-only clients (e.g. Claude Desktop) — bridge via mcp-remote', registration: bridge, note };
  }
}
