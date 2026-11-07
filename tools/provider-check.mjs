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
if (!ok) process.exit(1);

// Real end-to-end test of the backup path the agents use
if (process.env.GROQ_API_KEY) {
  const { groqChat } = await import("../ai-fallback.mjs");
  try {
    const t = await groqChat("You are a test agent.", "Return JSON: {\"status\":\"ready\",\"agents\":7}", { json: true, temperature: 0 });
    console.log(`RESULT backup path: WORKS, JSON reply ${t.replace(/\s+/g, " ").slice(0, 80)}`);
  } catch (e) { console.log(`RESULT backup path: FAILED: ${e.message}`); process.exitCode = 1; }
}
