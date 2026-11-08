// Macro data from FRED (Federal Reserve Bank of St. Louis), free with an API key (FRED_API_KEY secret).
// Gives the trading desk real numbers for rates, inflation, jobs, credit stress and volatility,
// plus the dates of upcoming market-moving releases.
const BASE = process.env.FRED_API_BASE || "https://api.stlouisfed.org/fred";

// [series id, label, how to show the change, unit]
const SERIES = [
  ["DFF", "Fed funds rate", "level", "%"],
  ["DGS2", "2-year Treasury yield", "level", "%"],
  ["DGS10", "10-year Treasury yield", "level", "%"],
  ["T10Y2Y", "10y minus 2y spread (negative = inverted curve)", "level", "pts"],
  ["T10YIE", "10-year breakeven inflation", "level", "%"],
  ["CPIAUCSL", "CPI inflation, year over year", "yoy", "%"],
  ["PCEPILFE", "Core PCE inflation (Fed's target gauge), year over year", "yoy", "%"],
  ["UNRATE", "Unemployment rate", "level", "%"],
  ["ICSA", "Weekly jobless claims", "level", ""],
  ["VIXCLS", "VIX (stock market fear gauge)", "level", ""],
  ["BAMLH0A0HYM2", "High-yield credit spread (credit stress)", "level", "pts"],
  ["DTWEXBGS", "US dollar index (broad)", "level", ""],
  ["DCOILWTICO", "WTI crude oil price", "level", "$"],
  ["A191RL1Q225SBEA", "Real GDP growth (annualized, quarterly)", "level", "%"],
  ["UMCSENT", "Consumer sentiment (U. Michigan)", "level", ""]
];
// Releases that move markets (FRED release ids)
const RELEASES = { 10: "CPI inflation report", 50: "Jobs report (Employment Situation)", 53: "GDP report", 54: "PCE inflation / personal income", 46: "Producer prices (PPI)", 180: "Weekly jobless claims", 9: "Retail sales" };

async function get(path, key) {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(key)}&file_type=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`FRED ${res.status}: ${data.error_message || "request failed"}`);
  return data;
}

const fmt = (v, unit) => unit === "$" ? `$${v.toFixed(2)}` : unit === "%" ? `${v.toFixed(2)}%` : unit === "pts" ? v.toFixed(2) : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toFixed(1);

// Returns { lines: [...], calendar: [...], notes: [...] } or null when no key is set.
export async function macroSnapshot(key = process.env.FRED_API_KEY) {
  if (!key) return null;
  const start = new Date(Date.now() - 430 * 86400000).toISOString().slice(0, 10);
  const lines = [], notes = [], data = {};
  await Promise.all(SERIES.map(async ([id, label, mode, unit]) => {
    try {
      const r = await get(`/series/observations?series_id=${id}&observation_start=${start}&sort_order=desc`, key);
      const obs = (r.observations || []).filter((o) => o.value !== ".").map((o) => ({ date: o.date, v: Number(o.value) }));
      if (!obs.length) throw new Error("no data");
      const latest = obs[0];
      const ago = (days) => obs.find((o) => Date.parse(o.date) <= Date.parse(latest.date) - days * 86400000);
      if (mode === "yoy") {
        const y = ago(360);
        const m = obs[1] && obs.find((o) => Date.parse(o.date) <= Date.parse(obs[1].date) - 360 * 86400000);
        const yoy = y ? (latest.v / y.v - 1) * 100 : null;
        const prevYoy = obs[1] && m ? (obs[1].v / m.v - 1) * 100 : null;
        if (yoy == null) throw new Error("not enough history");
        data[id] = yoy;
        lines.push({ id, text: `${label}: ${yoy.toFixed(2)}% (as of ${latest.date}${prevYoy != null ? `; prior month ${prevYoy.toFixed(2)}%` : ""})` });
      } else {
        const m = ago(28), y = ago(360);
        data[id] = latest.v;
        lines.push({ id, text: `${label}: ${fmt(latest.v, unit)} (as of ${latest.date}${m ? `; 1 month ago ${fmt(m.v, unit)}` : ""}${y ? `; 1 year ago ${fmt(y.v, unit)}` : ""})` });
      }
    } catch (e) { notes.push(`${id} unavailable (${e.message})`); }
  }));
  lines.sort((a, b) => SERIES.findIndex((s) => s[0] === a.id) - SERIES.findIndex((s) => s[0] === b.id));

  // Upcoming market-moving releases in the next 10 days
  const calendar = [];
  try {
    const today = new Date().toISOString().slice(0, 10), end = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const r = await get(`/releases/dates?realtime_start=${today}&realtime_end=${end}&include_release_dates_with_no_data=true&sort_order=asc&limit=1000`, key);
    const seen = new Set();
    for (const d of r.release_dates || []) {
      const name = RELEASES[d.release_id];
      if (!name || d.date < today || seen.has(name + d.date)) continue;
      seen.add(name + d.date);
      calendar.push(`${d.date}: ${name}`);
    }
  } catch (e) { notes.push(`release calendar unavailable (${e.message})`); }

  if (!lines.length) throw new Error(`FRED returned no data. ${notes.join("; ")}`);
  return { lines: lines.map((l) => l.text), calendar, notes, data };
}
