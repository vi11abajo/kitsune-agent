# Preflight

Before running any command in this skill:

## 1 — Install the Kitsune CLI
npm install -g @kitsune-ai/agent-cli

## 2 — Configure credentials (only needed for sign-in / on-chain writes)
Create ~/.kitsune/config.toml (mainnet is the default; the default profile uses REAL funds):

    default_profile = "mainnet"

    [profiles.mainnet]
    api_url     = "https://api.kitsune.finance/api"
    chain_id    = 1672
    rpc_url     = "https://rpc.pharos.xyz"
    private_key = "0x..."   # self-custody key; required ONLY for sign-in + on-chain writes

    [profiles.testnet]
    api_url     = "https://api.kitsune.finance/api"
    chain_id    = 688689
    rpc_url     = "https://atlantic.dplabs-internal.com"
    private_key = "0x..."

Market data needs no credentials.

**Key hygiene:** the config holds a private key — restrict it to your user only:

    chmod 600 ~/.kitsune/config.toml

## Safety rule — confirm before any [CAUTION] / signer command
**Before running ANY `[CAUTION]` or signer command** (`vault_create`, `vault_withdraw`,
`strategy_create`, `strategy_update`, `strategy_pause`, `strategy_resume`, `strategy_withdraw`),
the agent MUST show the user the exact command it is about to run — including all amounts and
addresses — and get the user's explicit confirmation. Never send an on-chain transaction or move
funds without that confirmation.

## Security rule — secrets NEVER appear in chat (CRITICAL)

`~/.kitsune/config.toml` holds a private key. When reading, writing, or debugging it (or any
config/env file), the agent MUST NOT print, echo, quote, or summarize secret values into the
conversation or logs: `private_key`, `KITSUNE_PRIVATE_KEY`, API keys, JWT tokens, seed phrases.

- Never `cat`/`type` a file that contains a secret. Extract only non-secret fields
  (e.g. `grep -v private_key ~/.kitsune/config.toml`).
- Never inline a literal key into a command line that is shown in chat — always reference it
  as an environment variable (`"$KITSUNE_PRIVATE_KEY"`, `"$PRIVATE_KEY"`).
- If a command's output accidentally contains a secret, redact it in the reply
  (`private_key = [REDACTED]`) — never repeat it.
- Public values are fine to show: wallet addresses, vault addresses, tx hashes, balances.
- If the user pastes a private key into the chat themselves, warn them it is now exposed in the
  conversation history and recommend moving funds to a fresh key.