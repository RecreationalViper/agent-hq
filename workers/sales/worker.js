// Forever Held sales feed (Cloudflare Worker, free plan).
// Payhip -> POST here on every sale/refund. We verify it really came from Payhip,
// keep only what the agents need (no buyer emails or names), and let Agent HQ read it.
//   POST /payhip         Payhip webhook (paid, refunded)
//   GET  /sales?days=30  recent sales for the agents (needs header x-read-token)
const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

export default {
  async fetch(req, env) {
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
