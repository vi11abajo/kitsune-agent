---
name: kitsune-fees
description: "Use this skill for Kitsune (Pharos) fee earnings: view your creator + referrer fee dashboard (earned vs claimed, referral count and link) and your daily fee-earnings history. All require sign-in. Do NOT use for referral setup (kitsune-referral), market data (kitsune-market), vaults (kitsune-vault), strategies (kitsune-strategy), portfolio (kitsune-portfolio), or the strategy marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.2.1"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.2.1", bins: ["kitsune"] }
---

# Kitsune Fees

See ../_shared/preflight.md first. All reads need sign-in.

| # | Command | Auth | Description |
|---|---------|------|-------------|
| 1 | `kitsune call fees_get_dashboard` | jwt | Creator + referrer earned/claimed totals + referral link |
| 2 | `kitsune call fees_get_history` | jwt | Daily-aggregated fee earnings (optional `--chainId`) |

Add `--json` for machine-readable output.
