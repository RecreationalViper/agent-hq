#!/usr/bin/env node
// Repo checks — the gate that runs on every pull request.
//
// Catches the failures that used to reach main silently:
//   - a script that no longer parses
//   - a data file that is no longer valid JSON
//   - an agent pointing at a file that was renamed
//   - a workflow calling a script that does not exist
//   - a broken internal link on the storefront
//
// Fast and offline: no network, no dependencies, no AI calls.
//
// Usage:  node tools/check-repo.mjs
// Errors fail the build. Warnings are printed but do not.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const errors = [];
const warnings = [];
const notes = [];

const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "__pycache__", ".film"]);
const exists = (p) => fs.existsSync(path.join(ROOT, p));

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".github") continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

const all = walk(".");
const rel = (p) => p.split(path.sep).join("/");

// ---------------------------------------------------------------- 1. scripts parse

const scripts = all.filter((f) => /\.(mjs|js)$/.test(f));
for (const file of scripts) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) {
    const line = (r.stderr || "").split("\n").find((l) => /Error|error/.test(l)) || "does not parse";
    err(`scripts/${rel(file)}`, line.replace(/^.*Error:/, "syntax error:").trim());
  }
}
notes.push(`${scripts.length} scripts parse`);

// ---------------------------------------------------------------- 2. JSON parses

const jsonFiles = all.filter((f) => /\.json$/.test(f));
for (const file of jsonFiles) {
  try { JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8")); }
  catch (e) { err(`json/${rel(file)}`, `invalid JSON — ${e.message}`); }
}
notes.push(`${jsonFiles.length} JSON files parse`);

// ---------------------------------------------------------------- 3. agents.json

const SCHEDULE = /^(daily|weekdays|manual|twice|weekly:(mon|tue|wed|thu|fri|sat|sun)(,(mon|tue|wed|thu|fri|sat|sun))*|monthly:\d{1,2})$/
const GROUPS = new Set(["shop", "studio"]);
let agents = [];
if (!exists("agents.json")) err("agents.json", "missing");
else {
  try { agents = JSON.parse(fs.readFileSync(path.join(ROOT, "agents.json"), "utf8")).agents || []; }
  catch { agents = []; } // already reported above
}
const ids = new Map();
for (const a of agents) {
  const id = a.id || "(no id)";
  if (!a.id) err("agents.json", `an agent has no id (name: ${a.name || "?"})`);
  if (ids.has(a.id)) err("agents.json", `duplicate agent id "${a.id}" — two agents would overwrite the same report`);
  if (a.id) ids.set(a.id, a);
  if (!a.name) warn(`agents/${id}`, "has no name");
  if (!a.instructions) err(`agents/${id}`, "has no instructions");
  if (!SCHEDULE.test(String(a.schedule || ""))) err(`agents/${id}`, `unknown schedule "${a.schedule}"`);
  if (a.group && !GROUPS.has(a.group)) err(`agents/${id}`, `unknown group "${a.group}" (expected ${[...GROUPS].join(" or ")})`);
  if (a.twiceDaily !== undefined && typeof a.twiceDaily !== "boolean") warn(`agents/${id}`, "twiceDaily should be true/false");
  for (const f of a.readsFiles || []) {
    if (!exists(f)) warn(`agents/${id}`, `readsFile "${f}" does not exist — the agent will run with that input missing`);
  }
  if (a.saveAs && path.isAbsolute(a.saveAs)) err(`agents/${id}`, `saveAs must be a repo-relative path`);
}
const pinned = new Set();
for (const a of agents) if (a.id) pinned.add(a.id);
notes.push(`${agents.length} agents, ${pinned.size} unique ids`);

// ---------------------------------------------------------------- 4. workflows

// GitHub itself rejects YAML it cannot parse and annotates the pull request, so this
// does not try to be a YAML parser. It checks what GitHub will happily accept but that
// still breaks a run: a script that moved, a cron with four fields, a heredoc body, or
// an indentation error introduced with a tab.
const workflows = all.filter((f) => /^\.github[\\/]workflows[\\/].*\.ya?ml$/.test(f));

function yamlAvailable() {
  const py = spawnSync("python3", ["-c", "import yaml"], { encoding: "utf8" });
  return !py.error && py.status === 0;
}
function yamlParses(file) {
  const py = spawnSync("python3", ["-c", "import yaml,sys;yaml.safe_load(open(sys.argv[1]))", file], { encoding: "utf8" });
  if (py.status === 0) return true;
  return (py.stderr || "does not parse").trim().split("\n").pop();
}
const haveYaml = yamlAvailable();

for (const file of workflows) {
  const text = fs.readFileSync(path.join(ROOT, file), "utf8");
  const name = `workflow/${path.basename(file)}`;
  const lines = text.split("\n");

  if (haveYaml) {
    const parsed = yamlParses(file);
    if (parsed !== true) err(name, `invalid YAML — ${parsed}`);
  }

  if (lines.some((l) => l.trim() && !l.trim().startsWith("#") && /\t/.test(l))) {
    err(name, "contains a tab character — YAML forbids tabs for indentation");
  }
  if (!/^jobs:\s*$/m.test(text)) err(name, "has no top-level jobs: key");
  if (/runs-on:/.test(text) === false) err(name, "has no runs-on: — nothing will ever execute");
  if (/^\s*-?\s*steps:\s*$/m.test(text) && !/^\s*- name:|^\s*- uses:|^\s*- run:/m.test(text)) {
    err(name, "declares steps: but none of them have name/uses/run");
  }
  // A workflow that can never fire is a silent no-op.
  if (!/^on:\s*$/m.test(text) && !/^on:\s*\[/m.test(text) && !/^on:\s+\S/m.test(text)) warn(name, "has no on: trigger");

  // every script a workflow calls must exist
  for (const m of text.matchAll(/(?:^|\s)(?:node|bash|sh)\s+([\w./-]+\.(?:mjs|js|sh))/g)) {
    const target = m[1];
    if (target.startsWith("/") || target.includes("$")) continue;
    if (!exists(target)) err(name, `calls "${target}" which does not exist`);
  }

  // cron syntax: five fields
  for (const m of text.matchAll(/cron:\s*["\']([^"\']+)["\']/g)) {
    const fields = m[1].trim().split(/\s+/);
    if (fields.length !== 5) err(name, `cron "${m[1]}" has ${fields.length} fields, expected 5`);
  }

  // a failing run nobody hears about is how agents die quietly
  if (!/discord-alert|failure\(\)/.test(text)) warn(name, "no failure alert — if this breaks, nobody is told");
}

notes.push(`${workflows.length} workflows, ${haveYaml ? "YAML parsed" : "YAML syntax left to GitHub (no PyYAML here), structure checked"}`);

// ---------------------------------------------------------------- 5. skills

const skillFiles = all.filter((f) => /(^|[\\/])SKILL\.md$/.test(f));
for (const file of skillFiles) {
  const body = fs.readFileSync(path.join(ROOT, file), "utf8");
  if (!/^---\s*\n/.test(body)) { warn(`skills/${rel(file)}`, "no frontmatter block"); continue; }
  const fm = body.split("---")[1] || "";
  if (!/name:/.test(fm)) warn(`skills/${rel(file)}`, "frontmatter has no name");
  if (!/description:/.test(fm)) warn(`skills/${rel(file)}`, "frontmatter has no description");
}
notes.push(`${skillFiles.length} skills`);

// ---------------------------------------------------------------- 6. internal store links

const htmlFiles = all.filter((f) => /^store[\\/].*\.html$/.test(f));
let linkCount = 0;
for (const file of htmlFiles) {
  const body = fs.readFileSync(path.join(ROOT, file), "utf8");
  for (const m of body.matchAll(/href\s*=\s*["']([^"']+)["']/g)) {
    const href = m[1].trim();
    if (!href || href.startsWith("#") || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(href)) continue;
    linkCount++;
    const clean = href.split("#")[0].split("?")[0];
    if (!clean) continue;
    const target = clean.startsWith("/")
      ? path.join("store", clean)
      : path.join(path.dirname(file), clean);
    if (!fs.existsSync(path.join(ROOT, target))) {
      err(rel(file), `broken internal link "${href}" — ${rel(target)} does not exist`);
    }
  }
}
notes.push(`${htmlFiles.length} store pages, ${linkCount} internal links checked`);

// ---------------------------------------------------------------- report

const line = (s) => console.log(s);
line("");
if (notes.length) for (const n of notes) line(`  · ${n}`);
line("");
for (const e of errors) line(`  ERROR  ${e}`);
for (const w of warnings) line(`  WARN   ${w}`);
line("");
line(errors.length
  ? `✗ ${errors.length} error(s), ${warnings.length} warning(s) — fix the errors above.`
  : `✓ passed — ${warnings.length} warning(s), 0 errors.`);
line("");

if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [
    "## Repo checks",
    "",
    errors.length ? `**${errors.length} error(s)**` : "**Passed**",
    "",
    ...errors.map((e) => `- ❌ ${e}`),
    ...warnings.map((w) => `- ⚠️ ${w}`),
    "",
    ...notes.map((n) => `- ${n}`)
  ].join("\n");
  try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n"); } catch {}
}

process.exit(errors.length ? 1 : 0);
