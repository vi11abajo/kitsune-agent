---
name: kitsune-market
description: "Use this skill when the user asks for market data on Kitsune/Pharos: price of an asset, ticker, 24h stats, OHLCV candles, or technical indicators (RSI, MACD, EMA, Bollinger Bands) for a trading pair. All commands are read-only and need no credentials. Do NOT use for vault balances (kitsune-vault), strategy management (kitsune-strategy), portfolio/leaderboard (kitsune-portfolio), or the strategy marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.1.1"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.1.1", bins: ["kitsune"] }
---

# Kitsune Market Data

Read-only. See ../_shared/preflight.md first.

| # | Command | Description |
|---|---------|-------------|
| 1 | `kitsune market price <BASE> <QUOTE>` | Current price + 24h stats |
| 2 | `kitsune market candles <BASE> <QUOTE> [--interval 1h] [--limit 100]` | OHLCV candles |
| 3 | `kitsune market indicators <BASE> <QUOTE>` | RSI / MACD / EMA / Bollinger |

Add `--json` for machine-readable output.
