// Backup AI provider: Groq (free tier, OpenAI-compatible). Used only when Gemini is
// busy or out of its free daily quota. Needs the GROQ_API_KEY secret.
// Free-tier limits seen on this key: 1,000 requests/day and 8,000 tokens/minute,
// so long prompts are trimmed to fit.
const BASE = process.env.GROQ_API_BASE || "https://api.groq.com/openai/v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SKIP = /guard|whisper|orpheus|tts|allam|compound|playai|embed|vision/i;
const PREFER = [/gpt-oss-120b/i, /qwen3/i, /llama-3\.3-70b|llama-4/i, /gpt-oss-20b/i, /llama/i];
let models;

export const hasGroqKey = () => Boolean(process.env.GROQ_API_KEY);
export const hasCloudflare = () => Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID);
// Any backup available? (Groq first, then Cloudflare Workers AI)
export const hasOpenRouter = () => Boolean(process.env.OPENROUTER_API_KEY);
export const hasGroq = () => hasGroqKey() || hasCloudflare() || hasOpenRouter();

async function call(path, init = {}) {
  const res = await fetch(BASE + path, { ...init, signal: AbortSignal.timeout(120000), headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" } });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = {}; }
  if (!res.ok) { const e = new Error(`Groq ${res.status}: ${data.error?.message || text.slice(0, 200)}`); e.status = res.status; e.retryAfter = Number(res.headers.get("retry-after")) || 0; throw e; }
  return data;
}

async function pick() {
  if (models) return models;
  const ids = ((await call("/models")).data || []).map((m) => m.id).filter((i) => !SKIP.test(i));
  const rank = (i) => { const k = PREFER.findIndex((r) => r.test(i)); return k < 0 ? 99 : k; };
  models = ids.sort((a, b) => rank(a) - rank(b));
  if (!models.length) throw new Error("Groq has no chat models available.");
  return models;
}

// Returns the reply text. Throws if Groq can't answer either.
async function groqOnly(system, user, { json = false, temperature = 0.7, maxChars = 16000 } = {}) {
  let input = user.length > maxChars ? user.slice(0, maxChars) + "\n\n[Some input was trimmed to fit the backup AI's limits.]" : user;
  let lastErr;
  for (const model of (await pick()).slice(0, 3)) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await call("/chat/completions", { method: "POST", body: JSON.stringify({
          model, temperature, max_tokens: 2500,
          messages: [{ role: "system", content: system }, { role: "user", content: input }],
          ...(json ? { response_format: { type: "json_object" } } : {}),
          ...(/gpt-oss/i.test(model) ? { reasoning_effort: "low" } : {})
        }) });
        const text = (data.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        if (!text) throw new Error("Groq returned an empty reply");
        console.log(`  answered by backup AI: Groq ${model}`);
        return text;
      } catch (e) {
        lastErr = e;
        if (e.status === 413 || /too large|reduce your message/i.test(e.message)) { input = input.slice(0, Math.floor(input.length / 2)) + "\n\n[Trimmed further to fit.]"; continue; }
        if (e.status === 429 && attempt < 2) { const wait = Math.min(65, e.retryAfter || 30); console.log(`  Groq busy, waiting ${wait}s`); await sleep(wait * 1000); continue; }
        if (json && e.status === 400 && /json/i.test(e.message)) { json = false; continue; }
        break; // try the next model
      }
    }
  }
  throw lastErr || new Error("Groq could not answer");
}

// ---------- Cloudflare Workers AI (free: 10,000 neurons a day) ----------
const CF = () => `${process.env.CLOUDFLARE_API_BASE || "https://api.cloudflare.com/client/v4"}/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai`;
const CF_PREFER = [/gpt-oss-120b/i, /llama-3\.3-70b-instruct-fp8-fast/i, /llama-4-scout/i, /qwen.*(3|2\.5)/i, /mistral-small/i, /llama-3\.1-8b/i];
let cfModels;
async function cfCall(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(120000), headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" } });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = {}; }
  if (!res.ok) { const e = new Error(`Cloudflare ${res.status}: ${data.errors?.[0]?.message || data.error?.message || text.slice(0, 200)}`); e.status = res.status; throw e; }
  return data;
}
export async function cloudflareModels() {
  if (cfModels) return cfModels;
  const data = await cfCall(`${CF()}/models/search?task=${encodeURIComponent("Text Generation")}&per_page=100`);
  const ids = (data.result || []).map((m) => m.name).filter((n) => n && !/guard|lora|awq|vision|coder|math|sql|embed/i.test(n));
  const rank = (i) => { const k = CF_PREFER.findIndex((r) => r.test(i)); return k < 0 ? 99 : k; };
  cfModels = ids.sort((a, b) => rank(a) - rank(b));
  if (!cfModels.length) throw new Error("Cloudflare has no text models available.");
  return cfModels;
}
export async function cloudflareChat(system, user, { json = false, temperature = 0.7, maxChars = 24000 } = {}) {
  const input = user.length > maxChars ? user.slice(0, maxChars) + "\n\n[Some input was trimmed to fit the backup AI's limits.]" : user;
  let lastErr;
  for (const model of (await cloudflareModels()).slice(0, 3)) {
    try {
      const data = await cfCall(`${CF()}/v1/chat/completions`, { method: "POST", body: JSON.stringify({
        model, temperature, max_tokens: 2500,
        messages: [{ role: "system", content: system + (json ? "\nReply with valid JSON only." : "") }, { role: "user", content: input }],
        ...(json ? { response_format: { type: "json_object" } } : {})
      }) });
      const text = (data.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      if (!text) throw new Error("Cloudflare returned an empty reply");
      console.log(`  answered by backup AI: Cloudflare ${model}`);
      return text;
    } catch (e) { lastErr = e; if (e.status === 401 || e.status === 403) break; }
  }
  throw lastErr || new Error("Cloudflare could not answer");
}

// ---------- OpenRouter: FREE models only (ids ending in ":free", price $0) ----------
const OR = process.env.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1";
const OR_PREFER = [/gpt-oss-120b/i, /llama-3\.3-70b/i, /deepseek.*(v3|chat)/i, /qwen3/i, /llama-4/i, /mistral-small/i, /gemma-3-27b/i];
let orModels;
async function orCall(path, init = {}) {
  const res = await fetch(OR + path, { ...init, signal: AbortSignal.timeout(120000), headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Agent HQ" } });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = {}; }
  if (!res.ok || data.error) { const e = new Error(`OpenRouter ${res.status}: ${data.error?.message || text.slice(0, 200)}`); e.status = data.error?.code || res.status; throw e; }
  return data;
}
export async function openRouterModels() {
  if (orModels) return orModels;
  const data = await orCall("/models");
  const free = (data.data || []).filter((m) => /:free$/.test(m.id) && Number(m.pricing?.prompt || 0) === 0 && Number(m.pricing?.completion || 0) === 0 && !/vision|image|embed|guard/i.test(m.id));
  const rank = (i) => { const k = OR_PREFER.findIndex((r) => r.test(i)); return k < 0 ? 99 : k; };
  // then bigger models first (size from the name, e.g. "70b", "29b-a4b"; "super"/"large" count as big)
  const size = (i) => { const n = [...i.matchAll(/(\d+(?:\.\d+)?)b(?![a-z])/gi)].map((m) => Number(m[1])); return n.length ? Math.max(...n) : /super|large|ultra|pro/i.test(i) ? 60 : /mini|small|lite|nano/i.test(i) ? 5 : 20; };
  orModels = free.map((m) => m.id).sort((a, b) => rank(a) - rank(b) || size(b) - size(a));
  if (!orModels.length) throw new Error("OpenRouter has no free models available right now.");
  return orModels;
}
export async function openRouterChat(system, user, { json = false, temperature = 0.7, maxChars = 24000 } = {}) {
  const input = user.length > maxChars ? user.slice(0, maxChars) + "\n\n[Some input was trimmed to fit the backup AI's limits.]" : user;
  let lastErr;
  for (const model of (await openRouterModels()).slice(0, 3)) {
    if (!/:free$/.test(model)) continue; // never call a paid model
    try {
      const data = await orCall("/chat/completions", { method: "POST", body: JSON.stringify({
        model, temperature, max_tokens: 2500,
        messages: [{ role: "system", content: system + (json ? "\nReply with valid JSON only." : "") }, { role: "user", content: input }]
      }) });
      const text = (data.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      if (!text) throw new Error("OpenRouter returned an empty reply");
      console.log(`  answered by backup AI: OpenRouter ${model}`);
      return text;
    } catch (e) { lastErr = e; if (e.status === 401 || e.status === 402) break; }
  }
  throw lastErr || new Error("OpenRouter could not answer");
}

// Backup chain used by every agent: Groq, then Cloudflare, then OpenRouter (free models only).
export async function groqChat(system, user, opts = {}) {
  const chain = [["Groq", hasGroqKey, groqOnly], ["Cloudflare", hasCloudflare, cloudflareChat], ["OpenRouter", hasOpenRouter, openRouterChat]].filter(([, has]) => has());
  let lastErr;
  for (const [name, , fn] of chain) {
    try { return await fn(system, user, opts); }
    catch (e) { lastErr = e; console.log(`  ${name} failed (${e.message})${chain.at(-1)[0] === name ? "" : "; trying the next backup"}`); }
  }
  throw lastErr || new Error("No backup AI key is set");
}
