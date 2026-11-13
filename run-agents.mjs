// Agent HQ routine runner — runs on GitHub Actions (free), calls Google Gemini (free tier),
// and saves each agent's report into reports/ so the website can show it.
import { gwFetch } from "./ai-gateway.mjs";
import { shiftBlock } from "./ploy-state.mjs";
import { flushUsage } from "./usage-log.mjs";
import fs from "node:fs/promises";
import { hasGroq, groqChat } from "./ai-fallback.mjs";
import { hasGoogle, addUpdate, mdToLines } from "./gdocs.mjs";
import { salesSummary } from "./sales.mjs";
import { seoResearch } from "./seo.mjs";
import { hasExa, researchBlock } from "./exa.mjs";
import { report as discordReport, alert as discordAlert } from "./discord.mjs";
import { upcoming } from "./holidays.mjs";

const API = process.env.API_BASE || "https://generativelanguage.googleapis.com/v1beta";
const KEY = process.env.GEMINI_API_KEY;
const MODE = (process.env.RUN_MODE || "due").trim(); // "due", "all", or an agent id
const TZ = process.env.TIME_ZONE || "America/New_York";

const RULES = "Rules: You write drafts and recommendations only. Never claim you published, spent money, contacted anyone or visited a website - you cannot. Flag anything needing the owner's approval. Follow Etsy's Creativity Standards: original designs, disclose AI use, real previews, no AI-written recipes/patterns/how-to instructions, never call AI work handmade. You have no live internet access: if a fact may be out of date (fees, policies, trends), say so. Keep it short and phone-friendly, using simple markdown (headings, bullets).";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function today() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, dow: get("weekday").toLowerCase().slice(0, 3) };
}

function isDue(agent, dow, date = "") {
  if (agent.enabled === false) return false;
  // "group:studio" = the extra afternoon run: only that group's agents marked twiceDaily.
  if (MODE.startsWith("group:")) return agent.group === MODE.slice(6) && agent.twiceDaily === true;
  if (MODE !== "due" && MODE !== "all") return agent.id === MODE;
  const s = String(agent.schedule || "manual").toLowerCase();
  if (s === "manual") return false;
  if (MODE === "all") return true;
  if (s === "daily") return true;
  if (s === "weekdays") return !["sat", "sun"].includes(dow);
  const m = s.match(/^weekly:([a-z]{3})$/);
  if (m) return m[1] === dow;
  const mo = s.match(/^monthly:(\d{1,2})$/); // e.g. monthly:1 = the 1st of each month
  return Boolean(mo && Number(date.slice(8, 10)) === Number(mo[1]));
}

async function api(path, init = {}) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res;
    try {
      res = await gwFetch(API + path, { ...init, signal: AbortSignal.timeout(120000), headers: { "Content-Type": "application/json", "x-goog-api-key": KEY, ...(init.headers || {}) } });
    } catch (e) {
      if (attempt < 2) { console.log("  no answer, retrying..."); continue; }
      throw new Error("BUSY: Google didn't answer in time.");
    }
    if ((res.status === 429 || res.status === 503) && attempt < 2) { console.log(`  busy (${res.status}), waiting...`); await sleep(20000); continue; }
    const data = await res.json().catch(() => ({}));
    if (res.status === 429 || res.status === 503) {
      const quota = (data?.error?.details || []).flatMap((d) => d.violations || []).map((v) => v.quotaId).filter(Boolean);
      throw new Error("BUSY: " + (data?.error?.message || `HTTP ${res.status}`).split(" For more information")[0] + (quota.length ? ` [limit: ${[...new Set(quota)].join(", ")}]` : ""));
    }
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return data;
  }
}

// Newest version first, e.g. gemini-3.8-flash before gemini-2.5-flash.
function version(name) {
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) : 0;
}

const RETIRED = /no longer available|not found|is not supported|deprecated|has been retired/i;

// Returns models to try, best first. Retired models are skipped automatically at run time.
async function pickModels(wanted) {
  const { models = [] } = await api("/models?pageSize=200");
  const usable = models
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent") && /gemini/i.test(m.name) && !/image|tts|audio|live|embed/i.test(m.name))
    .map((m) => m.name);
  const rank = (n) => (/flash/i.test(n) ? 0 : 2) + (/lite|preview|exp/i.test(n) ? 1 : 0);
  usable.sort((a, b) => rank(a) - rank(b) || version(b) - version(a));
  if (wanted && wanted !== "auto") {
    const w = wanted.startsWith("models/") ? wanted : `models/${wanted}`;
    return [w, ...usable.filter((n) => n !== w)];
  }
  if (!usable.length) throw new Error("No usable Gemini model found for this key.");
  return usable;
}

// Fetch a public web page as plain text so agents can read real, current info.
async function pageText(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "Mozilla/5.0 (compatible; AgentHQ)" } });
    if (!res.ok) return `(could not load: HTTP ${res.status})`;
    const html = await res.text();
    return html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
      .replace(/\s+/g, " ").trim().slice(0, 8000) || "(page was empty)";
  } catch (e) { return `(could not load: ${e.message})`; }
}

async function readJson(path, fallback) {
  try { return JSON.parse(await fs.readFile(path, "utf8")); } catch { return fallback; }
}

async function weekOfReports(index, date, skip = new Set()) {
  const cutoff = new Date(date + "T00:00:00Z").getTime() - 7 * 86400000;
  const recent = index.filter((r) => new Date(r.date + "T00:00:00Z").getTime() >= cutoff && r.agent !== "review" && !skip.has(r.agent)).slice(0, 20);
  let text = "";
  for (const r of recent) {
    const body = await fs.readFile(`reports/${r.file}`, "utf8").catch(() => "");
    text += `\n\n### ${r.name} (${r.date})\n${body.slice(0, 4000)}`;
  }
  return text.slice(0, 40000) || "\n\n(No reports from the team this week yet.)";
}

async function main() {
  if (!KEY) throw new Error("Missing GEMINI_API_KEY secret. Add it in GitHub: Settings > Secrets and variables > Actions.");
  const cfg = await readJson("agents.json", null);
  if (!cfg || !Array.isArray(cfg.agents)) throw new Error("agents.json is missing or broken.");
  const { date, dow } = today();
  const due = cfg.agents.filter((a) => isDue(a, dow, date));
  console.log(`Date ${date} (${dow}), mode "${MODE}": ${due.length} agent(s) due -> ${due.map((a) => a.id).join(", ") || "none"}`);
  if (!due.length) return;

  let models = await pickModels(cfg.model);
  let geminiOut = false; // set once Gemini says its free daily limit is used up
  console.log(`Model: ${models[0]}`);
  await fs.mkdir("reports", { recursive: true });
  let index = await readJson("reports/index.json", []);

  // Run team members first, the manager-style "reads" agents last so they see today's work.
  due.sort((a, b) => Boolean(a.reads) - Boolean(b.reads));

  let salesText; // fetched once per run for the shop agents
  async function runAgent(agent, noSearch = false) {
    if (agent.search && !noSearch) {
      try { return await runAgent(agent, "try"); }
      catch (e) {
        if (!/quota/i.test(e.message)) throw e;
        console.log("  web search limit hit, answering without web search");
        return runAgent(agent, true);
      }
    }
    const search = agent.search && noSearch !== true;
    let task = `Today is ${date}.\n\nYour job: ${agent.instructions}`;
    if (Array.isArray(agent.pages) && agent.pages.length) {
      task += "\n\nToday's copies of these web pages (real and current - base your answer on them, link the page for each claim, and say when a page could not be loaded):";
      for (const url of agent.pages) task += `\n\n### ${url}\n${await pageText(url)}`;
    }
    // Local files written by this repo's own scanners. Real output, so the agent
    // reports facts instead of guessing — and it costs no extra API calls.
    if (Array.isArray(agent.readsFiles) && agent.readsFiles.length) {
      task += "\n\nFresh data collected by this repo's own scanners a few minutes ago:";
      for (const path of agent.readsFiles) {
        const body = await fs.readFile(path, "utf8").catch(() => "");
        task += `\n\n### ${path}\n${body ? body.slice(0, 24000) : `(the file ${path} is missing - say so and do not invent findings)`}`;
      }
    }
    if (agent.followsPloy) task += await shiftBlock();
    if (agent.holidays) task += `\n\nUpcoming holidays and remembrance days (computed from the calendar, so the dates are real):\n${upcoming(date, agent.holidays)}`;
    if (agent.seo) {
      const r = await seoResearch(agent.seo).catch((e) => ({ text: "", notes: [`SEO data unavailable (${e.message})`] }));
      task += `\n\nFresh SEO data collected minutes ago (real; base every keyword on it and do not invent search volumes):\n${r.text || "(none)"}${r.notes.length ? `\n\nNotes: ${r.notes.join(" ")}` : ""}`;
      for (const n of r.notes) console.log(`  ${n}`);
    }
    if (agent.exa && hasExa()) {
      const since = agent.exa.days ? new Date(Date.now() - agent.exa.days * 864e5).toISOString().slice(0, 10) : undefined;
      const r = await researchBlock(agent.exa.searches.map((q) => (typeof q === "string" ? { query: q, since } : { since, ...q })), agent.id).catch(() => ({ results: [] }));
      console.log(`  Exa: ${r.results.length} web results`);
      if (r.results.length) task += `\n\nFresh web results found minutes ago with Exa search (real pages; cite them as [n] with their links, and never invent anything they don't say):\n${r.text}`;
    }
    if (agent.doc === "etsy") {
      salesText ??= await salesSummary().then((r) => r?.text || "").catch((e) => { console.log(`  sales feed unavailable: ${e.message}`); return ""; });
      if (salesText) task += `\n\nReal store sales (Payhip, from the sales feed):\n${salesText}`;
    }
    if (agent.reads) task += `\n\nThis week's team reports:${await weekOfReports(index, date, new Set(cfg.agents.filter((a) => a.context).map((a) => a.id)))}`;
    // Agents with "search": true can use Google Search (free on Gemini) and must cite sources.
    const baseRules = agent.rules || RULES;
    const rules = search ? baseRules.replace(/You have no live internet access:[^.]*\./, "You can search the web with Google Search: use it, prefer official sources, include the link for every claim, and say when something could not be confirmed.") : baseRules;
    const system = `You are "${agent.name}", an agent on a small AI team.\n\nContext: ${agent.context || cfg.context}\n\n${rules}`;
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: task }] }],
      ...(search ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: { temperature: search ? 0.3 : 0.8 }
    });
    // Try the best model first. Retired models are dropped for good; busy ones are
    // skipped. Whichever model answers moves to the front so later agents start there.
    let data, lastErr, backupText;
    for (let i = 0; i < models.length && i < 5 && !data && !geminiOut; ) {
      const m = models[i];
      try {
        data = await api(`/${m}:generateContent`, { method: "POST", body });
        if (i) { console.log(`  answered by ${m} (using it first from now on)`); models = [m, ...models.filter((x) => x !== m)]; }
      } catch (err) {
        lastErr = err;
        if (RETIRED.test(err.message)) { console.log(`  ${m} is retired, skipping it`); models = models.filter((x) => x !== m); continue; }
        if (err.message.startsWith("BUSY") && models[i + 1]) { console.log(`  ${m} is busy, trying ${models[i + 1]}`); i++; continue; }
        if (!err.message.startsWith("BUSY")) throw err;
        break;
      }
    }
    if (!data && (geminiOut || lastErr?.message.startsWith("BUSY"))) {
      // Search agents first retry without search (the search quota is separate).
      if (search && !geminiOut && /quota/i.test(lastErr?.message || "")) throw lastErr;
      if (/quota/i.test(lastErr?.message || "") && !geminiOut) { geminiOut = true; console.log("  Gemini's free daily limit is used up; switching the rest of today's agents to the backup AI"); }
      if (!hasGroq()) throw lastErr || new Error("Gemini is out and no backup AI key is set");
      if (search) throw new Error("quota: backup AI has no web search");
      backupText = await groqChat(system, task, { temperature: 0.8 });
    }
    if (!data && !backupText) throw lastErr || new Error("no model answered");
    let text = backupText || (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
    if (!text) throw new Error("empty reply");
    let sources = "";
    const seen = new Set();
    for (const c of data?.candidates?.[0]?.groundingMetadata?.groundingChunks || []) {
      const w = c.web; if (!w?.uri || seen.has(w.uri)) continue; seen.add(w.uri);
      sources += `\n- [${(w.title || w.uri).replace(/[\[\]]/g, "")}](${w.uri})`;
    }
    if (sources) text += `\n\n## Sources${sources}`;
    if (agent.search && !search) text = `> ⚠️ Web search was unavailable today, so this is from memory and may be out of date. Check the official links before acting.\n\n${text}`;
    const file = `${date}-${agent.id}.md`;
    await fs.writeFile(`reports/${file}`, `# ${agent.name} - ${date}\n\n${text}\n`);
    index = [{ file, agent: agent.id, name: agent.name, date }, ...index.filter((r) => r.file !== file)].slice(0, 300);
    await fs.writeFile("reports/index.json", JSON.stringify(index, null, 2));
    console.log(`  saved reports/${file}`);
    // Some agents also keep a standing file other agents read (e.g. content/seasonal.md).
    if (agent.saveAs) { await fs.mkdir(agent.saveAs.replace(/\/[^/]+$/, ""), { recursive: true }); await fs.writeFile(agent.saveAs, `# ${agent.name} (updated ${date})\n\n${text}\n`); console.log(`  saved ${agent.saveAs}`); }
    await discordReport(agent.id, `${agent.name} · ${date}`, text, { file });
    // Agents tied to a Google Doc (e.g. the Etsy team -> "Etsy Planning") add their update there too.
    const doc = agent.doc && cfg.docs?.[agent.doc];
    if (doc && hasGoogle()) {
      try { await addUpdate(doc.id, doc.anchor || "Agent updates", `${date} · ${agent.name}`, mdToLines(text)); console.log(`  added to the ${doc.name || agent.doc} doc`); }
      catch (e) { console.log(`  couldn't update the ${doc.name || agent.doc} doc: ${e.message}`); }
    }
  }

  // First pass, then one retry pass for anything that failed (busy spikes usually pass).
  let failed = [];
  for (const agent of due) {
    console.log(`Running ${agent.name}...`);
    try { await runAgent(agent); }
    catch (e) { failed.push(agent); console.error(`  ${agent.name} failed: ${e.message}`); }
  }
  if (failed.length) {
    console.log(`Retrying ${failed.length} agent(s) in 90 seconds...`);
    await sleep(90000);
    const again = failed; failed = [];
    for (const agent of again) {
      console.log(`Retrying ${agent.name}...`);
      try { await runAgent(agent); }
      catch (e) { failed.push(agent); console.error(`  ${agent.name} failed again: ${e.message}`); }
    }
  }
  const failures = failed.length;
  console.log(`Done: ${due.length - failures} of ${due.length} agent(s) saved a report.`);
  // Studio agents' failures go to Studio HQ (#studio-alerts); everything else to Agent HQ (#alerts).
  const failedStudio = failed.filter((a) => a.group === "studio"), failedMain = failed.filter((a) => a.group !== "studio");
  if (failedMain.length) await discordAlert(`⚠️ ${failedMain.length} agent(s) failed today: ${failedMain.map((a) => a.name).join(", ")}. The rest reported normally.`);
  if (failedStudio.length) await discordAlert(`⚠️ ${failedStudio.length} studio agent(s) failed: ${failedStudio.map((a) => a.name).join(", ")}. The rest reported normally.`, "studio-alerts");
  if (failures === due.length) throw new Error("Every agent failed this run.");
}

main().catch(async (e) => { console.error("ERROR:", e.message); await flushUsage(); process.exit(1); });
