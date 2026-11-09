// Creates a Payhip coupon (skips if the code already exists).
// env: PAYHIP_API_KEY, CODE, PERCENT, PRODUCT_KEY (blank = all products), USAGE_LIMIT, NOTES
const key = process.env.PAYHIP_API_KEY?.trim();
if (!key) { console.log("No PAYHIP_API_KEY secret"); process.exit(1); }
const H = { "payhip-api-key": key };
const code = (process.env.CODE || "").trim().toUpperCase();
const list = await (await fetch("https://payhip.com/api/v2/coupons", { headers: H })).json().catch(() => ({}));
const existing = (list.data || []).find((c) => String(c.code).toUpperCase() === code);
if (existing) { console.log(`RESULT: ${code} already exists (${existing.percent_off ?? ""}% off). Nothing changed.`); process.exit(0); }
const body = new URLSearchParams({ code, percent_off: String(process.env.PERCENT || "25"), notes: process.env.NOTES || "Created by Agent HQ" });
if (process.env.PRODUCT_KEY) { body.set("coupon_type", "single"); body.set("product_key", process.env.PRODUCT_KEY); } else body.set("coupon_type", "multi");
if (process.env.USAGE_LIMIT) body.set("usage_limit", process.env.USAGE_LIMIT);
const r = await fetch("https://payhip.com/api/v2/coupons", { method: "POST", headers: H, body });
const j = await r.json().catch(() => ({}));
if (!r.ok) { console.log(`RESULT: FAILED (HTTP ${r.status}): ${JSON.stringify(j).slice(0, 300)}`); process.exit(1); }
console.log(`RESULT: created ${j.data?.code} — ${j.data?.percent_off}% off, type ${j.data?.coupon_type}, id ${j.data?.id}`);
