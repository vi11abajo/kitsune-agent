---
name: kitsune-executor
description: "Use this skill to inspect Kitsune (Pharos) executors — the keepers that run strategies on-chain: list registered executors (to pick an allowedExecutor when creating a strategy), get one executor's details and job counts, or page through an executor's job history (PENDING / PROCESSING / CONFIRMED / FAILED). All reads require sign-in. Do NOT use for market data (kitsune-market), vaults (kitsune-vault), per-strategy management (kitsune-strategy), portfolio (kitsune-portfolio), or the strategy marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.2.8"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.2.8", bins: ["kitsune"] }
---

# Kitsune Executors

See [preflight](references/preflight.md) first — including the CRITICAL security rule: never output secrets (private keys, API keys, JWTs) to chat. All reads need sign-in.

| # | Command | Auth | Description |
|---|---------|------|-------------|
| 1 | `kitsune call executor_list` | jwt | List registered executors (add `--active false` to include inactive) |
| 2 | `kitsune call executor_get --address <addr>` | jwt | Executor details + pending/completed/failed job counts |
| 3 | `kitsune call executor_get_jobs --address <addr> --page 1 --pageSize 20 [--status CONFIRMED]` | jwt | Paginated job history |

Add `--json` for machine-readable output.

## Examples

User asks: "Which executors can I assign when creating a strategy?"

    kitsune call executor_list

Returns the registered (active) executors, e.g. `[{ "address": "0xEXEC...", "name": "...", "active": true }, ...]` — pick one as the `allowedExecutor` for a new strategy.

User asks: "How is executor 0xEXEC... doing?"

    kitsune call executor_get --address 0xEXEC000000000000000000000000000000abcd

Returns the executor's details plus its job counts, e.g. `{ "address": "0xEXEC...", "active": true, "pending": 1, "completed": 240, "failed": 3 }`.

User asks: "Show the last confirmed jobs for that executor."

    kitsune call executor_get_jobs --address 0xEXEC... --page 1 --pageSize 20 --status CONFIRMED

Returns a paginated list of CONFIRMED jobs for that executor, e.g. `{ "page": 1, "items": [{ "jobId": "...", "status": "CONFIRMED", "txHash": "0x..." }, ...] }`.
