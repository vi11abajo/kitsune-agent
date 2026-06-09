---
name: kitsune-referral
description: "Use this skill for Kitsune (Pharos) referrals: get or create your referral code and shareable link, resolve a referral code to its owner wallet, view your referral stats, or link a referrer to your account. Resolving a code is public; the rest require sign-in. Do NOT use for fee earnings (kitsune-fees), market data (kitsune-market), vaults (kitsune-vault), strategies (kitsune-strategy), portfolio (kitsune-portfolio), or the strategy marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.2.2"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.2.2", bins: ["kitsune"] }
---

# Kitsune Referrals

See [preflight](references/preflight.md) first. Only `referral_resolve` is public; the rest need sign-in.

| # | Command | Auth | Description |
|---|---------|------|-------------|
| 1 | `kitsune call referral_resolve --code <CODE>` | none | Resolve an 8-char code to the referrer wallet |
| 2 | `kitsune call referral_get_code` | jwt | Get / create your referral code + link |
| 3 | `kitsune call referral_get_stats` | jwt | Your total referrals + recent referred wallets |
| 4 | `kitsune call referral_link --code <CODE>` | jwt | Link a referrer (one-time; no self-referral) |

Add `--json` for machine-readable output.

## Examples

User asks: "What's my referral code and link?"

    kitsune call referral_get_code

Returns (or creates) your referral code and shareable link, e.g. `{ "code": "AB12CD34", "link": "https://kitsune.finance/?ref=AB12CD34" }`.

User asks: "Who owns referral code AB12CD34?"

    kitsune call referral_resolve --code AB12CD34

Resolves the 8-char code to the referrer wallet, e.g. `{ "code": "AB12CD34", "owner": "0xABCD...1234" }`.

User asks: "How many people have I referred?"

    kitsune call referral_get_stats

Returns your total referrals plus recently referred wallets, e.g. `{ "totalReferrals": 12, "recent": ["0x...", "0x..."] }`.
