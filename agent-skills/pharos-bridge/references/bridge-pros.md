# PROS Bridge via Chainlink CCIP

Bridge PROS/WPROS token between Pharos, Base, and Ethereum using direct Chainlink CCIP Router.

## CRITICAL Rules (READ FIRST — violations cause silent failures)

### Rule 1: `cast call` returns DECIMAL, not hex

```bash
# CORRECT — cast call already returns decimal
BALANCE=$(cast call $TOKEN "balanceOf(address)(uint256)" $ADDRESS --rpc-url $RPC)
echo $BALANCE  # prints: 7669283391628225962 (decimal, NOT hex)

# WRONG — NEVER convert with 16#
echo $((16#$BALANCE))  # ERROR: "16#: invalid integer constant"
```

`cast call` with `()` return type ALWAYS returns decimal integers. Never use `16#` or any hex-to-decimal conversion on the output.

### Rule 2: ALL addresses in cast tuples MUST be lowercase

```bash
# CORRECT — lowercase address inside tuple
"($RECEIVER,0x,[(0x8b7dde054be9d180c1be7fae0874697374a49832,$AMOUNT)],0x0000000000000000000000000000000000000000,0x)"

# WRONG — mixed case causes "odd number of digits" error
"($RECEIVER,0x,[(0x8B7DdE054BE9D180c1Be7FaE0874697374A49832,$AMOUNT)],0x0000000000000000000000000000000000000000,0x)"
```

When reading addresses from tokens.json, ALWAYS lowercase them before use in tuples:

```bash
TOKEN_ADDR=$(jq -r '.ccip.tokens.base' $TOKENS | tr '[:upper:]' '[:lower:]')
```

### Rule 3: ccipSend signature — exactly these 2 parameters

```
ccipSend(uint64, (bytes, bytes, (address,uint256)[], address, bytes))
          ↑          ↑
          chainSel   EVM2AnyMessage tuple
```

- **Parameter 1** (`uint64`): destination chain selector
- **Parameter 2** (tuple): `(receiver, data, tokenAmounts, feeToken, extraArgs)`

### Rule 4: Receiver must be bytes32 (left-padded address)

```bash
RECEIVER="0x000000000000000000000000${ADDRESS:2}"
# ${ADDRESS:2} strips the "0x" prefix, left-padded to 32 bytes
```

### Rule 5: CCIP Chain Selectors are NOT Chain IDs

| Network | Chain ID | CCIP Selector |
|---------|----------|---------------|
| Pharos | 1672 | `7801139999541420232` |
| Base | 8453 | `15971525489660198786` |
| Ethereum | 1 | `5009297550715157269` |

Always read from `assets/tokens.json` → `ccip.chainSelectors`. NEVER use chain IDs as selectors.

## CCIP Architecture

Chainlink CCIP enables cross-chain token transfers via burn-and-mint / lock-and-release token pools:

- **Pharos → Base/Ethereum**: WPROS locked on Pharos → PROS minted (BurnMintERC20) on destination
- **Base/Ethereum → Pharos**: PROS burned on source → WPROS released on Pharos

No InterPort wrapper — direct CCIP Router calls. Fully documented by [Chainlink](https://docs.chain.link/ccip/directory/mainnet/token/WPROS) and [Pharos](https://docs.pharos.xyz/tooling-and-infrastructure/cross-chain/chainlink-ccip).

## Supported Routes

| From | To | Method |
|------|----|--------|
| Pharos | Base | CCIP (Lock/Release → Burn/Mint) |
| Pharos | Ethereum | CCIP (Lock/Release → Burn/Mint) |
| Base | Pharos | CCIP (Burn/Mint → Lock/Release) |
| Ethereum | Pharos | CCIP (Burn/Mint → Lock/Release) |

## CCIP Configuration

### CCIP Routers

| Network | Router Address |
|---------|---------------|
| **Pharos** | `0x4e52dD94e9BCfeFE3C78153bDfB0AB1d30687297` |
| **Base** | `0x881e3A65B4d4a04dD529061dd0071cf975F58bCD` |
| **Ethereum** | `0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D` |

### CCIP Chain Selectors (NOT Chain IDs)

| Network | Chain ID | CCIP Selector |
|---------|----------|---------------|
| Pharos | 1672 | `7801139999541420232` |
| Base | 8453 | `15971525489660198786` |
| Ethereum | 1 | `5009297550715157269` |

### Token Addresses

| Network | Token | Address | Note |
|---------|-------|---------|------|
| Pharos | WPROS | `0x52c48d4213107b20bc583832b0d951fb9ca8f0b0` | Wrapped PROS (WETH-like) |
| Pharos | PROS | native | Native gas token |
| Base | PROS | `0x8B7DdE054BE9D180c1Be7FaE0874697374A49832` | BurnMintERC20 |
| Ethereum | PROS | `0xB197E02499e6502733C6bCE2eb39013C39A03147` | BurnMintERC20 |

### Token Pools (verified on-chain)

| Network | TokenPool Address | Type |
|---------|-------------------|------|
| Pharos | `0xCb79097744d5266bFca287A43612D9613Be46300` | Lock/Release |
| Base | `0x7126C3FeF4e6a680eeE09Fb039B2236F638384B0` | Burn/Mint |
| Ethereum | `0x6f0c4C3f0F1ca8f0513b542A124a0208fEe72D97` | Burn/Mint |

All config is in `assets/tokens.json` → `ccip` section.

## Step 1: Read Configuration

```bash
# SKILL_DIR = dir containing this skill's SKILL.md — see SKILL.md Phase 0
TOKENS="$SKILL_DIR/assets/tokens.json"
NETWORKS="$SKILL_DIR/assets/networks.json"

# Source env
set -a && source $ENV_FILE && set +a
ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)

# Read configs — ALWAYS lowercase addresses for tuple encoding
ROUTER=$(jq -r '.ccip.routers.pharos' $TOKENS | tr '[:upper:]' '[:lower:]')
DEST_SELECTOR=$(jq -r '.ccip.chainSelectors.base' $TOKENS)
TOKEN_ADDR=$(jq -r '.ccip.tokens.pharos' $TOKENS | tr '[:upper:]' '[:lower:]')
PHAROS_RPC=$(jq -r '.networks[] | select(.name=="pharos") | .rpcUrl' $NETWORKS)
BASE_RPC=$(jq -r '.networks[] | select(.name=="base") | .rpcUrl' $NETWORKS)
ETH_RPC=$(jq -r '.networks[] | select(.name=="ethereum") | .rpcUrl' $NETWORKS)
```

## Step 2: Pre-flight Checks

### VERIFY NETWORK — always confirm chain ID matches expected value

```bash
# Read expected chain ID from networks.json
EXPECTED_CID=$(jq -r '.networks[] | select(.name=="base") | .chainId' $NETWORKS)
# Read actual chain ID from RPC
ACTUAL_CID=$(cast chain-id --rpc-url $BASE_RPC)

if [ "$ACTUAL_CID" != "$EXPECTED_CID" ]; then
  echo "ERROR: Wrong network! RPC returned chain ID $ACTUAL_CID, expected $EXPECTED_CID (base)"
  echo "This usually means the RPC URL points to testnet instead of mainnet."
  echo "Using RPC: $BASE_RPC"
  exit 1
fi
echo "Network verified: base (chain ID $ACTUAL_CID)"
```

This prevents the agent from accidentally sending mainnet transactions to testnet (or vice versa). Run this check for BOTH source and destination chains before any bridge operation.

### Check balances

```bash
# Check native balance (cast balance returns decimal in wei, --ether converts)
cast balance $ADDRESS --rpc-url $BASE_RPC --ether

# Check token balance — returns DECIMAL (not hex)
cast call $TOKEN_ADDR "balanceOf(address)(uint256)" $ADDRESS --rpc-url $BASE_RPC
```

## Step 3: Wrap PROS → WPROS (only when bridging FROM Pharos)

WPROS follows the WETH pattern: `deposit()` is payable, `withdraw(uint256)` returns native.

```bash
WPROS="0x52c48d4213107b20bc583832b0d951fb9ca8f0b0"
AMOUNT=10000000000000000000  # 10 PROS (18 decimals)

# Wrap native PROS → WPROS
cast send $WPROS "deposit()" \
  --value $AMOUNT \
  --rpc-url $PHAROS_RPC \
  --private-key $PRIVATE_KEY
```

## Step 4: Approve Token to CCIP Router

```bash
# On Pharos (approve WPROS to Router)
ROUTER_PHAROS="0x4e52dD94e9BCfeFE3C78153bDfB0AB1d30687297"
cast send $WPROS "approve(address,uint256)" $ROUTER_PHAROS $AMOUNT \
  --rpc-url $PHAROS_RPC --private-key $PRIVATE_KEY

# On Base (approve PROS to Router) — lowercase address!
ROUTER_BASE="0x881e3A65B4d4a04dD529061dd0071cf975F58bCD"
PROS_BASE=$(jq -r '.ccip.tokens.base' $TOKENS | tr '[:upper:]' '[:lower:]')
cast send $PROS_BASE "approve(address,uint256)" $ROUTER_BASE $AMOUNT \
  --rpc-url $BASE_RPC --private-key $PRIVATE_KEY

# On Ethereum (approve PROS to Router) — lowercase address!
ROUTER_ETH="0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D"
PROS_ETH=$(jq -r '.ccip.tokens.ethereum' $TOKENS | tr '[:upper:]' '[:lower:]')
cast send $PROS_ETH "approve(address,uint256)" $ROUTER_ETH $AMOUNT \
  --rpc-url $ETH_RPC --private-key $PRIVATE_KEY
```

## Step 5: Estimate CCIP Fee

```bash
# Build receiver as bytes32 (left-padded address)
RECEIVER="0x000000000000000000000000${ADDRESS:2}"

# Token address MUST be lowercase for tuple encoding
TOKEN_ADDR=$(jq -r '.ccip.tokens.pharos' $TOKENS | tr '[:upper:]' '[:lower:]')

# getFee(uint64 destinationChainSelector, EVM2AnyMessage message)
# EVM2AnyMessage = (bytes receiver, bytes data, (address,uint256)[] tokenAmounts, address feeToken, bytes extraArgs)
FEE=$(cast call $ROUTER \
  "getFee(uint64,(bytes,bytes,(address,uint256)[],address,bytes))" \
  $DEST_SELECTOR \
  "($RECEIVER,0x,[($TOKEN_ADDR,$AMOUNT)],0x0000000000000000000000000000000000000000,0x)" \
  --rpc-url $PHAROS_RPC)

echo "CCIP fee: $FEE wei"
```

Fee is returned in wei of native token. For Pharos→Base: ~0.257 PROS (confirmed on-chain).

## Step 6: Execute Bridge (ccipSend)

### Complete Script: Base → Pharos

```bash
# Source env and config
set -a && source $ENV_FILE && set +a
TOKENS="$SKILL_DIR/assets/tokens.json"
NETWORKS="$SKILL_DIR/assets/networks.json"
ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)

# Config — lowercase all addresses for tuple encoding
ROUTER_BASE=$(jq -r '.ccip.routers.base' $TOKENS | tr '[:upper:]' '[:lower:]')
PHAROS_SELECTOR=$(jq -r '.ccip.chainSelectors.pharos' $TOKENS)
PROS_BASE=$(jq -r '.ccip.tokens.base' $TOKENS | tr '[:upper:]' '[:lower:]')
BASE_RPC=$(jq -r '.networks[] | select(.name=="base") | .rpcUrl' $NETWORKS)

AMOUNT=10000000000000000000  # 10 PROS (18 decimals)
RECEIVER="0x000000000000000000000000${ADDRESS:2}"

# 1. Approve PROS to Router
cast send $PROS_BASE "approve(address,uint256)" $ROUTER_BASE $AMOUNT \
  --rpc-url $BASE_RPC --private-key $PRIVATE_KEY

# 2. Send via CCIP (fee paid in native ETH on Base)
#    ccipSend(uint64, (bytes receiver, bytes data, (address,uint256)[] tokens, address feeToken, bytes extraArgs))
cast send $ROUTER_BASE \
  "ccipSend(uint64,(bytes,bytes,(address,uint256)[],address,bytes))" \
  $PHAROS_SELECTOR \
  "($RECEIVER,0x,[($PROS_BASE,$AMOUNT)],0x0000000000000000000000000000000000000000,0x)" \
  --value 500000000000000 \
  --rpc-url $BASE_RPC \
  --private-key $PRIVATE_KEY
```

### Complete Script: Ethereum → Pharos

```bash
set -a && source $ENV_FILE && set +a
TOKENS="$SKILL_DIR/assets/tokens.json"
NETWORKS="$SKILL_DIR/assets/networks.json"
ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)

# Config — lowercase all addresses for tuple encoding
ROUTER_ETH=$(jq -r '.ccip.routers.ethereum' $TOKENS | tr '[:upper:]' '[:lower:]')
PHAROS_SELECTOR=$(jq -r '.ccip.chainSelectors.pharos' $TOKENS)
PROS_ETH=$(jq -r '.ccip.tokens.ethereum' $TOKENS | tr '[:upper:]' '[:lower:]')
ETH_RPC=$(jq -r '.networks[] | select(.name=="ethereum") | .rpcUrl' $NETWORKS)

AMOUNT=10000000000000000000  # 10 PROS (18 decimals)
RECEIVER="0x000000000000000000000000${ADDRESS:2}"

# 1. Approve PROS to Router
cast send $PROS_ETH "approve(address,uint256)" $ROUTER_ETH $AMOUNT \
  --rpc-url $ETH_RPC --private-key $PRIVATE_KEY

# 2. Send via CCIP (fee paid in native ETH)
cast send $ROUTER_ETH \
  "ccipSend(uint64,(bytes,bytes,(address,uint256)[],address,bytes))" \
  $PHAROS_SELECTOR \
  "($RECEIVER,0x,[$PROS_ETH,$AMOUNT)],0x0000000000000000000000000000000000000000,0x)" \
  --value 2000000000000000 \
  --rpc-url $ETH_RPC \
  --private-key $PRIVATE_KEY
```

### Complete Script: Pharos → Base

```bash
set -a && source $ENV_FILE && set +a
TOKENS="$SKILL_DIR/assets/tokens.json"
NETWORKS="$SKILL_DIR/assets/networks.json"
ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)

# Config — lowercase all addresses for tuple encoding
ROUTER_PHAROS=$(jq -r '.ccip.routers.pharos' $TOKENS | tr '[:upper:]' '[:lower:]')
BASE_SELECTOR=$(jq -r '.ccip.chainSelectors.base' $TOKENS)
WPROS=$(jq -r '.ccip.tokens.pharos' $TOKENS | tr '[:upper:]' '[:lower:]')
PHAROS_RPC=$(jq -r '.networks[] | select(.name=="pharos") | .rpcUrl' $NETWORKS)

AMOUNT=10000000000000000000  # 10 WPROS (18 decimals)
RECEIVER="0x000000000000000000000000${ADDRESS:2}"

# 1. Wrap PROS → WPROS
cast send $WPROS "deposit()" --value $AMOUNT --rpc-url $PHAROS_RPC --private-key $PRIVATE_KEY

# 2. Approve WPROS to Router
cast send $WPROS "approve(address,uint256)" $ROUTER_PHAROS $AMOUNT --rpc-url $PHAROS_RPC --private-key $PRIVATE_KEY

# 3. Send via CCIP (fee paid in native PROS)
cast send $ROUTER_PHAROS \
  "ccipSend(uint64,(bytes,bytes,(address,uint256)[],address,bytes))" \
  $BASE_SELECTOR \
  "($RECEIVER,0x,[($WPROS,$AMOUNT)],0x0000000000000000000000000000000000000000,0x)" \
  --value 300000000000000000 \
  --rpc-url $PHAROS_RPC \
  --private-key $PRIVATE_KEY
```

### Complete Script: Pharos → Ethereum

```bash
set -a && source $ENV_FILE && set +a
TOKENS="$SKILL_DIR/assets/tokens.json"
NETWORKS="$SKILL_DIR/assets/networks.json"
ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)

# Config — lowercase all addresses for tuple encoding
ROUTER_PHAROS=$(jq -r '.ccip.routers.pharos' $TOKENS | tr '[:upper:]' '[:lower:]')
ETH_SELECTOR=$(jq -r '.ccip.chainSelectors.ethereum' $TOKENS)
WPROS=$(jq -r '.ccip.tokens.pharos' $TOKENS | tr '[:upper:]' '[:lower:]')
PHAROS_RPC=$(jq -r '.networks[] | select(.name=="pharos") | .rpcUrl' $NETWORKS)

AMOUNT=10000000000000000000  # 10 WPROS (18 decimals)
RECEIVER="0x000000000000000000000000${ADDRESS:2}"

# 1. Wrap PROS → WPROS
cast send $WPROS "deposit()" --value $AMOUNT --rpc-url $PHAROS_RPC --private-key $PRIVATE_KEY

# 2. Approve WPROS to Router
cast send $WPROS "approve(address,uint256)" $ROUTER_PHAROS $AMOUNT --rpc-url $PHAROS_RPC --private-key $PRIVATE_KEY

# 3. Send via CCIP (fee paid in native PROS)
cast send $ROUTER_PHAROS \
  "ccipSend(uint64,(bytes,bytes,(address,uint256)[],address,bytes))" \
  $ETH_SELECTOR \
  "($RECEIVER,0x,[($WPROS,$AMOUNT)],0x0000000000000000000000000000000000000000,0x)" \
  --value 300000000000000000 \
  --rpc-url $PHAROS_RPC \
  --private-key $PRIVATE_KEY
```

## Step 7: Unwrap WPROS → PROS (when receiving on Pharos)

When PROS is bridged TO Pharos, you receive WPROS. Unwrap to get native PROS:

```bash
WPROS="0x52c48d4213107b20bc583832b0d951fb9ca8f0b0"
# Check WPROS balance — returns DECIMAL (not hex), use directly
WPROS_BALANCE=$(cast call $WPROS "balanceOf(address)(uint256)" $ADDRESS --rpc-url $PHAROS_RPC)

# Unwrap WPROS → native PROS — pass balance directly, no hex conversion
cast send $WPROS "withdraw(uint256)" $WPROS_BALANCE \
  --rpc-url $PHAROS_RPC --private-key $PRIVATE_KEY
```

## Step 8: Verify

CCIP finality: ~5-20 minutes.

```bash
# Check PROS on Base
cast call $PROS_BASE "balanceOf(address)(uint256)" $ADDRESS --rpc-url $BASE_RPC

# Check PROS on Ethereum
cast call $PROS_ETH "balanceOf(address)(uint256)" $ADDRESS --rpc-url $ETH_RPC

# Check native PROS on Pharos
cast balance $ADDRESS --rpc-url $PHAROS_RPC --ether
```

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `16#: invalid integer constant` | Tried hex conversion on decimal output | `cast call` returns decimal — use directly, no `$((16#...))` |
| `encode length mismatch: expected N types, got M` | Wrong ccipSend signature | Use exact: `ccipSend(uint64,(bytes,bytes,(address,uint256)[],address,bytes))` |
| `odd number of digits` | Mixed-case address in tuple | Lowercase all addresses: `jq ... \| tr '[:upper:]' '[:lower:]'` |
| `syntax error near unexpected token` | Wrong quoting in bash | Use exact quoting from examples — signature in one string, tuple in another |
| `execution reverted` on approve | Already approved to sufficient amount | Check allowance: `cast call $TOKEN "allowance(address,address)(uint256)" $ADDRESS $ROUTER` |
| `execution reverted` on ccipSend | Insufficient tokens or fee too low | Check token balance, increase `--value` for CCIP fee |
| `insufficient funds` | Not enough native for gas + CCIP fee | Ensure native balance covers gas + fee |
| CCIP message not delivered | Waiting for finality | Wait 5-20 min, check on [CCIP Explorer](https://ccip.chain.link) |
| Wrong chain selector | Used chain ID instead of CCIP selector | Use selectors from `ccip.chainSelectors` (e.g., 15971525489660198786 for Base, NOT 8453) |
| WPROS balance 0 on Pharos | Forgot to wrap native PROS | Run `deposit()` on WPROS contract with `--value` |

## Important Notes

- CCIP Chain Selectors are NOT the same as EVM Chain IDs. Always use selectors from `assets/tokens.json` → `ccip.chainSelectors`
- On Pharos, CCIP works with **WPROS** (wrapped), not native PROS. Wrap before sending, unwrap after receiving
- WPROS follows WETH pattern: `deposit()` (payable) to wrap, `withdraw(uint256)` to unwrap
- CCIP fees are paid in source chain's native token (PROS on Pharos, ETH on Base/Ethereum)
- Fee for 1 WPROS Pharos → Base: ~0.257 PROS (confirmed on-chain)
- Fee for Base → Pharos: ~0.0005 ETH. Fee for Ethereum → Pharos: ~0.002 ETH
- CCIP finality: 5-20 minutes (vs CCTP V2: seconds to minutes)
- Track CCIP messages on [CCIP Explorer](https://ccip.chain.link) using the source tx hash
