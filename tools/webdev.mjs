// Web Developer agent: grows the live store (foreverheld.pages.dev) with search-friendly planning guides.
// Runs on our shift only (ploy-state.mjs: hands off while Ploy is running). Each run writes or improves ONE guide as
// store/content/pages/<slug>.json, renders it with tools/store-pages.py, checks it, and the workflow publishes it.
// Guardrails: no prices/links other than the real ones, no invented reviews/stats, never mentions AI or Canva,
// at most one new guide per day, 40 guides max until the owner raises it.
//   node tools/webdev.mjs            build + check (the workflow commits and deploys)
//   node tools/webdev.mjs --dry-run  plan only, write nothing
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { ask } from "../ai-ask.mjs";
import { seoResearch } from "../seo.mjs";
import { mayChange } from "../ploy-state.mjs";
import { report } from "../discord.mjs";
import { flushUsage } from "../usage-log.mjs";

const DRY = process.argv.includes("--dry-run");
const DIR = "store/content/pages";
const MAX_GUIDES = Number(process.env.WEBDEV_MAX_GUIDES || 40);
const DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const read = (p, f = "") => fs.readFile(p, "utf8").catch(() => f);

// Things a page must never say (owner's rules + honesty). Checked in code, not just asked of the AI.
const BANNED = [
  [/\b(A\.?I\.?|artificial intelligence|ChatGPT|Gemini|Claude|GPT|chatbot|automat\w*|agents?)\b/i, "mentions AI/automation"],
  [/\bcanva\b/i, "mentions Canva"],
  [/\b(testimonial|reviews? (say|from)|customers (love|say)|rated|5[- ]star|stars?\b|best[- ]sell\w*|#1|number one|guarantee\w*)/i, "invented social proof or claims"],
  [/\d+(\.\d+)?\s?%|\b\d{2,}(,\d{3})* (families|customers|people|downloads)\b/i, "a statistic"],
  [/\$\s?(?!12\.99)\d/, "a price other than $12.99"],
  [/https?:\/\/(?!payhip\.com\/b\/(vqNSA|eYJqS)|foreverheld\.pages\.dev|get\.adobe\.com)/i, "an outside link"],
];
const FACTS = `Forever Held sells ONE product: the Soft Botanical suite, $12.99, instant download (https://payhip.com/b/vqNSA): a folded funeral program (prints on US Letter, folds to 5.5 x 8.5 in, 4 panels: cover, order of service, life story, thank-you/reception), a welcome sign (24 x 36 in, also prints 16 x 24 or 12 x 18 with no changes) and share-a-memory cards (4.25 x 5.5 in, four per letter sheet). Free: a planning checklist (https://payhip.com/b/eYJqS) that also signs people up for gentle seasonal emails.
How it works: fill-in PDFs opened in the free Adobe Acrobat Reader app on a phone or computer; tap the sample text and type; save; print at home on cardstock or same day at Staples, Office Depot or FedEx Office (sign mounted on foam board). Photos can be added on a computer only. No account, subscription or design skills; nothing is shipped.
Never say: Canva, AI, reviews, ratings, statistics, other prices, shipping, custom design services.`;

const SYSTEM = `You are the web developer and SEO writer for Forever Held, a small online shop of memorial printables.
${FACTS}
Brand voice (from Forever Held's brand guidelines): gentle, reassuring, practical; say "memorial printables"; pair comfort with concrete help (name the printable, how to personalize it on a phone, how and when to print); steps = action + immediate result; no unsupported promises.
You write genuinely helpful planning guides for grieving families that answer what people search for (good for Google and for AI answer engines: clear headings, direct answers first, short paragraphs, FAQ). Mention the suite naturally once or twice where it truly helps; the page must be useful even to someone who never buys.
Return valid JSON only.`;

function check(g) {
  const text = JSON.stringify(g);
  const problems = BANNED.filter(([re]) => re.test(text)).map(([, why]) => why);
  if (!/^[a-z0-9]+(-[a-z0-9]+){1,7}$/.test(g.slug || "")) problems.push("bad slug");
  if ((g.title || "").length > 65) problems.push("title too long");
  if ((g.description || "").length < 70 || (g.description || "").length > 160) problems.push("description length");
  if (!Array.isArray(g.sections) || g.sections.length < 3) problems.push("needs 3+ sections");
  const words = text.split(/\s+/).length;
  if (words < 450) problems.push(`too thin (${words} words)`);
  return problems;
}

async function main() {
  const gate = mayChange("website");
  if (!gate.ok) { console.log(`RESULT webdev: skipped (${gate.why})`); return; }
  await fs.mkdir(DIR, { recursive: true });
  const existing = [];
  for (const f of await fs.readdir(DIR)) if (f.endsWith(".json")) existing.push(JSON.parse(await read(`${DIR}/${f}`)));
  const madeToday = existing.some((g) => g.created === DATE);
  if (madeToday) { console.log("RESULT webdev: already published a guide today; next run tomorrow"); return; }
  if (existing.length >= MAX_GUIDES) { console.log(`RESULT webdev: ${existing.length} guides (cap ${MAX_GUIDES}); waiting for the owner`); return; }

  // What people search for, and what the team (incl. Ploy's audit) found
  let index = []; try { index = JSON.parse(await read("reports/index.json", "[]")); } catch {}
  const seoRep = index.find((r) => r.agent === "seo");
  const seoText = seoRep ? (await read(`reports/${seoRep.file}`)).slice(0, 6000) : "";
  const board = (await read("ploy/status.md")).slice(0, 4000);
  const shift = [];
  for (const f of (await fs.readdir("ploy/shift").catch(() => [])).filter((f) => /seo|website/.test(f)).slice(-3)) shift.push((await read(`ploy/shift/${f}`)).slice(0, 2500));
  const auto = await seoResearch({ seeds: ["funeral program", "celebration of life", "memorial service", "funeral welcome sign", "obituary", "eulogy"], modifiers: ["template", "how to", "ideas", "what to"] }).catch(() => null);

  const prompt = `Today is ${DATE}. Write ONE new planning guide for the store.
Pick the search topic with the best mix of real demand (from the data below), fit with our suite, and no overlap with existing guides.
Ploy's SEO audit found "funeral program template" as the top opportunity; if no guide covers it yet, write that one first.
Existing guides (do not repeat): ${existing.map((g) => `${g.slug} ("${g.h1}")`).join("; ") || "none yet"}

Return JSON:
{"slug": "kebab-case-url-2-to-8-words", "title": "SEO title max 60 chars, main keyword first", "description": "meta description 120-155 chars",
 "h1": "page heading", "intro": "2-3 sentence direct answer to the search, gentle",
 "sections": [{"h2": "question-style or clear heading", "paragraphs": ["40-90 words each"], "bullets": ["optional short steps or items"]}],
 "faq": [{"q": "a real question people ask", "a": "direct answer, 25-60 words"}],
 "cta_title": "short closing heading", "keywords": ["the phrases this page targets"], "why": "one line: why this topic now (cite the data)"}
Use 4-6 sections and 3-5 FAQs, 700-1100 words in total. US English.

# Real search data (Google autocomplete, collected minutes ago)
${auto?.text?.slice(0, 5000) || "(none)"}

# SEO Scout's latest report
${seoText || "(none yet)"}

# Ploy shift board (Ploy leads SEO; we work its plan on our shift)
${board}
${shift.join("\n\n")}`;

  let g = await ask(SYSTEM, prompt, { json: true, strong: true, temperature: 0.5, who: "webdev" });
  let problems = check(g);
  if (problems.length) {
    console.log(`  first draft failed checks: ${problems.join(", ")}; rewriting`);
    g = await ask(SYSTEM, `${prompt}\n\nYour previous draft broke these rules: ${problems.join(", ")}. Fix them and return the full JSON again.`, { json: true, strong: true, temperature: 0.4, who: "webdev" });
    problems = check(g);
  }
  if (existing.some((x) => x.slug === g.slug)) problems.push("slug already exists");
  if (problems.length) throw new Error(`guide failed checks: ${problems.join(", ")}`);

  g = { ...g, created: DATE, updated: DATE, by: "Web Developer agent" };
  console.log(`  guide: ${g.slug} (${g.keywords?.join(", ")})`);
  if (DRY) { console.log(JSON.stringify(g, null, 2)); return; }
  await fs.writeFile(`${DIR}/${g.slug}.json`, JSON.stringify(g, null, 2) + "\n");
  execFileSync("python3", ["tools/store-pages.py"], { stdio: "inherit" });
  const html = await read(`store/${g.slug}.html`);
  if (!html.includes(g.h1.replace(/&/g, "&amp;").slice(0, 20))) throw new Error("rendered page check failed");

  const url = `https://foreverheld.pages.dev/${g.slug}.html`;
  const md = `New planning guide published on our shift (Ploy on break): **${g.h1}**\n${url}\n\nTargets: ${(g.keywords || []).join(", ")}\nWhy: ${g.why || ""}\n\nChecks passed: no AI/Canva mentions, no invented reviews or stats, only real links and the $12.99 price.`;
  const file = `${DATE}-webdev.md`;
  await fs.writeFile(`reports/${file}`, `# Web Developer - ${DATE}\n\n${md}\n\n## For Ploy\nWe published ${url} (guide JSON: store/content/pages/${g.slug}.json). Use it, link to it, or improve it on your shift.\n`);
  index = [{ file, agent: "webdev", name: "Web Developer", date: DATE }, ...index.filter((r) => r.file !== file)].slice(0, 300);
  await fs.writeFile("reports/index.json", JSON.stringify(index, null, 2) + "\n");
  await report("webdev", "🛠️ New guide on the store", md).catch(() => {});
  console.log(`RESULT webdev: published ${url}`);
}

main().catch(async (e) => {
  console.log(`RESULT webdev: FAILED ${e.message}`);
  await flushUsage();
  process.exitCode = 1;
});
