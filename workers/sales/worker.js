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
  for (const ask of [groqChat, geminiChat, openRouterChat, workersChat]) {
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
- You call him "boss" now and then (not every line), like FRIDAY does with Tony.
- Proactive like JARVIS: if the facts show something he'd want to know (a failure, a reply, a sale, a deadline), mention it briefly even if he didn't ask. Offer the obvious next step.
- Honest: say plainly when you don't know or can't do something, and never fake a result. Push back, kindly, if a plan looks like a bad idea.
How you talk (he hears you out loud):
- Plain spoken sentences, usually under 60 words. No markdown, lists, links, emojis or URLs unless he asks.
- Lead with the answer. Round numbers and say them naturally ("about twelve dollars").
- Short confirmations for actions ("On it, boss. Texting Mom now.").
- If he's stressed or it's late, be gentle and brief.`;
const FRIDAY_KEY_SHA = "24e6f6d78ba5f775d60efcb6ff8939a5f19d5ae7f22f2e0a79aba608f66fa1d5";
const FRIDAY_RAW = `https://raw.githubusercontent.com/${REPO}/main`;
const FRIDAY_RUNS = { ...RUNS, "outreach-replies": ["outreach.yml", { mode: "replies" }], "assistant-check": ["assistant-check.yml", {}], "publish-store": ["deploy-store.yml", {}], "pinterest-stats": ["pinterest-stats.yml", {}] };

async function friday(req, env, ctx) {
  const origin = req.headers.get("origin") || "";
  const cors = /^https:\/\/recreationalviper\.github\.io$/i.test(origin) ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, x-friday-key", vary: "origin" } : {};
  const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return out({ ok: false, error: "method" }, 405);
  const key = req.headers.get("x-friday-key") || "";
  // the owner's key, or the agents' test key (derived from the Payhip secret, so it never appears anywhere public)
  const owner = (await sha256(key)) === FRIDAY_KEY_SHA;
  if (!owner && !(env.PAYHIP_API_KEY && key === (await sha256("friday-check:" + env.PAYHIP_API_KEY)))) return out({ ok: false, say: "Sorry, I don't know you." }, 401);
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

  const facts = await fridayFacts(env, now, owner);

  const system = `You are FRIDAY, Josiah Cottingham's personal AI, modeled on Tony Stark's FRIDAY (and JARVIS before her). ${FRIDAY_PERSONA}
It's ${ny} (New York).

His world:
- Forever Held: his printable memorial keepsake shop (store https://foreverheld.pages.dev, checkout on Payhip). A team of AI agents on GitHub makes daily pins and posts (Pinterest via site feed, Facebook Page via Make.com), runs a church email outreach for the Longest Night set, sweeps email, and writes reports. Claude (in the Claude app) is his head of development for bigger builds.
- Other projects may come up (lead generation for roofers, TikTok edits, trading agents). Help with anything: questions, ideas, planning, general knowledge.
Use only the LIVE FACTS below for anything about his businesses' numbers or status; if something isn't there, say you don't have it yet. Never invent sales, replies or results.

You can act. Return ONLY JSON: {"say": "what you speak", "run": null or one of [${Object.keys(FRIDAY_RUNS).join(", ")}], "remember": null or "a short fact to keep about him", "phone": null or a phone action, "google": null or a Google action}.
"google" works in HIS Gmail and Google Calendar (only if the facts show Google is connected). Shapes:
  {"do":"calendar","days":14}  look further ahead than the facts show   {"do":"email_search","query":"Gmail search like from:mom newer_than:7d or invoice"}  find or read emails
  {"do":"event_add","title":"...","start":"YYYY-MM-DDTHH:MM in New York time, or YYYY-MM-DD for all day","minutes":60,"location":""}
  {"do":"email_draft","to":"email address or a name he's emailed before","subject":"...","body":"the full email, in his voice, signed Josiah"}   {"do":"email_send"}
Email rule: NEVER send on the first ask. Draft first, tell him who it's to and the gist, and ask "Send it?". Use email_send only when his NEXT message clearly says to send it. Write emails like a real person, short and professional for business.
For calendar events prefer google event_add when Google is connected; otherwise use the phone "event".
Use "run" only when he clearly asks to start an agent job. Use "remember" when he tells you something worth keeping (a preference, a plan, a person) or says "remember".
"phone" makes HIS iPhone do something (his Shortcuts app carries it out). Use it only when he asks for it. Shapes:
  {"do":"text","to":"contact name or number","message":"..."}   {"do":"call","to":"contact name or number"}
  {"do":"reminder","title":"...","when":"natural time like tomorrow 5pm, or empty"}   {"do":"event","title":"...","when":"natural start time","minutes":60}
  {"do":"timer","minutes":20}   {"do":"alarm","when":"6:30 AM"}   {"do":"directions","to":"place or address"}   {"do":"note","title":"...","text":"..."}
  {"do":"music","query":"artist, song or playlist"}   {"do":"health","metric":"steps|sleep|heart rate|active energy|weight","days":1}   {"do":"open","url":"https://... or app URL"}
For texts, write the message in his voice, short. Your "say" should confirm what you're doing ("Texting Mom that you'll be late."). Any question about his own health numbers (steps, sleep, heart rate, workouts, weight) ALWAYS gets {"do":"health",...}: you can't see them until his phone sends them, so say you're checking.
If his message starts with "PHONE DATA:", it's numbers his phone just sent for a question he asked: answer from them.

THINGS HE ASKED YOU TO REMEMBER:
${memory.map((m) => `- ${m}`).join("\n") || "- (nothing yet)"}

LIVE FACTS:
${facts.join("\n")}`;
  const convo = [...past.slice(-8), { role: "user", content: q }];
  let raw = "", why = [];
  for (const ask of [groqChat, geminiChat, openRouterChat, workersChat]) {
    try { raw = stripPlanning(await ask(env, system, convo) || ""); if (raw) break; } catch (e) { why.push(`${ask.name}: ${String(e.message || e).slice(0, 80)}`); }
  }
  if (!raw) return out({ ok: false, say: "My brain's offline for a minute. All my AI services are busy. Try me again shortly.", why });
  let r = {};
  try { const m = raw.match(/\{[\s\S]*\}/); r = JSON.parse((m ? m[0] : raw).replace(/,\s*([}\]])/g, "$1")); } catch { r = { say: raw }; }
  let say = String(r.say || raw).replace(/\*\*?/g, "").replace(/^#+\s*/gm, "").trim().slice(0, 1500);
  if (r.run && FRIDAY_RUNS[r.run]) {
    const [wf, inputs] = FRIDAY_RUNS[r.run];
    const res = env.GH_TOKEN ? await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${wf}/dispatches`, { method: "POST", headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "Friday", "content-type": "application/json" }, body: JSON.stringify({ ref: "main", inputs }) }).catch(() => null) : null;
    if (res?.status !== 204) say += ` Heads up: I couldn't start ${r.run.replace(/-/g, " ")} just now.`;
  }
  let gResult = null;
  if (owner && r.google && typeof r.google === "object" && r.google.do) {
    gResult = await runGoogle(env, r.google);
    if (["calendar", "email_search"].includes(r.google.do) && !/^Couldn't/.test(gResult)) {
      // second pass: answer from what Google returned
      try {
        const again = stripPlanning(await (async () => { for (const ask of [groqChat, geminiChat, openRouterChat, workersChat]) { try { const t = await ask(env, system, [...convo, { role: "assistant", content: JSON.stringify({ say: "(looking it up)", google: r.google }) }, { role: "user", content: `GOOGLE RESULT (not from him, answer his question from this, JSON with "say" only):\n${gResult.slice(0, 4000)}` }]); if (t) return t; } catch {} } return ""; })());
        const m2 = again.match(/\{[\s\S]*\}/); const j2 = m2 ? JSON.parse(m2[0].replace(/,\s*([}\]])/g, "$1")) : { say: again };
        if (j2.say) say = String(j2.say).replace(/\*\*?/g, "").trim().slice(0, 1500);
      } catch {}
    } else if (/^(Couldn't|I couldn't|Need |Not sent|There's no|Unknown)/.test(gResult)) say = gResult.replace(/^Couldn't do that: /, "I couldn't do that, boss: ");
    else if (r.google.do === "email_send") say = /^SENT/.test(gResult) ? `Sent to ${gResult.match(/to (\S+)/)?.[1] || "them"}.` : say;
  } else if (!owner && r.google) say += " (Google tools are owner-only.)";
  if (r.remember && typeof r.remember === "string") { memory.push(`${r.remember.slice(0, 200)} (${now.toISOString().slice(0, 10)})`); await env.SALES.put("friday:memory", JSON.stringify(memory.slice(-200))); }
  await env.SALES.put("friday:history", JSON.stringify([...convo, { role: "assistant", content: say }].slice(-12)), { expirationTtl: 6 * 3600 });
  const PHONE = ["text", "call", "reminder", "event", "timer", "alarm", "directions", "note", "music", "health", "open"];
  const phone = r.phone && typeof r.phone === "object" && PHONE.includes(r.phone.do) ? r.phone : null;
  return out({ ok: true, heard, say, ran: r.run || null, remembered: r.remember || null, google: gResult, phone, phone_json: phone ? JSON.stringify(phone) : "" });
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
  const key = req.headers.get("x-friday-key") || "";
  const owner = (await sha256(key)) === FRIDAY_KEY_SHA;
  if (!owner && !(env.PAYHIP_API_KEY && key === (await sha256("friday-check:" + env.PAYHIP_API_KEY)))) return out({ ok: false }, 401);
  let d = {}; try { d = await req.json(); } catch {}
  const memory = JSON.parse(await env.SALES.get("friday:memory") || "[]");
  if (isTool) {
    const a = d.args || {};
    if (d.name === "get_status") return out({ ok: true, result: (await fridayFacts(env, new Date(), owner)).join("\n") });
    if (d.name === "google") return out({ ok: true, result: owner ? await runGoogle(env, a) : "Google tools are owner-only." });
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
Use google for his Gmail and Google Calendar: calendar (look ahead), email_search (Gmail query), event_add (start as YYYY-MM-DDTHH:MM New York time), email_draft, email_send. Email rule: never send on the first ask. Draft, tell him who and the gist, ask "Send it?", and only call email_send after he says yes.
THINGS HE ASKED YOU TO REMEMBER:\n${memory.map((m) => `- ${m}`).join("\n") || "- (nothing yet)"}
FACTS AT THE START OF THIS CALL:\n${facts.join("\n")}`;
  const tools = [{ functionDeclarations: [
    { name: "get_status", description: "Fresh facts about his businesses: sales, posting, church outreach, agent health." },
    { name: "run_agent", description: "Start one of his agent jobs.", parameters: { type: "OBJECT", properties: { job: { type: "STRING", enum: Object.keys(FRIDAY_RUNS) } }, required: ["job"] } },
    { name: "google", description: "His Gmail and Google Calendar. do = calendar|email_search|event_add|email_draft|email_send.", parameters: { type: "OBJECT", properties: { do: { type: "STRING", enum: ["calendar", "email_search", "event_add", "email_draft", "email_send"] }, days: { type: "NUMBER" }, query: { type: "STRING" }, title: { type: "STRING" }, start: { type: "STRING" }, minutes: { type: "NUMBER" }, location: { type: "STRING" }, to: { type: "STRING" }, subject: { type: "STRING" }, body: { type: "STRING" } }, required: ["do"] } },
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
const G_SCOPES = "openid email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar";
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
    return "Unknown Google action.";
  } catch (e) { return `Couldn't do that: ${String(e.message || e).slice(0, 160)}`; }
}

// Settings › Connections in the Friday app: what's connected, plus disconnect. Owner key only.
async function fridayConnections(req, env) {
  const origin = req.headers.get("origin") || "";
  const cors = /^https:\/\/recreationalviper\.github\.io$/i.test(origin) ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, x-friday-key", vary: "origin" } : {};
  const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST" || (await sha256(req.headers.get("x-friday-key") || "")) !== FRIDAY_KEY_SHA) return out({ ok: false }, 401);
  let d = {}; try { d = await req.json(); } catch {}
  if (d.action === "disconnect" && d.app === "google") {
    const g = JSON.parse(await env.SALES.get("friday:google") || "null");
    if (g?.refresh) await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(g.refresh), { method: "POST" }).catch(() => {});
    await env.SALES.delete("friday:google"); await env.SALES.delete("friday:gaccess"); await env.SALES.delete("friday:pending_email");
    return out({ ok: true });
  }
  const g = JSON.parse(await env.SALES.get("friday:google") || "null");
  const parts = g ? [g.scope?.includes("gmail") && "Gmail", g.scope?.includes("calendar") && "Calendar"].filter(Boolean).join(" + ") : "";
  return out({ ok: true, apps: [
    { id: "google", icon: "✉️", name: "Google: Gmail + Calendar", connect: !!env.GOOGLE_CLIENT_ID, connected: !!g, detail: g ? `${g.email || "connected"} · ${parts || "limited"}` : "Read your inbox and calendar, add events, draft emails (sends only when you say)" },
    { id: "business", icon: "🕊️", name: "Forever Held + agents", connected: true, detail: "Sales, posts, church outreach, agent health" },
    { id: "phone", icon: "📱", name: "iPhone (Friday Hands Shortcut)", detail: "Texts, calls, reminders, alarms, music, directions, Health" },
    { id: "money", icon: "💳", name: "Money (read-only)", soon: true, detail: "Balances and spending, never moves money" }
  ] });
}
