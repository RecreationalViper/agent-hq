// Studio live data: free, real-time signals for the studio agents, written to studio/live-data.md.
// - Wikipedia: yesterday's most-read English articles (what people are looking up right now). No key.
// - AniList: trending anime right now and next episodes. No key.
// - Steam: top sellers and new releases. No key.
// - YouTube: the most-viewed short edits from the last 7 days in our niches (needs YOUTUBE_API_KEY; ~303 units).
// - TMDB: trending movies and shows today (optional TMDB_API_KEY, free).
// Each source fails on its own without stopping the others.
import fs from "node:fs/promises";

const UA = "AgentHQ-Studio/1.0 (https://github.com/RecreationalViper/agent-hq)";
const today = new Date().toISOString().slice(0, 10);
const n = (x) => Number(x || 0).toLocaleString("en-US");
const get = async (url, init = {}) => {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(30000), headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
};
const sections = [];
async function section(title, fn) {
  try { sections.push(`## ${title}\n${await fn()}`); console.log(`studio-live: ${title} ok`); }
  catch (e) { sections.push(`## ${title}\n(unavailable today: ${e.message})`); console.log(`studio-live: ${title} failed: ${e.message}`); }
}

await section("Wikipedia: most-read articles yesterday (what people are curious about)", async () => {
  for (const back of [1, 2]) {
    const d = new Date(Date.now() - back * 864e5);
    const ymd = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
    try {
      const j = await get(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${ymd}`);
      const skip = /^(Main_Page|Special:|Wikipedia:|Portal:|File:|Help:|Talk:|Category:|Template:|Deaths_in|List_of_|-)/;
      const rows = (j.items?.[0]?.articles || []).filter((a) => !skip.test(a.article)).slice(0, 50);
      return `Date: ${ymd}. Pick out the movies, shows, anime, games and actors.\n` + rows.map((a) => `- ${a.article.replace(/_/g, " ")}: ${n(a.views)} views`).join("\n");
    } catch (e) { if (back === 2) throw e; }
  }
});

await section("AniList: trending anime right now", async () => {
  const query = `{ Page(perPage: 15) { media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { title { english romaji } trending popularity averageScore status episodes nextAiringEpisode { episode airingAt } siteUrl } } }`;
  const j = await get("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
  return (j.data?.Page?.media || []).map((m) => {
    const next = m.nextAiringEpisode ? ` · ep ${m.nextAiringEpisode.episode} airs ${new Date(m.nextAiringEpisode.airingAt * 1000).toISOString().slice(0, 10)}` : "";
    return `- [${m.title.english || m.title.romaji}](${m.siteUrl}) · trending score ${m.trending} · ${n(m.popularity)} fans · ${m.averageScore ?? "?"}% · ${m.status}${next}`;
  }).join("\n");
});

await section("Steam: top sellers and new releases (US)", async () => {
  const j = await get("https://store.steampowered.com/api/featuredcategories?cc=us&l=en");
  const list = (k) => (j[k]?.items || []).slice(0, 10).map((g) => g.name).filter(Boolean);
  return `- Top sellers: ${list("top_sellers").join(", ") || "none"}\n- New releases: ${list("new_releases").join(", ") || "none"}\n- Coming soon: ${list("coming_soon").join(", ") || "none"}`;
});

const YT = process.env.YOUTUBE_API_KEY?.trim();
await section("YouTube: most-viewed short edits from the last 7 days", async () => {
  if (!YT) throw new Error("no YOUTUBE_API_KEY");
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  let out = "";
  for (const q of ["movie edit", "anime edit", "gaming edit"]) {
    const s = await get(`https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({ part: "snippet", q, type: "video", videoDuration: "short", order: "viewCount", publishedAfter: since, regionCode: "US", relevanceLanguage: "en", maxResults: "10", key: YT })}`);
    const ids = (s.items || []).map((i) => i.id.videoId).filter(Boolean).join(",");
    if (!ids) { out += `\n### "${q}"\n- none found\n`; continue; }
    const v = await get(`https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({ part: "snippet,statistics", id: ids, key: YT })}`);
    out += `\n### "${q}"\n` + (v.items || []).map((x) => `- [${x.snippet.title}](https://youtu.be/${x.id}) · ${x.snippet.channelTitle} · ${n(x.statistics.viewCount)} views · ${n(x.statistics.likeCount)} likes · ${n(x.statistics.commentCount)} comments · ${x.snippet.publishedAt.slice(0, 10)}`).join("\n") + "\n";
  }
  return out.trim();
});

const TMDB = process.env.TMDB_API_KEY?.trim();
await section("TMDB: trending movies and shows today", async () => {
  if (!TMDB) throw new Error("no TMDB_API_KEY (optional, free at themoviedb.org)");
  const bearer = TMDB.length > 40;
  const j = await get(`https://api.themoviedb.org/3/trending/all/day?language=en-US${bearer ? "" : `&api_key=${TMDB}`}`, bearer ? { headers: { Authorization: `Bearer ${TMDB}` } } : {});
  return (j.results || []).slice(0, 15).map((r) => `- ${r.title || r.name} (${r.media_type}, ${(r.release_date || r.first_air_date || "").slice(0, 4) || "?"}) · popularity ${Math.round(r.popularity)}`).join("\n");
});

await fs.mkdir("studio", { recursive: true });
await fs.writeFile("studio/live-data.md", `# Live data (${today})\n\nCollected minutes before this run from free public sources. These numbers are real; quote them, and don't invent others.\n\n${sections.join("\n\n")}\n`);
console.log("studio-live: wrote studio/live-data.md");
