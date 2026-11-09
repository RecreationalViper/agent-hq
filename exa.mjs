// Exa (AI web search) for Agent HQ. Free $10/month credit, no card on file = never billed.
// Every call is checked against a monthly budget kept in exa-usage.json (committed by the workflows),
// so all agents together stay well under the free $10. Calls never throw: they return [] when
// Exa is unavailable, out of budget or failing, and agents carry on without it.
import fs from "node:fs";

const FILE = "exa-usage.json";
export const EXA_MONTHLY_CAP = Number(process.env.EXA_MONTHLY_CAP || 6); // dollars, of the free $10
const keys = () => [process.env.EXA_API_KEY, process.env.EXA_API_KEY_2].map((k) => k?.trim()).filter(Boolean);
export const hasExa = () => keys().length > 0;

function usage() {
  const month = new Date().toISOString().slice(0, 7);
  try {
    const u = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (u.month === month) return u;
  } catch {}
  return { month, spent: 0, calls: 0, byAgent: {} };
}
function record(cost, who) {
  const u = usage();
  u.spent = Math.round((u.spent + cost) * 10000) / 10000;
  u.calls += 1;
  u.byAgent[who] = Math.round(((u.byAgent[who] || 0) + cost) * 10000) / 10000;
  fs.writeFileSync(FILE, JSON.stringify(u, null, 2) + "\n");
}
export const exaSpent = () => usage().spent;

async function call(path, body, who) {
  if (!hasExa()) return null;
  const u = usage();
  if (u.spent >= EXA_MONTHLY_CAP) { console.log(`  Exa skipped: $${u.spent.toFixed(2)} used this month (cap $${EXA_MONTHLY_CAP})`); return null; }
  for (const key of keys()) {
    try {
      const r = await fetch(`https://api.exa.ai${path}`, { method: "POST", signal: AbortSignal.timeout(60000), headers: { "x-api-key": key, "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { record(Number(j.costDollars?.total ?? 0.01), who); return j; }
      console.log(`  Exa ${path} HTTP ${r.status}: ${String(j.error || j.message || "").slice(0, 120)}`);
      if (![401, 402, 403, 429].includes(r.status)) return null; // only try the next key for key/credit problems
    } catch (e) { console.log(`  Exa ${path} failed: ${e.message}`); return null; }
  }
  return null;
}

/**
 * search(query, opts) -> [{title, url, date, text}]
 * opts: num (default 5), type ("auto"|"fast"|"lite"), category ("news","company",...), include/exclude (domains),
 *       since (YYYY-MM-DD), chars (page text per result, default 1200; 0 = highlights only), who (agent id for the tally)
 */
export async function search(query, opts = {}) {
  const chars = opts.chars ?? 1200;
  const body = {
    query, type: opts.type || "auto", numResults: Math.min(opts.num || 5, 10),
    contents: chars ? { text: { maxCharacters: chars } } : { highlights: { numSentences: 3 } }
  };
  if (opts.category) body.category = opts.category;
  if (opts.include?.length) body.includeDomains = opts.include;
  if (opts.exclude?.length) body.excludeDomains = opts.exclude;
  if (opts.since) body.startPublishedDate = new Date(opts.since).toISOString();
  const j = await call("/search", body, opts.who || "agent");
  return (j?.results || []).map((r) => ({
    title: (r.title || "").trim(), url: r.url, date: r.publishedDate ? r.publishedDate.slice(0, 10) : "",
    text: (r.text || (r.highlights || []).join(" … ") || "").replace(/\s+/g, " ").trim()
  }));
}

// Runs several searches and formats them as a numbered source list an AI can cite as [n].
export async function researchBlock(searches, who) {
  const out = [], seen = new Set();
  for (const s of searches) {
    const q = typeof s === "string" ? { query: s } : s;
    const rows = await search(q.query, { ...q, who });
    for (const r of rows) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      out.push(r);
    }
  }
  const text = out.map((r, i) => `[${i + 1}] ${r.title}${r.date ? ` (${r.date})` : ""}\n${r.url}\n${r.text}`).join("\n\n");
  return { results: out, text };
}
