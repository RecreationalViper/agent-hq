// Installs/updates the Forever Held sales feed Worker on Cloudflare (free plan) and
// writes its public address to sales-feed.json. Needs CLOUDFLARE_WORKERS_TOKEN,
// CLOUDFLARE_ACCOUNT_ID and PAYHIP_API_KEY. Optional: DISCORD_SALES_WEBHOOK.
import fs from "node:fs/promises";
import crypto from "node:crypto";
const ACCT = (process.env.CLOUDFLARE_ACCOUNT_ID || "").trim(), TOKEN = (process.env.CLOUDFLARE_WORKERS_TOKEN || "").trim(), PAYHIP = (process.env.PAYHIP_API_KEY || "").trim();
if (!ACCT || !TOKEN || !PAYHIP) { console.log(`Missing: ${[!TOKEN && "CLOUDFLARE_WORKERS_TOKEN", !ACCT && "CLOUDFLARE_ACCOUNT_ID", !PAYHIP && "PAYHIP_API_KEY"].filter(Boolean).join(", ")}`); process.exit(1); }
const NAME = "foreverheld-sales", API = `https://api.cloudflare.com/client/v4/accounts/${ACCT}`;
async function cf(path, init = {}) {
  const res = await fetch(API + path, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.success === false) { const e = new Error(`${init.method || "GET"} ${path}: HTTP ${res.status} ${j.errors?.map((x) => `${x.code} ${x.message}`).join("; ") || ""}`); e.status = res.status; e.body = j; throw e; }
  return j.result;
}
// 1. storage for sales
const spaces = await cf("/storage/kv/namespaces?per_page=100");
let kv = spaces.find((n) => n.title === NAME);
if (!kv) kv = await cf("/storage/kv/namespaces", { method: "POST", body: JSON.stringify({ title: NAME }) });
console.log(`Storage ready (${kv.id.slice(0, 6)}…)`);
// 2. account's free workers.dev address
let sub;
try { sub = (await cf("/workers/subdomain")).subdomain; } catch (e) { if (e.status !== 404 && !/10007|not found/i.test(e.message)) throw e; }
if (!sub) {
  for (const name of ["foreverheld", `foreverheld-${crypto.randomBytes(2).toString("hex")}`, `foreverheld-${crypto.randomBytes(3).toString("hex")}`]) {
    try { sub = (await cf("/workers/subdomain", { method: "PUT", body: JSON.stringify({ subdomain: name }) })).subdomain; break; } catch (e) { console.log(`Address ${name} not available (${e.message.slice(-60)})`); }
  }
}
if (!sub) throw new Error("Couldn't set up a workers.dev address.");
// 3. upload the Worker with its settings
const readToken = crypto.createHash("sha256").update("read:" + PAYHIP).digest("hex");
const bindings = [{ type: "kv_namespace", name: "SALES", namespace_id: kv.id }, { type: "secret_text", name: "PAYHIP_API_KEY", text: PAYHIP }, { type: "secret_text", name: "READ_TOKEN", text: readToken }];
if (process.env.DISCORD_SALES_WEBHOOK) bindings.push({ type: "secret_text", name: "DISCORD_SALES_WEBHOOK", text: process.env.DISCORD_SALES_WEBHOOK.trim() });
const form = new FormData();
form.append("metadata", new Blob([JSON.stringify({ main_module: "worker.js", compatibility_date: "2026-01-01", bindings })], { type: "application/json" }));
form.append("worker.js", new Blob([await fs.readFile("workers/sales/worker.js", "utf8")], { type: "application/javascript+module" }), "worker.js");
await cf(`/workers/scripts/${NAME}`, { method: "PUT", body: form });
await cf(`/workers/scripts/${NAME}/subdomain`, { method: "POST", body: JSON.stringify({ enabled: true, previews_enabled: false }) });
const base = `https://${NAME}.${sub}.workers.dev`;
await fs.writeFile("sales-feed.json", JSON.stringify({ url: base, webhook: `${base}/payhip`, updated: new Date().toISOString() }, null, 2) + "\n");
// 4. check it's live (new addresses can take a minute)
for (let i = 0; i < 12; i++) {
  try { const r = await fetch(base + "/"); if (r.ok) { console.log(`Live: ${await r.text()}`); break; } } catch {}
  await new Promise((r) => setTimeout(r, 10000));
}
console.log(`RESULT: Payhip webhook address: ${base}/payhip`);
