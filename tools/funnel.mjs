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

// ---------- pretty HTML (email/template.html, or the Mailjet template if one is saved there) ----------
const MJ_KEY = (process.env.MAILJET_API_KEY || process.env.MJ_APIKEY_PUBLIC || process.env.MAILJET_PUBLIC_KEY || "").trim();
const MJ_SECRET = (process.env.MAILJET_SECRET_KEY || process.env.MAILJET_API_SECRET || process.env.MJ_APIKEY_PRIVATE || process.env.MAILJET_SECRET || "").trim();
const MJ_NAME = "Forever Held – Welcome email";
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let template, fromHeader;

async function mj(path, init = {}) {
  const r = await fetch("https://api.mailjet.com/v3/REST" + path, { ...init, signal: AbortSignal.timeout(20000),
    headers: { Authorization: "Basic " + Buffer.from(`${MJ_KEY}:${MJ_SECRET}`).toString("base64"), "Content-Type": "application/json" } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mailjet ${r.status}: ${j.ErrorMessage || "error"}`);
  return j.Data || [];
}
// Keeps the design in Mailjet (editable in its HTML editor) and uses Mailjet's copy when it still has the {{var:...}} tags.
async function loadTemplate() {
  if (template) return template;
  const local = await fs.readFile("email/template.html", "utf8");
  template = local;
  if (!MJ_KEY || !MJ_SECRET) return template;
  try {
    let [t] = (await mj(`/template?Name=${encodeURIComponent(MJ_NAME)}&OwnerType=user`)).filter((x) => x.Name === MJ_NAME);
    if (!t) {
      [t] = await mj("/template", { method: "POST", body: JSON.stringify({ Name: MJ_NAME, OwnerType: "user", Locale: "en_US", Purposes: ["marketing"], EditMode: 2 }) });
      await mj(`/template/${t.ID}/detailcontent`, { method: "POST", body: JSON.stringify({ "Html-part": local, "Text-part": "{{var:text}}" }) });
      console.log("  saved the email design to Mailjet as a template");
    }
    const [c] = await mj(`/template/${t.ID}/detailcontent`);
    const html = c?.["Html-part"] || "";
    if (/\{\{var:body\}\}/.test(html) && /\{\{var:unsub\}\}/.test(html)) { template = html; console.log("  using the Mailjet design"); }
    else console.log("  Mailjet design is missing {{var:body}} or {{var:unsub}}; using email/template.html");
  } catch (e) { console.log(`  Mailjet: ${e.message}; using email/template.html`); }
  return template;
}

function bodyHtml(text, cta) {
  return text.split(/\n{2,}/).map((para) => {
    const lines = para.split("\n");
    if (lines.every((l) => /^- /.test(l))) return `<ul style="margin:0 0 16px;padding-left:20px;">${lines.map((l) => `<li style="margin:0 0 8px;">${esc(l.slice(2))}</li>`).join("")}</ul>`;
    const last = lines.at(-1).trim();
    let button = "";
    if (/^https?:\/\/\S+$/.test(last)) {
      lines.pop();
      button = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;"><tr><td style="background:#647358;border-radius:999px;">` +
        `<a href="${esc(last)}" style="display:inline-block;padding:12px 26px;font-weight:500;font-size:15px;color:#ffffff;text-decoration:none;">${esc(cta || "Take a look")}</a></td></tr></table>`;
    }
    const txt = lines.join("\n").trim().replace(/:$/, ".");
    return (txt ? `<p style="margin:0 0 16px;">${esc(txt).replace(/\n/g, "<br>")}</p>` : "") + button;
  }).join("\n");
}

async function send(api, p, step, feed) {
  const email = p.email_address;
  const first = (p.fields?.FirstName || p.fields?.first_name || "").trim().split(/\s+/)[0] || "there";
  const unsub = `${feed.url}/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubToken(email)}`;
  const text = step.body.replaceAll("{first}", first);
  const plain = `${text}\n\n--\nForever Held · ${ADDRESS}\nYou're getting this because you downloaded our free planning checklist.\nUnsubscribe: ${unsub}`;
  const vars = { subject: esc(step.subject), preheader: esc(step.preheader || ""), body: bodyHtml(text, step.cta), address: esc(ADDRESS), unsub: esc(unsub), text: esc(plain) };
  const html = (await loadTemplate()).replace(/\{\{\s*var:(\w+)(?:[^}]*)\}\}/g, (_, k) => vars[k] ?? "");
  if (!fromHeader) { const me = await api("/profile").catch(() => ({})); fromHeader = me.emailAddress ? `${encSubj("Forever Held")} <${me.emailAddress}>` : null; }
  const b = "fh" + crypto.randomBytes(12).toString("hex");
  const raw = [...(fromHeader ? [`From: ${fromHeader}`] : []), `To: ${email}`, `Subject: ${encSubj(step.subject)}`, "MIME-Version: 1.0",
    `List-Unsubscribe: <${unsub}>`, "List-Unsubscribe-Post: List-Unsubscribe=One-Click", `Content-Type: multipart/alternative; boundary="${b}"`, "",
    `--${b}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(plain).toString("base64").replace(/.{76}/g, "$&\r\n"),
    `--${b}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(html).toString("base64").replace(/.{76}/g, "$&\r\n"),
    `--${b}--`, ""].join("\r\n");
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
    for (const p of people) for (const step of funnel.steps) { if (n) await new Promise((r) => setTimeout(r, 45000)); await send(api, p, step, feed); n++; }
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
