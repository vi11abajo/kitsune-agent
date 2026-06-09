---
name: kitsune-referral
description: "Use this skill for Kitsune (Pharos) referrals: get or create your referral code and shareable link, resolve a referral code to its owner wallet, view your referral stats, or link a referrer to your account. Resolving a code is public; the rest require sign-in. Do NOT use for fee earnings (kitsune-fees), market data (kitsune-market), vaults (kitsune-vault), strategies (kitsune-strategy), portfolio (kitsune-portfolio), or the strategy marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.2.0"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.2.0", bins: ["kitsune"] }
---

# Kitsune Referrals

See ../_shared/preflight.md first. Only `referral_resolve` is public; the rest need sign-in.

| # | Command | Auth | Description |
|---|---------|------|-------------|
| 1 | `kitsune call referral_resolve --code <CODE>` | none | Resolve an 8-char code to the referrer wallet |
| 2 | `kitsune call referral_get_code` | jwt | Get / create your referral code + link |
| 3 | `kitsune call referral_get_stats` | jwt | Your total referrals + recent referred wallets |
| 4 | `kitsune call referral_link --code <CODE>` | jwt | Link a referrer (one-time; no self-referral) |

Add `--json` for machine-readable output.
