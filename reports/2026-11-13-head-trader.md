# Head Trader - 2026-11-13

> Weekly supervisor review of the paper-trading desk (day-trader skill). Practice money only. Not investment advice.

**## Summary**  
Desk is modestly up (+1.01%) but still running two undifferentiated positions with default stops that are not tied to current price action – a clear process breach.

**## Strengths**  
- Quick deployment of capital to high‑momentum, above‑MA stocks (AMZN, COST).  
- Position sizing respects the 20 % per‑trade limit and stays under the 40 % stock‑allocation ceiling.  
- Daily reporting is consistent and includes basic macro context.

**## Weaknesses / Leaks**  
1. **Stop‑loss discipline** – Both positions still use the “default 8 %” stop set on entry day, despite the prior priority to tighten to the 50‑day SMA or a tighter %‑based stop. The “exit if it falls X % more” wording shows the stop is being treated as a *future* rule rather than an active order.  
2. **Risk‑to‑reward clarity** – No R‑multiple or profit‑target was defined; the trade is effectively “buy and hope it stays up.” This leaks edge and makes the trade a pure speculation.  
3. **Regime awareness** – Macro read notes a hawkish Fed and a still‑inverted yield curve, yet the desk kept the two large‑cap tech positions without any hedge or sector‑rotation filter.  
4. **Process adherence** – The previous directive to “take no new stock trades next week” was obeyed, but the risk manager never enforced the “reject any recommendation lacking a numerical stop” rule – the stops were never updated.  

**## Specific Fixes**  
- **trading.json → stopPolicy**: set `"defaultStopPct": 5` and add `"stopMethod":"priceBelow50DMA"` so that on entry the system automatically places a stop at the lower of 5 % or the 50‑day SMA price.  
- **riskManager.prompt**: prepend “Provide explicit stop price (price or % below entry) for every recommendation; reject if missing.”  
- **executionEngine**: enable `"autoStopEnforce": true` to convert the stop definition into a live stop‑order immediately after fill.  
- **strategy.json → profitTargetPct**: add `"profitTargetPct": 12` to give each trade a clear exit on the upside, enabling R‑multiple calculation.  
- **macroFilter.json**: add `"maxTechExposurePct":30` when `"10yMinus2ySpread"<0.3` to automatically reduce tech allocation in inverted‑curve regimes.

**## Priority**  
1. **Implement live stop‑order enforcement** (stopPolicy & autoStopEnforce) – eliminates the “default stop” loophole.  
2. **Add mandatory profit‑target rule** (profitTargetPct) – forces a disciplined exit and lets the desk measure expectancy.  
3. **Activate macro‑regime tech‑exposure filter** – protects capital when the yield curve remains inverted and Fed policy is uncertain.
