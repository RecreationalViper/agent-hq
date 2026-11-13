// Studio YouTube scanner (YouTube Data API v3, free key, ~10 of 10,000 daily units per run).
// Writes studio/youtube-trends.md (what's trending in Film & Animation, Gaming, Entertainment)
// and, once a channel handle is in studio/channels.json, studio/channel-stats.md + history.
// Needs the YOUTUBE_API_KEY secret; without it, it writes a note and exits cleanly.
import fs from "node:fs/promises";

const KEY = process.env.YOUTUBE_API_KEY?.trim();
const API = "https://www.googleapis.com/youtube/v3";
const CATS = { 1: "Film & Animation", 20: "Gaming", 24: "Entertainment" };
const today = new Date().toISOString().slice(0, 10);
await fs.mkdir("studio", { recursive: true });

async function yt(path, params) {
  const q = new URLSearchParams({ ...params, key: KEY });
  const r = await fetch(`${API}/${path}?${q}`, { signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`YouTube ${r.status}: ${j.error?.message || "error"}`);
  return j;
}
const secs = (d = "") => { const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) || []; return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0); };
const n = (x) => Number(x || 0).toLocaleString("en-US");
const hours = (t) => Math.max(1, (Date.now() - new Date(t).getTime()) / 36e5);

if (!KEY) {
  await fs.writeFile("studio/youtube-trends.md", `# YouTube trends (${today})\n\n(no YOUTUBE_API_KEY secret yet, so there is no live YouTube data; say so and don't invent numbers)\n`);
  console.log("YouTube scanner: no YOUTUBE_API_KEY, skipped");
  process.exit(0);
}

let md = `# YouTube trends, US (${today})\n\nLive from the YouTube Data API. Views/hr = views since upload ÷ hours since upload.\n`;
for (const [id, name] of Object.entries(CATS)) {
  try {
    const { items = [] } = await yt("videos", { part: "snippet,statistics,contentDetails", chart: "mostPopular", regionCode: "US", videoCategoryId: id, maxResults: 50 });
    const rows = items.map((v) => ({ t: v.snippet.title, c: v.snippet.channelTitle, id: v.id, views: +v.statistics.viewCount || 0, likes: +v.statistics.likeCount || 0, com: +v.statistics.commentCount || 0, len: secs(v.contentDetails.duration), vph: (+v.statistics.viewCount || 0) / hours(v.snippet.publishedAt) }));
    const short = rows.filter((r) => r.len && r.len <= 180).sort((a, b) => b.vph - a.vph).slice(0, 8);
    const top = rows.sort((a, b) => b.vph - a.vph).slice(0, 8);
    const line = (r) => `- [${r.t}](https://youtu.be/${r.id}) · ${r.c} · ${n(r.views)} views · ${n(Math.round(r.vph))}/hr · ${n(r.likes)} likes · ${n(r.com)} comments · ${Math.floor(r.len / 60)}:${String(r.len % 60).padStart(2, "0")}`;
    md += `\n## ${name}: fastest-rising\n${top.map(line).join("\n") || "- none"}\n\n## ${name}: short videos (3 min or less)\n${short.map(line).join("\n") || "- none in the chart today"}\n`;
  } catch (e) { md += `\n## ${name}\n(unavailable: ${e.message})\n`; }
}
await fs.writeFile("studio/youtube-trends.md", md);
console.log("YouTube scanner: wrote studio/youtube-trends.md");

// Our own channel(s)
const ch = JSON.parse(await fs.readFile("studio/channels.json", "utf8").catch(() => "{}"));
const handle = (ch.youtube || "").trim();
if (!handle) { console.log("YouTube scanner: no YouTube handle in studio/channels.json yet"); process.exit(0); }
try {
  const { items: [c] = [] } = await yt("channels", { part: "statistics,contentDetails,snippet", forHandle: handle.replace(/^@?/, "@") });
  if (!c) throw new Error(`no channel found for ${handle}`);
  const st = c.statistics;
  const up = c.contentDetails.relatedPlaylists.uploads;
  const { items: pl = [] } = await yt("playlistItems", { part: "contentDetails", playlistId: up, maxResults: 15 });
  const ids = pl.map((p) => p.contentDetails.videoId).join(",");
  const vids = ids ? (await yt("videos", { part: "snippet,statistics,contentDetails", id: ids })).items || [] : [];
  const histFile = "studio/channel-history.json";
  const hist = JSON.parse(await fs.readFile(histFile, "utf8").catch(() => "[]")).filter((h) => h.date !== today);
  hist.push({ date: today, subs: +st.subscriberCount || 0, views: +st.viewCount || 0, videos: +st.videoCount || 0 });
  await fs.writeFile(histFile, JSON.stringify(hist.slice(-120), null, 2) + "\n");
  const prev = hist.at(-8) || hist[0];
  let out = `# Our YouTube channel: ${c.snippet.title} (${today})\n\n- Subscribers: ${n(st.subscriberCount)}${st.hiddenSubscriberCount ? " (hidden)" : ""} (${prev ? `+${n((+st.subscriberCount || 0) - prev.subs)} since ${prev.date}` : ""})\n- Total views: ${n(st.viewCount)} (+${n((+st.viewCount || 0) - (prev?.views || 0))} since ${prev?.date})\n- Videos: ${n(st.videoCount)}\n\n## Latest uploads\n`;
  out += vids.map((v) => `- [${v.snippet.title}](https://youtu.be/${v.id}) · ${v.snippet.publishedAt.slice(0, 10)} · ${n(v.statistics.viewCount)} views · ${n(v.statistics.likeCount)} likes · ${n(v.statistics.commentCount)} comments · ${secs(v.contentDetails.duration)}s`).join("\n") || "- none yet";
  await fs.writeFile("studio/channel-stats.md", out + "\n");
  console.log("YouTube scanner: wrote studio/channel-stats.md");
} catch (e) {
  await fs.writeFile("studio/channel-stats.md", `# Our YouTube channel (${today})\n\n(unavailable: ${e.message})\n`);
  console.log(`YouTube scanner: channel stats failed: ${e.message}`);
}
