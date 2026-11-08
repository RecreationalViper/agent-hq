// Shared AI helper: free Gemini first, Groq as automatic backup.
// ask(system, prompt, { json }) -> text (or parsed JSON when json: true)
import { hasGroq, groqChat } from "./ai-fallback.mjs";

const BASE = process.env.API_BASE || "https://generativelanguage.googleapis.com/v1beta";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let models = null, geminiOut = false;

async function gemini(path, init = {}) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res;
    try { res = await fetch(BASE + path, { ...init, signal: AbortSignal.timeout(120000), headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY } }); }
    catch { if (attempt < 2) continue; throw new Error("BUSY: no answer"); }
    const data = await res.json().catch(() => ({}));
    if (res.status === 429 || res.status === 503) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      if (attempt < 2 && !/quota/i.test(msg)) { await sleep(20000); continue; }
      throw new Error("BUSY: " + msg);
    }
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return data;
  }
}

async function pickModels() {
  const ver = (n) => { const m = n.match(/gemini-(\d+(?:\.\d+)?)/i); return m ? parseFloat(m[1]) : 0; };
  const rank = (n) => (/flash/i.test(n) ? 0 : 2) + (/lite|preview|exp/i.test(n) ? 1 : 0);
  const { models: list = [] } = await gemini("/models?pageSize=200");
  return list.filter((m) => (m.supportedGenerationMethods || []).includes("generateContent") && /gemini/i.test(m.name) && !/image|tts|audio|live|embed/i.test(m.name))
    .map((m) => m.name).sort((a, b) => rank(a) - rank(b) || ver(b) - ver(a));
}

const parse = (text, json) => json ? JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) : text;

export async function ask(system, prompt, { json = false, temperature = 0.4 } = {}) {
  let lastErr;
  if (!geminiOut && process.env.GEMINI_API_KEY) {
    try { models ||= await pickModels(); } catch (e) { lastErr = e; geminiOut = true; }
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature, ...(json ? { responseMimeType: "application/json" } : {}) }
    });
    for (const m of (models || []).slice(0, 5)) {
      try {
        const data = await gemini(`/${m}:generateContent`, { method: "POST", body });
        const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
        if (!text) throw new Error("BUSY: empty reply");
        models = [m, ...models.filter((x) => x !== m)];
        return parse(text, json);
      } catch (e) {
        lastErr = e;
        if (/no longer|retired|not found|not supported|deprecated/i.test(e.message)) { models = models.filter((x) => x !== m); continue; }
        if (/quota/i.test(e.message)) { geminiOut = true; console.log("  Gemini's free daily limit is used up; using the backup AI"); break; }
        if (/BUSY|JSON|Unexpected/i.test(e.message)) continue;
        throw e;
      }
    }
  }
  if (hasGroq()) return parse(await groqChat(system, prompt, { json, temperature }), json);
  throw lastErr || new Error("No AI available");
}
