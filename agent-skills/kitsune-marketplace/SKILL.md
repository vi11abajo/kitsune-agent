---
name: kitsune-marketplace
description: "Use this skill for the Kitsune (Pharos) strategy marketplace: browse or filter shared strategies, view a marketplace strategy by id, share one of your strategies, copy a marketplace strategy into your vault, or delist your strategy. Browsing is public; share/copy/delist require sign-in. Do NOT use for market data (kitsune-market), vault balances/creation (kitsune-vault), per-strategy management inside a vault (kitsune-strategy), or portfolio/leaderboard (kitsune-portfolio)."
license: MIT
metadata:
  author: kitsune
  version: "0.1.0"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.1.0", bins: ["kitsune"] }
---

# Kitsune Marketplace

See ../_shared/preflight.md first. Browsing is public; sharing/copying/delisting needs sign-in.

| # | Command | Auth | Description |
|---|---------|------|-------------|
| 1 | `kitsune call marketplace_list --status active` | none | Browse shared strategies |
| 2 | `kitsune call marketplace_get --id <publicId>` | none | Get a marketplace strategy |
| 3 | `kitsune call marketplace_share --args '{"name":"My DCA","sourceVaultAddress":"0x..","sourceStrategyId":"3","tradingPair":"BTC/USDT","tags":["dca"]}'` | jwt | Publish a strategy |
| 4 | `kitsune call marketplace_copy --id <publicId> --vault <addr>` | jwt | Copy into your vault |
| 5 | `kitsune call marketplace_delist --id <publicId>` | jwt | Delist your strategy |

Add `--json` for machine-readable output.
