# Head Trader - 2026-11-08

> Weekly supervisor review of the paper-trading desk (day-trader skill). Practice money only. Not investment advice.

## Summary
The desk executed textbook relative-strength stock selection but committed a critical risk violation by sitting in positions with no defined stops.

## Strengths
- **Rule compliance on sizing:** Sized each position at exactly 20% of budget, capping total stock exposure at the 40% configuration ceiling.
- **Trend alignment:** Targeted relative strength (COST +12.16% 20-day return) rather than catching falling knives in beaten-down tech (GOOGL, NVDA).

## Weaknesses / Leaks
- **No hard stops attached:**
  - *What happened:* Both AMZN and COST show `stop: null`. The agents cited vague exits ("loss of 20-day/50-day moving averages") without concrete price levels.
  - *What should have happened:* Every entry must have a hard numerical stop at or tighter than the 8% default stop parameter upon fill. Hope is not a risk plan.
- **Maxing equity allocation instantly:** Deployed 100% of the allowed 40% stock capacity on day one during a broad market pullback, eliminating tactical flexibility.
- **Edge validation:** Two days and two trades provide insufficient history to evaluate live edge. However, the benchmark backtest lags SPY by 11.66% (+17.04% vs. +28.70%) with a 17.36% drawdown, signaling the momentum filter lacks alpha in choppy regimes.

## Specific Fixes
- **Enforce stop enforcement in Execution:** In the execution code, block any order submission that lacks an associated stop level, or automatically inject `defaultStopPct: 8` into the order record upon fill.
- **Tighten CIO entry prompt:** Add: *"You must output an explicit invalidation price for every buy order. Discretionary moving average phrases are invalid."*

## Priority
1. Assign explicit stop-loss levels to AMZN and COST immediately (tighten to the 50-day SMA or the maximum 8% threshold).
2. Take no new stock trades next week; the desk is at its 40% maximum stock ceiling.
3. Require the Risk Manager to reject any trade recommendation lacking a numerical stop price.
