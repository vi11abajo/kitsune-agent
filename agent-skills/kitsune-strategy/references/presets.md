# Strategy Presets (Recipes)

Ready-made configurations. Each preset = `strategy_create` (layer 1) + `strategy_set_config`
(layer 2) + `strategy_set_metadata`. Follow the Create Workflow from SKILL.md (checklist,
single confirmation, verify); presets only pre-fill the parameters. Amounts below assume the
mainnet pair WPROS/USDC (USDC = 6 decimals) and a ~200 USDC budget — scale to the user's budget
and re-derive anything market-dependent from [parameter-bands](parameter-bands.md).

All execution is server-side: the executor watches prices/indicators 24/7. The agent's job ends
at create + verify; never start a polling loop.

## 1. Martingale DCA (classic)

When: ranging market, user wants averaged entries with scaling size.

```bash
kitsune call strategy_create --args '{"vault":"0x..","baseToken":"<WPROS>","quoteToken":"<USDC>","allowedExecutor":"<from executor_list>","takeProfitBps":500,"stopLossBps":1500,"maxDcaCount":4,"maxTradesPerDay":5,"active":true,"firstBuyAmount":"30000000","maxPositionSize":"250000000","dcaMultiplier":"15000"}'
# spend check: 30 + 45 + 67.5 + 101.25 = 243.75 USDC ≤ 250 ✓
kitsune call strategy_set_config --args '{"vault":"0x..","strategyId":"<id>","strategyType":"dca","priceStepPercent":2.5,"priceStepMultiplier":1.2,"entryType":"immediate"}'
kitsune call strategy_set_metadata --args '{"vault":"0x..","strategyId":"<id>","name":"WPROS martingale DCA"}'
```

Tune `priceStepPercent` to ~1×ATR% (parameter-bands).

## 2. RSI Bottom-Fishing (indicator-gated entry)

When: "buy the dips", "oversold buy", "RSI抄底". The executor opens the position only when RSI
crosses the threshold — no agent monitoring needed.

```bash
kitsune call strategy_create --args '{"vault":"0x..","baseToken":"<WPROS>","quoteToken":"<USDC>","allowedExecutor":"<from executor_list>","takeProfitBps":800,"stopLossBps":1000,"maxDcaCount":3,"maxTradesPerDay":3,"active":true,"firstBuyAmount":"50000000","maxPositionSize":"250000000","dcaMultiplier":"12000"}'
# spend check: 50 + 60 + 72 = 182 USDC ≤ 250 ✓
kitsune call strategy_set_config --args '{"vault":"0x..","strategyId":"<id>","strategyType":"dca","entryType":"rsi","rsiThreshold":30,"rsiPeriod":14,"rsiTimeframe":"1h","priceStepPercent":3,"priceStepMultiplier":1.2}'
kitsune call strategy_set_metadata --args '{"vault":"0x..","strategyId":"<id>","name":"WPROS RSI dip buyer"}'
```

Variants: `entryType:"bb"` (buy at lower band), `"macd"`, `"ema"`, or `"multi"` with
`entryIndicators:{"logic":"AND","indicators":[{"type":"rsi","params":{...}},{"type":"bb"}]}`
for confluence entries. Caution: in a one-sided downtrend RSI keeps triggering — apply the
Strong-Trend gate first.

## 3. Neutral Grid

When: ranging market, BB bandwidth 4–8%, no strong bias.

```bash
kitsune call strategy_create --args '{"vault":"0x..","baseToken":"<WPROS>","quoteToken":"<USDC>","allowedExecutor":"<from executor_list>","takeProfitBps":500,"stopLossBps":2000,"maxDcaCount":1,"maxTradesPerDay":20,"active":true,"firstBuyAmount":"15000000","maxPositionSize":"200000000","dcaMultiplier":"10000"}'
# grid buys are flat: 15 USDC per zone; maxPositionSize caps total exposure at 200 USDC
kitsune call strategy_set_config --args '{"vault":"0x..","strategyId":"<id>","strategyType":"grid","gridLowerPrice":0.62,"gridUpperPrice":0.82,"gridCount":12,"gridType":"arithmetic"}'
kitsune call strategy_set_metadata --args '{"vault":"0x..","strategyId":"<id>","name":"WPROS neutral grid 0.62-0.82"}'
```

Bounds/count are market-dependent — ALWAYS re-derive from parameter-bands (range must straddle
the current price; per-cell profit > round-trip cost). `maxTradesPerDay` high: grids trade often.

## 4. Trend-Biased Grid

When: Trend Score ≥ +1.5 (bullish). Asymmetric range — price in the lower 30–40% — plus an
indicator gate so the grid starts on momentum confirmation, and a trailing TP to ride the trend.

```bash
kitsune call strategy_create --args '{"vault":"0x..","baseToken":"<WPROS>","quoteToken":"<USDC>","allowedExecutor":"<from executor_list>","takeProfitBps":1000,"stopLossBps":1500,"maxDcaCount":1,"maxTradesPerDay":20,"active":true,"firstBuyAmount":"15000000","maxPositionSize":"200000000","dcaMultiplier":"10000"}'
kitsune call strategy_set_config --args '{"vault":"0x..","strategyId":"<id>","strategyType":"grid","gridLowerPrice":0.68,"gridUpperPrice":0.86,"gridCount":10,"gridType":"geometric","gridStartCondition":"instant","entryType":"ema","emaFastPeriod":20,"emaSlowPeriod":50,"emaTimeframe":"1h","trailingTpEnabled":true,"trailingTpCallbackPercent":2}'
kitsune call strategy_set_metadata --args '{"vault":"0x..","strategyId":"<id>","name":"WPROS trend grid (long bias)"}'
```

Rebalance rule: if trend flips (EMA cross against bias) or price pins the top/bottom 10% of the
range — propose new bounds + `strategy_restart_cycle`, or `strategy_pause`.

## 5. Recurring Buy (schedule, not signals)

When: "buy X every day/week", accumulation plans.

```bash
kitsune call strategy_create --args '{"vault":"0x..","baseToken":"<WPROS>","quoteToken":"<USDC>","allowedExecutor":"<from executor_list>","takeProfitBps":2000,"stopLossBps":5000,"maxDcaCount":30,"maxTradesPerDay":2,"active":true,"firstBuyAmount":"10000000","maxPositionSize":"300000000","dcaMultiplier":"10000"}'
kitsune call strategy_set_config --args '{"vault":"0x..","strategyId":"<id>","strategyType":"recurring","recurringInterval":"daily","recurringAmount":"10000000","recurringTotalInvestment":"300000000"}'
kitsune call strategy_set_metadata --args '{"vault":"0x..","strategyId":"<id>","name":"WPROS daily accumulator"}'
```

Wide TP/SL: a scheduled accumulator shouldn't exit on noise. `maxDcaCount` ≥ planned number of
buys; multiplier "10000" (flat size).

## Defensive overrides (Strong Trend, user insisted)

Apply on top of any preset: `firstBuyAmount` → ≤5% of budget · `priceStepPercent` → ≥1.5×ATR% ·
`priceStepMultiplier` → ≥1.3 · `dcaMultiplier` → "10000"–"11000" · re-run the spend simulation.
State clearly: "This is a defensive configuration; later buys may not fill if the trend continues."
