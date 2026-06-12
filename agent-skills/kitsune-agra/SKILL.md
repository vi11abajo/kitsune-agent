---
name: kitsune-agra
description: "Use this skill for Agra bond-market data on Kitsune (Pharos): pALPHA NAV history (hourly/daily, 1w–3m ranges) for the pALPHA bond market trading against Kitsune USDC. Public — no sign-in needed. Trigger on: \"pALPHA NAV\", \"pALPHA price history\", \"bond NAV chart\", \"how has pALPHA performed\". Do NOT use for token spot prices/candles/indicators (kitsune-market), vaults (kitsune-vault), strategies (kitsune-strategy), portfolio (kitsune-portfolio), or the strategy marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.2.6"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.2.6", bins: ["kitsune"] }
---

# Kitsune Agra (pALPHA)

See [preflight](references/preflight.md) first — including the CRITICAL security rule: never output secrets (private keys, API keys, JWTs) to chat. All commands here are public — no credentials needed.

pALPHA is an Agra bond market settled in Kitsune USDC on Pharos mainnet. NAV history comes from the
Agra API via the Kitsune backend (cached ~60s).

| # | Command | Auth | Description |
|---|---------|------|-------------|
| 1 | `kitsune call agra_get_nav_history` | none | NAV history for pALPHA (defaults: `--timeframe hour`, `--range 1m`) |

Options: `--marketId 0x...` (defaults to the pALPHA market `0xE47E9bA4EA2320A6ed87246d02Fd5C38485Ed7d1`),
`--timeframe hour|day`, `--range 1w|1m|3m`. Add `--json` for machine-readable output.

## Examples

User asks: "How has pALPHA performed this week?"

    kitsune call agra_get_nav_history --timeframe hour --range 1w

Returns the NAV series for the past week; summarize start → end NAV and % change.

User asks: "Show me the 3-month pALPHA NAV chart data, daily."

    kitsune call agra_get_nav_history --timeframe day --range 3m

Use the daily series to describe the trend (drawdowns, recovery, current NAV vs period high/low).
