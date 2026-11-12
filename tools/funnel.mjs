// Email funnel: welcome series for new subscribers (free Planning Checklist -> EmailOctopus list).
// Reads new contacts from EmailOctopus (API v2, read), sends the steps in email/funnel.json from the shop Gmail,
// one step per run per person, on day 1, 3 and 7. Every email has a working unsubscribe link (the sales Worker
// unsubscribes them in EmailOctopus) and the shop's mailing address (US CAN-SPAM requires a postal address).
// Progress is kept in email/funnel-state.json using hashed emails only (this repo is public).
// SENDING IS OFF until the secret FUNNEL_MAILING_ADDRESS is saved (and FUNNEL_SEND is not "off").
//   node tools/funnel.mjs            run
//   node tools/funnel.mjs --dry-run  show what it would send, send nothing
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { accessToken, client } from "../gmail/sweep.mjs";
import { report } from "../discord.mjs";

const DRY = process.argv.includes("--dry-run");
// --test: send every step now, marked [Test], to the list's subscribers. Only allowed while the list has 3 or fewer
// people (the owner testing on themself). Progress is not changed.
const TEST = process.argv.includes("--test");
const EO = "https://api.emailoctopus.com";
const KEY = process.env.EMAILOCTOPUS_API_KEY?.trim();
const PAYHIP = process.env.PAYHIP_API_KEY?.trim();
const ADDRESS = process.env.FUNNEL_MAILING_ADDRESS?.trim();
const DAILY_CAP = 150; // well under Gmail's daily limit
const hash = (e) => crypto.createHash("sha256").update("fh:" + e.toLowerCase().trim()).digest("hex").slice(0, 24);
export const unsubToken = (email, key = PAYHIP) => crypto.createHash("sha256").update(`unsub:${key}:${email.toLowerCase().trim()}`).digest("hex").slice(0, 24);
const b64url = (s) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const encSubj = (s) => `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;

async function eo(path) {
  const r = await fetch(EO + path, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`EmailOctopus ${r.status}: ${j.title || j.detail || "error"}`);
  return j;
}

async function subscribers() {
  const lists = (await eo("/lists")).data || [];
  const list = lists.find((l) => l.id === process.env.EO_LIST_ID) || lists[0];
  if (!list) return { list: null, people: [] };
  const people = [];
  let path = `/lists/${list.id}/contacts?status=subscribed&limit=100`;
  for (let i = 0; path && i < 30; i++) {
    const page = await eo(path);
    people.push(...(page.data || []));
    const next = page.paging?.next?.starting_after;
    path = next ? `/lists/${list.id}/contacts?status=subscribed&limit=100&starting_after=${next}` : null;
  }
  return { list, people };
}

async function send(api, p, step, feed) {
  const email = p.email_address;
  const first = (p.fields?.FirstName || p.fields?.first_name || "").trim().split(/\s+/)[0] || "there";
  const unsub = `${feed.url}/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubToken(email)}`;
  const body = `${step.body.replaceAll("{first}", first)}\n\n--\nForever Held · ${ADDRESS}\nYou're getting this because you downloaded our free planning checklist.\nUnsubscribe: ${unsub}`;
  const raw = [`To: ${email}`, `Subject: ${encSubj(step.subject)}`, `List-Unsubscribe: <${unsub}>`, "List-Unsubscribe-Post: List-Unsubscribe=One-Click",
    "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 8bit", "", body].join("\r\n");
  await api("/messages/send", { method: "POST", body: JSON.stringify({ raw: b64url(raw) }) });
}

async function main() {
  if (!KEY) return console.log("RESULT funnel: no EMAILOCTOPUS_API_KEY; skipped");
  const funnel = JSON.parse(await fs.readFile("email/funnel.json", "utf8"));
  const state = JSON.parse(await fs.readFile("email/funnel-state.json", "utf8").catch(() => "{}"));
  const feed = JSON.parse(await fs.readFile("sales-feed.json", "utf8").catch(() => "{}"));
  const { list, people } = await subscribers();
  console.log(`  list: ${list?.name || "none"}, ${people.length} subscribed`);
  const sendOn = Boolean(ADDRESS) && process.env.FUNNEL_SEND !== "off";
  if (!sendOn) console.log("  sending is OFF (save FUNNEL_MAILING_ADDRESS to turn it on); planning only");

  let api = null;
  if (sendOn && (!DRY || TEST)) {
    const id = process.env.GMAIL_SHOP_CLIENT_ID || process.env.GMAIL_CLIENT_ID, secret = process.env.GMAIL_SHOP_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;
    api = client(await accessToken(process.env.GMAIL_SHOP_REFRESH_TOKEN?.trim(), id, secret));
  }
  if (TEST) {
    if (!sendOn) return console.log("RESULT funnel test: sending is off (no mailing address)");
    if (people.length > 3) return console.log(`RESULT funnel test: refused, list has ${people.length} people (test only runs with 3 or fewer)`);
    let n = 0;
    for (const p of people) for (const step of funnel.steps) { await send(api, p, { ...step, subject: "[Test] " + step.subject }, feed); n++; }
    console.log(`RESULT funnel test: ${n} test email(s) sent to ${people.length} person(s)`);
    return report("email-marketer", "📧 Funnel test sent", `${n} test welcome email(s) sent. Check the inbox (and spam).`).catch(() => {});
  }
  const now = Date.now();
  let sent = 0, due = 0;
  for (const p of people) {
    const email = p.email_address;
    if (!email) continue;
    const h = hash(email);
    const s = state[h] || (state[h] = { joined: p.created_at || new Date().toISOString(), step: 0 });
    const step = funnel.steps[s.step];
    if (!step) continue;
    const dueAt = Date.parse(s.joined) + step.day * 86400e3;
    if (now < dueAt) continue;
    if (now - dueAt > 21 * 86400e3) { s.step = funnel.steps.length; continue; } // joined long before the funnel existed
    due++;
    if (!sendOn || DRY || sent >= DAILY_CAP) continue;
    try {
      await send(api, p, step, feed);
      s.step++; s.last = new Date().toISOString(); sent++;
    } catch (e) { console.log(`  send failed: ${e.message.slice(0, 120)}`); break; }
  }
  if (!DRY) await fs.writeFile("email/funnel-state.json", JSON.stringify(state, null, 1) + "\n");
  console.log(`RESULT funnel: ${due} due, ${sent} sent${sendOn ? "" : " (sending off)"}`);
  if (sent) await report("email-marketer", "📧 Welcome emails sent", `${sent} welcome email(s) went out to new checklist subscribers (day 1/3/7 series).`).catch(() => {});
}
main().catch((e) => { console.log(`RESULT funnel: FAILED ${e.message}`); process.exitCode = 1; });
