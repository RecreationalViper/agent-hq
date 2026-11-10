// Forever Held sales feed (Cloudflare Worker, free plan).
// Payhip -> POST here on every sale/refund. We verify it really came from Payhip,
// keep only what the agents need (no buyer emails or names), and let Agent HQ read it.
//   POST /payhip         Payhip webhook (paid, refunded)
//   GET  /sales?days=30  recent sales for the agents (needs header x-read-token)
//   POST /discord        Discord slash commands (/status, /sales, /ask, /run), owner/admins only
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
  "content-creator": ["content-creator.yml", {}], "film": ["make-film.yml", { format: "film" }], "pin-video": ["make-film.yml", { format: "pin" }],
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

async function discord(req, env, ctx) {
  const body = await req.text();
  if (!(await verified(req, env, body))) return new Response("bad signature", { status: 401 });
  const i = JSON.parse(body);
  if (i.type === 1) return json({ type: 1 }); // PING
  if (i.type !== 2) return json({ type: 4, data: { content: "Unsupported." } });
  const admin = (BigInt(i.member?.permissions || "0") & 8n) === 8n;
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
