---
name: kitsune-bridge
description: "Use this skill when the user wants to move funds between Pharos and other EVM chains: bridge USDC (Circle CCTP V2, native 1:1 burn-and-mint — Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, BSC) or PROS (Chainlink CCIP — Base, Ethereum) to/from Pharos, check wallet balances across all chains, or run raw Pharos on-chain operations (transfers, contract deploy/verify, batch airdrops, generated interaction scripts). The full pipeline — approve, burn/send, attestation polling, mint/receive — runs from a single confirmation, signing with the same wallet as the rest of the kit (~/.kitsune/config.toml). Invoke on \"bridge\", \"cross-chain\", \"move/deposit funds to Pharos\", \"check balances on all networks\". Do NOT use for vault management (kitsune-vault), strategies (kitsune-strategy), or market data (kitsune-market)."
license: MIT
metadata:
  author: kitsune
  version: "0.2.11"
  agent:
    requires: { bins: ["cast", "jq"] }
---

# Kitsune Bridge

The kit's cross-chain leg: moves tokens between Pharos and supported EVM chains, plus a full
developer toolkit for Pharos on-chain operations. Signs with the same wallet as every other
kitsune skill (`~/.kitsune/config.toml`); runs on Foundry's `cast` directly — no extra setup.

## Typical flow (on-ramp → trade)

1. **Bridge in** — "bridge 500 USDC from Base to Pharos" (Circle CCTP V2; native USDC 1:1).
2. **Trade** — `kitsune-vault` (create a vault, deposit), `kitsune-strategy` (DCA / grid),
   `kitsune-market` (prices, indicators).
3. **Grow** — monitor PnL with `kitsune-portfolio`, copy top strategies from `kitsune-marketplace`;
   profits stay on Pharos compounding in vaults.

USDC on Pharos (`bridge.USDC.addresses.pharos` in `$SKILL_DIR/assets/tokens.json`) is the same token
Kitsune vaults use as the quote asset, so bridged funds are immediately usable for deposits.

> Routes are technically bidirectional, but the flows, examples and suggestions in this skill are
> written for **bringing funds onto Pharos**. Execute an outbound bridge only when the user
> explicitly asks for one — never suggest or pre-fill the Pharos→elsewhere direction.

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
SKILL.md** (e.g. `~/.claude/skills/kitsune-bridge` or `<repo>/agent-skills/kitsune-bridge`, depending
on where the skill is installed).

Shell state does NOT persist between Bash tool calls — re-use the absolute value (or re-derive it)
in EVERY command that reads `$SKILL_DIR/assets/...`.

### Step 0.1: Load the Wallet Key from the Kitsune Agent Config (KEY PRELUDE)

This skill uses the **same wallet as the rest of the Kitsune Agent Trade Kit** — no separate key file.
The key is resolved in this order:

1. `KITSUNE_PRIVATE_KEY` environment variable (if set)
2. `private_key` of the **default profile** in `~/.kitsune/config.toml` (the kit's standard config)

> 🔒 **SECURITY — the key value must NEVER appear in chat (CRITICAL).** The prelude loads the key
> into a shell variable silently. Beyond the forbidden commands below: never inline the literal key
> into any command line shown to the user — always pass it as `--private-key "$PRIVATE_KEY"` so the
> shell expands it internally; if ANY tool output accidentally contains a key (or an API key, JWT,
> seed phrase), redact it in your reply (`[REDACTED]`) — never repeat it. Public wallet addresses,
> tx hashes and balances are fine to show. If the user pastes a private key into the chat, warn them
> it is exposed in the conversation history and recommend moving funds to a fresh key.

The **Key Prelude** below loads it. Because shell state does NOT persist between Bash tool calls,
**prepend this prelude to EVERY command that signs or sends a transaction**:

```bash
# ── Key Prelude (load PRIVATE_KEY from the Kitsune agent config) ──
CFG="$HOME/.kitsune/config.toml"
PROFILE="${KITSUNE_PROFILE:-$(sed -n 's/^default_profile[[:space:]]*=[[:space:]]*"\(.*\)"/\1/p' "$CFG" 2>/dev/null | head -1)}"; PROFILE="${PROFILE:-mainnet}"
PRIVATE_KEY="${KITSUNE_PRIVATE_KEY:-$(awk -v s="[profiles.$PROFILE]" '$0==s{f=1;next}/^\[/{f=0}f&&$1~/^private_key/{sub(/^[^"]*"/,"");sub(/".*$/,"");print;exit}' "$CFG" 2>/dev/null)}"
# ──────────────────────────────────────────────────────────────────
```

To use a different profile's key (e.g. a dedicated bridging wallet), the user can say so — set
`KITSUNE_PROFILE=<name>` in the prelude's first line or export `KITSUNE_PRIVATE_KEY`.

### Step 0.2: Verify the Key Is Available

Run the Key Prelude, then check. **ONLY output "loaded" or "not found" — never the actual value.**

```bash
# (Key Prelude here)
[ -n "$PRIVATE_KEY" ] && echo "key: loaded (profile: $PROFILE)" || echo "key: not found"
```

**FORBIDDEN COMMANDS — NEVER RUN THESE:**
```
cat ~/.kitsune/config.toml
grep private_key ~/.kitsune/config.toml
echo $PRIVATE_KEY
printenv PRIVATE_KEY | KITSUNE_PRIVATE_KEY
```
Any command that would output the private key value to chat is ABSOLUTELY FORBIDDEN.

If not found, guide the user to set up the standard kit config (same one used by the `kitsune` CLI
and the other kitsune-* skills):

```
Please add your private key to the Kitsune agent config:
  File: ~/.kitsune/config.toml

    default_profile = "mainnet"

    [profiles.mainnet]
    private_key = "0x..."

(or export KITSUNE_PRIVATE_KEY). NEVER paste keys in chat.
Restrict the file to your user only: chmod 600 ~/.kitsune/config.toml
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
3. **NEVER** run `cat ~/.kitsune/config.toml`, `grep private_key`, `echo $PRIVATE_KEY`, `printenv`, or any command that could leak secrets to chat output
4. **ALWAYS** check the key with safe commands only: `[ -n "$PRIVATE_KEY" ] && echo "loaded" || echo "not found"`
5. **ALWAYS** point the user at `~/.kitsune/config.toml` (the standard kit config) when the key is missing
6. If the user accidentally pastes a secret in chat — warn immediately, suggest rotating the key

## Shell State Note (CRITICAL)

Shell state does NOT persist between Bash tool calls. EVERY command that signs or sends MUST start
with the **Key Prelude** from Step 0.1 (it re-reads `~/.kitsune/config.toml` each time):

```bash
CFG="$HOME/.kitsune/config.toml"
PROFILE="${KITSUNE_PROFILE:-$(sed -n 's/^default_profile[[:space:]]*=[[:space:]]*"\(.*\)"/\1/p' "$CFG" 2>/dev/null | head -1)}"; PROFILE="${PROFILE:-mainnet}"
PRIVATE_KEY="${KITSUNE_PRIVATE_KEY:-$(awk -v s="[profiles.$PROFILE]" '$0==s{f=1;next}/^\[/{f=0}f&&$1~/^private_key/{sub(/^[^"]*"/,"");sub(/".*$/,"");print;exit}' "$CFG" 2>/dev/null)}"
...rest of command...
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

**The bridge experience MUST be seamless and automatic.** When the user says "bridge 1 USDC from Base to Pharos" or "move 10 PROS to Pharos", the agent:

1. Confirms parameters ONCE: amount, token, source → destination. Show clearly: "Bridging 1 USDC from Base to Pharos. Proceed?"
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
4. **Pre-checks** (silent) — run the Key Prelude, verify key, derive address, check balances
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
5. **Pre-checks** (silent) — run the Key Prelude, verify key, derive address, check balances
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
SRC_DOMAIN=$(jq -r '.cctp.domains.base' $SKILL_DIR/assets/tokens.json)     # source domain
DEST_DOMAIN=$(jq -r '.cctp.domains.pharos' $SKILL_DIR/assets/tokens.json)  # dest domain
SRC_RPC=$(jq -r '.networks[] | select(.name=="base") | .rpcUrl' $SKILL_DIR/assets/networks.json)
DEST_RPC=$(jq -r '.networks[] | select(.name=="pharos") | .rpcUrl' $SKILL_DIR/assets/networks.json)
SRC_USDC=$(jq -r '.bridge.USDC.addresses.base' $SKILL_DIR/assets/tokens.json)

# 2. Pre-checks (silent — do not ask user)
# Key Prelude (see Phase 0) — loads PRIVATE_KEY from ~/.kitsune/config.toml / KITSUNE_PRIVATE_KEY
CFG="$HOME/.kitsune/config.toml"
PROFILE="${KITSUNE_PROFILE:-$(sed -n 's/^default_profile[[:space:]]*=[[:space:]]*"\(.*\)"/\1/p' "$CFG" 2>/dev/null | head -1)}"; PROFILE="${PROFILE:-mainnet}"
PRIVATE_KEY="${KITSUNE_PRIVATE_KEY:-$(awk -v s="[profiles.$PROFILE]" '$0==s{f=1;next}/^\[/{f=0}f&&$1~/^private_key/{sub(/^[^"]*"/,"");sub(/".*$/,"");print;exit}' "$CFG" 2>/dev/null)}"
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
User: bridge 1 USDC from Base to Pharos

Agent: Bridging 1 USDC from Base → Pharos.

  ✅ Wallet: 0xe7e0...c63e
  ✅ USDC balance: 5.53 USDC on Base
  ✅ Gas: 0.012 ETH

Proceed?

User: yes

Agent: [runs all steps silently, shows progress]
  ⏳ Burning 1 USDC on Base...
  ✅ Burn tx: 0x49e5... (confirmed)
  ⏳ Waiting for attestation... (8s)
  ✅ Attestation received
  ⏳ Minting on Pharos...
  ✅ Mint tx: 0xc70f... (confirmed)

  Bridge complete!

  Burn:  https://basescan.org/tx/0x49e5...
  Mint:  https://www.pharosscan.xyz/tx/0xc70f...
  Amount: 1 USDC — ready to deposit into a Kitsune vault (kitsune-vault)
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
# Key Prelude (see Phase 0) — loads PRIVATE_KEY from ~/.kitsune/config.toml / KITSUNE_PRIVATE_KEY
CFG="$HOME/.kitsune/config.toml"
PROFILE="${KITSUNE_PROFILE:-$(sed -n 's/^default_profile[[:space:]]*=[[:space:]]*"\(.*\)"/\1/p' "$CFG" 2>/dev/null | head -1)}"; PROFILE="${PROFILE:-mainnet}"
PRIVATE_KEY="${KITSUNE_PRIVATE_KEY:-$(awk -v s="[profiles.$PROFILE]" '$0==s{f=1;next}/^\[/{f=0}f&&$1~/^private_key/{sub(/^[^"]*"/,"");sub(/".*$/,"");print;exit}' "$CFG" 2>/dev/null)}"

SKILL_DIR=/absolute/path/to/kitsune-bridge   # dir containing this SKILL.md — see SKILL.md Phase 0
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

- **Private Key Protection**: The private key lives ONLY in `~/.kitsune/config.toml` (the shared Kitsune agent config) or the `KITSUNE_PRIVATE_KEY` env var. It is NEVER exposed in chat, logs, or version control. All `cast`/`forge` commands reference it via `--private-key $PRIVATE_KEY` after running the Key Prelude.
- **One Confirmation Rule**: For bridge operations, confirm parameters ONCE (amount, token, source → destination) then execute the entire pipeline. Do NOT ask for confirmation at each step.
- **Mainnet Warning**: If the user explicitly says "mainnet" or the operation is clearly on mainnet, show a one-line warning. If the user specified the network themselves, skip the warning — they know what they're doing.
- **CCTP Domain IDs**: Always use CCTP Domain IDs (from `cctp.domains`), NOT EVM Chain IDs. Using chain IDs will cause failed transactions.
- **CCIP Chain Selectors**: Always use CCIP Chain Selectors (from `ccip.chainSelectors`), NOT EVM Chain IDs.

## Write Operation Pre-checks

For bridge operations, pre-checks run SILENTLY — the user only sees the result summary, not the individual checks:

### Silent Pre-checks (auto, no user interaction)
```bash
# 1. Key Prelude (see Phase 0) — loads PRIVATE_KEY from ~/.kitsune/config.toml / KITSUNE_PRIVATE_KEY
CFG="$HOME/.kitsune/config.toml"
PROFILE="${KITSUNE_PROFILE:-$(sed -n 's/^default_profile[[:space:]]*=[[:space:]]*"\(.*\)"/\1/p' "$CFG" 2>/dev/null | head -1)}"; PROFILE="${PROFILE:-mainnet}"
PRIVATE_KEY="${KITSUNE_PRIVATE_KEY:-$(awk -v s="[profiles.$PROFILE]" '$0==s{f=1;next}/^\[/{f=0}f&&$1~/^private_key/{sub(/^[^"]*"/,"");sub(/".*$/,"");print;exit}' "$CFG" 2>/dev/null)}"

# 2. Verify private key (output "loaded"/"not found" only)
[ -n "$PRIVATE_KEY" ] && echo "loaded" || echo "not found"

# 3. Derive address
ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)

# 4. Check balances (token + native gas)
# If insufficient → STOP and tell user. Otherwise proceed silently.
```

### For Non-Bridge Write Operations (transfers, deployments, etc.)
Show the user: target network, address, operation. Get confirmation before executing.
