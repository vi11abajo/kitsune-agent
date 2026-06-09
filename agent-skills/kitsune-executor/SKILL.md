---
name: kitsune-executor
description: "Use this skill to inspect Kitsune (Pharos) executors — the keepers that run strategies on-chain: list registered executors (to pick an allowedExecutor when creating a strategy), get one executor's details and job counts, or page through an executor's job history (PENDING / PROCESSING / CONFIRMED / FAILED). All reads require sign-in. Do NOT use for market data (kitsune-market), vaults (kitsune-vault), per-strategy management (kitsune-strategy), portfolio (kitsune-portfolio), or the strategy marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.2.0"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.2.0", bins: ["kitsune"] }
---

# Kitsune Executors

See ../_shared/preflight.md first. All reads need sign-in.

| # | Command | Auth | Description |
|---|---------|------|-------------|
| 1 | `kitsune call executor_list` | jwt | List registered executors (add `--active false` to include inactive) |
| 2 | `kitsune call executor_get --address <addr>` | jwt | Executor details + pending/completed/failed job counts |
| 3 | `kitsune call executor_get_jobs --address <addr> --page 1 --pageSize 20 [--status CONFIRMED]` | jwt | Paginated job history |

Add `--json` for machine-readable output.
