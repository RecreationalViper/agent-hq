// SEO research for the shop agents.
// 1) Google autocomplete (free, no key): what people actually type.
// 2) Apify Google Search Scraper (APIFY_TOKEN, free $5/month): who ranks, "People also ask",
//    related searches. Hard-capped: few queries, one page each, and skipped if the month's
//    free credit is getting low.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function suggest(q) {
  try {
    const r = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "Mozilla/5.0" } });
    const j = await r.json();
    return Array.isArray(j?.[1]) ? j[1] : [];
  } catch { return []; }
}

async function apify(path, init = {}) {
  const res = await fetch(`https://api.apify.com/v2${path}`, { ...init, signal: AbortSignal.timeout(240000), headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN.trim()}`, "Content-Type": "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Apify ${res.status}: ${data.error?.message || "request failed"}`);
  return data;
}

// cfg: { seeds: [...], modifiers: [...], serp: [...], maxCreditUsd: 3 }
export async function seoResearch(cfg = {}) {
  const seeds = cfg.seeds || [];
  const mods = cfg.modifiers || [];
  const lines = [], notes = [];

  // 1. Autocomplete
  const found = new Map();
  for (const s of seeds) {
    for (const q of [s, ...mods.map((m) => `${s} ${m}`)]) {
      for (const sug of await suggest(q)) found.set(sug.toLowerCase(), (found.get(sug.toLowerCase()) || 0) + 1);
      await sleep(150);
    }
  }
  const ranked = [...found.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}${n > 1 ? ` (x${n})` : ""}`);
  lines.push(`Google autocomplete suggestions (real searches; "xN" = suggested for N different seed phrases):\n${ranked.slice(0, 80).join("\n") || "(none returned)"}`);

  // 2. Search results via Apify (capped)
  if (process.env.APIFY_TOKEN && cfg.serp?.length) {
    try {
      const lim = await apify("/users/me/limits");
      const used = Number(lim.data?.current?.monthlyUsageUsd || 0), cap = Number(cfg.maxCreditUsd ?? 3);
      if (used >= cap) notes.push(`Skipped Google results check: $${used.toFixed(2)} of Apify's free $5 already used this month (safety cap $${cap}).`);
      else {
        const items = await apify(`/acts/apify~google-search-scraper/run-sync-get-dataset-items?timeout=200&memory=1024&maxTotalChargeUsd=0.5`, { method: "POST", body: JSON.stringify({
          queries: cfg.serp.slice(0, 5).join("\n"), resultsPerPage: 10, maxPagesPerQuery: 1, countryCode: "us", languageCode: "en", mobileResults: true, saveHtml: false, saveHtmlToKeyValueStore: false, includeUnfilteredResults: false
        }) });
        for (const it of Array.isArray(items) ? items : []) {
          const q = it.searchQuery?.term || "?";
          const org = (it.organicResults || []).slice(0, 8).map((o, i) => `  ${i + 1}. ${o.title} (${(o.url || "").replace(/^https?:\/\/(www\.)?/, "").split("/")[0]})`);
          const paa = (it.peopleAlsoAsk || []).slice(0, 6).map((p) => `  - ${p.question}`);
          const rel = (it.relatedQueries || []).slice(0, 8).map((r) => r.title).filter(Boolean);
          lines.push(`Google results for "${q}" (mobile, US):\n${org.join("\n") || "  (no results)"}${paa.length ? `\n People also ask:\n${paa.join("\n")}` : ""}${rel.length ? `\n Related searches: ${rel.join("; ")}` : ""}`);
        }
        const after = await apify("/users/me/limits").catch(() => null);
        notes.push(`Apify credit used this month: $${Number(after?.data?.current?.monthlyUsageUsd ?? used).toFixed(2)} of the free $5.`);
      }
    } catch (e) { notes.push(`Google results check unavailable today (${e.message}).`); }
  }
  return { text: lines.join("\n\n"), notes };
}
