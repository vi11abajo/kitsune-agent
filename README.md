<div align="center">

# 🦊 Kitsune Agent Trade Kit

**The agent toolkit for [Kitsune](https://kitsune.finance) on Pharos.**
Let your AI agent read markets, manage vaults, and run DCA / grid strategies on-chain — in natural language.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Built for Pharos](https://img.shields.io/badge/built%20for-Pharos%20Atlantic-6E56CF)
![MCP](https://img.shields.io/badge/MCP-compatible-111111)
![Skills](https://img.shields.io/badge/Agent-Skills-0a7)

</div>

---

## What is this?

Kitsune Agent Trade Kit connects AI assistants directly to the **Kitsune** automated-trading protocol on
the **Pharos Atlantic** testnet. Instead of clicking through a dApp, you describe what you want — the agent
executes it: check a price, spin up a vault, launch a DCA strategy, read your PnL, or copy a strategy from
the marketplace.

It runs as a **local process**. Your private key never leaves your machine — sign-in (SIWE) and on-chain
transactions are signed **locally** with [viem](https://viem.sh). Fully open source under the MIT license.

It ships as **three standalone pieces around one shared core**, mirroring the OKX Agent Trade Kit design:

| Package | What it is |
|---|---|
| **`@kitsune-ai/agent-mcp`** (`kitsune-mcp`) | An [MCP](https://modelcontextprotocol.io) server. Plug into Claude, Cursor, VS Code, Windsurf, or any MCP client — your agent calls Kitsune tools by natural language. |
| **`@kitsune-ai/agent-cli`** (`kitsune`) | A terminal CLI. Works with shell pipes, cron, and scripts — no AI client needed. Also the runtime behind the Skills. |
| **`@kitsune-ai/agent-core`** | The shared library: config, REST client (SIWE/JWT), viem chain layer, and the single tool catalog used by both the MCP server and the CLI. |

Plus **5 plug-and-play Skills** for clients that support the Agent Skills protocol.

---

## Features

| Feature | Details |
|---|---|
| **33 tools across 5 modules** | market · vault · strategy · portfolio · marketplace |
| **Market data** | prices, OHLCV candles, technical indicators (RSI/MACD/EMA/Bollinger), DODO pools, backtests |
| **Vaults** | list, balances, allocations, create, withdraw |
| **Strategies** | DCA / grid lifecycle — create, update, pause, resume, withdraw, plus trades, metrics & positions |
| **Portfolio** | aggregated PnL, vault activity, leaderboard |
| **Marketplace** | browse, share, copy, and delist strategies |
| **Self-custody** | keys stay local; SIWE + on-chain txs signed on your machine |
| **Safety rails** | read-only mode, signer-gated tools, `[CAUTION]` labels, testnet by default |

---

## Modules

| Module | Tools | Skill | Auth |
|---|---|---|---|
| `market` | 6 | `kitsune-market` | public (backtest needs sign-in) |
| `vault` | 5 | `kitsune-vault` | sign-in / signer |
| `strategy` | 14 | `kitsune-strategy` | sign-in / signer |
| `portfolio` | 3 | `kitsune-portfolio` | sign-in (leaderboard public) |
| `marketplace` | 5 | `kitsune-marketplace` | public / sign-in |

> **Auth legend** — `public`: no credentials · `sign-in` (jwt): a local SIWE sign-in (needs a private key) ·
> `signer`: sends an on-chain transaction (needs a private key).

---

## Quick Start

### 1. Install

```bash
npm install -g @kitsune-ai/agent-mcp @kitsune-ai/agent-cli
```

Or build from source:

```bash
git clone https://github.com/vi11abajo/kitsune-agent
cd kitsune-agent
corepack pnpm install
corepack pnpm -r build
```

Verify (market data works with no credentials):

```bash
kitsune market price BTC USDT
# from source: node packages/cli/dist/index.js market price BTC USDT
```

### 2. Add your credentials (only needed for vault / strategy actions)

The interactive way is to create `~/.kitsune/config.toml`:

```toml
default_profile = "testnet"

[profiles.testnet]
api_url     = "https://api.kitsune.finance/api"
chain_id    = 688689
rpc_url     = "https://atlantic.dplabs-internal.com"
private_key = "0x..."          # self-custody; required ONLY for sign-in + on-chain tools

# Read-only profile: omit private_key, all write/sign-in tools are hidden
[profiles.readonly]
api_url        = "https://api.kitsune.finance/api"
wallet_address = "0x..."
```

> Pharos Atlantic is a **testnet** — no real funds at risk. Get test PHRS from the Pharos faucet.

### 3. Connect your AI client

```bash
kitsune-mcp setup --client cursor      # or: claude-desktop | claude-code | vscode | windsurf
```

This prints the MCP registration to drop into your client config:

```json
{
  "mcpServers": {
    "kitsune": { "command": "kitsune-mcp", "args": ["--profile", "testnet"] }
  }
}
```

Then ask your agent:

> *"What's the BTC price on Kitsune?"* · *"Show my vaults."* · *"Create a DCA strategy buying WBTC with USDC."*

---

## `kitsune-mcp` — MCP server

Register once; your agent gets the tools. Startup options:

| You want | Command |
|---|---|
| Market data only (no key) | `kitsune-mcp --modules market` |
| Testnet, all modules | `kitsune-mcp --profile testnet` |
| Read-only monitoring | `kitsune-mcp --profile testnet --read-only` |
| Specific modules | `kitsune-mcp --profile testnet --modules market,vault,strategy` |

The server advertises each tool with MCP annotations (`readOnlyHint`, `destructiveHint`) derived from whether
it writes. With `--read-only`, every write tool is removed. With no `private_key`, every sign-in/on-chain tool
is hidden — the agent never even sees what it can't do.

### Tools

**`market`** — public (backtest needs sign-in)
| Tool | Description |
|---|---|
| `market_get_price` | Current price + 24h stats for a pair |
| `market_get_candles` | OHLCV candles (1m…1d) |
| `market_get_indicators` | RSI / MACD / EMA / Bollinger |
| `market_batch_prices` | Up to 10 pairs at once |
| `market_get_dodo_pools` | DODO liquidity pools |
| `market_run_backtest` | Backtest a strategy config (no funds) |

**`vault`**
| Tool | Auth | Description |
|---|---|---|
| `vault_list` | sign-in | Vaults owned by an address |
| `vault_get_balances` | sign-in | Token balances in a vault |
| `vault_get_allocations` | sign-in | Position / allocation breakdown |
| `vault_create` | signer ⚠️ | Deploy a new vault on-chain |
| `vault_withdraw` | signer ⚠️ | Withdraw a token from a vault |

**`strategy`**
| Tool | Auth | Description |
|---|---|---|
| `strategy_list` / `strategy_get` / `strategy_get_position` | sign-in | List / get / open position |
| `strategy_get_trades` / `strategy_get_metrics` | sign-in | Trade history · PnL / win-rate / Sharpe |
| `strategy_create` / `strategy_update` | signer ⚠️ | Create / update a strategy on-chain |
| `strategy_pause` / `strategy_resume` | signer ⚠️ | Pause / resume execution |
| `strategy_withdraw` | signer ⚠️ | Withdraw a strategy position |
| `strategy_restart_cycle` / `strategy_set_metadata` / `strategy_hide` / `strategy_restore` | sign-in | Off-chain bookkeeping |

**`portfolio`**
| Tool | Auth | Description |
|---|---|---|
| `portfolio_get` | sign-in | Aggregated portfolio metrics |
| `portfolio_get_activity` | sign-in | Recent vault activity |
| `leaderboard_get` | public | Leaderboard (weekly / monthly / all-time) |

**`marketplace`**
| Tool | Auth | Description |
|---|---|---|
| `marketplace_list` / `marketplace_get` | public | Browse / view shared strategies |
| `marketplace_share` / `marketplace_copy` / `marketplace_delist` | sign-in | Publish / copy / delist |

---

## `kitsune` — CLI

A standalone terminal tool — no AI client required.

```bash
# Market data (no credentials)
kitsune market price BTC USDT
kitsune market candles BTC USDT --interval 1h --limit 100
kitsune call market_get_indicators --base BTC --quote USDT

# Any tool, exact typed args
kitsune call vault_list --owner 0xYourAddress
kitsune call strategy_create --args '{"vault":"0x..","baseToken":"0x..","quoteToken":"0x..","allowedExecutor":"0x..","takeProfitBps":500,"stopLossBps":1000,"maxDcaCount":5,"maxTradesPerDay":3,"active":true,"firstBuyAmount":"1000000","maxPositionSize":"5000000","dcaMultiplier":"1500000000000000000"}'

# Discoverability
kitsune tools                       # list all 33 tools
kitsune setup --client cursor       # print MCP registration

# Pipes & scripting
kitsune call portfolio_get --owner 0x... --json | jq '.totalPnlUsd'
```

Global flags: `--json` · `--profile <name>` · `--read-only`.

---

## Skills

Plug-and-play modules for AI clients that support the Agent Skills protocol. Each is a single `SKILL.md`
that shells out to the `kitsune` CLI.

| Skill | Covers | Credentials |
|---|---|---|
| `kitsune-market` | prices, candles, indicators, DODO pools, backtests | none for reads |
| `kitsune-vault` | list/balances/allocations, create, withdraw | sign-in / key |
| `kitsune-strategy` | full DCA/grid lifecycle + trades & metrics | sign-in / key |
| `kitsune-portfolio` | portfolio, activity, leaderboard | sign-in (leaderboard public) |
| `kitsune-marketplace` | browse, share, copy, delist | public / sign-in |

Skills live in [`agent-skills/`](./agent-skills).

---

## Safety

Four layers, mirroring the OKX kit:

1. **Testnet by default** — Pharos Atlantic; no real funds at risk.
2. **Read-only mode** (`--read-only`) — every write tool is removed from the catalog.
3. **Smart registration** — with no `private_key`, all sign-in / on-chain tools are hidden; the agent only
   sees what it can actually do.
4. **`[CAUTION]` labels** — every tool that moves funds or sends a transaction is marked so the agent
   confirms before acting.

**Credential safety:** never paste your private key into a chat. Keep it in `~/.kitsune/config.toml` only.
Everything is signed locally; the AI never sees your key. Because AI behavior is non-deterministic, use a
dedicated testnet key and only the funds you're willing to risk. **You are responsible for verifying every
action; AI can make mistakes.**

---

## Configuration reference

`~/.kitsune/config.toml` — multiple named profiles; pick with `--profile <name>`.

| Field | Meaning |
|---|---|
| `api_url` | Kitsune REST base (default `https://api.kitsune.finance/api`) |
| `chain_id` | `688689` (Pharos Atlantic) |
| `rpc_url` | `https://atlantic.dplabs-internal.com` |
| `private_key` | self-custody key for SIWE + on-chain (omit for read-only) |
| `wallet_address` | read-only identity when there's no key |
| `siwe_domain` | SIWE domain (default `kitsune.finance`) |

Env overrides: `KITSUNE_API_URL`, `KITSUNE_RPC_URL`, `KITSUNE_PRIVATE_KEY`, `KITSUNE_WALLET_ADDRESS`, `KITSUNE_SIWE_DOMAIN`.

---

## FAQ

**What can I do with it?** Read markets, run backtests, create and manage DCA/grid strategies, view your
portfolio and PnL, and use the strategy marketplace — by natural language or from the terminal.

**Do I need an API key?** No for market data and the public marketplace/leaderboard. For your vaults and
strategies you need a `private_key` in your config (used to sign in and sign transactions, locally).

**Is it safe?** Keys never leave your machine; transactions are signed locally; market data needs no key.
It's open source — audit it. Start in read-only mode or with a dedicated testnet key.

**Which AI clients work?** Any MCP client — Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, or custom
agents built on the MCP SDK.

**Is it free?** Yes — MIT licensed. You only need a Pharos Atlantic wallet to transact.

---

## Build from source

```bash
git clone https://github.com/vi11abajo/kitsune-agent
cd kitsune-agent
corepack pnpm install
corepack pnpm -r build      # builds core, mcp, cli
corepack pnpm -r test       # unit tests
```

Workspace layout:

```
packages/core   @kitsune-ai/agent-core   shared: config, API client, viem chain, tool catalog
packages/mcp    @kitsune-ai/agent-mcp     stdio MCP server   (bin: kitsune-mcp)
packages/cli    @kitsune-ai/agent-cli     terminal CLI       (bin: kitsune)
agent-skills/   5 SKILL.md + shared preflight
```

Tech: TypeScript (ESM), pnpm workspaces, tsup, vitest, viem, siwe, `@modelcontextprotocol/sdk`. Node ≥18.

---

## Links

- **Kitsune**: https://kitsune.finance · API: `https://api.kitsune.finance/api`
- **Pharos**: [docs](https://docs.pharosnetwork.xyz/) · [explorer](https://atlantic.pharosscan.xyz) · chainId `688689`
- **Contracts (Pharos Atlantic)**: VaultFactory [`0x1518C8FE94AD3567b7b106386e384b4dD82E1Fb6`](https://atlantic.pharosscan.xyz/address/0x1518C8FE94AD3567b7b106386e384b4dD82E1Fb6) · ExecutorRegistry [`0x96afA8e3bad400994Db1E430C682E29aa2fFed6C`](https://atlantic.pharosscan.xyz/address/0x96afA8e3bad400994Db1E430C682E29aa2fFed6C)
- **Model Context Protocol**: https://modelcontextprotocol.io
- **Built for**: [Pharos "Skill-to-Agent Dual Cascade" Hackathon](https://dorahacks.io/hackathon/pharos-phase1/detail)

---

## License

[MIT](./LICENSE) © Kitsune
