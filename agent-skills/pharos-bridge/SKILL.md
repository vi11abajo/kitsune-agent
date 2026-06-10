---
name: pharos-bridge
description: >
  Direct-protocol cross-chain bridge for Pharos Network — Circle CCTP V2 for native USDC
  (burn-and-mint, no aggregators, no wrapped tokens, 1:1) and Chainlink CCIP for PROS
  (direct Router calls, no wrappers). Bridges tokens between Pharos and 7 EVM chains
  (Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, BSC) with automated full-lifecycle
  pipeline: pre-checks, approve, burn/send, attestation polling, mint/receive, unwrap — all
  from a single user confirmation. Multi-network balance queries across all chains in one
  command. Complete on-chain toolkit: transactions, contract deployment/verification, batch
  airdrops with Merkle-tree whitelist, holder analytics, and auto-generated interaction scripts
  (JS/TS/Python). The on-ramp for Kitsune: bridge USDC from any major chain onto Pharos, then
  fund vaults and strategies with the kitsune-vault / kitsune-strategy skills. Invoke on
  "bridge", "cross-chain", "Pharos", "PROS", "USDC", "check balances", or any on-chain
  operation. Do NOT use for Kitsune vaults/strategies themselves (kitsune-vault,
  kitsune-strategy) or market data (kitsune-market).
license: MIT
metadata:
  author: kitsune
  version: "2.0.0"
  agent:
    requires: { bins: ["cast", "jq"] }
---

# Pharos Bridge & Chain Skill

Cross-chain bridge for moving tokens between Pharos and supported EVM chains, plus full developer toolkit for Pharos on-chain operations.

## Use with Kitsune (on-ramp)

This skill is the funding on-ramp for the Kitsune trading skills. Typical flow:

1. **Bridge in** — "bridge 500 USDC from Base to Pharos" (this skill, Circle CCTP V2; native USDC 1:1).
2. **Trade** — once USDC is on Pharos, switch to the Kitsune skills: `kitsune-vault` (create a vault,
   deposit), `kitsune-strategy` (DCA / grid), `kitsune-market` (prices, indicators).
3. **Bridge out** — withdraw from the vault (`kitsune-vault`), then "bridge USDC from Pharos to <chain>".

Notes:
- The Kitsune skills keep their key in `~/.kitsune/config.toml`; this skill reads `PRIVATE_KEY` from a
  local `.env`. Use the same wallet in both so bridged funds land where Kitsune expects them.
- USDC on Pharos is at `bridge.USDC.addresses.pharos` in `$SKILL_DIR/assets/tokens.json` — the same
  token Kitsune vaults use as the quote asset.
- This skill talks to chains directly via `cast`; it does not use the `kitsune` CLI.

## Prerequisites

1. **Install Foundry** (MANDATORY):
   - Check: `which cast`
   - If not found:
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   source ~/.zshenv && foundryup
   cast --version
   ```
   - If installation fails, STOP and inform the user.

2. **Install jq** (for JSON parsing): `which jq`

## Phase 0: Setup (run once per session)

This phase runs automatically every time the skill is invoked.

### Step 0.0: Locate the Skill Directory

All config files (`assets/tokens.json`, `assets/networks.json`, airdrop contracts) live inside this
skill's own directory. Determine `SKILL_DIR` = the **absolute path of the directory containing this
SKILL.md** (e.g. `~/.claude/skills/pharos-bridge` or `<repo>/agent-skills/pharos-bridge`, depending
on where the skill is installed).

Shell state does NOT persist between Bash tool calls — re-use the absolute value (or re-derive it)
in EVERY command that reads `$SKILL_DIR/assets/...`.

### Step 0.1: Environment File Setup

**Determine project root:**

```bash
PROJECT_ROOT=$(pwd)
ENV_FILE="$PROJECT_ROOT/.env"
```

The agent MUST determine the absolute path to the project root once and reuse it for ALL subsequent commands. Store `ENV_FILE` as the absolute path to `.env`.

1. Check if `.env` exists at the project root:

```bash
[ -f "$ENV_FILE" ] && echo ".env exists at: $ENV_FILE" || echo ".env not found"
```

2. If `.env` does NOT exist, create it:

```bash
cat > "$ENV_FILE" << 'ENVEOF'
# ============================================
# Pharos Bridge — Environment Variables
# ============================================
# Fill in your values below. NEVER share this file or commit it to git.
# ============================================

# Your wallet private key (without 0x prefix)
# SECURITY: Edit this file directly. Do NOT paste your key in chat.
# How to export from MetaMask: Account Details → Show Private Key
PRIVATE_KEY=
ENVEOF
echo ".env created at: $ENV_FILE"
```

3. Ensure `.env` is in `.gitignore`:

```bash
GITIGNORE="$PROJECT_ROOT/.gitignore"
[ -f "$GITIGNORE" ] && grep -qxF '.env' "$GITIGNORE" || echo '.env' >> "$GITIGNORE"
```

**CRITICAL — Shell state does NOT persist between Bash tool calls.** Every command MUST:
- Source `.env` using the **absolute path**: `set -a && source $ENV_FILE && set +a && ...rest...`
- NEVER use relative `source .env` — it breaks if CWD changes
- The `$ENV_FILE` variable does NOT persist either — the agent MUST re-determine or hardcode the absolute path in every command

### Step 0.2: Verify Private Key

Check if PRIVATE_KEY is set. **ONLY output "set" or "not set" — never the actual value.**

```bash
set -a && source $ENV_FILE && set +a && [ -n "$PRIVATE_KEY" ] && echo "PRIVATE_KEY: set" || echo "PRIVATE_KEY: not set"
```

**FORBIDDEN COMMANDS — NEVER RUN THESE:**
```
cat .env
echo $PRIVATE_KEY
printenv PRIVATE_KEY
head .env
grep PRIVATE_KEY .env
```
Any command that would output the private key value to chat is ABSOLUTELY FORBIDDEN.

If not set, guide the user:

```
Please open the .env file and add your private key:
  File: {absolute_path_to_.env}

Set: PRIVATE_KEY=your_key_here (with or without 0x prefix)

NEVER paste keys in chat.
```

After the user confirms they filled in the key, normalize it (strip 0x prefix if present):

```bash
sed -i 's/^PRIVATE_KEY=0[xX]\(.*\)/PRIVATE_KEY=\1/' "$ENV_FILE"
```

### Step 0.3: Check Dependencies (quick check)

```bash
cast --version || $HOME/.foundry/bin/cast --version
jq --version
```

If `cast` not found → offer to install Foundry. If `jq` not found → ask user to install it.

### Security Rules (CRITICAL — enforce at all times)

1. **NEVER** output, display, echo, print, cat, grep, or log the value of PRIVATE_KEY or any secret
2. **NEVER** ask the user to paste private keys or secrets in chat
3. **NEVER** run `cat .env`, `echo $PRIVATE_KEY`, `printenv`, `grep PRIVATE_KEY`, or any command that could leak secrets to chat output
4. **ALWAYS** check .env with safe commands only: `[ -n "$PRIVATE_KEY" ] && echo "set" || echo "not set"`
5. **ALWAYS** show the full absolute path to the `.env` file so the user can find it
6. If the user accidentally pastes a secret in chat — warn immediately, suggest rotating the key

## Shell State Note (CRITICAL)

Shell state does NOT persist between Bash tool calls. EVERY command that uses env vars MUST source `.env` with the **absolute path** determined in Step 0.1:

```bash
set -a && source /absolute/path/to/.env && set +a && ...rest of command...
```

## Supported Bridge Chains

| Chain | USDC (CCTP) | PROS (CCIP) |
|-------|-------------|-------------|
| **Pharos** (1672) | yes | yes (native) |
| **Ethereum** (1) | yes | yes |
| **Base** (8453) | yes | yes |
| **Arbitrum** (42161) | yes | - |
| **Optimism** (10) | yes | - |
| **Polygon** (137) | yes | - |
| **Avalanche** (43114) | yes | - |
| **BSC** (56) | yes | - |

## Capability Index

Load the corresponding reference file based on user needs:

| User Need | Capability | Reference |
|-----------|------------|-----------|
| Bridge USDC to/from Pharos | Circle CCTP V2 (burn-and-mint) | `references/bridge-usdc.md` |
| Bridge PROS to/from Pharos | Chainlink CCIP (direct Router) | `references/bridge-pros.md` |
| View wallet portfolio / asset overview | `cast balance` + `cast call` (batch query all known tokens) | `references/query.md#address-portfolio-wallet-asset-overview` |
| Query address balance | `cast balance` / `cast call` | `references/query.md#balance-query` |
| Query transaction status | `cast tx` / `cast receipt` | `references/query.md#transaction-query` |
| Call contract read-only method | `cast call` | `references/query.md#contract-read-only-call` |
| Send transaction (native transfer) | `cast send` | `references/transaction.md#native-token-transfer` |
| Call contract write method | `cast send` | `references/transaction.md#contract-write-call` |
| Estimate Gas | `cast estimate` | `references/transaction.md#gas-estimation` |
| Deploy contract | `forge script` (auto-generate deploy script) | `references/contract.md#deploy-contract-forge-script` |
| Verify contract | `forge verify-contract` | `references/contract.md#verify-contract` |
| One-click ERC20 deploy | `forge script` + built-in ERC20 template | `references/contract.md#erc20-one-click-deploy-built-in-template` |
| Batch transfer / Airdrop | `forge script` (auto-generate airdrop script, supports 6000+ address batched airdrop, CSV file input, three-tier auto mode: ≤10 simple mode / 11-200 single batch / >200 multi-batch, hardened Distributor contract) | `references/transaction.md#batch-transfer--airdrop` |
| Generate contract interaction scripts (read/write methods, JS/TS/Python) | Script_Generator (Agent auto-generates) | `references/script-gen.md` |

## Bridge Overview

### USDC Bridge (Circle CCTP V2)
- **TokenMessengerV2**: `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` (all chains)
- **MessageTransmitterV2**: `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` (all chains)
- **Method**: Circle CCTP V2 burn-and-mint (native 1:1, no wrapped tokens)
- **Speed**: Fast Transfer (threshold ≤ 1000): seconds to minutes. Standard (2000): 5-20 min
- **Fee**: Fast Transfer fee ~0.0001% in USDC. Gas in native token on each chain
- **Pharos CCTP Domain**: 31 (NOT chain ID 1672)
- **Flow**: approve → depositForBurn (burn) → poll Iris API for attestation → receiveMessage (mint)

### PROS Bridge (Chainlink CCIP)
- **CCIP Router (Pharos)**: `0x4e52dD94e9BCfeFE3C78153bDfB0AB1d30687297`
- **CCIP Router (Base)**: `0x881e3A65B4d4a04dD529061dd0071cf975F58bCD`
- **CCIP Router (Ethereum)**: `0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D`
- **Method**: Direct Chainlink CCIP (burn-and-mint / lock-and-release)
- **Speed**: 5-20 minutes
- **Fee**: CCIP fee in source chain native token (~0.257 PROS for Pharos→Base)
- **Pharos CCIP Selector**: `7801139999541420232`
- **Flow**: wrap PROS→WPROS → approve Router → ccipSend → CCIP handles transfer → unwrap WPROS→PROS
- **Routes**: Pharos↔Base, Pharos↔Ethereum (bidirectional)

## Bridge Flow

### Bridge UX (MANDATORY — read carefully)

**The bridge experience MUST be seamless and automatic.** When the user says "bridge 1 USDC from Pharos to Base" or "send 10 PROS to Ethereum", the agent:

1. Confirms parameters ONCE: amount, token, source → destination. Show clearly: "Bridging 1 USDC from Pharos to Base. Proceed?"
2. Executes the ENTIRE pipeline automatically — approve, burn/send, poll attestation (USDC only), mint/receive
3. Returns with the final result: tx hashes, explorer links, completion status

**CRITICAL RULES:**
- Do NOT ask for confirmation before each bash command. Run them sequentially.
- Do NOT show intermediate command output unless there's an error. Process it internally.
- Do NOT stop to explain each step. The user wants the result, not a tutorial.
- DO handle errors: if any step fails, stop and report the error clearly with the tx hash.
- DO show progress concisely: "Burning 1 USDC on Pharos...", "Waiting for attestation...", "Minting on Base..."
- DO return the final result with both source and destination tx hashes + explorer links.

### USDC Bridge Flow (CCTP V2)

1. **Parse request** — identify: amount, source chain, destination chain
2. **Validate route** — check supported chains table
3. **Read configs** — load all addresses from `assets/tokens.json` (cctp section)
4. **Pre-checks** (silent) — source .env, verify key, derive address, check balances
5. **Approve** — approve USDC to TokenMessengerV2 (skip if allowance sufficient)
6. **Burn** — depositForBurn with CCTP domain IDs (NOT chain IDs), bytes32 recipient, maxFee=500, minFinalityThreshold=1000
7. **Poll attestation** — Circle Iris API until status="complete" (auto-poll, up to 5 min)
8. **Mint** — receiveMessage(message, attestation) on destination chain
9. **Report** — source tx hash, destination tx hash, explorer links

### PROS Bridge Flow (CCIP)

1. **Parse request** — identify: amount, source chain, destination chain
2. **Validate route** — check supported chains (Pharos↔Base, Pharos↔Ethereum)
3. **Read configs** — load CCIP routers, selectors, token pools from `assets/tokens.json` (ccip section). **ALL addresses MUST be lowercased for tuple encoding**: `jq ... | tr '[:upper:]' '[:lower:]'`
4. **Verify network** — `cast chain-id --rpc-url $RPC` must match expected chain ID from networks.json. This prevents sending to testnet by mistake
5. **Pre-checks** (silent) — source .env, verify key, derive address, check balances
6. **Wrap** — if sending FROM Pharos: deposit() PROS → WPROS
7. **Approve** — approve WPROS/PROS to CCIP Router
8. **Estimate fee** — getFee() to determine ccipSend value
9. **Send** — `ccipSend(uint64,(bytes,bytes,(address,uint256)[],address,bytes))` with CCIP chain selector (NOT chain ID). Receiver = `0x000000000000000000000000${ADDRESS:2}`
10. **Report** — source tx hash, CCIP message ID, link to CCIP Explorer
11. **Unwrap** (optional) — if receiving ON Pharos: withdraw() WPROS → native PROS

### CCIP Common Pitfalls (CRITICAL)

- `cast call` returns DECIMAL — never use `$((16#...))` hex conversion on balance output
- Addresses in cast tuples MUST be lowercase — mixed case causes `odd number of digits`
- ccipSend has exactly 2 params: `uint64` + EVM2AnyMessage tuple (6 fields)
- Receiver address must be bytes32: `0x000000000000000000000000${ADDRESS:2}`
- ALWAYS read RPC from `assets/networks.json` — never guess or use hardcoded RPCs
- Verify chain ID before sending: `cast chain-id --rpc-url $RPC` must match expected value

### CCTP Domain IDs (CRITICAL — NOT Chain IDs)

CCTP uses Circle's internal domain IDs. Read from `assets/tokens.json` → `cctp.domains`:

| Network | Chain ID | CCTP Domain |
|---------|----------|-------------|
| Pharos | 1672 | **31** |
| Ethereum | 1 | 0 |
| Avalanche | 43114 | 1 |
| OP Mainnet | 10 | 2 |
| Arbitrum | 42161 | 3 |
| Base | 8453 | 6 |
| Polygon PoS | 137 | 7 |
| BSC | 56 | 17 |

### CCIP Chain Selectors (CRITICAL — NOT Chain IDs)

CCIP uses Chainlink's internal selectors. Read from `assets/tokens.json` → `ccip.chainSelectors`:

| Network | Chain ID | CCIP Selector |
|---------|----------|---------------|
| Pharos | 1672 | **7801139999541420232** |
| Base | 8453 | **15971525489660198786** |
| Ethereum | 1 | **5009297550715157269** |

### USDC Bridge — One-shot Command Sequence

The agent should execute the full pipeline automatically without asking extra questions. Only confirm the bridge parameters (amount, token, direction) once, then execute all steps:

```bash
# 1. Config (from assets files)
TOKEN_MESSENGER=$(jq -r '.cctp.contracts.tokenMessengerV2' $SKILL_DIR/assets/tokens.json)
MSG_TRANSMITTER=$(jq -r '.cctp.contracts.messageTransmitterV2' $SKILL_DIR/assets/tokens.json)
IRIS_API=$(jq -r '.cctp.api.mainnet' $SKILL_DIR/assets/tokens.json)
SRC_DOMAIN=$(jq -r '.cctp.domains.pharos' $SKILL_DIR/assets/tokens.json)   # source domain
DEST_DOMAIN=$(jq -r '.cctp.domains.base' $SKILL_DIR/assets/tokens.json)    # dest domain
SRC_RPC=$(jq -r '.networks[] | select(.name=="pharos") | .rpcUrl' $SKILL_DIR/assets/networks.json)
DEST_RPC=$(jq -r '.networks[] | select(.name=="base") | .rpcUrl' $SKILL_DIR/assets/networks.json)
SRC_USDC=$(jq -r '.bridge.USDC.addresses.pharos' $SKILL_DIR/assets/tokens.json)

# 2. Pre-checks (silent — do not ask user)
set -a && source $ENV_FILE && set +a
ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)
# Check USDC balance + gas balance...

# 3. Approve (if needed)
cast send $SRC_USDC "approve(address,uint256)" $TOKEN_MESSENGER $AMOUNT --rpc-url $SRC_RPC --private-key $PRIVATE_KEY

# 4. Burn
MINT_RECIPIENT="0x000000000000000000000000${ADDRESS:2}"
ZERO_BYTES32="0x0000000000000000000000000000000000000000000000000000000000000000"
BURN_TX=$(cast send $TOKEN_MESSENGER \
  "depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)" \
  $AMOUNT $DEST_DOMAIN $MINT_RECIPIENT $SRC_USDC $ZERO_BYTES32 500 1000 \
  --rpc-url $SRC_RPC --private-key $PRIVATE_KEY)
TX_HASH=$(echo "$BURN_TX" | grep "transactionHash" | head -1 | awk '{print $2}')

# 5. Poll attestation (auto, up to 5 min)
for i in $(seq 1 60); do
  RESP=$(curl -s "$IRIS_API/$SRC_DOMAIN?transactionHash=$TX_HASH")
  [ "$(echo $RESP | jq -r '.messages[0].status // empty')" = "complete" ] && break
  sleep 5
done
MESSAGE=$(echo $RESP | jq -r '.messages[0].message')
ATTESTATION=$(echo $RESP | jq -r '.messages[0].attestation')

# 6. Mint on destination
cast send $MSG_TRANSMITTER "receiveMessage(bytes,bytes)" \
  "$MESSAGE" "$ATTESTATION" --rpc-url $DEST_RPC --private-key $PRIVATE_KEY
```

### Bridge UX — Agent Behavior Guide

**Example interaction:**

```
User: bridge 1 USDC from Pharos to Base

Agent: Bridging 1 USDC from Pharos → Base.

  ✅ Wallet: 0xe7e0...c63e
  ✅ USDC balance: 5.53 USDC on Pharos
  ✅ Gas: 0.99 PROS

Proceed?

User: yes

Agent: [runs all steps silently, shows progress]
  ⏳ Burning 1 USDC on Pharos...
  ✅ Burn tx: 0x49e5... (confirmed)
  ⏳ Waiting for attestation... (8s)
  ✅ Attestation received
  ⏳ Minting on Base...
  ✅ Mint tx: 0xc70f... (confirmed)

  Bridge complete!

  Burn:  https://www.pharosscan.xyz/tx/0x49e5...
  Mint:  https://basescan.org/tx/0xc70f...
  Amount: 1 USDC
```

**What the agent does NOT do:**
- ❌ "Should I approve now?" → just approve
- ❌ "Confirm burn transaction?" → just burn
- ❌ "Attestation received, proceed to mint?" → just mint
- ❌ Show raw cast output → parse and show human-readable
- ❌ Ask for network confirmation on default network → only warn on mainnet if user didn't specify

## Network Configuration

Network info is in `assets/networks.json`. Read the target chain's `rpcUrl` for `--rpc-url`:

```bash
# Example: reading network configuration
RPC=$(jq -r '.networks[] | select(.name=="pharos") | .rpcUrl' $SKILL_DIR/assets/networks.json)
CCTP_DOMAIN=$(jq -r '.networks[] | select(.name=="pharos") | .cctpDomain' $SKILL_DIR/assets/networks.json)
```

- **Default Network**: Pharos Pacific Mainnet (`pharos`, chain ID 1672). Used when the user does not specify a network.
- **Switching Networks**: When the user specifies a network by name, read the corresponding entry's `rpcUrl` and `cctpDomain` from `assets/networks.json`.
- For bridge operations, use the source chain's RPC URL for burn, destination chain's RPC URL for mint.

## Token Addresses

Token addresses are in `assets/tokens.json`. Read by chain name:

```bash
TOKEN=$(jq -r '.bridge.USDC.addresses.base' $SKILL_DIR/assets/tokens.json)
```

### USDC Addresses Per Chain (Balance Queries)

For balance queries across chains, USDC addresses are in `bridge.USDC.addresses.<chain>` — **NOT** in the `mainnet` top-level section (that only contains Pharos-local tokens).

```bash
# USDC on any chain — use bridge section
jq -r '.bridge.USDC.addresses.pharos' $SKILL_DIR/assets/tokens.json    # 0xc879c018...
jq -r '.bridge.USDC.addresses.base' $SKILL_DIR/assets/tokens.json      # 0x833589fC...
jq -r '.bridge.USDC.addresses.ethereum' $SKILL_DIR/assets/tokens.json  # 0xA0b86991...
jq -r '.bridge.USDC.addresses.arbitrum' $SKILL_DIR/assets/tokens.json
jq -r '.bridge.USDC.addresses.optimism' $SKILL_DIR/assets/tokens.json
jq -r '.bridge.USDC.addresses.polygon' $SKILL_DIR/assets/tokens.json
jq -r '.bridge.USDC.addresses.avalanche' $SKILL_DIR/assets/tokens.json
jq -r '.bridge.USDC.addresses.bsc' $SKILL_DIR/assets/tokens.json

# PROS/WPROS — use ccip section
jq -r '.ccip.tokens.pharos' $SKILL_DIR/assets/tokens.json    # WPROS on Pharos
jq -r '.ccip.tokens.base' $SKILL_DIR/assets/tokens.json      # PROS on Base
jq -r '.ccip.tokens.ethereum' $SKILL_DIR/assets/tokens.json  # PROS on Ethereum
```

CCTP configuration is in `assets/tokens.json` → `cctp`:

```bash
TOKEN_MESSENGER=$(jq -r '.cctp.contracts.tokenMessengerV2' $SKILL_DIR/assets/tokens.json)
MSG_TRANSMITTER=$(jq -r '.cctp.contracts.messageTransmitterV2' $SKILL_DIR/assets/tokens.json)
IRIS_API=$(jq -r '.cctp.api.mainnet' $SKILL_DIR/assets/tokens.json)
DEST_DOMAIN=$(jq -r '.cctp.domains.base' $SKILL_DIR/assets/tokens.json)
```

CCIP configuration is in `assets/tokens.json` → `ccip`:

```bash
CCIP_ROUTER=$(jq -r '.ccip.routers.pharos' $SKILL_DIR/assets/tokens.json)
DEST_SELECTOR=$(jq -r '.ccip.chainSelectors.base' $SKILL_DIR/assets/tokens.json)
WPROS=$(jq -r '.ccip.tokens.pharos' $SKILL_DIR/assets/tokens.json)
```

## Balance Check (Single Command, All Networks)

When the user asks "check balances", "show balances", "check all balances" — run ONE bash command. NO separate commands per network. NO extra confirmations.

### Rules

| User Request | Networks to Check |
|--------------|-------------------|
| "check all balances" / "check balances on all networks" / "проверь все балансы" | ALL 8 networks |
| "check balances on Pharos, Base and Ethereum" | Only those 3 |
| "check balance on Pharos" | Only 1 network |

- **ALWAYS one bash command** regardless of network count — zero extra confirmations
- **Read-only queries** are safe — run without asking for user approval per step
- Adapt the `for NET in ...` line to match user request

### All Networks Script

Run as ONE bash tool call. The `for NET in ...` line adapts to what the user asked:

```bash
set -a && source $ENV_FILE && set +a

SKILL_DIR=/absolute/path/to/pharos-bridge   # dir containing this SKILL.md — see SKILL.md Phase 0
ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)

# Helper: cast call with retry — returns balance or "rpc_err"
erc20_balance() {
  local ADDR=$1 RPC=$2 DEC=$3
  local RAW=$(cast call $ADDR "balanceOf(address)(uint256)" $ADDRESS --rpc-url $RPC 2>&1)
  if echo "$RAW" | grep -qE '^[0-9]+'; then
    echo "$RAW" | grep -oE '^[0-9]+' | awk -v d="$DEC" '{printf "%.2f", $1/10^d}'
  else
    local RAW2=$(sleep 1 && cast call $ADDR "balanceOf(address)(uint256)" $ADDRESS --rpc-url $RPC 2>&1)
    if echo "$RAW2" | grep -qE '^[0-9]+'; then
      echo "$RAW2" | grep -oE '^[0-9]+' | awk -v d="$DEC" '{printf "%.2f", $1/10^d}'
    else
      echo "rpc_err"
    fi
  fi
}

echo "Wallet: $ADDRESS"
echo ""
printf "%-14s %-16s %-12s %-10s\n" "Network" "Native" "USDC" "PROS"
printf "%-14s %-16s %-12s %-10s\n" "--------" "------" "----" "----"

for NET in pharos base ethereum arbitrum optimism polygon avalanche bsc; do
  RPC=$(jq -r ".networks[] | select(.name==\"$NET\") | .rpcUrl" $SKILL_DIR/assets/networks.json 2>/dev/null)
  SYM=$(jq -r ".networks[] | select(.name==\"$NET\") | .nativeToken" $SKILL_DIR/assets/networks.json 2>/dev/null)
  CID=$(jq -r ".networks[] | select(.name==\"$NET\") | .chainId" $SKILL_DIR/assets/networks.json 2>/dev/null)
  [ -z "$RPC" ] || [ "$RPC" = "null" ] && continue

  NAT=$(cast balance $ADDRESS --rpc-url $RPC --ether 2>/dev/null || echo "error")

  # USDC (all chains)
  USDC_A=$(jq -r ".bridge.USDC.addresses.$NET // empty" $SKILL_DIR/assets/tokens.json 2>/dev/null)
  if [ -n "$USDC_A" ]; then
    USDC=$(erc20_balance $USDC_A $RPC 6)
  else
    USDC="N/A"
  fi

  # PROS/WPROS (pharos, base, ethereum only)
  PROS_A=$(jq -r ".ccip.tokens.$NET // empty" $SKILL_DIR/assets/tokens.json 2>/dev/null)
  if [ -n "$PROS_A" ]; then
    PROS=$(erc20_balance $PROS_A $RPC 18)
  else
    PROS="-"
  fi

  printf "%-14s %-16s %-12s %-10s\n" "$NET ($CID)" "$NAT $SYM" "$USDC" "$PROS"
done
```

### Token Address Rules

- **USDC on any chain**: `bridge.USDC.addresses.<chain>` in `assets/tokens.json` — NOT in `mainnet` section
- **PROS/WPROS**: `ccip.tokens.<chain>` in `assets/tokens.json` (pharos, base, ethereum only)
- **Native balance**: `cast balance` with chain's RPC from `assets/networks.json`
- **ALWAYS pass `--rpc-url`** — never rely on defaults
- **Retry on failure**: `erc20_balance` helper retries once on failure, shows `rpc_err` instead of silent 0
- **Decimals**: USDC = 6, PROS/WPROS = 18 — passed to helper via awk

## General Error Handling

Before executing commands, the Agent should perform pre-checks; when commands fail, provide user-friendly error messages based on stderr output.

| Error Scenario | Detection | Handling |
|---------------|-----------|----------|
| Invalid address format | `invalid address` | Check format: 0x + 40 hex chars |
| Transaction hash not found | `transaction not found` | Check the hash |
| No contract code at address | Empty return value | Address has no contract code |
| Call revert | `execution reverted` | Extract and display revert reason |
| Insufficient allowance | `execution reverted` on depositForBurn | Re-run approve step for TokenMessengerV2 |
| Insufficient balance | `insufficient funds` | Check USDC balance and native token for gas |
| CCIP fee too low | `MessageFeeMismatch` | Re-estimate fee and retry |
| Attestation never completes | Poll timeout after 5 min | Verify burn tx on explorer; may be invalid or network issue |
| receiveMessage reverts | `execution reverted` | Attestation already used or invalid; check dest balance first |
| Wrong domain ID | `execution reverted` on depositForBurn | Verify using cctpDomain from config, NOT chain ID |
| Bridge not delivering | Balance unchanged on dest | CCTP: re-check attestation status. CCIP: wait 5-20 min |
| Unsupported route | Chain not in supported table | Inform user of supported chains |
| Private key not configured | Missing `--private-key` | Prompt user to configure private key |
| Nonce conflict | `nonce too low` | Wait or manually specify nonce |
| Hex conversion on decimal | `16#: invalid integer constant` | `cast call` returns decimal — use directly, no `$((16#...))` |
| Wrong ccipSend params | `encode length mismatch` | Use exact: `ccipSend(uint64,(bytes,bytes,(address,uint256)[],address,bytes))` |
| Mixed-case address in tuple | `odd number of digits` | Lowercase all addresses: `jq ... \| tr '[:upper:]' '[:lower:]'` |
| Wrong network (testnet vs mainnet) | Tx on wrong explorer | Always `cast chain-id --rpc-url $RPC` and verify against networks.json |
| Missing network config | `assets/networks.json` unreadable | Config file missing or invalid format |

## Security Reminders

- **Private Key Protection**: The private key is stored ONLY in the `.env` file. It is NEVER exposed in chat, logs, or version control. All `cast`/`forge` commands reference it via `--private-key $PRIVATE_KEY` after sourcing `.env`.
- **One Confirmation Rule**: For bridge operations, confirm parameters ONCE (amount, token, source → destination) then execute the entire pipeline. Do NOT ask for confirmation at each step.
- **Mainnet Warning**: If the user explicitly says "mainnet" or the operation is clearly on mainnet, show a one-line warning. If the user specified the network themselves, skip the warning — they know what they're doing.
- **CCTP Domain IDs**: Always use CCTP Domain IDs (from `cctp.domains`), NOT EVM Chain IDs. Using chain IDs will cause failed transactions.
- **CCIP Chain Selectors**: Always use CCIP Chain Selectors (from `ccip.chainSelectors`), NOT EVM Chain IDs.

## Write Operation Pre-checks

For bridge operations, pre-checks run SILENTLY — the user only sees the result summary, not the individual checks:

### Silent Pre-checks (auto, no user interaction)
```bash
# 1. Source environment
set -a && source $ENV_FILE && set +a

# 2. Verify private key (output "set"/"not set" only)
[ -n "$PRIVATE_KEY" ] && echo "set" || echo "not set"

# 3. Derive address
ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)

# 4. Check balances (token + native gas)
# If insufficient → STOP and tell user. Otherwise proceed silently.
```

### For Non-Bridge Write Operations (transfers, deployments, etc.)
Show the user: target network, address, operation. Get confirmation before executing.
