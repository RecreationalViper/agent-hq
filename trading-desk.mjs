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
    systemInstruction: { parts: [{ text: `You are the ${role} on a small AI trading desk managing a $50 practice account (paper money) on Alpaca. Be careful, plain-spoken and brief. You cannot see anything beyond the data given. Never promise returns.` }] },
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

  // 1. Account + positions
  const [account, clock, allPositions] = await Promise.all([alpaca(TRADE, "/v2/account"), alpaca(TRADE, "/v2/clock"), alpaca(TRADE, "/v2/positions")]);
  if (account.trading_blocked || account.account_blocked) throw new Error("Alpaca says this account is blocked from trading.");
  const uni = new Set(cfg.universe);
  const positions = allPositions.filter((p) => uni.has(p.symbol));
  const unrealized = positions.reduce((a, p) => a + Number(p.unrealized_pl), 0);
  const invested = positions.reduce((a, p) => a + Number(p.cost_basis), 0);
  const deskValue = cfg.budgetUsd + state.realizedUsd + unrealized;
  const deskChange = deskValue / cfg.budgetUsd - 1;
  const lossUsd = cfg.budgetUsd - deskValue;
  console.log(`Market open: ${clock.is_open}. Desk ${pct(deskChange)}, ${positions.length} holding(s).`);

  const report = [`# Trading Desk - ${date}`, "", `> Practice money only (paper trading). Not financial advice.`, ""];
  const holdingLines = positions.length
    ? positions.map((p) => `- **${p.symbol}**: ${pct(Number(p.unrealized_plpc))} since bought, ${(Number(p.cost_basis) / cfg.budgetUsd * 100).toFixed(0)}% of budget`)
    : ["- No holdings yet (all cash)."];
  const header = [`## Scoreboard`, `- Desk since start: **${pct(deskChange)}**`, `- Invested: ${(invested / cfg.budgetUsd * 100).toFixed(0)}% of budget`, ...holdingLines, ""];

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

  // 2. Market data (free IEX feed) + news
  const start = new Date(Date.now() - 100 * 86400000).toISOString().slice(0, 10);
  const barsRes = await alpaca(ALPACA_DATA, `/v2/stocks/bars?symbols=${encodeURIComponent(cfg.universe.join(","))}&timeframe=1Day&start=${start}&limit=10000&feed=iex&adjustment=all`);
  const market = {};
  for (const [sym, bars] of Object.entries(barsRes.bars || {})) if (bars.length > 5) market[sym] = indicators(bars);
  let news = [];
  try {
    const n = await alpaca(ALPACA_DATA, `/v1beta1/news?symbols=${encodeURIComponent(cfg.universe.join(","))}&limit=25&sort=desc`);
    news = (n.news || []).map((x) => `- ${x.created_at.slice(0, 10)} [${(x.symbols || []).filter((s) => uni.has(s)).join(",")}] ${x.headline}`);
  } catch (e) { console.log("News unavailable:", e.message); }
  if (!Object.keys(market).length) throw new Error("No market data came back from Alpaca.");

  await pickModels();
  const held = positions.map((p) => ({ symbol: p.symbol, costUsd: +Number(p.cost_basis).toFixed(2), changeSinceBought: +Number(p.unrealized_plpc).toFixed(4) }));
  const room = Math.max(0, cfg.budgetUsd - invested);
  const facts = `Date: ${date}\nAllowed symbols: ${cfg.universe.join(", ")}\nIndicators (returns are decimals, e.g. 0.02 = +2%):\n${JSON.stringify(market)}\nCurrent holdings: ${JSON.stringify(held)}\nCash available to invest: $${room.toFixed(2)} of $${cfg.budgetUsd}\nRecent headlines:\n${news.join("\n") || "(none)"}`;

  // 3. Research Analyst
  console.log("Research Analyst...");
  const research = await ask("Research Analyst", `${facts}\n\nWrite a short market read (under 150 words): overall trend, the 3 strongest and 3 weakest symbols by the data, and any headline that matters. No trade calls.`);

  // 4. Strategist
  console.log("Strategist...");
  const ideas = await ask("Strategist", `${facts}\n\nAnalyst notes:\n${research}\n\nPropose 0 to ${cfg.maxTradesPerDay} trades. Long-only, patient, trend-following; doing nothing is fine. Buys: whole dollars between 1 and ${cfg.maxTradeUsd}, never more than the cash available. Sells close an entire existing holding. Return JSON: {"trades":[{"symbol":"SPY","side":"buy","usd":10,"reason":"..."}],"summary":"one sentence"}`, true);

  // 5. Risk Manager (AI review) - code limits are enforced again below regardless
  console.log("Risk Manager...");
  const proposed = Array.isArray(ideas?.trades) ? ideas.trades.slice(0, cfg.maxTradesPerDay) : [];
  let risk = { decisions: [] };
  if (proposed.length) risk = await ask("Risk Manager", `${facts}\n\nProposed trades:\n${JSON.stringify(proposed)}\n\nApprove or veto each one. Veto anything chasing a big one-day jump, over-concentrating (more than 40% of budget in one stock, index funds excepted), or with a weak reason. Return JSON: {"decisions":[{"symbol":"SPY","approve":true,"why":"..."}]}`, true);

  // 6. Compliance (code): hard limits nobody can override
  const heldSyms = new Set(positions.map((p) => p.symbol));
  let cash = room;
  const orders = [], blocked = [];
  for (const t of proposed) {
    const sym = String(t.symbol || "").toUpperCase(), side = String(t.side || "").toLowerCase(), usd = Math.floor(Number(t.usd) || 0);
    const d = (risk.decisions || []).find((x) => String(x.symbol).toUpperCase() === sym);
    const why = (m) => blocked.push(`- ${side} ${sym}: ${m}`);
    if (!uni.has(sym)) { why("not on the allowed list"); continue; }
    if (!d?.approve) { why(`Risk Manager veto${d?.why ? ": " + d.why : ""}`); continue; }
    if (side === "buy") {
      if (usd < 1 || usd > cfg.maxTradeUsd) { why(`size must be $1-$${cfg.maxTradeUsd}`); continue; }
      if (usd > cash) { why("not enough budget left"); continue; }
      cash -= usd; orders.push({ sym, side, usd, reason: t.reason });
    } else if (side === "sell") {
      if (!heldSyms.has(sym)) { why("not held (no short selling)"); continue; }
      orders.push({ sym, side, reason: t.reason });
    } else why("unknown action");
  }

  // 7. Trader (code): place orders on the paper account
  const done = [];
  for (const o of orders) {
    try {
      if (o.side === "buy") {
        const r = await alpaca(TRADE, "/v2/orders", { method: "POST", body: JSON.stringify({ symbol: o.sym, notional: String(o.usd), side: "buy", type: "market", time_in_force: "day" }) });
        done.push(`- ✅ Bought ${o.sym} (${(o.usd / cfg.budgetUsd * 100).toFixed(0)}% of budget), order ${r.status}. Why: ${o.reason}`);
      } else {
        const p = positions.find((x) => x.symbol === o.sym);
        await alpaca(TRADE, `/v2/positions/${encodeURIComponent(o.sym)}`, { method: "DELETE" });
        state.realizedUsd = +(state.realizedUsd + Number(p.unrealized_pl)).toFixed(2);
        done.push(`- ✅ Sold all ${o.sym} (${pct(Number(p.unrealized_plpc))}). Why: ${o.reason}`);
      }
      state.log = [{ date, side: o.side, symbol: o.sym }, ...(state.log || [])].slice(0, 500);
    } catch (e) { done.push(`- ⚠️ ${o.side} ${o.sym} failed: ${e.message}`); }
  }

  // 8. Portfolio Manager summary
  console.log("Portfolio Manager...");
  const pm = await ask("Portfolio Manager", `Today's analyst notes:\n${research}\n\nStrategist summary: ${ideas?.summary || "none"}\nExecuted:\n${done.join("\n") || "none"}\nBlocked:\n${blocked.join("\n") || "none"}\nDesk change since start: ${pct(deskChange)}\n\nWrite 3 short bullet points for the owner: what the desk did and why, the main risk to watch, and what would change the plan. Use percentages, not dollar amounts.`);

  report.push(...header,
    `## Portfolio Manager`, pm, "",
    `## Trades today`, ...(done.length ? done : ["- None. Sitting tight is a valid decision."]), "",
    ...(blocked.length ? [`## Blocked by Risk / Compliance`, ...blocked, ""] : []),
    `## Research Analyst`, research, "",
    `## Desk rules`, `- Practice money, long-only, allowed list only`, `- Max ${(cfg.maxTradeUsd / cfg.budgetUsd * 100).toFixed(0)}% of budget per trade, ${cfg.maxTradesPerDay} trades a day`, `- Auto-pause if down ${(cfg.maxLossUsd / cfg.budgetUsd * 100).toFixed(0)}%`);
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
