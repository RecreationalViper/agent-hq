// Friday Mechanic: Friday's self-repair loop.
// 1) Health-checks Friday, 2) reads her own error log and wish list, 3) asks AI for a small, safe code change,
// 4) checks it compiles, 5) opens a pull request. Nothing goes live until the owner taps Merge in the GitHub app.
// Usage: node tools/friday-mechanic.mjs [--dry-run]
import fs from "node:fs";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { claudeChat, hasClaude } from "../claude-ai.mjs";
import { ask } from "../ai-ask.mjs";
import { alert } from "../discord.mjs";

const DRY = process.argv.includes("--dry-run");
const REPO = process.env.GITHUB_REPOSITORY || "RecreationalViper/agent-hq";
const API = "https://foreverheld-sales.foreverheld.workers.dev/friday";
const key = crypto.createHash("sha256").update("friday-check:" + (process.env.PAYHIP_API_KEY || "").trim()).digest("hex");
const FILES = ["workers/sales/worker.js", "friday/index.html", "tools/friday-check.mjs", "friday/PLAN.md"];
const sh = (c) => execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// 1) health check (answers stay in this run; only pass/fail notes go to the AI)
let health = "";
try { health = sh("node tools/friday-check.mjs"); } catch (e) { health = String(e.stdout || "") + String(e.stderr || ""); }
const problems = [];
for (const line of health.split("\n")) {
  if (/A \((5\d\d|4\d\d)\)|\[why |LIVE token: (?!200)|VOICE \((?!200)|should be 401\)/.test(line) && !/HTTP 401 \(should be 401\)/.test(line)) problems.push(`health: ${line.slice(0, 220)}`);
  const t = line.match(/\[(\d+\.\d)s\]/); if (t && Number(t[1]) > 25) problems.push(`slow answer (${t[1]}s): ${line.slice(0, 120)}`);
}

// 2) her own log + wishes
const mech = await fetch(API + "/mechanic", { headers: { "x-friday-key": key } }).then((r) => r.json()).catch(() => ({}));
const log = mech.log || [], wishes = mech.wishes || [];
if (process.env.EXTRA_WISH?.trim()) wishes.push({ id: "manual", at: new Date().toISOString(), text: process.env.EXTRA_WISH.trim() });
console.log(`health problems: ${problems.length}, logged errors: ${log.length}, wishes: ${wishes.length}`);
// nothing broken and no wishes: build the next idea from her plan (friday/PLAN.md, "Mechanic's idea list")
if (!problems.length && !log.length && !wishes.length) {
  let plan = ""; try { plan = fs.readFileSync("friday/PLAN.md", "utf8"); } catch {}
  const idea = (plan.split("## Mechanic's idea list")[1] || "").split("\n").find((l) => l.startsWith("- [ ] "));
  if (!idea) { console.log("Friday is healthy, has no wishes, and the idea list is empty. Nothing to do."); process.exit(0); }
  wishes.push({ id: "plan", at: new Date().toISOString(), text: `${idea.slice(6)} (From her idea list in friday/PLAN.md: also change that line from "- [ ]" to "- [x]".)` });
  console.log(`Building the next planned idea: ${idea.slice(6, 120)}`);
}

// 3) ask for one small change
const code = FILES.map((f) => `===== FILE: ${f} =====\n${fs.readFileSync(f, "utf8")}`).join("\n\n");
const system = `You are Friday's mechanic: a careful senior engineer maintaining FRIDAY, a personal voice assistant that runs as a Cloudflare Worker (workers/sales/worker.js, ES module, no npm packages) with a phone web app (friday/index.html).
Pick the SINGLE most valuable item from the problems and wishes below and write the smallest correct change for it. Prefer fixing real errors over wishes.
HARD RULES (never break, never weaken):
- Keep every owner-only check (FRIDAY_KEY_SHA, the "owner" flag), the test key's limits, CORS limits, and the Claude monthly cap.
- Email must stay draft-first; sending only on a later "send it". Never add a way to move money, send payments, or refund without an explicit confirm step.
- Never put secrets, tokens, emails or personal data in code, comments, or the summary. The repo is public.
- Don't touch other agents, workflows or files outside: ${FILES.join(", ")}.
- If the item needs a new paid service, a new secret, or owner sign-in, don't code it: set "skip" and explain what the owner must do.
Return ONLY JSON: {"item_ids":["ids you handled"], "title":"short PR title", "summary":"2-4 plain sentences for the owner: what was wrong or wanted, what you changed, how to test it by voice", "skip":null or "why", "edits":[{"file":"path","find":"exact text that appears exactly once in that file","replace":"new text"}]}
Edits: copy "find" text exactly from the file (whitespace included), keep each edit small, at most 6 edits.`;
const user = `PROBLEMS FROM TODAY'S HEALTH CHECK:\n${problems.join("\n") || "none"}\n\nFRIDAY'S ERROR LOG:\n${log.map((x) => `[${x.id}] ${x.at} ${x.kind}: ${x.text}`).join("\n") || "none"}\n\nFRIDAY'S WISH LIST (things he asked for that she couldn't do):\n${wishes.map((x) => `[${x.id}] ${x.at}: ${x.text}`).join("\n") || "none"}\n\nCODE:\n${code}`;

let plan = null;
for (const tryIt of [
  async () => (hasClaude() ? claudeChat(system, user, { json: true, maxTokens: 6000, temperature: 0.2, who: "friday-mechanic" }) : null),
  async () => ask(system, user, { json: true, strong: true, temperature: 0.2, who: "friday-mechanic" })
]) {
  try {
    const raw = await tryIt();
    if (!raw) continue;
    plan = typeof raw === "string" ? JSON.parse(raw.match(/\{[\s\S]*\}/)[0]) : raw;
    if (plan) break;
  } catch (e) { console.log(`AI attempt failed: ${String(e.message || e).slice(0, 160)}`); }
}
if (!plan) { console.log("No AI could produce a plan this time."); await alert("🔧 Friday Mechanic: couldn't get an AI to write a fix today. Will retry tomorrow.").catch(() => {}); process.exit(0); }
if (plan.skip) {
  console.log(`Skipped: ${plan.skip}`);
  await alert(`🔧 **Friday Mechanic** needs you for one thing: ${String(plan.skip).slice(0, 600)}`).catch(() => {});
  if (!DRY && plan.item_ids?.length) await fetch(API + "/mechanic", { method: "POST", headers: { "x-friday-key": key, "content-type": "application/json" }, body: JSON.stringify({ clear: plan.item_ids }) }).catch(() => {});
  process.exit(0);
}

// 4) apply + check
const edits = (plan.edits || []).slice(0, 6);
for (const e of edits) {
  if (!FILES.includes(e.file)) throw new Error(`refusing edit outside Friday's files: ${e.file}`);
  const before = fs.readFileSync(e.file, "utf8");
  const n = before.split(e.find).length - 1;
  if (n !== 1) { console.log(`Edit didn't match exactly once (${n}x) in ${e.file}; abandoning.`); process.exit(0); }
  fs.writeFileSync(e.file, before.replace(e.find, () => e.replace));
}
const after = fs.readFileSync("workers/sales/worker.js", "utf8");
for (const must of ["FRIDAY_KEY_SHA", "CLAUDE_FRIDAY_CAP", "pending_email", "owner-only"]) if (!after.includes(must)) { console.log(`Safety marker "${must}" disappeared; abandoning.`); process.exit(0); }
fs.writeFileSync("/tmp/fm-worker.mjs", after);
sh("node --check /tmp/fm-worker.mjs");
const html = fs.readFileSync("friday/index.html", "utf8").match(/<script>([\s\S]*)<\/script>/);
if (html) { fs.writeFileSync("/tmp/fm-app.mjs", html[1]); sh("node --check /tmp/fm-app.mjs"); }
sh("node --check tools/friday-check.mjs");
console.log(`Change compiles. ${plan.title}\n${sh("git diff --stat")}`);
// second opinion: a separate review pass must approve the diff
const diff = sh("git diff");
let verdict = null;
try {
  verdict = await ask(`You review code changes to FRIDAY (a Cloudflare Worker voice assistant). Be strict. Reject a change if it could break existing behavior, slow or weaken other features, change timeouts or limits globally, touch security/owner checks, or doesn't clearly fix the stated item. Return ONLY JSON {"ok":true|false,"reason":"one sentence"}.`,
    `ITEM: ${plan.title}\nSUMMARY: ${plan.summary}\n\nDIFF:\n${diff.slice(0, 20000)}`, { json: true, strong: true, temperature: 0, who: "friday-mechanic-review" });
  if (typeof verdict === "string") verdict = JSON.parse(verdict.match(/\{[\s\S]*\}/)[0]);
} catch (e) { console.log(`review failed: ${e.message}`); }
console.log(`Review: ${verdict?.ok ? "approved" : "rejected"} (${verdict?.reason || "no review"})`);
if (DRY) { console.log(diff.slice(0, 6000)); process.exit(0); }
if (!verdict?.ok) { await alert(`🔧 Friday Mechanic drafted "${plan.title}" but its reviewer rejected it (${String(verdict?.reason || "no review").slice(0, 200)}). It'll try a better fix next run.`).catch(() => {}); process.exit(0); }

// 5) branch + pull request
const branch = `friday-mechanic/${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
sh(`git checkout -b ${branch}`);
sh(`git add ${FILES.join(" ")}`);
sh(`git -c user.name="Friday Mechanic" -c user.email="actions@github.com" commit -m ${JSON.stringify(`Friday Mechanic: ${plan.title}`.slice(0, 120))}`);
sh(`git push -q origin ${branch}`);
sh("git checkout -q main"); // the workflow then saves claude-usage.json on main
const pr = await fetch(`https://api.github.com/repos/${REPO}/pulls`, {
  method: "POST", headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "content-type": "application/json" },
  body: JSON.stringify({ title: `Friday: ${plan.title}`.slice(0, 120), head: branch, base: "main", body: `${plan.summary}\n\nWritten by Friday's mechanic. Nothing changes until you tap **Merge**. Merging deploys it to Friday automatically.` })
}).then((r) => r.json()).catch(() => ({}));
const link = pr.html_url || `https://github.com/${REPO}/compare/main...${branch}?expand=1`;
await alert(`🔧 **Friday wrote an upgrade for herself:** ${plan.title}\n${plan.summary}\nReview & merge: ${link}`).catch(() => {});
await fetch(API + "/mechanic", { method: "POST", headers: { "x-friday-key": key, "content-type": "application/json" }, body: JSON.stringify({ clear: plan.item_ids || [] }) }).catch(() => {});
console.log(`Opened: ${link}`);
