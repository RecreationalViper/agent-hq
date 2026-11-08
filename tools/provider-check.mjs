// Checks whether AI provider keys work and have credits. Never prints a key.
const providers = {
  grok: { key: process.env.GROK_API_KEY, base: "https://api.x.ai/v1", secret: "GROK_API_KEY" },
  groq: { key: process.env.GROQ_API_KEY, base: "https://api.groq.com/openai/v1", secret: "GROQ_API_KEY" }
};
let ok = true;
for (const [name, p] of Object.entries(providers)) {
  if (!p.key) { console.log(`RESULT ${name}: no key found (secret ${p.secret} missing or empty)`); continue; }
  const H = { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" };
  const show = async (r) => { const t = await r.text(); try { const j = JSON.parse(t); return j.error?.message || j.error || t.slice(0, 300); } catch { return t.slice(0, 300); } };
  const m = await fetch(`${p.base}/models`, { headers: H });
  if (!m.ok) { console.log(`RESULT ${name}: key rejected (HTTP ${m.status}): ${await show(m)}`); ok = false; continue; }
  const ids = ((await m.json()).data || []).map((x) => x.id);
  console.log(`${name}: key accepted. ${ids.length} models: ${ids.join(", ")}`);
  const chat = ids.filter((i) => !/image|vision|imagine|whisper|tts|guard|embed|audio|playai|orpheus|compound/i.test(i));
  const pick = chat.find((i) => /gpt-oss-120b|llama-3\.3-70b/i.test(i)) || chat.find((i) => /mini|fast|instant/i.test(i)) || chat[0];
  const c = await fetch(`${p.base}/chat/completions`, { method: "POST", headers: H, body: JSON.stringify({ model: pick, messages: [{ role: "user", content: "Reply with the single word: ready" }], max_tokens: 20 }) });
  if (!c.ok) { console.log(`RESULT ${name}: model ${pick} refused (HTTP ${c.status}): ${await show(c)}`); ok = false; continue; }
  const j = await c.json();
  const lim = ["x-ratelimit-limit-requests", "x-ratelimit-limit-tokens"].map((h) => `${h.replace("x-ratelimit-limit-", "")}/limit: ${c.headers.get(h)}`).join(", ");
  console.log(`RESULT ${name}: WORKS. ${pick} replied "${(j.choices?.[0]?.message?.content || "").trim()}" (${lim})`);
}
if (!ok) process.exitCode = 1;

// Real end-to-end test of the backup path the agents use
if (process.env.GROQ_API_KEY) {
  const { groqChat } = await import("../ai-fallback.mjs");
  try {
    const t = await groqChat("You are a test agent.", "Return JSON: {\"status\":\"ready\",\"agents\":7}", { json: true, temperature: 0 });
    console.log(`RESULT backup path: WORKS, JSON reply ${t.replace(/\s+/g, " ").slice(0, 80)}`);
  } catch (e) { console.log(`RESULT backup path: FAILED: ${e.message}`); process.exitCode = 1; }
}

// FRED (economic data) key check: no AI involved
if (process.env.FRED_API_KEY) {
  const { macroSnapshot } = await import("../fred.mjs");
  try {
    const m = await macroSnapshot();
    console.log(`RESULT fred: WORKS. ${m.lines.length} indicators, e.g. ${m.lines[0]}; next releases: ${m.calendar.slice(0, 3).join("; ") || "none in 10 days"}${m.notes.length ? ` (missing: ${m.notes.join("; ")})` : ""}`);
  } catch (e) { console.log(`RESULT fred: FAILED: ${e.message}`); process.exitCode = 1; }
} else console.log("RESULT fred: no key found (secret FRED_API_KEY missing or empty)");

// Google Docs robot check (read-only)
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  const { checkAccess } = await import("../gdocs.mjs");
  try { const r = await checkAccess("1qmAfGc3pvlMfBz7krioe4HydpaH6I09n8TRwXvB6nv8"); console.log(`RESULT google: WORKS. ${r.robot} can open "${r.title}"`); }
  catch (e) { console.log(`RESULT google: FAILED: ${e.message}`); process.exitCode = 1; }
} else console.log("RESULT google: no key found (secret GOOGLE_SERVICE_ACCOUNT_JSON missing or empty)");

// Cloudflare Workers AI check
if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
  const { cloudflareModels, cloudflareChat } = await import("../ai-fallback.mjs");
  try {
    const ms = await cloudflareModels();
    console.log(`cloudflare: ${ms.length} text models, top picks: ${ms.slice(0, 4).join(", ")}`);
    const t = await cloudflareChat("You are a test agent.", "Return JSON: {\"status\":\"ready\"}", { json: true, temperature: 0 });
    console.log(`RESULT cloudflare: WORKS, reply ${t.replace(/\s+/g, " ").slice(0, 80)}`);
  } catch (e) {
    console.log(`RESULT cloudflare: FAILED: ${e.message}`); process.exitCode = 1;
    // Diagnose without printing secrets
    const t = process.env.CLOUDFLARE_API_TOKEN.trim(), acct = process.env.CLOUDFLARE_ACCOUNT_ID.trim();
    console.log(`cloudflare diag: token length ${t.length}, has spaces ${/\s/.test(t)}; account id length ${acct.length}, looks like 32 hex ${/^[0-9a-f]{32}$/i.test(acct)}`);
    const H = { Authorization: `Bearer ${t}` };
    for (const [label, url] of [["user token", "https://api.cloudflare.com/client/v4/user/tokens/verify"], ["account token", `https://api.cloudflare.com/client/v4/accounts/${acct}/tokens/verify`]]) {
      const r = await fetch(url, { headers: H }); const j = await r.json().catch(() => ({}));
      console.log(`cloudflare diag: verify as ${label}: HTTP ${r.status} ${j.result?.status || ""} ${j.errors?.[0]?.message || ""}`);
    }
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/@cf/meta/llama-3.1-8b-instruct`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "Say ready" }) });
    const j = await r.json().catch(() => ({}));
    console.log(`cloudflare diag: direct model run: HTTP ${r.status} ${j.errors?.[0]?.message || (j.result?.response ? "ok" : "")}`);
  }
} else console.log(`RESULT cloudflare: missing ${!process.env.CLOUDFLARE_API_TOKEN ? "CLOUDFLARE_API_TOKEN " : ""}${!process.env.CLOUDFLARE_ACCOUNT_ID ? "CLOUDFLARE_ACCOUNT_ID" : ""}`);
