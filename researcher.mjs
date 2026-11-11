// Deep Researcher - daily brief on the latest in AI and software development.
// Adapted from the Claude "deep-research" template for free models without web search:
// plain code gathers fresh items from primary sources (official blogs, release notes,
// arXiv, GitHub) plus Hacker News for what developers are discussing; the AI then
// 1) splits the day into 3-5 sub-questions and picks the most authoritative sources,
// 2) code reads those sources in full, 3) the AI writes a cited report with a
// "Confidence & gaps" section, 4) code checks every citation. Then it posts to Notion.
import fs from "node:fs/promises";
import { flushUsage } from "./usage-log.mjs";
import { ask } from "./ai-ask.mjs";
import { report as discordReport } from "./discord.mjs";
import { hasExa, search as exaSearch } from "./exa.mjs";

const TZ = "America/New_York";
const date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const NOTION = process.env.NOTION_API_BASE || "https://api.notion.com/v1";
const GH = process.env.GITHUB_API_BASE || "https://api.github.com";
const readJson = async (p, f) => { try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return f; } };
const writeJson = (p, v) => fs.writeFile(p, JSON.stringify(v, null, 2) + "\n");

const FEEDS = [
  ["OpenAI", "https://openai.com/news/rss.xml"],
  ["Google AI", "https://blog.google/technology/ai/rss/"],
  ["Google DeepMind", "https://deepmind.google/blog/rss.xml"],
  ["Hugging Face", "https://huggingface.co/blog/feed.xml"],
  ["GitHub Blog", "https://github.blog/feed/"],
  ["GitHub Changelog", "https://github.blog/changelog/feed/"],
  ["Microsoft Dev Blogs", "https://devblogs.microsoft.com/feed/"],
  ["AWS Machine Learning", "https://aws.amazon.com/blogs/machine-learning/feed/"],
  ["Node.js", "https://nodejs.org/en/feed/blog.xml"],
  ["Python Insider", "https://blog.python.org/feeds/posts/default?alt=rss"]
];
const PAGES = [["Anthropic", "https://www.anthropic.com/news"]];
const AGGREGATORS = /news\.ycombinator\.com|reddit\.com|wikipedia\.org|medium\.com|substack\.com|twitter\.com|x\.com\//i;

async function get(url, { json = false, headers = {}, timeout = 25000 } = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { "User-Agent": "Mozilla/5.0 (compatible; AgentHQ-Researcher)", ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return json ? res.json() : res.text();
}
const decode = (s = "") => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&rsquo;|&#8217;/g, "'").replace(/&quot;|&#8220;|&#8221;/g, '"').replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim();
const tag = (block, name) => { const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i")); return m ? m[1] : ""; };

function parseFeed(xml, source) {
  const items = [];
  for (const block of xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || []) {
    const link = (block.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || decode(tag(block, "link")) || decode(tag(block, "guid"));
    const when = Date.parse(decode(tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date")));
    items.push({ source, title: decode(tag(block, "title")), url: link, time: when || 0, snippet: decode(tag(block, "description") || tag(block, "summary") || tag(block, "content")).slice(0, 300), kind: "primary" });
  }
  return items;
}

async function pageText(url, max = 6000) {
  try {
    const html = await get(url);
    const body = (html.match(/<article[\s\S]*?<\/article>/i) || html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];
    return decode(body.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")).slice(0, max) || "(page was empty)";
  } catch (e) { return `(could not load: ${e.message})`; }
}

async function collect(since) {
  const all = [], notes = [];
  await Promise.all(FEEDS.map(async ([name, url]) => {
    try { all.push(...parseFeed(await get(url), name)); } catch (e) { notes.push({ name, why: e.message }); }
  }));
  for (const [name, url] of PAGES) {
    try {
      const html = await get(url);
      const seen = new Set();
      for (const m of html.matchAll(/href="(\/news\/[a-z0-9-]+)"[^>]*>([\s\S]{0,400}?)<\/a>/gi)) {
        const u = new URL(m[1], url).href;
        if (seen.has(u)) continue; seen.add(u);
        all.push({ source: name, title: decode(m[2]).slice(0, 140) || m[1], url: u, time: 0, snippet: "", kind: "primary" });
      }
    } catch (e) { notes.push({ name, why: e.message }); }
  }
  try {
    const q = encodeURIComponent("cat:cs.AI OR cat:cs.CL OR cat:cs.SE OR cat:cs.LG");
    const xml = await get(`https://export.arxiv.org/api/query?search_query=${q}&sortBy=submittedDate&sortOrder=descending&max_results=30`, { timeout: 40000 });
    all.push(...parseFeed(xml, "arXiv").map((i) => ({ ...i, kind: "paper" })));
  } catch (e) { notes.push({ name: "arXiv", why: e.message }); }
  try {
    const hn = await get(`https://hn.algolia.com/api/v1/search?tags=story&numericFilters=created_at_i>${Math.floor(since / 1000)},points>80&hitsPerPage=50`, { json: true });
    for (const h of hn.hits || []) all.push({ source: "Hacker News", title: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, discussion: `https://news.ycombinator.com/item?id=${h.objectID}`, time: h.created_at_i * 1000, snippet: `${h.points} points, ${h.num_comments} comments`, kind: h.url ? "linked" : "discussion" });
  } catch (e) { notes.push({ name: "Hacker News", why: e.message }); }
  try {
    const d = new Date(since - 6 * 86400000).toISOString().slice(0, 10);
    const r = await get(`${GH}/search/repositories?q=${encodeURIComponent(`created:>${d} stars:>100`)}&sort=stars&order=desc&per_page=15`, { json: true, headers: process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {} });
    for (const x of r.items || []) all.push({ source: "GitHub (new & rising repos)", title: `${x.full_name}: ${x.description || ""}`.slice(0, 200), url: x.html_url, time: Date.parse(x.created_at), snippet: `${x.stargazers_count} stars, ${x.language || "n/a"}`, kind: "primary" });
  } catch (e) { notes.push({ name: "GitHub search", why: e.message }); }
  if (hasExa()) {
    const day = new Date(since).toISOString().slice(0, 10);
    for (const q of ["new AI model or AI product release announced", "software development tools and frameworks: major release or change for developers", "free tier, open-source model or pricing change for AI APIs"]) {
      const rows = await exaSearch(q, { category: "news", since: day, num: 8, chars: 0, type: "fast", who: "researcher" });
      for (const r of rows) all.push({ source: "Exa web search", title: r.title, url: r.url, time: r.date ? Date.parse(r.date) : 0, snippet: r.text.slice(0, 300), kind: AGGREGATORS.test(r.url) ? "linked" : "primary" });
    }
  } else notes.push({ name: "Exa", why: "no key" });
  return { all, notes };
}

// ---------- Markdown -> Notion blocks ----------
function richText(text) {
  const out = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0, m;
  const push = (content, extra = {}) => { for (let i = 0; i < content.length; i += 1900) out.push({ type: "text", text: { content: content.slice(i, i + 1900), ...(extra.link ? { link: { url: extra.link } } : {}) }, ...(extra.bold || extra.code ? { annotations: { bold: !!extra.bold, code: !!extra.code } } : {}) }); };
  while ((m = re.exec(text))) {
    if (m.index > last) push(text.slice(last, m.index));
    m[1] ? push(m[1], { link: m[2] }) : m[3] ? push(m[3], { bold: true }) : push(m[4], { code: true });
    last = re.lastIndex;
  }
  if (last < text.length) push(text.slice(last));
  return out.slice(0, 100);
}
function toBlocks(md) {
  const blocks = [];
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)/))) { const t = `heading_${Math.min(3, m[1].length)}`; blocks.push({ type: t, [t]: { rich_text: richText(m[2]) } }); }
    else if ((m = line.match(/^(\s*)[-*]\s+(.*)/))) {
      const item = { type: "bulleted_list_item", bulleted_list_item: { rich_text: richText(m[2]) } };
      const prev = blocks.at(-1);
      if (m[1].length >= 2 && prev && /list_item/.test(prev.type)) (prev[prev.type].children ||= []).push(item);
      else blocks.push(item);
    }
    else if ((m = line.match(/^\s*\d+\.\s+(.*)/))) blocks.push({ type: "numbered_list_item", numbered_list_item: { rich_text: richText(m[1]) } });
    else if ((m = line.match(/^>\s?(.*)/))) blocks.push({ type: "quote", quote: { rich_text: richText(m[1]) } });
    else blocks.push({ type: "paragraph", paragraph: { rich_text: richText(line) } });
  }
  return blocks;
}
async function notion(path, method, body) {
  const res = await fetch(NOTION + path, { method, signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Notion ${res.status}: ${data.message || "request failed"}`);
  return data;
}
async function postToNotion(parentId, title, md) {
  const blocks = toBlocks(md);
  const page = await notion("/pages", "POST", { parent: { page_id: parentId }, icon: { type: "emoji", emoji: "🔬" }, properties: { title: { title: [{ type: "text", text: { content: title } }] } }, children: blocks.slice(0, 100) });
  for (let i = 100; i < blocks.length; i += 100) await notion(`/blocks/${page.id}/children`, "PATCH", { children: blocks.slice(i, i + 100) });
  return page.url;
}

async function main() {
  const cfg = await readJson("research.json", {});
  if (process.env.RESEARCH_MODE === "post") {
    // Re-send today's saved brief to Notion without spending any AI calls.
    if (!process.env.NOTION_TOKEN) throw new Error("NOTION_TOKEN secret is missing.");
    const md = (await fs.readFile(`reports/${date}-researcher.md`, "utf8")).replace(/^#\s.*\n+/, "");
    const url = await postToNotion(cfg.notionPageId, `AI & Dev Brief – ${date}`, md);
    console.log(`Posted to Notion: ${url}`);
    return;
  }
  const state = await readJson("research/state.json", { covered: [] });
  const covered = new Set(state.covered);
  const now = Date.now();

  // 1. Gather (code, free)
  let { all, notes } = await collect(now - 36 * 3600000);
  const fresh = (hours) => all.filter((i) => i.url && i.title && !covered.has(i.url) && (i.time === 0 || i.time > now - hours * 3600000));
  let pool = fresh(36);
  if (pool.length < 25) pool = fresh(24 * 7);
  const seenUrl = new Set();
  pool = pool.filter((i) => !seenUrl.has(i.url) && seenUrl.add(i.url)).sort((a, b) => b.time - a.time).slice(0, 140);
  console.log(`Collected ${all.length} items, ${pool.length} new candidates.${notes.length ? " Unavailable: " + notes.map((n) => `${n.name} (${n.why})`).join("; ") : ""}`);
  if (pool.length < 5) throw new Error("Too few new items to research today.");
  const list = pool.map((i, n) => `${n}. [${i.source}${i.kind === "paper" ? ", paper" : ""}] ${i.title}${i.snippet ? ` — ${i.snippet.slice(0, 160)}` : ""}`).join("\n");

  const SYSTEM = "You are the Deep Researcher on the Agent HQ team. Your reader builds free AI agents on GitHub Actions (Gemini and Groq free tiers), uses Claude daily, works only from an iPhone, and runs a small Etsy shop and a paper-trading desk. Be skeptical and precise. Prefer primary sources (official blogs, release notes, papers, repositories) over discussion and aggregators. Never invent facts or links.";

  // 2. Plan: decompose into sub-questions and pick sources
  console.log("Planning sub-questions...");
  const plan = await ask(SYSTEM, `Date: ${date}\nFocus: the latest in AI and software development${cfg.focus ? ` (${cfg.focus})` : ""}.\n\nNew items gathered today:\n${list}\n\nStep 1: decompose today's news into 3 to 5 concrete sub-questions that, answered together, give the reader the most important and useful picture (what shipped, what changed for developers, notable research, tools worth trying, anything affecting free AI usage). Step 2: for each, choose the 2-4 most authoritative item numbers. Prefer official and primary items; use Hacker News items only when they link to the primary source or when community reaction matters. Use at most 14 items total. Return JSON: {"subquestions":[{"q":"...","items":[0,5]}]}`, { json: true, temperature: 0.2 });
  const subs = (plan.subquestions || []).filter((s) => s.q && Array.isArray(s.items)).slice(0, 5);
  if (!subs.length) throw new Error("The planner returned no sub-questions.");
  const picked = [...new Set(subs.flatMap((s) => s.items.map(Number)).filter((n) => pool[n]))].slice(0, 14);

  // 3. Read sources in full (code)
  console.log(`Reading ${picked.length} sources...`);
  const sources = [];
  for (const n of picked) {
    const it = pool[n];
    const text = it.kind === "paper" ? `(arXiv abstract) ${it.snippet}` : await pageText(it.url, 4500);
    sources.push({ id: sources.length + 1, ...it, text });
  }
  const srcBlock = sources.map((s) => `[${s.id}] ${s.title}\nSource: ${s.source} | ${s.url}${s.discussion && s.discussion !== s.url ? ` | discussion: ${s.discussion}` : ""}\n${s.text}`).join("\n\n---\n\n");

  // 4. Synthesize the cited report
  console.log("Writing the report...");
  let report = await ask(SYSTEM, `Date: ${date}\n\nSub-questions:\n${subs.map((s, i) => `${i + 1}. ${s.q}`).join("\n")}\n\nSources (numbered; full text where it could be loaded):\n\n${srcBlock}\n\nWrite the daily brief in Markdown:\n- Start with "## TL;DR" and 3 bullets.\n- Then one "## " section per sub-question. Answer it with specific claims, numbers and short direct quotes from the sources. Cite every non-obvious claim inline as [n] using only the numbers above.\n- Add "## Try this" with 1-3 concrete, free things the reader could do or test (only if the sources support them).\n- End with "## Confidence & gaps": where sources disagreed or were thin (e.g. abstract-only papers, pages that didn't load, discussion-only items), which source you find more credible and why.\nIf sources conflict, say so. Don't paper over uncertainty. Do not write a sources list; it is added automatically. Keep it under 700 words.`, { temperature: 0.3 });
  report = String(report).replace(/^#\s.*\n/, "").trim();

  // 5. Citation check (code): only real sources, flag weak ones
  const used = new Set([...report.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const bad = [...used].filter((n) => !sources.find((s) => s.id === n));
  report = report.replace(/\[(\d+)\]/g, (m, n) => sources.find((s) => s.id === Number(n)) ? m : "[unverified]");
  const weak = sources.filter((s) => used.has(s.id) && (AGGREGATORS.test(s.url) || s.kind === "discussion"));
  const unloaded = sources.filter((s) => used.has(s.id) && /^\(could not load/.test(s.text));
  const srcList = sources.filter((s) => used.has(s.id)).map((s) => `- [${s.id}] [${s.title.slice(0, 120)}](${s.url}) — ${s.source}${s.kind === "paper" ? " (paper, abstract read)" : ""}${s.discussion && s.discussion !== s.url ? ` · [discussion](${s.discussion})` : ""}`);
  const check = [`- ${used.size - bad.length} sources cited, ${sources.length} read${bad.length ? `; ${bad.length} citation(s) didn't match a real source and were marked [unverified]` : "; every citation matches a source that was read"}.`,
    weak.length ? `- No stronger source was available for: ${weak.map((s) => `[${s.id}]`).join(", ")} (discussion/aggregator).` : "- All cited sources are primary (official, paper or repository) or link straight to one.",
    unloaded.length ? `- Couldn't load the full page for ${unloaded.map((s) => `[${s.id}]`).join(", ")}; those claims rest on the title and summary only.` : null,
    notes.length ? `- Sources unavailable today: ${notes.map((n) => n.name).join(", ")}.` : null].filter(Boolean);
  const full = `${report}\n\n## Citation check\n${check.join("\n")}\n\n## Sources\n${srcList.join("\n")}\n`;

  // 6. Save to the website and Notion
  await fs.mkdir("reports", { recursive: true });
  await fs.mkdir("research", { recursive: true });
  const file = `${date}-researcher.md`;
  await fs.writeFile(`reports/${file}`, `# Deep Researcher - ${date}\n\n${full}`);
  const index = await readJson("reports/index.json", []);
  await writeJson("reports/index.json", [{ file, agent: "researcher", name: "Deep Researcher", date }, ...index.filter((r) => r.file !== file)].slice(0, 300));
  state.covered = [...sources.map((s) => s.url), ...state.covered].slice(0, 1500);
  state.lastRun = date;
  if (process.env.NOTION_TOKEN && cfg.notionPageId) {
    try { const url = await postToNotion(cfg.notionPageId, `AI & Dev Brief – ${date}`, full); console.log(`Posted to Notion: ${url}`); state.lastNotion = date; }
    catch (e) { console.log(`Notion post failed: ${e.message}`); state.notionError = e.message; process.exitCode = 1; }
  } else console.log("Notion not set up yet (NOTION_TOKEN secret missing); saved to the website only.");
  await writeJson("research/state.json", state);
  console.log(`Saved reports/${file}`);
  await discordReport("researcher", `AI & Dev Brief · ${date}`, full, { file, color: 0x5865f2 });
}

main().catch(async (e) => { console.error("ERROR:", e.message); await flushUsage(); process.exit(1); });
