// Content Creator: turns the Content Planner's ideas into finished, ready-to-post content.
// Runs twice a week (content-creator.yml). For each run it:
//   1. reads the team's latest reports (Content Planner, SEO Scout, Competitor Scout, Listing Writer, Weekly Review)
//      and its own notes, so it builds on their work and never repeats itself;
//   2. gathers fresh data: Google autocomplete (free) and Exa trend searches (within the free budget);
//   3. writes 5 posts with the strongest available model (Claude first within its monthly cap, then Gemini Pro, then the backups);
//   4. designs the images itself: Pinterest pins (1000x1500) and story/TikTok covers (1080x1920), using the
//      real product previews, the brand art, and AI-painted backgrounds (Cloudflare FLUX, free; or ART_API_KEY);
//   5. posts every image with its caption to Discord #content, ready to save from the phone;
//   6. leaves notes for the Planner and SEO Scout (content/notes.md) and a report the Weekly Review reads.
// It never publishes anywhere itself: the owner posts what they like.
//
// Usage: node content-creator.mjs            (CREATOR_POSTS=5, CREATOR_DRY=1 skips Discord)
import fs from "node:fs/promises";
import { trackResponse, flushUsage } from "./usage-log.mjs";
import { addPins } from "./pins.mjs";
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
  const season = await read("content/seasonal.md");
  if (season) out += `\n\n### Seasonal Planner's holiday calendar (plan pins 30-60 days ahead of each holiday)\n${season.slice(0, 4000)}`;
  const ployBoard = await read("ploy/status.md");
  if (ployBoard) out += `\n\n### Ploy shift board (Ploy AI leads the website, SEO, ads, leads and positioning; never redo its work; reuse its organic angles)\n${ployBoard.slice(0, 3500)}`;
  const media = await read("store/media.json");
  if (media) out += `\n\n### Website media you can point people to (videos and images already published)\n${media.slice(0, 3000)}`;
  const pins = await read("pinterest/stats.md");
  if (pins) out += `\n\n### Pinterest results (real numbers: make more of what gets saves and clicks)\n${pins.slice(0, 4000)}`;
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
Product facts (never contradict): the files are fill-in PDFs. Buyers download them, open them in the free Adobe Acrobat Reader app (phone or computer), tap the sample wording and type their own, save, then print at home or at a print shop (Staples, FedEx Office, Walgreens). NO Canva, no account or subscription needed - never mention Canva even if a team report or keyword does. Photos are added on a computer. The program folds to 5.5 x 8.5 in; the welcome sign is 24 x 36 in (also 16 x 24 or 12 x 18); the memory cards are 4.25 x 5.5 in, four per letter sheet.
Voice: warm, calm, practical, quietly reassuring. Never salesy about grief, no urgency tricks, no "limited time", no emojis in headlines, never mention death in a shocking way. Lead with help (a tip, a checklist, a comforting idea), mention the kit gently.
Rules: drafts only - the owner decides what to post. Never invent reviews, testimonials, customer stories, statistics or prices other than $12.99. Disclose nothing false. Use keywords from the real SEO data naturally. Return valid JSON only.`;

function writePrompt(team, data, history) {
  return `Today is ${DATE}. Create ${COUNT} finished social posts for this week, built on the team's work below (start from the Content Planner's ideas; use the SEO Scout's keywords and pin titles; avoid what competitors overdo).

Backgrounds: most pins should be photo scenes, which do best on Pinterest: "scene-table" (the printable lying on a linen table, seen from above; use with program-cover or memory-card) or "scene-venue" (the welcome sign standing on a wooden easel in a softly lit room; use with welcome-sign). Use "botanical" or "painted" for at most one pin and for stories.
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
   "background": "scene-table" | "scene-venue" | "botanical" | "painted",
   "scene_prompt": "for scene backgrounds: a few words of props and light to vary the photo (e.g. 'eucalyptus sprigs, a cup of tea, morning window light' or 'white roses, pillar candles, warm evening glow'). No people, no text.",
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

// Photo scenes the real product preview is placed into. The AI never draws the product or any text.
const SCENES = {
  "scene-table": "Top-down flat lay photograph of a table covered in natural oatmeal linen, soft morning window light with gentle leaf shadows, props only near the edges and corners, the whole center of the table empty and clear",
  "scene-venue": "Photograph of an elegant softly lit reception room, heavily blurred background with warm bokeh lights and white flowers, cream and ivory tones, props only at the far left and right edges, the center of the frame empty, eye level"
};
const PHOTO_STYLE = "professional lifestyle product photography, warm diffused light, cream, ivory and sage green palette, shallow depth of field, photorealistic, no text, no letters, no words, no paper, no cards, no signs, no people, no faces, no hands";

// Best image model first; each falls back to the next (all on Cloudflare's free daily allowance).
let bestLeft = 2, cfSpent = false; // FLUX.2 dev is costly on the free allowance (4 large images used a whole day's), so 2 per run
async function cfImage(prompt, { width = 832, height = 1248 } = {}) {
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID || cfSpent) return null;
  const base = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/`;
  const auth = { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` };
  const form = () => { const f = new FormData(); f.append("prompt", prompt.slice(0, 2000)); f.append("width", String(width)); f.append("height", String(height)); return f; };
  const tries = [
    ["@cf/black-forest-labs/flux-2-dev", () => ({ body: form() })],
    ["@cf/black-forest-labs/flux-2-klein-9b", () => ({ body: form() })],
    ["@cf/leonardo/lucid-origin", () => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: prompt.slice(0, 2000), width, height }) })],
    ["@cf/black-forest-labs/flux-1-schnell", () => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: 8 }) })]
  ];
  for (const [model, make] of bestLeft > 0 ? tries : tries.slice(-1)) {
    try {
      const init = make();
      const res = await fetch(base + model, { method: "POST", signal: AbortSignal.timeout(150000), ...init, headers: { ...auth, ...(init.headers || {}) } });
      await trackResponse(`https://api.cloudflare.com/client/v4/accounts/x/ai/run/${model}`, { method: "POST" }, res);
      const j = await res.json().catch(() => ({}));
      const b64 = j.result?.image || j.image;
      if (res.ok && b64) { if (model !== tries.at(-1)[0]) bestLeft--; console.log(`  image by ${model.split("/").pop()}`); return `data:image/jpeg;base64,${b64}`; }
      console.log(`  ${model.split("/").pop()} skipped: ${(j.errors?.[0]?.message || `HTTP ${res.status}`).slice(0, 120)}`);
      if (/daily free allocation/i.test(j.errors?.[0]?.message || "")) { cfSpent = true; return null; } // out for today (resets 7pm Eastern)
    } catch (e) { console.log(`  ${model.split("/").pop()} skipped: ${e.message}`); }
  }
  return null;
}

async function paint(prompt, scene) {
  // Owner's dedicated art AI goes here first once its key is added (ART_API_KEY); see README.
  if (scene) return cfImage(`${SCENES[scene]}. Props: ${prompt}. ${PHOTO_STYLE}`);
  return cfImage(`${prompt}. ${ART_STYLE}`);
}

// ---------- 5. Design ----------
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function sceneHtml(post, photo) {
  const venue = post.background === "scene-venue";
  const img = url(PRODUCT_IMAGES[venue ? "welcome-sign" : (post.product_image || "program-cover")] || PRODUCT_IMAGES["program-cover"]);
  const second = !venue && post.product_image !== "memory-card" ? url(PRODUCT_IMAGES["memory-card"]) : null;
  const wide = !venue && /program/.test(post.product_image || "program-cover");
  const bg = photo ? `<img class="photo" src="${photo}">` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Cormorant;src:url(${url("products/fillable/fonts/CormorantGaramond.ttf")})}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1000px;height:1500px;overflow:hidden;position:relative;font-family:Cormorant;color:#2f3a2a;display:flex;flex-direction:column;
 background:${venue ? "radial-gradient(ellipse at 50% 55%,#f6efe2 0%,#eadfcb 70%,#dccdb2 100%)" : "linear-gradient(160deg,#efe6d6,#e4d8c3)"}}
.photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.head{position:relative;z-index:2;text-align:center;padding:60px 60px 70px;background:linear-gradient(#f7f1e6 0%,rgba(247,241,230,.93) 62%,rgba(247,241,230,0) 100%)}
h1{font-weight:500;font-size:92px;line-height:1.02;letter-spacing:-.01em;text-wrap:balance}
.sub{font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;font-size:29px;line-height:1.35;color:#3d4a36;margin-top:18px;text-wrap:balance}
.stage{position:relative;flex:1;min-height:0;z-index:1}
.bottom{position:absolute;left:0;right:0;bottom:0;height:230px;z-index:3;background:linear-gradient(rgba(247,241,230,0),rgba(247,241,230,.94) 70%)}
.paper{position:absolute;background:#fbf8f1;box-shadow:0 2px 3px rgba(60,45,25,.18),0 14px 22px -6px rgba(60,45,25,.28),0 40px 60px -20px rgba(60,45,25,.35)}
.paper img{display:block;width:100%;height:100%}
.main{${wide ? `width:${second ? 660 : 760}px;left:${second ? 60 : 120}px;top:6%` : "height:74%;aspect-ratio:800/1035;left:50%;margin-left:-29%;top:2%"};transform:rotate(-4deg)}
.cards{width:290px;right:60px;top:${wide ? "44%" : "50%"};transform:rotate(5deg)}
.cards:before,.cards:after{content:"";position:absolute;inset:0;background:#f6f1e6;box-shadow:0 2px 4px rgba(60,45,25,.25);z-index:-1;transform:translate(7px,7px) rotate(1.5deg)}
.cards:after{transform:translate(13px,14px) rotate(-1deg)}
.easel{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;align-items:center}
.sign{position:relative;height:66%;aspect-ratio:2/3;box-shadow:0 18px 40px -10px rgba(60,45,25,.4),0 2px 4px rgba(60,45,25,.2)}
.ledge{position:relative;width:560px;height:26px;flex:none;border-radius:3px;background:linear-gradient(#b98b5a,#946a3f);box-shadow:0 10px 18px -6px rgba(60,40,20,.5)}
.legs{position:relative;flex:1;width:420px}
.leg{position:absolute;top:-4px;bottom:-40px;width:26px;background:linear-gradient(90deg,#a87a4b,#8a6238);border-radius:3px;transform-origin:top}
.leg.l{left:0;transform:rotate(7deg)}.leg.r{right:0;transform:rotate(-7deg)}
.brand{position:absolute;left:0;right:0;bottom:54px;z-index:4;text-align:center;font-size:50px;font-weight:500}
.brand:before,.brand:after{content:"";display:inline-block;width:130px;height:1px;background:#8a927f;vertical-align:middle;margin:0 26px}
</style></head><body>${bg}
<div class="head"><h1>${esc(post.headline)}</h1>${post.subline ? `<p class="sub">${esc(post.subline)}</p>` : ""}</div>
<div class="stage">${venue ? `<div class="easel"><div class="paper sign" style="position:relative"><img src="${img}"></div><div class="ledge"></div><div class="legs"><div class="leg l"></div><div class="leg r"></div></div></div>`
  : `<div class="paper main"><img src="${img}"></div>${second ? `<div class="paper cards"><img src="${second}"></div>` : ""}`}</div>
<div class="bottom"></div><div class="brand">Forever Held</div></body></html>`;
}

function pageHtml(post, painted) {
  if (/^scene-/.test(post.background || "") && post.format !== "story") return sceneHtml(post, painted);
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
    plan = await ask(SYSTEM, prompt, { json: true, strong: true, temperature: 0.75, who: "content-creator" });
    // Self-check: one rewrite if it broke a product fact.
    const bad = /canva/i.test(JSON.stringify(plan.posts || [])) ? "It mentions Canva, but our kit is fill-in PDFs typed in the free Adobe Acrobat Reader app." : "";
    if (bad) { console.log("  fixing a product-fact mistake"); plan = await ask(SYSTEM, `${prompt}\n\nYour previous draft was wrong: ${bad} Rewrite everything correctly.`, { json: true, strong: true, temperature: 0.6, who: "content-creator" }); }
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
      const scene = /^scene-/.test(post.background || "") && !story ? post.background : null;
      const painted = scene ? await paint(post.scene_prompt || "eucalyptus sprigs, a small candle", scene) : post.background === "painted" ? await paint(post.art_prompt || post.headline) : null;
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

  // Pinterest without the API: public images + RSS feed (auto-publish) + bulk-upload CSV
  if (!DRY) {
    const pinItems = made.filter((m) => m.post.format !== "story").map((m) => ({ id: m.name.replace(/\.jpg$/, ""), data: m.data,
      title: m.post.pin_title || m.post.headline, description: `${m.post.caption}`.replace(/\s+/g, " ").trim(), keywords: m.post.keywords || [] }));
    const total = await addPins(pinItems);
    console.log(`  Pinterest: ${pinItems.length} pins added to the feed and upload file (${total} total)`);
  }

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
  await flushUsage();
  process.exit(1);
});
