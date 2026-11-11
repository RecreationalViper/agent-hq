// AI usage log: counts every AI call this run makes (per provider: calls, tokens, times it hit a limit)
// and, when the run ends, appends one line per provider to the Google Doc "Agent HQ – AI Usage Log".
// The AI Usage dashboard (claude.ai artifact) reads that doc to show usage through the day.
// Lines: U|time UTC|workflow|provider|calls|tokens|limited. Lines older than 3 days are trimmed.
// Never throws: logging must not break an agent.
import { hasGoogle, docsApi } from "./gdocs.mjs";

export const USAGE_DOC = process.env.USAGE_DOC_ID || "1ByEBi-278BFpkKwugbEoRg_4yOwuYlQagMezN6N5e4k";
const tally = {};
let hooked = false, flushed = false;

const PROVIDERS = [
  [/generativelanguage\.googleapis\.com|\/google-ai-studio\//, "Gemini"],
  [/api\.groq\.com|\/groq\//, "Groq"],
  [/openrouter\.ai|\/openrouter\//, "OpenRouter"],
  [/integrate\.api\.nvidia\.com/, "NVIDIA"],
  [/api\.cloudflare\.com\/client\/v4\/accounts\/[^/]+\/ai\//, "Cloudflare"],
  [/api\.anthropic\.com/, "Claude"],
  [/api\.x\.ai/, "Grok"]
];
// Only real generation calls count (not model lists)
const GENERATES = /:generateContent|\/chat\/completions|\/ai\/run\/|\/v1\/messages/;

export function providerOf(url) {
  for (const [re, name] of PROVIDERS) if (re.test(url)) {
    if (name === "Cloudflare" && /flux|lucid|stable-diffusion|phoenix|image/i.test(url)) return "Cloudflare images";
    return name;
  }
  return null;
}

function add(provider, { calls = 0, tokens = 0, limited = 0 }) {
  const t = (tally[provider] ||= { calls: 0, tokens: 0, limited: 0 });
  t.calls += calls; t.tokens += tokens; t.limited += limited;
  if (!hooked) { hooked = true; process.on("beforeExit", () => { if (!flushed) flushUsage(); }); }
}

// Called with every AI response (see ai-gateway.mjs and the NVIDIA call). Reads a copy, never the original.
export async function trackResponse(url, init, res) {
  try {
    const provider = providerOf(url);
    if (!provider || !GENERATES.test(url) || (init?.method || "GET").toUpperCase() !== "POST") return;
    if (res.ok) {
      let tokens = 0;
      if (!/text\/event-stream/.test(res.headers.get("content-type") || "")) {
        const j = await res.clone().json().catch(() => null);
        const u = j?.usageMetadata || j?.usage || j?.result?.usage || {};
        tokens = Number(u.totalTokenCount ?? u.total_tokens ?? ((u.input_tokens || u.prompt_tokens || 0) + (u.output_tokens || u.completion_tokens || 0))) || 0;
      }
      add(provider, { calls: 1, tokens });
    } else {
      const text = await res.clone().text().catch(() => "");
      const limited = res.status === 429 || res.status === 402 || /quota|rate.?limit|credit|exhausted|too many/i.test(text);
      add(provider, { limited: limited ? 1 : 0 });
    }
  } catch {}
}

export const usageSummary = () => JSON.parse(JSON.stringify(tally));

export async function flushUsage() {
  flushed = true;
  const rows = Object.entries(tally).filter(([, t]) => t.calls || t.limited);
  if (!rows.length || !hasGoogle()) return;
  const who = (process.env.GITHUB_WORKFLOW || process.argv[1]?.split("/").pop() || "agent").replace(/\|/g, "/");
  const now = new Date().toISOString().slice(0, 16) + "Z";
  const text = rows.map(([p, t]) => `U|${now}|${who}|${p}|${t.calls}|${t.tokens}|${t.limited}`).join("\n") + "\n";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const requests = [];
      if (attempt === 0) {
        // trim lines older than 3 days (deletes run from the bottom up so indexes stay valid)
        const doc = await docsApi(`/documents/${USAGE_DOC}`);
        const cutoff = new Date(Date.now() - 3 * 86400000).toISOString();
        const old = (doc.body?.content || []).filter((el) => {
          const s = (el.paragraph?.elements || []).map((e) => e.textRun?.content || "").join("");
          return s.startsWith("U|") && s.split("|")[1] < cutoff;
        }).sort((a, b) => b.startIndex - a.startIndex);
        for (const el of old.slice(0, 400)) requests.push({ deleteContentRange: { range: { startIndex: el.startIndex, endIndex: el.endIndex } } });
      }
      requests.push({ insertText: { endOfSegmentLocation: {}, text } });
      await docsApi(`/documents/${USAGE_DOC}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
      console.log(`AI usage logged: ${rows.map(([p, t]) => `${p} ${t.calls} call(s)${t.limited ? `, ${t.limited} limit hit(s)` : ""}`).join("; ")}`);
      return;
    } catch (e) { if (attempt) console.log(`AI usage log skipped: ${e.message}`); }
  }
}
