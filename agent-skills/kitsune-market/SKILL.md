---
name: kitsune-market
description: "Use this skill when the user asks for market data on Kitsune/Pharos: price of an asset, ticker, 24h stats, OHLCV candles, technical indicators (RSI, MACD, EMA, Bollinger Bands), a DODO swap-route quote, or a strategy backtest. Price/candles/indicators need no credentials; backtests and DODO route quotes are read-only too but need sign-in. Do NOT use for vault balances (kitsune-vault), strategy management (kitsune-strategy), portfolio/leaderboard (kitsune-portfolio), or the strategy marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.2.12"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.2.12", bins: ["kitsune"] }
---

# Kitsune Market Data

Read-only. See [preflight](references/preflight.md) first — including the CRITICAL security rule: never output secrets (private keys, API keys, JWTs) to chat.

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

## Examples

User asks: "What's the price of BTC right now?"

    kitsune market price BTC USDT

Returns the current price plus 24h stats (last price, 24h change %, high/low, volume).

User asks: "Show me the last 50 hourly candles for WPROS/USDC."

    kitsune market candles WPROS USDC --interval 1h --limit 50

Returns an array of OHLCV candles, e.g. `[{ "time": 1700000000, "open": 0.71, "high": 0.73, "low": 0.70, "close": 0.72, "volume": 12345 }, ...]`.

User asks: "Is BTC overbought? Check the indicators."

    kitsune market indicators BTC USDT

Returns the current technical indicators (RSI, MACD, EMA, Bollinger Bands) so the agent can read the RSI value against the 70/30 thresholds.
