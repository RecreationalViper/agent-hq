// Shared "out for today" notes. When an AI's free DAILY allowance runs out, the first agent to hear it writes a
// note (Cloudflare KV, namespace "foreverheld-sales", key ai-out:<provider>) that expires when the allowance resets.
// Every other agent run reads the notes once and skips that AI without calling it, instead of knocking all day.
// Per-minute "slow down" limits are NOT noted (those clear in seconds). Gemini limits are per model, so notes are too.
// Fails open: if KV can't be reached, agents simply call the AI as before.
const ACC = () => process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const TOK = () => process.env.CLOUDFLARE_API_TOKEN?.trim();
const KV = () => `https://api.cloudflare.com/client/v4/accounts/${ACC()}/storage/kv/namespaces`;
const H = () => ({ Authorization: `Bearer ${TOK()}` });
const NS_TITLE = "foreverheld-sales";
let ns, notes, lastProblem = "", told = new Set();
export async function aiOutStatus() { const n = await load(); return { store: Boolean(await nsId()), problem: lastProblem, notes: [...n].map(([k, t]) => `${k} until ${new Date(t).toISOString()}`) }; }

async function nsId() {
  if (ns !== undefined) return ns;
  ns = null;
  try {
    const j = await (await fetch(`${KV()}?per_page=100`, { headers: H(), signal: AbortSignal.timeout(10000) })).json();
    ns = (j.result || []).find((n) => n.title === NS_TITLE)?.id || null;
    if (!ns) lastProblem = j.success === false ? `KV: ${j.errors?.[0]?.message || "not allowed"}` : `KV store "${NS_TITLE}" not found`;
  } catch (e) { lastProblem = `KV: ${e.message}`; }
  return ns;
}

async function load() {
  if (notes) return notes;
  notes = new Map();
  if (!ACC() || !TOK() || process.env.AI_OUT === "off") return notes;
  const id = await nsId();
  if (!id) return notes;
  try {
    const j = await (await fetch(`${KV()}/${id}/keys?prefix=ai-out:`, { headers: H(), signal: AbortSignal.timeout(10000) })).json();
    for (const k of j.result || []) if (k.expiration && k.expiration * 1000 > Date.now()) notes.set(k.name.slice(7), k.expiration * 1000);
  } catch {}
  return notes;
}

// Which allowance a request uses: "Gemini:<model>", "Groq", "Cloudflare", "OpenRouter", "Requesty". null = not tracked.
export function outKey(url, init) {
  if ((init?.method || "GET").toUpperCase() !== "POST") return null;
  if (/generativelanguage\.googleapis\.com|\/google-ai-studio\//.test(url)) { const m = url.match(/models\/([^:/?]+):generateContent/); return m ? `Gemini:${m[1]}` : null; }
  if (/\/chat\/completions/.test(url)) {
    if (/api\.groq\.com|\/groq\//.test(url)) return "Groq";
    if (/openrouter\.ai|\/openrouter\//.test(url)) return "OpenRouter";
    if (/requesty\.ai/.test(url)) return "Requesty";
  }
  if (/api\.cloudflare\.com\/client\/v4\/accounts\/[^/]+\/ai\/(run\/|v1\/chat\/completions)/.test(url) && !/flux|lucid|stable-diffusion|phoenix|image/i.test(url)) return "Cloudflare";
  return null;
}

// When each daily allowance comes back.
function nextMidnight(tz) {
  const hourIn = (t) => Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(t));
  let t = Math.ceil(Date.now() / 900000) * 900000; // step in 15-minute slots to the next local midnight
  for (let i = 0; i < 100 && hourIn(t) !== 0; i++) t += 900000;
  return t + 5 * 60000;
}
function resetAt(key) {
  if (key.startsWith("Gemini")) return nextMidnight("America/Los_Angeles");
  if (key === "Groq") return Date.now() + 3600e3; // Groq's daily token window rolls; look again in an hour
  return nextMidnight("UTC"); // Cloudflare, OpenRouter, Requesty reset at 00:00 UTC
}
const DAILY = {
  Gemini: /PerDay|per day|daily/i,
  Groq: /tokens per day|requests per day|\bTPD\b|\bRPD\b/i,
  Cloudflare: /daily free allocation|neurons/i,
  OpenRouter: /per-day|per day|free-models-per-day|daily/i,
  Requesty: /per day|daily|free (tier|requests) limit/i,
};
export const isDailyLimit = (key, status, text) => (status === 429 || status === 402 || status === 403) && (DAILY[key.split(":")[0]]?.test(text) ?? false);

// Returns a stand-in "used up" answer if the AI is noted as out, else null.
export async function skipIfOut(key) {
  if (!key) return null;
  const until = (await load()).get(key);
  if (!until || until <= Date.now()) return null;
  const when = new Date(until).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
  if (!told.has(key)) { told.add(key); console.log(`  ${key}: daily free limit already used up (shared note), skipping until ${when} ET`); }
  const message = `quota: ${key} daily free limit already used up (shared note, back at ${when} ET); skipped without calling`;
  return new Response(JSON.stringify({ error: { code: 429, status: "RESOURCE_EXHAUSTED", message }, errors: [{ message }] }), { status: 429, headers: { "content-type": "application/json", "x-ai-out": "1" } });
}

// After a real failure: if it was the daily allowance, write the shared note.
export async function noteIfDaily(key, res) {
  if (!key || res.ok) return;
  try {
    const text = await res.clone().text();
    if (!isDailyLimit(key, res.status, text)) return;
    const until = resetAt(key);
    (await load()).set(key, until);
    const id = await nsId();
    if (!id) return;
    const exp = Math.max(Math.floor(until / 1000), Math.floor(Date.now() / 1000) + 120);
    await fetch(`${KV()}/${id}/values/${encodeURIComponent("ai-out:" + key)}?expiration=${exp}`, { method: "PUT", headers: H(), body: "1", signal: AbortSignal.timeout(10000) });
    console.log(`  ${key}: daily free limit used up; told the other agents to skip it until it resets`);
  } catch {}
}
