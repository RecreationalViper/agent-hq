// Creates a Payhip coupon (owner-approved promotions only).
// Usage: node tools/payhip-coupon.mjs CODE PERCENT YYYY-MM-DD [product_id]   (expires end of that day, New York time)
const [code, pct, until, product] = process.argv.slice(2);
const key = (process.env.PAYHIP_API_KEY || "").trim();
if (!code || !pct || !until || !key) { console.log("usage: CODE PERCENT YYYY-MM-DD [product_id] (needs PAYHIP_API_KEY)"); process.exit(1); }
const expiry = Math.floor(Date.parse(`${until}T23:59:59-05:00`) / 1000);
const fields = { code, percentage: Number(pct), percent_off: Number(pct), discount: Number(pct), type: "percentage", coupon_type: "percentage", expiry, ...(product ? { product_id: Number(product) } : { applies_to: "all" }) };
const attempts = [
  ["json", JSON.stringify({ code, percentage: Number(pct), expiry, ...(product ? { product_id: Number(product) } : {}) })],
  ["form", new URLSearchParams(Object.entries({ code, percentage: pct, expiry, ...(product ? { product_id: product } : {}) }).map(([k, v]) => [k, String(v)])).toString()],
  ["form+", new URLSearchParams(Object.entries(fields).map(([k, v]) => [k, String(v)])).toString()]
];
for (const [kind, body] of attempts) {
  const r = await fetch("https://payhip.com/api/v1/coupons", { method: "POST", headers: { accept: "application/json", "content-type": kind === "json" ? "application/json" : "application/x-www-form-urlencoded", "payhip-api-key": key }, body });
  const t = await r.text();
  console.log(`${kind}: HTTP ${r.status} ${t.slice(0, 300)}`);
  if (r.ok) process.exit(0);
}
process.exit(1);
