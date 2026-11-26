# GitHub Radar - 2026-11-26

# GitHub Radar — 2026-11-26

## Adopt today
Nothing to adopt today. The only ADOPT item (yetone/magpie) pools *paid* plans — you run on free tiers. The three new WATCH repos are unproven and don’t slot into memorial printables, GitHub Actions, or your backup chain.

## Free tokens worth checking
| Offer | Claim | Verify on provider site | Risk |
|-------|-------|-------------------------|------|
| **Exa Startup Credits** [11] | Up to $15k (standard $7.5k) for search/contents/agent | https://exa.ai/startups — check eligibility & expiry (6–12 mo) | Third-party summary; must apply & be approved |
| **Anthropic Startup Program** [7] | $1,000 Claude API credit | https://www.anthropic.com/startups — confirm solo founder qualifies | Unverified by Anthropic directly; may require incorporation |
| **Your existing chain** [1][2][3][4][5] | Gemini, Groq, Cloudflare Workers AI, OpenRouter `:free`, Cohere all have recurring free tiers | Each provider’s pricing/docs page (links in sources) | Limits change; check your actual account dashboard |

**Skip:** GVC LLM credits [8] (Korean program, needs business registration), SambaNova [6] (retired free tier [4]), any “free key generator” — against ToS.

## Spend less with what you already have
**Claude Code (your biggest cost)**
- **Habit:** Run `/clear` between unrelated tasks, then `/context` before `/compact`. Lower auto-compact to 400k tokens. Keep `CLAUDE.md` under 500 lines. Default to Sonnet/Haiku, not Opus. [12][13][14][15]

**Repo changes (exact edits)**
1. **`.github/workflows/*.yml`** — Add `if: github.event_name == 'schedule'` guard so AI steps only run on cron, not on every push. Batches runs, cuts redundant calls.
2. **`scripts/ai-client.mjs` (or wherever you call Gemini/Groq/OpenRouter)** — Ensure every request passes `cf-aig-cache-ttl: 3600` header so Cloudflare AI Gateway caches responses. Verify in Gateway dashboard → Logs → “Cached” column.

## Ignore for now
- yetone/magpie — pools paid plans, not free tiers
- nexu-io/opengame — game dev, not printables
- petergyang/video-explainer — unproven, new repo
- matheusmongarde/skill-prospeccao — B2B sales, not memorial prints
- Anthropic startup program — needs approval, not solo-friendly
- GVC credits — Korean program, needs business reg

## Do this now
Open Cloudflare AI Gateway dashboard on phone → check **Logs** for the last 24h: confirm “Cached” > 0 for Gemini, Groq, OpenRouter, Workers AI. If any show 0, add the cache header in your AI client script (see repo change #2). Takes 10 minutes.
