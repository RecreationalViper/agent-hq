// Free real-time web results for agents, with no AI quota involved: Google News RSS (no key).
// Works whichever AI answers (Gemini or a backup), so agents always get today's headlines.
// Never throws: returns { text: "", count: 0 } when the feed is unreachable.
const UA = "Mozilla/5.0 (compatible; AgentHQ/1.0; +https://github.com/RecreationalViper/agent-hq)";
const unescape = (s = "") => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/<[^>]+>/g, "").trim();
const tag = (xml, t) => unescape((xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1]);

export async function newsSearch(query, { days = 3, max = 6, region = "US" } = {}) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${days}d`)}&hl=en-${region}&gl=${region}&ceid=${region}:en`;
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Google News ${r.status}`);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, max).map(([, it]) => ({
    title: tag(it, "title"), link: tag(it, "link"), source: tag(it, "source"), date: new Date(tag(it, "pubDate") || Date.now()).toISOString().slice(0, 10)
  })).filter((x) => x.title && x.link);
}

export async function newsBlock(queries, opts = {}) {
  const seen = new Set();
  let text = "", count = 0;
  for (const q of queries) {
    const items = await newsSearch(typeof q === "string" ? q : q.query, { ...opts, ...(typeof q === "object" ? q : {}) }).catch((e) => { console.log(`  Google News "${q}" failed: ${e.message}`); return []; });
    const fresh = items.filter((i) => !seen.has(i.title.toLowerCase()) && seen.add(i.title.toLowerCase()));
    if (!fresh.length) continue;
    text += `\n\n### "${typeof q === "string" ? q : q.query}"\n` + fresh.map((i) => `- ${i.date} · [${i.title}](${i.link})${i.source ? ` · ${i.source}` : ""}`).join("\n");
    count += fresh.length;
  }
  return { text: text.trim(), count };
}
