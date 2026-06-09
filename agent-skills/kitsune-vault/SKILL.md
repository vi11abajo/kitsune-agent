---
name: kitsune-vault
description: "Use this skill for Kitsune (Pharos) vault operations: list a wallet's vaults, view a vault's token balances or position/allocation breakdown, create a new vault, or withdraw tokens from a vault. Reads require sign-in; create/withdraw send on-chain transactions on Pharos Atlantic and require a private_key in ~/.kitsune/config.toml. Do NOT use for market data (kitsune-market), per-strategy management (kitsune-strategy), portfolio/leaderboard (kitsune-portfolio), or the marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.1.0"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune/agent-cli@0.1.0", bins: ["kitsune"] }
---

# Kitsune Vaults

See ../_shared/preflight.md first. Reads need sign-in; writes need a `private_key` and send on-chain transactions (testnet).

| # | Command | Auth | Description |
|---|---------|------|-------------|
| 1 | `kitsune call vault_list --owner <addr>` | jwt | List vaults owned by an address |
| 2 | `kitsune call vault_get_balances --vault <addr>` | jwt | Token balances in a vault |
| 3 | `kitsune call vault_get_allocations --vault <addr>` | jwt | Position / allocation breakdown |
| 4 | `kitsune call vault_create --dexRouter <addr> --oracle <addr>` | signer | **[CAUTION]** Deploy a new vault on-chain |
| 5 | `kitsune call vault_withdraw --args '{"vault":"0x..","token":"0x..","amount":"1000000"}'` | signer | **[CAUTION]** Withdraw tokens on-chain |

Add `--json` for machine-readable output.
