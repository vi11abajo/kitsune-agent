---
name: kitsune-strategy
description: "Use this skill to manage Kitsune (Pharos) trading strategies end-to-end: recommend parameters from live market state, backtest them, then create and run DCA / grid / recurring strategies on-chain — plus list strategies, monitor PnL/win-rate/Sharpe, update, pause/resume, withdraw, restart cycles, rename, hide/restore. Trigger on: \"create a grid bot\", \"set up a DCA strategy\", \"recommend strategy parameters\", \"optimize my grid\", \"martingale settings\", \"RSI buy-the-dip strategy\", \"запусти грід-бота\", \"створи DCA-стратегію\", \"підбери параметри сітки\", \"оптимізуй стратегію\", \"мартингейл налаштування\", \"建一个网格机器人\", \"开DCA\", \"网格策略参数\", \"马丁格尔参数\", \"优化网格\", \"RSI抄底策略\". Reads and off-chain edits need sign-in; create/update/pause/resume/withdraw send on-chain transactions on Pharos (mainnet by default; testnet via --profile testnet) and require a private_key. Do NOT use for market data alone (kitsune-market), vault balances/creation (kitsune-vault), portfolio (kitsune-portfolio), or the marketplace (kitsune-marketplace)."
license: MIT
metadata:
  author: kitsune
  version: "0.3.11"
  agent:
    requires: { bins: ["kitsune"] }
    install:
      - { kind: node, package: "@kitsune-ai/agent-cli@0.2.14", bins: ["kitsune"] }
---

# Kitsune Strategies

See [preflight](references/preflight.md) first — including the CRITICAL security rule: never output secrets (private keys, API keys, JWTs) to chat. On-chain writes need a `private_key` and send
transactions on Pharos (mainnet by default; use `--profile testnet` for risk-free Atlantic).
Append `[profile: mainnet]` or `[profile: testnet]` to every command report so the user always
knows which network was touched.

**How Kitsune strategies work (read before creating one):** a strategy has TWO layers.

1. **On-chain config** (`strategy_create` / `strategy_update`) — risk limits the vault contract
   enforces: tokens, executor, TP/SL, position caps, DCA progression.
2. **Off-chain config** (`strategy_set_config`) — what the executor service actually runs:
   strategy type (dca / grid / recurring), grid bounds, entry indicators, trailing TP/SL.

`strategy_create` alone gives a default DCA with immediate entry. **A grid or indicator-gated
strategy is NOT complete until `strategy_set_config` is sent.** Execution is server-side 24/7 —
the executor monitors prices and indicators on-chain; the agent never needs to poll or keep a
loop alive.

## Operating Modes

Load only what the task needs:

| Mode | Trigger | Read first |
|------|---------|-----------|
| **monitor** | "how is strategy X doing", PnL, trades | — (Command Index below) |
| **manage** | pause/resume/withdraw/rename/hide | — (Command Index below) |
| **create** | "create/set up a strategy", "запусти", "建/开" | Create Workflow below |
| **recommend** | "recommend/optimize parameters", "підбери", "优化" | [parameter-bands](references/parameter-bands.md) |
| **recipes** | "RSI bottom-fishing", "neutral grid", "trend grid" | [presets](references/presets.md) |

## Command Index

### Reads (sign-in required)
| # | Command | Description |
|---|---------|-------------|
| 1 | `kitsune call strategy_list --vault <addr>` | List strategies in a vault |
| 2 | `kitsune call strategy_get --vault <addr> --strategyId <id>` | One strategy (both config layers) |
| 3 | `kitsune call strategy_get_position --vault <addr> --strategyId <id>` | Open position state |
| 4 | `kitsune call strategy_get_trades --vault <addr> --strategyId <id> --page 1 --pageSize 50` | Trade history |
| 5 | `kitsune call strategy_get_metrics --vault <addr> --strategyId <id>` | PnL / win-rate / Sharpe |
| 6 | `kitsune call strategy_get_grid_orders --vault <addr> --strategyId <id>` | Live grid order book: resting BUY/SELL per zone + distance-to-fill % |
| 7 | `kitsune call strategy_get_by_uuid --vault <addr> --uuid <uuid>` | Look up by UUID (e.g. right after `marketplace_copy`) |
| 8 | `kitsune call strategy_list_trash --vault <addr>` | List hidden strategies |

### On-chain writes (private_key required) — [CAUTION]
| # | Command | Description |
|---|---------|-------------|
| 9 | `kitsune call strategy_create --args '<json>'` | Create (see Create Workflow) |
| 10 | `kitsune call strategy_update --args '<json>'` | Update — ALL on-chain fields required, not a patch |
| 11 | `kitsune call strategy_pause --vault <addr> --strategyId <id>` | Pause (executor stops trading it) |
| 12 | `kitsune call strategy_resume --vault <addr> --strategyId <id>` | Resume |
| 13 | `kitsune call strategy_withdraw --vault <addr> --strategyId <id>` | Withdraw position |

### Off-chain edits (sign-in required)
| # | Command | Description |
|---|---------|-------------|
| 14 | `kitsune call strategy_set_config --args '<json>'` | Set executor config (type/grid/entry/trailing) — partial, only sent fields change |
| 15 | `kitsune call strategy_set_metadata --args '{"vault":"0x..","strategyId":"3","name":"My grid"}'` | Display name |
| 16 | `kitsune call strategy_restart_cycle --vault <addr> --strategyId <id>` | Reset DCA/grid cycle |
| 17 | `kitsune call strategy_hide --vault <addr> --strategyId <id>` / `strategy_restore` | Hide / restore |

Add `--json` for raw output.

## Strategy Anatomy — Parameter Reference

### Layer 1: on-chain config (contract-enforced limits)

| Field | Type | Unit / range (enforced by the vault contract) | Plain name |
|---|---|---|---|
| `baseToken` / `quoteToken` | address | from chain config (mainnet pair: WPROS/USDC) | Trading pair |
| `allowedExecutor` | address | MUST come from `kitsune call executor_list` — never invent | Executor |
| `takeProfitBps` | number | basis points, > 0 (500 = 5%) | Take-profit % |
| `stopLossBps` | number | basis points, > 0 and < 10000 (1500 = 15%) | Stop-loss % |
| `maxDcaCount` | number | > 0 (contract rejects 0). Grid ignores it (zones are flat-sized) | Max DCA buys |
| `maxTradesPerDay` | number | > 0 | Daily trade cap |
| `active` | boolean | start active or paused | Active |
| `firstBuyAmount` | string | **quote-token base units** (USDC ×1e6: 100 USDC = "100000000") | First buy / per-zone amount |
| `maxPositionSize` | string | quote-token base units; caps total spent | Max position size |
| `dcaMultiplier` | string | **bps-scaled: "10000"–"30000" = ×1.0–×3.0** (NOT 1e18) | DCA size multiplier |

**Contract validation you must pre-check** (a violation reverts `InvalidStrategyConfig` /
`MaxPositionSizeExceeded`):

```
total DCA spend = firstBuyAmount × Σ (dcaMultiplier/10000)^i,  i = 0..maxDcaCount-1
required: total DCA spend ≤ maxPositionSize
```

### Layer 2: off-chain config (`strategy_set_config`, API-validated ranges)

| Group | Fields (validated range) |
|---|---|
| Type | `strategyType`: `dca` \| `grid` \| `recurring` |
| Grid | `gridLowerPrice` / `gridUpperPrice` (positive **human** prices, e.g. 0.62 — not base units), `gridCount` (int 2–500), `gridType`: `arithmetic` \| `geometric` \| `infinity` \| `reverse`, `gridStartCondition`: `instant` \| `price` (+ `gridTriggerPrice`) |
| DCA sizing | `dcaOrderAmount` (string), `priceStepPercent` (0–100), `priceStepMultiplier` (0.1–10) |
| Entry gate | `entryType`: `immediate` \| `rsi` \| `macd` \| `ema` \| `bb` \| `multi`; RSI: `rsiThreshold` 1–99, `rsiPeriod` 2–100, `rsiTimeframe`; MACD: fast 10–15 / slow 20–30 / signal 7–12; EMA: fast 10–30 / slow 40–100; BB: period 15–25, stdDev 1.5–2.5; `entryIndicators` `{logic: AND|OR, indicators[≤10]}` for `multi` |
| Trailing | `trailingTpEnabled` + `trailingTpCallbackPercent` (0.01–50), same for SL |
| Recurring | `recurringInterval`: `hourly` \| `daily` \| `weekly`, `recurringAmount`, `recurringTotalInvestment` |

## Create Workflow (grid / DCA / recurring)

Run the steps in order. READ steps run silently; ask the user only what is listed.

**Step 0 — Scene.** Resolve: vault (via `vault_list` if not given), pair (mainnet default
WPROS/USDC), strategy type, budget in USDC. If the user already gave values — use them, don't
re-ask. Speak human: "What price range?", not "enter gridLowerPrice".

**Step 1 — Recommendation gate.** If the user did not provide full parameters, ask ONCE whether
they want recommendations. Declined → take their values as-is and skip to Step 5.

**Step 2 — Market brief.** `kitsune market price WPROS USDC` + `kitsune market indicators WPROS USDC`
+ `kitsune market candles WPROS USDC --interval 1h --limit 60`. Classify the market and compute
volatility per [parameter-bands](references/parameter-bands.md). Report a 3-line brief: trend,
volatility, range.

**Step 3 — Safety gate.** In a strong one-sided trend, DCA-against-trend and neutral grids are
unsafe: warn using the template in parameter-bands and STOP unless the user explicitly insists
("continue anyway"). On insistence switch to the defensive preset (smaller first buy, wider step,
multiplier "10000"–"11000").

**Step 4 — Recommend.** Derive parameters from the bands (three risk tiers — conservative /
balanced / aggressive — let the user pick), then validate: total-DCA-spend formula vs
`maxPositionSize`; grid range must straddle the current price; budget vs **free** vault USDC
(`vault_get_balances`[USDC] − `vault_get_allocations`[USDC]; funds committed to other strategies
are not free). If short, the Funding cascade (Step 6.5) covers it.

**Step 5 — Backtest (recommended, needs sign-in).** Before spending gas, dry-run the config:

```
kitsune call market_run_backtest --args '{"config":{"pair":"WPROS/USDC","strategyType":"grid","timeframe":"1h","startDate":"2026-03-01","endDate":"2026-06-01","initialOrderAmount":10,"dcaOrderAmount":10,"maxDcaCount":3,"gridLowerPrice":0.62,"gridUpperPrice":0.82,"gridCount":12,"gridType":"arithmetic","takeProfitPercent":5,"stopLossPercent":15,"stopLossEnabled":true,"priceStepPercent":2,"priceStepMultiplier":1,"dcaMultiplier":1.5}}'
```

Show PnL / win-rate. If the user skips the backtest, say so and proceed.

**Step 6 — Pre-create checklist (all YES or stop and explain):**
1. [ ] Executor address taken from `executor_list` output?
2. [ ] No duplicate active strategy on this pair? (`strategy_list` — if one exists, offer update/restart instead)
3. [ ] Vault **free** USDC (balances − allocations) ≥ planned spend? (if not → Step 6.5)
4. [ ] Total DCA spend ≤ `maxPositionSize` (formula above)?
5. [ ] Grid: `gridLowerPrice` < current price < `gridUpperPrice`?
6. [ ] `dcaMultiplier` within "10000"–"30000"?

**Step 6.5 — Funding (MANDATORY when the vault is short).** A strategy CANNOT be created unless the
vault holds enough **free USDC** to cover it — `strategy_create` refuses with `InsufficientVaultFunds`
and sends no transaction. Free USDC = `vault_get_balances`[USDC] − `vault_get_allocations`[USDC].

State the requirement plainly ("this grid needs ≥ 200 USDC free in the vault"), then cascade — each
money-moving step shows the exact command and takes ONE confirmation:

1. **Vault already funded?** free USDC ≥ required → go to Step 7.
2. **Funds on Pharos?** Check the wallet via [[kitsune-bridge]] (it reads balances across chains).
   Enough **USDC / WPROS / PROS** (by value) → fund with a single [[kitsune-vault]] `vault_deposit`
   — it wraps native PROS and swaps WPROS→USDC automatically (keep a little PROS for gas):
   - `kitsune call vault_deposit --args '{"amount":"200000000"}'` &nbsp;# 200 USDC
   - `kitsune call vault_deposit --args '{"amount":"<wei>","token":"wpros"}'` / `'{"...","token":"native"}'`
3. **Pharos short?** Use [[kitsune-bridge]] to bring USDC (Circle CCTP) or PROS (Chainlink CCIP) onto
   Pharos from a chain where the user holds funds, then `vault_deposit`.
4. Re-check free USDC. **Never call `strategy_create` until `free ≥ required`** (the kit enforces this).

**Step 7 — Confirm ONCE, then execute the full chain without re-asking:**

```bash
# 7a. on-chain risk config (returns txHash)
kitsune call strategy_create --args '{"vault":"0x..","baseToken":"0x..","quoteToken":"0x..","allowedExecutor":"0x..","takeProfitBps":500,"stopLossBps":1500,"maxDcaCount":4,"maxTradesPerDay":10,"active":true,"firstBuyAmount":"100000000","maxPositionSize":"900000000","dcaMultiplier":"15000"}'
# 7b. find the new strategyId
kitsune call strategy_list --vault 0x..
# 7c. executor config (grid example)
kitsune call strategy_set_config --args '{"vault":"0x..","strategyId":"<id>","strategyType":"grid","gridLowerPrice":0.62,"gridUpperPrice":0.82,"gridCount":12,"gridType":"arithmetic"}'
# 7d. name it
kitsune call strategy_set_metadata --args '{"vault":"0x..","strategyId":"<id>","name":"WPROS neutral grid"}'
```

**Step 8 — Verify (mandatory after every write).** `strategy_get` → confirm both layers landed
(active, strategyType, bounds). Report a strategy card: name, pair, type, key params in human
units, tx hash, `[profile: ...]`.

## Key Rules

- **Funding is allowed, with confirmation** — to cover a shortfall you MAY `vault_deposit` (and bridge in via [[kitsune-bridge]]) per Step 6.5; always show the exact command and take one confirmation. Never withdraw to a third party. A strategy is never created underfunded — `strategy_create` refuses (`InsufficientVaultFunds`).
- **`allowedExecutor` only from `executor_list`**, `strategyId` only from `strategy_list`/create output. Never fabricate addresses or IDs.
- **`strategy_update` is full-replace**: read current config with `strategy_get`, change the fields, resubmit ALL on-chain fields.
- **`strategy_set_config` is a patch**: only the fields you send change.
- **Two unit systems**: on-chain amounts = quote base units (USDC ×1e6) as strings; off-chain grid prices = human numbers. Mixing them is the #1 creation error.
- **`dcaMultiplier` is bps**: "15000" = ×1.5. A 1e18-style value reverts on-chain.
- After create/update also confirm the executor picked it up: `strategy_get_position` shows the cycle state.
- Verify after every write; after pause/resume re-read `strategy_get` and check `active`.

## Monitoring & Rebalance

- Health check: `strategy_get_metrics` (PnL, win-rate, Sharpe) + `strategy_get_position`.
- Grid health: `strategy_get_grid_orders` shows the live order book (resting BUY/SELL per zone,
  distance-to-fill %). Use it to answer "where are my grid orders?" and to spot a price drifting
  out of range before proposing a rebalance.
- Rebalance triggers (suggest, don't auto-execute): price pinned in the top/bottom 10% of the grid
  range → propose new bounds via `strategy_set_config` + `strategy_restart_cycle`; trend flip vs
  the strategy's bias → propose pause or re-parameterize.
- **Circuit breaker:** if `portfolio_get` shows drawdown beyond the user's stated tolerance
  (default −30% from peak), recommend `strategy_pause` on active strategies and a cool-off. Do not
  pause without confirmation.

## Edge Cases

| Case | Handling |
|---|---|
| Grid range doesn't straddle current price | Re-derive range; creating anyway makes one side dead |
| Existing active strategy on the pair | Offer update / restart_cycle instead of a duplicate |
| Vault balance < planned spend | Run the Step 6.5 funding cascade: `vault_deposit` (USDC / WPROS / PROS) or bridge in via [[kitsune-bridge]], then create — or offer a smaller size |
| `InsufficientVaultFunds` (strategy_create refused) | The vault's free USDC < required; it sent no tx. Fund via Step 6.5 (`vault_deposit`), then retry |
| `InvalidStrategyConfig` revert | Check: any zero field, `stopLossBps ≥ 10000`, `dcaMultiplier` outside 10000–30000, `maxDcaCount` = 0 |
| `MaxPositionSizeExceeded` revert | Total DCA spend formula exceeds cap → raise `maxPositionSize` or cut `maxDcaCount`/multiplier |
| User asks "no DCA, single buy" | `maxDcaCount` must be ≥ 1 on-chain: use 1 (the first buy is buy #1) |
| Backtest returns 401 | Backtests need sign-in (key in config); reads of public market data don't |
| User experimenting / unsure | Suggest `--profile testnet` (Pharos Atlantic, no real funds) |
| Strategy missing from UI | May be hidden — `strategy_restore` |

## Communication Guidelines

- Say "strategy" (this is on-chain, self-custody — not an exchange "bot").
- Ask in natural language; map answers to fields yourself; show amounts as human USDC and convert
  to base units silently.
- If the user already provided a value — never re-ask it.
- Every money-moving step shows the exact command and waits for the single confirmation from Step 7.

## Examples

User: "How is strategy 3 performing?"

    kitsune call strategy_get_metrics --vault 0xVAULT... --strategyId 3

Returns `{ "pnl": "...", "winRate": 0.62, "sharpe": 1.3, "tradeCount": 24 }`.

User: "Create a grid on WPROS, I have 200 USDC" → full Create Workflow: brief → recommend three
tiers → backtest the picked one → checklist → one confirmation → create + set_config + metadata →
verify → strategy card.

User: "Buy the dips with RSI" → [presets](references/presets.md), RSI bottom-fishing preset —
entry gating runs server-side in the executor; no agent polling loop.
