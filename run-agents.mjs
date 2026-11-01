// Agent HQ routine runner — runs on GitHub Actions (free), calls Google Gemini (free tier),
// and saves each agent's report into reports/ so the website can show it.
import fs from "node:fs/promises";

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

function isDue(agent, dow) {
  if (agent.enabled === false) return false;
  if (MODE !== "due" && MODE !== "all") return agent.id === MODE;
  const s = String(agent.schedule || "manual").toLowerCase();
  if (s === "manual") return false;
  if (MODE === "all") return true;
  if (s === "daily") return true;
  if (s === "weekdays") return !["sat", "sun"].includes(dow);
  const m = s.match(/^weekly:([a-z]{3})$/);
  return Boolean(m && m[1] === dow);
}

async function api(path, init = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(API + path, { ...init, headers: { "Content-Type": "application/json", "x-goog-api-key": KEY, ...(init.headers || {}) } });
    if ((res.status === 429 || res.status === 503) && attempt < 3) { console.log(`  rate limited (${res.status}), waiting...`); await sleep(30000 * attempt); continue; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return data;
  }
}

async function pickModel(wanted) {
  if (wanted && wanted !== "auto") return wanted.startsWith("models/") ? wanted : `models/${wanted}`;
  const { models = [] } = await api("/models?pageSize=200");
  const usable = models.filter((m) => (m.supportedGenerationMethods || []).includes("generateContent") && /gemini/i.test(m.name) && !/image|tts|audio|live|embed/i.test(m.name));
  const pick = usable.find((m) => /flash/i.test(m.name) && !/lite|preview|exp/i.test(m.name)) || usable.find((m) => /flash/i.test(m.name)) || usable[0];
  if (!pick) throw new Error("No usable Gemini model found for this key.");
  return pick.name;
}

async function readJson(path, fallback) {
  try { return JSON.parse(await fs.readFile(path, "utf8")); } catch { return fallback; }
}

async function weekOfReports(index, date) {
  const cutoff = new Date(date + "T00:00:00Z").getTime() - 7 * 86400000;
  const recent = index.filter((r) => new Date(r.date + "T00:00:00Z").getTime() >= cutoff && r.agent !== "review").slice(0, 20);
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
  const due = cfg.agents.filter((a) => isDue(a, dow));
  console.log(`Date ${date} (${dow}), mode "${MODE}": ${due.length} agent(s) due -> ${due.map((a) => a.id).join(", ") || "none"}`);
  if (!due.length) return;

  const model = await pickModel(cfg.model);
  console.log(`Model: ${model}`);
  await fs.mkdir("reports", { recursive: true });
  let index = await readJson("reports/index.json", []);
  let failures = 0;

  // Run team members first, the manager-style "reads" agents last so they see today's work.
  due.sort((a, b) => Boolean(a.reads) - Boolean(b.reads));

  for (const agent of due) {
    console.log(`Running ${agent.name}...`);
    try {
      let task = `Today is ${date}.\n\nYour job: ${agent.instructions}`;
      if (agent.reads) task += `\n\nThis week's team reports:${await weekOfReports(index, date)}`;
      const data = await api(`/${model}:generateContent`, {
        method: "POST",
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `You are "${agent.name}", an agent on a small AI team.\n\nBusiness context: ${cfg.context}\n\n${RULES}` }] },
          contents: [{ role: "user", parts: [{ text: task }] }],
          generationConfig: { temperature: 0.8 }
        })
      });
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
      if (!text) throw new Error("empty reply");
      const file = `${date}-${agent.id}.md`;
      await fs.writeFile(`reports/${file}`, `# ${agent.name} - ${date}\n\n${text}\n`);
      index = [{ file, agent: agent.id, name: agent.name, date }, ...index.filter((r) => r.file !== file)].slice(0, 300);
      await fs.writeFile("reports/index.json", JSON.stringify(index, null, 2));
      console.log(`  saved reports/${file}`);
    } catch (e) {
      failures++;
      console.error(`  ${agent.name} failed: ${e.message}`);
    }
  }
  if (failures === due.length) throw new Error("Every agent failed this run.");
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
