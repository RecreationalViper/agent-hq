// Tells the owner (Discord) about every reply to the church outreach: who wrote, from which church, and what they said.
// Also catches bounces. Reads the shop Gmail; remembers what it already reported in outreach/replies.json.
import fs from "node:fs/promises";
import { accessToken, client } from "../gmail/sweep.mjs";
import { report } from "../discord.mjs";

const FILE = "outreach/churches.csv";
const parse = (t) => { const [head, ...rows] = t.trim().split("\n"); const k = head.split(","); return rows.map((r) => { const v = r.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((x) => x.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')); return Object.fromEntries(k.map((x, i) => [x, v[i] || ""])); }); };
const csv = (rows) => { const k = [...new Set(rows.flatMap((r) => Object.keys(r)))]; return [k.join(","), ...rows.map((r) => k.map((x) => /[",]/.test(r[x] || "") ? `"${r[x].replace(/"/g, '""')}"` : (r[x] || "")).join(","))].join("\n") + "\n"; };
const decode = (d) => Buffer.from(d.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
function bodyText(part) {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decode(part.body.data);
  for (const p of part.parts || []) { const t = bodyText(p); if (t) return t; }
  if (part.mimeType === "text/html" && part.body?.data) return decode(part.body.data).replace(/<[^>]+>/g, " ");
  return "";
}

const rows = parse(await fs.readFile(FILE, "utf8"));
const sent = rows.filter((r) => r.status === "sent" || r.status === "replied");
if (!sent.length) { console.log("RESULT outreach replies: nothing sent yet"); process.exit(0); }
const seen = JSON.parse(await fs.readFile("outreach/replies.json", "utf8").catch(() => "[]"));
const api = client(await accessToken(process.env.GMAIL_SHOP_REFRESH_TOKEN?.trim(), process.env.GMAIL_SHOP_CLIENT_ID || process.env.GMAIL_CLIENT_ID, process.env.GMAIL_SHOP_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET));

const domains = [...new Set(sent.map((r) => r.email.split("@")[1]).filter((d) => !/gmail|yahoo|outlook|aol|hotmail/.test(d)))];
const froms = [...sent.map((r) => r.email), ...domains].map((x) => `from:${x}`).join(" OR ");
const q = `(${froms} OR (from:mailer-daemon subject:"Longest Night")) newer_than:30d -in:sent`;
const { messages = [] } = await api(`/messages?${new URLSearchParams({ q, maxResults: "50" })}`);
let n = 0;
for (const { id } of messages.reverse()) {
  if (seen.includes(id)) continue;
  const m = await api(`/messages/${id}?format=full`);
  const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
  const from = h.from || "";
  const addr = (from.match(/<([^>]+)>/)?.[1] || from).toLowerCase().trim();
  const text = bodyText(m.payload).replace(/\r/g, "").replace(/\n>.*$/gs, "").replace(/\nOn .+wrote:[\s\S]*$/, "").trim().slice(0, 1500);
  const bounce = /mailer-daemon|postmaster/i.test(addr);
  const row = bounce ? sent.find((r) => text.toLowerCase().includes(r.email.toLowerCase())) : (sent.find((r) => r.email.toLowerCase() === addr) || sent.find((r) => addr.endsWith("@" + r.email.split("@")[1])));
  if (row) { row.status = bounce ? "bounced" : "replied"; row.replied = new Date(Number(m.internalDate)).toISOString().slice(0, 10); }
  const title = bounce ? `⛪ Email bounced: ${row?.name || "a church"}` : `⛪ Reply from ${row?.name || addr}`;
  const body = bounce ? `The email to ${row?.email || "a church"} didn't go through (address no longer works). It's marked bounced; no action needed.`
    : `**From:** ${from}\n**Church:** ${row ? `${row.name} (${row.city})` : "unknown"}\n**When:** ${new Date(Number(m.internalDate)).toLocaleString("en-US", { timeZone: "America/New_York" })}\n**Subject:** ${h.subject || ""}\n\n${text}\n\n_Reply from the shop Gmail (foreverheld.shop@gmail.com)._`;
  await report("email-marketer", title, body).catch(() => {});
  console.log(`  ${title}`);
  seen.push(id); n++;
}
await fs.writeFile("outreach/replies.json", JSON.stringify(seen.slice(-500)) + "\n");
await fs.writeFile(FILE, csv(rows));
console.log(`RESULT outreach replies: ${n} new`);
