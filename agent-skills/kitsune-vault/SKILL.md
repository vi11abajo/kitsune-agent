---
name: kitsune-vault
description: "Use this skill for Kitsune (Pharos) vault operations: list a wallet's vaults, view a vault's token balances or position/allocation breakdown, create a new vault, or withdraw tokens from a vault. Reads require sign-in; create/withdraw send on-chain transactions on Pharos (mainnet by default; testnet via --profile testnet) and require a private_key in ~/.kitsune/config.toml. Do NOT use for market data (kitsune-market), per-strategy management (kitsune-strategy), portfolio/leaderboard (kitsune-portfolio), or the marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.2.10"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.2.10", bins: ["kitsune"] }
---

# Kitsune Vaults

See [preflight](references/preflight.md) first — including the CRITICAL security rule: never output secrets (private keys, API keys, JWTs) to chat. Reads need sign-in; writes need a `private_key` and send on-chain transactions on Pharos (mainnet by default; use `--profile testnet` for Atlantic).

| # | Command | Auth | Description |
|---|---------|------|-------------|
| 1 | `kitsune call vault_list --owner <addr>` | jwt | Get the vault owned by an address |
| 2 | `kitsune call vault_get_balances --vault <addr>` | jwt | Token balances in a vault |
| 3 | `kitsune call vault_get_allocations --vault <addr>` | jwt | Position / allocation breakdown |
| 4 | `kitsune call vault_create` | signer | **[CAUTION]** Deploy a new vault on-chain — **no address args needed**; the kit fills in the chain's default DEX router + oracle. Only pass `--dexRouter`/`--oracle` for an advanced custom setup. |
| 5 | `kitsune call vault_withdraw --args '{"vault":"0x..","token":"0x..","amount":"1000000"}'` | signer | **[CAUTION]** Withdraw tokens on-chain |

Add `--json` for machine-readable output.

## Examples

User asks: "List the vaults owned by 0xABCD...1234."

    kitsune call vault_list --owner 0xABCD000000000000000000000000000000001234

Returns the vault owned by that address, e.g. `{ "vault": "0xVAULT...", "owner": "0xABCD...1234" }` (or an empty result if none).

User asks: "What tokens are in my vault 0xVAULT...?"

    kitsune call vault_get_balances --vault 0xVAULT000000000000000000000000000000abcd

Returns the per-token balances held by the vault, e.g. `[{ "token": "0xUSDC...", "symbol": "USDC", "balance": "1500000000" }, ...]`.

User asks: "Create a vault for me."

`vault_create` needs **no** router/oracle — the kit supplies the chain defaults (do NOT hunt for or
invent those addresses). It's a `[CAUTION]` on-chain transaction, so show the exact command and get
explicit confirmation first:

    kitsune call vault_create

Returns the deploy transaction hash. Each wallet has exactly one vault; strategies live inside it.
Confirm it exists afterward with `vault_list --owner <your-address>`.

User asks: "Withdraw 1 USDC from my vault back to me."

The command moves funds on-chain, so the agent first shows the exact command and waits for explicit user confirmation before sending:

    kitsune call vault_withdraw --args '{"vault":"0xVAULT...","token":"0xUSDC...","amount":"1000000"}'

Only after the user confirms does the agent run it; it then returns the broadcast transaction hash.
