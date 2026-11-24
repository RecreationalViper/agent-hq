import { gwFetch } from "./ai-gateway.mjs";
import { trackResponse } from "./usage-log.mjs";
import { outKey, skipIfOut, noteIfDaily } from "./ai-out.mjs";
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
export const hasGroq = () => ["POLLINATIONS_API_KEY", "MISTRAL_API_KEY", "SAMBANOVA_API_KEY", "CEREBRAS_API_KEY", "SILICONFLOW_API_KEY", "DEEPSEEK_API_KEY"].some((k) => process.env[k]?.trim()) || hasGroqKey() || hasCloudflare() || hasOpenRouter() || Boolean(process.env.NVIDIA_API_KEY?.trim()) || Boolean((process.env.REQUESTY_API_KEY || process.env.REQUESTY_KEY || "").trim());

async function call(path, init = {}) {
  const res = await gwFetch(BASE + path, { ...init, signal: AbortSignal.timeout(120000), headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" } });
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
        if (e.status === 429 && (DAILY.test(e.message) || e.retryAfter > 120)) throw e; // daily limit hit: move to the next provider now
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
  const res = await gwFetch(url, { ...init, signal: AbortSignal.timeout(120000), headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" } });
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
const OR_PREFER = [/gpt-oss-120b/i, /ernie-5\.5/i, /llama-3\.3-70b/i, /deepseek.*(v3|chat)/i, /qwen3/i, /llama-4/i, /mistral-small/i, /gemma-3-27b/i];
let orModels;
async function orCall(path, init = {}) {
  const res = await gwFetch(OR + path, { ...init, signal: AbortSignal.timeout(120000), headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Agent HQ" } });
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

// ---------- Requesty (requesty.ai router; OpenAI-compatible). FREE models only: 200 free requests/day ----------
// Secret: REQUESTY_API_KEY (REQUESTY_KEY also accepted). Paid models are never called, so free credits aren't spent.
const RQ = "https://router.requesty.ai/v1";
const rqKey = () => (process.env.REQUESTY_API_KEY || process.env.REQUESTY_KEY || "").trim();
export const hasRequesty = () => Boolean(rqKey());
const RQ_PREFER = [/nemotron.*ultra/i, /gpt-oss-120b/i, /deepseek.*(v3|chat|r1)/i, /qwen3/i, /llama-3\.3-70b/i, /llama-4/i, /gemini.*flash/i, /mistral/i, /gemma/i];
let rqModels;
async function rqCall(path, init = {}) {
  const key = outKey(RQ + path, init);
  const res = (await skipIfOut(key)) || await fetch(RQ + path, { ...init, signal: AbortSignal.timeout(120000), headers: { Authorization: `Bearer ${rqKey()}`, "Content-Type": "application/json", "HTTP-Referer": "https://foreverheld.pages.dev", "X-Title": "Agent HQ" } });
  if (!res.headers.get("x-ai-out")) { await trackResponse(RQ + path, init, res); await noteIfDaily(key, res); }
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = {}; }
  if (!res.ok || data.error) { const e = new Error(`Requesty ${res.status}: ${data.error?.message || text.slice(0, 200)}`); e.status = res.status; throw e; }
  return data;
}
// A model counts as free only if every price field it lists is 0 (or its id is marked free); unknown pricing = not free.
const priceOf = (m) => [m.pricing?.prompt, m.pricing?.completion, m.input_price, m.output_price, m.price?.input, m.price?.output, m.input_cost_per_token, m.output_cost_per_token].filter((v) => v !== undefined && v !== null && v !== "");
export const isFreeRq = (m) => { const p = priceOf(m); return (p.length > 0 && p.every((v) => Number(v) === 0)) || /(:|\/|-)free\b/i.test(m.id || ""); };
export async function requestyModels() {
  if (rqModels) return rqModels;
  const data = await rqCall("/models");
  const all = data.data || data.models || [];
  const free = all.filter((m) => isFreeRq(m) && !/vision|image|embed|guard|whisper|tts|speech|transcri|leanstral|coder|codestral/i.test(m.id));
  const rank = (i) => { const k = RQ_PREFER.findIndex((r) => r.test(i)); return k < 0 ? 99 : k; };
  const size = (i) => { const n = [...i.matchAll(/(\d+(?:\.\d+)?)b(?![a-z])/gi)].map((m) => Number(m[1])); return n.length ? Math.max(...n) : /super|large|ultra|pro/i.test(i) ? 60 : /mini|small|lite|nano/i.test(i) ? 5 : 20; };
  rqModels = free.map((m) => m.id).sort((a, b) => rank(a) - rank(b) || size(b) - size(a));
  rqModels.total = all.length;
  if (!rqModels.length) throw new Error(`Requesty lists ${all.length} models but none are marked free.`);
  return rqModels;
}
export async function requestyChat(system, user, { json = false, temperature = 0.7, maxChars = 24000 } = {}) {
  const input = user.length > maxChars ? user.slice(0, maxChars) + "\n\n[Some input was trimmed to fit the backup AI's limits.]" : user;
  let lastErr;
  for (const model of (await requestyModels()).slice(0, 3)) {
    try {
      const data = await rqCall("/chat/completions", { method: "POST", body: JSON.stringify({
        model, temperature, max_tokens: 2500,
        messages: [{ role: "system", content: system + (json ? "\nReply with valid JSON only." : "") }, { role: "user", content: input }]
      }) });
      const text = (data.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      if (!text) throw new Error("Requesty returned an empty reply");
      console.log(`  answered by backup AI: Requesty ${model}`);
      return text;
    } catch (e) { lastErr = e; if (e.status === 401 || e.status === 402 || e.status === 429) break; }
  }
  throw lastErr || new Error("Requesty could not answer");
}

// ---------- NVIDIA (build.nvidia.com hosted models, free developer access; OpenAI-compatible) ----------
const NV = "https://integrate.api.nvidia.com/v1";
const nvKey = () => process.env.NVIDIA_API_KEY?.trim();
export const hasNvidia = () => Boolean(nvKey());
// Strongest general models first; whichever the key can use is tried in order.
const NV_PREFER = [/deepseek-v3\.\d|deepseek-v3/i, /kimi-k2/i, /qwen3-235b|qwen3-coder-480b/i, /nemotron-ultra|nemotron.*253b/i, /gpt-oss-120b/i, /llama-4-maverick/i, /llama-3\.3-70b/i, /nemotron-super/i];
let nvModels;
async function nvCall(path, init = {}) {
  const res = await fetch(NV + path, { ...init, signal: AbortSignal.timeout(150000), headers: { Authorization: `Bearer ${nvKey()}`, "Content-Type": "application/json", Accept: "application/json" } });
  await trackResponse(NV + path, init, res);
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = {}; }
  if (!res.ok) { const e = new Error(`NVIDIA ${res.status}: ${data.detail || data.error?.message || data.title || text.slice(0, 200)}`); e.status = res.status; throw e; }
  return data;
}
export async function nvidiaModels() {
  if (nvModels) return nvModels;
  const ids = ((await nvCall("/models")).data || []).map((m) => m.id).filter((i) => !/embed|rerank|guard|vision|vl-|-vl|parse|clip|safety|reward|retriev|ocr|asr|tts|pii/i.test(i));
  const rank = (i) => { const k = NV_PREFER.findIndex((r) => r.test(i)); return k < 0 ? 99 : k; };
  const size = (i) => { const n = [...i.matchAll(/(\d+(?:\.\d+)?)b(?![a-z])/gi)].map((m) => Number(m[1])); return n.length ? Math.max(...n) : /ultra|super|large/i.test(i) ? 60 : 10; };
  // preferred models first, then everything else by size (some listed models aren't enabled for every account)
  // only general chat families: NVIDIA also lists science/calibration/simulation models that answer in essays, not JSON
  const chat = (i) => /llama|nemotron|qwen|deepseek|kimi|mistral|mixtral|gemma|gpt-oss|glm|minimax|phi-?4/i.test(i) && !/calibrat|ising|cosmos|physic|bio|genmol|diffus|nemoguard|content-safety|translat|riva/i.test(i);
  nvModels = ids.filter((i) => chat(i) && (size(i) >= 20 || rank(i) < 99)).sort((a, b) => rank(a) - rank(b) || size(b) - size(a));
  if (!nvModels.length) throw new Error("NVIDIA lists no suitable chat models for this key");
  return nvModels;
}
// Same lenient check ai-ask.mjs uses: JSON somewhere in the reply, small slips allowed.
function looksLikeJson(t) {
  const a = t.search(/[[{]/), b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (a < 0 || b <= a) return false;
  const x = t.slice(a, b + 1).replace(/[\u201C\u201D]/g, '"').replace(/,\s*([}\]])/g, "$1").replace(/([{,]\s*)([A-Za-z_][\w-]*)\s*:/g, '$1"$2":');
  try { JSON.parse(x); return true; } catch { return false; }
}
export async function nvidiaChat(system, user, { json = false, temperature = 0.7, maxChars = 40000 } = {}) {
  const input = user.length > maxChars ? user.slice(0, maxChars) + "\n\n[Some input was trimmed to fit the backup AI's limits.]" : user;
  let lastErr;
  for (const model of [...(await nvidiaModels())].slice(0, 8)) {
    try {
      const data = await nvCall("/chat/completions", { method: "POST", body: JSON.stringify({
        model, temperature, max_tokens: json ? 12000 : 4096, // a 5-post plan is long; 4096 cut it off mid-string
        messages: [{ role: "system", content: system + (json ? "\nReply with valid JSON only." : "") }, { role: "user", content: input }]
      }) });
      const text = (data.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      if (!text) throw new Error("NVIDIA returned an empty reply");
      if (json && !looksLikeJson(text)) { nvModels = [...nvModels.filter((m) => m !== model), model]; throw new Error(`NVIDIA ${model} did not reply in JSON`); } // next model, and this one goes last
      console.log(`  answered by backup AI: NVIDIA ${model}`);
      nvModels = [model, ...nvModels.filter((m) => m !== model)]; // stick with the one that works
      return text;
    } catch (e) { lastErr = e; if (/did not reply in JSON/.test(e.message)) console.log(`  ${e.message}, trying another model`); if (e.status === 401 || e.status === 403) break; if (e.status === 404) nvModels = nvModels.filter((m) => m !== model); }
  }
  throw lastErr || new Error("NVIDIA could not answer");
}


// ---------- Extra free providers (each runs only if its key is set; all OpenAI-compatible) ----------
// Mistral free plan, SambaNova free tier (keep no card linked), DeepSeek sign-up tokens, SiliconFlow free models,
// Cerebras (only if a key exists). Cohere's trial key is NOT used here: its terms forbid commercial use.
const EXTRA = [
  ["Mistral", "MISTRAL_API_KEY", "https://api.mistral.ai/v1", ["ministral-14b-latest", "ministral-8b-latest", "open-mistral-nemo"]],
  ["SambaNova", "SAMBANOVA_API_KEY", "https://api.sambanova.ai/v1", ["DeepSeek-V3.1", "gpt-oss-120b", "Meta-Llama-3.3-70B-Instruct"]],
  ["Cerebras", "CEREBRAS_API_KEY", "https://api.cerebras.ai/v1", ["gpt-oss-120b", "llama-3.3-70b"]],
  ["SiliconFlow", "SILICONFLOW_API_KEY", "https://api.siliconflow.com/v1", ["Qwen/Qwen3-8B", "THUDM/GLM-4-9B-0414", "THUDM/glm-4-9b-chat", "Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B", "internlm/internlm2_5-7b-chat"]],
  ["SiliconFlow-CN", "SILICONFLOW_API_KEY", "https://api.siliconflow.cn/v1", ["Qwen/Qwen3-8B", "THUDM/GLM-4-9B-0414", "THUDM/glm-4-9b-chat", "Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B", "internlm/internlm2_5-7b-chat"]],
  ["DeepSeek", "DEEPSEEK_API_KEY", "https://api.deepseek.com/v1", ["deepseek-chat"]],
  ["Pollinations", "POLLINATIONS_API_KEY", "https://gen.pollinations.ai/v1", ["openai", "mistral", "openai-fast"]]
];
function extraProvider([name, env, base, models]) {
  const has = () => Boolean(process.env[env]?.trim());
  const fn = async (system, user, { json = false, temperature = 0.7, maxChars = 24000 } = {}) => {
    const input = user.length > maxChars ? user.slice(0, maxChars) + "\n\n[Some input was trimmed to fit.]" : user;
    let lastErr;
    for (const model of models) {
      try {
        const res = await gwFetch(`${base}/chat/completions`, { method: "POST", signal: AbortSignal.timeout(120000),
          headers: { Authorization: `Bearer ${process.env[env].trim()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, temperature, max_tokens: 2500, messages: [{ role: "system", content: system }, { role: "user", content: input }], ...(json ? { response_format: { type: "json_object" } } : {}) }) });
        const text = await res.text();
        let data; try { data = JSON.parse(text); } catch { data = {}; }
        if (!res.ok) { const e = new Error(`${name} ${res.status}: ${(data.error?.message || data.message || text).toString().slice(0, 160)}`); e.status = res.status; throw e; }
        const out = (data.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        if (!out) throw new Error(`${name} returned an empty reply`);
        console.log(`  answered by backup AI: ${name} ${model}`);
        return out;
      } catch (e) { lastErr = e; if (e.status === 401) break; } // 402/403 on one model: another may still be free
    }
    throw lastErr || new Error(`${name} could not answer`);
  };
  return [name, has, fn];
}
export const extraProviders = EXTRA.map(extraProvider);

// Backup chain used by every agent: Groq, NVIDIA, Mistral, SambaNova, Cerebras, Cloudflare, Requesty, OpenRouter (free models), SiliconFlow, DeepSeek.
// A provider whose daily free allowance is used up is skipped for the rest of the run (allowances reset daily).
const usedUp = new Set();
const DAILY = /per day|daily|RPD|TPD|requests per day|tokens per day|quota|neurons|credits|insufficient/i;
export async function groqChat(system, user, opts = {}) {
  let chain = [["Groq", hasGroqKey, groqOnly], ["NVIDIA", hasNvidia, nvidiaChat], ...extraProviders.slice(0, 3), ["Cloudflare", hasCloudflare, cloudflareChat], ["Requesty", hasRequesty, requestyChat], ["OpenRouter", hasOpenRouter, openRouterChat], ...extraProviders.slice(3)].filter(([, has]) => has());
  // strong mode (Content Creator): NVIDIA's largest models before Groq's faster, smaller one
  if (opts.strong) chain = [...chain.filter(([n]) => n === "NVIDIA"), ...chain.filter(([n]) => n !== "NVIDIA")];
  // spread mode: each agent starts on a different provider (rotates daily), so every free allowance gets used
  if (Number.isInteger(opts.spread) && chain.length) { const k = opts.spread % chain.length; chain = [...chain.slice(k), ...chain.slice(0, k)]; }
  chain = chain.filter(([n]) => !usedUp.has(n)).concat(chain.filter(([n]) => usedUp.has(n))); // used-up providers go last
  let lastErr;
  for (const [name, , fn] of chain) {
    try { return await fn(system, user, opts); }
    catch (e) {
      lastErr = e;
      if (DAILY.test(e.message) || e.status === 402) usedUp.add(name); // out for today: skip it for the rest of this run
      console.log(`  ${name} failed (${e.message})${chain.at(-1)[0] === name ? "" : "; trying the next backup"}`);
    }
  }
  throw lastErr || new Error("No backup AI key is set");
}
