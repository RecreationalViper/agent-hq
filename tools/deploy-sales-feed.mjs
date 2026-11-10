// Installs/updates the Forever Held sales feed Worker on Cloudflare (free plan) and
// writes its public address to sales-feed.json. Needs CLOUDFLARE_WORKERS_TOKEN,
// CLOUDFLARE_ACCOUNT_ID and PAYHIP_API_KEY. Optional: DISCORD_SALES_WEBHOOK.
import fs from "node:fs/promises";
import crypto from "node:crypto";
const ACCT = (process.env.CLOUDFLARE_ACCOUNT_ID || "").trim(), PAYHIP = (process.env.PAYHIP_API_KEY || "").trim();
// Use whichever saved Cloudflare token is valid for this account: the Workers token, else the Workers AI token.
let TOKEN = "";
for (const [name, t] of [["CLOUDFLARE_WORKERS_TOKEN", process.env.CLOUDFLARE_WORKERS_TOKEN], ["CLOUDFLARE_API_TOKEN", process.env.CLOUDFLARE_API_TOKEN]]) {
  if (!t?.trim()) continue;
  const H = { Authorization: `Bearer ${t.trim()}` };
  const okUser = (await (await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", { headers: H })).json().catch(() => ({}))).result?.status === "active";
  const okAcct = (await (await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/tokens/verify`, { headers: H })).json().catch(() => ({}))).result?.status === "active";
  const canKv = (await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/storage/kv/namespaces?per_page=1`, { headers: H })).ok;
  console.log(`${name}: valid ${okUser || okAcct}, can manage Workers storage on this account: ${canKv}`);
  if (canKv) { TOKEN = t.trim(); console.log(`Using ${name}`); break; }
}
if (!ACCT || !TOKEN || !PAYHIP) { console.log(`RESULT: can't install yet. ${!TOKEN ? "No saved Cloudflare token has Workers Scripts + Workers KV Storage (Edit) permission on this account. " : ""}${!ACCT ? "CLOUDFLARE_ACCOUNT_ID missing. " : ""}${!PAYHIP ? "PAYHIP_API_KEY missing." : ""}`); process.exit(1); }
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
let salesChannel = null;
try { salesChannel = JSON.parse(await fs.readFile("discord.json", "utf8")).channels?.sales || null; } catch {}
if (process.env.DISCORD_BOT_TOKEN && salesChannel) {
  bindings.push({ type: "secret_text", name: "DISCORD_BOT_TOKEN", text: process.env.DISCORD_BOT_TOKEN.trim() }, { type: "plain_text", name: "DISCORD_SALES_CHANNEL", text: salesChannel });
  console.log("Sales will also post to Discord #sales");
}
// Discord slash commands: the app's public key (to verify requests), Workers AI for /ask, optional GitHub key for /run
let app = null;
if (process.env.DISCORD_BOT_TOKEN) {
  const r = await fetch("https://discord.com/api/v10/applications/@me", { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN.trim()}` } });
  if (r.ok) app = await r.json(); else console.log(`Discord app lookup failed: HTTP ${r.status}`);
}
if (app?.verify_key) {
  bindings.push({ type: "plain_text", name: "DISCORD_PUBLIC_KEY", text: app.verify_key }, { type: "plain_text", name: "DISCORD_APP_ID", text: app.id }, { type: "ai", name: "AI" });
  if (process.env.GH_DISPATCH_TOKEN?.trim()) bindings.push({ type: "secret_text", name: "GH_TOKEN", text: process.env.GH_DISPATCH_TOKEN.trim() });
  console.log(`Discord commands: on${process.env.GH_DISPATCH_TOKEN?.trim() ? " (with /run)" : " (/run waits for GH_DISPATCH_TOKEN)"}`);
}
const form = new FormData();
form.append("metadata", new Blob([JSON.stringify({ main_module: "worker.js", compatibility_date: "2026-01-01", bindings })], { type: "application/json" }));
form.append("worker.js", new Blob([await fs.readFile("workers/sales/worker.js", "utf8")], { type: "application/javascript+module" }), "worker.js");
await cf(`/workers/scripts/${NAME}`, { method: "PUT", body: form });
await cf(`/workers/scripts/${NAME}/subdomain`, { method: "POST", body: JSON.stringify({ enabled: true, previews_enabled: false }) });
const base = `https://${NAME}.${sub}.workers.dev`;
// Only rewrite the file when the address changes (a new timestamp every run caused save conflicts).
const prev = await fs.readFile("sales-feed.json", "utf8").then(JSON.parse).catch(() => ({}));
if (prev.url !== base || prev.webhook !== `${base}/payhip`)
  await fs.writeFile("sales-feed.json", JSON.stringify({ url: base, webhook: `${base}/payhip`, updated: new Date().toISOString() }, null, 2) + "\n");
// 4. check it's live (new addresses can take a minute)
for (let i = 0; i < 12; i++) {
  try { const r = await fetch(base + "/"); if (r.ok) { console.log(`Live: ${await r.text()}`); break; } } catch {}
  await new Promise((r) => setTimeout(r, 10000));
}
console.log(`RESULT: Payhip webhook address: ${base}/payhip`);

// 5. register the slash commands in the Agent HQ server and point Discord at the Worker
if (app?.verify_key) {
  const D = { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN.trim()}`, "Content-Type": "application/json" };
  const guild = JSON.parse(await fs.readFile("discord.json", "utf8")).serverId;
  const agents = JSON.parse(await fs.readFile("agents.json", "utf8")).agents.map((a) => ({ name: a.name.slice(0, 100), value: a.id }));
  const extra = [["Content Creator", "content-creator"], ["Product film (website)", "film"], ["Pinterest video pin", "pin-video"], ["Deep Researcher", "research"], ["Trading Desk", "trading-desk"], ["Head Trader review", "head-trader-review"], ["Provider Check", "provider-check"], ["All agents due today", "all-due"]].map(([name, value]) => ({ name, value }));
  const commands = [
    { name: "status", description: "When each agent last reported" },
    { name: "sales", description: "Sales today, this week and this month" },
    { name: "ask", description: "Ask the team a question (answers from their latest reports)", options: [{ type: 3, name: "question", description: "Your question", required: true, max_length: 300 }] },
    { name: "run", description: "Start an agent now", options: [{ type: 3, name: "agent", description: "Which agent", required: true, choices: [...extra, ...agents].slice(0, 25) }] }
  ];
  const put = await fetch(`https://discord.com/api/v10/applications/${app.id}/guilds/${guild}/commands`, { method: "PUT", headers: D, body: JSON.stringify(commands) });
  console.log(`RESULT: Discord commands ${put.ok ? "registered (/status /sales /ask /run)" : `failed HTTP ${put.status}: ${(await put.text()).slice(0, 200)}`}`);
  const patch = await fetch("https://discord.com/api/v10/applications/@me", { method: "PATCH", headers: D, body: JSON.stringify({ interactions_endpoint_url: `${base}/discord` }) });
  console.log(`RESULT: Discord endpoint ${patch.ok ? "set to " + base + "/discord" : `failed HTTP ${patch.status}: ${(await patch.text()).slice(0, 200)}`}`);
}
