---
name: kitsune-strategy
description: "Use this skill to manage Kitsune (Pharos) trading strategies: list strategies in a vault, get a strategy or its open position, view trade history and PnL/win-rate/Sharpe metrics, create/update/pause/resume a strategy, withdraw a strategy position, restart a DCA/grid cycle, set a strategy name/tags, or hide/restore a strategy. Reads and off-chain edits need sign-in; create/update/pause/resume/withdraw send on-chain transactions on Pharos Atlantic and require a private_key. Do NOT use for market data (kitsune-market), vault-level balances/creation (kitsune-vault), portfolio (kitsune-portfolio), or the marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.1.0"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.1.0", bins: ["kitsune"] }
---

# Kitsune Strategies

See ../_shared/preflight.md first. On-chain writes need a `private_key` and send transactions (testnet).

## Reads (sign-in required)
| # | Command | Description |
|---|---------|-------------|
| 1 | `kitsune call strategy_list --vault <addr>` | List strategies in a vault |
| 2 | `kitsune call strategy_get --vault <addr> --strategyId <id>` | Get one strategy |
| 3 | `kitsune call strategy_get_position --vault <addr> --strategyId <id>` | Open position state |
| 4 | `kitsune call strategy_get_trades --vault <addr> --strategyId <id> --limit 50` | Trade history |
| 5 | `kitsune call strategy_get_metrics --vault <addr> --strategyId <id>` | PnL / win-rate / Sharpe |

## On-chain writes (private_key required) — [CAUTION]
| # | Command | Description |
|---|---------|-------------|
| 6 | `kitsune call strategy_create --args '{"vault":"0x..","baseToken":"0x..","quoteToken":"0x..","allowedExecutor":"0x..","takeProfitBps":500,"stopLossBps":1000,"maxDcaCount":5,"maxTradesPerDay":3,"active":true,"firstBuyAmount":"1000000","maxPositionSize":"5000000","dcaMultiplier":"1500000000000000000"}'` | Create a strategy |
| 7 | `kitsune call strategy_update --args '{"vault":"0x..","strategyId":"3", ...same config fields...}'` | Update config |
| 8 | `kitsune call strategy_pause --vault <addr> --strategyId <id>` | Pause |
| 9 | `kitsune call strategy_resume --vault <addr> --strategyId <id>` | Resume |
| 10 | `kitsune call strategy_withdraw --vault <addr> --strategyId <id>` | Withdraw position |

## Off-chain edits (sign-in required)
| # | Command | Description |
|---|---------|-------------|
| 11 | `kitsune call strategy_restart_cycle --vault <addr> --strategyId <id>` | Reset DCA/grid cycle |
| 12 | `kitsune call strategy_set_metadata --args '{"vault":"0x..","strategyId":"3","name":"My DCA","tags":["dca"]}'` | Set name/tags |
| 13 | `kitsune call strategy_hide --vault <addr> --strategyId <id>` | Hide |
| 14 | `kitsune call strategy_restore --vault <addr> --strategyId <id>` | Restore |

Amounts (`firstBuyAmount`, `maxPositionSize`) are in token base units; `dcaMultiplier` is 1e18-scaled. Add `--json` for raw output.
