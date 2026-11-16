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
const SITE = "https://foreverheld.pages.dev";

// Every picture a post can show: key -> [file, width/height]. Real renders of the files buyers get.
const H = "store/img/holiday/pages/";
const IMAGES = {
  "program-cover": ["store/img/program-cover.png", 1.294], "program-inside": ["store/img/program-inside.png", 1.294],
  "welcome-sign": ["store/img/welcome-sign.png", 0.667], "memory-card": ["store/img/memory-card.png", 0.773],
  "h-sign": [H + "h-sign.jpg", 0.8], "h-card": [H + "h-card.jpg", 0.773], "h-cards": [H + "h-cards.jpg", 0.773], "h-place": [H + "h-place.jpg", 0.875],
  "e-sign": [H + "e-sign.jpg", 0.8], "e-card": [H + "e-card.jpg", 0.773], "e-orn": [H + "e-orn.jpg", 0.713],
  "l-sign": [H + "l-sign.jpg", 0.8], "l-card": [H + "l-card.jpg", 0.773], "l-prog1": [H + "l-prog1.jpg", 1.295]
};
const PHOTO_RULES = "no text, no letters, no words, no paper, no cards, no signs, no people, no faces, no hands";

// One look per product, so each collection's pins look like that collection.
const THEMES = {
  "soft-botanical": {
    page: "", sign: "welcome-sign", card: "memory-card", images: ["program-cover", "program-inside", "welcome-sign", "memory-card"],
    bg: "#f7f3ec", fade: "247,241,230", ink: "#2f3a2a", sub: "#5f6e56", accent: "#6d7f5f", line: "rgba(109,127,95,.35)", decor: "botanical",
    table: "Top-down flat lay photograph of a table covered in natural oatmeal linen, soft morning window light with gentle leaf shadows, props only near the edges and corners, the whole center of the table empty and clear",
    venue: "Photograph of an elegant softly lit reception room, heavily blurred background with warm bokeh lights and white flowers, cream and ivory tones, props only at the far left and right edges, the center of the frame empty, eye level",
    photo: "professional lifestyle product photography, warm diffused light, cream, ivory and sage green palette, shallow depth of field, photorealistic",
    art: "soft watercolor illustration on warm cream paper, muted sage green and dusty blush, delicate botanical leaves and small white flowers, gentle natural light, calm and peaceful, large empty cream space in the center for text"
  },
  "holiday-2026-C": {
    page: "harvest-table.html", sign: "h-sign", card: "h-card", images: ["h-sign", "h-card", "h-cards", "h-place"],
    bg: "#f3ead9", fade: "243,234,217", ink: "#3a2416", sub: "#6b4a33", accent: "#b45f3c", line: "rgba(180,95,60,.35)", decor: "leaves",
    table: "Top-down flat lay photograph of a rustic wooden farmhouse table with a cream linen runner, scattered autumn leaves, wheat stems and small white pumpkins at the edges, warm golden afternoon light, the whole center of the table empty and clear",
    venue: "Photograph of a warm Thanksgiving dining room, heavily blurred background with candlelight bokeh, autumn leaves and wheat at the far edges, terracotta and cream tones, the center of the frame empty, eye level",
    photo: "professional lifestyle product photography, warm golden light, terracotta, mustard and cream palette, shallow depth of field, photorealistic",
    art: "soft watercolor illustration on warm oat paper, autumn leaves in terracotta and mustard, wheat stems, gentle golden light, calm and peaceful, large empty space in the center for text"
  },
  "holiday-2026-A": {
    page: "evergreen-candlelight.html", sign: "e-sign", card: "e-card", images: ["e-sign", "e-card", "e-orn"],
    bg: "#0f1d16", fade: "15,29,22", ink: "#f4eedf", sub: "#e6c27a", accent: "#e6c27a", line: "rgba(230,194,122,.4)", decor: "lights", dark: true,
    table: "Top-down flat lay photograph of a dark walnut table at night with fresh pine branches, red winter berries and small brass candle holders with lit candles at the edges, warm golden candlelight, the whole center of the table empty and clear",
    venue: "Photograph of a cozy living room on Christmas Eve, heavily blurred background with warm golden Christmas tree light bokeh, pine garland at the far edges, deep green and gold tones, the center of the frame empty, eye level",
    photo: "professional lifestyle product photography, warm candlelight, deep pine green, gold and ivory palette, shallow depth of field, photorealistic",
    art: "soft painterly illustration of pine boughs and glowing golden candlelight on deep green, gentle bokeh, calm and peaceful, large dark empty space in the center for text"
  },
  "holiday-2026-B": {
    page: "longest-night.html", sign: "l-sign", card: "l-card", images: ["l-sign", "l-card", "l-prog1"],
    bg: "#141933", fade: "20,25,51", ink: "#f2f1f8", sub: "#d9cfe0", accent: "#d9cfe0", line: "rgba(217,207,224,.4)", decor: "stars", dark: true,
    table: "Top-down flat lay photograph of a dark slate table in a quiet church at dusk, many small white votive candles glowing at the edges, a sprig of cedar, soft blue window light, the whole center of the table empty and clear",
    venue: "Photograph of a quiet church sanctuary at dusk, heavily blurred background with rows of small lit candles and tall windows glowing deep blue, the center of the frame empty, eye level",
    photo: "professional photography, soft candlelight and blue dusk light, navy, lavender and silver palette, shallow depth of field, photorealistic",
    art: "soft painterly illustration of a starry winter night sky fading from deep navy to lavender, a few glowing candles, calm and peaceful, large empty space in the center for text"
  }
};

// Live products the team can promote: approved with a checkout link; holiday sets only from 45 days before their window until it ends.
async function catalog() {
  let list = [];
  try { list = JSON.parse(await read("products/collections.json", "{}")).collections || []; } catch {}
  const soon = new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10);
  const out = [{ id: "soft-botanical", name: "Soft Botanical Celebration of Life Suite", season: "any time", price: "$12.99", link: `https://${STORE}`, page: `${SITE}/`, pieces: ["funeral program (folds to 5.5 x 8.5 in)", "welcome sign 24 x 36 in", "share-a-memory cards"] }];
  for (const c of list) {
    if (!THEMES[c.id] || c.id === "soft-botanical" || c.status !== "approved" || !/^https:\/\/payhip\.com\//.test(c.checkout || "")) continue;
    if ((c.marketUntil || "9999") < DATE || (c.marketFrom || "0000") > soon) continue;
    out.push({ id: c.id, name: c.name, season: `${c.season} (promote ${c.marketFrom} to ${c.marketUntil})`, price: c.price, link: c.checkout, page: `${SITE}/${THEMES[c.id].page}`, pieces: c.pieces || [], audience: c.audience || "" });
  }
  return out;
}

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
    seeds: ["funeral program", "celebration of life", "memorial printable", "funeral welcome sign", "share a memory card", "first thanksgiving without", "first christmas without", "blue christmas service", "memorial candle christmas"],
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
Forever Held sells printable, editable memorial keepsakes: the Soft Botanical funeral/celebration of life suite (program, welcome sign, share-a-memory cards) and seasonal remembrance sets for the first holidays without someone. The live products, prices and links are listed in each brief; use only those. Buyers are grieving families, often planning a service in a few days, mostly on phones.
Product facts (never contradict): the files are fill-in PDFs. Buyers download them, open them in the free Adobe Acrobat Reader app (phone or computer), tap the sample wording and type their own, save, then print at home or at a print shop (Staples, FedEx Office, Walgreens). NO Canva, no account or subscription needed - never mention Canva even if a team report or keyword does. Photos are added on a computer. The program folds to 5.5 x 8.5 in; the welcome sign is 24 x 36 in (also 16 x 24 or 12 x 18); the memory cards are 4.25 x 5.5 in, four per letter sheet.
Voice: warm, calm, practical, quietly reassuring. Never salesy about grief, no urgency tricks, no "limited time", no emojis in headlines, never mention death in a shocking way. Lead with help (a tip, a checklist, a comforting idea), mention the kit gently.
Rules: drafts only - the owner decides what to post. Never invent reviews, testimonials, customer stories, statistics or prices other than the listed ones. Disclose nothing false. Use keywords from the real SEO data naturally. Return valid JSON only.`;

// Content angles, rotated daily so the pins keep changing. Each is a save-worthy idea, not an ad.
const ANGLES = {
  "soft-botanical": ["what to write on a celebration of life welcome sign", "share-a-memory card prompts guests can answer", "celebration of life checklist for the week before", "how to edit the fill-in PDFs on a phone in minutes", "memory table ideas (photos, candles, a guest book)", "gentle wording for a funeral program", "how a friend can help a grieving family with the printing", "keepsake ideas: keep the memory cards in a box or book"],
  "holiday-2026-C": ["ways to honor a loved one at Thanksgiving dinner", "what to write on an empty-chair place card", "a gratitude card table activity that includes them", "the first Thanksgiving without them: small rituals", "Thanksgiving remembrance table ideas", "how kids can share a memory at the table"],
  "holiday-2026-A": ["memorial ornament ideas for the tree", "lighting a candle for them at Christmas dinner", "the first Christmas without them: gentle traditions", "a remembrance corner by the tree", "a Christmas memory card for each guest", "how to include them in the family photo or toast"],
  "holiday-2026-B": ["how to plan a Blue Christmas or Longest Night service", "order of service ideas for a Longest Night service", "what to put in a Blue Christmas program", "candle-lighting moment ideas for a church service", "how churches can welcome grieving people in December", "remembrance cards for a Longest Night service"]
};
// Every form in a set gets its own spotlight: one featured piece per set per day, rotating.
const PIECE = {
  "program-cover": "Funeral program (front cover)", "program-inside": "Funeral program (inside pages: obituary, order of service)",
  "welcome-sign": "Welcome sign, 24x36 / 18x24 poster", "memory-card": "Share-a-memory cards",
  "h-sign": "Empty-chair sign 8x10 (\"We saved a seat for you\")", "h-card": "\"I'm thankful for\" memory cards", "h-cards": "Memory cards printed 4 per sheet", "h-place": "Fold-over place cards (\"In loving memory\" or a guest name)",
  "e-sign": "Candle table sign 8x10 (\"This candle burns in loving memory of\")", "e-card": "Christmas memory cards (dark green or ink-saver light)", "e-orn": "Ornament keepsake cards with a ribbon hole",
  "l-sign": "Longest Night table sign 8x10", "l-card": "Candle-lighting cards", "l-prog1": "Blue Christmas service program (names remembered, order of service)"
};
// Short name printed on the pin, e.g. "Fold-over place cards".
const pieceName = (k) => (PIECE[k] || "").replace(/\s*\(.*?\)/g, "").replace(/,.*$/, "").trim();
function featured(products) {
  const day = Math.floor(Date.parse(DATE) / 864e5);
  return products.map((p) => { const im = THEMES[p.id]?.images || []; return im.length ? [0, 1].map((k) => im[(day + k * 2) % im.length]).filter((v, i, a) => a.indexOf(v) === i).map((k) => `${p.name}: ${PIECE[k] || k} (picture "${k}")`) : []; }).flat();
}
function angles(products) {
  const day = Math.floor(Date.parse(DATE) / 864e5);
  return products.flatMap((p) => { const a = ANGLES[p.id] || []; return a.length ? [0, 1].map((k) => `${p.name}: ${a[(day * 2 + k) % a.length]}`) : []; });
}

function writePrompt(team, data, history, products) {
  const cat = products.map((p) => `- id "${p.id}": ${p.name}, ${p.price}, ${p.season}. Page: ${p.page}. Pieces: ${p.pieces.join("; ")}. Pictures you can use: ${THEMES[p.id].images.join(", ")}${p.audience ? `. For: ${p.audience}` : ""}`).join("\n");
  const holidays = products.filter((p) => p.id !== "soft-botanical");
  return `Today is ${DATE}. Create ${COUNT} finished social posts, built on the team's work below (start from the Content Planner's ideas; use the SEO Scout's keywords and pin titles; avoid what competitors overdo).

# Live products (promote only these; each post is about exactly one)
${cat}
${holidays.length ? `\nIt's holiday season: make at least ${Math.min(holidays.length, Math.max(COUNT - 2, 1))} posts about the holiday sets (every set above gets at least one), the rest about Soft Botanical. Families plan these weeks ahead, so speak to that (the first Thanksgiving or Christmas without them, a remembrance table, a church's Blue Christmas service).` : ""}

Backgrounds: most pins should be photo scenes, which do best on Pinterest. Each product has its own photo look (Harvest Table = autumn farmhouse table, Evergreen = pine and candlelight at night, Longest Night = candles in a quiet church at dusk, Soft Botanical = linen and greenery): "scene-table" (the printable lying on that product's table, seen from above) or "scene-venue" (that product's sign standing on a wooden easel). Use "botanical" or "painted" for at most one pin and for stories.
Mix: ${Math.max(COUNT - 2, 1)} Pinterest pins (format "pin") and 2 vertical TikTok/Reels/Instagram story posts (format "story"). Every post must be different in angle.

# Make it useful, not an ad
Pinterest rewards pins people SAVE: ideas, how-tos and lists. Headlines must not just name the product ("Welcome sign printable" is weak; "What to write on a welcome sign" is strong). Today's angles to draw from (use at least 3 different ones):
${angles(products).map((a) => `- ${a}`).join("\n")}
# Show the forms we sell
Each set has several different forms (signs, cards, place cards, programs, ornament cards). Market them one at a time: every post spotlights ONE specific piece, names it plainly (what it is, its size or use), and uses that piece's picture as product_image. Today's featured pieces (cover these first, one post each where you can):
${featured(products).map((f) => `- ${f}`).join("\n")}
Make the headline or tips about how that piece is used (e.g. place cards: "Set one at their chair"; ornament cards: "Hang one on the tree").
At least 2 pins use background "tips": an idea-list pin with 3-5 short numbered "tips" on the image (each max 8 words, practical and specific, written by you, no quotes from books, songs or famous people). The other pins use the photo scenes.
Do NOT repeat these recent headlines: ${history.slice(0, 30).join(" | ") || "(none yet)"}

Return JSON:
{
 "theme": "one line: this week's content angle",
 "posts": [{
   "format": "pin" | "story",
   "platform": "Pinterest" | "TikTok / Reels" | "Instagram",
   "headline": "text ON the image, max 7 words, sentence case",
   "kicker": "holiday sets only: tiny label above the headline, max 4 words (e.g. 'Thanksgiving remembrance', 'For a Blue Christmas service'); empty for Soft Botanical",
   "subline": "text ON the image under the headline, max 14 words",
   "product": "the product id from the list above",
   "piece": "the form this post spotlights, in plain words (e.g. 'fold-over place cards')",
   "product_image": "the picture of that piece (from the featured list or that product's pictures)",
   "background": "scene-table" | "scene-venue" | "tips" | "botanical" | "painted",
   "tips": ["tips background only: 3-5 short numbered ideas, max 8 words each; empty otherwise"],
   "scene_prompt": "for scene backgrounds: a few words of props and light that suit that product's season, to vary the photo (e.g. 'a cup of cider, cinnamon sticks' or 'white roses, pillar candles'). No people, no text.",
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

async function paint(prompt, scene, t = THEMES["soft-botanical"]) {
  // Owner's dedicated art AI goes here first once its key is added (ART_API_KEY); see README.
  if (scene) return cfImage(`${scene === "scene-venue" ? t.venue : t.table}. Props: ${prompt}. ${t.photo}, ${PHOTO_RULES}`);
  return cfImage(`${prompt}. ${t.art}, no text, no letters, no words, no people, no faces`);
}

// ---------- 5. Design ----------
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function sceneHtml(post, photo) {
  const t = THEMES[post.product] || THEMES["soft-botanical"], venue = post.background === "scene-venue";
  const key = venue ? t.sign : post.product_image, [file, ratio] = IMAGES[key];
  const img = url(file);
  const second = !venue && key !== t.card ? url(IMAGES[t.card][0]) : null;
  const wide = !venue && ratio > 1.1;
  const bg = photo ? `<img class="photo" src="${photo}">` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Cormorant;src:url(${url("products/fillable/fonts/CormorantGaramond.ttf")})}
@font-face{font-family:Cormorant;font-style:italic;src:url(${url("products/fillable/fonts/CormorantGaramond-Italic.ttf")})}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1000px;height:1500px;overflow:hidden;position:relative;font-family:Cormorant;color:${t.ink};display:flex;flex-direction:column;
 background:${t.dark ? `radial-gradient(ellipse at 50% 55%,${t.bg} 0%,#000 120%)` : venue ? "radial-gradient(ellipse at 50% 55%,#f6efe2 0%,#eadfcb 70%,#dccdb2 100%)" : "linear-gradient(160deg,#efe6d6,#e4d8c3)"}}
.photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.head{position:relative;z-index:2;text-align:center;padding:60px 60px 70px;background:linear-gradient(rgb(${t.fade}) 0%,rgba(${t.fade},.93) 62%,rgba(${t.fade},0) 100%)}
.kicker{font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;font-size:21px;letter-spacing:.32em;text-transform:uppercase;color:${t.accent};margin-bottom:18px}
h1{font-weight:500;font-size:92px;line-height:1.02;letter-spacing:-.01em;text-wrap:balance}
.sub{font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;font-size:29px;line-height:1.35;color:${t.dark ? t.ink : t.sub};opacity:${t.dark ? .85 : 1};margin-top:18px;text-wrap:balance}
.stage{position:relative;flex:1;min-height:0;z-index:1}
.bottom{position:absolute;left:0;right:0;bottom:0;height:230px;z-index:3;background:linear-gradient(rgba(${t.fade},0),rgba(${t.fade},.94) 70%)}
.paper{position:absolute;background:#fbf8f1;box-shadow:0 2px 3px rgba(60,45,25,.18),0 14px 22px -6px rgba(60,45,25,.28),0 40px 60px -20px rgba(60,45,25,.35)}
.paper img{display:block;width:100%;height:100%}
.main{${wide ? `width:${second ? 660 : 760}px;left:${second ? 60 : 120}px;top:6%` : `height:74%;aspect-ratio:${ratio};left:${second ? 9 : 50}%;margin-left:${second ? 0 : -(ratio * 1047 * 0.74) / 2}px;top:2%`};transform:rotate(-4deg)}
.cards{width:290px;right:60px;top:${wide ? "44%" : "50%"};transform:rotate(5deg)}
.cards:before,.cards:after{content:"";position:absolute;inset:0;background:#f6f1e6;box-shadow:0 2px 4px rgba(60,45,25,.25);z-index:-1;transform:translate(7px,7px) rotate(1.5deg)}
.cards:after{transform:translate(13px,14px) rotate(-1deg)}
.easel{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;align-items:center}
.sign{position:relative;height:66%;aspect-ratio:${ratio};box-shadow:0 18px 40px -10px rgba(60,45,25,.4),0 2px 4px rgba(60,45,25,.2)}
.ledge{position:relative;width:560px;height:26px;flex:none;border-radius:3px;background:linear-gradient(#b98b5a,#946a3f);box-shadow:0 10px 18px -6px rgba(60,40,20,.5)}
.legs{position:relative;flex:1;width:420px}
.leg{position:absolute;top:-4px;bottom:-40px;width:26px;background:linear-gradient(90deg,#a87a4b,#8a6238);border-radius:3px;transform-origin:top}
.leg.l{left:0;transform:rotate(7deg)}.leg.r{right:0;transform:rotate(-7deg)}
.piece{position:absolute;left:0;right:0;bottom:128px;z-index:4;text-align:center;font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;font-size:20px;letter-spacing:.24em;text-transform:uppercase;color:${t.accent}}
.brand{position:absolute;left:0;right:0;bottom:54px;z-index:4;text-align:center;font-size:50px;font-weight:500}
.brand:before,.brand:after{content:"";display:inline-block;width:130px;height:1px;background:${t.accent};opacity:.7;vertical-align:middle;margin:0 26px}
</style></head><body>${bg}
<div class="head">${post.product !== "soft-botanical" ? `<p class="kicker">${esc((THEMES[post.product].page ? post.kicker || "" : "") || "")}</p>` : ""}<h1>${esc(post.headline)}</h1>${post.subline ? `<p class="sub">${esc(post.subline)}</p>` : ""}</div>
<div class="stage">${venue ? `<div class="easel"><div class="paper sign" style="position:relative"><img src="${img}"></div><div class="ledge"></div><div class="legs"><div class="leg l"></div><div class="leg r"></div></div></div>`
  : `<div class="paper main"><img src="${img}"></div>${second ? `<div class="paper cards"><img src="${second}"></div>` : ""}`}</div>
<div class="bottom"></div>${pieceName(key) ? `<div class="piece">${esc(pieceName(key))}</div>` : ""}<div class="brand">Forever Held</div></body></html>`;
}

function pageHtml(post, painted) {
  if (/^scene-/.test(post.background || "") && post.format !== "story") return sceneHtml(post, painted);
  const tips = post.background === "tips" ? (post.tips || []).map((x) => String(x).replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim()).filter(Boolean).slice(0, 5) : []; // the pin numbers them itself
  const story = post.format === "story";
  const t = THEMES[post.product] || THEMES["soft-botanical"];
  const W = story ? 1080 : 1000, H = story ? 1920 : 1500;
  const img = url(IMAGES[post.product_image][0]);
  const dots = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join("");
  const decor = {
    botanical: `<img class="art top" src="${url("products/fillable/art/sign-top.png")}"><img class="art bottom" src="${url("products/fillable/art/spray.png")}">`,
    leaves: dots(14, (i) => `<i class="leaf" style="left:${(i * 37) % 100}%;top:${(i * 53) % 100}%;transform:rotate(${i * 47}deg);opacity:${0.18 + (i % 3) * 0.08}"></i>`),
    lights: dots(30, (i) => `<i class="glow" style="left:${(i * 71) % 100}%;top:${(i * 37) % 100}%;width:${30 + (i * 23) % 90}px;height:${30 + (i * 23) % 90}px;opacity:${0.1 + (i % 4) / 14}"></i>`),
    stars: dots(120, (i) => `<i class="star" style="left:${(i * 137) % 100}%;top:${(i * 53) % 100}%;width:${1 + (i % 3)}px;height:${1 + (i % 3)}px;opacity:${0.3 + (i % 5) / 8}"></i>`)
  }[t.decor];
  const bg = painted ? `<img class="paint" src="${painted}"><div class="veil"></div>` : decor;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Cormorant;src:url(${url("products/fillable/fonts/CormorantGaramond.ttf")})}
@font-face{font-family:Cormorant;font-style:italic;src:url(${url("products/fillable/fonts/CormorantGaramond-Italic.ttf")})}
@font-face{font-family:Cinzel;src:url(${url("products/fillable/fonts/Cinzel.ttf")})}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;background:${t.dark ? `radial-gradient(ellipse at 50% 40%,${t.bg} 0%,#05070a 130%)` : t.bg};overflow:hidden;position:relative;font-family:Cormorant;color:${t.ink}}
.leaf{position:absolute;width:70px;height:70px;background:${t.accent};border-radius:0 70% 0 70%}
.glow{position:absolute;border-radius:50%;background:#ffd58a;filter:blur(12px)}
.star{position:absolute;border-radius:50%;background:#fff}
.paint{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.veil{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,rgba(${t.fade},.92) 0%,rgba(${t.fade},.78) 45%,rgba(${t.fade},.35) 100%)}
.art{position:absolute;left:50%;transform:translateX(-50%);opacity:.95}
.art.top{top:-${story ? 20 : 34}px;width:${story ? 680 : 600}px}
.art.bottom{bottom:${story ? 70 : 34}px;width:${story ? 420 : 360}px}
.frame{position:absolute;inset:${story ? 36 : 28}px;border:1.5px solid ${t.line}}
.wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;text-align:center;padding:${story ? "330px 90px 330px" : "250px 80px 236px"}}
.brand{font-family:Cinzel;font-size:${story ? 26 : 22}px;letter-spacing:.42em;color:${t.accent};margin-bottom:${story ? 34 : 26}px}
h1{font-weight:500;font-size:${story ? 96 : 82}px;line-height:1.02;max-width:${story ? 900 : 840}px;letter-spacing:-.005em;text-wrap:balance}
.sub{font-style:italic;font-size:${story ? 42 : 36}px;line-height:1.25;color:${t.sub};max-width:${story ? 820 : 760}px;margin-top:${story ? 26 : 20}px;text-wrap:balance}
.product{margin-top:${story ? 64 : 46}px;background:#fff;padding:${story ? 16 : 14}px;box-shadow:0 18px 40px -18px rgba(0,0,0,${t.dark ? .8 : .45}),0 2px 6px rgba(0,0,0,.15);transform:rotate(-1.2deg)}
.product img{display:block;max-width:${story ? 640 : 600}px;max-height:${story ? 640 : 470}px;object-fit:contain}
.tips{list-style:none;margin-top:${story ? 56 : 40}px;width:100%;max-width:${story ? 860 : 800}px;text-align:left;counter-reset:t}
.tips li{counter-increment:t;display:flex;gap:26px;align-items:baseline;font-size:${story ? 50 : 44}px;line-height:1.15;padding:${story ? 22 : 17}px 0;border-top:1px solid ${t.line}}
.tips li:last-child{border-bottom:1px solid ${t.line}}
.tips li:before{content:counter(t);font-family:Cinzel;font-size:.6em;color:${t.accent};min-width:44px;text-align:center}
.is-tips .leaf{opacity:.07!important}.is-tips .art{display:none}.is-tips .wrap{justify-content:center;padding-top:${story ? 200 : 120}px;padding-bottom:${story ? 420 : 330}px}.is-tips .foot{position:absolute;left:${story ? 90 : 80}px;bottom:${story ? 150 : 110}px;margin:0}
.mini{position:absolute;right:${story ? 70 : 60}px;bottom:${story ? 120 : 96}px;background:#fff;padding:8px;transform:rotate(4deg);box-shadow:0 14px 30px -12px rgba(0,0,0,.5)}
.mini img{display:block;max-width:${story ? 300 : 250}px;max-height:${story ? 330 : 270}px}
.foot{margin-top:auto;font-style:italic;font-size:${story ? 34 : 29}px;color:${t.sub}}
.foot b{font-style:normal;font-family:Cinzel;font-weight:400;font-size:.62em;letter-spacing:.3em;display:block;margin-top:10px;color:${t.accent}}
</style></head><body${tips.length >= 3 ? ' class="is-tips"' : ""}>${bg}<div class="frame"></div>
<div class="wrap"><div class="brand">FOREVER HELD</div><h1>${esc(post.headline)}</h1>${post.subline ? `<p class="sub">${esc(post.subline)}</p>` : ""}
${tips.length >= 3 ? `<ol class="tips">${tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : `<div class="product"><img src="${img}"></div>`}
<div class="foot"${tips.length >= 3 ? ` style="text-align:left"` : ""}>${esc(pieceName(post.product_image) || (post.product === "soft-botanical" ? "Editable printable memorial kit" : (t.page && post.kicker) || "Printable remembrance set"))}<b>INSTANT DOWNLOAD</b></div></div>${tips.length >= 3 ? `<div class="mini"><img src="${img}"></div>` : ""}</body></html>`;
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

  const products = await catalog();
  console.log(`  promoting: ${products.map((p) => p.name).join(", ")}`);
  let plan;
  if (process.env.CREATOR_SAMPLE) plan = JSON.parse(await read(process.env.CREATOR_SAMPLE)); // design test without AI
  else {
    const [team, data] = await Promise.all([teamBrief(), freshData()]);
    const prompt = writePrompt(team + (notesBefore ? `\n\n### Your own notes from last time\n${notesBefore.slice(0, 2000)}` : ""), data, history, products);
    plan = await ask(SYSTEM, prompt, { json: true, strong: true, temperature: 0.75, who: "content-creator" });
    // Self-check: one rewrite if it broke a product fact.
    const bad = /canva/i.test(JSON.stringify(plan.posts || [])) ? "It mentions Canva, but our kit is fill-in PDFs typed in the free Adobe Acrobat Reader app." : "";
    if (bad) { console.log("  fixing a product-fact mistake"); plan = await ask(SYSTEM, `${prompt}\n\nYour previous draft was wrong: ${bad} Rewrite everything correctly.`, { json: true, strong: true, temperature: 0.6, who: "content-creator" }); }
  }
  const posts = (plan.posts || []).filter((p) => p?.headline).slice(0, COUNT);
  for (const post of posts) { // keep every post on a real product with its own pictures
    if (!products.some((p) => p.id === post.product)) post.product = "soft-botanical";
    if (!THEMES[post.product].images.includes(post.product_image)) post.product_image = THEMES[post.product].images[0];
    if (post.background === "tips" && (post.tips || []).filter(Boolean).length < 3) post.background = "scene-table"; // no list, no list pin
  }
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
      const t = THEMES[post.product];
      const painted = scene ? await paint(post.scene_prompt || "a small candle", scene, t) : post.background === "painted" ? await paint(post.art_prompt || post.headline, null, t) : null;
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
      title: m.post.pin_title || m.post.headline, description: `${m.post.caption}`.replace(/\s+/g, " ").trim(), keywords: m.post.keywords || [],
      link: products.find((p) => p.id === m.post.product)?.page || `${SITE}/` }));
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
