// Fills in missing websites and public office emails for outreach/churches.csv.
// Website: Exa search (if missing). Email: the church's own site (home, contact, about pages), mailto links first.
// Only emails on the church's own domain (or a clearly church-run address on its own site) are kept.
import fs from "node:fs/promises";
import { hasExa, search } from "../exa.mjs";

const FILE = "outreach/churches.csv";
const parse = (t) => { const [head, ...rows] = t.trim().split("\n"); const k = head.split(","); return rows.map((r) => { const v = r.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((x) => x.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')); return Object.fromEntries(k.map((x, i) => [x, v[i] || ""])); }); };
const csv = (rows) => { const k = Object.keys(rows[0]); return [k.join(","), ...rows.map((r) => k.map((x) => /[",]/.test(r[x]) ? `"${r[x].replace(/"/g, '""')}"` : r[x]).join(","))].join("\n") + "\n"; };
const SKIP = /directory|faithstreet|churchfinder|facebook|yelp|mapquest|guidestar|naicslist|churcheslist|learnofchrist|christianity\.com|patch\.com|wikipedia|youtube|instagram|linkedin|cvcc\.org|pewsearch|devout\.org|tripadvisor|findagrave/i;

async function get(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; ForeverHeld/1.0)" } }); return r.ok ? await r.text() : ""; } catch { return ""; }
}
function emails(html, host) {
  const found = [...html.matchAll(/mailto:([^"'?>\s]+)/gi)].map((m) => decodeURIComponent(m[1]))
    .concat([...html.replace(/<[^>]+>/g, " ").matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((m) => m[0]));
  const ok = [...new Set(found.map((e) => e.toLowerCase().replace(/[.,;]+$/, "")))].filter((e) => !/\.(png|jpg|gif|webp)$|example\.|sentry|wixpress|wordpress|godaddy|domain\.com|email\.com/.test(e));
  const base = host.replace(/^www\./, "").split(".").slice(-2).join(".");
  const own = ok.filter((e) => e.endsWith("@" + base) || e.endsWith("." + base));
  const pool = own.length ? own : ok.filter((e) => /gmail|outlook|yahoo|aol|sbcglobal|att\.net|hotmail/.test(e));
  const rank = (e) => /^(office|info|church|admin|secretary|welcome|contact|hello|parish)/.test(e) ? 0 : /pastor|rector|rev|minister/.test(e) ? 1 : 2;
  return pool.sort((a, b) => rank(a) - rank(b));
}

const rows = parse(await fs.readFile(FILE, "utf8"));
let filled = 0;
for (const r of rows) {
  if (r.email || r.status !== "new") continue;
  if (!r.website && hasExa()) {
    const res = await search(`${r.name} ${r.city} Ohio church official website`, { num: 5, chars: 0, who: "outreach" }).catch(() => []);
    const hit = res.find((x) => !SKIP.test(x.url));
    if (hit) r.website = new URL(hit.url).origin;
  }
  if (!r.website) { console.log(`  no website: ${r.name}`); continue; }
  const host = new URL(r.website).host;
  let best = [];
  for (const p of ["", "/contact", "/contact-us", "/about", "/about-us", "/staff", "/connect"]) {
    best = emails(await get(r.website.replace(/\/$/, "") + p), host);
    if (best.length) break;
  }
  if (best[0]) { r.email = best[0]; filled++; console.log(`  ${r.name}: ${r.email}`); } else console.log(`  no email found: ${r.name} (${r.website})`);
}
await fs.writeFile(FILE, csv(rows));
console.log(`RESULT church leads: ${filled} new emails, ${rows.filter((r) => r.email).length}/${rows.length} churches have one`);
