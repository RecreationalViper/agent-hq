// Backup AI provider: Groq (free tier, OpenAI-compatible). Used only when Gemini is
// busy or out of its free daily quota. Needs the GROQ_API_KEY secret.
// Free-tier limits seen on this key: 1,000 requests/day and 8,000 tokens/minute,
// so long prompts are trimmed to fit.
const BASE = process.env.GROQ_API_BASE || "https://api.groq.com/openai/v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SKIP = /guard|whisper|orpheus|tts|allam|compound|playai|embed|vision/i;
const PREFER = [/gpt-oss-120b/i, /qwen3/i, /llama-3\.3-70b|llama-4/i, /gpt-oss-20b/i, /llama/i];
let models;

export const hasGroq = () => Boolean(process.env.GROQ_API_KEY);

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
export async function groqChat(system, user, { json = false, temperature = 0.7, maxChars = 16000 } = {}) {
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
