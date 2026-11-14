// Tavily web search for agents (free plan: 1,000 credits/month, no card). Basic search = 1 credit.
// A monthly counter in tavily-usage.json (committed by the workflows) keeps all agents under the cap.
// Never throws: returns { text: "", count: 0 } when Tavily is missing, out of budget or failing.
import fs from "node:fs";

const FILE = "tavily-usage.json";
const CAP = Number(process.env.TAVILY_MONTHLY_CAP || 900); // credits, of the free 1,000
const key = () => process.env.TAVILY_API_KEY?.trim();
export const hasTavily = () => Boolean(key());

function usage() {
  const month = new Date().toISOString().slice(0, 7);
  try { const u = JSON.parse(fs.readFileSync(FILE, "utf8")); if (u.month === month) return u; } catch {}
  return { month, credits: 0, byAgent: {} };
}
function record(credits, who) {
  const u = usage();
  u.credits += credits;
  u.byAgent[who] = (u.byAgent[who] || 0) + credits;
  fs.writeFileSync(FILE, JSON.stringify(u, null, 2) + "\n");
}

export async function tavilyBlock(queries, who, { days = 3, max = 5 } = {}) {
  if (!hasTavily()) return { text: "", count: 0 };
  let text = "", count = 0;
  const seen = new Set();
  for (const q of queries) {
    const query = typeof q === "string" ? q : q.query;
    if (usage().credits >= CAP) { console.log(`  Tavily skipped: ${usage().credits} of ${CAP} monthly credits used`); break; }
    try {
      const r = await fetch("https://api.tavily.com/search", {
        method: "POST", signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, search_depth: "basic", topic: "news", days, max_results: max, include_answer: false })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { console.log(`  Tavily HTTP ${r.status}: ${String(j.detail?.error || j.detail || j.error || "").slice(0, 120)}`); if ([401, 403, 429, 432, 433].includes(r.status)) break; continue; }
      record(1, who);
      const rows = (j.results || []).filter((x) => x.url && !seen.has(x.url) && seen.add(x.url));
      if (!rows.length) continue;
      text += `\n\n### "${query}"\n` + rows.map((x) => `- [${x.title}](${x.url})${x.published_date ? ` · ${String(x.published_date).slice(0, 16)}` : ""}\n  ${String(x.content || "").replace(/\s+/g, " ").slice(0, 400)}`).join("\n");
      count += rows.length;
    } catch (e) { console.log(`  Tavily "${query}" failed: ${e.message}`); }
  }
  return { text: text.trim(), count };
}
