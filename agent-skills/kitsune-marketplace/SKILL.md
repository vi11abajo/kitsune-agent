---
name: kitsune-marketplace
description: "Use this skill for the Kitsune (Pharos) strategy marketplace: browse or filter shared strategies, view a marketplace strategy by id, share one of your strategies, copy a marketplace strategy into your vault, or delist your strategy. Browsing is public; share/copy/delist require sign-in. Do NOT use for market data (kitsune-market), vault balances/creation (kitsune-vault), per-strategy management inside a vault (kitsune-strategy), or portfolio/leaderboard (kitsune-portfolio)."
license: MIT
metadata:
  author: kitsune
  version: "0.2.8"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.2.8", bins: ["kitsune"] }
---

# Kitsune Marketplace

See [preflight](references/preflight.md) first — including the CRITICAL security rule: never output secrets (private keys, API keys, JWTs) to chat. Browsing is public; sharing/copying/delisting needs sign-in.

| # | Command | Auth | Description |
|---|---------|------|-------------|
| 1 | `kitsune call marketplace_list --sort popular` | none | Browse shared strategies (sort: popular / newest / rating; optional `--pair WPROS/USDC`) |
| 2 | `kitsune call marketplace_get --id <publicId>` | none | Get a marketplace strategy |
| 3 | `kitsune call marketplace_share --args '{"name":"My DCA","tradingPair":"WPROS/USDC","strategyType":"dca","sourceVaultAddress":"0x..","sourceStrategyId":3}'` | jwt | Publish a strategy (name + tradingPair required; sourceStrategyId is a number) |
| 4 | `kitsune call marketplace_copy --id <publicId>` | jwt | Record a copy (increments copy count) |
| 5 | `kitsune call marketplace_delist --id <publicId>` | jwt | Delist your strategy |

Add `--json` for machine-readable output.

## Examples

User asks: "Show me the most popular shared strategies."

    kitsune call marketplace_list --sort popular

Returns the public listing of shared strategies, e.g. `[{ "publicId": "abc123", "name": "...", "tradingPair": "WPROS/USDC", "copies": 87, "rating": 4.5 }, ...]`.

User asks: "Open the marketplace strategy abc123."

    kitsune call marketplace_get --id abc123

Returns the full marketplace strategy detail for that public id (config, pair, copy count, rating).

User asks: "Copy strategy abc123 into my account."

    kitsune call marketplace_copy --id abc123

Records the copy (increments the copy count) and returns the updated listing reference.
