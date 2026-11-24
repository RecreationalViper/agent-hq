// Our own TikTok + Instagram stats via ScrapeCreators (YouTube is covered free by youtube-trends.mjs).
// Credits do NOT reset daily, so this runs at most once per day: ~3 credits (TikTok profile,
// TikTok videos, Instagram profile). Writes studio/social-stats.md + studio/social-history.json.
import fs from "node:fs/promises";

const KEY = (process.env.SCRAPCREATOR_API_KEY || process.env.SCRAPECREATORS_API_KEY || process.env.SCRAPECREATOR_API_KEY || "").trim();
const today = new Date().toISOString().slice(0, 10);
const OUT = "studio/social-stats.md", HIST = "studio/social-history.json";
if (!KEY) { console.log("Social stats: no SCRAPCREATOR_API_KEY set, skipping"); process.exit(0); }

const hist = JSON.parse(await fs.readFile(HIST, "utf8").catch(() => "[]"));
if (hist.some((h) => h.date === today)) { console.log("Social stats: already ran today, saving credits"); process.exit(0); }

const ch = JSON.parse(await fs.readFile("studio/channels.json", "utf8").catch(() => "{}"));
const handle = (h) => (h || "").replace(/^@/, "").trim();
const tt = handle(ch.tiktok), ig = handle(ch.instagram);

async function sc(path, params) {
  const res = await fetch(`https://api.scrapecreators.com${path}?${new URLSearchParams(params)}`, { headers: { "x-api-key": KEY }, signal: AbortSignal.timeout(60000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 160)}`);
  return JSON.parse(text);
}
// Field names differ by platform/version: search the response for the first matching key.
function find(obj, keys, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 6) return undefined;
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null && typeof obj[k] !== "object") return obj[k];
  for (const k of keys) if (obj[k]?.count !== undefined) return obj[k].count; // Instagram edge_* shape
  for (const v of Object.values(obj)) { const r = find(v, keys, depth + 1); if (r !== undefined) return r; }
}
const n = (x) => (x === undefined || x === "" ? "?" : Number(x).toLocaleString("en-US"));
const entry = { date: today };
let md = `# Our TikTok + Instagram (${today})\n\n`;

if (tt) {
  try {
    const p = await sc("/v1/tiktok/profile", { handle: tt });
    entry.tiktok = { followers: +find(p, ["followerCount", "follower_count"]) || 0, likes: +find(p, ["heartCount", "heart", "total_favorited"]) || 0, videos: +find(p, ["videoCount", "aweme_count"]) || 0 };
    md += `## TikTok @${tt}\n- Followers: ${n(entry.tiktok.followers)}\n- Total likes: ${n(entry.tiktok.likes)}\n- Videos: ${n(entry.tiktok.videos)}\n`;
    try {
      const v = await sc("/v3/tiktok/profile/videos", { handle: tt });
      const list = v.aweme_list || v.videos || v.data || [];
      md += `\n### Latest TikToks\n` + (list.slice(0, 12).map((a) => {
        const s = a.statistics || a.stats || {};
        const when = a.create_time ? new Date(a.create_time * 1000).toISOString().slice(0, 10) : "";
        const title = (a.desc || a.title || "untitled").replace(/\s+/g, " ").slice(0, 80);
        return `- ${when} · ${title} · ${n(s.play_count ?? s.playCount)} views · ${n(s.digg_count ?? s.diggCount)} likes · ${n(s.comment_count ?? s.commentCount)} comments · ${n(s.share_count ?? s.shareCount)} shares`;
      }).join("\n") || "- none found") + "\n";
    } catch (e) { md += `\n(latest TikToks unavailable: ${e.message})\n`; }
  } catch (e) { md += `## TikTok @${tt}\n(unavailable: ${e.message})\n`; }
}
if (ig) {
  try {
    const p = await sc("/v1/instagram/profile", { handle: ig });
    entry.instagram = { followers: +find(p, ["edge_followed_by", "follower_count", "followers"]) || 0, posts: +find(p, ["edge_owner_to_timeline_media", "media_count"]) || 0 };
    md += `\n## Instagram @${ig}\n- Followers: ${n(entry.instagram.followers)}\n- Posts: ${n(entry.instagram.posts)}\n`;
    const posts = p?.data?.user?.edge_owner_to_timeline_media?.edges || [];
    if (posts.length) md += `\n### Latest posts\n` + posts.slice(0, 12).map(({ node: x }) => `- ${x.taken_at_timestamp ? new Date(x.taken_at_timestamp * 1000).toISOString().slice(0, 10) : ""} · ${x.is_video ? `${n(x.video_view_count)} views · ` : ""}${n(x.edge_liked_by?.count ?? x.edge_media_preview_like?.count)} likes · ${n(x.edge_media_to_comment?.count)} comments`).join("\n") + "\n";
  } catch (e) { md += `\n## Instagram @${ig}\n(unavailable: ${e.message})\n`; }
}
const prev = hist.at(-7);
if (prev) {
  md += `\n## Change since ${prev.date}\n`;
  if (entry.tiktok && prev.tiktok) md += `- TikTok followers: ${entry.tiktok.followers - prev.tiktok.followers >= 0 ? "+" : ""}${n(entry.tiktok.followers - prev.tiktok.followers)}\n`;
  if (entry.instagram && prev.instagram) md += `- Instagram followers: ${entry.instagram.followers - prev.instagram.followers >= 0 ? "+" : ""}${n(entry.instagram.followers - prev.instagram.followers)}\n`;
}
try { const b = await sc("/v1/account/credit-balance", {}); const left = find(b, ["creditCount", "credits", "credit_balance", "balance"]); if (left !== undefined) { entry.creditsLeft = +left; md += `\n_ScrapeCreators credits left: ${n(left)}_\n`; } } catch {}

hist.push(entry);
await fs.writeFile(HIST, JSON.stringify(hist.slice(-180), null, 2) + "\n");
await fs.writeFile(OUT, md);
console.log(`Social stats: wrote ${OUT}`);
