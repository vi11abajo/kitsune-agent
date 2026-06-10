# Parameter Bands & Market Classification

Use this file in **recommend** mode, after the Recommendation Gate passed. All numbers are
starting bands, not automatic outputs — always run the Validation Checklist at the end.

## Data Collection

```bash
kitsune market price WPROS USDC                          # current price + 24h stats
kitsune market indicators WPROS USDC                     # RSI / MACD / EMA / Bollinger
kitsune market candles WPROS USDC --interval 1h --limit 60   # raw OHLCV for ATR & structure
```

Work on 1h candles by default; use 4h for slower pairs or when the user says "long-term".

## Volatility — ATR% (compute from candles; not in the indicators API)

```
TR_i  = max(high_i - low_i, |high_i - prevClose|, |low_i - prevClose|)
ATR   = average(TR over last 14 candles)
ATR%  = ATR / currentPrice × 100
```

Volatility regime: compare current ATR% with its 20-candle average — `Low` < 0.9×avg,
`Normal` 0.9–1.2×avg, `High` > 1.2×avg.

## Market State (EMA + closes; deterministic)

Using the EMA from `market_get_indicators` (fast EMA) and the last 5 closes:

- **Strong Trend** — EMA clearly rising or falling; price on the same side of it; ≥4 of the last
  5 closes on that side; price ≥ 1×ATR away from the EMA.
- **Mild Trend** — same direction signals but ≥3 of 5 closes and price < 1×ATR from the EMA.
- **Range** — anything else.

## Trend Score (for grid direction / bias)

| Signal | Bullish | Bearish |
|---|---|---|
| EMA fast vs slow | fast > slow: **+1** | fast < slow: **−1** |
| MACD histogram | > 0: **+1** | < 0: **−1** |
| RSI | 40–65: **+0.5** | 35–60 in downtrend: **−0.5**; >75 or <25 (overheated): **−0.5** to the side in profit |

Score ≥ +1.5 → bullish bias · ≤ −1.5 → bearish bias · else → neutral.

## Structure (anchor, last 20 closed candles)

- Buying strategies (DCA, grid): nearest swing low below current price; fallback — lowest low of
  the 20 candles. Safety buys should land near it, not in empty air far below.

## Cost Floor (replaces CEX fee floors)

A round trip on Kitsune = two DODO swaps + protocol fees. Estimate the real cost: quote a route
with `market_get_dodo_route` and compare against mid-price; call the round-trip cost `RT%`
(typically well under 1%, but VERIFY — never assume).

```
takeProfit floor:   takeProfitBps ≥ max(ATR% × 0.3, RT% × 2) × 100
grid spacing floor: spacing% ≥ max(0.5%, RT% × 3)
```

A grid whose per-cell profit is below round-trip cost grinds money into fees.

## DCA Bands (Kitsune field names)

| Field | Range market | Mild Trend | Strong Trend (forced, defensive) |
|---|---|---|---|
| `priceStepPercent` | 0.9–1.1 × ATR% | 1.05–1.25 × ATR% | ≥ 1.5 × ATR% |
| `priceStepMultiplier` | 1.05–1.20 | 1.15–1.35 | 1.30+ |
| `dcaMultiplier` (bps) | "11500"–"13500" | "10500"–"12000" | "10000"–"11000" |
| `firstBuyAmount` (% of budget) | 12–18% strong entry / 8–12% neutral | 5–8% | ≤5% |
| `takeProfitBps` | ≈ ATR% (×100), floor above | 1.0–1.4 × ATR% | wider |
| `stopLossBps` | beyond total DCA coverage depth | same | same |

**`maxDcaCount` is derived LAST, by simulation** (choosing a count first invites
over-allocation):

1. Draft step, multipliers and amounts above.
2. Accumulate buys: `spend_i = firstBuyAmount × (dcaMultiplier/10000)^i`, price depth
   `Σ priceStepPercent × priceStepMultiplier^i`.
3. Stop when cumulative spend reaches the budget OR depth passes the structure anchor.
4. That count = `maxDcaCount`; set `maxPositionSize` ≥ cumulative spend (the contract enforces
   exactly this and reverts otherwise).

## Grid Bands

Range from Bollinger (1h) with bias from Trend Score:

```
neutral:  lower = BB_lower × 0.99,  upper = BB_upper × 1.01   (price near mid)
bullish:  lower = max(swing_low, BB_lower) × 0.995, upper = BB_upper × 1.02
          (price should sit in the lower 30–40% of the range)
bearish bias on a long-only venue → prefer NOT creating; suggest waiting or reverse/defensive
```

Validate width: `(upper − lower)/lower × 100` must be 5–15%. Outside → re-derive or confirm
with the user.

Grid count from volatility (respect the spacing floor):

```
target spacing: BB bandwidth > 8% → 1.5–2.5% · 4–8% → 1.0–1.5% · < 4% → 0.6–1.0%
gridCount = clamp(round(width% / spacing%), 2, 500)
BB bandwidth = (BB_upper − BB_lower) / BB_middle × 100
```

Per-zone size: `firstBuyAmount = budget_for_grid / number_of_buy_zones` (grid buys are flat —
`dcaMultiplier` is ignored by grid, set it "10000"; `maxDcaCount` is ignored too, set 1+).
`gridType`: `arithmetic` default; `geometric` for wide ranges (>10%).

## Risk Tiers (present all three, user picks)

| Tier | takeProfitBps | stopLossBps | maxDcaCount | dcaMultiplier | budget share per strategy |
|---|---|---|---|---|---|
| Conservative | 300–500 | 1000 | 2–3 | "10000"–"11500" | ≤ 15% of vault quote balance |
| Balanced | 500–800 | 1500 | 3–5 | "11500"–"13500" | ≤ 30% |
| Aggressive | 800–1500 | 2000–2500 | 5–8 | "13500"–"20000" | ≤ 50%, warn explicitly |

Never put more than the tier's budget share into one strategy; keep reserve for rebalancing.

## Validation Checklist

1. Cumulative DCA spend ≤ `maxPositionSize` (contract-enforced — pre-check it).
2. Cumulative spend ≤ vault quote balance (else report shortfall; never auto-deposit).
3. Final DCA depth lands near structure, not far beyond it.
4. Grid: range straddles current price; spacing ≥ floor; per-cell profit > round-trip cost.
5. `takeProfitBps` above the cost floor; `stopLossBps` < 10000.
6. Setup still matches the user's stated risk tolerance.

Fails → adjust: coverage too shallow → raise `maxDcaCount` or `priceStepMultiplier`; fills too
easily → widen `priceStepPercent`; capital too heavy → lower `dcaMultiplier` or `maxDcaCount`.

## Strong-Trend Warning Template

> This market is in a strong one-sided move. DCA / neutral grids here tend to fill safety buys
> into continued pressure. Better: wait for a range or a clean reaction at support. If you still
> want to proceed, say so explicitly and I will switch to a defensive configuration (smaller
> first buy, wider step, multiplier ≤ ×1.1).
