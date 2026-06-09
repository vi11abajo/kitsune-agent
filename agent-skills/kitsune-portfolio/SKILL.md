---
name: kitsune-portfolio
description: "Use this skill for Kitsune (Pharos) portfolio and ranking views: aggregated portfolio metrics across a wallet's vaults, recent trade activity for a vault, and the traders/strategies leaderboard (weekly, monthly, or all-time). Portfolio and activity require sign-in; the leaderboard is public. Do NOT use for market data (kitsune-market), vault balances/creation (kitsune-vault), per-strategy management (kitsune-strategy), or the strategy marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.1.0"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune/agent-cli@0.1.0", bins: ["kitsune"] }
---

# Kitsune Portfolio

See ../_shared/preflight.md first.

| # | Command | Auth | Description |
|---|---------|------|-------------|
| 1 | `kitsune call portfolio_get --owner <addr>` | jwt | Aggregated portfolio metrics |
| 2 | `kitsune call portfolio_get_activity --vault <addr>` | jwt | Recent trade activity for a vault |
| 3 | `kitsune call leaderboard_get --period weekly` | none | Leaderboard (weekly / monthly / all-time) |

Add `--json` for machine-readable output.
