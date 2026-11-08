// Reads Forever Held sales from the sales feed Worker and summarizes them for the agents.
import fs from "node:fs/promises";
import crypto from "node:crypto";

export async function salesSummary() {
  const key = (process.env.PAYHIP_API_KEY || "").trim();
  let feed; try { feed = JSON.parse(await fs.readFile("sales-feed.json", "utf8")); } catch { return null; }
  if (!key || !feed?.url) return null;
  const token = crypto.createHash("sha256").update("read:" + key).digest("hex");
  const res = await fetch(`${feed.url}/sales?days=90`, { headers: { "x-read-token": token }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`sales feed HTTP ${res.status}`);
  const { sales = [] } = await res.json();
  const sum = (days) => {
    const since = Date.now() - days * 86400000;
    const s = sales.filter((x) => Date.parse(x.date) >= since);
    const paid = s.filter((x) => x.type === "paid"), refunds = s.filter((x) => x.type === "refunded");
    const gross = paid.reduce((a, x) => a + x.amount, 0), fees = paid.reduce((a, x) => a + x.fees, 0), back = refunds.reduce((a, x) => a + x.refunded, 0);
    const byProduct = {};
    for (const x of paid) for (const i of x.items) byProduct[i.product] = (byProduct[i.product] || 0) + i.quantity;
    return { orders: paid.length, gross: +gross.toFixed(2), net: +(gross - fees - back).toFixed(2), refunds: refunds.length, top: Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 5) };
  };
  const d7 = sum(7), d30 = sum(30), d90 = sum(90);
  const fmt = (n, s) => `${n}: ${s.orders} order(s), $${s.gross} gross, $${s.net} after fees/refunds${s.top.length ? `; best sellers: ${s.top.map(([p, q]) => `${p} (${q})`).join(", ")}` : ""}`;
  const text = sales.length ? [fmt("Last 7 days", d7), fmt("Last 30 days", d30), fmt("Last 90 days", d90)].join("\n") : "No sales yet (the Payhip store is new).";
  return { text, d7, d30, d90, total: sales.length };
}
