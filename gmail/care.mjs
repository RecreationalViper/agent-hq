// Customer Care: finds buyer emails about Forever Held and writes a kind reply as a Gmail DRAFT.
// It never sends anything: the owner reads the draft in Gmail and taps Send (or deletes it).
// Runs daily after the Junk Sweeper (.github/workflows/gmail-sweeper.yml).
// This repo is PUBLIC: the Actions log shows counts only; subjects go to the private Discord #inbox.
//
//   node gmail/care.mjs            write drafts
//   node gmail/care.mjs --dry-run  show counts, write nothing
import { accessToken, client } from "./sweep.mjs";
import { ask } from "../ai-ask.mjs";
import { report } from "../discord.mjs";

const DRY = process.argv.includes("--dry-run");
// Recent inbox mail from people, that mentions the shop or an order. Skips promotions/social and our own mail.
const QUERY = 'in:inbox newer_than:3d -from:me -category:promotions -category:social -category:forums ' +
  '(payhip OR "forever held" OR foreverheld OR order OR download OR pdf OR program OR memorial OR funeral OR "welcome sign" OR refund OR purchase OR receipt OR acrobat OR printable)';

const FACTS = `Forever Held sells fill-in memorial printables (PDFs) on Payhip: https://payhip.com/ForeverHeld
Live product: Soft Botanical memorial bundle, $12.99 (https://payhip.com/b/vqNSA): folded program (US Letter landscape, folds to 5.5x8.5 in, 4 panels), welcome sign (24x36 in, also prints 16x24 or 12x18), share-a-memory card (4.25x5.5 in), plus extras.
How to fill in: open the PDF in the free Adobe Acrobat Reader app (phone or computer), tap a text box, type, save, then print at home or at a print shop. Do NOT use Preview or a browser to fill in; they can lose the text.
Downloads: the Payhip receipt email has the download link; buyers can also re-download from that email.
Canva is NOT used: never tell anyone to edit in Canva.
The owner approves refunds, discounts and anything unusual: say "I'll look into this personally" rather than promising.`;

const SYSTEM = `You are Customer Care for Forever Held, a small memorial printables shop. Many buyers are grieving and planning a service under time pressure.
${FACTS}
Decide if an email is from a buyer or would-be buyer of Forever Held (questions about files, downloading, filling in, printing, sizes, custom requests, refunds, or a Payhip "message from a customer"). Ignore newsletters, receipts the shop received from services, spam and personal mail.
If it is, write a reply: warm, calm, short (60-140 words), answer the actual question with clear steps, offer condolences only if they mention a loss (once, simply), sign as "Josiah, Forever Held". Never promise refunds or discounts; never invent facts not listed above.
Answer as JSON: {"customer": true|false, "reason": "...", "reply": "..."}`;

const b64url = (s) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const decode = (d) => Buffer.from((d || "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
function bodyText(part) {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decode(part.body.data);
  for (const p of part.parts || []) { const t = bodyText(p); if (t) return t; }
  if (part.mimeType === "text/html" && part.body?.data) return decode(part.body.data).replace(/<[^>]+>/g, " ");
  return "";
}

async function care(refresh, n) {
  const api = client(await accessToken(refresh));
  const { threads = [] } = await api(`/threads?${new URLSearchParams({ q: QUERY, maxResults: "25" })}`);
  const out = [];
  for (const { id } of threads) {
    const t = await api(`/threads/${id}?format=full`);
    const msgs = t.messages || [];
    const labels = msgs.flatMap((m) => m.labelIds || []);
    if (labels.includes("DRAFT") || labels.includes("SENT")) continue; // already answered or a draft is waiting
    const last = msgs[msgs.length - 1];
    const h = Object.fromEntries((last.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
    if (h["list-unsubscribe"] || /no-?reply|mailer-daemon|notifications?@/i.test(h["reply-to"] || h.from || "")) continue;
    const text = bodyText(last.payload).replace(/\n>.*$/gs, "").slice(0, 4000);
    let r;
    try { r = await ask(SYSTEM, `From: ${h.from}\nSubject: ${h.subject}\n\n${text}`, { json: true, temperature: 0.3 }); }
    catch (e) { console.log(`  account ${n}: AI unavailable (${e.message.slice(0, 80)})`); break; }
    if (!r?.customer || !r.reply) continue;
    const to = h["reply-to"] || h.from;
    const subject = /^re:/i.test(h.subject || "") ? h.subject : `Re: ${h.subject || "your message"}`;
    const raw = [`To: ${to}`, `Subject: ${subject}`, `In-Reply-To: ${h["message-id"] || ""}`, `References: ${[h.references, h["message-id"]].filter(Boolean).join(" ")}`, "Content-Type: text/plain; charset=UTF-8", "", r.reply].join("\r\n");
    if (!DRY) await api("/drafts", { method: "POST", body: JSON.stringify({ message: { threadId: id, raw: b64url(raw) } }) });
    out.push(`• ${(h.from || "").replace(/<.*>/, "").trim()} — ${h.subject || "(no subject)"}`);
  }
  return out;
}

async function main() {
  const tokens = ["", "_2", "_3", "_4", "_5"].map((s) => process.env[`GMAIL_REFRESH_TOKEN${s}`]).filter(Boolean);
  if (!tokens.length) return console.log("RESULT care: no Gmail token saved; skipped");
  const lines = [];
  for (const [i, tok] of tokens.entries()) {
    try { lines.push(...await care(tok, i + 1)); }
    catch (e) { console.log(`  account ${i + 1}: ${e.message.slice(0, 160)}`); }
  }
  console.log(`RESULT care: ${lines.length} buyer email(s) ${DRY ? "found (dry run)" : "answered as drafts"}`);
  if (lines.length && !DRY) await report("customer-care", `Customer Care: ${lines.length} reply draft(s) waiting in Gmail`,
    `${lines.join("\n")}\n\nOpen Gmail → Drafts, read each reply, edit if needed, then tap Send. Nothing was sent.`, { color: 0x3d6b55 });
}
main().catch((e) => { console.log(`RESULT care: FAILED ${e.message}`); });
