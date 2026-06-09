# Preflight

Before running any command in this skill:

## Step 1 — Install the Kitsune CLI
npm install -g @kitsune-ai/agent-cli

## Step 2 — Configure credentials (only needed for vault/strategy writes)
Create ~/.kitsune/config.toml:

    default_profile = "testnet"
    [profiles.testnet]
    api_url     = "https://api.kitsune.finance/api"
    chain_id    = 688689
    rpc_url     = "https://atlantic.dplabs-internal.com"
    private_key = "0x..."   # self-custody key; required ONLY for on-chain writes

Market data needs no credentials.

## Step 3 — Verify
kitsune market price BTC USDT
