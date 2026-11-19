// Creates a Payhip coupon (owner-approved promotions only).
// Usage: node tools/payhip-coupon.mjs CODE PERCENT YYYY-MM-DD [product_id]   (expires end of that day, New York time)
const [code, pct, until, product] = process.argv.slice(2);
const key = (process.env.PAYHIP_API_KEY || "").trim();
if (!code || !pct || !until || !key) { console.log("usage: CODE PERCENT YYYY-MM-DD [product_id] (needs PAYHIP_API_KEY)"); process.exit(1); }
const expiry = Math.floor(Date.parse(`${until}T23:59:59-05:00`) / 1000);
const body = JSON.stringify({ code, percentage: Number(pct), expiry, ...(product ? { product_id: Number(product) } : {}) });
for (const headers of [{ "payhip-api-key": key }, { authorization: `Bearer ${key}` }]) {
  const r = await fetch("https://payhip.com/api/v1/coupons", { method: "POST", headers: { accept: "application/json", "content-type": "application/json", ...headers }, body });
  const t = await r.text();
  console.log(`${Object.keys(headers)[0]}: HTTP ${r.status} ${t.slice(0, 300)}`);
  if (r.ok) process.exit(0);
  if (r.status !== 401 && r.status !== 403) break;
}
process.exit(1);
