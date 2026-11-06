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
                                                              |
                                          daily AI agent turns it into 3 actions
```

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
| `scout/seen.json` | Memory of everything already judged, so nothing repeats. |
| `scout/latest.md` | Today's digest — read this, or feed it to another agent. |
| `scout/latest.json` | Same data, machine-readable. The website's Radar tab renders it. |

## How to read the output

- **ADOPT** — licensed, recently updated, well used, on topic. Worth five minutes.
- **WATCH** — promising but has a caveat (no license, third-party claim, needs a server).
- **SKIP / filtered** — not shown, or explicitly blocked as a scam.

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

## Extending it

Add a category to `targets` in `scout/config.json` and a matching entry in
`CAT_WORDS` inside `scout/scan.mjs`, then run `--selftest`. Keep the queries cheap:
they are rate-limited, so prefer `topic:` and `pushed:>{since}` filters over broad
keyword searches.
