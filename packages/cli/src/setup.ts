export interface SetupResult {
  client: string;
  configHint: string;
  registration: { mcpServers: Record<string, { command: string; args: string[] }> };
}

// Typical MCP config locations per client. Versions vary — these are hints, not guarantees.
const CONFIG_HINTS: Record<string, string> = {
  'claude-desktop':
    'Claude Desktop config (Windows: %APPDATA%\\Claude\\claude_desktop_config.json, macOS: ~/Library/Application Support/Claude/claude_desktop_config.json)',
  'claude-code': 'Run: claude mcp add kitsune -- kitsune-mcp --profile testnet  (or add to ~/.claude.json)',
  cursor: '~/.cursor/mcp.json',
  vscode: '.vscode/mcp.json (workspace) or VS Code settings.json',
  windsurf: '~/.codeium/windsurf/mcp_config.json',
};

export const SUPPORTED_CLIENTS = Object.keys(CONFIG_HINTS);

export function buildClientRegistration(client: string, profile = 'testnet'): SetupResult {
  return {
    client,
    configHint: CONFIG_HINTS[client] ?? 'your MCP client config file',
    registration: {
      mcpServers: {
        kitsune: { command: 'kitsune-mcp', args: ['--profile', profile] },
      },
    },
  };
}
