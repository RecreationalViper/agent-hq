// Content Creator: landing page in Canva.
// Writes a one-page site for Forever Held that does two jobs: (1) sell the Soft Botanical memorial kit and
// (2) grow the email list (free Planning Checklist -> seasonal product updates), using the team's latest
// reports and SEO data. Designs it in the brand style, turns it into a PDF and imports it into the owner's
// Canva account as an editable design. Posts a preview + the Canva edit link to Discord #content.
// The owner reviews it in Canva and publishes it (Share > Publish website, free on a canva.site address).
// Run: Content Creator workflow with "make" = landing.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ask } from "./ai-ask.mjs";
import { seoResearch } from "./seo.mjs";
import { importDesign } from "./canva.mjs";
import { report, postFiles, alert } from "./discord.mjs";
import { flushUsage } from "./usage-log.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const KIT = "https://payhip.com/b/vqNSA", CHECKLIST = "https://payhip.com/b/eYJqS";
const read = (p, f = "") => fs.readFile(path.resolve(HERE, p), "utf8").catch(() => f);
const url = (p) => pathToFileURL(path.join(HERE, p)).href;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function brief() {
  let index = []; try { index = JSON.parse(await read("reports/index.json", "[]")); } catch {}
  let out = "";
  for (const [id, max] of Object.entries({ seo: 4000, content: 3000, "content-creator": 2500, "competitor-scout": 2500, listing: 2000 })) {
    const r = index.find((x) => x.agent === id); if (!r) continue;
    out += `\n\n### ${r.name} (${r.date})\n${(await read(`reports/${r.file}`)).replace(/^# .*\n+/, "").slice(0, max)}`;
  }
  const seo = await seoResearch({ seeds: ["funeral program template", "celebration of life printable", "memorial welcome sign"], modifiers: ["editable", "free"] }).catch(() => null);
  if (seo?.text) out += `\n\n### Google autocomplete today\n${seo.text.slice(0, 3000)}`;
  return out || "(no team reports yet)";
}

const SYSTEM = `You are "Content Creator" on the Forever Held team, writing a one-page website (landing page).
Forever Held sells a printable, editable memorial kit in a soft botanical sage-and-cream style: funeral / celebration of life program (folds to 5.5 x 8.5 in), welcome sign (24 x 36, also 16 x 24 and 12 x 18), share-a-memory cards (4.25 x 5.5, four per letter sheet). $12.99, instant download: ${KIT}
How it works (never contradict): fill-in PDFs, opened in the free Adobe Acrobat Reader app on a phone or computer; tap the sample wording, type your own, save, print at home or at a print shop (Staples, FedEx Office, Walgreens). No Canva and no account or subscription needed for buyers - never say Canva. Photos are added on a computer.
Free gift: the Planning Checklist (${CHECKLIST}). Getting it adds people to the Forever Held email list for gentle seasonal updates (new designs, holiday remembrance ideas). One email address, unsubscribe any time.
Visitors are grieving families, often with a service in a few days, mostly on phones. Voice: warm, calm, practical, reassuring. No urgency tricks, no invented reviews, testimonials, statistics or prices. Use real SEO phrases naturally. Return valid JSON only.`;

const PROMPT = (team) => `Write the landing page. It must do two jobs equally: buy the kit, and get the free checklist (joins seasonal updates).
Return JSON:
{
 "seo_title": "page title, max 60 chars, main keyword first",
 "meta_description": "max 155 chars",
 "hero": {"eyebrow": "2-4 words", "headline": "max 9 words", "sub": "max 26 words", "buy_label": "button, max 5 words", "free_label": "button, max 6 words"},
 "promise": ["3 short reassurance lines, max 7 words each (e.g. ready tonight, no subscription)"],
 "inside_title": "max 6 words",
 "inside": [{"item": "Program" | "Welcome sign" | "Memory cards" | "Program inside", "title": "max 5 words", "text": "max 20 words"}],
 "steps_title": "max 6 words",
 "steps": [{"title": "max 4 words", "text": "max 18 words"}],
 "signup": {"title": "max 8 words", "text": "max 35 words: the free checklist + gentle seasonal updates", "button": "max 5 words", "fine": "max 14 words: one email, unsubscribe any time"},
 "faq": [{"q": "real question families ask, max 12 words", "a": "max 30 words"}],
 "closing": {"title": "max 8 words", "text": "max 22 words", "button": "max 5 words"},
 "keywords": ["the SEO phrases used"],
 "notes": "2-3 bullets for the owner: what to check before publishing"
}
Use exactly 4 "inside" items (one of each), 3 steps, 4 FAQs.

# Team reports and SEO data${team}`;

const IMG = { "Program": "store/img/program-cover.png", "Program inside": "store/img/program-inside.png", "Welcome sign": "store/img/welcome-sign.png", "Memory cards": "store/img/memory-card.png" };

function html(c) {
  const btn = (label, href, solid) => `<a class="btn ${solid ? "solid" : ""}" href="${href}">${esc(label)}</a>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.seo_title)}</title><style>
@font-face{font-family:Cormorant;src:url(${url("products/fillable/fonts/CormorantGaramond.ttf")})}
@font-face{font-family:Cormorant;font-style:italic;src:url(${url("products/fillable/fonts/CormorantGaramond-Italic.ttf")})}
@font-face{font-family:Cinzel;src:url(${url("products/fillable/fonts/Cinzel.ttf")})}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1366px;background:#f7f3ec;color:#3d4a36;font-family:Cormorant;font-size:24px;line-height:1.45}
section{padding:96px 120px;position:relative}
.brand{font-family:Cinzel;letter-spacing:.42em;color:#6d7f5f;font-size:20px}
h1{font-weight:500;font-size:78px;line-height:1.03;letter-spacing:-.005em;margin:22px 0 20px;max-width:640px}
h2{font-weight:500;font-size:52px;line-height:1.1;text-align:center;margin-bottom:48px}
.sub{font-style:italic;font-size:30px;color:#5f6e56;max-width:600px}
.btn{display:inline-block;font-family:Cinzel;font-size:17px;letter-spacing:.18em;text-decoration:none;color:#6d7f5f;border:1.5px solid #6d7f5f;border-radius:40px;padding:18px 30px;margin:34px 14px 0 0}
.btn.solid{background:#6d7f5f;color:#fff}
.hero{display:flex;align-items:center;gap:56px;padding-top:70px;min-height:760px;overflow:hidden}
.hero .art{position:absolute;top:-30px;right:-40px;width:560px;opacity:.55}
.hero .copy{flex:1;position:relative}
.hero .shot{position:relative;flex:0 0 520px;display:flex;justify-content:center}
.shot img{width:420px;background:#fff;padding:14px;box-shadow:0 22px 50px -22px rgba(61,74,54,.5);transform:rotate(-2deg)}
.shot img.b{position:absolute;width:250px;right:-6px;bottom:-40px;transform:rotate(4deg)}
.promise{display:flex;justify-content:center;gap:56px;padding:30px 120px;background:#eef0e8;font-style:italic;font-size:26px;color:#5f6e56}
.promise span:before{content:"✦  ";color:#a9b59c;font-style:normal}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:28px}
.card{background:#fff;border-radius:6px;padding:22px;text-align:center;box-shadow:0 10px 30px -20px rgba(61,74,54,.4)}
.card img{width:100%;height:250px;object-fit:contain;margin-bottom:16px}
.card h3,.step h3{font-family:Cinzel;font-weight:400;font-size:18px;letter-spacing:.14em;color:#6d7f5f;margin-bottom:8px;text-transform:uppercase}
.card p,.step p{font-size:22px;line-height:1.4}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:48px;text-align:center}
.num{font-family:Cinzel;font-size:46px;color:#a9b59c;margin-bottom:6px}
.signup{background:#6d7f5f;color:#fff;text-align:center;border-radius:10px;margin:0 120px;padding:72px 120px}
.signup h2{color:#fff;margin-bottom:18px}.signup p{font-size:26px;max-width:820px;margin:0 auto}
.signup .btn{background:#fff;color:#6d7f5f;border-color:#fff;margin-right:0}
.signup .fine{font-style:italic;font-size:20px;opacity:.85;margin-top:16px}
.faq{max-width:980px;margin:0 auto}
.faq div{border-bottom:1px solid rgba(109,127,95,.3);padding:22px 0}
.faq b{display:block;font-weight:500;font-size:28px;margin-bottom:6px}
.closing{text-align:center;padding-bottom:80px}.closing p{font-style:italic;font-size:28px;color:#5f6e56;max-width:760px;margin:0 auto}
.closing .btn{margin-right:0}
footer{text-align:center;padding:36px;font-size:19px;color:#7a866f;border-top:1px solid rgba(109,127,95,.25)}
.spray{display:block;margin:0 auto 10px;width:220px;opacity:.9}
</style></head><body>
<section class="hero"><img class="art" src="${url("products/fillable/art/sign-top.png")}">
 <div class="copy"><div class="brand">FOREVER HELD · ${esc(c.hero.eyebrow).toUpperCase()}</div><h1>${esc(c.hero.headline)}</h1><p class="sub">${esc(c.hero.sub)}</p>
 ${btn(c.hero.buy_label, KIT, true)}${btn(c.hero.free_label, CHECKLIST)}</div>
 <div class="shot"><img src="${url(IMG["Program"])}"><img class="b" src="${url(IMG["Memory cards"])}"></div></section>
<div class="promise">${(c.promise || []).slice(0, 3).map((p) => `<span>${esc(p)}</span>`).join("")}</div>
<section><h2>${esc(c.inside_title)}</h2><div class="grid">${(c.inside || []).slice(0, 4).map((i) => `<div class="card"><img src="${url(IMG[i.item] || IMG["Program"])}"><h3>${esc(i.title)}</h3><p>${esc(i.text)}</p></div>`).join("")}</div>
 <div style="text-align:center">${btn(c.hero.buy_label + " · $12.99", KIT, true)}</div></section>
<section style="padding-top:20px"><h2>${esc(c.steps_title)}</h2><div class="steps">${(c.steps || []).slice(0, 3).map((s, i) => `<div class="step"><div class="num">${i + 1}</div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join("")}</div></section>
<div class="signup"><h2>${esc(c.signup.title)}</h2><p>${esc(c.signup.text)}</p>${btn(c.signup.button, CHECKLIST)}<p class="fine">${esc(c.signup.fine)}</p></div>
<section><h2>Questions families ask</h2><div class="faq">${(c.faq || []).slice(0, 4).map((f) => `<div><b>${esc(f.q)}</b>${esc(f.a)}</div>`).join("")}</div></section>
<section class="closing"><img class="spray" src="${url("products/fillable/art/spray.png")}"><h2 style="margin-bottom:16px">${esc(c.closing.title)}</h2><p>${esc(c.closing.text)}</p>${btn(c.closing.button, KIT, true)}</section>
<footer><span class="brand" style="font-size:16px">FOREVER HELD</span><br>Printable memorial kits · payhip.com/ForeverHeld</footer>
</body></html>`;
}

function loadPlaywright() {
  try { return require("playwright"); } catch {}
  return createRequire(path.join(process.env.NODE_PATH || "/usr/local/lib/node_modules", "x"))("playwright");
}

async function main() {
  console.log(`Landing page ${DATE}`);
  let c;
  if (process.env.LANDING_SAMPLE) c = JSON.parse(await read(process.env.LANDING_SAMPLE));
  else {
    const prompt = PROMPT(await brief());
    c = await ask(SYSTEM, prompt, { json: true, strong: true, temperature: 0.6, who: "content-creator" });
    if (/canva/i.test(JSON.stringify(c))) c = await ask(SYSTEM, `${prompt}\n\nYour draft mentioned Canva. Buyers never need Canva (fill-in PDFs in Adobe Acrobat Reader). Rewrite.`, { json: true, strong: true, temperature: 0.5, who: "content-creator" });
  }
  if (!c?.hero?.headline) throw new Error("The writer returned no landing page copy.");

  const dir = path.join(HERE, "content", DATE);
  await fs.mkdir(dir, { recursive: true });
  const page = html(c);
  await fs.writeFile(path.join(dir, "_landing.html"), page);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  let pdf, preview;
  try {
    const tab = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await tab.setContent(page, { waitUntil: "load" });
    await tab.evaluate(() => document.fonts.ready);
    const height = await tab.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    preview = await tab.screenshot({ type: "jpeg", quality: 82, fullPage: true });
    pdf = await tab.pdf({ width: "1366px", height: `${height + 2}px`, printBackground: true, pageRanges: "1" });
  } finally { await browser.close(); }
  await fs.writeFile(path.join(dir, "landing.jpg"), preview);
  await fs.writeFile(path.join(dir, "landing.pdf"), pdf);
  // Public copy (GitHub Pages) so Claude can import it into Canva through the owner's Canva connector
  // when the agent's own Canva sign-in isn't set up.
  await fs.mkdir(path.join(HERE, "store", "landing"), { recursive: true });
  await fs.writeFile(path.join(HERE, "store", "landing", "landing.pdf"), pdf);
  await fs.writeFile(path.join(HERE, "store", "landing", "landing.jpg"), preview);
  const PUBLIC = "https://recreationalviper.github.io/agent-hq/store/landing/landing.pdf";
  console.log(`  designed: ${(pdf.length / 1024).toFixed(0)} KB PDF`);

  let design = null, canvaErr = "";
  try { design = await importDesign(pdf, `Forever Held landing ${DATE}`); console.log(`  Canva design ready: ${design.id}`); }
  catch (e) { canvaErr = e.message; console.log(`  Canva import failed: ${e.message}`); }

  const md = `**${c.seo_title}**\n${c.meta_description}\n\n` +
    (design ? `**Open in Canva:** ${design.edit_url}\n(The link works for 30 days; the design also stays in your Canva "Projects".)\n\n` : `**To put it in Canva:** ask Claude to "import the landing page into Canva" (PDF: ${PUBLIC}).\n\n`) +
    `**Links to add in Canva** (select a button > Link):\n- Buy buttons → ${KIT}\n- Free checklist buttons → ${CHECKLIST}\n\n**Publish:** in Canva tap Share > Publish website (free canva.site address).\n\n**Check first:**\n${c.notes || ""}\n\n**Keywords:** ${(c.keywords || []).join(", ")}`;
  const reportFile = `${DATE}-landing-page.md`;
  await fs.writeFile(path.join(HERE, "reports", reportFile), `# Landing page (Canva) - ${DATE}\n\n${md}\n\n## Copy\n\n\`\`\`json\n${JSON.stringify(c, null, 2)}\n\`\`\`\n`);
  let index = []; try { index = JSON.parse(await read("reports/index.json", "[]")); } catch {}
  index = [{ file: reportFile, agent: "content-creator", name: "Content Creator (landing page)", date: DATE }, ...index.filter((r) => r.file !== reportFile)].slice(0, 300);
  await fs.writeFile(path.join(HERE, "reports", "index.json"), JSON.stringify(index, null, 2) + "\n");
  if (process.env.LANDING_DRY !== "1") {
    await postFiles("content-creator", `🖥️ **New landing page** (sell the kit + grow the email list)\n${design ? `Open and edit in Canva: ${design.edit_url}` : `Ready for Canva: ask Claude to import it (${PUBLIC})`}`, [{ name: "landing-page.jpg", data: preview, type: "image/jpeg" }]);
    await report("content-creator", "Landing page (Canva)", md);
  }
  if (!design && canvaErr && !/isn't connected|needs PAYHIP|not_connected/.test(canvaErr)) console.log("  (Canva sign-in set up but import failed: see above)");
}

main().catch(async (e) => {
  console.error("ERROR:", e.message);
  if (process.env.LANDING_DRY !== "1") await alert(`⚠️ Landing page failed: ${e.message.slice(0, 300)}`);
  await flushUsage();
  process.exit(1);
});
