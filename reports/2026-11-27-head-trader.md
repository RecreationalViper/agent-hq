# Head Trader - 2026-11-27

> Weekly supervisor review of the paper-trading desk (day-trader skill). Practice money only. Not investment advice.

**## Summary**  
The desk is marginally up (+0.18 %) while the SPY benchmark is down (‑3.17 %); however, both positions sit on loose, pre‑existing stops and the stock‑allocation ceiling is maxed out.

**## Strengths**  
- **Regime awareness:** The desk correctly avoided new entries while the 40 % stock cap was reached, limiting further exposure.  
- **Relative performance:** Even with a modest portfolio, the desk outperformed the benchmark each day.  
- **Position sizing:** Each stock remains at ~20 % of the budget, respecting the maxStockPct (40 %) and maxRiskPct (2 %) limits.

**## Weaknesses / Leaks**  
- **Stop‑loss discipline:** AMZN’s stop has drifted from the original 8 % to a “default” that now allows an additional 5 %‑6 % loss before exit. COST’s stop is similarly vague, leaving >10 % downside exposure. This violates the rule that stops must be set **before** entry and be no wider than maxStopPct (15 %) but preferably at the configured defaultStopPct (8 %).  
- **No explicit invalidation:** Both positions still reference “default 8 % stop (bought before stops existed)”, meaning the invalidation level was never defined. Without a hard invalidation, the desk risks riding a losing trade past the risk budget.  
- **Risk budget leakage:** The desk’s maxLossUsd = 5 % of budget translates to a 10 % equity drawdown on a $50 account. AMZN is already down ~‑6 % (budget‑weighted) and could breach the daily loss limit if the stop isn’t tightened.  
- **Stagnant process:** No trades have been taken for a week, which is fine given the cap, but the system isn’t generating fresh signals to replace deteriorating legs. The momentum backtest shows a 45 % win rate with a 20 % max drawdown—acceptable only if stops are enforced.

**## Specific Fixes**  
1. **trading.json – stopPct**: Set `defaultStopPct` to **8** (already) and add `"enforceStopBeforeEntry": true`.  
2. **trading.json – explicitStops**: For existing positions, inject a rule to **re‑calculate stop price** on the next market open using the tighter of (a) 8 % of entry price, (b) 50‑day SMA price. Example entry: `"stopRule": "min(entry*0.92, SMA50)"`.  
3. **riskManager.prompt**: Require every recommendation to include `"stopPrice": <numeric>` and reject any suggestion lacking it.  
4. **positionManagement.prompt**: Add a clause: “If current unrealized loss > 5 % of position size, trigger immediate exit regardless of stop level.”  

**## Priority**  
1. **Enforce explicit stop prices** on AMZN and COST today (apply the 8 %/50‑day SMA rule).  
2. **Update the Risk Manager prompt** to reject any trade lacking a numeric stop before the next trading day.  
3. **Add the automatic‑exit‑on‑5 %‑loss rule** to the position‑management prompt to protect the daily loss budget.
