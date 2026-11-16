---
name: github-radar
description: >
  Continuously scan GitHub for new agent skills, AI enhancements that work across
  models, legitimate free tokens/credits, and tools that reduce AI usage — then
  filter out scams and report only what is new since the last scan. Use when the
  user asks what's new in AI tooling, wants free credits or tokens, wants to cut
  AI costs, or wants someone else to keep watch on GitHub so they don't have to.
---

# GitHub Radar

A self-running watchtower for AI tooling. It answers one question every few hours:
**"is there something better or cheaper I should be using?"** — and it answers with
evidence, not vibes.

```text
saved searches -> GitHub API -> scam filter -> score -> new only -> digest
watched repos  ->  new SKILL.md?  ---------------------^              |
newborn lane   ->  created this month? ---------------^              |
                                              daily AI agent turns it into 3 actions
```

Three ways something can reach you:

| Lane | Catches | Why it exists |
| --- | --- | --- |
| Saved searches | repos that are new *to us* | the broad sweep |
| **Watched repos** | a `SKILL.md` added to a repo we already knew | a repo-level scan can never re-report a repo it has seen, so new skills inside `anthropics/skills` were invisible |
| **Newborn lane** | repos created in the last two weeks | early launches were being buried by the old "brand-new" penalty |

The scanning half uses **zero AI tokens**. Only the daily summary calls a model.

## When to use it

- "Find me new agent skills / MCP servers / plugins."
- "Any legit free tokens or credits I can use?"
- "How do I spend less on AI this week?"
- "Keep an eye on GitHub for me and tell me when something good shows up."

## How to run it

```bash
node scout/scan.mjs                # normal rotating scan (safe to run any time)
node scout/scan.mjs --dry-run      # print the digest, write nothing
node scout/scan.mjs --selftest     # prove the scam filter and scoring still work
RADAR_QUERY_LIMIT=30 node scout/scan.mjs   # sweep every saved search at once
```

Requires a `GITHUB_TOKEN` for the 30-searches-per-minute limit. Without one it still
works at 10/min, just slower.

## What it reads and writes

| Path | Purpose |
| --- | --- |
| `scout/config.json` | Which searches to run, trusted maintainers, scam patterns, thresholds. **Edit this to steer the radar.** |
| `scout/scan.mjs` | The scanner. No dependencies, Node 24, no AI. |
| `scout/seen.json` | Memory: repos already judged, plus the last commit and skill-file list of each watched repo. |
| `scout/watched.json` | Repos to look *inside* for newly added `SKILL.md` files. Keep it small and high-signal. |
| `scout/latest.md` | Today's digest — read this, or feed it to another agent. |
| `scout/latest.json` | Same data, machine-readable. The website's Radar tab renders it. |

## How to read the output

- **ADOPT** — licensed, recently updated, well used, on topic. Worth five minutes.
- **WATCH** — promising but has a caveat (no license, third-party claim, needs a server).
- **SKIP / filtered** — not shown, or explicitly blocked as a scam.
- **Newborn** — always reported at WATCH, never ADOPT: new is not the same as proven.

Every item carries `reasons` (why it scored) and `flags` (what to be careful about).
Treat flags as binding: `third-party-proxy` means your prompts leave your control,
`no-license` means you cannot safely reuse it, `self-host-required` means it will not
run on a phone.

## Rules when reporting to a human

1. Never claim to have installed, run, starred, or paid for anything.
2. Never recommend sharing an API key with a proxy, using generated/cracked keys,
   multi-accounting for free credits, or anything against a provider's terms.
3. Mark third-party offers as unverified and name the official page to check.
4. If the scan is empty, say so in one line. Silence is a valid, healthy result.
5. Cap recommendations at three. The owner has other teams of agents to run.

## The two newer lanes

**Watched repos.** `scout/watched.json` lists repos (with a `why` note) that we check for
new skill files. Each run looks at a rotating slice of three, so all of them are covered
over a few runs without spending the search budget. The first look at a repo is a
baseline and reports nothing — otherwise day one would dump hundreds of "new" files. If a
repo has more than 3,000 skill files only a count is kept, so `seen.json` cannot balloon.

To add a repo, add an entry and run once. Expect about two API calls per repo per run.

**Newborn lane.** `targets.newborn` in `scout/config.json` searches repos created in the
last `newbornAgeDays` (default 14) with a lower star floor, skips the "too new" penalty,
and caps the tier at WATCH. Capped at `newbornPerRun` (3) so it cannot crowd out the
main report.

## Extending it

Add a category to `targets` in `scout/config.json` and a matching entry in
`CAT_WORDS` inside `scout/scan.mjs`, then run `--selftest`. Keep the queries cheap:
they are rate-limited, so prefer `topic:` and `pushed:>{since}` filters over broad
keyword searches.
