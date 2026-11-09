// Content Creator: turns the Content Planner's ideas into finished, ready-to-post content.
// Runs twice a week (content-creator.yml). For each run it:
//   1. reads the team's latest reports (Content Planner, SEO Scout, Competitor Scout, Listing Writer, Weekly Review)
//      and its own notes, so it builds on their work and never repeats itself;
//   2. gathers fresh data: Google autocomplete (free) and Exa trend searches (within the free budget);
//   3. writes 5 posts with the strongest available model (Gemini Pro first, then the backups);
//   4. designs the images itself: Pinterest pins (1000x1500) and story/TikTok covers (1080x1920), using the
//      real product previews, the brand art, and AI-painted backgrounds (Cloudflare FLUX, free; or ART_API_KEY);
//   5. posts every image with its caption to Discord #content, ready to save from the phone;
//   6. leaves notes for the Planner and SEO Scout (content/notes.md) and a report the Weekly Review reads.
// It never publishes anywhere itself: the owner posts what they like.
//
// Usage: node content-creator.mjs            (CREATOR_POSTS=5, CREATOR_DRY=1 skips Discord)
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ask } from "./ai-ask.mjs";
import { hasExa, researchBlock } from "./exa.mjs";
import { seoResearch } from "./seo.mjs";
import { report, postFiles, alert } from "./discord.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const TZ = "America/New_York";
const DATE = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const COUNT = Number(process.env.CREATOR_POSTS || 5);
const DRY = process.env.CREATOR_DRY === "1";
const STORE = "payhip.com/b/vqNSA";

// Only products that are live for sale. Add the Complete Suites here once they're listed on Payhip.
const PRODUCT_IMAGES = {
  "program-cover": "store/img/program-cover.png",
  "program-inside": "store/img/program-inside.png",
  "welcome-sign": "store/img/welcome-sign.png",
  "memory-card": "store/img/memory-card.png"
};

const read = (p, fallback = "") => fs.readFile(path.resolve(HERE, p), "utf8").catch(() => fallback);
const url = (p) => pathToFileURL(path.join(HERE, p)).href;

// ---------- 1. What the team has said ----------
async function teamBrief() {
  let index = [];
  try { index = JSON.parse(await read("reports/index.json", "[]")); } catch {}
  const want = { content: 6000, seo: 5000, "competitor-scout": 2500, listing: 2000, review: 2000, ideas: 1500 };
  let out = "";
  for (const [id, max] of Object.entries(want)) {
    const r = index.find((x) => x.agent === id);
    if (!r) continue;
    const body = (await read(`reports/${r.file}`)).replace(/^# .*\n+/, "");
    out += `\n\n### ${r.name} (${r.date})\n${body.slice(0, max)}`;
  }
  return out || "\n\n(No team reports yet.)";
}

// ---------- 2. Fresh data ----------
async function freshData() {
  let text = "";
  const seo = await seoResearch({
    seeds: ["funeral program", "celebration of life", "memorial printable", "funeral welcome sign", "share a memory card"],
    modifiers: ["ideas", "template", "diy"]
  }).catch(() => null);
  if (seo?.text) text += `\n\n## Google autocomplete (what people type right now)\n${seo.text.slice(0, 5000)}`;
  if (hasExa()) {
    const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const r = await researchBlock([
      { query: "Pinterest trends celebration of life memorial ideas", since, num: 4, chars: 700 },
      { query: "funeral planning tips families share on TikTok and Instagram", since, num: 4, chars: 700 }
    ], "content-creator").catch(() => ({ results: [] }));
    console.log(`  Exa: ${r.results.length} trend results`);
    if (r.results.length) text += `\n\n## Recent web results (Exa)\n${r.text}`;
  }
  return text;
}

// ---------- 3. Writing ----------
const SYSTEM = `You are "Content Creator", the social media designer and copywriter on the Forever Held team.
Forever Held sells printable, editable memorial kits (funeral/celebration of life program, welcome sign, share-a-memory cards) in a soft botanical sage-and-cream style. Live product: https://${STORE} ($12.99). Buyers are grieving families, often planning a service in a few days, mostly on phones.
Voice: warm, calm, practical, quietly reassuring. Never salesy about grief, no urgency tricks, no "limited time", no emojis in headlines, never mention death in a shocking way. Lead with help (a tip, a checklist, a comforting idea), mention the kit gently.
Rules: drafts only - the owner decides what to post. Never invent reviews, testimonials, customer stories, statistics or prices other than $12.99. Disclose nothing false. Use keywords from the real SEO data naturally. Return valid JSON only.`;

function writePrompt(team, data, history) {
  return `Today is ${DATE}. Create ${COUNT} finished social posts for this week, built on the team's work below (start from the Content Planner's ideas; use the SEO Scout's keywords and pin titles; avoid what competitors overdo).

Mix: ${Math.max(COUNT - 2, 1)} Pinterest pins (format "pin") and 2 vertical TikTok/Reels/Instagram story posts (format "story"). Every post must be different in angle (tip, checklist, comfort, how-it-works, keepsake idea...).
Do NOT repeat these recent headlines: ${history.slice(0, 30).join(" | ") || "(none yet)"}

Return JSON:
{
 "theme": "one line: this week's content angle",
 "posts": [{
   "format": "pin" | "story",
   "platform": "Pinterest" | "TikTok / Reels" | "Instagram",
   "headline": "text ON the image, max 7 words, sentence case",
   "subline": "text ON the image under the headline, max 14 words",
   "product_image": "program-cover" | "program-inside" | "welcome-sign" | "memory-card",
   "background": "botanical" | "painted",
   "art_prompt": "for painted backgrounds: a soft watercolor scene (flowers, leaves, light, candles, paper) with NO text, NO people, calm cream/sage palette, empty space in the center",
   "pin_title": "Pinterest title, max 100 chars, keyword first (pins only, else empty)",
   "caption": "the post text / pin description, 2-4 short lines, ends with a gentle pointer to the shop",
   "hashtags": ["5-8 relevant tags without #"],
   "alt_text": "describe the image for accessibility",
   "video_script": "stories only: hook line, 3 short beats with what to show on screen, closing line (20-30 seconds). Empty for pins.",
   "keywords": ["the SEO phrases this post targets"]
 }],
 "notes_for_planner": "3-5 bullets: what you made, which planner ideas you used or skipped and why, what to plan next",
 "requests_for_seo": "1-3 keyword questions you want the SEO Scout to research next week",
 "requests_for_owner": "anything the owner should decide (or empty)"
}

# Team reports${team}

# Fresh data${data || "\n(none today)"}`;
}

// ---------- 4. Art ----------
const ART_STYLE = "soft watercolor illustration on warm cream paper, muted sage green and dusty blush, delicate botanical leaves and small white flowers, gentle natural light, calm and peaceful, large empty cream space in the center for text, no text, no letters, no words, no people, no faces";

async function paint(prompt) {
  const full = `${prompt}. ${ART_STYLE}`;
  // Owner's dedicated art AI goes here first once its key is added (ART_API_KEY); see README.
  if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
        method: "POST", signal: AbortSignal.timeout(90000),
        headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: full.slice(0, 2000), steps: 8 })
      });
      const j = await res.json().catch(() => ({}));
      const b64 = j.result?.image;
      if (res.ok && b64) { console.log("  painted a background (Cloudflare FLUX)"); return `data:image/jpeg;base64,${b64}`; }
      console.log(`  painting skipped: ${j.errors?.[0]?.message || `HTTP ${res.status}`}`);
    } catch (e) { console.log(`  painting skipped: ${e.message}`); }
  }
  return null;
}

// ---------- 5. Design ----------
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function pageHtml(post, painted) {
  const story = post.format === "story";
  const W = story ? 1080 : 1000, H = story ? 1920 : 1500;
  const img = url(PRODUCT_IMAGES[post.product_image] || PRODUCT_IMAGES["program-cover"]);
  const bg = painted
    ? `<img class="paint" src="${painted}"><div class="veil"></div>`
    : `<img class="art top" src="${url("products/fillable/art/sign-top.png")}"><img class="art bottom" src="${url("products/fillable/art/spray.png")}">`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Cormorant;src:url(${url("products/fillable/fonts/CormorantGaramond.ttf")})}
@font-face{font-family:Cormorant;font-style:italic;src:url(${url("products/fillable/fonts/CormorantGaramond-Italic.ttf")})}
@font-face{font-family:Cinzel;src:url(${url("products/fillable/fonts/Cinzel.ttf")})}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;background:#f7f3ec;overflow:hidden;position:relative;font-family:Cormorant;color:#3d4a36}
.paint{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.veil{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,rgba(247,243,236,.92) 0%,rgba(247,243,236,.78) 45%,rgba(247,243,236,.35) 100%)}
.art{position:absolute;left:50%;transform:translateX(-50%);opacity:.95}
.art.top{top:-${story ? 20 : 34}px;width:${story ? 680 : 600}px}
.art.bottom{bottom:${story ? 70 : 34}px;width:${story ? 420 : 360}px}
.frame{position:absolute;inset:${story ? 36 : 28}px;border:1.5px solid rgba(109,127,95,.35)}
.wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;text-align:center;padding:${story ? "330px 90px 330px" : "250px 80px 236px"}}
.brand{font-family:Cinzel;font-size:${story ? 26 : 22}px;letter-spacing:.42em;color:#6d7f5f;margin-bottom:${story ? 34 : 26}px}
h1{font-weight:500;font-size:${story ? 96 : 82}px;line-height:1.02;max-width:${story ? 900 : 840}px;letter-spacing:-.005em;text-wrap:balance}
.sub{font-style:italic;font-size:${story ? 42 : 36}px;line-height:1.25;color:#5f6e56;max-width:${story ? 820 : 760}px;margin-top:${story ? 26 : 20}px;text-wrap:balance}
.product{margin-top:${story ? 64 : 46}px;background:#fff;padding:${story ? 16 : 14}px;box-shadow:0 18px 40px -18px rgba(61,74,54,.45),0 2px 6px rgba(61,74,54,.12);transform:rotate(-1.2deg)}
.product img{display:block;max-width:${story ? 640 : 600}px;max-height:${story ? 640 : 470}px;object-fit:contain}
.foot{margin-top:auto;font-style:italic;font-size:${story ? 34 : 29}px;color:#5f6e56}
.foot b{font-style:normal;font-family:Cinzel;font-weight:400;font-size:.62em;letter-spacing:.3em;display:block;margin-top:10px;color:#6d7f5f}
</style></head><body>${bg}<div class="frame"></div>
<div class="wrap"><div class="brand">FOREVER HELD</div><h1>${esc(post.headline)}</h1>${post.subline ? `<p class="sub">${esc(post.subline)}</p>` : ""}
<div class="product"><img src="${img}"></div>
<div class="foot">Editable printable memorial kit<b>INSTANT DOWNLOAD</b></div></div></body></html>`;
}

function loadPlaywright() {
  try { return require("playwright"); } catch {}
  return createRequire(path.join(process.env.NODE_PATH || "/usr/local/lib/node_modules", "x"))("playwright");
}

// ---------- main ----------
async function main() {
  console.log(`Content Creator ${DATE}: ${COUNT} posts${DRY ? " (dry run, no Discord)" : ""}`);
  const notesBefore = await read("content/notes.md");
  let history = [];
  try { history = JSON.parse(await read("content/history.json", "[]")); } catch {}

  let plan;
  if (process.env.CREATOR_SAMPLE) plan = JSON.parse(await read(process.env.CREATOR_SAMPLE)); // design test without AI
  else {
    const [team, data] = await Promise.all([teamBrief(), freshData()]);
    const prompt = writePrompt(team + (notesBefore ? `\n\n### Your own notes from last time\n${notesBefore.slice(0, 2000)}` : ""), data, history);
    plan = await ask(SYSTEM, prompt, { json: true, strong: true, temperature: 0.75 });
  }
  const posts = (plan.posts || []).filter((p) => p?.headline).slice(0, COUNT);
  if (!posts.length) throw new Error("The writer returned no posts.");

  const dir = path.join(HERE, "content", DATE);
  await fs.mkdir(dir, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const made = [];
  try {
    for (const [i, post] of posts.entries()) {
      const story = post.format === "story";
      const painted = post.background === "painted" ? await paint(post.art_prompt || post.headline) : null;
      const page = await browser.newPage({ viewport: { width: story ? 1080 : 1000, height: story ? 1920 : 1500 } });
      const html = path.join(dir, `_${i}.html`);
      await fs.writeFile(html, pageHtml(post, painted));
      await page.goto(pathToFileURL(html).href, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const name = `${DATE}-${i + 1}-${story ? "story" : "pin"}.jpg`;
      const data = await page.screenshot({ type: "jpeg", quality: 90 });
      await fs.writeFile(path.join(dir, name), data);
      await fs.unlink(html);
      await page.close();
      made.push({ post, name, data });
      console.log(`  designed ${name}`);
    }
  } finally { await browser.close(); }

  // Report (the Weekly Review and the site read this)
  const tags = (p) => (p.hashtags || []).map((t) => "#" + String(t).replace(/^#/, "").replace(/\s+/g, "")).join(" ");
  let md = `**This week:** ${plan.theme || ""}\n\n${made.length} posts designed and sent to Discord #content (images there, ready to save).\n`;
  for (const [i, { post, name }] of made.entries()) {
    md += `\n## ${i + 1}. ${post.platform}: ${post.headline}\n`;
    if (post.pin_title) md += `- **Pin title:** ${post.pin_title}\n`;
    md += `- **Caption:** ${post.caption}\n- **Tags:** ${tags(post)}\n- **Alt text:** ${post.alt_text || ""}\n- **Image:** ${name}\n`;
    if (post.video_script) md += `- **Video script:** ${post.video_script}\n`;
  }
  md += `\n## Notes for the Content Planner\n${plan.notes_for_planner || "-"}\n\n## Requests for the SEO Scout\n${plan.requests_for_seo || "-"}\n`;
  if (plan.requests_for_owner) md += `\n## For the owner to decide\n${plan.requests_for_owner}\n`;

  await fs.mkdir(path.join(HERE, "reports"), { recursive: true });
  const file = `${DATE}-content-creator.md`;
  await fs.writeFile(path.join(HERE, "reports", file), `# Content Creator - ${DATE}\n\n${md}`);
  let index = [];
  try { index = JSON.parse(await read("reports/index.json", "[]")); } catch {}
  index = [{ file, agent: "content-creator", name: "Content Creator", date: DATE }, ...index.filter((r) => r.file !== file)].slice(0, 300);
  await fs.writeFile(path.join(HERE, "reports/index.json"), JSON.stringify(index, null, 2));

  // Messages to the team: the Planner and SEO Scout read this file on their next run.
  await fs.writeFile(path.join(HERE, "content/notes.md"), `# Content Creator notes - ${DATE}\n\nTheme: ${plan.theme || ""}\nHeadlines made: ${made.map((m) => m.post.headline).join(" | ")}\n\n## For the Content Planner\n${plan.notes_for_planner || "-"}\n\n## For the SEO Scout\n${plan.requests_for_seo || "-"}\n`);
  history = [...made.map((m) => m.post.headline), ...history].slice(0, 60);
  await fs.writeFile(path.join(HERE, "content/history.json"), JSON.stringify(history, null, 2));
  await fs.writeFile(path.join(dir, "posts.json"), JSON.stringify(plan, null, 2));

  if (DRY) { console.log("Dry run: skipped Discord."); return; }
  await report("content-creator", `Content Creator · ${DATE} · ${made.length} posts ready`, `**${plan.theme || ""}**\n\nEach post is below with its image. Tap an image, then the download button, to save it.${plan.requests_for_owner ? `\n\n**For you to decide:** ${plan.requests_for_owner}` : ""}`, { file });
  for (const [i, { post, name, data }] of made.entries()) {
    let text = `**${i + 1}. ${post.platform}${post.format === "story" ? " (vertical)" : ""}**\n`;
    if (post.pin_title) text += `**Title:** ${post.pin_title}\n`;
    text += `${post.caption}\n${tags(post)}`;
    if (post.video_script) text += `\n\n**Video script:** ${post.video_script}`;
    if (post.alt_text) text += `\n-# Alt text: ${post.alt_text}`;
    await postFiles("content-creator", text, [{ name, data, type: "image/jpeg" }]);
  }
  console.log(`Posted ${made.length} posts to Discord #content.`);
}

main().catch(async (e) => {
  console.error("ERROR:", e.message);
  if (!DRY) await alert(`⚠️ Content Creator failed: ${e.message.slice(0, 300)}`);
  process.exit(1);
});
