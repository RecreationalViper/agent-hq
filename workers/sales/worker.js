// Forever Held sales feed (Cloudflare Worker, free plan).
// Payhip -> POST here on every sale/refund. We verify it really came from Payhip,
// keep only what the agents need (no buyer emails or names), and let Agent HQ read it.
//   POST /payhip         Payhip webhook (paid, refunded)
//   GET  /sales?days=30  recent sales for the agents (needs header x-read-token)
//   POST /discord        Discord slash commands (/status, /sales, /ask, /run), owner/admins only
//   POST /contact        storefront contact form -> KV (12 months) + Discord #sales (customer care)
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
