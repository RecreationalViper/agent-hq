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
| Ploy AI (ploy.ai) | Website and marketing agent: builds/edits/screenshots sites, SEO & AEO audits, research, lead finding, CRO ideas. Workspace "Forever Held". Claude talks to it through its MCP connector |
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

## Ploy leads, our agents follow (shift handoff)
- Ploy AI leads the jobs listed in `ploy/status.md` (website, SEO/AEO, ads, leads, positioning).
- **While Ploy is running: hands off its jobs.** Research and notes only (`## For Ploy`).
- **While Ploy is on break: our shift, fully hands-on.** Our agents build, edit and publish (website, SEO pages, email capture,
  funnels, sales, customer care), using Ploy's methods and `ploy/brand.md` as the frame of reference. Don't undo Ploy's finished work.
- Claude syncs Ploy → `ploy/` (free reads) and hands shift work back to Ploy (`ploy/shift/`) after its credits reset.
- **Shift lock: `ploy/state.json` + `ploy-state.mjs`.** Before any code changes something in a Ploy job area, call
  `mayChange(area)` (areas: website, seo, hero-cro, ads, positioning, leads). If it says no, save the work to `ploy/shift/` instead.
  Agents with `"followsPloy": true` in agents.json get the live shift status in their prompt automatically.
- **Working together:** only when the owner says so, Claude sets `"together": true` for that job. Even then, nobody overwrites
  Ploy's pages; our side contributes through `ploy/shift/` and Ploy merges it.
- **Never interrupt Ploy:** messages to Ploy are sent only when its chat is idle (not working, nothing pending), always as
  `queue`, never `steer`, one batched message per chat.

## Ploy credits (free plan: 700 AI credits a day, resets 7 pm New York / 00:00 UTC)
- One job at a time; batch related asks into one message instead of many small ones.
- Use the **lite** agent profile for small edits and questions; the full agent only for builds and audits.
- Reuse existing Ploy chats (one per site/topic). Don't start a new Ploy for follow-ups.
- Read Ploy's results (documents, artifacts, conversation) for free before asking it to redo work; share them with the team via `reports/` instead of re-running.
- Screenshots and visual checks cost credits: ask once per change, at both widths together.
- Never approve ad spend or anything that costs money; that's the owner's call in the Ploy dashboard.

## Useful places
- AI calls: use `ai-ask.mjs` / `ai-fallback.mjs` (free providers with automatic fallback; usage is logged by `usage-log.mjs`).
- Discord posting: `discord.mjs`. Google Docs: `gdocs.mjs`. Website media list: `store/media.json`.
- Provider health: `tools/provider-check.mjs` (Provider Check workflow).
