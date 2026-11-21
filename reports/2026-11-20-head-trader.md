# Head Trader - 2026-11-20

> Weekly supervisor review of the paper-trading desk (day-trader skill). Practice money only. Not investment advice.

**## Summary**  
Desk is marginally down ‑0.32% since 9 Nov while SPY is ‑8.24%; position sizing is at the stock ceiling and stops are still vague.

**## Strengths**  
- **Risk‑adjusted outperformance:** Even with a flat‑lined P&L the desk has beaten the benchmark by ~8 pts, showing the core momentum filter still adds value.  
- **Position sizing compliance:** No trade exceeded the 10 % per‑trade cap; total stock exposure stayed at the 40 % limit.  
- **Consistent monitoring:** Daily reports include explicit “exit if falls X% more” notes, indicating the team is tracking stop proximity.

**## Weaknesses / Leaks**  
1. **Undefined stop levels:** Both AMZN and COST still run on “default 8 % stop (bought before stops existed)”. The actual stop price is not locked; the “exit if falls X% more” is a *soft* rule that can be ignored.  
2. **No stop tightening after adverse move:** AMZN is now ‑5.5 % overall, yet the stop remains 8 % from entry (effectively a 2.6 % buffer). The stop should have been moved to the 50‑day SMA or a tighter % once the trade moved against us.  
3. **Stagnant trade flow:** No new entries for a week, but the desk is sitting at the max 40 % stock allocation, leaving capital idle and exposing the portfolio to concentration risk.  
4. **Risk‑of‑ruin not enforced:** MaxLossUsd is $5 (10 % of budget) but the combined unrealized loss on AMZN (+‑5.5 %) already exceeds that threshold in equity terms, yet no exit was triggered.  

**## Specific Fixes**  
- **trading.json → “defaultStopPct”**: Change from 8 % to **5 %** for all new entries; enforce immediate stop placement at order time.  
- **Add rule “stopTightenPct”: 2** – if a position moves >2 % against entry, automatically move stop to the higher of the original stop or the 50‑day SMA.  
- **Risk Manager prompt**: Reject any recommendation lacking a numeric stop price *and* a “stopTightenPct” clause.  
- **Portfolio allocation rule**: Reduce “maxStockPct” from 40 % to **30 %**; any excess equity must be held in cash or low‑beta ETFs until a valid signal appears.  
- **Loss‑cut rule**: If unrealized loss on a single position exceeds **5 %** of budget, trigger immediate market order to close.

**## Priority**  
1. **Implement and enforce the 5 % stop rule with automatic tightening** (stopTightenPct) before the next trade.  
2. **Lower maxStockPct to 30 %** to free capital and avoid concentration.  
3. **Require numeric stop prices in every recommendation**; have Risk Manager auto‑reject non‑compliant signals.
