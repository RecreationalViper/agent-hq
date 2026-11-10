// Gmail Junk Sweeper — runs once a day, in bulk, on GitHub Actions (see .github/workflows/gmail-sweeper.yml).
//
// Rules first, AI last: almost every email is decided by sender, subject, Gmail's own
// category and the sign-in checks Gmail already did, at zero AI cost. Only bulk mail the
// rules can't place is sent to the free AI, and only its sender domain + subject.
//
//   KEEP     anything a person wrote, anything you replied to, account/security/money/order
//            mail, and anything from a protected domain. When unsure: keep.
//   PHISHING marked as spam + labelled "Junk Sweeper".
//   JUNK     labelled "Junk Sweeper" then moved to Trash (recoverable for 30 days).
//
// This repo is PUBLIC, so the Actions log only ever shows counts. Senders and subjects go
// to your private Discord #inbox channel (or your terminal when run locally).
//
// Secrets: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN (+ _2 … _5 for more
// accounts). Optional: GMAIL_OWNER_NAMES ("josiah,joe"), GMAIL_KEEP_DOMAINS, GMAIL_JUNK_DOMAINS.
//
//   node gmail/sweep.mjs             sweep for real
//   node gmail/sweep.mjs --dry-run   show what it would do, change nothing
//   node gmail/sweep.mjs --selftest  check the rules against sample emails (no network)
import { gwFetch } from "../ai-gateway.mjs";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const GMAIL = process.env.GMAIL_API_BASE || "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const LABEL = "Junk Sweeper";
const DRY = process.argv.includes("--dry-run");
const CI = Boolean(process.env.CI);
const list = (s) => (s || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

export async function loadRules() {
  const r = JSON.parse(await fs.readFile(HERE + "rules.json", "utf8"));
  return {
    ...r,
    keepDomains: [...r.keepDomains, ...list(process.env.GMAIL_KEEP_DOMAINS)],
    junkDomains: [...r.junkDomains, ...list(process.env.GMAIL_JUNK_DOMAINS)],
    owners: list(process.env.GMAIL_OWNER_NAMES || "josiah,joe"),
    keepRe: new RegExp(r.keepSubject, "i"),
    junkRe: new RegExp(r.junkSubject, "i"),
    phishRe: new RegExp(r.phishingSubject, "i")
  };
}

// ---------- classification (pure, no network) ----------
const domainOf = (addr) => ((addr || "").match(/@([^>\s]+)/)?.[1] || "").toLowerCase().replace(/[>"]/g, "");
const nameOf = (h) => (h || "").replace(/<[^>]*>/, "").replace(/"/g, "").trim().toLowerCase();
// "mail.etsy.com" matches "etsy.com"; "gov" matches any .gov
const inDomains = (d, set) => set.some((x) => d === x || d.endsWith("." + x));

export function classify(t, R) {
  const h = t.headers;
  const from = domainOf(h.from);
  const subject = h.subject || "";
  const auth = (h["authentication-results"] || "").toLowerCase();
  const bulk = Boolean(h["list-unsubscribe"]) || /bulk|list/i.test(h.precedence || "");
  const authFail = /dmarc=fail|spf=fail|dkim=fail/.test(auth);
  const protectedSender = inDomains(from, R.keepDomains) && !authFail;

  if (t.youReplied) return ["keep", "you replied"];

  // Phishing: needs at least two warning signs, and never fires on a protected sender.
  if (!protectedSender) {
    let score = 0; const why = [];
    const toName = nameOf(h.to);
    if (toName && !toName.includes("@") && R.owners.length && !R.owners.some((n) => toName.includes(n))) { score += 2; why.push("addressed to someone else"); }
    if (authFail) { score += 2; why.push("failed Gmail's sender checks"); }
    if (R.phishRe.test(subject)) { score += 2; why.push("scam-style subject"); }
    const replyTo = domainOf(h["reply-to"]);
    if (replyTo && replyTo !== from && !replyTo.endsWith("." + from) && !from.endsWith("." + replyTo)) { score += 1; why.push("reply-to goes elsewhere"); }
    if (score >= 3) return ["phishing", why.join(", ")];
  }

  if (protectedSender) return ["keep", "protected sender"];
  if (R.keepRe.test(subject)) return ["keep", "account/order/security mail"];
  if (inDomains(from, R.junkDomains)) return ["junk", "junk sender"];
  if (t.labels.includes("CATEGORY_PROMOTIONS")) return ["junk", "Gmail: Promotions"];
  if (bulk && R.junkRe.test(subject)) return ["junk", "marketing subject"];
  if (bulk || t.labels.includes("CATEGORY_SOCIAL") || t.labels.includes("CATEGORY_FORUMS")) return ["unsure", "bulk mail"];
  return ["keep", "looks personal"];
}

// ---------- Gmail API ----------
async function accessToken(refresh) {
  const res = await fetch(TOKEN_URL, { method: "POST", signal: AbortSignal.timeout(20000), body: new URLSearchParams({ client_id: process.env.GMAIL_CLIENT_ID.trim(), client_secret: process.env.GMAIL_CLIENT_SECRET.trim(), refresh_token: refresh.trim(), grant_type: "refresh_token" }) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Plain-English fixes. Only Google's error code is shown, never a key.
    const fix = {
      invalid_client: "GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET don't match. Both must come from the SAME Google client (the one used in the OAuth Playground)",
      unauthorized_client: "the refresh token was made with a different client than GMAIL_CLIENT_ID. Use the Client ID + secret you pasted into the Playground",
      invalid_grant: "the refresh token is wrong, expired or revoked (testing-mode tokens last 7 days). Make a new one in the OAuth Playground",
      invalid_request: "a secret is empty or has extra characters. Re-paste all three"
    }[d.error];
    throw new Error(`Google sign-in failed: ${d.error || res.status}${fix ? ` — ${fix}` : d.error_description ? ` — ${d.error_description}` : ""}`);
  }
  return d.access_token;
}

function client(token) {
  return async function api(path, init = {}) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(GMAIL + path, { ...init, signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue; }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Gmail ${res.status}: ${/has not been used|is disabled/i.test(d.error?.message || "") ? "the Gmail API isn't turned on for this Google project — enable it in Google Cloud" : res.status === 403 ? "permission denied — when making the refresh token, use the gmail.modify scope and tick Allow" : (d.error?.message || "").slice(0, 200)}`);
      return d;
    }
    throw new Error("Gmail kept rate-limiting");
  };
}

const HEADERS = ["From", "To", "Subject", "Reply-To", "List-Unsubscribe", "Precedence", "Authentication-Results"];

async function fetchThreads(api, R) {
  const ids = [];
  let pageToken;
  do {
    const q = new URLSearchParams({ q: R.query, maxResults: "100", ...(pageToken ? { pageToken } : {}) });
    const d = await api(`/threads?${q}`);
    ids.push(...(d.threads || []).map((t) => t.id));
    pageToken = d.nextPageToken;
  } while (pageToken && ids.length < R.maxThreads);

  const out = [];
  for (const id of ids.slice(0, R.maxThreads)) {
    const q = new URLSearchParams([["format", "metadata"], ...HEADERS.map((h) => ["metadataHeaders", h])]);
    const t = await api(`/threads/${id}?${q}`);
    const msgs = t.messages || [];
    const first = msgs.find((m) => !(m.labelIds || []).includes("SENT")) || msgs[0];
    if (!first) continue;
    const headers = {};
    for (const { name, value } of first.payload?.headers || []) headers[name.toLowerCase()] ??= value;
    out.push({ id, headers, labels: [...new Set(msgs.flatMap((m) => m.labelIds || []))], youReplied: msgs.some((m) => (m.labelIds || []).includes("SENT")) });
  }
  return out;
}

async function labelId(api) {
  const { labels = [] } = await api("/labels");
  const found = labels.find((l) => l.name === LABEL);
  if (found) return found.id;
  return (await api("/labels", { method: "POST", body: JSON.stringify({ name: LABEL, labelListVisibility: "labelShow", messageListVisibility: "show" }) })).id;
}

// ---------- AI for the leftovers (sender domain + subject only) ----------
async function askAI(items) {
  if (!items.length) return {};
  const system = "You sort a person's email. For each item reply JUNK if it is marketing, a promotion, an offer, a mass newsletter, a digest or a job-alert blast; reply KEEP if it could be a real account notice, receipt, security message, bill, appointment, or anything personal. When unsure, KEEP. Answer only with JSON: {\"<id>\":\"JUNK\"|\"KEEP\"}.";
  const user = JSON.stringify(items.map((t) => ({ id: t.id, from: domainOf(t.headers.from), subject: (t.headers.subject || "").slice(0, 160) })));
  const parse = (txt) => { const m = (txt || "").match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : {}; };
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
      const res = await gwFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY.trim()}`, { method: "POST", signal: AbortSignal.timeout(60000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }) });
      const d = await res.json();
      if (res.ok) return parse(d.candidates?.[0]?.content?.parts?.map((p) => p.text).join(""));
      console.log(`  Gemini unavailable (${res.status}); trying the backup AI`);
    } catch (e) { console.log(`  Gemini failed (${e.message.split("\n")[0]}); trying the backup AI`); }
  }
  try {
    const { hasGroq, groqChat } = await import("../ai-fallback.mjs");
    if (hasGroq()) return parse(await groqChat(system, user, { json: true, temperature: 0 }));
  } catch (e) { console.log(`  backup AI failed (${e.message.split("\n")[0]})`); }
  console.log("  no AI available — keeping the unsure emails");
  return {};
}

// ---------- one account ----------
async function sweep(refresh, n, R) {
  const api = client(await accessToken(refresh));
  const threads = await fetchThreads(api, R);
  const decided = threads.map((t) => ({ t, d: classify(t, R) }));
  const unsure = decided.filter((x) => x.d[0] === "unsure");
  if (unsure.length) {
    const verdicts = await askAI(unsure.map((x) => x.t));
    for (const x of unsure) x.d = String(verdicts[x.t.id]).toUpperCase() === "JUNK" ? ["junk", "AI: marketing"] : ["keep", "AI: unsure, kept"];
  }
  const junk = decided.filter((x) => x.d[0] === "junk"), phish = decided.filter((x) => x.d[0] === "phishing");
  if (!DRY && (junk.length || phish.length)) {
    const lid = await labelId(api);
    for (const { t } of phish) await api(`/threads/${t.id}/modify`, { method: "POST", body: JSON.stringify({ addLabelIds: ["SPAM", lid], removeLabelIds: ["INBOX"] }) });
    for (const { t } of junk) {
      await api(`/threads/${t.id}/modify`, { method: "POST", body: JSON.stringify({ addLabelIds: [lid] }) });
      await api(`/threads/${t.id}/trash`, { method: "POST" });
    }
  }
  return { n, scanned: threads.length, junk, phish, kept: decided.length - junk.length - phish.length, aiAsked: unsure.length };
}

function line({ t, d }) { return `• ${(t.headers.from || "").replace(/<.*>/, "").trim() || domainOf(t.headers.from)} — ${t.headers.subject || "(no subject)"} _(${d[1]})_`; }

async function main() {
  const R = await loadRules();
  if (process.argv.includes("--selftest")) return selftest(R);
  const missing = ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"].filter((k) => !process.env[k]);
  if (missing.length) { // not set up yet: skip quietly instead of failing (and alerting) every day
    const msg = `Not set up yet: add ${missing.join(", ")} (see gmail/README.md). Skipping.`;
    console.log(msg);
    if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `### Gmail Junk Sweeper\n${msg}\n`);
    return;
  }
  const tokens = [process.env.GMAIL_REFRESH_TOKEN, ...[2, 3, 4, 5].map((i) => process.env[`GMAIL_REFRESH_TOKEN_${i}`])].filter(Boolean);

  const results = [], failures = [];
  for (const [i, tok] of tokens.entries()) {
    try { results.push(await sweep(tok, i + 1, R)); }
    catch (e) {
      failures.push(`account ${i + 1}: ${e.message}`);
      console.log(CI ? `::error title=Gmail Junk Sweeper::Account ${i + 1}: ${e.message}` : `Account ${i + 1} failed: ${e.message}`); // shows on the run page
    }
  }

  const sum = (k) => results.reduce((a, r) => a + (Array.isArray(r[k]) ? r[k].length : r[k]), 0);
  const counts = `${DRY ? "[dry run] " : ""}${sum("scanned")} scanned · ${sum("junk")} trashed · ${sum("phish")} phishing → spam · ${sum("kept")} kept · ${sum("aiAsked")} asked AI`;
  console.log(counts); // counts only: this log is public
  if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `### Gmail Junk Sweeper\n${counts}\n${failures.length ? `\n**Problem:**\n${failures.map((f) => `- ${f}`).join("\n")}\n` : ""}`);

  const detail = results.map((r) => [
    tokens.length > 1 ? `**Account ${r.n}**` : "",
    r.phish.length ? `**🎣 Phishing → Spam**\n${r.phish.map(line).join("\n")}` : "",
    r.junk.length ? `**🗑️ Trashed**\n${r.junk.map(line).join("\n")}` : ""
  ].filter(Boolean).join("\n")).filter((s) => s.includes("•")).join("\n\n");

  if (!CI) { if (detail) console.log("\n" + detail); return; }
  if (!detail && !failures.length) return;
  const { report, alert } = await import("../discord.mjs");
  if (detail) await report("inbox", `Inbox sweep: ${sum("junk")} trashed, ${sum("phish")} phishing`, `${detail}\n\nAll recoverable from Trash / Spam (label "Junk Sweeper").`, { color: sum("phish") ? 0xa8432f : 0x6d7f5f });
  if (failures.length) { await alert(`⚠️ Gmail Junk Sweeper: ${failures.join("; ")}`); process.exitCode = 1; }
}

// ---------- selftest ----------
function selftest(R) {
  const mk = (from, subject, { to = "Josiah Cottingham <me@gmail.com>", labels = ["CATEGORY_UPDATES"], bulk = true, auth = "dmarc=pass", replyTo, youReplied = false } = {}) =>
    ({ id: subject, labels, youReplied, headers: { from, to, subject, "authentication-results": auth, ...(bulk ? { "list-unsubscribe": "<mailto:x@y>" } : {}), ...(replyTo ? { "reply-to": replyTo } : {}) } });
  const cases = [
    ["phishing", mk("Improve Trust <caleb@improvetrust.com>", "Verify your e-deposit update, tyler", { to: "tyler cottingham <me@gmail.com>", bulk: false })],
    ["phishing", mk("Support <help@paypa1-secure.com>", "Your account suspended", { auth: "dmarc=fail", bulk: false })],
    ["keep", mk("Etsy <transaction@etsy.com>", "You made a sale on Etsy!")],
    ["keep", mk("Capital One <capitalone@notification.capitalone.com>", "Josiah, the payment status of one of your accounts changed")],
    ["keep", mk("MoneyLion <hello@iemail.moneylion.com>", "Hey Josiah, check this update on your credit report.")],
    ["keep", mk("Robinhood <noreply@robinhood.com>", "SPYG has published information for its investors")],
    ["keep", mk("Mom <mom@gmail.com>", "dinner sunday?", { bulk: false })],
    ["keep", mk("Shop <deals@store.com>", "50% off everything", { youReplied: true })],
    ["junk", mk("Glassdoor Jobs <noreply@glassdoor.com>", "The River Merchant is hiring. Apply Now.")],
    ["junk", mk("Famous Footwear <x@email.famousfootwear.com>", "Joe, BOGO 1/2 off is BACK", { labels: ["CATEGORY_PROMOTIONS"] })],
    ["junk", mk("MoneyLion <hello@iemail.moneylion.com>", "Ready to consolidate your debt?", { labels: ["CATEGORY_PROMOTIONS"] })],
    ["junk", mk("Daily Joke Drop <d@mx.robly.com>", "Why Did the Sloth Get Fired?")],
    ["junk", mk("LendingTree <email@savings.lendingtree.com>", "Josiah, your new card is waiting")],
    ["unsure", mk("Some Brand <news@brand.com>", "A note from our founder")]
  ];
  let bad = 0;
  for (const [want, t] of cases) {
    const [got, why] = classify(t, R);
    const ok = got === want; if (!ok) bad++;
    console.log(`${ok ? "ok  " : "FAIL"} ${want.padEnd(8)} ${got.padEnd(8)} ${t.headers.subject}  (${why})`);
  }
  console.log(bad ? `${bad} case(s) failed` : `all ${cases.length} cases pass`);
  if (bad) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === (await fs.realpath(process.argv[1]))) {
  main().catch((e) => { console.error(e.message); process.exitCode = 1; });
}
