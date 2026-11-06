# agent-hq

A personal AI headquarters that runs itself on GitHub Actions: scheduled agents write
reports into this repo, and a phone-friendly website reads them straight from the repo.
Budget: $0.

## What's inside

| Piece | What it does | Schedule |
| --- | --- | --- |
| **GitHub Radar** | Scans GitHub for agent skills, cross-model AI upgrades, legitimate free tokens/credits, and ways to spend less. Filters scams. **Zero AI tokens to scan.** | every 3 hours |
| Radar analyst agent | Turns the latest scan into 3 adopt-now actions plus cost-cutting moves | daily |
| Daily Focus, Content Planner, Product Ideas, Listing Writer, Credit Scout | Etsy shop work (see `agents.json`) | see `agents.json` |
| Weekly Review | Manager summary of everything the team produced | Sundays |
| Trading Desk | Paper-trading desk with a backtest analyst | weekdays |

## GitHub Radar — the "keep looking so I don't have to" agent

`scout/scan.mjs` runs on GitHub's servers around the clock. It runs a rotating slice of
its saved searches, scores every hit on stars, freshness, license, maintainer and
relevance, hard-blocks the scam shapes (key generators, credential harvesting,
"unlimited free API keys", crypto-token confusion), and only reports what it has never
seen before. The daily **GitHub Radar** agent then reads that digest and writes a short
report you can act on from your phone.

- Read the latest scan: [`scout/latest.md`](scout/latest.md)
- Steer the searches and thresholds: [`scout/config.json`](scout/config.json)
- Use it from another agent: [`skills/github-radar/SKILL.md`](skills/github-radar/SKILL.md)
- Phone view: the **Radar** tab on the website

```bash
node scout/scan.mjs --dry-run    # see what it would report, write nothing
node scout/scan.mjs --selftest   # check the scam filter still catches scams
```

Why it stays cheap: scanning is pure GitHub API + arithmetic, the digest is written
from template, and searches are ETag-cached so an unchanged query costs one request and
no output. A typical day of radar use costs **0 AI tokens** and ~8 free Action minutes.

## Setup (one time)

1. Add `GEMINI_API_KEY` in **Settings → Secrets and variables → Actions**.
2. Run **Actions → Agent HQ → Run workflow** once, then **GitHub Radar** once.
3. On a phone, open `index.html` (GitHub Pages or the raw file) and use the tabs.

## Rules the agents follow

Drafts and recommendations only — no publishing, spending, or contacting anyone without
your approval. Anything filtered as a scam stays filtered. Nothing is installed or
subscribed to on your behalf.
