---
name: kitsune-notifications
description: "Use this skill to manage Kitsune (Pharos) notification settings: check Telegram link status, list notification preferences, set global or per-strategy preferences (buy / sell / error / low-balance alerts), or unlink Telegram. All require sign-in. Do NOT use for fee earnings (kitsune-fees), referrals (kitsune-referral), market data (kitsune-market), vaults (kitsune-vault), strategies (kitsune-strategy), or portfolio (kitsune-portfolio)."
license: MIT
metadata:
  author: kitsune
  version: "0.2.1"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.2.1", bins: ["kitsune"] }
---

# Kitsune Notifications

See ../_shared/preflight.md first. All require sign-in.

| # | Command | Auth | Description |
|---|---------|------|-------------|
| 1 | `kitsune call notifications_get_telegram_status` | jwt | Is a Telegram account linked? |
| 2 | `kitsune call notifications_get_preferences` | jwt | List preferences (global + per-strategy) |
| 3 | `kitsune call notifications_set_preferences --args '{"notifyBuy":true,"notifySell":true,"notifyError":true,"notifyLowBalance":true}'` | jwt | Upsert prefs (add `"strategyId":"<uuid>"` for a per-strategy override) |
| 4 | `kitsune call notifications_unlink_telegram` | jwt | **[CAUTION]** Unlink Telegram (stops all alerts) |

Add `--json` for machine-readable output.
