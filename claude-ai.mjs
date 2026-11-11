// Claude (Anthropic API) for Agent HQ: the "strong" writer for the few jobs where quality matters most
// (Content Creator posts, the trading desk's CIO and Head Trader). Needs the CLAUDE_API_KEY secret.
// The key has limited credit, so every call is checked against a monthly budget kept in
// claude-usage.json (committed by the workflows). Over budget, out of credit or failing -> it throws
// and the caller falls back to Gemini and the free backups, so nothing stops working.
import fs from "node:fs";

const FILE = "claude-usage.json";
const API = "https://api.anthropic.com/v1";
export const CLAUDE_MONTHLY_CAP = Number(process.env.CLAUDE_MONTHLY_CAP || 3); // dollars per month
const key = () => (process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "").trim();
// $ per million tokens [input, output]; unknown models are priced like the most expensive (safe side)
const PRICE = [[/haiku/i, 1, 5], [/sonnet/i, 3, 15], [/opus/i, 5, 25]];
const price = (m) => { const p = PRICE.find(([r]) => r.test(m)); return p ? [p[1], p[2]] : [15, 75]; };
let models, out = false;

function usage() {
  const month = new Date().toISOString().slice(0, 7);
  try { const u = JSON.parse(fs.readFileSync(FILE, "utf8")); if (u.month === month) return u; } catch {}
  return { month, spent: 0, calls: 0, byAgent: {} };
}
function record(cost, who) {
  const u = usage();
  const r = (n) => Math.round(n * 10000) / 10000;
  u.spent = r(u.spent + cost); u.calls += 1; u.byAgent[who] = r((u.byAgent[who] || 0) + cost);
  fs.writeFileSync(FILE, JSON.stringify(u, null, 2) + "\n");
}
export const claudeSpent = () => usage().spent;
export const hasClaude = () => Boolean(key()) && !out && usage().spent < CLAUDE_MONTHLY_CAP;

async function call(path, init = {}) {
  const res = await fetch(API + path, { ...init, signal: AbortSignal.timeout(180000), headers: { "x-api-key": key(), "anthropic-version": "2023-06-01", "content-type": "application/json" } });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = {}; }
  if (!res.ok) { const e = new Error(`Claude ${res.status}: ${data.error?.message || text.slice(0, 200)}`); e.status = res.status; throw e; }
  return data;
}

// Mid-size models first (best value), newest first; Haiku as the cheaper backup. Opus is never used.
export async function claudeModels() {
  if (models) return models;
  const ids = ((await call("/models?limit=100")).data || []).map((m) => m.id);
  const rank = (i) => (/sonnet/i.test(i) ? 0 : /haiku/i.test(i) ? 1 : 9);
  models = ids.filter((i) => rank(i) < 9); // keeps API order (newest first) within each tier
  models.sort((a, b) => rank(a) - rank(b));
  if (!models.length) throw new Error("Claude lists no Sonnet or Haiku model for this key");
  return models;
}

// Returns the reply text. Throws when Claude can't (or shouldn't) answer, so callers fall back.
export async function claudeChat(system, user, { json = false, temperature = 0.5, maxTokens = 3000, who = "agent" } = {}) {
  if (!key()) throw new Error("Claude: no CLAUDE_API_KEY");
  const u = usage();
  if (u.spent >= CLAUDE_MONTHLY_CAP) throw new Error(`Claude skipped: $${u.spent.toFixed(2)} used this month (cap $${CLAUDE_MONTHLY_CAP})`);
  let lastErr;
  for (const model of (await claudeModels()).slice(0, 3)) {
    try {
      const data = await call("/messages", { method: "POST", body: JSON.stringify({
        model, max_tokens: maxTokens, temperature,
        system: system + (json ? "\nReply with valid JSON only: no code fences, no text before or after." : ""),
        messages: [{ role: "user", content: user }]
      }) });
      const [pin, pout] = price(model);
      const cost = ((data.usage?.input_tokens || 0) * pin + (data.usage?.output_tokens || 0) * pout) / 1e6;
      record(cost, who);
      const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      if (!text) throw new Error("Claude returned an empty reply");
      console.log(`  written by Claude ${model} ($${cost.toFixed(4)}; $${usage().spent.toFixed(2)} of $${CLAUDE_MONTHLY_CAP} this month)`);
      return text;
    } catch (e) {
      lastErr = e;
      // bad key or no credit left: stop using Claude for the rest of this run
      if (e.status === 401 || e.status === 403 || (e.status === 400 && /credit|billing|balance/i.test(e.message))) { out = true; break; }
      if (e.status === 404) { models = models.filter((m) => m !== model); continue; }
      if (e.status === 429 || e.status === 529 || e.status >= 500) continue; // busy: try the next model
      break;
    }
  }
  console.log(`  Claude unavailable (${lastErr?.message?.slice(0, 160)}); using the other AIs`);
  throw lastErr || new Error("Claude could not answer");
}
