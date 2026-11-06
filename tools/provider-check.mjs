// Checks whether an AI provider key works and has credits. Never prints the key.
const key = process.env.GROK_API_KEY;
if (!key) { console.log("RESULT: GROK_API_KEY secret is missing or empty."); process.exit(1); }
const H = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const show = async (r) => { const t = await r.text(); try { const j = JSON.parse(t); return j.error?.message || j.error || j.code || t.slice(0, 300); } catch { return t.slice(0, 300); } };
const m = await fetch("https://api.x.ai/v1/models", { headers: H });
if (!m.ok) { console.log(`RESULT: key rejected (HTTP ${m.status}): ${await show(m)}`); process.exit(1); }
const ids = ((await m.json()).data || []).map((x) => x.id);
console.log(`Key accepted. ${ids.length} models: ${ids.join(", ")}`);
const pick = ids.find((i) => /mini|fast/i.test(i) && !/image|vision|imagine/i.test(i)) || ids.find((i) => !/image|vision|imagine/i.test(i));
const c = await fetch("https://api.x.ai/v1/chat/completions", { method: "POST", headers: H, body: JSON.stringify({ model: pick, messages: [{ role: "user", content: "Reply with the single word: ready" }], max_tokens: 5 }) });
if (!c.ok) { console.log(`RESULT: model ${pick} refused (HTTP ${c.status}): ${await show(c)}`); process.exit(1); }
const j = await c.json();
console.log(`RESULT: WORKS. ${pick} replied "${j.choices?.[0]?.message?.content?.trim()}" (used ${j.usage?.total_tokens} tokens)`);
