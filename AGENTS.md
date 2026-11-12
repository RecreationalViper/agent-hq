# Working in agent-hq (for every AI team)

Several AI teams work in this repo for one owner (GitHub: RecreationalViper). This file is how we
collaborate without stepping on each other. Read it before your first change.

## What this repo is
- **Agent HQ**: scheduled agents on GitHub Actions (`agents.json`, `run-agents.mjs`, `.github/workflows/`) that run the
  **Forever Held** shop: printable memorial kits sold on Payhip (https://payhip.com/b/vqNSA, $12.99).
- **Storefront**: `store/` → https://foreverheld.pages.dev (Cloudflare Pages) and GitHub Pages as backup. Rules: `skills/web/SKILL.md`.
- **Reports** from agents land in `reports/`; the team also posts to the owner's Discord.

## Who does what
| Team | Role |
| --- | --- |
| Claude | Head of operations: architecture, reviews and merges, keeps the Updates log and the agents running |
| Arena AI | Built and owns the GitHub Radar (`scout/`, `skills/github-radar/`) |
| New teams | Say what you're taking on in your first PR; check this table and `agents.json` so work isn't duplicated |

## How to make a change
1. **Branch + pull request.** Don't push straight to `main`. Name branches `<team>/<short-topic>` (e.g. `arena/radar-filters`).
2. **Small, focused PRs** with a plain-English description: what changed, why, how you tested it, anything the owner must do.
3. **Claude reviews and merges.** Expect questions or small fixes; that's normal.
4. **Generated files:** edit the generator, not the output. `store/{contact,terms,refunds,privacy,about,accessibility}.html` come from `tools/store-pages.py`.
5. **Don't rename or remove** another team's agents, workflows or files without asking in the PR.

## Ground rules (non-negotiable)
- **$0 budget.** Free tiers only. Never add anything that bills the owner without his approval.
- **No secrets in files.** Keys live in GitHub Actions secrets only. The repo is public.
- **Public store copy:** never mention AI, AI tools, agents or automation; no invented reviews, testimonials, statistics or customer stories.
- **Product facts:** buyers fill in PDFs in the free Adobe Acrobat Reader app and print at home or a print shop. Never say buyers need Canva.
- **Customers and money:** nothing that contacts customers, sends emails, changes prices or places real-money trades without a human approval step.
- **The owner works from an iPhone:** anything he must do, write as short tap-by-tap steps.

## Useful places
- AI calls: use `ai-ask.mjs` / `ai-fallback.mjs` (free providers with automatic fallback; usage is logged by `usage-log.mjs`).
- Discord posting: `discord.mjs`. Google Docs: `gdocs.mjs`. Website media list: `store/media.json`.
- Provider health: `tools/provider-check.mjs` (Provider Check workflow).
