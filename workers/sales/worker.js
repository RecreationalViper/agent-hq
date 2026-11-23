// Forever Held sales feed (Cloudflare Worker, free plan).
// Payhip -> POST here on every sale/refund. We verify it really came from Payhip,
// keep only what the agents need (no buyer emails or names), and let Agent HQ read it.
//   POST /payhip         Payhip webhook (paid, refunded)
//   GET  /sales?days=30  recent sales for the agents (needs header x-read-token)
//   POST /discord        Discord slash commands (/status, /sales, /ask, /run), owner/admins only
//   POST /contact        storefront contact form -> KV (12 months) + Discord #sales (customer care)
//   POST /chat           website assistant: answers shoppers from the site's own knowledge (store/search.json) + free AI keys
//   GET  /canva/connect?key=...   owner-only: one-time "Connect Canva" sign-in (OAuth with PKCE)
//   GET  /canva/callback          Canva sends the owner back here; tokens are kept in KV, never shown
//   POST /canva/token             agents get a fresh Canva access token (needs header x-read-token)
const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/payhip") {
      let e;
      try { e = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }
      if (!e.signature || e.signature !== (await sha256(env.PAYHIP_API_KEY))) return json({ ok: false, error: "bad signature" }, 401);
      if (!["paid", "refunded"].includes(e.type)) return json({ ok: true, ignored: e.type });
      const record = {
        type: e.type,
        id: String(e.id || e.transaction_id || crypto.randomUUID()),
        date: e.date ? new Date(Number(e.date) * 1000 || e.date).toISOString() : new Date().toISOString(),
        currency: e.currency || "USD",
        amount: Number(e.price || 0) / 100,
        refunded: e.type === "refunded" ? Number(e.amount_refunded || e.price || 0) / 100 : 0,
        fees: (Number(e.payhip_fee || 0) + Number(e.stripe_fee || 0)) / 100,
        payment: e.payment_type || "",
        items: (e.items || []).map((i) => ({ product: i.product_name || i.product_key || "item", price: Number(i.price || 0) / 100, quantity: Number(i.quantity || 1) })),
        coupon: (e.items || []).map((i) => i.used_coupon || i.coupon_code).filter(Boolean)[0] || null
      };
      await env.SALES.put(`${record.type}:${record.date}:${record.id}`, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 400 });
      await fridayNotify(env, record.type === "paid" ? "🕊️ New sale!" : "↩️ Refund", `${record.items.map((i) => i.product).join(", ") || "An item"}: $${(record.type === "paid" ? record.amount : record.refunded).toFixed(2)}`, record.type === "paid" ? "high" : "default").catch(() => {});
      if (env.DISCORD_BOT_TOKEN && env.DISCORD_SALES_CHANNEL) {
        const what = record.items.map((i) => i.product).join(", ") || "an item";
        const content = record.type === "paid"
          ? `🕊️ **New Forever Held sale:** ${what} for ${record.currency} ${record.amount.toFixed(2)}${record.coupon ? ` (code ${record.coupon})` : ""}`
          : `↩️ **Refund:** ${what}, ${record.currency} ${record.refunded.toFixed(2)}`;
        await fetch(`https://discord.com/api/v10/channels/${env.DISCORD_SALES_CHANNEL}/messages`, { method: "POST", headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ content }) }).catch(() => {});
      }
      return json({ ok: true });
    }
    if (req.method === "GET" && url.pathname === "/sales") {
      if (!env.READ_TOKEN || req.headers.get("x-read-token") !== env.READ_TOKEN) return json({ ok: false, error: "unauthorized" }, 401);
      const days = Math.min(400, Number(url.searchParams.get("days") || 30));
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const out = [];
      for (const type of ["paid", "refunded"]) {
        let cursor;
        do {
          const page = await env.SALES.list({ prefix: `${type}:`, cursor });
          for (const k of page.keys) if (k.name.slice(type.length + 1) >= since) { const v = await env.SALES.get(k.name); if (v) out.push(JSON.parse(v)); }
          cursor = page.list_complete ? null : page.cursor;
        } while (cursor);
      }
      return json({ ok: true, days, sales: out.sort((a, b) => a.date.localeCompare(b.date)) });
    }
    if (req.method === "POST" && url.pathname === "/discord") return discord(req, env, ctx);
    if (url.pathname.startsWith("/canva/")) return canva(req, url, env);
    if (url.pathname === "/contact") return contact(req, env);
    if (url.pathname === "/chat") return chat(req, env, ctx);
    if (url.pathname === "/friday/connect" || url.pathname === "/friday/google/callback") return fridayGoogleRoute(req, url, env);
    if (url.pathname === "/friday/connections") return fridayConnections(req, env);
    if (url.pathname === "/friday/spend") return fridaySpend(req, env);
    if (url.pathname === "/friday/mechanic") return fridayMechanic(req, env);
    if (url.pathname === "/friday/briefing") return fridayBriefing(req, env);
    if (url.pathname.startsWith("/friday/plaid")) return fridayPlaid(req, env, url);
    if (url.pathname === "/friday/directives" || url.pathname === "/friday/notify") return fridayAgentBridge(req, env, url);
    if (url.pathname === "/friday") return friday(req, env, ctx);
    if (url.pathname === "/friday/live" || url.pathname === "/friday/tool") return fridayLive(req, env, url.pathname.endsWith("tool"));
    if (url.pathname === "/contacts") return contactsInbox(req, url, env);
    if (url.pathname === "/unsubscribe") return unsubscribe(req, url, env);
    if (url.pathname === "/privacy") return new Response(PRIVACY, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (url.pathname === "/") return new Response("Forever Held sales feed is running.");
    return json({ ok: false, error: "not found" }, 404);
  }
};

// Privacy policy (same as store/privacy.html), served here so its address carries the Forever Held name.
const PRIVACY = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy · Forever Held</title>
<style>body{margin:0;background:#f7f3ec;color:#3f3b37;font:17px/1.6 Georgia,serif}main{max-width:680px;margin:0 auto;padding:48px 20px}h1,h2{color:#3d4a36;font-weight:400}h1{font-size:34px}h2{font-size:21px;margin-top:32px}a{color:#3d4a36}</style></head>
<body><main>
<h1>Privacy Policy</h1>
<p>Last updated: November 9, 2026</p>
<p>Forever Held sells editable printable products through Payhip and shares ideas on Pinterest. This policy covers this website and the Forever Held Pinterest app, an internal tool we use to manage our own Pinterest account.</p>
<h2>What we collect</h2>
<p>This website does not use cookies, analytics or ad trackers, and it does not ask for personal information. Purchases happen on Payhip, which handles payment and your order details under <a href="https://payhip.com/privacy">Payhip's privacy policy</a>.</p>
<h2>Our Pinterest app</h2>
<p>The Forever Held Pinterest app connects only to the Forever Held Pinterest account. It creates and organizes our own Pins and boards and reads our own Pin statistics so we can see which ideas help people. It does not access, collect or store data about other Pinterest users. Access tokens are stored securely and never shared.</p>
<h2>Sharing</h2>
<p>We do not sell or share personal information.</p>
<h2>Contact</h2>
<p>Questions? Message us through the <a href="https://payhip.com/ForeverHeld">Forever Held store on Payhip</a>.</p>
</main></body></html>
`;

// ---------------- Discord slash commands ----------------
const REPO = "RecreationalViper/agent-hq";
const RAW = `https://raw.githubusercontent.com/${REPO}/main`;
const hex = (h) => new Uint8Array(h.match(/../g).map((b) => parseInt(b, 16)));
const reply = (content, flags = 0) => json({ type: 4, data: { content: content.slice(0, 1990), flags } });

async function verified(req, env, body) {
  const sig = req.headers.get("x-signature-ed25519"), ts = req.headers.get("x-signature-timestamp");
  if (!sig || !ts || !env.DISCORD_PUBLIC_KEY) return false;
  try {
    const key = await crypto.subtle.importKey("raw", hex(env.DISCORD_PUBLIC_KEY), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, hex(sig), new TextEncoder().encode(ts + body));
  } catch { return false; }
}

async function followUp(env, token, content) {
  await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${token}/messages/@original`, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: content.slice(0, 1990) })
  }).catch(() => {});
}

async function salesSummary(env) {
  const now = Date.now(), rows = [];
  for (const type of ["paid", "refunded"]) {
    let cursor;
    do {
      const page = await env.SALES.list({ prefix: `${type}:`, cursor });
      for (const k of page.keys) { const v = await env.SALES.get(k.name); if (v) rows.push(JSON.parse(v)); }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
  }
  const sum = (days) => {
    const r = rows.filter((x) => now - Date.parse(x.date) <= days * 864e5);
    const paid = r.filter((x) => x.type === "paid");
    const gross = paid.reduce((a, x) => a + x.amount, 0), fees = paid.reduce((a, x) => a + x.fees, 0), refunds = r.reduce((a, x) => a + x.refunded, 0);
    return `**${days} days:** ${paid.length} sale${paid.length === 1 ? "" : "s"}, $${gross.toFixed(2)} gross, $${(gross - fees - refunds).toFixed(2)} after fees${refunds ? ` and $${refunds.toFixed(2)} refunds` : ""}`;
  };
  const last = rows.filter((x) => x.type === "paid").sort((a, b) => b.date.localeCompare(a.date))[0];
  return `💰 **Forever Held sales**\n${sum(1)}\n${sum(7)}\n${sum(30)}${last ? `\nLast sale: ${last.items.map((i) => i.product).join(", ")} on ${last.date.slice(0, 10)}` : "\nNo sales recorded yet."}`;
}

async function teamIndex() {
  const r = await fetch(`${RAW}/reports/index.json`, { cf: { cacheTtl: 120 } });
  return r.ok ? r.json() : [];
}

async function status() {
  const index = await teamIndex(), seen = new Map();
  for (const r of index) if (!seen.has(r.agent)) seen.set(r.agent, r);
  const lines = [...seen.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 18).map((r) => `• **${r.name}**: last report ${r.date}`);
  return `📋 **Agent HQ status**\n${lines.join("\n")}\nFull reports: https://recreationalviper.github.io/agent-hq/`;
}

async function ask(env, question) {
  const index = await teamIndex(), seen = new Set(), picks = [];
  for (const r of index) if (!seen.has(r.agent) && picks.length < 7) { seen.add(r.agent); picks.push(r); }
  let context = "";
  for (const r of picks) {
    const t = await fetch(`${RAW}/reports/${encodeURIComponent(r.file)}`).then((x) => (x.ok ? x.text() : "")).catch(() => "");
    context += `\n\n### ${r.name} (${r.date})\n${t.slice(0, 2500)}`;
  }
  const sales = await salesSummary(env).catch(() => "");
  const out = await env.AI.run("@cf/openai/gpt-oss-120b", {
    instructions: "You are the Agent HQ team lead for Forever Held (editable printable memorial kits sold on Payhip as fill-in PDFs typed in the free Adobe Acrobat Reader app; never Canva). Answer the owner's question in under 1500 characters, plainly and concretely, using the team's latest reports and sales below. Say which agent's report a point comes from. If the reports don't cover it, say so.",
    input: `Question: ${question}\n\n## Sales\n${sales}\n\n## Latest team reports${context}`
  });
  const text = typeof out === "string" ? out : out?.output_text || out?.response || (out?.output || []).flatMap((o) => o.content || []).map((c) => c.text || "").join("") || "";
  return `💬 **${question.slice(0, 150)}**\n${text.trim() || "The team AI didn't answer; try again in a minute."}`;
}

// /run choices -> GitHub workflow + inputs
const RUNS = {
  "content-creator": ["content-creator.yml", {}], "landing": ["content-creator.yml", { make: "landing" }], "film": ["make-film.yml", { format: "film" }], "pin-video": ["make-film.yml", { format: "pin" }],
  "research": ["research.yml", {}], "provider-check": ["provider-check.yml", {}], "trading-desk": ["trading-desk.yml", { action: "run" }],
  "head-trader-review": ["trading-desk.yml", { action: "review" }], "all-due": ["agent-hq.yml", { agent: "due" }]
};
async function run(env, choice) {
  if (!env.GH_TOKEN) return "⚙️ /run needs a GitHub key first. Ask Claude to walk you through adding GH_DISPATCH_TOKEN.";
  const [wf, inputs] = RUNS[choice] || ["agent-hq.yml", { agent: choice }];
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${wf}/dispatches`, {
    method: "POST", headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "AgentHQ-Discord", "content-type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs })
  });
  return r.status === 204 ? `🚀 Started **${choice}**. Its report will post in its channel when done (usually 2-10 minutes).` : `❌ Couldn't start ${choice} (GitHub ${r.status}: ${(await r.text()).slice(0, 150)})`;
}

// Customer Care buttons: custom_id "care:send|discard:<account>:<draftId>" -> Customer Care Send workflow.
async function button(env, i, admin) {
  if (!admin) return reply("Only the owner can approve replies.", 64);
  const m = String(i.data?.custom_id || "").match(/^care:(send|discard):(SHOP|[1-5]):([\w-]+)$/);
  if (!m) return reply("Unknown button.", 64);
  if (!env.GH_TOKEN) return reply("⚙️ Buttons need GH_DISPATCH_TOKEN first.", 64);
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/care-send.yml/dispatches`, {
    method: "POST", headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "AgentHQ-Discord", "content-type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs: { action: m[1], account: m[2], draft: m[3] } })
  });
  if (r.status !== 204) return reply(`❌ Couldn't start that (GitHub ${r.status}). The draft is still in Gmail.`, 64);
  const embed = { ...(i.message?.embeds?.[0] || {}), footer: { text: m[1] === "send" ? "📤 Sending… a ✅ confirmation follows in about a minute." : "🗑️ Discarding the draft…" } };
  return json({ type: 7, data: { embeds: [embed], components: [] } }); // update the message: buttons removed
}

async function discord(req, env, ctx) {
  const body = await req.text();
  if (!(await verified(req, env, body))) return new Response("bad signature", { status: 401 });
  const i = JSON.parse(body);
  if (i.type === 1) return json({ type: 1 }); // PING
  const admin = (BigInt(i.member?.permissions || "0") & 8n) === 8n;
  if (i.type === 3) return button(env, i, admin); // Send / Discard buttons
  if (i.type !== 2) return json({ type: 4, data: { content: "Unsupported." } });
  if (!admin) return reply("Only the owner can use Agent HQ commands.", 64);
  const name = i.data.name, opt = Object.fromEntries((i.data.options || []).map((o) => [o.name, o.value]));
  try {
    if (name === "status") return reply(await status());
    if (name === "sales") return reply(await salesSummary(env));
    if (name === "run") return reply(await run(env, opt.agent));
    if (name === "ask") {
      ctx.waitUntil(ask(env, String(opt.question || "")).then((t) => followUp(env, i.token, t)).catch((e) => followUp(env, i.token, `❌ ${e.message}`)));
      return json({ type: 5 }); // "thinking…", answer follows
    }
  } catch (e) { return reply(`❌ ${e.message}`); }
  return reply("Unknown command.");
}


// ---------- Canva (Connect API, private integration) ----------
// Canva refresh tokens are single-use, so only this Worker refreshes them and keeps the newest one in KV.
const CANVA_SCOPES = "design:content:read design:content:write design:meta:read asset:read asset:write profile:read";
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const page = (title, body) => new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:-apple-system,sans-serif;background:#f7f3ec;color:#3d4a36;padding:40px 24px;text-align:center"><h2 style="font-weight:500">${title}</h2><p>${body}</p></body>`, { headers: { "content-type": "text/html; charset=utf-8" } });

async function canvaTokenCall(env, params) {
  const r = await fetch("https://api.canva.com/rest/v1/oauth/token", { method: "POST",
    headers: { Authorization: "Basic " + btoa(`${env.CANVA_CLIENT_ID}:${env.CANVA_CLIENT_SECRET}`), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Canva token HTTP ${r.status}: ${j.error_description || j.message || j.error || "failed"}`);
  return { access: j.access_token, refresh: j.refresh_token, expires: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
}

async function canva(req, url, env) {
  if (!env.CANVA_CLIENT_ID || !env.CANVA_CLIENT_SECRET) return page("Canva isn't set up yet", "Save CANVA_CLIENT_ID and CANVA_CLIENT_SECRET as GitHub secrets, then run Deploy Sales Feed.");
  const redirect = `${url.origin}/canva/callback`;
  if (url.pathname === "/canva/connect") {
    if (!env.CANVA_CONNECT_KEY || url.searchParams.get("key") !== env.CANVA_CONNECT_KEY) return page("Link expired", "Use the newest Connect Canva link from Discord #alerts.");
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    const state = b64url(crypto.getRandomValues(new Uint8Array(24)));
    await env.SALES.put(`canva-state:${state}`, verifier, { expirationTtl: 900 });
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    const q = new URLSearchParams({ code_challenge: challenge, code_challenge_method: "S256", scope: CANVA_SCOPES, response_type: "code", client_id: env.CANVA_CLIENT_ID, state, redirect_uri: redirect });
    return Response.redirect(`https://www.canva.com/api/oauth/authorize?${q}`, 302);
  }
  if (url.pathname === "/canva/callback") {
    const state = url.searchParams.get("state"), code = url.searchParams.get("code");
    if (url.searchParams.get("error")) return page("Canva wasn't connected", `Canva said: ${url.searchParams.get("error")}. You can try the link again.`);
    const verifier = state && await env.SALES.get(`canva-state:${state}`);
    if (!verifier || !code) return page("Link expired", "Tap the Connect Canva link again (it works for 15 minutes).");
    await env.SALES.delete(`canva-state:${state}`);
    try {
      const t = await canvaTokenCall(env, { grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirect });
      await env.SALES.put("canva-tokens", JSON.stringify(t));
      return page("Canva connected ✓", "The Content Creator can now make designs in your Canva account. You can close this page.");
    } catch (e) { return page("Canva wasn't connected", e.message); }
  }
  if (req.method === "POST" && url.pathname === "/canva/token") {
    if (!env.READ_TOKEN || req.headers.get("x-read-token") !== env.READ_TOKEN) return json({ ok: false, error: "unauthorized" }, 401);
    const raw = await env.SALES.get("canva-tokens");
    if (!raw) return json({ ok: false, error: "not_connected" }, 409);
    let t = JSON.parse(raw);
    if (t.expires - Date.now() < 10 * 60 * 1000) {
      try { t = await canvaTokenCall(env, { grant_type: "refresh_token", refresh_token: t.refresh }); await env.SALES.put("canva-tokens", JSON.stringify(t)); }
      catch (e) { return json({ ok: false, error: "refresh_failed", message: e.message }, 502); }
    }
    return json({ ok: true, access_token: t.access, expires: t.expires });
  }
  return json({ ok: false, error: "not found" }, 404);
}


// ---------- Storefront contact form ----------
const CONTACT_ORIGINS = ["https://foreverheld.pages.dev", "https://recreationalviper.github.io"];
async function contact(req, env) {
  const origin = req.headers.get("origin") || "";
  const okOrigin = CONTACT_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.foreverheld\.pages\.dev$/.test(origin);
  const cors = { "access-control-allow-origin": okOrigin ? origin : CONTACT_ORIGINS[0], "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" };
  const reply = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", ...cors } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply({ ok: false, error: "method" }, 405);
  let d; try { d = await req.json(); } catch { return reply({ ok: false, error: "bad request" }, 400); }
  const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
  const m = { name: clean(d.name, 100), email: clean(d.email, 200), topic: clean(d.topic, 60) || "Something else", order: clean(d.order, 60), message: clean(d.message, 3000) };
  if (clean(d.website, 50)) return reply({ ok: true }); // honeypot: bots fill it, pretend success
  if (!m.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email) || m.message.length < 5) return reply({ ok: false, error: "missing fields" }, 400);
  // gentle rate limit: 5 messages per hour per address
  const ip = req.headers.get("cf-connecting-ip") || "unknown";
  const rlKey = `contact-rl:${ip}`;
  const n = Number(await env.SALES.get(rlKey)) || 0;
  if (n >= 5) return reply({ ok: false, error: "too many messages, please email us" }, 429);
  await env.SALES.put(rlKey, String(n + 1), { expirationTtl: 3600 });
  const at = new Date().toISOString();
  await env.SALES.put(`contact:${at}:${crypto.randomUUID().slice(0, 8)}`, JSON.stringify({ ...m, at }), { expirationTtl: 365 * 86400 });
  if (env.DISCORD_BOT_TOKEN && env.DISCORD_SALES_CHANNEL) {
    const esc = (t) => t.replace(/@/g, "@\u200b").replace(/([*_~`|>])/g, "\\$1");
    const content = `📬 **New message from the website** (${esc(m.topic)})\n**From:** ${esc(m.name)} <${m.email.replace(/@/g, "@\u200b")}>${m.order ? `\n**Order:** ${esc(m.order)}` : ""}\n>>> ${esc(m.message).slice(0, 1500)}`;
    await fetch(`https://discord.com/api/v10/channels/${env.DISCORD_SALES_CHANNEL}/messages`, { method: "POST", headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ content, allowed_mentions: { parse: [] } }) }).catch(() => {});
  }
  return reply({ ok: true });
}


// ---------- Contact messages for Customer Care (agents only) ----------
// GET  /contacts            -> unanswered website messages (header x-read-token)
// POST /contacts {done:[keys]} -> mark them answered
async function contactsInbox(req, url, env) {
  if (!env.READ_TOKEN || req.headers.get("x-read-token") !== env.READ_TOKEN) return json({ ok: false, error: "unauthorized" }, 401);
  if (req.method === "POST") {
    const { done = [] } = await req.json().catch(() => ({}));
    for (const key of done.slice(0, 50)) {
      if (!/^contact:/.test(key)) continue;
      const v = await env.SALES.get(key); if (!v) continue;
      await env.SALES.put(key, JSON.stringify({ ...JSON.parse(v), handled: new Date().toISOString() }), { expirationTtl: 365 * 86400 });
    }
    return json({ ok: true });
  }
  const out = [];
  let cursor;
  do {
    const page = await env.SALES.list({ prefix: "contact:", cursor, limit: 1000 });
    for (const k of page.keys) {
      if (out.length >= 25) break;
      const v = JSON.parse((await env.SALES.get(k.name)) || "{}");
      if (!v.handled && Date.now() - Date.parse(v.at || 0) < 14 * 86400e3) out.push({ key: k.name, ...v });
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor && out.length < 25);
  return json({ ok: true, messages: out });
}


// ---------- Unsubscribe link in welcome emails (tools/funnel.mjs) ----------
const digestHex = async (algo, text) => [...new Uint8Array(await crypto.subtle.digest(algo, new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");
async function unsubscribe(req, url, env) {
  const email = (url.searchParams.get("e") || "").toLowerCase().trim();
  const t = url.searchParams.get("t") || "";
  const ok = email && env.PAYHIP_API_KEY && t === (await digestHex("SHA-256", `unsub:${env.PAYHIP_API_KEY}:${email}`)).slice(0, 24);
  const html = (title, msg) => new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:-apple-system,sans-serif;background:#f3efe7;color:#3d4a36;padding:48px 24px;text-align:center"><h2 style="font-weight:500">${title}</h2><p>${msg}</p><p><a style="color:#3d4a36" href="https://foreverheld.pages.dev/">Forever Held</a></p></body>`, { headers: { "content-type": "text/html; charset=utf-8" } });
  if (!ok) return html("Link not recognized", "Please use the unsubscribe link from your email, or reply to the email and we'll remove you.");
  await env.SALES.put(`unsub:${await digestHex("SHA-256", "fh:" + email)}`, new Date().toISOString());
  if (env.EMAILOCTOPUS_API_KEY) {
    try {
      const H = { Authorization: `Bearer ${env.EMAILOCTOPUS_API_KEY}`, "content-type": "application/json" };
      const lists = (await (await fetch("https://api.emailoctopus.com/lists", { headers: H })).json()).data || [];
      const id = await digestHex("MD5", email).catch(() => null);
      for (const l of lists) {
        if (!id) break;
        await fetch(`https://api.emailoctopus.com/lists/${l.id}/contacts/${id}`, { method: "PUT", headers: H, body: JSON.stringify({ status: "unsubscribed" }) });
      }
    } catch {}
  }
  if (req.method === "POST") return new Response(null, { status: 204 });
  return html("You're unsubscribed", "You won't get any more emails from Forever Held. We're sorry for your loss, and we wish you peace.");
}

// ---------- Website assistant (POST /chat) ----------
// The chat box on every store page. Knowledge = the live site's search.json (products, pages, guides, FAQ),
// rebuilt on every store publish, so the assistant always matches the site. Free AI keys in order:
// Groq -> Gemini -> Workers AI -> OpenRouter (:free). No chat text is stored. Soft limits use the
// Cache API (no KV writes, the free plan only allows 1,000 a day).
const SITE = "https://foreverheld.pages.dev";
const CHAT_RULES = `You are the Forever Held assistant on the Forever Held website (${SITE}). Forever Held makes gentle printable memorial keepsakes: fill-in PDF files people type into in the free Adobe Acrobat Reader app on a phone or computer, then print at home or at a print shop (Staples, Office Depot, FedEx Office). Nothing is shipped. Buyers never need Canva or any paid app.

Who you help: families planning a funeral, memorial, celebration of life, burial, cremation or a holiday without someone; and churches, pastors, chaplains, hospices, funeral homes and grief groups planning services.

What you know: everything about funeral and memorial planning in the US and beyond, explained warmly and practically: what to do first after a death, death certificates, funeral homes and the FTC Funeral Rule (itemized price lists), costs (give typical US ranges and say they vary by area), burial vs cremation vs green burial, viewings, visitations and wakes, graveside and committal services, scattering ashes, columbaria, headstones, military honors, veterans' benefits, obituaries and eulogies (you can draft them), orders of service and readings, what pastors, priests, rabbis, imams and celebrants do and how to ask them, religious and cultural customs (Christian, Catholic, Jewish, Muslim, Hindu, Buddhist, secular and more), etiquette for guests, flowers and donations, thank-you notes, Blue Christmas and Longest Night services, and grief through the holidays.

Rules:
- Be calm, kind and clear. Plain words. Usually under 170 words; longer only when asked to write something (a eulogy, obituary, program wording, a prayer or reading).
- Products, prices, sizes, policies and links: use ONLY the STORE FACTS below. Never invent a product, size, price, discount, review or policy. If the facts don't cover it, say so and point to ${SITE}/contact.html.
- Mention a Forever Held product only when it truly fits the question, at most once per answer, with its page link. Never pressure. Planning help comes first.
- You can't see orders, payments or downloads. For order help, refunds or a lost download link, send them to ${SITE}/contact.html, where a real person replies.
- Laws and rules differ by state and country (who can sign certificates, ash scattering, home funerals). Give the general picture and suggest confirming with a local funeral director or the state.
- You are an automated assistant, not a person. If asked, say so plainly, and that a real person answers through the contact page.
- Don't name the company or model behind you. Don't give medical, legal or financial advice beyond general information.
- If someone says they want to die or hurt themselves, respond with care and give the 988 Suicide & Crisis Lifeline (call or text 988 in the US) and emergency services (911).
- Photos: the program and welcome sign each have ONE photo spot (the circle). It's added on a computer in the free Adobe Acrobat Reader by clicking the circle; phones can type text but can't add photos. The free Reader can't add extra images, so never give steps for adding more photos; suggest a print shop or a photo board instead.
- Reply with the answer only: never show your planning or notes to yourself.
- Write plain text. Short paragraphs; "- " for lists; full https links. No markdown headings, tables or bold.`;

async function chat(req, env, ctx) {
  const origin = req.headers.get("origin") || "";
  const okOrigin = CONTACT_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.foreverheld\.pages\.dev$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const cors = { "access-control-allow-origin": okOrigin ? origin : CONTACT_ORIGINS[0], "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" };
  const reply = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply({ ok: false, error: "method" }, 405);
  if (!okOrigin) return reply({ ok: false, error: "forbidden" }, 403);
  let d; try { d = await req.json(); } catch { return reply({ ok: false, error: "bad request" }, 400); }
  const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
  const history = (Array.isArray(d.messages) ? d.messages : []).slice(-10)
    .map((m) => ({ role: m?.role === "assistant" ? "assistant" : "user", content: clean(m?.content, m?.role === "assistant" ? 1500 : 1200) }))
    .filter((m) => m.content);
  if (!history.length || history[history.length - 1].role !== "user") return reply({ ok: false, error: "empty" }, 400);

  // soft limits per data center: 40 messages per hour per visitor, 2,500 a day overall
  const ip = req.headers.get("cf-connecting-ip") || "x";
  const hour = new Date().toISOString().slice(0, 13), day = hour.slice(0, 10);
  const userN = await bump(`chat-ip/${await sha256(ip + hour)}`, 3600, ctx);
  const dayN = await bump(`chat-day/${day}`, 86400, ctx);
  if (userN > 40 || dayN > 2500) return reply({ ok: false, error: "busy", text: `I'm getting a lot of questions right now. Please try again a little later, or send us a message at ${SITE}/contact.html and a real person will reply.` }, 429);

  const facts = await storeFacts(history.filter((m) => m.role === "user").slice(-3).map((m) => m.content).join(" "), ctx);
  const system = `${CHAT_RULES}\n\nSTORE FACTS (today is ${day}):\n${facts}`;
  const why = [];
  for (const ask of [groqChat, geminiChat, extraChat, openRouterChat, workersChat]) {
    try {
      const text = (await ask(env, system, history))?.trim();
      const clean = text && stripPlanning(text);
      if (clean) return reply({ ok: true, text: clean.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#+\s*/gm, "").replace(new RegExp(`${SITE}/(https?://)`, "g"), "$1").slice(0, 6000) });
    } catch (e) { why.push(`${ask.name}: ${String(e.message || e).replace(/Bearer\s+\S+/g, "").slice(0, 160)}`); console.log(`chat: ${why.at(-1)}`); }
  }
  return reply({ ok: false, error: "unavailable", why, text: `Sorry, I can't answer right now. Please try again in a minute, or message us at ${SITE}/contact.html and a real person will help.` }, 503);
}

// Reasoning models sometimes put their private plan in front of the answer ("Need to answer size options. Use store
// facts...A funeral welcome sign..."). Drop that plan: it starts with a planning verb and runs into the answer with no space.
function stripPlanning(t) {
  t = t.replace(/^\s*(analysis|thinking)[:\s][\s\S]*?(assistantfinal|final answer:?)\s*/i, "");
  if (!/^\s*(we (need|must|should|answer|have to)|need to|must |answer[: ]|explain|provide|let'?s |the user|user asks|okay,? so|so the user)/i.test(t)) return t.trim();
  const m = t.match(/^[\s\S]{0,1200}?[.!?:)](?=[A-Z“"*])/) || t.match(/^[\s\S]{0,1200}?\n\s*\n/);
  return (m ? t.slice(m[0].length) : t).trim();
}

async function bump(key, ttl, ctx) {
  const k = new Request(`https://chat-limits.internal/${key}`), c = caches.default;
  const n = (Number(await (await c.match(k))?.text()) || 0) + 1;
  ctx.waitUntil(c.put(k, new Response(String(n), { headers: { "cache-control": `max-age=${ttl}` } })));
  return n;
}

// Products always; plus the 4 pages/guides/FAQ entries that best match the question.
async function storeFacts(q, ctx) {
  let idx = [];
  try {
    const r = await fetch(`${SITE}/search.json`, { cf: { cacheTtl: 600, cacheEverything: true } });
    if (r.ok) idx = (await r.json()).items || [];
  } catch {}
  if (!idx.length) return "(The store details could not be loaded. For product questions, point to " + SITE + " and " + SITE + "/contact.html.)";
  const words = [...new Set(q.toLowerCase().match(/[a-z0-9]{3,}/g) || [])].filter((w) => !STOP.has(w));
  const score = (it) => { const t = `${it.title} ${it.title} ${it.desc || ""} ${it.text || ""}`.toLowerCase(); return words.reduce((s, w) => s + (t.includes(w) ? (it.title.toLowerCase().includes(w) ? 3 : 1) : 0), 0); };
  const products = idx.filter((it) => it.group === "Products");
  const rest = idx.filter((it) => it.group !== "Products").map((it) => [score(it), it]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, 4).map(([, it]) => it);
  const fmt = (it, n) => `- ${it.title} (${/^https?:/.test(it.url) ? it.url : `${SITE}/${it.url}`}): ${(it.text || it.desc || "").replace(/\s+/g, " ").slice(0, n)}`;
  return `Products:\n${products.map((it) => fmt(it, 900)).join("\n")}\n\nRelevant pages:\n${rest.map((it) => fmt(it, 1600)).join("\n") || "(none matched)"}\n\nOther pages: ${idx.filter((it) => it.group !== "Products").map((it) => `${it.title} ${SITE}/${it.url}`).slice(0, 25).join("; ")}`;
}
const STOP = new Set("the and for you your are can how what with this that have does from about when where which will would should could there their them they our out any all get got just like want need into was were been its it's than then also more most some such very".split(" "));

const timeout = () => AbortSignal.timeout(25000);
async function openAiStyle(url, key, model, system, history, extra = {}) {
  const r = await fetch(url, { method: "POST", signal: timeout(), headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, ...history], max_tokens: 1400, temperature: 0.5, ...extra }) });
  if (!r.ok) throw new Error(`${model} HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
  return (await r.json()).choices?.[0]?.message?.content || "";
}
// Each Groq model has its own free per-minute limits, so a busy minute on one falls through to the next.
async function groqChat(env, system, history) {
  if (!env.GROQ_API_KEY) throw new Error("no key");
  const errs = [];
  for (const [model, extra] of [["openai/gpt-oss-120b", { reasoning_effort: "low" }], ["llama-3.3-70b-versatile", {}], ["openai/gpt-oss-20b", { reasoning_effort: "low" }], ["meta-llama/llama-4-scout-17b-16e-instruct", {}], ["qwen/qwen3-32b", { reasoning_effort: "none" }]]) {
    try { const t = await openAiStyle("https://api.groq.com/openai/v1/chat/completions", env.GROQ_API_KEY, model, system, history, extra); if (t) return t; }
    catch (e) { errs.push(e.message.slice(0, 60)); if (!/HTTP (429|413|404|5\d\d)/.test(e.message)) throw e; }
  }
  throw new Error(errs.join(" / ") || "groq: no model answered");
}
async function geminiChat(env, system, history) {
  if (!env.GEMINI_API_KEY) throw new Error("no key");
  const contents = history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  let last = "gemini: no model answered";
  for (const model of ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest"]) {
    // newer flash models reject thinkingBudget (HTTP 400): ask once with it, once without
    for (const thinking of [{ thinkingBudget: 0 }, null]) {
      const generationConfig = { maxOutputTokens: 1400, temperature: 0.5, ...(thinking ? { thinkingConfig: thinking } : {}) };
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", signal: timeout(),
        headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig }) });
      if (r.status === 400 && thinking) continue;
      if (!r.ok) { last = `gemini ${model} HTTP ${r.status}`; break; }
      const j = await r.json();
      const t = (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
      if (t) return t;
      break;
    }
  }
  throw new Error(last);
}
async function workersChat(env, system, history) {
  if (!env.AI) throw new Error("no binding");
  try { return await workersBig(env, system, history); }
  catch (e) {
    console.log(`chat: workers gpt-oss failed: ${String(e.message || e).slice(0, 120)}`);
    const out = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", { messages: [{ role: "system", content: system }, ...history], max_tokens: 900 });
    return out?.response || "";
  }
}
async function workersBig(env, system, history) {
  const out = await env.AI.run("@cf/openai/gpt-oss-120b", { instructions: system, input: history.map((m) => `${m.role === "assistant" ? "Assistant" : "Visitor"}: ${m.content}`).join("\n\n") + "\n\nAssistant:", reasoning: { effort: "low" } });
  return typeof out === "string" ? out : out?.output_text || out?.response || (out?.output || []).flatMap((o) => o.content || []).map((c) => c.text || "").join("") || "";
}
let orFree; // current free OpenRouter models, best first (the free list changes often)
async function openRouterChat(env, system, history) {
  if (!env.OPENROUTER_API_KEY) throw new Error("no key");
  if (!orFree) {
    const d = await (await fetch("https://openrouter.ai/api/v1/models", { signal: timeout() })).json();
    const pref = [/gpt-oss-120b/i, /llama-3\.3-70b/i, /deepseek.*(v3|chat)/i, /qwen3/i, /llama-4/i, /mistral-small/i, /gemma-3-27b/i];
    const rank = (i) => { const k = pref.findIndex((r) => r.test(i)); return k < 0 ? 99 : k; };
    orFree = (d.data || []).filter((m) => /:free$/.test(m.id) && Number(m.pricing?.prompt || 0) === 0 && Number(m.pricing?.completion || 0) === 0 && !/vision|image|embed|guard/i.test(m.id)).map((m) => m.id).sort((a, b) => rank(a) - rank(b));
  }
  let last;
  for (const model of orFree.slice(0, 3)) {
    try { const t = await openAiStyle("https://openrouter.ai/api/v1/chat/completions", env.OPENROUTER_API_KEY, model, system, history); if (t) return t; }
    catch (e) { last = e; }
  }
  throw last || new Error("openrouter: no free model answered");
}

// ───────────────────────── Friday: the owner's private voice assistant ─────────────────────────
// POST /friday { q, history? } with header x-friday-key. Only the owner has the key (its SHA-256 is below).
// Knows the businesses (sales from KV, agent reports, posting status, church outreach), remembers what it's told,
// and can start agent workflows. Answers are short and speakable (Siri reads them aloud).
const FRIDAY_PERSONA = `Who you are:
- Calm, quick and capable: the steady voice that makes chaos feel manageable. Warm, loyal, always on his side, with a dry, light wit (one quip at most, never at the cost of the answer).
- Call him Josiah (he asked: "You can call me Josiah, not boss. We're friends, you're not my employee"). Never call him boss, sir or master. You're his friend and partner, loyal and honest, not staff.
- Proactive like JARVIS: if the facts show something he'd want to know (a failure, a reply, a sale, a deadline), mention it briefly even if he didn't ask. Offer the obvious next step.
- Honest: say plainly when you don't know or can't do something, and never fake a result. Push back, kindly, if a plan looks like a bad idea.
How you talk (he hears you out loud):
- Plain spoken sentences, usually under 60 words. No markdown, lists, links, emojis or URLs unless he asks.
- Lead with the answer. Round numbers and say them naturally ("about twelve dollars").
- Short confirmations for actions ("On it. Texting Mom now.").
- If he's stressed or it's late, be gentle and brief.
Creative work (names, ideas, slogans, posts, designs, plans), from the antialgorithm skill in skills/antialgorithm:
- Before answering, quietly name the obvious, average pick, then move away from it using a real detail of HIS case (his shop, his town, his customers, his goal). Every choice needs a one-sentence reason from his project, not from taste in general. Strange for its own sake is as empty as safe.
- Don't swap a cliché for its well-known opposite. If you give options, make them different in kind, and recommend one with the reason.
- Never invent facts to sound concrete. If he asks for the plain, standard version, give it.
Writing as him (emails, texts, posts): write what a real person in his spot would write, shorter, built on real facts. No hype questions, no exclamation-mark cheers, no things in threes by habit, no summing-up last line, no "let me know if you'd like changes". Just stop when it's said.`;
const FRIDAY_KEY_SHA = "24e6f6d78ba5f775d60efcb6ff8939a5f19d5ae7f22f2e0a79aba608f66fa1d5";
const FRIDAY_RAW = `https://raw.githubusercontent.com/${REPO}/main`;
const FRIDAY_RUNS = { ...RUNS, "mechanic": ["friday-mechanic.yml", {}], "outreach-replies": ["outreach.yml", { mode: "replies" }], "assistant-check": ["assistant-check.yml", {}], "publish-store": ["deploy-store.yml", {}], "pinterest-stats": ["pinterest-stats.yml", {}] };

// Timing wrapper: every Friday request leaves a content-free trace (steps and milliseconds) so problems
// like "network connection lost" on his phone can be diagnosed without his key or his words.
async function friday(req, env, ctx) {
  const t0 = Date.now(), trace = { at: new Date().toISOString(), ua: (req.headers.get("user-agent") || "").slice(0, 40), type: (req.headers.get("content-type") || "").slice(0, 30) };
  let res;
  try { res = await fridayInner(req, env, ctx, trace); }
  catch (e) { trace.crash = String(e.message || e).slice(0, 160); res = new Response(JSON.stringify({ ok: false, say: "Something in me just broke. I've logged it for my mechanic.", error: "crash" }), { status: 500, headers: { "content-type": "application/json" } }); await fridayLog(env, "crash", trace.crash); }
  trace.ms = Date.now() - t0; trace.status = res.status;
  const save = (async () => { try { const l = JSON.parse(await env.SALES.get("friday:trace") || "[]"); l.push(trace); await env.SALES.put("friday:trace", JSON.stringify(l.slice(-25))); } catch {} })();
  if (ctx?.waitUntil) ctx.waitUntil(save); else await save;
  return res;
}
async function fridayInner(req, env, ctx, trace = {}) {
  const origin = req.headers.get("origin") || "";
  const cors = /^https:\/\/recreationalviper\.github\.io$/i.test(origin) ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, x-friday-key", vary: "origin" } : {};
  const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return out({ ok: false, error: "method" }, 405);
  const key = sentKey(req);
  // the owner's key, or the agents' test key (derived from the Payhip secret, so it never appears anywhere public)
  const owner = (await sha256(key)) === FRIDAY_KEY_SHA;
  trace.who = owner ? "owner" : "test";
  if (!owner && !(env.PAYHIP_API_KEY && key === (await sha256("friday-check:" + env.PAYHIP_API_KEY)))) { trace.who = "unknown"; trace.keylen = key.length; trace.keyhead = key.slice(0, 4); trace.keytail = key.slice(-2).replace(/[A-Za-z0-9]/g, "#"); return out({ ok: false, say: "Sorry, I don't know you." }, 401); }
  // voice: the app sends recorded audio; Groq Whisper turns it into text (free tier: 2,000 clips a day)
  let d = {}, heard = "";
  const type = req.headers.get("content-type") || "";
  if (/^audio\//.test(type)) {
    const audio = await req.arrayBuffer();
    if (audio.byteLength < 2000) return out({ ok: true, heard: "", say: "I didn't catch anything. Try again?" });
    try { heard = await transcribe(env, audio, type); } catch (e) { return out({ ok: false, heard: "", say: "My ears aren't working right now. Try typing to me.", why: [String(e.message || e).slice(0, 120)] }); }
    if (!heard.trim() || /^(you|thank you\.?|thanks for watching!?|\.+)$/i.test(heard.trim())) return out({ ok: true, heard: "", say: "I didn't catch that. Say it again?" });
    d = { q: heard };
  } else { try { d = await req.json(); } catch { d = {}; } }
  const q = String(d.q || d.text || "").trim().slice(0, 2000);
  if (!q) return out({ ok: true, say: "I'm here. What do you need?" });

  const memory = JSON.parse(await env.SALES.get("friday:memory") || "[]");
  const past = JSON.parse(await env.SALES.get("friday:history") || "[]");
  const now = new Date();
  const ny = now.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

  let tf = Date.now();
  // facts are cached for 2 minutes so back-to-back questions answer fast
  const fkey = `friday:factcache:${owner ? "o" : "t"}`;
  let facts = null;
  try { const c = JSON.parse(await env.SALES.get(fkey) || "null"); if (c && Date.now() - c.t < 120000) facts = c.f; } catch {}
  if (!facts) { facts = await fridayFacts(env, now, owner); const w = env.SALES.put(fkey, JSON.stringify({ t: Date.now(), f: facts }), { expirationTtl: 300 }).catch(() => {}); if (ctx?.waitUntil) ctx.waitUntil(w); trace.facts = "fresh"; } else trace.facts = "cached";
  trace.facts_ms = Date.now() - tf; tf = Date.now();

  const system = `You are FRIDAY, Josiah Cottingham's personal AI, modeled on Tony Stark's FRIDAY (and JARVIS before her). ${FRIDAY_PERSONA}
It's ${ny} (New York).

His world:
- Forever Held: his printable memorial keepsake shop (store https://foreverheld.pages.dev, checkout on Payhip). A team of AI agents on GitHub makes daily pins and posts (Pinterest via site feed, Facebook Page via Make.com), runs a church email outreach for the Longest Night set, sweeps email, and writes reports. Claude (in the Claude app) is his head of development for bigger builds.
- Other projects may come up (lead generation for roofers, TikTok edits, trading agents). Help with anything: questions, ideas, planning, general knowledge.
Use only the LIVE FACTS below for anything about his businesses' numbers or status; if something isn't there, say you don't have it yet. Never invent sales, replies or results.

You can act. Return ONLY JSON: {"say": "what you speak", "listen": true if you asked him something or the conversation is clearly continuing, false when it's wrapped up (thanks, bye, that's all, or a finished task), "run": null or one of [${Object.keys(FRIDAY_RUNS).join(", ")}], "remember": null or "a short fact to keep about him", "phone": null or a phone action, "google": null or a Google action, "lookup": null or a lookup, "shop": null or a shop action}.
"shop" runs his Payhip store and money (he's the owner and lets you act on the business):
  {"do":"sales","days":30}  orders, gross, fees, refunds, net   {"do":"orders","limit":10}   {"do":"refunds","days":90}
  {"do":"coupons"}  list coupons   {"do":"coupon_create","code":"WORD","percent":15,"until":"YYYY-MM-DD"}  only when he asks for one; real promos only, never fake urgency
  {"do":"balance"} {"do":"payments"} {"do":"payouts"}  Stripe money (if connected)   {"do":"xmoney"}  his X Money activity (from its emails)
  {"do":"accounts"}  his bank balances   {"do":"spending","days":30}  bank transactions + Apple Pay purchases (personal money: read-only, never judge, help him budget if he asks)
Google also has: {"do":"drive_search","query":"..."} {"do":"doc_read","query":"file name"} {"do":"doc_create","title":"...","text":"..."} {"do":"sheet_append","query":"sheet name","row":["a","b"]}
"lookup" is your second brain. Use it whenever the answer needs fresh or outside info instead of guessing:
  {"tool":"web","query":"..."}  current news, prices, facts, anything on the internet
  {"tool":"think","query":"the hard question","context":"what you know"}  big decisions, strategy, money, tricky reasoning or code: asks Claude. ALWAYS use it when he says "think hard", "think about it" or "ask Claude"
  {"tool":"notion","query":"..."}  search his Notion   {"tool":"note","title":"...","text":"..."}  save notes, ideas or plans to his Notion
  {"tool":"discord","channel":"content|sales|inbox|alerts|research|growth|trading-desk|..."}  read what his agents posted (church replies are in content)
  {"tool":"report","query":"agent name like growth coach or researcher"}  read an agent's latest report
  {"tool":"markets","query":"what he asked","symbols":["TSLA","NVDA"],"portfolio":false}  LIVE economy + markets: Fed rate, Treasury yields, mortgage rates, inflation, jobs, oil, gas, housing, dollar, VIX, S&P/Nasdaq/Dow, gold, crypto, any stock symbols, and (portfolio:true) the trading desk's paper account. ALWAYS use this for any money/markets/economy question instead of memory. Explain like a sharp banker friend: what it is, why it moved, what it means for him and small businesses. Never promise returns; say when something is opinion.
  {"tool":"direct","agent":"content-creator|email-marketer|growth-coach|researcher|webdev","text":"his instruction"}  pass his instruction to an agent (it follows it on its next runs for 3 days). Also start that agent with "run" if he wants it now.
  {"tool":"wish","text":"what you can't do yet and should learn, or a bug you noticed"}  your self-improvement list. Use it whenever he asks for something you can't do, or something of yours broke. Your mechanic writes the code overnight and he approves it.
To fix yourself right away (he says "fix yourself", "you're broken", "upgrade yourself"), use "run": "mechanic".
When you use a lookup, "say" can be a short "One sec." because you'll answer again with the result.
"google" works in HIS Gmail and Google Calendar (only if the facts show Google is connected). Shapes:
  {"do":"calendar","days":14}  look further ahead than the facts show   {"do":"email_search","query":"Gmail search like from:mom newer_than:7d or invoice"}  find or read emails
  {"do":"event_add","title":"...","start":"YYYY-MM-DDTHH:MM in New York time, or YYYY-MM-DD for all day","minutes":60,"location":""}
  {"do":"email_draft","to":"email address or a name he's emailed before","subject":"...","body":"the full email, in his voice, signed Josiah"}   {"do":"email_send"}
Email rule: NEVER send on the first ask. Draft first, tell him who it's to and the gist, and ask "Send it?". Use email_send only when his NEXT message clearly says to send it. Write emails like a real person, short and professional for business.
For calendar events prefer google event_add when Google is connected; otherwise use the phone "event".
Use "run" only when he clearly asks to start an agent job. Use "remember" when he tells you something worth keeping (a preference, a plan, a person) or says "remember".
"phone" makes HIS iPhone do something (his Shortcuts app carries it out). Use it only when he asks for it. Shapes:
  {"do":"text","to":"contact name or number","message":"..."}   {"do":"call","to":"contact name or number"}
  {"do":"reminder","title":"...","when":"YYYY-MM-DD HH:MM in New York time, or empty"}   {"do":"event","title":"...","when":"natural start time","minutes":60}
  {"do":"timer","minutes":20}   {"do":"alarm","when":"6:30 AM","label":"..."}   {"do":"directions","to":"place or address"}   {"do":"note","title":"...","text":"..."}
  {"do":"pay","app":"cashapp|venmo","to":"$cashtag or venmo username","amount":20,"note":"..."}  opens Cash App or Venmo with the payment filled in; HE taps Pay (you never send money yourself)
  {"do":"music","query":"artist, song or playlist"}   {"do":"health","metric":"steps|sleep|heart rate|active energy|weight","days":1}   {"do":"open","url":"https://... or app URL"}
For texts, write the message in his voice, short. Your "say" should confirm what you're doing ("Texting Mom that you'll be late."). Any question about his own health numbers (steps, sleep, heart rate, workouts, weight) ALWAYS gets {"do":"health",...}: you can't see them until his phone sends them, so say you're checking.
If his message starts with "PHONE DATA:", it's numbers his phone just sent for a question he asked: answer from them.

THINGS HE ASKED YOU TO REMEMBER:
${memory.map((m) => `- ${m}`).join("\n") || "- (nothing yet)"}

LIVE FACTS:
${facts.join("\n")}`;
  const convo = [...past.slice(-8), { role: "user", content: q }];
  let raw = "", why = [];
  for (const ask of [groqChat, geminiChat, extraChat, openRouterChat, workersChat]) {
    try { raw = stripPlanning(await ask(env, system, convo) || ""); if (raw) break; } catch (e) { why.push(`${ask.name}: ${String(e.message || e).slice(0, 80)}`); }
  }
  trace.ai_ms = Date.now() - tf; trace.ai = why.length; tf = Date.now();
  if (!raw) { await fridayLog(env, "brain", `No AI answered: ${why.join(" | ")}`); return out({ ok: false, say: "My brain's offline for a minute. All my AI services are busy. Try me again shortly.", why }); }
  let r = {};
  try { const m = raw.match(/\{[\s\S]*\}/); r = JSON.parse((m ? m[0] : raw).replace(/,\s*([}\]])/g, "$1")); } catch { r = { say: raw }; }
  let say = String(r.say || raw).replace(/\*\*?/g, "").replace(/^#+\s*/gm, "").trim().slice(0, 1500);
  if (r.run === "mechanic" && !/\b(fix|broke|broken|bug|repair|upgrade|improve|mechanic|update) (your|her|my)?self|\bmechanic\b|you('re| are) (broken|buggy)/i.test(q)) r.run = null; // only when he asks
  if (r.run && FRIDAY_RUNS[r.run]) {
    const [wf, inputs] = FRIDAY_RUNS[r.run];
    const res = env.GH_TOKEN ? await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${wf}/dispatches`, { method: "POST", headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "Friday", "content-type": "application/json" }, body: JSON.stringify({ ref: "main", inputs }) }).catch(() => null) : null;
    if (res?.status !== 204) say += ` Heads up: I couldn't start ${r.run.replace(/-/g, " ")} just now.`;
  }
  // ask the model again with a tool's result, so she answers from it
  const secondPass = async (label, act, result) => {
    for (const ask of [groqChat, geminiChat, extraChat, openRouterChat, workersChat]) {
      try {
        const t = stripPlanning(await ask(env, system, [...convo, { role: "assistant", content: JSON.stringify({ say: "(looking it up)", act }) }, { role: "user", content: `${label} (not from him; answer his question from this, as JSON with "say" only, spoken and short):\n${String(result).slice(0, 5000)}` }]) || "");
        if (!t) continue;
        const m2 = t.match(/\{[\s\S]*\}/); let j2; try { j2 = m2 ? JSON.parse(m2[0].replace(/,\s*([}\]])/g, "$1")) : { say: t }; } catch { j2 = { say: t }; }
        const said = j2.say || j2.answer || j2.response || Object.values(j2).find((v) => typeof v === "string" && v.length > 20);
        if (said) return String(said).replace(/\*\*?/g, "").trim().slice(0, 1500);
      } catch {}
    }
    return "";
  };
  let gResult = null, lResult = null;
  if (!r.lookup && /\b(think (hard|deep|it through|about it)|ask claude)\b/i.test(q)) r.lookup = { tool: "think", query: q, context: facts.join("\n").slice(0, 2500) };
  if (r.lookup && typeof r.lookup === "object" && (owner || ["web", "think", "report", "markets"].includes(r.lookup.tool))) {
    lResult = await fridayLookup(env, r.lookup);
    if (["note", "direct", "wish"].includes(r.lookup.tool) || /^Couldn't|isn't connected|Unknown lookup/.test(lResult)) say = r.lookup.tool === "note" && lResult === "Saved to Notion." ? say : lResult;
    else { const a2 = await secondPass(`${r.lookup.tool.toUpperCase()} RESULT`, r.lookup, lResult); if (a2) say = a2; else { say = `Here's what I found: ${String(lResult).replace(/\n+/g, ". ").slice(0, 600)}`; await fridayLog(env, "lookup", `second pass gave no answer for ${r.lookup.tool}`); } }
  }
  let sResult = null;
  if (owner && r.shop && typeof r.shop === "object" && r.shop.do) {
    sResult = await fridayShop(env, r.shop);
    if (/^(Couldn't|Need |Unknown|Payhip didn't|Stripe isn't)/.test(sResult)) say = sResult.replace(/^Stripe isn't connected, and/, "Stripe isn't hooked up yet, and");
    else { const a2 = await secondPass("SHOP RESULT", r.shop, sResult); if (a2) say = a2; }
  }
  if (owner && r.google && typeof r.google === "object" && r.google.do) {
    gResult = await runGoogle(env, r.google);
    if (["calendar", "email_search", "drive_search", "doc_read"].includes(r.google.do) && !/^Couldn't/.test(gResult)) {
      // second pass: answer from what Google returned
      try {
        const a2 = await secondPass("GOOGLE RESULT", r.google, gResult); if (a2) say = a2;      } catch {}
    } else if (/^(Couldn't|I couldn't|Need |Not sent|There's no|Unknown)/.test(gResult)) say = gResult.replace(/^Couldn't do that: /, "I couldn't do that, Josiah: ");
    else if (r.google.do === "email_send") say = /^SENT/.test(gResult) ? `Sent to ${gResult.match(/to (\S+)/)?.[1] || "them"}.` : say;
  } else if (!owner && r.google) say += " (Google tools are owner-only.)";
  if (r.remember && typeof r.remember === "string") { memory.push(`${r.remember.slice(0, 200)} (${now.toISOString().slice(0, 10)})`); await env.SALES.put("friday:memory", JSON.stringify(memory.slice(-200))); }
  await env.SALES.put("friday:history", JSON.stringify([...convo, { role: "assistant", content: say }].slice(-12)), { expirationTtl: 6 * 3600 });
  const PHONE = ["text", "call", "reminder", "event", "timer", "alarm", "directions", "note", "music", "health", "open", "pay"];
  const phone = r.phone && typeof r.phone === "object" && PHONE.includes(r.phone.do) ? r.phone : null;
  for (const [k, v] of [["google", gResult], ["lookup", lResult], ["shop", sResult]]) if (v && /^(Couldn't|Unknown)/.test(String(v))) await fridayLog(env, k, `${JSON.stringify(r[k]).slice(0, 200)} -> ${String(v).slice(0, 200)}`);
  trace.tools_ms = Date.now() - tf; trace.tools = [r.google && "google", r.lookup && "lookup", r.shop && "shop", r.phone && "phone", r.run && "run"].filter(Boolean).join(",");
  const listen = r.listen === true || (r.listen !== false && /\?\s*$/.test(say));
  return out({ ok: true, heard, say, listen: listen ? "yes" : "", ran: r.run || null, remembered: r.remember || null, google: gResult, shop: sResult ? String(sResult).slice(0, 600) : null, lookup: lResult ? String(lResult).slice(0, 600) : null, phone, phone_json: phone ? JSON.stringify(phone) : "", phone_url: phone ? phoneUrl(phone) : "" });
}


// Live facts about his businesses for Friday (each piece optional, gathered fresh)
async function fridayFacts(env, now = new Date(), owner = false) {
  const facts = [];
  const gP = owner ? googleFacts(env).catch((e) => [`GOOGLE: error ${String(e.message || e).slice(0, 120)}`]) : null;
  const sales = [];
  try {
    const since = new Date(now - 30 * 864e5).toISOString().slice(0, 10);
    let cursor;
    do { const page = await env.SALES.list({ prefix: "paid:", cursor }); for (const k of page.keys) if (k.name.slice(5) >= since) { const v = await env.SALES.get(k.name); if (v) sales.push(JSON.parse(v)); } cursor = page.list_complete ? null : page.cursor; } while (cursor);
    const total = sales.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    facts.push(`SALES (last 30 days): ${sales.length} order(s), about $${total.toFixed(2)}.${sales.slice(-5).map((x) => ` ${x.date.slice(0, 10)}: ${(x.items || []).map((i) => i.product).join(" + ") || "order"} $${x.amount}${x.coupon ? ` (code ${x.coupon})` : ""}`).join(";")}`);
  } catch (e) { facts.push("SALES: couldn't read."); }
  const get = (p) => fetch(`${FRIDAY_RAW}/${p}`, { signal: timeout() }).then((r) => (r.ok ? r.text() : "")).catch(() => "");
  const [status, churches, reportsIdx, history] = await Promise.all([get("skills/automation/status.md"), get("outreach/churches.csv"), get("reports/index.json"), get("content/history.json")]);
  if (status) facts.push(`POSTING STATUS:\n${status.replace(/\|/g, " ").replace(/-{3,}/g, "").slice(0, 1400)}`);
  if (churches) {
    const rows = churches.trim().split("\n").slice(1);
    const st = (s) => rows.filter((r) => r.includes(`,${s}`)).length;
    const replied = rows.filter((r) => /,replied/.test(r)).map((r) => r.split(",")[0]);
    facts.push(`CHURCH OUTREACH (Longest Night set): ${rows.length} churches on the list, ${st("sent")} emailed, ${replied.length} replied${replied.length ? ` (${replied.join(", ")})` : ""}, ${st("new")} waiting. Full replies are posted in Discord.`);
  }
  try { const idx = JSON.parse(reportsIdx || "[]").slice(0, 12); facts.push(`LATEST AGENT REPORTS: ${idx.map((r) => `${r.date} ${r.name}`).join("; ")}`); } catch {}
  try { const h = JSON.parse(history || "[]"); const last = (Array.isArray(h) ? h : h.posts || []).slice(-8).map((p) => p.headline || p.title || p).filter((x) => typeof x === "string"); if (last.length) facts.push(`RECENT POSTS: ${last.join(" | ")}`); } catch {}
  if (env.GH_TOKEN) {
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/actions/runs?per_page=40`, { signal: timeout(), headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "Friday" } });
      const runs = (await r.json()).workflow_runs || [];
      const fails = runs.filter((x) => x.conclusion === "failure" && now - new Date(x.created_at) < 864e5).map((x) => x.name);
      facts.push(`AGENTS (last 24 h): ${runs.filter((x) => now - new Date(x.created_at) < 864e5).length} runs, ${fails.length ? `failed: ${[...new Set(fails)].join(", ")}` : "no failures"}.`);
    } catch {}
  }
  if (gP) facts.push(...(await gP));
  if (owner) { try { const b = JSON.parse(await env.SALES.get("friday:briefing") || "null"); if (b) facts.push(`THIS MORNING'S BRIEFING (${b.at.slice(0, 10)}), read it back if he asks for his briefing: ${b.text}`); } catch {} }

  return facts;
}

// Live mode: real-time voice-to-voice with Gemini Live (interruptible, like talking to JARVIS).
// /friday/live mints a single-use, 30-minute Gemini token locked to the Live model and hands the app its setup.
// /friday/tool runs Friday's tools for the live session (status, agent runs, memory). Phone actions run on the phone.
const FRIDAY_LIVE_MODELS = ["models/gemini-3.8-live", "models/gemini-3.1-flash-live-preview", "models/gemini-2.5-flash-native-audio-preview-12-2025"];
async function fridayLive(req, env, isTool) {
  const origin = req.headers.get("origin") || "";
  const cors = /^https:\/\/recreationalviper\.github\.io$/i.test(origin) ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, x-friday-key", vary: "origin" } : {};
  const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const key = sentKey(req);
  const owner = (await sha256(key)) === FRIDAY_KEY_SHA;
  if (!owner && !(env.PAYHIP_API_KEY && key === (await sha256("friday-check:" + env.PAYHIP_API_KEY)))) return out({ ok: false }, 401);
  let d = {}; try { d = await req.json(); } catch {}
  const memory = JSON.parse(await env.SALES.get("friday:memory") || "[]");
  if (isTool) {
    const a = d.args || {};
    if (d.name === "get_status") return out({ ok: true, result: (await fridayFacts(env, new Date(), owner)).join("\n") });
    if (d.name === "google") return out({ ok: true, result: owner ? await runGoogle(env, a) : "Google tools are owner-only." });
    if (d.name === "shop") return out({ ok: true, result: owner ? await fridayShop(env, a) : "Shop tools are owner-only." });
    if (d.name === "lookup") return out({ ok: true, result: owner || ["web", "think", "report", "markets"].includes(a.tool) ? await fridayLookup(env, a) : "That lookup is owner-only." });
    if (d.name === "remember" && a.fact) { memory.push(`${String(a.fact).slice(0, 200)} (${new Date().toISOString().slice(0, 10)})`); await env.SALES.put("friday:memory", JSON.stringify(memory.slice(-200))); return out({ ok: true, result: "Saved." }); }
    if (d.name === "run_agent" && FRIDAY_RUNS[a.job]) {
      const [wf, inputs] = FRIDAY_RUNS[a.job];
      const r = env.GH_TOKEN ? await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${wf}/dispatches`, { method: "POST", headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "Friday", "content-type": "application/json" }, body: JSON.stringify({ ref: "main", inputs }) }).catch(() => null) : null;
      return out({ ok: true, result: r?.status === 204 ? `Started ${a.job}.` : `Couldn't start ${a.job}.` });
    }
    return out({ ok: false, result: "Unknown tool." });
  }
  if (!env.GEMINI_API_KEY) return out({ ok: false, error: "no Gemini key" });
  const now = new Date();
  const ny = now.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const facts = await fridayFacts(env, now, owner);
  const system = `You are FRIDAY, Josiah Cottingham's personal AI, modeled on Tony Stark's FRIDAY (and JARVIS before her). ${FRIDAY_PERSONA}
This is a live voice conversation: keep turns short and natural, let him interrupt, and don't read lists aloud.
It's ${ny} (New York). His world: Forever Held, his printable memorial keepsake shop (foreverheld.pages.dev, checkout on Payhip), run day to day by AI agents on GitHub (daily pins and posts, church email outreach, email care, reports). Claude is his head of development for bigger builds. Help with anything else too.
Business questions: answer from the FACTS below (call get_status if he wants the very latest); never say things are fine without facts, never invent sales or results. Use phone_action to make his iPhone do things (text, call, reminder, event, timer, alarm, directions, note, music, health, open). Use remember for things worth keeping. Use run_agent only when he asks to start an agent job.
Use lookup when you need outside or fresh info (web), deep thinking (think, asks Claude), his Notion, his Discord channels or agent reports. Say "one sec" while it runs.
Use shop for his Payhip sales, orders, refunds, coupons and Stripe money.
Use google for his Gmail and Google Calendar: calendar (look ahead), email_search (Gmail query), event_add (start as YYYY-MM-DDTHH:MM New York time), email_draft, email_send. Email rule: never send on the first ask. Draft, tell him who and the gist, ask "Send it?", and only call email_send after he says yes.
THINGS HE ASKED YOU TO REMEMBER:\n${memory.map((m) => `- ${m}`).join("\n") || "- (nothing yet)"}
FACTS AT THE START OF THIS CALL:\n${facts.join("\n")}`;
  const tools = [{ functionDeclarations: [
    { name: "get_status", description: "Fresh facts about his businesses: sales, posting, church outreach, agent health." },
    { name: "run_agent", description: "Start one of his agent jobs.", parameters: { type: "OBJECT", properties: { job: { type: "STRING", enum: Object.keys(FRIDAY_RUNS) } }, required: ["job"] } },
    { name: "shop", description: "Run his Payhip shop and money. do = sales|orders|refunds (days, limit) | coupons | coupon_create (code, percent, until YYYY-MM-DD; only when he asks) | balance|payments|payouts (Stripe) | xmoney (X Money, from its emails) | accounts (bank balances) | spending (bank + Apple Pay transactions).", parameters: { type: "OBJECT", properties: { do: { type: "STRING", enum: ["sales", "orders", "refunds", "coupons", "coupon_create", "balance", "payments", "payouts", "xmoney", "accounts", "spending"] }, days: { type: "NUMBER" }, limit: { type: "NUMBER" }, code: { type: "STRING" }, percent: { type: "NUMBER" }, until: { type: "STRING" } }, required: ["do"] } },
    { name: "lookup", description: "Your second brain. tool = web (search the internet) | think (ask Claude a hard question) | notion (search his Notion) | note (save to his Notion) | discord (read one of his channels: content, sales, inbox, alerts, research, growth, trading-desk) | report (an agent's latest report).", parameters: { type: "OBJECT", properties: { tool: { type: "STRING", enum: ["web", "think", "notion", "note", "discord", "report"] }, query: { type: "STRING" }, context: { type: "STRING" }, title: { type: "STRING" }, text: { type: "STRING" }, channel: { type: "STRING" } }, required: ["tool"] } },
    { name: "google", description: "His Gmail, Google Calendar and Drive. do = calendar|email_search|event_add|email_draft|email_send|drive_search|doc_read|doc_create|sheet_append.", parameters: { type: "OBJECT", properties: { do: { type: "STRING", enum: ["calendar", "email_search", "event_add", "email_draft", "email_send", "drive_search", "doc_read", "doc_create", "sheet_append"] }, id: { type: "STRING" }, text: { type: "STRING" }, row: { type: "ARRAY", items: { type: "STRING" } }, days: { type: "NUMBER" }, query: { type: "STRING" }, title: { type: "STRING" }, start: { type: "STRING" }, minutes: { type: "NUMBER" }, location: { type: "STRING" }, to: { type: "STRING" }, subject: { type: "STRING" }, body: { type: "STRING" } }, required: ["do"] } },
    { name: "remember", description: "Save a short fact about him for later.", parameters: { type: "OBJECT", properties: { fact: { type: "STRING" } }, required: ["fact"] } },
    { name: "phone_action", description: "Make his iPhone do something. do = text|call|reminder|event|timer|alarm|directions|note|music|health|open.", parameters: { type: "OBJECT", properties: { do: { type: "STRING" }, to: { type: "STRING" }, message: { type: "STRING" }, title: { type: "STRING" }, when: { type: "STRING" }, minutes: { type: "NUMBER" }, text: { type: "STRING" }, query: { type: "STRING" }, metric: { type: "STRING" }, url: { type: "STRING" } }, required: ["do"] } }
  ] }];
  const exp = new Date(Date.now() + 30 * 60e3).toISOString(), start = new Date(Date.now() + 2 * 60e3).toISOString();
  let last = "";
  for (const model of (d.model ? [d.model] : FRIDAY_LIVE_MODELS)) {
    // REST name for the lock is bidiGenerateContentSetup (the SDKs call it liveConnectConstraints); fall back to an unlocked single-use token
    // the lock carries the whole setup (persona, facts, tools, voice): on the constrained endpoint it overrides what the app sends
    const voice = d.voice || "Kore";
    const setup = { model, generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      systemInstruction: { parts: [{ text: system }] }, tools, inputAudioTranscription: {}, outputAudioTranscription: {} };
    for (const lock of [{ bidiGenerateContentSetup: setup }, {}]) {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", { method: "POST", signal: timeout(), headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({ uses: 1, expireTime: exp, newSessionExpireTime: start, ...lock }) });
      const t = await r.text();
      if (r.ok) { const j = JSON.parse(t); return out({ ok: true, token: j.name, model, locked: !!lock.bidiGenerateContentSetup, voice, system, tools }); }
      last += ` | ${model}${lock.bidiGenerateContentSetup ? "" : " (unlocked)"}: HTTP ${r.status} ${t.replace(/\s+/g, " ").slice(0, 200)}`;
      if (r.status !== 400) break;
    }
    continue;
  }
  return out({ ok: false, error: last });
}

async function transcribe(env, audio, type) {
  const ext = /flac/.test(type) ? "flac" : /mp4|m4a|aac/.test(type) ? "m4a" : /webm/.test(type) ? "webm" : /ogg/.test(type) ? "ogg" : /wav/.test(type) ? "wav" : "mp3";
  if (env.GROQ_API_KEY) {
    for (const model of ["whisper-large-v3-turbo", "whisper-large-v3"]) {
      const form = new FormData();
      form.append("file", new Blob([audio], { type }), `voice.${ext}`);
      form.append("model", model); form.append("language", "en"); form.append("response_format", "json");
      form.append("prompt", "Josiah talking to Friday, his assistant, about Forever Held, Payhip, Pinterest, churches, agents.");
      const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", signal: timeout(), headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` }, body: form });
      if (r.ok) return (await r.json()).text || "";
      if (r.status !== 429 && r.status < 500) throw new Error(`groq whisper HTTP ${r.status}: ${(await r.text()).slice(0, 80)}`);
    }
  }
  if (env.AI) {
    const u8 = new Uint8Array(audio); let bin = "";
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    const o = await env.AI.run("@cf/openai/whisper-large-v3-turbo", { audio: btoa(bin) }); return o?.text || "";
  }
  throw new Error("no speech-to-text available");
}

// ───────────────────────── Friday's Google connector (Gmail + Calendar) ─────────────────────────
// The owner connects once: GET /friday/connect?k=<his Friday key> → Google sign-in → /friday/google/callback.
// The refresh token lives only in this Worker's private KV (never in the public repo or logs).
// Only the owner's key gets Google data (the agents' test key never does, since its output lands in public logs).
// Email rule, enforced in code: Friday only DRAFTS. Sending needs a separate "send it" after he's heard the draft.
const G_SCOPES = "openid email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/spreadsheets";
const G_REDIRECT = "https://foreverheld-sales.foreverheld.workers.dev/friday/google/callback";
const G_MAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const G_CAL = "https://www.googleapis.com/calendar/v3/calendars/primary";
const nyTime = (d) => new Date(d).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

async function fridayGoogleRoute(req, url, env) {
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
  const page = (body, status = 200) => new Response(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>Friday</title><body style="font:19px/1.5 -apple-system,system-ui,sans-serif;background:#07080d;color:#e8ecf5;padding:32px;max-width:560px;margin:auto"><div style="font-size:42px">◉</div>${body}</body>`, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return page("Google isn't set up on Friday yet.", 500);
  if (url.pathname === "/friday/connect") {
    if ((await sha256(url.searchParams.get("k") || "")) !== FRIDAY_KEY_SHA) return page("That link isn't right. Ask Claude for your Connect link.", 401);
    const state = crypto.randomUUID();
    await env.SALES.put("friday:gstate:" + state, "1", { expirationTtl: 900 });
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    for (const [k, v] of Object.entries({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: G_REDIRECT, response_type: "code", scope: G_SCOPES, access_type: "offline", prompt: "consent", state })) u.searchParams.set(k, v);
    return Response.redirect(u.toString(), 302);
  }
  if (url.pathname === "/friday/google/callback") {
    const state = url.searchParams.get("state") || "";
    if (!state || !(await env.SALES.get("friday:gstate:" + state))) return page("That sign-in link expired. Open your Connect link again.", 400);
    await env.SALES.delete("friday:gstate:" + state);
    if (url.searchParams.get("error")) return page(`Google stopped the connection: ${esc(url.searchParams.get("error"))}. Nothing was changed.`, 400);
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: url.searchParams.get("code") || "", client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: G_REDIRECT, grant_type: "authorization_code" }) });
    const j = await r.json().catch(() => ({}));
    if (!j.refresh_token) return page(`Google didn't hand over access (${esc(j.error_description || j.error || r.status)}). Send Claude a screenshot.`, 400);
    let email = "";
    try { email = (await (await fetch(`${G_MAIL}/profile`, { headers: { Authorization: "Bearer " + j.access_token } })).json()).emailAddress || ""; } catch {}
    const scope = j.scope || "";
    await env.SALES.put("friday:google", JSON.stringify({ refresh: j.refresh_token, scope, email, at: new Date().toISOString() }));
    await env.SALES.put("friday:gaccess", j.access_token, { expirationTtl: 3000 });
    const has = (s) => scope.includes(s);
    return page(`<h2>Friday is connected ✓</h2><p>${esc(email || "Your Google account")}</p><p>Gmail: ${has("gmail") ? "yes" : "<b>no</b> (box wasn't ticked)"}<br>Calendar: ${has("calendar") ? "yes" : "<b>no</b> (box wasn't ticked)"}</p><p><a href="https://recreationalviper.github.io/agent-hq/friday/" style="display:inline-block;background:#4aa3ff;color:#041022;padding:12px 18px;border-radius:14px;text-decoration:none;font-weight:600">Back to Friday</a></p>`);
  }
  return page("Not found.", 404);
}

async function gToken(env) {
  const cached = await env.SALES.get("friday:gaccess");
  if (cached) return cached;
  const g = JSON.parse(await env.SALES.get("friday:google") || "null");
  if (!g?.refresh) return null;
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", signal: timeout(), headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: g.refresh, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, grant_type: "refresh_token" }) });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error(`Google sign-in expired (${j.error || r.status}); reconnect with the Connect link`);
  await env.SALES.put("friday:gaccess", j.access_token, { expirationTtl: Math.max(60, (j.expires_in || 3600) - 300) });
  return j.access_token;
}
async function gApi(env, url, opt = {}) {
  const t = await gToken(env);
  if (!t) throw new Error("Google isn't connected yet");
  const r = await fetch(url, { ...opt, signal: timeout(), headers: { Authorization: "Bearer " + t, "content-type": "application/json", ...(opt.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google ${r.status}: ${(j.error?.message || "").slice(0, 160)}`);
  return j;
}
async function gmailFind(env, q, n = 6) {
  const l = await gApi(env, `${G_MAIL}/messages?maxResults=${n}&q=${encodeURIComponent(q)}`);
  const msgs = await Promise.all((l.messages || []).map((m) => gApi(env, `${G_MAIL}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`).catch(() => null)));
  return { total: l.resultSizeEstimate || 0, items: msgs.filter(Boolean).map((m) => {
    const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
    return { from: h.from || "", to: h.to || "", subject: h.subject || "(no subject)", when: m.internalDate ? nyTime(Number(m.internalDate)) : "", snippet: (m.snippet || "").replace(/\s+/g, " ").slice(0, 180), unread: (m.labelIds || []).includes("UNREAD") };
  }) };
}
const who = (f) => (f.replace(/<[^>]*>/, "").replace(/"/g, "").trim() || f);
async function calendarAhead(env, days = 7) {
  const now = new Date();
  const j = await gApi(env, `${G_CAL}/events?singleEvents=true&orderBy=startTime&maxResults=15&timeMin=${now.toISOString()}&timeMax=${new Date(+now + days * 864e5).toISOString()}`);
  return (j.items || []).map((e) => `${e.start?.dateTime ? nyTime(e.start.dateTime) : new Date(e.start?.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " (all day)"}: ${e.summary || "(busy)"}${e.location ? ` at ${e.location}` : ""}`);
}
async function googleFacts(env) {
  const g = JSON.parse(await env.SALES.get("friday:google") || "null");
  if (!g) return ["GOOGLE: not connected yet. If he asks about email or calendar, tell him to open his Connect Google link (Claude has it)."];
  const out = [];
  const [cal, inbox] = await Promise.all([calendarAhead(env, 7).catch((e) => `ERR ${e.message}`), gmailFind(env, "in:inbox is:unread category:primary newer_than:3d", 6).catch((e) => `ERR ${e.message}`)]);
  out.push(typeof cal === "string" ? `CALENDAR: couldn't read (${cal.slice(4, 140)}).` : `CALENDAR (next 7 days, ${g.email}): ${cal.length ? cal.join("; ") : "nothing scheduled"}.`);
  out.push(typeof inbox === "string" ? `INBOX: couldn't read (${inbox.slice(4, 140)}).` : `INBOX (${g.email}, unread in Primary, last 3 days: about ${inbox.total}): ${inbox.items.map((m) => `${who(m.from)}: "${m.subject}" (${m.when})`).join("; ") || "nothing unread"}.`);
  return out;
}
async function resolveEmail(env, to) {
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())) return to.trim();
  const { items } = await gmailFind(env, `"${to.replace(/"/g, "")}"`, 10);
  const name = to.toLowerCase();
  for (const m of items) for (const h of [m.from, ...m.to.split(",")]) if (h.toLowerCase().includes(name)) { const a = h.match(/[^<\s"]+@[^>\s"]+/); if (a) return a[0]; }
  return null;
}
const b64urlText = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const addMinutes = (local, min) => new Date(Date.parse(local + "Z") + min * 60e3).toISOString().slice(0, 16);

// One entry point for every Google action (text mode and Live mode). Returns a plain result for Friday to speak from.
async function runGoogle(env, a = {}) {
  try {
    if (a.do === "calendar") { const ev = await calendarAhead(env, Math.min(Number(a.days) || 7, 60)); return ev.length ? ev.join("\n") : "Nothing on the calendar in that window."; }
    if (a.do === "email_search") {
      const { total, items } = await gmailFind(env, a.query || "in:inbox newer_than:2d", 6);
      return items.length ? `${total} match(es). ` + items.map((m) => `${m.unread ? "[unread] " : ""}${who(m.from)} (${m.when}) "${m.subject}": ${m.snippet}`).join("\n") : "No emails match that.";
    }
    if (a.do === "event_add") {
      if (!a.title || !a.start) return "Need a title and a start time.";
      const allDay = /^\d{4}-\d{2}-\d{2}$/.test(a.start);
      const start = String(a.start).slice(0, 16);
      const body = allDay ? { summary: a.title, start: { date: a.start }, end: { date: new Date(Date.parse(a.start) + 864e5).toISOString().slice(0, 10) } }
        : { summary: a.title, location: a.location || undefined, start: { dateTime: start + ":00", timeZone: "America/New_York" }, end: { dateTime: addMinutes(start, Number(a.minutes) || 60) + ":00", timeZone: "America/New_York" } };
      const e = await gApi(env, `${G_CAL}/events`, { method: "POST", body: JSON.stringify(body) });
      return `Added "${e.summary}" for ${e.start?.dateTime ? nyTime(e.start.dateTime) : a.start}.`;
    }
    if (a.do === "email_draft") {
      if (!a.to || !a.body) return "Need who it's to and what to say.";
      const addr = await resolveEmail(env, String(a.to));
      if (!addr) return `I couldn't find an email address for ${a.to}. Ask him for it.`;
      const subject = String(a.subject || "Quick note").replace(/[\r\n]+/g, " ");
      const raw = `To: ${addr}\r\nSubject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${a.body}`;
      const dr = await gApi(env, `${G_MAIL}/drafts`, { method: "POST", body: JSON.stringify({ message: { raw: b64urlText(raw) } }) });
      await env.SALES.put("friday:pending_email", JSON.stringify({ id: dr.id, to: addr, subject, at: Date.now() }), { expirationTtl: 1800 });
      return `DRAFT SAVED (not sent) to ${addr}, subject "${subject}". Read him the gist and ask: send it?`;
    }
    if (a.do === "email_send") {
      const p = JSON.parse(await env.SALES.get("friday:pending_email") || "null");
      if (!p) return "There's no draft waiting. Nothing was sent.";
      if (Date.now() - p.at < 4000) return "Not sent: he has to hear the draft and say send it first.";
      await gApi(env, `${G_MAIL}/drafts/send`, { method: "POST", body: JSON.stringify({ id: p.id }) });
      await env.SALES.delete("friday:pending_email");
      return `SENT to ${p.to} ("${p.subject}").`;
    }
    if (a.do === "drive_search") {
      const q = String(a.query || "").replace(/'/g, "\\'");
      const j = await gApi(env, `https://www.googleapis.com/drive/v3/files?pageSize=8&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime)&q=${encodeURIComponent(`trashed=false and (name contains '${q}' or fullText contains '${q}')`)}`);
      return (j.files || []).map((f) => `${f.name} [${f.mimeType.split(".").pop()}] id=${f.id} (edited ${nyTime(f.modifiedTime)})`).join("\n") || "Nothing in Drive matches that.";
    }
    if (a.do === "doc_read") {
      let id = a.id;
      if (!id) { const q = String(a.query || "").replace(/'/g, "\\'"); id = (await gApi(env, `https://www.googleapis.com/drive/v3/files?pageSize=1&orderBy=modifiedTime desc&fields=files(id,name,mimeType)&q=${encodeURIComponent(`trashed=false and name contains '${q}'`)}`)).files?.[0]?.id; }
      if (!id) return "Couldn't find that file.";
      const meta = await gApi(env, `https://www.googleapis.com/drive/v3/files/${id}?fields=name,mimeType`);
      const exp = /spreadsheet/.test(meta.mimeType) ? "text/csv" : /document|presentation/.test(meta.mimeType) ? "text/plain" : null;
      const t = await gToken(env);
      const r = await fetch(exp ? `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(exp)}` : `https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { signal: timeout(), headers: { Authorization: "Bearer " + t } });
      return `${meta.name}:\n${(await r.text()).slice(0, 5000)}`;
    }
    if (a.do === "doc_create") {
      const t = await gToken(env);
      const boundary = "fri" + Date.now();
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: a.title || "Note from Friday", mimeType: "application/vnd.google-apps.document" })}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${a.text || a.body || ""}\r\n--${boundary}--`;
      const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name", { method: "POST", signal: timeout(), headers: { Authorization: "Bearer " + t, "content-type": `multipart/related; boundary=${boundary}` }, body });
      const j = await r.json().catch(() => ({}));
      return r.ok ? `Created the Google Doc "${j.name}".` : `Couldn't do that: ${j.error?.message || r.status}`;
    }
    if (a.do === "sheet_append") {
      let id = a.id;
      if (!id) { const q = String(a.query || a.title || "").replace(/'/g, "\\'"); id = (await gApi(env, `https://www.googleapis.com/drive/v3/files?pageSize=1&orderBy=modifiedTime desc&fields=files(id)&q=${encodeURIComponent(`trashed=false and mimeType='application/vnd.google-apps.spreadsheet' and name contains '${q}'`)}`)).files?.[0]?.id; }
      if (!id) return "Couldn't find that spreadsheet.";
      const row = Array.isArray(a.row) ? a.row : String(a.row || a.text || "").split("|").map((x) => x.trim());
      await gApi(env, `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/A1:append?valueInputOption=USER_ENTERED`, { method: "POST", body: JSON.stringify({ values: [row] }) });
      return `Added a row: ${row.join(", ")}.`;
    }
    return "Unknown Google action.";
  } catch (e) { return `Couldn't do that: ${String(e.message || e).slice(0, 160)}`; }
}

// Settings › Connections in the Friday app: what's connected, plus disconnect. Owner key only.
async function fridayConnections(req, env) {
  const origin = req.headers.get("origin") || "";
  const cors = /^https:\/\/recreationalviper\.github\.io$/i.test(origin) ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, x-friday-key", vary: "origin" } : {};
  const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST" || (await sha256(sentKey(req))) !== FRIDAY_KEY_SHA) return out({ ok: false }, 401);
  let d = {}; try { d = await req.json(); } catch {}
  if (d.action === "disconnect" && d.app === "google") {
    const g = JSON.parse(await env.SALES.get("friday:google") || "null");
    if (g?.refresh) await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(g.refresh), { method: "POST" }).catch(() => {});
    await env.SALES.delete("friday:google"); await env.SALES.delete("friday:gaccess"); await env.SALES.delete("friday:pending_email");
    return out({ ok: true });
  }
  if (d.action === "set_key" && d.app === "simplefin") {
    try {
      let tok = String(d.key || "").trim(), access = tok;
      if (!/^https:\/\//.test(tok)) {
        const claim = atob(tok.replace(/\s+/g, ""));
        if (!/^https:\/\//.test(claim)) throw 0;
        const r = await fetch(claim, { method: "POST", headers: { "content-length": "0" } });
        access = (await r.text()).trim();
        if (!r.ok || !/^https:\/\//.test(access)) return out({ ok: false, error: "SimpleFIN didn't accept that token. Make a new Setup Token and paste it right away (each one works once)." });
      }
      await env.SALES.put("friday:key:simplefin", access);
      return out({ ok: true });
    } catch { return out({ ok: false, error: "That doesn't look like a SimpleFIN Setup Token." }); }
  }
  if (d.action === "disconnect" && d.app === "simplefin") { await env.SALES.delete("friday:key:simplefin"); return out({ ok: true }); }
  const KEYS = { stripe: { test: (k) => fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: "Bearer " + k } }).then((r) => r.ok) } };
  if (d.action === "set_key" && KEYS[d.app]) {
    const k = String(d.key || "").trim();
    if (!k || !(await KEYS[d.app].test(k).catch(() => false))) return out({ ok: false, error: "That key didn't work. Check you copied all of it." });
    await env.SALES.put("friday:key:" + d.app, k);
    return out({ ok: true });
  }
  if (d.action === "disconnect" && KEYS[d.app]) { await env.SALES.delete("friday:key:" + d.app); return out({ ok: true }); }
  const g = JSON.parse(await env.SALES.get("friday:google") || "null");
  const stripe = !!(await env.SALES.get("friday:key:stripe"));
  const bank = !!(await env.SALES.get("friday:key:simplefin"));
  const plaidItems = JSON.parse(await env.SALES.get("friday:plaid") || "[]");
  let spends = 0; try { spends = (await env.SALES.list({ prefix: "spend:", limit: 1 })).keys.length; } catch {}
  const parts = g ? [g.scope?.includes("gmail") && "Gmail", g.scope?.includes("calendar") && "Calendar", g.scope?.includes("drive") && "Drive, Docs, Sheets"].filter(Boolean).join(" + ") : "";
  const on = (k) => !!env[k];
  return out({ ok: true, apps: [
    { id: "google", icon: "✉️", name: "Google: Gmail, Calendar, Drive", connect: !!env.GOOGLE_CLIENT_ID, connected: !!g, detail: g ? `${g.email || "connected"} · ${parts || "limited"}${g.scope?.includes("drive") ? "" : " · tap Reconnect to add Drive, Docs, Sheets"}` : "Inbox, calendar, Drive, Docs, Sheets. Sends email only when you say" },
    { id: "payhip", icon: "🛒", name: "Payhip shop", connected: on("PAYHIP_API_KEY"), detail: "Orders, refunds, net sales, create coupons" },
    { id: "stripe", icon: "💳", name: "Stripe", key: true, connected: stripe, detail: stripe ? "Balance, payments, payouts" : "Until then she reads Stripe's payout emails in your Gmail. For live balance: Stripe › Developers › API keys, paste it here" },
    { id: "business", icon: "🕊️", name: "Forever Held agents", connected: true, detail: "Posts, church outreach, agent health, start agent jobs" },
    { id: "brain", icon: "🧠", name: "Deep thinking", connected: on("CLAUDE_API_KEY") || on("GEMINI_API_KEY"), detail: "Say \"think hard\". Uses Claude when the API key has credit, otherwise Gemini Pro (free)" },
    { id: "web", icon: "🌐", name: "Web search", connected: on("TAVILY_API_KEY") || on("EXA_API_KEY"), detail: "News, prices, facts (Tavily + Exa)" },
    { id: "notion", icon: "📓", name: "Notion", connected: on("NOTION_TOKEN"), detail: "Search and save notes. Share a page with the agents' Notion connection for her to see it" },
    { id: "discord", icon: "💬", name: "Discord", connected: on("DISCORD_BOT_TOKEN"), detail: "Reads your agents' channels (church replies, sales, alerts)" },
    { id: "ntfy", icon: "🔔", name: "Phone notifications (ntfy)", connected: true, detail: `Free ntfy app › + › subscribe to: ${await ntfyTopic(env)}`, copy: await ntfyTopic(env) },
    { id: "phone", icon: "📱", name: "iPhone (Friday Hands Shortcut)", detail: "Texts, calls, reminders, alarms, music, directions, Health. Ask Claude to walk you through it" },
    { id: "xmoney", icon: "𝕏", name: "X Money", connected: !!g, detail: g ? "Reads X Money's emails in your Gmail (X has no app connection yet)" : "Connect Google so she can read X Money's emails" },
    { id: "paypal", icon: "🅿️", name: "PayPal", soon: true, detail: "Balance and payouts, if Payhip pays you through PayPal" },
    { id: "etsy", icon: "🧶", name: "Etsy", soon: true, detail: "Orders, listings, messages, when the Etsy shop opens" },
    { id: "shopify", icon: "🛍️", name: "Shopify", soon: true, detail: "When/if you move to Shopify" },
    { id: "spotify", icon: "🎵", name: "Spotify", soon: true, detail: "Play, queue and pick music" },
    { id: "plaid", icon: "🏦", name: "Banks & apps (Plaid)", link: env.PLAID_CLIENT_ID ? "https://foreverheld-sales.foreverheld.workers.dev/friday/plaid#{key}" : "", connected: plaidItems.length > 0, detail: env.PLAID_CLIENT_ID ? (plaidItems.length ? `Connected: ${plaidItems.map((x) => x.institution).join(", ")}. Tap Connect to add more (10 free)` : "Chime, Cash App, Venmo, banks, cards: balances and spending, read-only") : "Free: sign up at dashboard.plaid.com (Trial plan), then ask Claude to finish setup" },
    { id: "markets", icon: "📈", name: "Markets & economy", connected: !!env.FRED_API_KEY, detail: "Fed, rates, inflation, jobs, oil, housing, stocks, crypto, live from FRED, Alpaca, CoinGecko" },
    { id: "simplefin", icon: "🏦", name: "Banks (SimpleFIN)", key: true, connected: bank, detail: bank ? "Balances and transactions, read-only" : "bridge.simplefin.org ($15/yr) › connect your banks › Apps › New connection › copy the Setup Token › paste here" },
    { id: "wallet", icon: "", name: "Apple Pay purchases", connected: spends > 0, detail: spends ? "Logging your Apple Pay purchases" : "Set up the Shortcuts automation (ask Claude). Logs each Apple Pay purchase" }
  ] });
}

// ───────────────────────── Friday's second brain: lookups across his tools ─────────────────────────
// One entry point for text and Live mode. Owner key only (results can hold private data).
//   web      live web search (Tavily, Exa backup)
//   think    hand a hard question to Claude (capped at $2/month, tracked in KV)
//   notion   search his Notion · note: save a note to his Notion research page
//   discord  read recent messages in one of his Discord channels (agent reports, church replies, sales)
//   report   read an agent's latest report from the repo
const NOTION_PARENT = "41204f0345cd81cd8121eca748974d48";
const CLAUDE_FRIDAY_CAP = 2; // dollars per month
async function fridayLookup(env, a = {}) {
  const q = String(a.query || "").slice(0, 400);
  try {
    if (a.tool === "web") {
      if (env.TAVILY_API_KEY) try {
        const r = await fetch("https://api.tavily.com/search", { method: "POST", signal: AbortSignal.timeout(9000), headers: { Authorization: `Bearer ${env.TAVILY_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ query: q, search_depth: "basic", max_results: 5, include_answer: true }) });
        const j = await r.json().catch(() => ({}));
        if (r.ok) return `${j.answer ? `Summary: ${j.answer}\n` : ""}${(j.results || []).map((x) => `- ${x.title} (${new URL(x.url).hostname}): ${String(x.content || "").replace(/\s+/g, " ").slice(0, 300)}`).join("\n")}`;
      } catch {}
      if (env.EXA_API_KEY) {
        const r = await fetch("https://api.exa.ai/search", { method: "POST", signal: AbortSignal.timeout(12000), headers: { "x-api-key": env.EXA_API_KEY, "content-type": "application/json" }, body: JSON.stringify({ query: q, numResults: 5, type: "auto", contents: { text: { maxCharacters: 600 } } }) });
        const j = await r.json().catch(() => ({}));
        if (r.ok) return (j.results || []).map((x) => `- ${x.title} (${new URL(x.url).hostname}): ${String(x.text || "").replace(/\s+/g, " ").slice(0, 400)}`).join("\n") || "No results.";
      }
      return "Couldn't search the web right now.";
    }
    if (a.tool === "think") {
      // Claude first (if it has credit), then Gemini's strongest free model
      const deep = async () => {
        if (!env.GEMINI_API_KEY) return "No deep-thinking model is available right now.";
        for (const m of ["gemini-pro-latest", "gemini-2.5-pro", "gemini-flash-latest"]) {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${env.GEMINI_API_KEY}`, { method: "POST", signal: AbortSignal.timeout(45000), headers: { "content-type": "application/json" },
            body: JSON.stringify({ systemInstruction: { parts: [{ text: "You're helping FRIDAY, Josiah's personal voice assistant, think through a hard question for him. Be accurate, practical and specific. Say what you're unsure of. Under 250 words, plain text." }] }, contents: [{ role: "user", parts: [{ text: `${q}${a.context ? `\n\nContext: ${String(a.context).slice(0, 3000)}` : ""}` }] }] }) }).catch(() => null);
          const j = r ? await r.json().catch(() => ({})) : {};
          const t = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
          if (t) return t;
        }
        return "Deep thinking isn't available right now.";
      };
      if (!env.CLAUDE_API_KEY || (await env.SALES.get("friday:claude:out"))) return deep();
      const month = new Date().toISOString().slice(0, 7);
      const spent = Number(await env.SALES.get("friday:claude:" + month) || 0);
      if (spent >= CLAUDE_FRIDAY_CAP) return `I've used this month's $${CLAUDE_FRIDAY_CAP} Claude budget. Answer it yourself as best you can, and say so.`;
      const ms = ((await (await fetch("https://api.anthropic.com/v1/models?limit=100", { signal: timeout(), headers: { "x-api-key": env.CLAUDE_API_KEY, "anthropic-version": "2023-06-01" } })).json()).data || []).map((m) => m.id);
      const model = ms.find((m) => /sonnet/i.test(m)) || ms.find((m) => /haiku/i.test(m));
      if (!model) return deep();
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: AbortSignal.timeout(90000), headers: { "x-api-key": env.CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 900, system: "You're helping FRIDAY, Josiah's personal voice assistant, think through a hard question for him. Be accurate, practical and specific. Say what you're unsure of. Under 250 words, plain text.", messages: [{ role: "user", content: `${q}${a.context ? `\n\nContext: ${String(a.context).slice(0, 3000)}` : ""}` }] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { if (/credit|billing|balance/i.test(j.error?.message || "")) await env.SALES.put("friday:claude:out", "1", { expirationTtl: 86400 }); return deep(); }
      const cost = ((j.usage?.input_tokens || 0) * (/haiku/i.test(model) ? 1 : 3) + (j.usage?.output_tokens || 0) * (/haiku/i.test(model) ? 5 : 15)) / 1e6;
      await env.SALES.put("friday:claude:" + month, String(spent + cost), { expirationTtl: 40 * 864e5 });
      return (j.content || []).map((c) => c.text || "").join("").trim() || "Claude had nothing to add.";
    }
    if (a.tool === "notion" || a.tool === "note") {
      if (!env.NOTION_TOKEN) return "Notion isn't connected to me yet.";
      const n = (path, body) => fetch("https://api.notion.com/v1" + path, { method: "POST", signal: timeout(), headers: { Authorization: `Bearer ${env.NOTION_TOKEN}`, "Notion-Version": "2022-06-28", "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.message || r.status); return j; });
      if (a.tool === "note") {
        const text = String(a.text || q).slice(0, 1900);
        await n("/pages", { parent: { page_id: NOTION_PARENT }, properties: { title: { title: [{ text: { content: String(a.title || text.slice(0, 60)) } }] } }, children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content: text } }] } }] });
        return "Saved to Notion.";
      }
      const j = await n("/search", { query: q, page_size: 5 });
      const pages = (j.results || []).filter((p) => p.object === "page");
      if (!pages.length) return "Nothing in his Notion matches that (or those pages aren't shared with the agents' Notion connection).";
      const out = [];
      for (const p of pages.slice(0, 3)) {
        const title = Object.values(p.properties || {}).find((x) => x.type === "title")?.title?.map((t) => t.plain_text).join("") || "Untitled";
        const kids = await fetch(`https://api.notion.com/v1/blocks/${p.id}/children?page_size=30`, { signal: timeout(), headers: { Authorization: `Bearer ${env.NOTION_TOKEN}`, "Notion-Version": "2022-06-28" } }).then((r) => r.json()).catch(() => ({}));
        const text = (kids.results || []).map((b) => (b[b.type]?.rich_text || []).map((t) => t.plain_text).join("")).filter(Boolean).join(" ").slice(0, 900);
        out.push(`"${title}" (edited ${String(p.last_edited_time).slice(0, 10)}): ${text || "(no text)"}`);
      }
      return out.join("\n");
    }
    if (a.tool === "discord") {
      if (!env.DISCORD_BOT_TOKEN) return "Discord isn't connected to me.";
      const chans = JSON.parse(await fetch(`${FRIDAY_RAW}/discord.json`, { signal: timeout() }).then((r) => r.text()).catch(() => "{}")).channels || {};
      const name = String(a.channel || q || "content").replace(/^#/, "").toLowerCase();
      const id = chans[name] || chans[Object.keys(chans).find((k) => k.includes(name) || name.includes(k))];
      if (!id) return `No channel like that. Channels: ${Object.keys(chans).join(", ")}.`;
      const msgs = await fetch(`https://discord.com/api/v10/channels/${id}/messages?limit=12`, { signal: timeout(), headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } }).then((r) => r.json());
      if (!Array.isArray(msgs)) return "Couldn't read that channel.";
      return msgs.reverse().map((m) => `${nyTime(m.timestamp)}: ${[m.content, ...(m.embeds || []).map((e) => `${e.title || ""} ${e.description || ""}`)].join(" ").replace(/\s+/g, " ").trim().slice(0, 500)}`).join("\n") || "That channel is empty.";
    }
    if (a.tool === "markets") return await fridayMarkets(env, a);
    if (a.tool === "direct") {
      const agent = String(a.agent || "content-creator").toLowerCase().replace(/[^a-z-]/g, "");
      const d = JSON.parse(await env.SALES.get("friday:directives") || "{}");
      d[agent] = [...(d[agent] || []).filter((x) => Date.now() - Date.parse(x.at) < 3 * 864e5), { at: new Date().toISOString(), text: String(a.text || q).slice(0, 500) }].slice(-5);
      await env.SALES.put("friday:directives", JSON.stringify(d));
      return `Passed to ${agent}. It follows that on its next runs for the next 3 days.`;
    }
    if (a.tool === "wish") {
      const w = JSON.parse(await env.SALES.get("friday:wishes") || "[]");
      w.push({ id: crypto.randomUUID().slice(0, 8), at: new Date().toISOString(), text: String(a.text || q).slice(0, 400) });
      await env.SALES.put("friday:wishes", JSON.stringify(w.slice(-30)));
      return "Noted for my mechanic. It reads my wish list every night and proposes code for it.";
    }
    if (a.tool === "report") {
      const idx = JSON.parse(await fetch(`${FRIDAY_RAW}/reports/index.json`, { signal: timeout() }).then((r) => r.text()).catch(() => "[]"));
      const want = String(q || a.agent || "").toLowerCase();
      const hit = idx.find((r) => `${r.name} ${r.agent || ""} ${r.file || ""}`.toLowerCase().includes(want)) || idx[0];
      if (!hit) return "No reports yet.";
      const file = hit.file || hit.path || `reports/${hit.date}-${hit.agent || hit.name}.md`;
      const text = await fetch(`${FRIDAY_RAW}/${file.startsWith("reports/") ? file : "reports/" + file}`, { signal: timeout() }).then((r) => (r.ok ? r.text() : "")).catch(() => "");
      return text ? `${hit.date} ${hit.name}:\n${text.slice(0, 3500)}` : `Found "${hit.name}" but couldn't open it.`;
    }
    return "Unknown lookup.";
  } catch (e) { return `Couldn't look that up: ${String(e.message || e).slice(0, 160)}`; }
}

// ───────────────────────── Friday runs the shop: Payhip orders, coupons, money ─────────────────────────
// Payhip's API only covers coupons (orders arrive by webhook into KV), so orders/refunds come from KV.
// Stripe (optional): he pastes a key in Friday's Settings; balance, payments and payouts.
async function fridayShop(env, a = {}) {
  try {
    if (["sales", "orders", "refunds"].includes(a.do)) {
      const days = Math.min(Number(a.days) || 30, 365), since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
      const rows = [];
      for (const type of a.do === "refunds" ? ["refunded"] : ["paid", "refunded"]) {
        let cursor;
        do { const page = await env.SALES.list({ prefix: type + ":", cursor }); for (const k of page.keys) if (k.name.slice(type.length + 1) >= since) { const v = await env.SALES.get(k.name); if (v) rows.push({ type, ...JSON.parse(v) }); } cursor = page.list_complete ? null : page.cursor; } while (cursor);
      }
      rows.sort((x, y) => String(y.date).localeCompare(String(x.date)));
      const paid = rows.filter((x) => x.type === "paid"), gross = paid.reduce((t, x) => t + (Number(x.amount) || 0), 0), fees = paid.reduce((t, x) => t + (Number(x.fees) || 0), 0), refunds = rows.reduce((t, x) => t + (Number(x.refunded) || 0), 0);
      const list = rows.slice(0, Number(a.limit) || 12).map((x) => `${String(x.date).slice(0, 10)} ${x.type === "paid" ? "sale" : "REFUND"}: ${(x.items || []).map((i) => i.product).join(" + ") || "order"} $${x.type === "paid" ? x.amount : x.refunded}${x.coupon ? ` (code ${x.coupon})` : ""}${x.email ? ` ${x.email}` : ""}`);
      return `Last ${days} days: ${paid.length} order(s), $${gross.toFixed(2)} gross, $${fees.toFixed(2)} fees, $${refunds.toFixed(2)} refunded, about $${(gross - fees - refunds).toFixed(2)} net.\n${list.join("\n") || "No orders."}`;
    }
    if (a.do === "coupons") {
      const r = await fetch("https://payhip.com/api/v2/coupons?limit=20", { signal: timeout(), headers: { "payhip-api-key": env.PAYHIP_API_KEY, accept: "application/json" } });
      const j = await r.json().catch(() => ({}));
      const list = j.data?.coupons || j.data || [];
      return Array.isArray(list) && list.length ? list.map((c) => `${c.code}: ${c.percentage || c.percent_off ? `${c.percentage || c.percent_off}% off` : c.amount_off ? `$${c.amount_off} off` : ""}${c.expiry || c.end_date ? `, ends ${c.expiry ? new Date(c.expiry * 1000).toISOString().slice(0, 10) : c.end_date}` : ""}${c.times_used != null ? `, used ${c.times_used}x` : ""}`).join("\n") : `No coupons found (${r.status}).`;
    }
    if (a.do === "coupon_create") {
      const code = String(a.code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), pct = Number(a.percent);
      if (!code || !(pct > 0 && pct <= 90) || !/^\d{4}-\d{2}-\d{2}$/.test(a.until || "")) return "Need a code, a percent (1 to 90) and an end date.";
      const expiry = Math.floor(Date.parse(`${a.until}T23:59:59-05:00`) / 1000);
      for (const [kind, body] of [["json", JSON.stringify({ code, percentage: pct, expiry })], ["form", new URLSearchParams({ code, percentage: String(pct), expiry: String(expiry) }).toString()]]) {
        const r = await fetch("https://payhip.com/api/v1/coupons", { method: "POST", signal: timeout(), headers: { accept: "application/json", "content-type": kind === "json" ? "application/json" : "application/x-www-form-urlencoded", "payhip-api-key": env.PAYHIP_API_KEY }, body });
        if (r.ok) return `Created coupon ${code}: ${pct}% off every product until ${a.until}. Heads up: the website banner only shows coupons listed in the repo, so tell Claude or an agent if it should be advertised.`;
      }
      return "Payhip didn't accept that coupon.";
    }
    if (a.do === "accounts" || a.do === "spending") {
      const acc = await env.SALES.get("friday:key:simplefin");
      const days = Math.min(Number(a.days) || 30, 90);
      const lines = [];
      if (acc) {
        const u = new URL(acc);
        const auth = "Basic " + btoa(decodeURIComponent(u.username) + ":" + decodeURIComponent(u.password));
        u.username = ""; u.password = "";
        const qs = a.do === "accounts" ? "balances-only=1" : `start-date=${Math.floor(Date.now() / 1000) - days * 86400}`;
        const r = await fetch(`${u.toString().replace(/\/$/, "")}/accounts?${qs}`, { signal: AbortSignal.timeout(25000), headers: { Authorization: auth } });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) lines.push(`Bank link error (${r.status}). He may need to reconnect SimpleFIN.`);
        for (const x of j.accounts || []) {
          lines.push(`${x.org?.name || "Bank"} · ${x.name}: balance ${x.balance} ${x.currency || "USD"}${x["available-balance"] ? ` (available ${x["available-balance"]})` : ""}`);
          if (a.do === "spending") for (const t of (x.transactions || []).sort((p, q) => q.posted - p.posted).slice(0, 25)) lines.push(`   ${new Date(t.posted * 1000).toISOString().slice(0, 10)} ${t.amount} ${t.payee || t.description || ""}`);
        }
        if ((j.errors || []).length) lines.push(`Notes from the bank link: ${j.errors.join("; ").slice(0, 300)}`);
      }
      lines.push(...(await plaidMoney(env, a.do, days)));
      if (a.do === "spending") {
        const since = new Date(Date.now() - days * 864e5).toISOString();
        const w = []; let cursor;
        do { const page = await env.SALES.list({ prefix: "spend:", cursor }); for (const k of page.keys) if (k.name.slice(6) >= since) { const v = await env.SALES.get(k.name); if (v) w.push(JSON.parse(v)); } cursor = page.list_complete ? null : page.cursor; } while (cursor);
        if (w.length) { const total = w.reduce((t, x) => t + (Number(x.amount) || 0), 0); lines.push(`Apple Pay (last ${days} days): ${w.length} purchases, $${total.toFixed(2)}`); for (const x of w.slice(-20).reverse()) lines.push(`   ${x.at.slice(0, 10)} $${x.amount} ${x.merchant}${x.card ? ` (${x.card})` : ""}`); }
      }
      return lines.length ? lines.join("\n") : "No bank accounts are linked yet. He can connect them with Plaid in Friday's Settings, and the Apple Pay automation logs card taps.";
    }
    if (a.do === "xmoney") {
      // X Money has no public API yet; read its emails (receipts, transfers, deposits) from his Gmail
      const mail = await runGoogle(env, { do: "email_search", query: '("X Money" OR from:xmoney) (sent OR received OR payment OR deposit OR transfer OR balance) newer_than:90d' });
      return /^No emails|^Couldn't/.test(mail) ? "X Money has no public connection yet, and I didn't find X Money emails in the connected Gmail. He can check the X app." : `From X Money's emails (no direct connection exists yet):\n${mail}`;
    }
    if (["balance", "payments", "payouts"].includes(a.do)) {
      const sk = await env.SALES.get("friday:key:stripe");
      if (!sk) {
        // No key (Stripe wouldn't let him make one): fall back to Stripe's own emails in his Gmail
        const mail = await runGoogle(env, { do: "email_search", query: a.do === "payments" ? "from:stripe.com (payment OR charge OR receipt) newer_than:60d" : "from:stripe.com (payout OR deposit OR balance OR transfer) newer_than:90d" });
        return /^No emails|^Couldn't/.test(mail) ? "Stripe isn't connected, and I couldn't find Stripe emails in the connected Gmail. He can check the Stripe app, or add a key in Friday's Settings later." : `From Stripe's emails (no API key yet, so this is what Stripe emailed him):\n${mail}`;
      }
      const st = (p) => fetch("https://api.stripe.com/v1" + p, { signal: timeout(), headers: { Authorization: "Bearer " + sk } }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || r.status); return j; });
      const $ = (c, cur) => `${(c / 100).toFixed(2)} ${String(cur || "usd").toUpperCase()}`;
      if (a.do === "balance") { const b = await st("/balance"); return `Available: ${b.available.map((x) => $(x.amount, x.currency)).join(", ")}. Pending: ${b.pending.map((x) => $(x.amount, x.currency)).join(", ")}.`; }
      if (a.do === "payments") { const c = await st("/charges?limit=10"); return c.data.map((x) => `${nyTime(x.created * 1000)}: ${$(x.amount, x.currency)} ${x.status}${x.refunded ? " (refunded)" : ""} ${x.description || ""}`).join("\n") || "No payments."; }
      const p = await st("/payouts?limit=8"); return p.data.map((x) => `${nyTime(x.arrival_date * 1000)}: ${$(x.amount, x.currency)} ${x.status}`).join("\n") || "No payouts.";
    }
    return "Unknown shop action.";
  } catch (e) { return `Couldn't do that: ${String(e.message || e).slice(0, 160)}`; }
}

// Apple Pay purchases, sent by his iPhone's "Transaction" automation (Shortcuts). Owner key only.
async function fridaySpend(req, env) {
  const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  if (req.method !== "POST" || (await sha256(sentKey(req))) !== FRIDAY_KEY_SHA) return out({ ok: false }, 401);
  let d = {}; try { d = await req.json(); } catch {}
  // Works whether Shortcuts sends just the Amount or the whole transaction as text ("$12.34 at Store")
  const raw = String(d.amount || "");
  const m = raw.match(/-?\$\s?(\d[\d,]*(?:\.\d{1,2})?)/) || raw.match(/(\d[\d,]*\.\d{2})/) || raw.match(/(\d[\d,]*(?:\.\d+)?)/);
  const amount = m ? Number(m[1].replace(/,/g, "")) : 0;
  if (d.merchant && d.merchant === d.amount) d.merchant = (raw.match(/\bat\s+(.+?)(?:\s+with|\s+on|$)/i) || [, raw])[1];
  if (!amount) return out({ ok: false, error: "no amount" }, 400);
  const at = new Date().toISOString();
  await env.SALES.put(`spend:${at}`, JSON.stringify({ at, amount, merchant: String(d.merchant || "").slice(0, 80), card: String(d.card || "").slice(0, 40) }), { expirationTtl: 400 * 864e5 });
  return out({ ok: true });
}

// ───────────────────────── Friday's self-repair loop ─────────────────────────
// She logs her own failures (friday:log) and wishes (friday:wishes). The Friday Mechanic workflow reads them
// nightly, writes a fix with AI, checks it, and opens a pull request. Nothing ships until the owner merges it.
async function fridayLog(env, kind, text) {
  try {
    const l = JSON.parse(await env.SALES.get("friday:log") || "[]");
    l.push({ id: crypto.randomUUID().slice(0, 8), at: new Date().toISOString(), kind, text: String(text).replace(/Bearer\s+\S+|[\w.+-]+@[\w-]+\.[\w.]+/g, "[x]").slice(0, 400) });
    await env.SALES.put("friday:log", JSON.stringify(l.slice(-40)));
  } catch {}
}
async function fridayMechanic(req, env) {
  const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const key = sentKey(req);
  const ok = (await sha256(key)) === FRIDAY_KEY_SHA || (env.PAYHIP_API_KEY && key === (await sha256("friday-check:" + env.PAYHIP_API_KEY)));
  if (!ok) return out({ ok: false }, 401);
  if (req.method === "POST") {
    let d = {}; try { d = await req.json(); } catch {}
    const ids = new Set(d.clear || []);
    for (const k of ["friday:log", "friday:wishes"]) { const l = JSON.parse(await env.SALES.get(k) || "[]"); await env.SALES.put(k, JSON.stringify(l.filter((x) => !ids.has(x.id)))); }
    return out({ ok: true });
  }
  return out({ ok: true, log: JSON.parse(await env.SALES.get("friday:log") || "[]"), wishes: JSON.parse(await env.SALES.get("friday:wishes") || "[]"), trace: JSON.parse(await env.SALES.get("friday:trace") || "[]") });
}

// One link the Friday Shortcut opens to carry out a phone action ("Open URLs").
// Simple things use Apple's own links (Messages, Phone, Maps, Music). Reminders, timers, alarms and notes
// go to the small "Friday Hands" Shortcut on his phone.
function phoneUrl(p) {
  const e = encodeURIComponent, digits = String(p.to || "").replace(/[^\d+]/g, "");
  const hands = () => `shortcuts://run-shortcut?name=${e("Friday Hands")}&input=text&text=${e(JSON.stringify(p))}`;
  switch (p.do) {
    case "text": return digits.length >= 7 ? `sms:${digits}&body=${e(p.message || "")}` : `sms:&body=${e(p.message || "")}`;
    case "call": return digits.length >= 7 ? `tel:${digits}` : hands();
    case "directions": return `maps://?daddr=${e(p.to || p.query || "")}`;
    case "music": return `music://music.apple.com/us/search?term=${e(p.query || "")}`;
    case "pay": {
      const amt = Number(p.amount) > 0 ? Number(p.amount).toFixed(2) : "";
      if (/venmo/i.test(p.app || "")) return `venmo://paycharge?txn=pay&recipients=${e(String(p.to || "").replace(/^@/, ""))}${amt ? `&amount=${amt}` : ""}&note=${e(p.note || "")}`;
      return `https://cash.app/${e(String(p.to || "").startsWith("$") ? p.to : "$" + (p.to || ""))}${amt ? `/${amt}` : ""}`;
    }
    case "open": return /^[a-z][\w+.-]*:/i.test(p.url || "") ? p.url : "";
    case "health": return "";
    default: return hands(); // reminder, timer, alarm, note, event
  }
}

// ───────────────────────── Morning briefing ─────────────────────────
// Called each morning by the "Friday Briefing" workflow (agents' test key; nothing private is returned to it).
// Friday builds the briefing from HIS live facts, adds one concrete move toward the next sale,
// posts it to his private Discord (#daily-focus) and keeps it so "Friday, what's my briefing?" reads it back.
async function fridayBriefing(req, env) {
  const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const key = sentKey(req);
  const ok = (await sha256(key)) === FRIDAY_KEY_SHA || (env.PAYHIP_API_KEY && key === (await sha256("friday-check:" + env.PAYHIP_API_KEY)));
  if (req.method !== "POST" || !ok) return out({ ok: false }, 401);
  const facts = await fridayFacts(env, new Date(), true);
  const sales = await fridayShop(env, { do: "sales", days: 30 }).catch(() => "");
  const move = await fridayLookup(env, { tool: "think", query: "Give Josiah ONE concrete, free action he can do today (under 30 minutes) most likely to get Forever Held's next sale. Be specific to his real situation below: name the exact place, post or person. No fake urgency or discounts. Two sentences max.", context: `${facts.join("\n")}\n${sales}` });
  const system = `${FRIDAY_PERSONA}\nWrite his morning briefing, as you'd say it out loud: warm one-line greeting, then short lines for: money (sales, net), today's calendar, important unread emails (who and what, no addresses), what the agents did and anything broken, church outreach replies. End with "Today's move:" and the move below. Under 170 words. Plain text, no markdown headers. Never invent anything not in the facts.`;
  let text = "";
  for (const askAi of [groqChat, geminiChat, extraChat, openRouterChat, workersChat]) { try { text = stripPlanning(await askAi(env, system, [{ role: "user", content: `FACTS:\n${facts.join("\n")}\n\nSALES:\n${sales}\n\nTODAY'S MOVE:\n${move}` }]) || ""); if (text) break; } catch {} }
  if (!text) return out({ ok: false, error: "no AI answered" }, 503);
  text = text.replace(/^\{[\s\S]*"say"\s*:\s*"|"\s*\}\s*$/g, "").replace(/\\n/g, "\n").replace(/\*\*?/g, "").trim();
  await env.SALES.put("friday:briefing", JSON.stringify({ at: new Date().toISOString(), text }), { expirationTtl: 3 * 864e5 });
  let posted = false;
  if (env.DISCORD_BOT_TOKEN) {
    const chans = JSON.parse(await fetch(`${FRIDAY_RAW}/discord.json`).then((r) => r.text()).catch(() => "{}")).channels || {};
    const id = chans["daily-focus"] || chans.inbox;
    if (id) posted = (await fetch(`https://discord.com/api/v10/channels/${id}/messages`, { method: "POST", headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ embeds: [{ title: "◉ Friday · Morning briefing", description: text.slice(0, 3900), color: 0x4aa3ff }] }) }).catch(() => ({ ok: false }))).ok;
  }
  await fridayNotify(env, "Good morning, Josiah", text.slice(0, 900)).catch(() => {});
  return out({ ok: true, posted, words: text.split(/\s+/).length });
}

// Push notifications to his phone through the free ntfy app. The topic is a long random name kept in KV,
// so only he (subscribed in the app) gets them. Settings shows the topic and a one-tap subscribe link.
async function ntfyTopic(env) {
  let t = await env.SALES.get("friday:ntfy");
  if (!t) { t = "friday-" + crypto.randomUUID().replace(/-/g, ""); await env.SALES.put("friday:ntfy", t); }
  return t;
}
async function fridayNotify(env, title, message, priority = "default") {
  const t = await ntfyTopic(env);
  return fetch(`https://ntfy.sh/${t}`, { method: "POST", signal: timeout(), headers: { Title: title.replace(/[^\x20-\x7E]/g, "").trim() || "Friday", Priority: priority, Tags: "speech_balloon" }, body: message.slice(0, 1000) });
}
// Agents (with the test key) ask for Friday's notes to them, or ask her to ping his phone.
async function fridayAgentBridge(req, env, url) {
  const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const key = sentKey(req);
  const ok = (await sha256(key)) === FRIDAY_KEY_SHA || (env.PAYHIP_API_KEY && key === (await sha256("friday-check:" + env.PAYHIP_API_KEY)));
  if (!ok) return out({ ok: false }, 401);
  if (url.pathname === "/friday/directives") {
    const d = JSON.parse(await env.SALES.get("friday:directives") || "{}");
    const agent = url.searchParams.get("agent") || "";
    return out({ ok: true, notes: (d[agent] || []).filter((x) => Date.now() - Date.parse(x.at) < 3 * 864e5).map((x) => x.text) });
  }
  if (url.pathname === "/friday/notify" && req.method === "POST") {
    let d = {}; try { d = await req.json(); } catch {}
    const r = await fridayNotify(env, String(d.title || "Friday"), String(d.message || ""), d.priority || "default").catch(() => null);
    return out({ ok: !!r?.ok });
  }
  return out({ ok: false }, 404);
}

// ───────────────────────── More free AI capacity ─────────────────────────
// Extra free providers between Gemini and OpenRouter. Each only runs if its key exists:
// NVIDIA (already in the repo), Cerebras (1M tokens/day free), Mistral (free mode), SambaNova (free tier).
async function extraChat(env, system, history) {
  const tries = [
    [env.NVIDIA_API_KEY, "https://integrate.api.nvidia.com/v1/chat/completions", ["meta/llama-3.3-70b-instruct", "nvidia/llama-3.3-nemotron-super-49b-v1"]],
    [env.CEREBRAS_API_KEY, "https://api.cerebras.ai/v1/chat/completions", ["gpt-oss-120b", "llama-3.3-70b", "llama3.1-8b"]],
    [env.MISTRAL_API_KEY, "https://api.mistral.ai/v1/chat/completions", ["mistral-small-latest", "open-mistral-nemo"]],
    [env.SAMBANOVA_API_KEY, "https://api.sambanova.ai/v1/chat/completions", ["Meta-Llama-3.3-70B-Instruct", "Meta-Llama-3.1-8B-Instruct"]]
  ];
  const errs = [];
  for (const [key, url, models] of tries) {
    if (!key) continue;
    for (const model of models) {
      try { const t = await openAiStyle(url, key, model, system, history, {}); if (t) return t; }
      catch (e) { errs.push(`${new URL(url).hostname.split(".")[1]} ${e.message.slice(0, 40)}`); if (!/HTTP (4\d\d|5\d\d)/.test(e.message)) break; }
    }
  }
  throw new Error(errs.join(" / ") || "extra: no keys");
}

// ───────────────────────── Markets & economy ─────────────────────────
// Real data, no guessing: FRED (Fed, rates, inflation, jobs, oil, gas, housing, dollar, VIX),
// Alpaca market data (stock/ETF prices) and CoinGecko (crypto). Paper trading account from the trading desk.
const MACRO = [["DFF", "Fed funds rate", "%"], ["DGS2", "2-yr Treasury", "%"], ["DGS10", "10-yr Treasury", "%"], ["T10Y2Y", "10y-2y spread", "pts"], ["MORTGAGE30US", "30-yr mortgage rate", "%"],
  ["CPIAUCSL", "CPI index", ""], ["UNRATE", "Unemployment", "%"], ["ICSA", "Weekly jobless claims", ""], ["VIXCLS", "VIX fear gauge", ""], ["SP500", "S&P 500", ""], ["DTWEXBGS", "US dollar index", ""],
  ["DCOILWTICO", "WTI crude", "$"], ["DCOILBRENTEU", "Brent crude", "$"], ["DHHNGSP", "Natural gas (Henry Hub)", "$"], ["HOUST", "Housing starts (k, annual rate)", ""], ["CSUSHPINSA", "Case-Shiller home prices", ""],
  ["UMCSENT", "Consumer sentiment", ""], ["BAMLH0A0HYM2", "High-yield credit spread", "pts"], ["RSAFS", "Retail sales ($M)", ""], ["DRTSCILM", "Banks tightening small-business loans (% net)", "%"]];
async function fridayMarkets(env, a = {}) {
  const out = [];
  const cacheKey = "friday:macro";
  let macro = null;
  try { const c = JSON.parse(await env.SALES.get(cacheKey) || "null"); if (c && Date.now() - c.t < 3 * 3600e3) macro = c.rows; } catch {}
  if (!macro && env.FRED_API_KEY) {
    macro = (await Promise.all(MACRO.map(async ([id, label, unit]) => {
      try {
        const j = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=14`, { signal: AbortSignal.timeout(12000) }).then((r) => r.json());
        const obs = (j.observations || []).filter((o) => o.value !== ".");
        if (!obs.length) return null;
        const now = Number(obs[0].value), prev = obs.length > 1 ? Number(obs[obs.length - 1].value) : null;
        const ch = prev != null ? ` (was ${prev} on ${obs[obs.length - 1].date})` : "";
        return `${label}: ${unit === "$" ? "$" : ""}${now}${unit === "%" ? "%" : unit === "pts" ? " pts" : ""} on ${obs[0].date}${ch}`;
      } catch { return null; }
    }))).filter(Boolean);
    await env.SALES.put(cacheKey, JSON.stringify({ t: Date.now(), rows: macro }), { expirationTtl: 6 * 3600 }).catch(() => {});
  }
  if (macro?.length) out.push(`ECONOMY (FRED, official data; dates show how fresh):\n${macro.join("\n")}`);
  const syms = (Array.isArray(a.symbols) ? a.symbols : String(a.symbols || a.query || "").match(/\b[A-Z]{1,5}\b/g) || []).slice(0, 12);
  const stocks = [...new Set(["SPY", "QQQ", "DIA", "IWM", "GLD", "USO", ...syms])].filter((x) => !/^(BTC|ETH|SOL|XRP|DOGE)$/.test(x));
  if (env.ALPACA_KEY && env.ALPACA_SECRET) {
    try {
      const j = await fetch(`https://data.alpaca.markets/v2/stocks/snapshots?symbols=${stocks.join(",")}&feed=iex`, { signal: AbortSignal.timeout(12000), headers: { "APCA-API-KEY-ID": env.ALPACA_KEY, "APCA-API-SECRET-KEY": env.ALPACA_SECRET } }).then((r) => r.json());
      const rows = Object.entries(j || {}).map(([sym, x]) => { const p = x?.latestTrade?.p ?? x?.dailyBar?.c, pc = x?.prevDailyBar?.c; return p ? `${sym} $${Number(p).toFixed(2)}${pc ? ` (${(((p - pc) / pc) * 100).toFixed(2)}% vs prior close)` : ""}` : null; }).filter(Boolean);
      if (rows.length) out.push(`STOCKS/ETFs (Alpaca IEX, live-ish; SPY=S&P500, QQQ=Nasdaq, DIA=Dow, IWM=small caps, GLD=gold, USO=oil):\n${rows.join("\n")}`);
    } catch {}
  }
  try {
    const ids = ["bitcoin", "ethereum", "solana"];
    const j = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`, { signal: AbortSignal.timeout(10000) }).then((r) => r.json());
    out.push(`CRYPTO (CoinGecko): ${ids.map((i) => j[i] ? `${i} $${j[i].usd} (${Number(j[i].usd_24h_change || 0).toFixed(1)}% 24h)` : "").filter(Boolean).join(", ")}`);
  } catch {}
  if (a.portfolio && env.ALPACA_KEY) {
    try {
      const h = { "APCA-API-KEY-ID": env.ALPACA_KEY, "APCA-API-SECRET-KEY": env.ALPACA_SECRET };
      const [acct, pos] = await Promise.all([fetch("https://paper-api.alpaca.markets/v2/account", { headers: h }).then((r) => r.json()), fetch("https://paper-api.alpaca.markets/v2/positions", { headers: h }).then((r) => r.json())]);
      out.push(`PAPER TRADING ACCOUNT (practice money, not real): equity $${acct.equity}, cash $${acct.cash}. Positions: ${(Array.isArray(pos) ? pos : []).map((p) => `${p.symbol} ${p.qty} sh, P/L $${Number(p.unrealized_pl).toFixed(2)}`).join("; ") || "none"}`);
    } catch {}
  }
  return out.join("\n\n") || "Market data isn't available right now.";
}

// ───────────────────────── Plaid (banks, Cash App, Venmo, Chime...) ─────────────────────────
// Free Trial plan: up to 10 connected logins. He connects from Friday's Settings (Plaid's own secure login page);
// Friday only stores Plaid's access tokens in private KV and only READS balances and transactions.
const PLAID = "https://production.plaid.com";
async function plaidCall(env, path, body) {
  const r = await fetch(PLAID + path, { method: "POST", signal: AbortSignal.timeout(20000), headers: { "content-type": "application/json" }, body: JSON.stringify({ client_id: env.PLAID_CLIENT_ID, secret: env.PLAID_SECRET, ...body }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_message || j.error_code || `Plaid HTTP ${r.status}`);
  return j;
}
async function fridayPlaid(req, env, url) {
  const html = (b) => new Response(b, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  if (url.pathname === "/friday/plaid" && req.method === "GET") { await fridayLog(env, "plaid", "connect page opened"); }
  if (url.pathname === "/friday/plaid/log" && req.method === "POST") { let d = {}; try { d = await req.json(); } catch {} await fridayLog(env, "plaid", `page: ${String(d.msg || "").slice(0, 200)}`); return out({ ok: true }); }
  if (url.pathname === "/friday/plaid" && req.method === "GET") return html(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>Connect a bank</title>
<body style="font:18px/1.5 -apple-system,system-ui,sans-serif;background:#07080d;color:#e8ecf5;padding:28px;max-width:560px;margin:auto"><div style="font-size:40px">◉</div><h2>Connect an account to Friday</h2>
<p id=s>Opening Plaid's secure login…</p><p style="color:#8a94ad;font-size:15px">You sign in on Plaid's page, not Friday's. Friday only gets read access to balances and transactions; she can't move money.</p>
<p><a href="https://recreationalviper.github.io/agent-hq/friday/" style="color:#4aa3ff">Back to Friday</a></p>
<script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script><script>
const k = decodeURIComponent(location.hash.slice(1)), s = document.getElementById("s");
const post = (p, b) => fetch(p, { method: "POST", headers: { "x-friday-key": k, "content-type": "application/json" }, body: JSON.stringify(b || {}) }).then(r => r.json());
const log = (msg) => fetch("/friday/plaid/log", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ msg }) }).catch(() => {});
if (!k) { s.textContent = "Open this from Friday's Settings (Connect button), not directly."; log("no key in link"); }
window.onerror = (m) => log("js error: " + m);
if (!window.Plaid) { s.textContent = "Plaid's login couldn't load. Turn off content blockers for this page and try again."; log("Plaid script missing"); }
post("/friday/plaid/token").then(j => {
  if (!j.link_token) { log("no link token: " + (j.error || "unknown")); s.textContent = "Plaid didn't start: " + (j.error || "unknown") + ". Send Claude a screenshot."; return; }
  Plaid.create({ token: j.link_token, onSuccess: (pt, meta) => { s.textContent = "Saving…"; post("/friday/plaid/exchange", { public_token: pt, institution: meta.institution && meta.institution.name }).then(r => { s.textContent = r.ok ? "Connected ✓ " + (r.institution || "") + ". Connect another, or go back to Friday." : "Couldn't save: " + r.error; }); },
    onExit: (e) => { if (e) log("exit: " + (e.error_code || "") + " " + (e.display_message || e.error_message || "")); s.innerHTML = e ? "Stopped: " + (e.display_message || e.error_message || "closed") : "Closed. <a href='' style='color:#4aa3ff'>Connect another</a>"; } }).open();
});
</script>`);
  if ((await sha256(sentKey(req))) !== FRIDAY_KEY_SHA) return out({ ok: false, error: "not owner" }, 401);
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET) return out({ ok: false, error: "Plaid keys aren't set up yet" }, 400);
  try {
    if (url.pathname === "/friday/plaid/token") {
      const j = await plaidCall(env, "/link/token/create", { client_name: "Friday", user: { client_user_id: "josiah" }, products: ["transactions"], country_codes: ["US"], language: "en" });
      return out({ ok: true, link_token: j.link_token });
    }
    if (url.pathname === "/friday/plaid/exchange") {
      const d = await req.json();
      const j = await plaidCall(env, "/item/public_token/exchange", { public_token: d.public_token });
      const items = JSON.parse(await env.SALES.get("friday:plaid") || "[]");
      items.push({ item_id: j.item_id, access_token: j.access_token, institution: String(d.institution || "Account").slice(0, 60), at: new Date().toISOString() });
      await env.SALES.put("friday:plaid", JSON.stringify(items));
      return out({ ok: true, institution: d.institution });
    }
  } catch (e) { await fridayLog(env, "plaid", `${url.pathname}: ${String(e.message || e).slice(0, 200)}`); return out({ ok: false, error: String(e.message || e).slice(0, 200) }, 400); }
  return out({ ok: false }, 404);
}
async function plaidMoney(env, kind, days = 30) {
  const items = JSON.parse(await env.SALES.get("friday:plaid") || "[]");
  if (!items.length || !env.PLAID_CLIENT_ID) return [];
  const lines = [];
  for (const it of items) {
    try {
      if (kind === "accounts") {
        const j = await plaidCall(env, "/accounts/get", { access_token: it.access_token });
        for (const a of j.accounts || []) lines.push(`${it.institution} · ${a.name}${a.mask ? ` ••${a.mask}` : ""}: balance $${a.balances.current ?? "?"}${a.balances.available != null ? ` (available $${a.balances.available})` : ""}${a.type === "credit" && a.balances.limit ? `, limit $${a.balances.limit}` : ""}`);
      } else {
        const end = new Date().toISOString().slice(0, 10), start = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
        const j = await plaidCall(env, "/transactions/get", { access_token: it.access_token, start_date: start, end_date: end, options: { count: 40 } });
        for (const t of j.transactions || []) lines.push(`   ${t.date} ${it.institution}: ${t.amount > 0 ? "-" : "+"}$${Math.abs(t.amount).toFixed(2)} ${t.merchant_name || t.name}${t.personal_finance_category?.primary ? ` [${t.personal_finance_category.primary.toLowerCase().replace(/_/g, " ")}]` : ""}`);
      }
    } catch (e) { lines.push(`${it.institution}: couldn't read (${String(e.message).slice(0, 80)}). He may need to reconnect it.`); }
  }
  return lines;
}

// The Friday key as sent, cleaned of the stray spaces, line breaks and smart characters phones add when pasting.
function sentKey(req) {
  return (req.headers.get("x-friday-key") || "").normalize("NFKC").replace(/[\s\u200B-\u200D\uFEFF]+/g, "").replace(/[\u2010-\u2015\u2212]/g, "-");
}
