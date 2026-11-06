// Agent HQ Trading Desk - runs on GitHub Actions, practice (paper) money on Alpaca.
// AI agents research and propose; plain code enforces every safety limit and places orders.
import fs from "node:fs/promises";

const GEMINI = process.env.API_BASE || "https://generativelanguage.googleapis.com/v1beta";
const ALPACA_DATA = process.env.ALPACA_DATA_BASE || "https://data.alpaca.markets";
const KEY = process.env.GEMINI_API_KEY;
const AK = process.env.ALPACA_KEY, AS = process.env.ALPACA_SECRET;
const ACTION = (process.env.DESK_ACTION || "run").trim();
const TZ = "America/New_York";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readJson = async (p, f) => { try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return f; } };
const writeJson = (p, v) => fs.writeFile(p, JSON.stringify(v, null, 2) + "\n");
const pct = (x) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}%`;

function today() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return p; // YYYY-MM-DD
}

// ---------- Alpaca ----------
async function alpaca(base, path, init = {}) {
  const res = await fetch(base + path, { ...init, signal: AbortSignal.timeout(30000), headers: { "APCA-API-KEY-ID": AK, "APCA-API-SECRET-KEY": AS, "Content-Type": "application/json", ...(init.headers || {}) } });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!res.ok) throw new Error(`Alpaca ${res.status} on ${path}: ${data.message || text}`);
  return data;
}

// ---------- Gemini (same model picking as the agent runner) ----------
async function gemini(path, init = {}) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res;
    try { res = await fetch(GEMINI + path, { ...init, signal: AbortSignal.timeout(120000), headers: { "Content-Type": "application/json", "x-goog-api-key": KEY } }); }
    catch { if (attempt < 2) continue; throw new Error("BUSY: no answer"); }
    if ((res.status === 429 || res.status === 503) && attempt < 2) { await sleep(20000); continue; }
    const data = await res.json().catch(() => ({}));
    if (res.status === 429 || res.status === 503) throw new Error("BUSY: " + (data?.error?.message || res.status));
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return data;
  }
}
const ver = (n) => { const m = n.match(/gemini-(\d+(?:\.\d+)?)/i); return m ? parseFloat(m[1]) : 0; };
let models = [];
async function pickModels() {
  const { models: list = [] } = await gemini("/models?pageSize=200");
  const rank = (n) => (/flash/i.test(n) ? 0 : 2) + (/lite|preview|exp/i.test(n) ? 1 : 0);
  models = list.filter((m) => (m.supportedGenerationMethods || []).includes("generateContent") && /gemini/i.test(m.name) && !/image|tts|audio|live|embed/i.test(m.name))
    .map((m) => m.name).sort((a, b) => rank(a) - rank(b) || ver(b) - ver(a));
  if (!models.length) throw new Error("No Gemini model available.");
}
async function ask(role, prompt, json = false) {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: `You are the ${role} on a small AI multi-asset trading desk (a mini Wall Street firm) managing a $50 practice account (paper money) on Alpaca. Be careful, plain-spoken and brief. You cannot see anything beyond the data given. Never promise returns.` }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, ...(json ? { responseMimeType: "application/json" } : {}) }
  });
  let lastErr;
  for (let round = 0; round < 3; round++) {
    if (round) { console.log("  all models busy, waiting 60s..."); await sleep(60000); }
    for (const m of models.slice(0, 6)) {
      try {
        const data = await gemini(`/${m}:generateContent`, { method: "POST", body });
        models = [m, ...models.filter((x) => x !== m)];
        const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
        if (!text) throw new Error("empty reply");
        return json ? JSON.parse(text.replace(/^```(?:json)?|```$/g, "")) : text;
      } catch (e) {
        lastErr = e;
        if (/no longer|retired|not found|not supported|deprecated/i.test(e.message)) { models = models.filter((x) => x !== m); continue; }
        if (/BUSY|empty|JSON|Unexpected/i.test(e.message)) continue;
        throw e;
      }
    }
  }
  throw lastErr;
}

// ---------- Indicators (computed in code, not by the AI) ----------
function indicators(bars) {
  const c = bars.map((b) => b.c);
  const last = c.at(-1);
  const sma = (n) => c.length >= n ? c.slice(-n).reduce((a, b) => a + b, 0) / n : null;
  const ret = (n) => c.length > n ? last / c.at(-1 - n) - 1 : null;
  let g = 0, l = 0;
  for (let i = Math.max(1, c.length - 14); i < c.length; i++) { const d = c[i] - c[i - 1]; d > 0 ? (g += d) : (l -= d); }
  const rsi = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  const r = (x) => (x == null ? null : +x.toFixed(4));
  return { price: r(last), ret1d: r(ret(1)), ret5d: r(ret(5)), ret20d: r(ret(20)), sma20: r(sma(20)), sma50: r(sma(50)), rsi14: +rsi.toFixed(1) };
}

const money = (x) => +Number(x).toFixed(2);

async function main() {
  const cfg = await readJson("trading.json", null);
  if (!cfg) throw new Error("trading.json is missing.");
  const state = await readJson("trading/state.json", { realizedUsd: 0, log: [] });
  const date = today();

  if (ACTION === "pause" || ACTION === "resume") {
    cfg.paused = ACTION === "pause";
    await writeJson("trading.json", cfg);
    console.log(`Desk ${cfg.paused ? "paused" : "resumed"}.`);
    return;
  }
  if (cfg.mode !== "paper") throw new Error("Live trading is locked until the approval step is built. Set mode to paper.");
  if (!AK || !AS) throw new Error("Missing ALPACA_KEY or ALPACA_SECRET secret.");
  if (!KEY) throw new Error("Missing GEMINI_API_KEY secret.");
  const TRADE = process.env.ALPACA_TRADE_BASE || "https://paper-api.alpaca.markets";

  // Asset classes -> symbols
  const classOf = {};
  for (const [cls, syms] of Object.entries(cfg.universe)) for (const s of syms) classOf[s] = cls;
  const all = Object.keys(classOf);
  const uni = new Set(all);

  // 1. Operations: account, clock, positions
  const [account, clock, allPositions] = await Promise.all([alpaca(TRADE, "/v2/account"), alpaca(TRADE, "/v2/clock"), alpaca(TRADE, "/v2/positions")]);
  if (account.trading_blocked || account.account_blocked) throw new Error("Alpaca says this account is blocked from trading.");
  const positions = allPositions.filter((p) => uni.has(p.symbol));
  const unrealized = positions.reduce((a, p) => a + Number(p.unrealized_pl), 0);
  const invested = positions.reduce((a, p) => a + Number(p.cost_basis), 0);
  const deskValue = cfg.budgetUsd + state.realizedUsd + unrealized;
  const deskChange = deskValue / cfg.budgetUsd - 1;
  const lossUsd = cfg.budgetUsd - deskValue;
  console.log(`Market open: ${clock.is_open}. Desk ${pct(deskChange)}, ${positions.length} holding(s).`);

  // 2. Market data (free IEX feed) + news
  const start = new Date(Date.now() - 100 * 86400000).toISOString().slice(0, 10);
  const market = {};
  let token = "";
  do {
    const r = await alpaca(ALPACA_DATA, `/v2/stocks/bars?symbols=${encodeURIComponent(all.join(","))}&timeframe=1Day&start=${start}&limit=10000&feed=iex&adjustment=all${token ? "&page_token=" + token : ""}`);
    for (const [sym, bars] of Object.entries(r.bars || {})) (market[sym] ||= []).push(...bars);
    token = r.next_page_token || "";
  } while (token);
  for (const sym of Object.keys(market)) market[sym] = market[sym].length > 5 ? indicators(market[sym]) : undefined;

  // 3. Performance Analyst (code): desk vs. simply holding SPY
  if (!state.startDate && market.SPY) { state.startDate = date; state.spyStart = market.SPY.price; }
  const spyChange = state.spyStart && market.SPY ? market.SPY.price / state.spyStart - 1 : 0;
  const byClass = {};
  for (const p of positions) byClass[classOf[p.symbol]] = (byClass[classOf[p.symbol]] || 0) + Number(p.market_value);
  const report = [`# Trading Desk - ${date}`, "", `> Practice money only (paper trading). Not financial advice.`, ""];
  const header = [`## Scoreboard (Performance Analyst)`,
    `- Desk since ${state.startDate || date}: **${pct(deskChange)}**`,
    `- Benchmark (just holding SPY): ${pct(spyChange)} → desk is ${deskChange >= spyChange ? "**ahead**" : "**behind**"}`,
    `- Invested: ${(invested / cfg.budgetUsd * 100).toFixed(0)}% of budget` + (Object.keys(byClass).length ? ` (${Object.entries(byClass).map(([c, v]) => `${c} ${(v / cfg.budgetUsd * 100).toFixed(0)}%`).join(", ")})` : ""),
    ...(positions.length ? positions.map((p) => `- **${p.symbol}** (${classOf[p.symbol]}): ${pct(Number(p.unrealized_plpc))} since bought, ${(Number(p.market_value) / cfg.budgetUsd * 100).toFixed(0)}% of budget`) : ["- No holdings yet (all cash)."]), ""];

  // Kill switch
  if (!cfg.paused && lossUsd >= cfg.maxLossUsd) {
    cfg.paused = true;
    await writeJson("trading.json", cfg);
    report.push(`## 🛑 Desk paused`, `Losses reached the safety limit (${(cfg.maxLossUsd / cfg.budgetUsd * 100).toFixed(0)}% of budget). No new trades until you resume it.`, "");
  }
  if (cfg.paused || !clock.is_open) {
    report.push(...header, cfg.paused ? "Desk is **paused**: no trades today." : "Market is closed today: no trades.");
    return save(date, report, state);
  }
  if (!Object.values(market).some(Boolean)) throw new Error("No market data came back from Alpaca.");

  let news = [];
  try {
    const n = await alpaca(ALPACA_DATA, `/v1beta1/news?symbols=${encodeURIComponent(all.join(","))}&limit=40&sort=desc`);
    news = (n.news || []).map((x) => `- ${x.created_at.slice(0, 10)} [${(x.symbols || []).filter((s) => uni.has(s)).join(",")}] ${x.headline}`);
  } catch (e) { console.log("News unavailable:", e.message); }

  // 4. Quant Analyst (code): momentum ranking across every asset
  const scored = all.filter((s) => market[s]).map((s) => {
    const m = market[s];
    const trend = (m.sma20 && m.price > m.sma20 ? 1 : 0) + (m.sma50 && m.price > m.sma50 ? 1 : 0);
    const score = (m.ret20d ?? 0) * 0.6 + (m.ret5d ?? 0) * 0.4 + trend * 0.01 - (m.rsi14 > 75 ? 0.02 : 0);
    return { s, cls: classOf[s], score, trend, m };
  }).sort((a, b) => b.score - a.score);
  const quantTable = scored.map((x, i) => `${i + 1}. ${x.s} (${x.cls}) 20d ${pct(x.m.ret20d ?? 0)}, 5d ${pct(x.m.ret5d ?? 0)}, trend ${x.trend}/2, RSI ${x.m.rsi14}`);

  await pickModels();
  const dataFor = (cls) => JSON.stringify(Object.fromEntries(cfg.universe[cls].filter((s) => market[s]).map((s) => [s, market[s]])));
  const newsFor = (cls) => news.filter((n) => cfg.universe[cls].some((s) => n.includes(s))).join("\n") || "(no headlines)";

  // 5. Macro Economist
  console.log("Macro Economist...");
  const cross = ["SPY", "QQQ", "IWM", "TLT", "IEF", "SHY", "HYG", "GLD", "USO", "DBC", "VNQ"].filter((s) => market[s]).map((s) => `${s}: 5d ${pct(market[s].ret5d ?? 0)}, 20d ${pct(market[s].ret20d ?? 0)}`).join("\n");
  const macro = await ask("Macro Economist", `Date: ${date}\nCross-asset moves:\n${cross}\nHeadlines:\n${news.join("\n") || "(none)"}\n\nIn under 120 words: is the market risk-on or risk-off, what bonds/treasuries say about rates, what gold/oil say about inflation, and which asset classes the backdrop favors. No trade calls.`);

  // 6. Asset-class analysts
  const desks = { Equities: ["Indexes", "Stocks"], "Fixed Income": ["Treasuries", "Bonds"], Commodities: ["Commodities"], "Real Estate": ["REITs"] };
  const views = {};
  for (const [desk, classes] of Object.entries(desks)) {
    console.log(`${desk} Analyst...`);
    views[desk] = await ask(`${desk} Analyst`, `Macro view:\n${macro}\n\nYour symbols and indicators (returns are decimals, 0.02 = +2%):\n${classes.map((c) => `${c}: ${dataFor(c)}`).join("\n")}\nHeadlines:\n${classes.map(newsFor).join("\n")}\n\nIn under 100 words: your desk's outlook, your single best pick and why, and one symbol to avoid.`);
  }

  // 7. Chief Investment Officer: allocation + trades
  console.log("Chief Investment Officer...");
  const held = positions.map((p) => ({ symbol: p.symbol, class: classOf[p.symbol], valueUsd: money(p.market_value), changeSinceBought: +Number(p.unrealized_plpc).toFixed(4) }));
  const room = Math.max(0, cfg.budgetUsd + state.realizedUsd - invested);
  const plan = await ask("Chief Investment Officer", `Goal: grow the portfolio and beat simply holding SPY, while staying diversified.\n\nMacro Economist:\n${macro}\n\n${Object.entries(views).map(([d, v]) => `${d} Analyst:\n${v}`).join("\n\n")}\n\nQuant momentum ranking (best first):\n${quantTable.slice(0, 15).join("\n")}\n...worst:\n${quantTable.slice(-5).join("\n")}\n\nCurrent holdings: ${JSON.stringify(held)}\nCash available: $${room.toFixed(2)} of $${cfg.budgetUsd}\n\nDecide a target mix by asset class, then 0 to ${cfg.maxTradesPerDay} trades to move toward it. Rules: buys are whole dollars from 1 to ${cfg.maxTradeUsd} and never exceed cash available; sells either close a holding (omit usd) or trim it (usd from 1 to its value); one single stock may not exceed ${cfg.maxStockPct}% of budget, one fund ${cfg.maxFundPct}%. Doing nothing is fine. Return JSON: {"targetMix":{"Stocks":30,"Indexes":30,"Treasuries":20,"Commodities":10,"REITs":10},"trades":[{"symbol":"GLD","side":"buy","usd":5,"reason":"..."}],"summary":["3 short bullets for the owner, percentages only"]}`, true);

  // 8. Risk Manager
  console.log("Risk Manager...");
  const proposed = Array.isArray(plan?.trades) ? plan.trades.slice(0, cfg.maxTradesPerDay) : [];
  let risk = { decisions: [] };
  if (proposed.length) risk = await ask("Risk Manager", `Holdings: ${JSON.stringify(held)}\nCash available: $${room.toFixed(2)} of $${cfg.budgetUsd}\nQuant ranking:\n${quantTable.join("\n")}\nMacro: ${macro}\n\nProposed trades:\n${JSON.stringify(proposed)}\n\nApprove or veto each. Veto anything chasing a huge short-term spike (RSI over 80), adding to a clear downtrend without a reason, or making the portfolio lopsided. Return JSON: {"decisions":[{"symbol":"GLD","approve":true,"why":"..."}],"note":"one sentence on overall risk"}`, true);

  // 9. Compliance Officer (code): hard limits nobody can override
  const pos = Object.fromEntries(positions.map((p) => [p.symbol, p]));
  const value = Object.fromEntries(positions.map((p) => [p.symbol, Number(p.market_value)]));
  let cash = room;
  const orders = [], blocked = [];
  for (const t of proposed) {
    const sym = String(t.symbol || "").toUpperCase(), side = String(t.side || "").toLowerCase(), usd = Math.floor(Number(t.usd) || 0);
    const d = (risk.decisions || []).find((x) => String(x.symbol).toUpperCase() === sym);
    const why = (m) => blocked.push(`- ${side} ${sym}: ${m}`);
    if (!uni.has(sym)) { why("not on the allowed list"); continue; }
    if (!d?.approve) { why(`Risk Manager veto${d?.why ? ": " + d.why : ""}`); continue; }
    if (side === "buy") {
      const cap = (classOf[sym] === "Stocks" ? cfg.maxStockPct : cfg.maxFundPct) / 100 * cfg.budgetUsd;
      if (usd < 1 || usd > cfg.maxTradeUsd) { why(`size must be $1-$${cfg.maxTradeUsd}`); continue; }
      if (usd > cash) { why("not enough budget left"); continue; }
      if ((value[sym] || 0) + usd > cap) { why(`would exceed the ${classOf[sym] === "Stocks" ? cfg.maxStockPct : cfg.maxFundPct}% limit for one holding`); continue; }
      cash -= usd; value[sym] = (value[sym] || 0) + usd;
      orders.push({ sym, side, usd, reason: t.reason });
    } else if (side === "sell") {
      if (!pos[sym]) { why("not held (no short selling)"); continue; }
      const trim = usd >= 1 && usd < Number(pos[sym].market_value) - 1;
      orders.push({ sym, side, usd: trim ? usd : null, reason: t.reason });
    } else why("unknown action");
  }

  // 10. Execution Trader (code): place orders on the paper account
  const done = [];
  for (const o of orders) {
    try {
      if (o.side === "buy") {
        const r = await alpaca(TRADE, "/v2/orders", { method: "POST", body: JSON.stringify({ symbol: o.sym, notional: String(o.usd), side: "buy", type: "market", time_in_force: "day" }) });
        done.push(`- ✅ Bought ${o.sym} (${classOf[o.sym]}, ${(o.usd / cfg.budgetUsd * 100).toFixed(0)}% of budget), ${r.status}. Why: ${o.reason}`);
      } else {
        const p = pos[o.sym], plpc = Number(p.unrealized_plpc);
        if (o.usd) {
          await alpaca(TRADE, "/v2/orders", { method: "POST", body: JSON.stringify({ symbol: o.sym, notional: String(o.usd), side: "sell", type: "market", time_in_force: "day" }) });
          state.realizedUsd = money(state.realizedUsd + o.usd * plpc / (1 + plpc));
          done.push(`- ✅ Trimmed ${o.sym} (${pct(plpc)} on that part). Why: ${o.reason}`);
        } else {
          await alpaca(TRADE, `/v2/positions/${encodeURIComponent(o.sym)}`, { method: "DELETE" });
          state.realizedUsd = money(state.realizedUsd + Number(p.unrealized_pl));
          done.push(`- ✅ Sold all ${o.sym} (${pct(plpc)}). Why: ${o.reason}`);
        }
      }
      state.log = [{ date, side: o.side, symbol: o.sym }, ...(state.log || [])].slice(0, 500);
    } catch (e) { done.push(`- ⚠️ ${o.side} ${o.sym} failed: ${e.message}`); }
  }

  const mix = plan?.targetMix ? Object.entries(plan.targetMix).map(([k, v]) => `${k} ${v}%`).join(", ") : "not set";
  report.push(...header,
    `## Chief Investment Officer`, ...(Array.isArray(plan?.summary) ? plan.summary.map((b) => `- ${b}`) : [String(plan?.summary || "")]), `- Target mix: ${mix}`, "",
    `## Trades today (Execution Trader)`, ...(done.length ? done : ["- None. Sitting tight is a valid decision."]), "",
    `## Risk Manager`, risk.note || (proposed.length ? "Reviewed all proposals." : "No trades to review."), ...(blocked.length ? ["", "Blocked by Risk / Compliance:", ...blocked] : []), "",
    `## Macro Economist`, macro, "",
    ...Object.entries(views).flatMap(([d, v]) => [`## ${d} Analyst`, v, ""]),
    `## Quant Analyst: momentum ranking`, ...quantTable.slice(0, 10), "",
    `## Desk rules (Compliance)`, `- Practice money, buy-only (no short selling), allowed list only`, `- Max ${(cfg.maxTradeUsd / cfg.budgetUsd * 100).toFixed(0)}% of budget per trade, ${cfg.maxTradesPerDay} trades a day`, `- One stock ≤ ${cfg.maxStockPct}%, one fund ≤ ${cfg.maxFundPct}% of budget`, `- Auto-pause if down ${(cfg.maxLossUsd / cfg.budgetUsd * 100).toFixed(0)}%`);
  return save(date, report, state);
}

async function save(date, report, state) {
  await fs.mkdir("reports", { recursive: true });
  await fs.mkdir("trading", { recursive: true });
  const file = `${date}-trading-desk.md`;
  await fs.writeFile(`reports/${file}`, report.join("\n") + "\n");
  const index = await readJson("reports/index.json", []);
  await writeJson("reports/index.json", [{ file, agent: "trading-desk", name: "Trading Desk", date }, ...index.filter((r) => r.file !== file)].slice(0, 300));
  await writeJson("trading/state.json", state);
  console.log(`Saved reports/${file}`);
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
