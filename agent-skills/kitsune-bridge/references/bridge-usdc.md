# USDC Bridge via Circle CCTP V2

Bridge USDC between Pharos and supported chains using Circle's native CCTP V2 burn-and-mint protocol.

## CCTP Architecture

Circle CCTP V2 transfers USDC natively 1:1 between blockchains via burn-and-mint:
1. **Burn** — USDC burned on source chain via `TokenMessengerV2.depositForBurn()`
2. **Attestation** — Circle Iris (off-chain) signs the burn message
3. **Mint** — USDC minted on destination chain via `MessageTransmitterV2.receiveMessage()`

No wrapped tokens, no liquidity pools, no third-party bridge custodians.

## CCTP V2 Contracts (universal addresses, all chains)

| Contract | Address | Purpose |
|----------|---------|---------|
| TokenMessengerV2 | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` | `depositForBurn` (burn USDC) |
| MessageTransmitterV2 | `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` | `receiveMessage` (mint USDC) |
| TokenMinterV2 | `0xfd78EE919681417d192449715b2594ab58f5D002` | Internal burn/mint handler |

All addresses are CREATE2 deterministic — same address on every supported chain.

## CCTP Domain IDs

CCTP uses its own Domain IDs, NOT EVM Chain IDs:

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

Domain IDs are read from `assets/tokens.json` → `cctp.domains` or `assets/networks.json` → `networks[].cctpDomain`.

## Supported Routes

All supported chains can bridge USDC to/from Pharos bidirectionally.

## Step 1: Read Configuration

Read network config, CCTP domain IDs, and USDC addresses:

```bash
# SKILL_DIR = dir containing this skill's SKILL.md — see SKILL.md Phase 0
TOKENS="$SKILL_DIR/assets/tokens.json"
NETWORKS="$SKILL_DIR/assets/networks.json"

# Source chain (e.g., pharos)
SOURCE_RPC=$(jq -r '.networks[] | select(.name=="pharos") | .rpcUrl' $NETWORKS)
SOURCE_DOMAIN=$(jq -r '.networks[] | select(.name=="pharos") | .cctpDomain' $NETWORKS)
SOURCE_USDC=$(jq -r '.bridge.USDC.addresses.pharos' $TOKENS)

# Destination chain (e.g., base)
DEST_RPC=$(jq -r '.networks[] | select(.name=="base") | .rpcUrl' $NETWORKS)
DEST_DOMAIN=$(jq -r '.networks[] | select(.name=="base") | .cctpDomain' $NETWORKS)
DEST_USDC=$(jq -r '.bridge.USDC.addresses.base' $TOKENS)

# CCTP contracts (same on all chains)
TOKEN_MESSENGER=$(jq -r '.cctp.contracts.tokenMessengerV2' $TOKENS)
MSG_TRANSMITTER=$(jq -r '.cctp.contracts.messageTransmitterV2' $TOKENS)
IRIS_API=$(jq -r '.cctp.api.mainnet' $TOKENS)
```

## Step 2: Pre-flight Checks

```bash
# Key Prelude — loads PRIVATE_KEY from ~/.kitsune/config.toml / KITSUNE_PRIVATE_KEY (see SKILL.md Phase 0)
CFG="$HOME/.kitsune/config.toml"
PROFILE="${KITSUNE_PROFILE:-$(sed -n 's/^default_profile[[:space:]]*=[[:space:]]*"\(.*\)"/\1/p' "$CFG" 2>/dev/null | head -1)}"; PROFILE="${PROFILE:-mainnet}"
PRIVATE_KEY="${KITSUNE_PRIVATE_KEY:-$(awk -v s="[profiles.$PROFILE]" '$0==s{f=1;next}/^\[/{f=0}f&&$1~/^private_key/{sub(/^[^"]*"/,"");sub(/".*$/,"");print;exit}' "$CFG" 2>/dev/null)}"

# Verify private key
[ -n "$PRIVATE_KEY" ] && echo "key: loaded" || { echo "key: not found — see SKILL.md Phase 0 (~/.kitsune/config.toml)"; exit 1; }

# Derive wallet address
ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)

# Check native token balance for gas
cast balance $ADDRESS --rpc-url $SOURCE_RPC

# Check USDC balance on source chain
cast call $SOURCE_USDC "balanceOf(address)(uint256)" $ADDRESS --rpc-url $SOURCE_RPC
```

## Step 3: Approve USDC

Approve `TokenMessengerV2` to spend USDC. Only needed if current allowance is insufficient.

```bash
AMOUNT=1000000  # 1 USDC (6 decimals)

cast send $SOURCE_USDC \
  "approve(address,uint256)" \
  $TOKEN_MESSENGER \
  $AMOUNT \
  --rpc-url $SOURCE_RPC \
  --private-key $PRIVATE_KEY
```

Wait for confirmation before proceeding.

## Step 4: depositForBurn (Burn USDC)

Call `depositForBurn` on the source chain's `TokenMessengerV2`:

```bash
# Format recipient as bytes32 (left-padded address)
MINT_RECIPIENT="0x000000000000000000000000${ADDRESS:2}"
DESTINATION_CALLER="0x0000000000000000000000000000000000000000000000000000000000000000"
MAX_FEE=500  # 0.0005 USDC max fee for fast transfer
MIN_FINALITY_THRESHOLD=1000  # 1000 = Fast Transfer, 2000 = Standard

cast send $TOKEN_MESSENGER \
  "depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)" \
  $AMOUNT \
  $DEST_DOMAIN \
  $MINT_RECIPIENT \
  $SOURCE_USDC \
  $DESTINATION_CALLER \
  $MAX_FEE \
  $MIN_FINALITY_THRESHOLD \
  --rpc-url $SOURCE_RPC \
  --private-key $PRIVATE_KEY
```

Save the transaction hash from the output. This is the `BURN_TX_HASH`.

What happens inside this transaction:
1. USDC transferred from user to `TokenMinterV2`
2. USDC burned inside `TokenMinterV2`
3. `MessageTransmitterV2.sendMessage()` emits a CCTP message

### Parameters Reference

| Parameter | Type | Description |
|-----------|------|-------------|
| `amount` | uint256 | USDC amount in subunits (6 decimals: 1 USDC = 1000000) |
| `destinationDomain` | uint32 | CCTP domain ID of destination chain (NOT chain ID) |
| `mintRecipient` | bytes32 | Recipient address in bytes32 format (left-padded with 12 zero bytes) |
| `burnToken` | address | USDC contract address on source chain |
| `destinationCaller` | bytes32 | Address allowed to call receiveMessage (0x0...0 = any caller) |
| `maxFee` | uint256 | Maximum fee in USDC subunits (500 = 0.0005 USDC for fast transfer) |
| `minFinalityThreshold` | uint32 | 1000 or less = Fast Transfer, 2000 = Standard Transfer |

## Step 5: Retrieve Attestation

Poll Circle Iris API until the attestation is ready:

```bash
BURN_TX_HASH="0x..."  # from Step 4

# Poll for attestation (Fast Transfer: usually instant, Standard: 5-20 min)
for i in $(seq 1 60); do
  RESPONSE=$(curl -s "$IRIS_API/$SOURCE_DOMAIN?transactionHash=$BURN_TX_HASH")
  STATUS=$(echo $RESPONSE | jq -r '.messages[0].status // empty')

  if [ "$STATUS" = "complete" ]; then
    MESSAGE=$(echo $RESPONSE | jq -r '.messages[0].message')
    ATTESTATION=$(echo $RESPONSE | jq -r '.messages[0].attestation')
    echo "Attestation ready!"
    echo "Message: $MESSAGE"
    echo "Attestation: $ATTESTATION"
    break
  fi

  echo "Waiting for attestation... (attempt $i/60)"
  sleep 5
done
```

### API Response Format

```json
{
  "messages": [{
    "status": "complete",
    "message": "0x000000010000001f00000006...",
    "attestation": "0x17b1a3cae96672a0b1063996af..."
  }]
}
```

The `status` field values: `"pending_signing"` → `"complete"`.

## Step 6: receiveMessage (Mint USDC)

Call `receiveMessage` on the destination chain's `MessageTransmitterV2`:

```bash
cast send $MSG_TRANSMITTER \
  "receiveMessage(bytes,bytes)" \
  "$MESSAGE" \
  "$ATTESTATION" \
  --rpc-url $DEST_RPC \
  --private-key $PRIVATE_KEY
```

What happens inside this transaction:
1. Circle attestation signature verified
2. BurnMessageV2 parsed
3. `TokenMinterV2.mint()` called
4. USDC minted to `mintRecipient`

## Step 7: Verify

Check USDC balance on destination chain:

```bash
cast call $DEST_USDC \
  "balanceOf(address)(uint256)" \
  $ADDRESS \
  --rpc-url $DEST_RPC
```

## Complete Example: 1 USDC Base → Pharos

```bash
# Config
# Key Prelude — loads PRIVATE_KEY from ~/.kitsune/config.toml / KITSUNE_PRIVATE_KEY (see SKILL.md Phase 0)
CFG="$HOME/.kitsune/config.toml"
PROFILE="${KITSUNE_PROFILE:-$(sed -n 's/^default_profile[[:space:]]*=[[:space:]]*"\(.*\)"/\1/p' "$CFG" 2>/dev/null | head -1)}"; PROFILE="${PROFILE:-mainnet}"
PRIVATE_KEY="${KITSUNE_PRIVATE_KEY:-$(awk -v s="[profiles.$PROFILE]" '$0==s{f=1;next}/^\[/{f=0}f&&$1~/^private_key/{sub(/^[^"]*"/,"");sub(/".*$/,"");print;exit}' "$CFG" 2>/dev/null)}"
ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)
RPC_BASE="https://mainnet.base.org"
RPC_PHAROS="https://rpc.pharos.xyz"
TOKEN_MESSENGER="0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"
MSG_TRANSMITTER="0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"
USDC_BASE="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
IRIS_API="https://iris-api.circle.com/v2/messages"
AMOUNT=1000000

# 1. Approve (on Base)
cast send $USDC_BASE "approve(address,uint256)" $TOKEN_MESSENGER $AMOUNT \
  --rpc-url $RPC_BASE --private-key $PRIVATE_KEY

# 2. Burn (on Base; 31 = Pharos CCTP destination domain)
MINT_RECIPIENT="0x000000000000000000000000${ADDRESS:2}"
cast send $TOKEN_MESSENGER \
  "depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)" \
  $AMOUNT 31 $MINT_RECIPIENT $USDC_BASE \
  "0x0000000000000000000000000000000000000000000000000000000000000000" \
  500 1000 \
  --rpc-url $RPC_BASE --private-key $PRIVATE_KEY
# Save TX_HASH from output

# 3. Poll attestation (6 = Base CCTP source domain)
for i in $(seq 1 60); do
  RESP=$(curl -s "$IRIS_API/6?transactionHash=$TX_HASH")
  [ "$(echo $RESP | jq -r '.messages[0].status')" = "complete" ] && break
  sleep 5
done
MESSAGE=$(echo $RESP | jq -r '.messages[0].message')
ATTESTATION=$(echo $RESP | jq -r '.messages[0].attestation')

# 4. Mint on Pharos
cast send $MSG_TRANSMITTER "receiveMessage(bytes,bytes)" \
  "$MESSAGE" "$ATTESTATION" \
  --rpc-url $RPC_PHAROS --private-key $PRIVATE_KEY
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `execution reverted` on approve | Already approved with sufficient amount | Check allowance: `cast call $USDC "allowance(address,address)(uint256)" $ADDRESS $TOKEN_MESSENGER --rpc-url $RPC` |
| `execution reverted` on depositForBurn | Insufficient USDC or allowance | Check USDC balance and re-approve |
| `insufficient funds` | Not enough native token for gas | Fund wallet with native token on source chain |
| Attestation never completes | Invalid burn tx or network issue | Verify TX_HASH is correct; check source tx on explorer |
| `execution reverted` on receiveMessage | Invalid or reused attestation | Attestation can only be used once; ensure message not already processed |
| `MessageFeeMismatch` | maxFee too low | Re-run with higher maxFee (try 1000 or more) |
| `NonceAlreadyUsed` | Message already processed | Check destination balance; USDC may already be minted |

## Important Notes

- CCTP Domain IDs are NOT the same as EVM Chain IDs. Always use `cctpDomain` from config.
- `mintRecipient` must be bytes32 format: `0x000000000000000000000000${ADDRESS:2}`
- `destinationCaller` = `0x000...000` allows anyone to call receiveMessage
- Fast Transfer (threshold ≤ 1000): attestation in seconds, small fee (0.0001%)
- Standard Transfer (threshold 2000): attestation in 5-20 min, no fee
- All CCTP V2 contracts have the same address on every supported chain
- Bridge fee is paid in USDC (deducted from transfer amount for fast transfers)
- Gas fees are paid in native token of each chain
- USDC on Pharos: `0xc879c018db60520f4355c26ed1a6d572cdac1815` (Circle-deployed, native)
