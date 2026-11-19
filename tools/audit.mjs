#!/usr/bin/env node
// Nightly audit — the doctor for the whole HQ.
//
// check-repo.mjs asks "is this change internally consistent?". This asks "is the
// business actually working?", which is a different question:
//
//   - did every scheduled agent actually produce something lately?
//   - does every product we advertise really exist, with its files and images?
//   - does every checkout link still resolve, and is it on the storefront?
//   - are we advertising a collection outside its selling window?
//
// Writes reports/health.md and exits 1 only when something is genuinely wrong, so a
// silent failure becomes a Discord alert instead of a quiet month.
//
// Usage:
//   node tools/audit.mjs                  full audit
//   AUDIT_NO_NETWORK=1 node tools/audit.mjs   offline checks only (fast, used in tests)

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const NETWORK = process.env.AUDIT_NO_NETWORK !== "1";
const TODAY = new Date().toISOString().slice(0, 10);

const problems = [];   // real: fail the run
const warnings = [];   // worth knowing, do not fail
const passed = [];     // evidence that things are fine

const bad = (area, msg) => problems.push({ area, msg });
const warn = (area, msg) => warnings.push({ area, msg });
const good = (area, msg) => passed.push({ area, msg });

const read = (p, fallback = null) => { try { return fs.readFileSync(path.join(ROOT, p), "utf8"); } catch { return fallback; } };
const readJson = (p) => { try { return JSON.parse(read(p)); } catch { return null; } };
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// ---------------------------------------------------------------- 1. agents are alive

const cfg = readJson("agents.json");
const reportFiles = (() => { try { return fs.readdirSync(path.join(ROOT, "reports")).filter((f) => f.endsWith(".md")); } catch { return []; } })();
const GRACE = { daily: 2, weekdays: 4, twice: 2, monthly: 35 };
let aliveCount = 0;

for (const agent of cfg?.agents || []) {
  if (agent.enabled === false) continue;
  const schedule = String(agent.schedule || "manual").toLowerCase();
  if (schedule === "manual") continue;

  const grace = schedule.startsWith("weekly:") ? 9 : GRACE[schedule] ?? 9;
  const mine = reportFiles
    .filter((f) => f.endsWith(`-${agent.id}.md`))
    .map((f) => (f.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1])
    .filter(Boolean)
    .sort();
  const newest = mine[mine.length - 1];
  const label = `${agent.name} (${agent.id})`;

  if (!newest) warn("agents", `${label} has never produced a report`);
  else {
    const age = daysBetween(newest, TODAY);
    if (age > grace) bad("agents", `${label} last reported ${age} days ago (${newest}) — expected every ${schedule.replace("weekly:", "")}, grace ${grace}d`);
    else { aliveCount++; good("agents", `${label} alive, last report ${age}d ago`); }
  }
  for (const f of agent.readsFiles || []) {
    if (!exists(f)) bad("agents", `${label} reads "${f}", which does not exist — it will report on nothing`);
  }
}

// ---------------------------------------------------------------- 2. products are real

const collections = readJson("products/collections.json")?.collections || [];
const storeHtml = (() => {
  try {
    return fs.readdirSync(path.join(ROOT, "store")).filter((f) => f.endsWith(".html"))
      .map((f) => ({ file: `store/${f}`, body: read(`store/${f}`) || "" }));
  } catch { return []; }
})();
const storeAll = storeHtml.map((s) => s.body).join("\n");
const agentsContext = String(cfg?.context || "");

for (const c of collections) {
  const label = c.name || c.id;
  if (c.status !== "approved") continue;

  // Two shapes exist: "live" is a checkout URL on one collection and an approval
  // date on the others, which carry "checkout" separately.
  const checkout = c.checkout || (String(c.live || "").startsWith("http") ? c.live : null);
  if (!checkout) bad("products", `${label} is approved but has no checkout link`);
  else if (!/^https:\/\/payhip\.com\//.test(checkout)) warn("products", `${label} checkout is not a payhip.com URL: ${checkout}`);
  else {
    if (!storeAll.includes(checkout)) bad("products", `${label} is approved but ${checkout} appears on no store page — nobody can buy it`);
    if (!agentsContext.includes(checkout)) warn("products", `${label} checkout ${checkout} is missing from the agents.json context — agents may invent a link`);
  }

  for (const dir of [c.files]) {
    if (!dir) continue;
    if (!exists(dir.replace(/\/$/, ""))) bad("products", `${label} points at "${dir}" but that folder does not exist`);
  }
  for (const img of [...(c.listingImages || []), c.previewUrl]) {
    if (!img) continue;
    if (/^https?:/.test(img)) continue; // external previews checked below
    if (!exists(img)) bad("products", `${label} references image "${img}" which is missing`);
  }

  // Selling window: being approved is not the same as being in season.
  if (c.marketFrom && c.marketUntil) {
    if (TODAY > c.marketUntil) warn("products", `${label} market window ended ${c.marketUntil} but status is still "approved" — retire or extend it`);
    else if (TODAY < c.marketFrom) good("products", `${label} is approved, starts selling ${c.marketFrom}`);
    else good("products", `${label} is in season until ${c.marketUntil}`);
  }
}
if (collections.some((c) => c.status === "approved")) good("products", `${collections.filter((c) => c.status === "approved").length} approved collection(s) passed checks out`);

// ---------------------------------------------------------------- 3. links resolve

const linkCache = new Map();
async function checkUrl(url) {
  if (linkCache.has(url)) return linkCache.get(url);
  const promise = (async () => {
    try {
      let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "agent-hq-audit" } });
      // Many shops refuse HEAD; retry with GET before calling it dead.
      if (res.status === 405 || res.status === 403 || res.status === 501) {
        res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "agent-hq-audit" } });
      }
      return { url, status: res.status, ok: res.ok };
    } catch (e) {
      return { url, status: 0, ok: false, error: e.name === "TimeoutError" ? "timed out" : e.message };
    }
  })();
  linkCache.set(url, promise);
  return promise;
}

if (NETWORK) {
  const urls = new Set();
  for (const c of collections) {
    if (c.status !== "approved") continue;
    const checkout = c.checkout || (String(c.live || "").startsWith("http") ? c.live : null);
    if (checkout) urls.add(checkout);
    if (c.previewUrl) urls.add(c.previewUrl);
  }
  for (const s of storeHtml) {
    for (const m of s.body.matchAll(/href\s*=\s*["'](https?:\/\/[^"']+)["']/g)) urls.add(m[1]);
  }
  for (const m of agentsContext.matchAll(/https?:\/\/[^\s"'()<>]+/g)) urls.add(m[0].replace(/[.,;:]$/, ""));

  const list = [...urls].filter((u) => !/^https:\/\/github\.com\/RecreationalViper/.test(u)).slice(0, 45);
  const results = [];
  for (let i = 0; i < list.length; i += 6) results.push(...await Promise.all(list.slice(i, i + 6).map(checkUrl)));

  const dead = results.filter((r) => r.status === 404 || r.status === 410);
  const broken = results.filter((r) => !r.ok && !dead.includes(r));
  // If most checks fail, the problem is our network, not the links. Saying so once
  // beats eight lines of "could not confirm".
  const mostlyDown = results.length > 3 && broken.length > results.length * 0.6;
  if (mostlyDown) {
    warn("links", `${broken.length}/${results.length} checks failed — looks like a network problem, not broken links`);
  } else {
    for (const r of dead.slice(0, 12)) bad("links", `${r.status} — dead link ${r.url}`);
    for (const r of broken.slice(0, 8)) warn("links", `${r.status || r.error} — could not confirm ${r.url}`);
    if (!dead.length) good("links", `${results.length} link(s) checked, none dead`);
  }
} else {
  warn("links", "network checks skipped (AUDIT_NO_NETWORK=1)");
}

// ---------------------------------------------------------------- 4. write the report

const line = [];
line.push(`# HQ health — ${problems.length ? "needs attention" : "all clear"}`);
line.push("");
line.push(`Agents alive: **${aliveCount}** · approved collections: **${collections.filter((c) => c.status === "approved").length}** · problems: **${problems.length}** · warnings: **${warnings.length}**`);
line.push("");
if (problems.length) {
  line.push("## Needs attention");
  for (const p of problems) line.push(`- **${p.area}** — ${p.msg}`);
  line.push("");
}
if (warnings.length) {
  line.push("## Worth knowing");
  for (const w of warnings) line.push(`- ${w.area} — ${w.msg}`);
  line.push("");
}
line.push("<details><summary>What passed</summary>");
line.push("");
for (const g of passed) line.push(`- ${g.area} — ${g.msg}`);
line.push("");
line.push("</details>");
const body = line.join("\n");

console.log(body);
if (process.env.GITHUB_STEP_SUMMARY) {
  try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, body + "\n"); } catch {}
}

// Only rewrite the file when the findings changed, so a clean night commits nothing.
const stamp = `_Checked ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC._`;
const previous = (read("reports/health.md") || "").split("\n").filter((l) => !l.startsWith("_Checked ")).join("\n").trim();
const next = `${stamp}\n\n${body}`.trim();
if (previous !== next) {
  fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "reports/health.md"), next + "\n");
  console.log("\nreports/health.md updated");
} else {
  console.log("\nreports/health.md unchanged");
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s) found.`);
  process.exit(1);
}
console.log("\n✓ no problems found.");
