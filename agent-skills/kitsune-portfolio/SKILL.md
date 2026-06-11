---
name: kitsune-portfolio
description: "Use this skill for Kitsune (Pharos) portfolio and ranking views: aggregated portfolio metrics across a wallet's vaults, recent trade activity for a vault, and the strategies leaderboard (ranked by ROI / win-rate / Sharpe / copies). Portfolio and activity require sign-in; the leaderboard is public. Do NOT use for market data (kitsune-market), vault balances/creation (kitsune-vault), per-strategy management (kitsune-strategy), or the strategy marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.2.4"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.2.4", bins: ["kitsune"] }
---

# Kitsune Portfolio

See [preflight](references/preflight.md) first.

| # | Command | Auth | Description |
|---|---------|------|-------------|
| 1 | `kitsune call portfolio_get --owner <addr>` | jwt | Aggregated portfolio metrics |
| 2 | `kitsune call portfolio_get_activity --vault <addr>` | jwt | Recent trade activity for a vault |
| 3 | `kitsune call leaderboard_get --sort roi` | none | Leaderboard (sort: roi / winRate / sharpe / copies) |

Add `--json` for machine-readable output.

## Examples

User asks: "Give me an overview of my whole portfolio for wallet 0xABCD...1234."

    kitsune call portfolio_get --owner 0xABCD000000000000000000000000000000001234

Returns aggregated metrics across the wallet's vaults, e.g. `{ "totalValue": "...", "pnl": "...", "vaultCount": 2, "strategyCount": 5 }`.

User asks: "What are the top strategies by ROI right now?"

    kitsune call leaderboard_get --sort roi

Returns the public leaderboard ranked by ROI, e.g. `[{ "rank": 1, "name": "...", "roi": 0.42, "winRate": 0.6, "copies": 120 }, ...]`.

User asks: "Show recent trade activity for my vault 0xVAULT..."

    kitsune call portfolio_get_activity --vault 0xVAULT000000000000000000000000000000abcd

Returns the vault's recent trades, e.g. `[{ "time": 1700000000, "side": "buy", "pair": "WPROS/USDC", "amount": "...", "price": "..." }, ...]`.
