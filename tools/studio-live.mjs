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

await section("Google Trends: what's spiking in search right now, worldwide", async () => {
  const geos = { US: "United States", GB: "United Kingdom", CA: "Canada", JP: "Japan", KR: "South Korea", BR: "Brazil", MX: "Mexico", PH: "Philippines", IN: "India" };
  const dec = (x = "") => x.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();
  let out = "", ok = 0;
  for (const [geo, name] of Object.entries(geos)) {
    try {
      const r = await fetch(`https://trends.google.com/trending/rss?geo=${geo}`, { signal: AbortSignal.timeout(20000), headers: { "User-Agent": UA } });
      if (!r.ok) throw new Error(`${r.status}`);
      const items = [...(await r.text()).matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 12).map(([, it]) => {
        const g = (t) => dec((it.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)) || [])[1]);
        return `${g("title")} (${g("ht:approx_traffic") || "?"}${g("ht:news_item_title") ? `; "${g("ht:news_item_title").slice(0, 90)}"` : ""})`;
      });
      out += `\n- **${name}:** ${items.join(" · ") || "none"}`; ok++;
    } catch (e) { out += `\n- **${name}:** unavailable (${e.message})`; }
  }
  if (!ok) throw new Error("all Google Trends feeds failed");
  return "Searches spiking in the last 24h per country (approx. searches). Pick out movies, shows, anime, games, actors and music." + out;
});

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

await section("MyAnimeList: anime airing this season and top airing now", async () => {
  const season = await get("https://api.jikan.moe/v4/seasons/now?limit=15&sfw=true");
  await new Promise((r) => setTimeout(r, 1200)); // Jikan allows ~3 requests a second
  const top = await get("https://api.jikan.moe/v4/top/anime?filter=airing&limit=10&sfw=true");
  const row = (a) => `- [${a.title_english || a.title}](${a.url}) · score ${a.score ?? "?"} · ${n(a.members)} members${a.episodes ? ` · ${a.episodes} eps` : ""}${a.broadcast?.string ? ` · airs ${a.broadcast.string}` : ""}`;
  const pop = [...(season.data || [])].sort((a, b) => (b.members || 0) - (a.members || 0));
  return `### This season, most followed\n${pop.map(row).join("\n")}\n\n### Top airing right now\n${(top.data || []).map(row).join("\n")}`;
});

await section("Twitch: most-watched games and streams right now", async () => {
  const id = process.env.TWITCH_CLIENT_ID?.trim(), secret = process.env.TWITCH_CLIENT_SECRET?.trim();
  if (!id || !secret) throw new Error("no TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET");
  const tok = await get(`https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`, { method: "POST" });
  const H = { headers: { "Client-Id": id, Authorization: `Bearer ${tok.access_token}` } };
  const games = await get("https://api.twitch.tv/helix/games/top?first=20", H);
  const streams = await get("https://api.twitch.tv/helix/streams?first=20", H);
  const viewers = {};
  for (const s of streams.data || []) viewers[s.game_name] = (viewers[s.game_name] || 0) + s.viewer_count;
  return `### Top games by viewers now\n${(games.data || []).map((g, i) => `${i + 1}. ${g.name}`).join(" · ")}\n\n### Biggest live streams now\n${(streams.data || []).slice(0, 12).map((s) => `- ${s.user_name} · ${s.game_name} · ${n(s.viewer_count)} watching · "${String(s.title).slice(0, 80)}"`).join("\n")}`;
});

await section("Last.fm: songs rising right now (for TikTok sound ideas)", async () => {
  const key = process.env.LASTFM_API_KEY?.trim();
  if (!key) throw new Error("no LASTFM_API_KEY");
  const lf = (q) => get(`https://ws.audioscrobbler.com/2.0/?${q}&api_key=${key}&format=json&limit=20`);
  const world = await lf("method=chart.gettoptracks");
  const us = await lf("method=geo.gettoptracks&country=united%20states");
  const row = (t) => `${t.name} - ${t.artist?.name || t.artist?.["#text"] || ""} (${n(t.listeners)} listeners)`;
  return `### Worldwide\n${(world.tracks?.track || []).map(row).join(" · ")}\n\n### United States\n${(us.tracks?.track || []).map(row).join(" · ")}`;
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
