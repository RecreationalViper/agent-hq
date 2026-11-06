#!/usr/bin/env node
// GitHub Radar — continuously scans GitHub for (1) real agent skills, (2) AI enhancements
// that work across models, (3) legitimate free tokens/credits, and (4) tools that cut
// your AI usage. Uses ZERO AI tokens: pure GitHub search API + deterministic scoring.
//
// Run:            node scout/scan.mjs
// Dry run:        node scout/scan.mjs --dry-run      (prints, writes nothing)
// Force query:    RADAR_QUERY_LIMIT=30 node scout/scan.mjs
//
// Outputs
//   scout/latest.json   machine-readable results (the website reads this)
//   scout/latest.md     phone-friendly digest (the daily agent reads this)
//   scout/seen.json     memory: what we've already shown, so nothing repeats
//
// Environment
//   GITHUB_TOKEN        optional but strongly recommended (30 searches/min vs 10)
//   RADAR_QUERY_LIMIT   how many saved searches to run this time
//   RADAR_MIN_SCORE     ignore anything scoring below this (default 55)

import fs from "node:fs/promises";

const CONFIG_PATH = "scout/config.json";
const OUT_JSON = "scout/latest.json";
const OUT_MD = "scout/latest.md";
const STATE_PATH = "scout/seen.json";

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const DRY = process.argv.includes("--dry-run");
const API = "https://api.github.com";
const UA = "agent-hq-github-radar";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------- GitHub API

let apiCalls = 0;
let rateLeft = null;

async function gh(path, { etag, allow304 = false } = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": UA,
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (etag) headers["If-None-Match"] = etag;

  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch(API + path, { headers, signal: AbortSignal.timeout(30000) });
    } catch (e) {
      if (attempt === 2) throw new Error(`network: ${e.message}`);
      await sleep(3000 * (attempt + 1));
      continue;
    }
    apiCalls++;
    const left = res.headers.get("x-ratelimit-remaining");
    if (left) rateLeft = Number(left);

    if (res.status === 304 && allow304) return { notModified: true, etag };
    if (res.status === 204) return {};

    // Secondary rate limits / abuse detection: back off and retry once or twice.
    if (res.status === 403 || res.status === 429) {
      const text = await res.text().catch(() => "");
      const retryAfter = Number(res.headers.get("retry-after") || 0);
      const isLimit = /rate limit|abuse|secondary/i.test(text) || rateLeft === 0 || retryAfter > 0;
      if (isLimit && attempt < 2) {
        const wait = Math.min(retryAfter ? retryAfter * 1000 : 20000 * (attempt + 1), 60000);
        console.log(`  rate limited, waiting ${Math.round(wait / 1000)}s…`);
        await sleep(wait);
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
    }
    return { data: await res.json(), etag: res.headers.get("etag") || null };
  }
  throw new Error("gave up after retries");
}

// ---------------------------------------------------------------- helpers

async function readJson(path, fallback) {
  try { return JSON.parse(await fs.readFile(path, "utf8")); } catch { return fallback; }
}

function hostOf(url) {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function daysSince(iso) {
  if (!iso) return 9999;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
}

// Config patterns are written as "(?i)..." for readability, but JavaScript has no
// inline flags — strip the marker and use the "i" flag instead. Compiled once.
const reCache = new Map();
function toRe(pattern) {
  if (reCache.has(pattern)) return reCache.get(pattern);
  let src = String(pattern), flags = "";
  if (src.startsWith("(?i)")) { flags = "i"; src = src.slice(4); }
  let re = null;
  try { re = new RegExp(src, flags); } catch (e) { console.warn(`  bad pattern in config: ${pattern} (${e.message})`); }
  reCache.set(pattern, re);
  return re;
}

// ---------------------------------------------------------------- relevance

// A search hit is only useful if the repo is actually about the category we found it
// in. GitHub search is fuzzy, so every hit is checked against these signals and moved
// to the category it really belongs to (or dropped as off-topic).
const AI_WORDS = /(\bllm\b|language model|\bopenai\b|\banthropic\b|\bclaude\b|\bgemini\b|\bgpt\b|\bai\b|\bagents?\b|\bprompt|\binference\b|\bmodels?\b)/i;
const OFFER_WORDS = /(free|credit|tier|trial|no.?api.?key|no key|rate.?limit|\bfee|\btokens?\b)/i;
const CAT_WORDS = {
  skills: /(\bskills?\b|\bmcp\b|\bplugins?\b|\bagents?\b|\bprompt|\btools?\b|\bworkflow|\binstruction|copilot|\bclaude\b)/i,
  enhancement: /(\bllm\b|\bmodels?\b|\bai\b|\bagents?\b|\bprompt|\bcontext\b|\brag\b|\beval|gemini|claude|openai|\bgpt|inference)/i,
  efficiency: /(cost|\btokens?\b|usage|cheaper|\bcache|compress|\brout|latency|\blocal\b|quantiz|budget|spend|efficien|gateway)/i,
  "free-tokens": null
};

function fitsCategory(category, hay) {
  if (category === "free-tokens") return AI_WORDS.test(hay) && OFFER_WORDS.test(hay);
  const signal = CAT_WORDS[category];
  if (!signal || !signal.test(hay)) return false;
  return category === "enhancement" ? true : AI_WORDS.test(hay);
}

function bestCategory(assigned, hay) {
  if (fitsCategory(assigned, hay)) return { category: assigned, moved: false };
  for (const cat of ["skills", "enhancement", "efficiency", "free-tokens"]) {
    if (fitsCategory(cat, hay)) return { category: cat, moved: true };
  }
  return { category: assigned, moved: true, offTopic: true };
}

// ---------------------------------------------------------------- scoring

// Turns one GitHub search hit into a judgement: score, tier, reasons, flags.
// Purpose: surface things worth 5 minutes of the owner's time and bury the scams.
function judge(repo, category, cfg, today) {
  const name = repo.full_name;
  const owner = (repo.owner?.login || "").toLowerCase();
  const desc = repo.description || "";
  const topics = repo.topics || [];
  const license = repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? repo.license.spdx_id : null;
  const hay = `${name} ${desc} ${topics.join(" ")}`;
  const homeHost = hostOf(repo.homepage);
  const ageDays = daysSince(repo.created_at);
  const pushDays = daysSince(repo.pushed_at);

  // 1. Hard reject: scams, key generators, credential harvesting, crypto token confusion.
  const blocks = [...cfg.blockPatterns, ...(category === "free-tokens" ? cfg.blockPatternsFreeTokensOnly : [])];
  const blockedBy = blocks.find((p) => toRe(p)?.test(hay));
  if (blockedBy) {
    return { name, category, blocked: true, score: -1, tier: "blocked", flags: ["blocked-pattern"], reasons: ["matched the scam / key-generator filter"] };
  }
  if (repo.archived) return { name, category, blocked: true, score: -1, tier: "blocked", flags: ["archived"], reasons: ["repository is archived"] };

  let score = 0;
  const reasons = [];
  const flags = [];

  // Move the hit to the category it truly belongs to (GitHub search is fuzzy).
  const placed = bestCategory(category, hay);
  category = placed.category;
  if (placed.offTopic) { score -= 14; flags.push("off-topic"); reasons.push("matched the search but not clearly about this topic"); }
  else if (placed.moved) { score -= 4; reasons.push(`filed under ${category}`); }

  // 2. Adoption signal: do other people actually use it? (0-30)
  const stars = repo.stargazers_count || 0;
  const starPoints = [[20000, 30], [5000, 26], [1000, 22], [300, 16], [100, 11], [40, 7], [10, 3]];
  for (const [min, pts] of starPoints) { if (stars >= min) { score += pts; break; } }
  if (stars >= 100) reasons.push(`${stars.toLocaleString()} stars`);

  // 3. Is it alive? (0-20, penalty when dead)
  if (pushDays <= 7) { score += 20; reasons.push("updated this week"); }
  else if (pushDays <= 30) { score += 15; reasons.push("updated this month"); }
  else if (pushDays <= 120) { score += 7; }
  else if (pushDays <= 365) { score += 1; }
  else { score -= 12; flags.push("stale"); reasons.push("no update in over a year"); }

  // 4. Can it be trusted and reused? (0-20)
  if (license) { score += 10; reasons.push(`${license} license`); }
  else { score -= 6; flags.push("no-license"); }
  if (cfg.trustedOrgs.includes(owner)) { score += 10; reasons.push("first-party / well-known maintainer"); }
  if (repo.fork) { score -= 100; flags.push("fork"); }

  // 5. Is it actually about the thing we searched for? (0-8)
  if (topics.length) score += 3;
  if (desc.length > 40) score += 3;
  if (repo.homepage) score += 2;
  if (repo.open_issues_count > 400 && stars < 500) { score -= 5; flags.push("many-open-issues"); }

  // 6. Established = big, licensed AND maintained. That combination is rarely a trap.
  if (stars >= 5000 && license && pushDays <= 60) { score += 6; reasons.push("well established"); }

  // 7. Courses and tutorials are fine, but real tools should outrank them.
  if (/(for.?beginners|tutorial|course|curriculum|\blessons?\b|handbook|roadmap|cheat.?sheet)/i.test(hay)) {
    score -= 9; flags.push("learning-material");
  }

  // 8. Too new to trust on hype alone.
  if (ageDays < 14 && stars < 150) { score -= 12; flags.push("brand-new"); }

  // 9. Category-specific checks.
  if (category === "free-tokens") {
    const official = cfg.trustedOrgs.includes(owner) || cfg.trustedHosts.some((h) => homeHost.endsWith(h));
    const mentionsTrusted = cfg.trustedHosts.some((h) => hay.includes(h));
    if (official) { score += 10; reasons.push("links to an official provider"); }
    else if (mentionsTrusted) { score += 4; reasons.push("references an official provider"); }
    else { score -= 8; flags.push("unverified-offer"); reasons.push("third-party source, needs checking"); }
    if (/crypto|coin|wallet|nft/i.test(hay) && !/token(s)? (budget|usage|count)/i.test(hay)) {
      flags.push("crypto-noise"); score -= 15;
    }
  }
  if (category === "efficiency") {
    // Anything that promises to cut tokens/requests is the whole point here.
    if (/cache|compress|router|routing|cheaper|cost|batch|prun|distill|quantiz/i.test(hay)) { score += 6; reasons.push("directly cuts AI spend"); }
  }
  if (category === "skills") {
    if (/skill|tool|mcp|plugin|workflow|agent/i.test(hay)) { score += 4; }
  }

  // 10. Soft risk flags — shown to the owner, not automatic rejection.
  for (const r of cfg.riskPatterns) {
    if (toRe(r.pattern)?.test(hay) && !flags.includes(r.name)) flags.push(r.name);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let tier = score >= 72 && !flags.includes("no-license") ? "adopt" : score >= 55 ? "watch" : "skip";
  // A phone-only owner can't run a server, so anything needing a host is never a
  // straight "adopt" — it stays visible, just with honest expectations.
  if (tier === "adopt" && (flags.includes("self-host-required") || flags.includes("third-party-proxy") || flags.includes("tos-risk"))) tier = "watch";

  return { name, category, blocked: false, score, tier, reasons, flags };
}

// ---------------------------------------------------------------- scan

async function main() {
  const cfg = await readJson(CONFIG_PATH, null);
  if (!cfg || !cfg.targets) throw new Error(`${CONFIG_PATH} is missing or broken.`);
  const limits = { queriesPerRun: 12, minStars: 8, maxReportPerCategory: 5, shortlistSize: 8, queryDelayMs: 2200, inspectSkillFiles: 4, seenCap: 3000, ...(cfg.limits || {}) };
  const qLimit = Number(process.env.RADAR_QUERY_LIMIT || limits.queriesPerRun);
  const minScore = Number(process.env.RADAR_MIN_SCORE || 55);
  const today = todayISO();

  const state = await readJson(STATE_PATH, null) || { version: 1, cursor: 0, queries: {}, seen: {}, blocked: {} };
  state.seen ||= {}; state.blocked ||= {}; state.queries ||= {};

  // Flat, stable list of searches with their category, then take a rotating slice
  // so every run stays inside the rate limit and the whole list still gets covered.
  const all = [];
  for (const [category, queries] of Object.entries(cfg.targets)) {
    for (const q of queries) all.push({ category, q });
  }
  const start = (state.cursor || 0) % all.length;
  const slice = Array.from({ length: Math.min(qLimit, all.length) }, (_, i) => all[(start + i) % all.length]);
  state.cursor = (start + slice.length) % all.length;

  console.log(`GitHub Radar — ${slice.length}/${all.length} searches, token ${TOKEN ? "on" : "OFF (10/min, slower)"}`);
  console.log(`Rotation window: ${slice.map((s) => s.category).join(", ")}`);

  const since = daysAgo(60);
  const found = [];
  const ledger = { ok: 0, unchanged: 0, failed: 0, skippedMatches: 0 };

  for (const { category, q } of slice) {
    const query = q.replace(/\{since\}/g, since) + (limits.minStars ? ` stars:>=${limits.minStars}` : "");
    // No sort parameter on purpose: GitHub's best-match ranking weighs stars and
    // relevance together, while pushed:>60d already keeps everything fresh.
    const path = `/search/repositories?q=${encodeURIComponent(query)}&per_page=30`;
    const prev = state.queries[query];
    try {
      const res = await gh(path, { etag: prev?.etag, allow304: true });
      if (res.notModified) {
        ledger.unchanged++;
        console.log(`  = ${category}: unchanged since last scan`);
        continue;
      }
      ledger.ok++;
      const items = res.data?.items || [];
      console.log(`  + ${category}: ${items.length} hits — ${query}`);
      for (const repo of items) found.push({ repo, category });
      state.queries[query] = { etag: res.etag, lastRun: new Date().toISOString(), total: res.data?.total_count ?? items.length };
    } catch (e) {
      ledger.failed++;
      console.error(`  ! ${category}: ${e.message}`);
    }
    await sleep(limits.queryDelayMs);
  }

  if (!ledger.ok && !ledger.unchanged) throw new Error("Every search failed — check the GitHub token or the network.");

  // Query keys contain the rolling date, so drop entries older than two weeks.
  const cutoff = Date.now() - 14 * 86400000;
  for (const [k, v] of Object.entries(state.queries)) {
    if (v?.lastRun && new Date(v.lastRun).getTime() < cutoff) delete state.queries[k];
  }

  // Dedupe within this run (a repo can match several searches): keep the best category hit.
  const byName = new Map();
  for (const { repo, category } of found) {
    const prior = byName.get(repo.full_name);
    if (!prior) byName.set(repo.full_name, { repo, category });
    else if (prior.category === "skills" && category !== "skills") byName.set(repo.full_name, { repo, category });
  }

  const fresh = [];
  let alreadyKnown = 0, blockedNow = [];

  for (const { repo, category } of byName.values()) {
    const name = repo.full_name;
    if (state.seen[name] || state.blocked[name]) { alreadyKnown++; continue; }
    const verdict = judge(repo, category, cfg, today);

    if (verdict.blocked) {
      state.blocked[name] = { at: today, why: verdict.flags[0] };
      blockedNow.push({ name, why: verdict.reasons[0] || "filtered", stars: repo.stargazers_count });
      continue;
    }
    if (verdict.score < 40) { ledger.skippedMatches++; continue; }

    fresh.push({
      repo,
      name,
      category: verdict.category,
      score: verdict.score,
      tier: verdict.tier,
      reasons: verdict.reasons,
      flags: verdict.flags,
      isNew: true
    });
  }

  // Newest thinking first, and prove skill repos really contain skill files.
  fresh.sort((a, b) => b.score - a.score);
  let inspected = 0;
  for (const item of fresh) {
    if (inspected >= limits.inspectSkillFiles) break;
    if (item.category !== "skills" || item.score < 62) continue;
    const [o, r] = item.name.split("/");
    try {
      const res = await gh(`/search/code?q=${encodeURIComponent(`repo:${o}/${r} filename:SKILL.md`)}&per_page=1`);
      item.skillFiles = (res.data?.total_count || 0) > 0;
      if (item.skillFiles) { item.reasons.push("contains SKILL.md skill files"); item.score = Math.min(100, item.score + 8); }
      inspected++;
      if (item.score >= 72 && item.tier === "watch" && !item.flags.includes("no-license")) item.tier = "adopt";
    } catch (e) {
      item.skillFiles = null;
    }
    await sleep(limits.queryDelayMs);
  }

  // Remember everything we judged so it never shows up twice.
  for (const item of fresh) {
    state.seen[item.name] = {
      first: today, last: today, stars: item.repo.stargazers_count,
      score: item.score, tier: item.tier, category: item.category
    };
  }
  for (const { repo, category } of byName.values()) {
    if (state.seen[repo.full_name]) {
      state.seen[repo.full_name].last = today;
      state.seen[repo.full_name].stars = repo.stargazers_count;
    }
  }

  // Keep state from growing forever: drop the weakest, oldest, skipped entries first.
  const seenEntries = Object.entries(state.seen);
  if (seenEntries.length > limits.seenCap) {
    seenEntries.sort((a, b) => (b[1].score || 0) - (a[1].score || 0) || String(b[1].last).localeCompare(String(a[1].last)));
    state.seen = Object.fromEntries(seenEntries.slice(0, limits.seenCap));
  }

  const reportable = fresh.filter((i) => i.score >= minScore);
  const byCategory = {};
  for (const cat of Object.keys(cfg.targets)) {
    byCategory[cat] = reportable.filter((i) => i.category === cat).slice(0, limits.maxReportPerCategory);
  }
  const shortlist = [...reportable].slice(0, limits.shortlistSize);

  // Watchlist: strong things we flagged earlier that are still active.
  const watching = Object.entries(state.seen)
    .filter(([n, s]) => s.tier !== "skip" && !fresh.some((f) => f.name === n))
    .sort((a, b) => (b[1].score || 0) - (a[1].score || 0))
    .slice(0, 6)
    .map(([n, s]) => ({ name: n, score: s.score, tier: s.tier, category: s.category, first: s.first }));

  const out = {
    generatedAt: new Date().toISOString(),
    date: today,
    token: Boolean(TOKEN),
    searches: { ran: slice.length, total: all.length, ok: ledger.ok, unchanged: ledger.unchanged, failed: ledger.failed },
    apiCalls,
    rateRemaining: rateLeft,
    newItems: reportable.length,
    blockedToday: blockedNow.length,
    shortlist: shortlist.map(shape),
    byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, v.map(shape)])),
    blocked: blockedNow.slice(0, 10),
    watching
  };

  const md = digest(out, cfg);
  if (DRY) {
    console.log("\n--- scout/latest.md (dry run, not written) ---\n");
    console.log(md);
    console.log(`\nAPI calls: ${apiCalls}, new reportable: ${reportable.length}`);
    return;
  }

  await fs.mkdir("scout", { recursive: true });
  await fs.writeFile(STATE_PATH, JSON.stringify(state));

  // Only rewrite the public files when something actually changed (or a new day
  // started) so a quiet radar doesn't spam the repo with timestamp-only commits.
  const prev = await readJson(OUT_JSON, null);
  const dayChanged = prev?.date !== today;
  if (reportable.length || dayChanged || !prev) {
    await fs.writeFile(OUT_JSON, JSON.stringify(out, null, 2));
    await fs.writeFile(OUT_MD, md);
    console.log(`Wrote ${OUT_JSON} and ${OUT_MD}`);
  } else {
    console.log("No new finds and same day — leaving latest.* untouched (nothing to report).");
  }

  console.log(`Done: ${reportable.length} new item(s), ${blockedNow.length} filtered, ${alreadyKnown} already known, ${ledger.unchanged} unchanged searches, ${apiCalls} API calls.`);
}

function shape(i) {
  const r = i.repo;
  return {
    name: i.name,
    url: r.html_url,
    description: esc(r.description || ""),
    stars: r.stargazers_count,
    forks: r.forks_count,
    language: r.language || "",
    license: r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION" ? r.license.spdx_id : null,
    pushedAt: r.pushed_at,
    category: i.category,
    score: i.score,
    tier: i.tier,
    reasons: i.reasons,
    flags: i.flags,
    skillFiles: i.skillFiles ?? null
  };
}

// ---------------------------------------------------------------- digest

const CAT_TITLE = {
  "skills": "Agent skills you could install",
  "enhancement": "AI enhancements (work with any model)",
  "free-tokens": "Free tokens, credits and tiers",
  "efficiency": "Spend less on the AI you already use"
};

function tierChip(t) { return t === "adopt" ? "🟢 ADOPT" : t === "watch" ? "🟡 WATCH" : "⚪ SKIP"; }

function flagNote(flags) {
  const notes = {
    "no-license": "no license — check before reusing",
    "third-party-proxy": "your prompts pass through their server — never paste your own key",
    "tos-risk": "unofficial/scraping based — may break or breach terms",
    "hype-claims": "marketing language — verify the limits",
    "self-host-required": "needs a machine running, not phone-only",
    "unverified-offer": "third-party claim, verify on the provider's own site",
    "crypto-noise": "'tokens' may mean crypto here, not AI tokens",
    "brand-new": "very new, little track record",
    "stale": "not updated in a long time",
    "many-open-issues": "lots of open issues",
    "off-topic": "matched the search but not clearly on topic",
    "learning-material": "course/reading material, not a ready-to-use tool"
  };
  return flags.map((f) => notes[f]).filter(Boolean);
}

function line(i) {
  const d = i.description.length > 150 ? i.description.slice(0, 147) + "…" : i.description;
  let s = `- **[${i.name}](${i.url})** ${tierChip(i.tier)} · score ${i.score}/100 · ⭐ ${i.stars.toLocaleString()} · ${i.license || "no license"} · updated ${daysSince(i.pushedAt)}d ago\n`;
  s += `  - ${d || "(no description)"}\n`;
  if (i.reasons.length) s += `  - Why: ${i.reasons.join("; ")}\n`;
  const notes = flagNote(i.flags);
  if (notes.length) s += `  - Watch out: ${notes.join("; ")}\n`;
  if (i.skillFiles === true) s += `  - Confirmed: contains \`SKILL.md\` skill files\n`;
  return s;
}

function digest(out, cfg) {
  const L = [];
  L.push(`# GitHub Radar — ${out.date}`);
  L.push("");
  L.push(`> Scanned ${out.searches.ran} of ${out.searches.total} saved searches (${out.searches.ok} returned data, ${out.searches.unchanged} unchanged, ${out.searches.failed} failed). ${out.apiCalls} GitHub API calls, ${out.token ? "authenticated" : "unauthenticated"}. Zero AI tokens used.`);
  L.push("");

  L.push(`## Start here (${out.shortlist.length})`);
  if (!out.shortlist.length) {
    L.push("");
    L.push("_Nothing new cleared the quality bar this scan. That is a normal, healthy result — the radar is rotating through its searches and will cover the rest next time._");
  } else {
    L.push("");
    for (const i of out.shortlist) L.push(line(i).trimEnd());
  }
  L.push("");

  // Everything appears exactly once: the shortlist is the cross-category top picks,
  // the sections below show the rest so nothing is repeated.
  const shortNames = new Set(out.shortlist.map((i) => i.name));
  for (const cat of ["skills", "enhancement", "free-tokens", "efficiency"]) {
    const items = (out.byCategory[cat] || []).filter((i) => !shortNames.has(i.name));
    L.push(`## ${CAT_TITLE[cat]} (${items.length})`);
    L.push("");
    if (!items.length) L.push("_Nothing else new here this scan._");
    else for (const i of items) L.push(line(i).trimEnd());
    L.push("");
  }

  if (out.watching.length) {
    L.push("## Still on the watchlist");
    L.push("");
    for (const w of out.watching) L.push(`- [${w.name}](https://github.com/${w.name}) — score ${w.score}, first seen ${w.first}, ${w.tier}`);
    L.push("");
  }

  if (out.blocked.length) {
    L.push(`## Filtered out today (${out.blockedToday})`);
    L.push("");
    L.push("Archived repos, and anything matching the scam filter: key generators, credential harvesting, \"unlimited free API keys\", crypto-token confusion. Excluded on purpose — this list is here so you can see the filter working.");
    L.push("");
    for (const b of out.blocked) L.push(`- ~~${esc(b.name)}~~ — ${esc(b.why)}`);
    L.push("");
  }

  L.push("## How to read this");
  L.push("");
  L.push("- **🟢 ADOPT** = established, licensed, recently updated. Worth 5 minutes.");
  L.push("- **🟡 WATCH** = promising but missing something (no license, new, third-party claim).");
  L.push("- Scores are the radar's own heuristic (stars, freshness, license, maintainer, relevance) — not a promise of quality.");
  L.push("- Nothing here has been installed, run, or paid for. That is your call, and it is logged as pending approval.");
  L.push("");
  return L.join("\n");
}

// ---------------------------------------------------------------- self test

// `node scout/scan.mjs --selftest` checks the scam filter and the scoring bar
// against known-good and known-bad shapes, so a config edit can't quietly break them.
async function runSelfTest() {
  const cfg = await readJson(CONFIG_PATH, null);
  const now = new Date().toISOString();
  const mk = (o) => ({
    full_name: "someone/repo", description: "A tool for working with language models and agents.",
    stargazers_count: 200, forks_count: 10, topics: ["llm"], pushed_at: now, created_at: "2024-01-01T00:00:00Z",
    license: { spdx_id: "MIT" }, owner: { login: "someone", type: "User" }, homepage: "",
    archived: false, fork: false, open_issues_count: 10, html_url: "https://github.com/someone/repo", ...o
  });

  const cases = [
    ["scam: api key generator", mk({ full_name: "x/free-openai-api-key-generator", description: "Unlimited free OpenAI API keys generator, no limits" }), "skills", "blocked"],
    ["scam: cracked premium", mk({ full_name: "x/claude-premium-crack", description: "Claude premium cracked accounts, nulled" }), "skills", "blocked"],
    ["scam: crypto airdrop tokens", mk({ full_name: "x/free-tokens-airdrop", description: "Claim free tokens, connect your wallet, solana airdrop" }), "free-tokens", "blocked"],
    ["scam: account farm", mk({ full_name: "x/gemini-account-farm", description: "Gemini account and key rotator farm for free credits" }), "free-tokens", "blocked"],
    ["noise: archived", mk({ archived: true }), "skills", "blocked"],
    ["good: official skills", mk({ full_name: "google/skills", stargazers_count: 22000, owner: { login: "google", type: "Organization" }, topics: ["agent-skills", "skills"] }), "skills", "adopt"],
    ["good: big licensed active", mk({ stargazers_count: 110000, pushed_at: now }), "efficiency", "adopt"],
    ["caution: no license", mk({ stargazers_count: 110000, license: null }), "skills", "watch|skip"],
    ["caution: key pool proxy", mk({ full_name: "x/free-llm-api-proxy", description: "Free LLM API proxy and key pool, no api key needed" }), "free-tokens", "blocked|watch|skip"],
    ["ignored: fork", mk({ fork: true }), "skills", "skip"],
    ["ignored: stale", mk({ pushed_at: "2021-01-01T00:00:00Z" }), "skills", "skip"],
    ["ignored: brand new hype", mk({ stargazers_count: 4, created_at: now, description: "Unlimited infinite free tokens forever no limits" }), "free-tokens", "skip|blocked"]
  ];

  let pass = 0;
  for (const [label, repo, cat, expect] of cases) {
    const v = judge(repo, cat, cfg, todayISO());
    const got = v.blocked ? "blocked" : v.tier;
    const ok = expect.split("|").includes(got);
    if (ok) pass++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label} → ${got} (${v.blocked ? v.reasons[0] : v.score})${ok ? "" : `  expected ${expect}`}`);
  }
  console.log(`\n${pass}/${cases.length} passed`);
  if (pass !== cases.length) process.exit(1);
}

const selfTest = process.argv.includes("--selftest");
(selfTest ? runSelfTest() : main()).catch((e) => { console.error("RADAR ERROR:", e.message); process.exit(1); });
