// Checks whether AI provider keys work and have credits. Never prints a key.
const providers = {
  // grok: paused by the owner; not used by any agent
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

// Cloudflare AI Gateway: create it if missing, then send one real call through it (Groq, then Gemini, then Workers AI)
{
  const gw = await import("../ai-gateway.mjs");
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) console.log("RESULT ai-gateway: no CLOUDFLARE_ACCOUNT_ID");
  else {
    try {
      const { created, gateway } = await gw.ensureGateway();
      console.log(`RESULT ai-gateway: ${created ? "CREATED" : "exists"} "${gw.GATEWAY_ID}" (cache ${gateway?.cache_ttl}s, logs ${gateway?.collect_logs}, limit ${gateway?.rate_limiting_limit}/${gateway?.rate_limiting_interval}s)`);
      const tests = [
        ["groq", "https://api.groq.com/openai/v1/chat/completions", { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, { model: "openai/gpt-oss-120b", messages: [{ role: "user", content: "Reply: ok" }], max_tokens: 20 }],
        ["gemini", "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent", { "x-goog-api-key": process.env.GEMINI_API_KEY }, { contents: [{ role: "user", parts: [{ text: "Reply: ok" }] }] }],
      ];
      for (const [name, url, h, body] of tests) {
        if (!Object.values(h)[0]) { console.log(`RESULT ai-gateway ${name}: skipped (no key in this workflow)`); continue; }
        const via = gw.gatewayUrl(url);
        const r = await fetch(via, { method: "POST", headers: gw.withGatewayAuth({ ...h, "Content-Type": "application/json" }), body: JSON.stringify(body) });
        const t = await r.text();
        console.log(`RESULT ai-gateway ${name}: HTTP ${r.status}${r.ok ? " WORKS via gateway" : ": " + t.slice(0, 160)}`);
      }
    } catch (e) { console.log(`RESULT ai-gateway: FAILED: ${e.message}`); }
  }
}

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

// OpenRouter check (free models only)
if (process.env.OPENROUTER_API_KEY) {
  const { openRouterModels, openRouterChat } = await import("../ai-fallback.mjs");
  try {
    const ms = await openRouterModels();
    console.log(`openrouter: ${ms.length} free models, top picks: ${ms.slice(0, 4).join(", ")}`);
    const t = await openRouterChat("You are a test agent.", "Return JSON: {\"status\":\"ready\"}", { json: true, temperature: 0 });
    console.log(`RESULT openrouter: WORKS (free model), reply ${t.replace(/\s+/g, " ").replace(/[{}]/g, "").slice(0, 60)}`);
  } catch (e) { console.log(`RESULT openrouter: FAILED: ${e.message}`); process.exitCode = 1; }
} else console.log("RESULT openrouter: no key found (secret OPENROUTER_API_KEY missing or empty)");

// Payhip API key check (read-only: lists coupons)
if (process.env.PAYHIP_API_KEY) {
  try {
    const r = await fetch("https://payhip.com/api/v2/coupons", { headers: { "payhip-api-key": process.env.PAYHIP_API_KEY.trim() } });
    const j = await r.json().catch(() => ({}));
    console.log(r.ok ? `RESULT payhip: WORKS. ${(Array.isArray(j.data) ? j.data : j.data?.data || []).length} coupon(s) on the store` : `RESULT payhip: FAILED (HTTP ${r.status}): ${j.message || j.error || "rejected"}`);
    if (!r.ok) process.exitCode = 1;
  } catch (e) { console.log(`RESULT payhip: FAILED: ${e.message}`); process.exitCode = 1; }
} else console.log("RESULT payhip: no key found (secret PAYHIP_API_KEY missing or empty)");

// Sales feed check (Cloudflare Worker): is it up, does it reject fakes, can agents read it?
try {
  const feed = JSON.parse(await (await import("node:fs/promises")).readFile("sales-feed.json", "utf8"));
  const home = await fetch(feed.url + "/");
  const fake = await fetch(feed.webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "paid", signature: "fake" }) });
  const { salesSummary } = await import("../sales.mjs");
  const s = await salesSummary();
  console.log(`RESULT sales feed: ${home.ok ? "UP" : `DOWN (HTTP ${home.status})`}; fake sale rejected: ${fake.status === 401}; agents can read it: ${s ? `yes (${s.total} sale event(s))` : "no"}`);
} catch (e) { console.log(`RESULT sales feed: FAILED: ${e.message}`); process.exitCode = 1; }

// Website check (GitHub Pages)
for (const u of ["https://recreationalviper.github.io/agent-hq/", "https://recreationalviper.github.io/agent-hq/store/", "https://recreationalviper.github.io/agent-hq/store/img/program-cover.png"]) {
  try { const r = await fetch(u, { redirect: "follow" }); console.log(`RESULT site: ${r.status} ${u}`); } catch (e) { console.log(`RESULT site: FAILED ${u}: ${e.message}`); }
}

// Exa (AI web search) check: which secret names hold keys, and does each work (1 tiny search)
{
  const found = Object.keys(process.env).filter((k) => /^EXA/.test(k) && process.env[k]?.trim());
  if (!found.length) console.log("RESULT exa: no key found");
  for (const k of found) {
    try {
      const r = await fetch("https://api.exa.ai/search", { method: "POST", headers: { "x-api-key": process.env[k].trim(), "content-type": "application/json" }, body: JSON.stringify({ query: "funeral program template", numResults: 1, type: "auto" }) });
      const j = await r.json().catch(() => ({}));
      console.log(r.ok ? `RESULT exa (${k}): WORKS. Top result: ${j.results?.[0]?.title || "(none)"}${j.costDollars?.total != null ? ` · cost $${j.costDollars.total}` : ""}` : `RESULT exa (${k}): FAILED (HTTP ${r.status}): ${j.error || j.message || "rejected"}`);
    } catch (e) { console.log(`RESULT exa (${k}): FAILED: ${e.message}`); }
  }
}

// Magic Hour (AI images/video) check: which secret name holds the key, and the credit balance (free call, no generation)
{
  const found = Object.keys(process.env).filter((k) => /^(MAGIC|MH_|ART_API)/.test(k) && process.env[k]?.trim());
  if (!found.length) console.log("RESULT magichour: no key found");
  for (const k of found) {
    try {
      const r = await fetch("https://api.magichour.ai/v1/account", { headers: { Authorization: `Bearer ${process.env[k].trim()}` } });
      const j = await r.json().catch(() => ({}));
      const safe = Object.fromEntries(Object.entries(j).filter(([key]) => !/email|name|id$/i.test(key)));
      console.log(r.ok ? `RESULT magichour (${k}): WORKS. ${JSON.stringify(safe).slice(0, 300)}` : `RESULT magichour (${k}): FAILED (HTTP ${r.status}): ${j.message || "rejected"}`);
    } catch (e) { console.log(`RESULT magichour (${k}): FAILED: ${e.message}`); }
  }
}

// NVIDIA (backup AI) check: lists models, then one tiny chat
{
  const { hasNvidia, nvidiaModels, nvidiaChat } = await import("../ai-fallback.mjs");
  if (!hasNvidia()) console.log("RESULT nvidia: no key found (secret NVIDIA_API_KEY)");
  else {
    try {
      const ms = await nvidiaModels();
      console.log(`RESULT nvidia models (${ms.length}, first 10): ${ms.slice(0, 10).join(", ")}`);
      const t = await nvidiaChat("You are a test.", "Reply with exactly: OK");
      console.log(`RESULT nvidia: WORKS (reply "${t.slice(0, 20)}")`);
    } catch (e) { console.log(`RESULT nvidia: FAILED: ${e.message.slice(0, 200)}`); }
  }
}

// Apify (SEO research) check: account + free credit left
if (process.env.APIFY_TOKEN) {
  try {
    const H = { Authorization: `Bearer ${process.env.APIFY_TOKEN.trim()}` };
    const me = await (await fetch("https://api.apify.com/v2/users/me", { headers: H })).json();
    const lim = await (await fetch("https://api.apify.com/v2/users/me/limits", { headers: H })).json().catch(() => ({}));
    if (!me.data) throw new Error(me.error?.message || "token rejected");
    const used = lim.data?.current?.monthlyUsageUsd, max = lim.data?.limits?.maxMonthlyUsageUsd;
    console.log(`RESULT apify: WORKS. Plan: ${me.data.plan?.id || "?"}; used this month: $${used ?? "?"} of $${max ?? "?"}`);
  } catch (e) { console.log(`RESULT apify: FAILED: ${e.message}`); process.exitCode = 1; }
} else console.log("RESULT apify: no key found (secret APIFY_TOKEN missing or empty)");
