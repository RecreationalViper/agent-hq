// Competitor Radar data: once a week, the top recent TikTok edits in our niches via ScrapeCreators
// (~3 credits: one keyword search per niche). Writes studio/competitor-data.md for the Competitor Radar agent.
// Read-only: it never downloads or reposts anyone's video.
import fs from "node:fs/promises";

const KEY = (process.env.SCRAPCREATOR_API_KEY || process.env.SCRAPECREATOR_API_KEY || process.env.SCRAPECREATORS_API_KEY || "").trim();
const OUT = "studio/competitor-data.md";
const today = new Date().toISOString().slice(0, 10);
if (!KEY) { console.log("Competitor radar: no ScrapeCreators key set, skipping"); process.exit(0); }
const last = (await fs.readFile(OUT, "utf8").catch(() => "")).match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1];
if (last && (Date.parse(today) - Date.parse(last)) / 86400000 < 6 && !process.env.FORCE) { console.log(`Competitor radar: last run ${last}, saving credits until next week`); process.exit(0); }

const NICHES = ["movie edit", "anime edit", "gaming edit"];
const n = (x) => (x === undefined || x === null ? "?" : Number(x).toLocaleString("en-US"));
let md = `# Competitor Radar data (${today})\n\nTop recent TikTok edits per niche (live from ScrapeCreators, most-played first).\n`;
for (const q of NICHES) {
  try {
    const res = await fetch(`https://api.scrapecreators.com/v1/tiktok/search/keyword?${new URLSearchParams({ query: q, date_posted: "this-week", sort_by: "most-liked" })}`, { headers: { "x-api-key": KEY }, signal: AbortSignal.timeout(60000) });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 160)}`);
    const d = JSON.parse(text);
    const items = (d.search_item_list || d.aweme_list || d.data || []).map((x) => x.aweme_info || x).filter((a) => a?.statistics || a?.stats);
    items.sort((a, b) => ((b.statistics || b.stats).play_count || 0) - ((a.statistics || a.stats).play_count || 0));
    md += `\n## "${q}"\n` + (items.slice(0, 10).map((a) => {
      const s = a.statistics || a.stats, who = a.author?.unique_id || a.author?.uniqueId || "?";
      const url = a.share_url?.split("?")[0] || (a.aweme_id ? `https://www.tiktok.com/@${who}/video/${a.aweme_id}` : "");
      const when = a.create_time ? new Date(a.create_time * 1000).toISOString().slice(0, 10) : "";
      const secs = a.video?.duration ? Math.round(a.video.duration > 1000 ? a.video.duration / 1000 : a.video.duration) : "?";
      return `- @${who} · ${when} · ${secs}s · ${n(s.play_count)} views · ${n(s.digg_count)} likes · ${n(s.share_count)} shares · "${(a.desc || "").replace(/\s+/g, " ").slice(0, 120)}" ${url}`;
    }).join("\n") || "- nothing returned") + "\n";
  } catch (e) { md += `\n## "${q}"\n(unavailable: ${e.message})\n`; }
}
await fs.writeFile(OUT, md);
console.log(`Competitor radar: wrote ${OUT}`);
