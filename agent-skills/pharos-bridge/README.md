# Native Pharos Bridge via Circle CCTP & Chainlink CCIP

**Direct-protocol bridge for Pharos Network — no aggregators, no wrappers, no middlemen.**

## The Problem with Aggregator Bridges

Most bridge skills route through aggregators like Jumper or LI.FI. That sounds convenient — until you realize what it costs:

- **Extra fees** — aggregator fee on top of protocol fee on top of gas
- **Opaque routing** — your tokens hop through intermediate chains you didn't choose
- **Single point of failure** — if the aggregator is down, your bridge is down

## Our Approach: Direct Protocol Calls

**pharos-bridge talks directly to the source protocols** — Circle CCTP V2 for USDC and Chainlink CCIP for PROS. No middleman, no wrapper contracts, no routing surprises.

| | Aggregator Bridge | pharos-bridge |
|---|---|---|
| **USDC** | Routed through intermediary | Circle CCTP V2 — native 1:1 burn-and-mint |
| **PROS** | Not supported by aggregators | Chainlink CCIP — direct Router, Lock/Release + Burn/Mint |
| **Fees** | Aggregator fee + protocol fee + gas | Protocol fee + gas only |
| **Speed** | Extra routing hops add latency | CCTP Fast Transfer: sub-minute. CCIP: 5-20 min |
| **Tokens** | May route through wrapped versions | Native USDC on every chain — always 1:1 |
| **Reliability** | Depends on aggregator uptime | Depends on Circle/Chainlink — battle-tested infrastructure |
| **Transparency** | Opaque routing, hard to trace | Every step verifiable on-chain with direct tx hashes |
| **Chains** | Whatever the aggregator supports | 8 chains for USDC, 3 chains for PROS |

## Protocols

### USDC — Circle CCTP V2

Burn native USDC on source chain → Circle attests the burn → Mint native USDC on destination. **1:1, no wrapped tokens, no slippage.** Circle's own protocol — the same one used by Coinbase, Binance, and every major exchange. Deterministic contract addresses (CREATE2) on all chains.

- **TokenMessengerV2**: `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` (universal, all chains)
- **MessageTransmitterV2**: `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` (universal, all chains)
- **Fast Transfer**: sub-minute finality for transfers up to 1,000 USDC
- **Pharos CCTP Domain**: 31

**Full automated pipeline**: approve → depositForBurn → poll Circle Iris API for attestation → receiveMessage (mint). One user confirmation, the agent handles everything.

### PROS — Chainlink CCIP (Direct Router)

Lock WPROS in Pharos TokenPool → CCIP cross-chain message → Mint PROS on Base/Ethereum as native BurnMintERC20. Reverse direction: burn on source → release WPROS on Pharos. **Direct CCIP Router calls — no InterPort or any other wrapper contract.**

- **CCIP Router (Pharos)**: `0x4e52dD94e9BCfeFE3C78153bDfB0AB1d30687297`
- **TokenPool (Pharos)**: Lock/Release — `0xCb79097744d5266bFca287A43612D9613Be46300`
- **TokenPool (Base)**: Burn/Mint — `0x7126C3FeF4e6a680eeE09Fb039B2236F638384B0`
- **TokenPool (Ethereum)**: Burn/Mint — `0x6f0c4C3f0F1ca8f0513b542A124a0208fEe72D97`

**Full automated pipeline**: wrap PROS→WPROS → approve Router → ccipSend → CCIP handles cross-chain transfer → unwrap WPROS→PROS. Trackable on [CCIP Explorer](https://ccip.chain.link).

## Supported Routes

### USDC (Circle CCTP V2) — 8 Chains, Bidirectional

Pharos ↔ Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, BSC

### PROS (Chainlink CCIP) — 3 Chains, Bidirectional

Pharos ↔ Base, Ethereum

## Features

- **Direct protocol calls** — no aggregator middleman, no wrapper contracts
- **Automated full-lifecycle pipeline** — one confirmation, agent executes all steps: approve → burn/send → attestation polling → mint
- **Multi-network balance queries** — check native + USDC across all 8 chains in a single command
- **WPROS wrap/unwrap** — automatic PROS→WPROS before send, WPROS→PROS after receive
- **Complete on-chain toolkit** — balance checks, native transfers, contract deployment and verification, batch airdrops, and auto-generated interaction scripts (JavaScript/TypeScript/Python)

## Usage Examples

```
"Bridge 1 USDC from Pharos to Base"
"Transfer 10 PROS from Pharos to Ethereum"
"Move 500 USDC from Arbitrum to Pharos"
"Check balances on all networks"
```

## Use with Kitsune

This skill ships with the [Kitsune Agent Trade Kit](https://github.com/vi11abajo/kitsune-agent) as the
funding on-ramp: bridge USDC from any major chain onto Pharos, then use the `kitsune-vault` /
`kitsune-strategy` skills to deposit and trade. The USDC it bridges to Pharos
(`0xC879…1815`) is the same token Kitsune vaults use as the quote asset.

## Installation

This skill lives in the kitsune-agent repo under `agent-skills/pharos-bridge/`.

### Option 1: Agent Prompt (Recommended)

Tell your AI agent:

```
Install the pharos-bridge skill from https://github.com/vi11abajo/kitsune-agent (agent-skills/pharos-bridge)
```

The agent will clone the repo and copy the skill into your skills directory.

### Option 2: Manual

```bash
git clone https://github.com/vi11abajo/kitsune-agent.git
cp -r kitsune-agent/agent-skills/pharos-bridge ~/.claude/skills/pharos-bridge
```

Skill files: `SKILL.md`, `assets/`, `references/`.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/) (`cast`, `forge`)
- `jq` for JSON parsing

## Technical Stack

- **Circle CCTP V2** — TokenMessengerV2 + MessageTransmitterV2 (deterministic CREATE2 addresses)
- **Circle Iris API** — attestation polling for mint finalization
- **Chainlink CCIP** — direct Router + TokenPool (Lock/Release + Burn/Mint)
- **Foundry CLI** — `cast` for all contract interactions, `forge` for deployments
- **jq** — JSON config parsing for multi-chain address resolution

## License

MIT

## Credits

Originally published as `goods-locomotive/pharos-bridge` by Locomotive (MIT); integrated into the
Kitsune Agent Trade Kit as the cross-chain on-ramp skill.
