// Shared AI helper: free Gemini first, Groq as automatic backup.
// strong: true -> Claude first (capped monthly budget, see claude-ai.mjs), then Gemini Pro and the rest.
// ask(system, prompt, { json }) -> text (or parsed JSON when json: true)
import { gwFetch } from "./ai-gateway.mjs";
import { hasGroq, groqChat } from "./ai-fallback.mjs";
import { hasClaude, claudeChat } from "./claude-ai.mjs";

const BASE = process.env.API_BASE || "https://generativelanguage.googleapis.com/v1beta";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let models = null, strongModels = null, geminiOut = false;

async function gemini(path, init = {}) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res;
    try { res = await gwFetch(BASE + path, { ...init, signal: AbortSignal.timeout(120000), headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY } }); }
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

async function pickModels(strong = false) {
  const ver = (n) => { const m = n.match(/gemini-(\d+(?:\.\d+)?)/i); return m ? parseFloat(m[1]) : 0; };
  // Normal: fast "flash" models first. strong: the most capable "pro" models first, flash as backup.
  const rank = (n) => (strong ? (/pro/i.test(n) ? 0 : /flash/i.test(n) && !/lite/i.test(n) ? 2 : 4) : (/flash/i.test(n) ? 0 : 2)) + (/lite|preview|exp/i.test(n) ? 1 : 0);
  const { models: list = [] } = await gemini("/models?pageSize=200");
  return list.filter((m) => (m.supportedGenerationMethods || []).includes("generateContent") && /gemini/i.test(m.name) && !/image|tts|audio|live|embed/i.test(m.name))
    .map((m) => m.name).sort((a, b) => rank(a) - rank(b) || ver(b) - ver(a));
}

const parse = (text, json) => json ? JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) : text;

export async function ask(system, prompt, { json = false, temperature = 0.4, strong = false, who = "agent" } = {}) {
  let lastErr;
  if (strong && hasClaude()) {
    try { return parse(await claudeChat(system, prompt, { json, temperature, who }), json); }
    catch (e) { lastErr = e; }
  }
  if (!geminiOut && process.env.GEMINI_API_KEY) {
    let list;
    try { list = strong ? (strongModels ||= await pickModels(true)) : (models ||= await pickModels()); } catch (e) { lastErr = e; geminiOut = true; list = []; }
    const save = (l) => { if (strong) strongModels = l; else models = l; list = l; };
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature, ...(json ? { responseMimeType: "application/json" } : {}) }
    });
    for (let i = 0; i < list.length && i < 6; ) {
      const m = list[i];
      try {
        const data = await gemini(`/${m}:generateContent`, { method: "POST", body });
        const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
        if (!text) throw new Error("BUSY: empty reply");
        const out = parse(text, json);
        save([m, ...list.filter((x) => x !== m)]);
        if (strong) console.log(`  written by ${m.replace("models/", "")}`);
        return out;
      } catch (e) {
        lastErr = e;
        if (/no longer|retired|not found|not supported|deprecated/i.test(e.message)) { save(list.filter((x) => x !== m)); continue; }
        // Strong mode: a "pro" model's free limit is separate, so drop just the pro models and carry on with flash.
        if (/quota/i.test(e.message) && strong && /pro/i.test(m)) { console.log(`  ${m.replace("models/", "")} free limit used up, using the next best model`); save(list.filter((x) => !/pro/i.test(x))); continue; }
        if (/quota/i.test(e.message)) { geminiOut = true; console.log("  Gemini's free daily limit is used up; using the backup AI"); break; }
        if (/BUSY|JSON|Unexpected/i.test(e.message)) { i++; continue; }
        throw e;
      }
    }
  }
  if (hasGroq()) return parse(await groqChat(system, prompt, { json, temperature, strong }), json);
  throw lastErr || new Error("No AI available");
}
