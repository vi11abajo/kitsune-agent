---
name: kitsune-market
description: "Use this skill when the user asks for market data on Kitsune/Pharos: price of an asset, ticker, 24h stats, OHLCV candles, technical indicators (RSI, MACD, EMA, Bollinger Bands), a DODO swap-route quote, or a strategy backtest. Price/candles/indicators need no credentials; backtests and DODO route quotes are read-only too but need sign-in. Do NOT use for vault balances (kitsune-vault), strategy management (kitsune-strategy), portfolio/leaderboard (kitsune-portfolio), or the strategy marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.2.1"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.2.1", bins: ["kitsune"] }
---

# Kitsune Market Data

Read-only. See ../_shared/preflight.md first.

| # | Command | Description |
|---|---------|-------------|
| 1 | `kitsune market price <BASE> <QUOTE>` | Current price + 24h stats |
| 2 | `kitsune market candles <BASE> <QUOTE> [--interval 1h] [--limit 100]` | OHLCV candles |
| 3 | `kitsune market indicators <BASE> <QUOTE>` | RSI / MACD / EMA / Bollinger |
| 4 | `kitsune call market_batch_prices --pairs "WPROS/USDC,BTC/USDT"` | Up to 10 pairs at once |

## Sign-in required (read-only, no funds moved)
| # | Command | Description |
|---|---------|-------------|
| 5 | `kitsune call market_run_backtest --args '{"config":{"pair":"WPROS/USDC","strategyType":"dca","timeframe":"1h","startDate":"2024-01-01","endDate":"2024-03-01","initialOrderAmount":100,"dcaOrderAmount":50,"takeProfitPercent":5,"stopLossPercent":10,"stopLossEnabled":true}}'` | Backtest a strategy config |
| 6 | `kitsune call market_get_dodo_route --args '{"fromToken":"0x..","toToken":"0x..","fromAmount":"1000000"}'` | DODO swap route / quote |

Add `--json` for machine-readable output.
