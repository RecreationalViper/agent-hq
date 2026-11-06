// Backtest Analyst - tests the desk's mechanical momentum rule on ~2 years of real Alpaca history.
// Follows the alpaca-trading-backtest skill (skills/alpaca/backtest): decide on day t's close using only
// past data, fill at day t+1's open, model slippage, compare with SPY, report the "Teaching Five",
// and save reproducible artifacts with a data fingerprint.
import fs from "node:fs/promises";
import crypto from "node:crypto";

const DATA = process.env.ALPACA_DATA_BASE || "https://data.alpaca.markets";
const AK = process.env.ALPACA_KEY, AS = process.env.ALPACA_SECRET;
const SLIPPAGE = 0.0005; // 5 bps per side (Alpaca stock commissions are $0; tiny regulatory sell fees are not modeled)
const TOP_N = 5, MAX_STOCKS = 2, EVERY = 5, WARMUP = 50, DAYS = 760;
const pct = (x) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}%`;
const readJson = async (p, f) => { try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return f; } };

async function get(path) {
  const res = await fetch(DATA + path, { signal: AbortSignal.timeout(60000), headers: { "APCA-API-KEY-ID": AK, "APCA-API-SECRET-KEY": AS } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Alpaca ${res.status}: ${data.message || "request failed"}`);
  return data;
}

function score(c, i) {
  if (i < WARMUP) return null;
  const last = c[i], avg = (n) => c.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n;
  const sma20 = avg(20), sma50 = avg(50), r20 = last / c[i - 20] - 1, r5 = last / c[i - 5] - 1;
  let g = 0, l = 0;
  for (let k = i - 13; k <= i; k++) { const d = c[k] - c[k - 1]; d > 0 ? (g += d) : (l -= d); }
  const rsi = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  return { score: r20 * 0.6 + r5 * 0.4 + ((last > sma20) + (last > sma50)) * 0.01 - (rsi > 75 ? 0.02 : 0), ok: last > sma50 };
}

function stats(equity) {
  const rets = equity.slice(1).map((e, k) => e / equity[k] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length);
  let peak = equity[0], dd = 0;
  for (const e of equity) { peak = Math.max(peak, e); dd = Math.min(dd, e / peak - 1); }
  const total = equity.at(-1) / equity[0] - 1;
  return { total, annual: (1 + total) ** (252 / rets.length) - 1, maxDrawdown: dd, sharpe: sd ? (mean / sd) * Math.sqrt(252) : 0 };
}

async function main() {
  if (!AK || !AS) throw new Error("Missing ALPACA_KEY or ALPACA_SECRET secret.");
  const cfg = await readJson("trading.json", null);
  const classOf = {};
  for (const [cls, syms] of Object.entries(cfg.universe)) for (const s of syms) classOf[s] = cls;
  const syms = Object.keys(classOf);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const start = new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10);

  // Data: all pages, fingerprinted
  const bars = {};
  let token = "", pages = 0;
  do {
    const r = await get(`/v2/stocks/bars?symbols=${encodeURIComponent(syms.join(","))}&timeframe=1Day&start=${start}&limit=10000&feed=iex&adjustment=all${token ? "&page_token=" + token : ""}`);
    for (const [s, b] of Object.entries(r.bars || {})) (bars[s] ||= []).push(...b);
    token = r.next_page_token || ""; pages++;
  } while (token);
  if (!bars.SPY?.length) throw new Error("No SPY history came back.");
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify(syms.map((s) => [s, (bars[s] || []).map((b) => [b.t, b.o, b.c])]))).digest("hex");

  // Align every symbol to SPY's trading calendar
  const days = bars.SPY.map((b) => b.t.slice(0, 10));
  const px = {};
  for (const s of syms) {
    const m = new Map((bars[s] || []).map((b) => [b.t.slice(0, 10), b]));
    let lastC = null;
    px[s] = days.map((d) => { const b = m.get(d); if (b) lastC = b.c; return { o: b ? b.o : null, c: lastC }; });
  }

  // Simulation (starts with $50, like the desk)
  let cash = 50;
  const shares = {}, entry = {}, trades = [], roundTrips = [], equity = [], bench = [];
  let benchShares = 0;
  const valueAt = (i, f) => cash + Object.entries(shares).reduce((a, [s, q]) => a + q * (px[s][i][f] ?? px[s][i].c ?? 0), 0);
  for (let i = WARMUP; i < days.length; i++) {
    // Execute yesterday's decision at today's open
    if (i > WARMUP && (i - 1 - WARMUP) % EVERY === 0) {
      const d = i - 1;
      const ranked = syms.map((s) => {
        const c = px[s].slice(0, d + 1).map((x) => x.c);
        return c.includes(null) || c.length <= WARMUP ? null : { s, ...score(c, d) };
      }).filter((x) => x && x.ok && x.score > 0).sort((a, b) => b.score - a.score);
      const pick = [];
      for (const x of ranked) {
        if (pick.length >= TOP_N) break;
        if (classOf[x.s] === "Stocks" && pick.filter((p) => classOf[p] === "Stocks").length >= MAX_STOCKS) continue;
        if (px[x.s][i].o) pick.push(x.s);
      }
      for (const s of Object.keys(shares)) if (!pick.includes(s) && px[s][i].o) {
        const proceeds = shares[s] * px[s][i].o * (1 - SLIPPAGE);
        cash += proceeds;
        roundTrips.push({ symbol: s, entered: entry[s].date, exited: days[i], ret: proceeds / entry[s].cost - 1 });
        trades.push({ date: days[i], symbol: s, side: "sell", usd: +proceeds.toFixed(2) });
        delete shares[s]; delete entry[s];
      }
      const slot = valueAt(i, "o") / TOP_N;
      for (const s of pick) if (!shares[s]) {
        const usd = Math.min(cash, slot);
        if (usd < 1) continue;
        cash -= usd;
        shares[s] = (usd * (1 - SLIPPAGE)) / px[s][i].o;
        entry[s] = { date: days[i], cost: usd };
        trades.push({ date: days[i], symbol: s, side: "buy", usd: +usd.toFixed(2) });
      }
    }
    if (i === WARMUP + 1) benchShares = 50 / px.SPY[i].o;
    if (i > WARMUP) { equity.push(valueAt(i, "c")); bench.push(benchShares * px.SPY[i].c); }
  }

  const st = stats(equity), sb = stats(bench);
  const wins = roundTrips.filter((r) => r.ret > 0), losses = roundTrips.filter((r) => r.ret <= 0);
  const gross = (a) => a.reduce((x, r) => x + Math.abs(r.ret), 0);
  const summary = {
    date, period: { from: days[WARMUP + 1], to: days.at(-1), tradingDays: equity.length },
    strategy: `Every ${EVERY} trading days, hold the top ${TOP_N} assets by momentum score (0.6×20-day + 0.4×5-day return, trend bonus, RSI>75 penalty) that are above their 50-day average; max ${MAX_STOCKS} single stocks; equal slots; the rest in cash.`,
    strategyResult: st, benchmarkSPY: sb, trades: trades.length, roundTrips: roundTrips.length,
    winRate: roundTrips.length ? wins.length / roundTrips.length : null, profitFactor: gross(losses) ? gross(wins) / gross(losses) : null,
    assumptions: { start: "$50", fills: "next day's open", slippage: "5 bps per side", fees: "$0 commissions; regulatory sell fees not modeled", data: "Alpaca IEX daily bars, split+dividend adjusted" },
    data: { symbols: syms.length, pages, sha256: fingerprint }
  };
  await fs.mkdir("trading/backtest", { recursive: true });
  await fs.writeFile("trading/backtest/summary.json", JSON.stringify(summary, null, 2) + "\n");
  await fs.writeFile("trading/backtest/equity.csv", "date,strategy,spy\n" + equity.map((e, k) => `${days[WARMUP + 1 + k]},${e.toFixed(4)},${bench[k].toFixed(4)}`).join("\n") + "\n");
  await fs.writeFile("trading/backtest/trades.csv", "date,symbol,side,usd\n" + trades.map((t) => `${t.date},${t.symbol},${t.side},${t.usd}`).join("\n") + "\n");

  const beat = st.total >= sb.total;
  const report = [`# Backtest Analyst - ${date}`, "",
    `> Hypothetical historical simulation, not actual trading. Backtested results do not guarantee future results and depend on data quality, fees, slippage and other assumptions. Not investment advice. See [Alpaca disclosures](https://alpaca.markets/disclosures).`, "",
    `## The Teaching Five (${summary.period.from} to ${summary.period.to})`,
    `1. **Total return:** ${pct(st.total)} vs SPY ${pct(sb.total)} → ${beat ? "**beat SPY**" : "**trailed SPY**"}`,
    `2. **Worst drop (max drawdown):** ${pct(st.maxDrawdown)} vs SPY ${pct(sb.maxDrawdown)}`,
    `3. **Trades:** ${trades.length} (${roundTrips.length} completed round trips)`,
    `4. **Win rate:** ${summary.winRate == null ? "n/a" : (summary.winRate * 100).toFixed(0) + "%"}`,
    `5. **Sharpe ratio (return per unit of risk):** ${st.sharpe.toFixed(2)} vs SPY ${sb.sharpe.toFixed(2)}`, "",
    `## Also`, `- Per year: ${pct(st.annual)} vs SPY ${pct(sb.annual)}`, `- Profit factor: ${summary.profitFactor == null ? "n/a" : summary.profitFactor.toFixed(2)}`,
    `- First trade: ${trades[0] ? `${trades[0].date} ${trades[0].side} ${trades[0].symbol}` : "none"}`, `- Last trade: ${trades.at(-1) ? `${trades.at(-1).date} ${trades.at(-1).side} ${trades.at(-1).symbol}` : "none"}`, "",
    `## What was tested`, summary.strategy, "",
    `## Assumptions & caveats`, ...Object.entries(summary.assumptions).map(([k, v]) => `- ${k}: ${v}`),
    `- Tests only the desk's mechanical momentum rule. The AI analysts' judgment can't be backtested.`, `- IEX data covers part of market volume; prices can differ slightly from the full market feed.`, "",
    `Data fingerprint: ${fingerprint.slice(0, 16)}… (${syms.length} symbols, ${pages} page(s)). Files: trading/backtest/`];
  const file = `${date}-backtest.md`;
  await fs.mkdir("reports", { recursive: true });
  await fs.writeFile(`reports/${file}`, report.join("\n") + "\n");
  const index = await readJson("reports/index.json", []);
  await fs.writeFile("reports/index.json", JSON.stringify([{ file, agent: "backtest", name: "Backtest Analyst", date }, ...index.filter((r) => r.file !== file)].slice(0, 300), null, 2) + "\n");
  console.log(`Backtest: ${pct(st.total)} vs SPY ${pct(sb.total)}, ${trades.length} trades. Saved reports/${file}`);
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
