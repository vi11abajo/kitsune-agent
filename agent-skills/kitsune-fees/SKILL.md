---
name: kitsune-fees
description: "Use this skill for Kitsune (Pharos) fee earnings: view your creator + referrer fee dashboard (earned vs claimed, referral count and link) and your daily fee-earnings history. All require sign-in. Do NOT use for referral setup (kitsune-referral), market data (kitsune-market), vaults (kitsune-vault), strategies (kitsune-strategy), portfolio (kitsune-portfolio), or the strategy marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.2.14"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.2.14", bins: ["kitsune"] }
---

# Kitsune Fees

See [preflight](references/preflight.md) first — including the CRITICAL security rule: never output secrets (private keys, API keys, JWTs) to chat. All reads need sign-in.

| # | Command | Auth | Description |
|---|---------|------|-------------|
| 1 | `kitsune call fees_get_dashboard` | jwt | Creator + referrer earned/claimed totals + referral link |
| 2 | `kitsune call fees_get_history` | jwt | Daily-aggregated fee earnings (optional `--chainId`) |

Add `--json` for machine-readable output.

## Examples

User asks: "How much have I earned in fees so far?"

    kitsune call fees_get_dashboard

Returns your creator + referrer earned/claimed totals plus your referral link, e.g. `{ "creatorEarned": "...", "creatorClaimed": "...", "referrerEarned": "...", "referralCount": 12, "referralLink": "https://kitsune.finance/?ref=AB12CD34" }`.

User asks: "Show my daily fee earnings history on mainnet."

    kitsune call fees_get_history --chainId 1672

Returns the daily-aggregated fee earnings, e.g. `[{ "date": "2026-06-09", "amount": "..." }, { "date": "2026-06-10", "amount": "..." }, ...]`.
