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

## Cost Floor — grid break-even (use `market_get_grid_cost`)

A round trip on Kitsune = two DODO swaps + protocol fees, and the engine's decision price can
diverge from the pool. Get the real round-trip cost `C` with `market_get_grid_cost` (pass the pair's
token ADDRESSES + grid `upper`/`lower`/`gridCount`/`gridType`); it returns `costPct`, a `source`
badge (`measured`|`default`), and `recommendedMaxZones` / `recommendedMinStepPct`.

A grid is profitable only when each cycle's gross step beats `C`:

```
perZoneStep% = arithmetic: (upper − lower)/gridCount/upper × 100   (worst cycle, top of range)
               geometric:  ((upper/lower)^(1/gridCount) − 1) × 100
netPerCycle% = perZoneStep% − costPct
```

- `netPerCycle% ≤ 0` → **HARD STOP**: do NOT call `strategy_create`. Reduce `gridCount` to
  `recommendedMaxZones` (or widen the range) until `netPerCycle% > 0`. The backend reconfigure gate
  and the create UI enforce the same floor server-side.
- `0 < netPerCycle% < 0.5%` → thin margin: warn the user; proceed only on explicit OK.
- A `source:"default"` cost is advisory (no measured history yet) — don't over-refuse wide grids.

For `takeProfit` on DCA/recurring, still keep `takeProfitBps ≥ max(ATR% × 0.3, costPct × 2) × 100`.
(If `market_get_grid_cost` is unavailable, fall back to a `market_get_dodo_route` mid-vs-quote
estimate of the round-trip cost — but prefer the tool.)

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

Then clamp `gridCount ≤ recommendedMaxZones` (from `market_get_grid_cost`) so every cycle clears
cost — see the Cost Floor section.

Per-zone size: `firstBuyAmount = budget_for_grid / gridCount` (grid buys are flat — set
`dcaMultiplier` "10000"; the multiplier is genuinely ignored by grid sizing). **`maxDcaCount`
is NOT ignored: set it = `gridCount`.** The vault opens one buy per filled zone and caps
concurrent buys at `maxDcaCount`, so anything lower (e.g. 1) reverts `MaxDCACountReached` once
that many zones fill. Ensure `maxPositionSize ≥ firstBuyAmount × gridCount`. (`maxDcaCount` is
`uint8` ≤ 255 — keep grids ≤ ~50 zones.)
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
4. Grid: range straddles current price; `netPerCycle%` (per-zone step% − `costPct` from `market_get_grid_cost`) > 0 — else HARD STOP, reduce `gridCount` to `recommendedMaxZones`.
5. `takeProfitBps` above the cost floor; `stopLossBps` < 10000.
6. Setup still matches the user's stated risk tolerance.

Fails → adjust: coverage too shallow → raise `maxDcaCount` or `priceStepMultiplier`; fills too
easily → widen `priceStepPercent`; capital too heavy → lower `dcaMultiplier` or `maxDcaCount`.

## Strong-Trend Warning Template

> This market is in a strong one-sided move. DCA / neutral grids here tend to fill safety buys
> into continued pressure. Better: wait for a range or a clean reaction at support. If you still
> want to proceed, say so explicitly and I will switch to a defensive configuration (smaller
> first buy, wider step, multiplier ≤ ×1.1).
