// Church outreach for the Longest Night set: one personal, plain-text email per church from the shop Gmail.
// Sends nothing unless outreach/config.json has "approved": true (the owner's OK). Weekdays only, perDay at most.
// Usage: node tools/outreach.mjs            send today's batch (if approved)
//        node tools/outreach.mjs --preview  print the next emails, send nothing
import fs from "node:fs/promises";
import { accessToken, client } from "../gmail/sweep.mjs";
import { report } from "../discord.mjs";

const FILE = "outreach/churches.csv";
const PREVIEW = process.argv.includes("--preview");
const ADDRESS = process.env.FUNNEL_MAILING_ADDRESS?.trim();
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const parse = (t) => { const [head, ...rows] = t.trim().split("\n"); const k = head.split(","); return rows.map((r) => { const v = r.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((x) => x.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')); return Object.fromEntries(k.map((x, i) => [x, v[i] || ""])); }); };
const csv = (rows) => { const k = Object.keys(rows[0]); return [k.join(","), ...rows.map((r) => k.map((x) => /[",]/.test(r[x]) ? `"${r[x].replace(/"/g, '""')}"` : r[x]).join(","))].join("\n") + "\n"; };
const b64url = (s) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const encSubj = (s) => `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;

const cfg = JSON.parse(await fs.readFile("outreach/config.json", "utf8"));
const tpl = await fs.readFile("outreach/church-email.md", "utf8");
const promos = (JSON.parse(await fs.readFile("products/collections.json", "utf8")).promos || []).filter((p) => p.until >= TODAY);
const rows = parse(await fs.readFile(FILE, "utf8"));
const queue = rows.filter((r) => r.status === "new" && /@/.test(r.email));

function compose(r) {
  const [subjLine, ...rest] = tpl.trim().split("\n");
  const coupon = promos[0] ? ` Through ${promos[0].until.slice(5).replace("-", "/")}, the code ${promos[0].code} takes ${promos[0].percent}% off.` : "";
  const why = r.why || "may be planning a Blue Christmas or Longest Night service this December";
  const short = r.name.replace(/\s*\(.*\)$/, "");
  const greet = short.replace(/^The /, "");
  const body = rest.join("\n").trim().replaceAll("{church}", greet).replaceAll("{name}", short).replaceAll("{why}", why).replaceAll("{coupon}", coupon)
    .replace(`I saw that ${short} may be planning`, `I'm writing because ${short} may be planning`);
  return { subject: subjLine.replace(/^Subject:\s*/, ""), body: `${body}\n${ADDRESS || ""}`.trim() };
}

const day = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" })).getDay();
const batch = queue.slice(0, Number(cfg.perDay) || 5);
if (PREVIEW || !cfg.approved) {
  for (const r of batch.slice(0, PREVIEW ? 3 : 1)) { const m = compose(r); console.log(`--- To: ${r.email}\nSubject: ${m.subject}\n\n${m.body}\n`); }
  console.log(`RESULT outreach: ${cfg.approved ? "preview only" : "waiting for the owner's approval"}; ${queue.length} churches ready, ${rows.filter((r) => r.status === "sent").length} emailed so far`);
  process.exit(0);
}
if (day === 0 || day === 6) { console.log("RESULT outreach: weekend, nothing sent"); process.exit(0); }
if (!ADDRESS) { console.log("RESULT outreach: no mailing address secret (FUNNEL_MAILING_ADDRESS), nothing sent"); process.exit(0); }

const api = client(await accessToken(process.env.GMAIL_SHOP_REFRESH_TOKEN?.trim(), process.env.GMAIL_SHOP_CLIENT_ID || process.env.GMAIL_CLIENT_ID, process.env.GMAIL_SHOP_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET));
const me = await api("/profile");
const sent = [];
for (const r of batch) {
  const m = compose(r);
  const raw = [`From: ${encSubj("Josiah at Forever Held")} <${me.emailAddress}>`, `To: ${r.email}`, `Subject: ${encSubj(m.subject)}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(m.body).toString("base64").replace(/.{76}/g, "$&\r\n")].join("\r\n");
  try { await api("/messages/send", { method: "POST", body: JSON.stringify({ raw: b64url(raw) }) }); r.status = "sent"; r.sent = TODAY; sent.push(r.name); }
  catch (e) { r.status = "error"; console.log(`  ${r.name}: ${e.message}`); }
  await new Promise((res) => setTimeout(res, 40000 + Math.random() * 40000));
}
for (const r of rows) r.sent ??= "";
await fs.writeFile(FILE, csv(rows));
const left = rows.filter((r) => r.status === "new" && /@/.test(r.email)).length;
console.log(`RESULT outreach: ${sent.length} sent (${sent.join(", ")}); ${left} left in the queue`);
if (sent.length) await report("email-marketer", "⛪ Church outreach", `Emailed ${sent.length} church(es) about the Longest Night set: ${sent.join(", ")}. ${left} left. Replies land in the shop Gmail.`).catch(() => {});
