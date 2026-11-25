# GitHub Radar - 2026-11-25

# GitHub Radar Report — 2026-11-25

## Adopt today
Nothing to adopt today. The scan returned no new agent skills, AI enhancements, free-token offers, or cost-cutting tools that plug into our stack (GitHub Actions, Gemini/Groq/Cloudflare/OpenRouter backup chain, Cloudflare Worker+KV, Discord bot, Playwright, reportlab). The single "Start here" hit is a LinkedIn quiz repo — irrelevant. Watchlist items are from prior scans and need owner review before any install.

## Free tokens worth checking
| Provider | Offer (per source) | Verify on provider site | Risk |
|---|---|---|---|
| **Google AI Studio (Gemini)** [1][3][6] | Free tier, no card at signup; default GCP project + API key | Check "Free tier eligibility" in AI Studio settings — some projects excluded | Rate limits can drop without notice; not a contract |
| **Groq** [2][3][5][6] | Free plan: 1,000 req/day, 30 req/min, 200K tokens/day (model-dependent) | Open console.groq.com → Rate Limits page for your exact caps | Free tier caps are "base limits"; can change |
| **OpenRouter** [3][4][6] | `:free` models: 20 req/min, 50 req/day; after $10 credit purchase → 1,000/day | Check openrouter.ai/docs/api-reference/limits (read 2026-11-25) | Daily cap is tight; `:free` model roster rotates |
| **Cloudflare Workers AI** [2][3] | 10,000 Neurons/day free (≈10K–50K tokens depending on model) | Dashboard → Workers AI → Usage for your account | Neuron pricing per model varies; monitor in dashboard |
| **Cohere** [2][3] | Trial keys with free quota (exact limits shown in dashboard) | Cohere dashboard → API Keys → Usage | Trial may expire; not a permanent free tier |
| **Mistral** [2][3] | Free tier via la Plateforme (limits in account) | console.mistral.ai → Usage & Billing | Limited model selection on free tier |
| **NVIDIA NIM** [2][3] | Free tier via build.nvidia.com (rate-limited) | Check build.nvidia.com for current limits | Requires NVIDIA account; primarily for eval |
| **Cerebras** [1][5] | $5 / 30-day trial (card required) | Cerebras cloud console for credit balance | Trial expires; card on file for auto-upgrade |
| **Anthropic** [1][10] | "Free credits to test API" — amount unpublished | Anthropic Console → Billing for actual grant | No public number; may require startup program for meaningful volume |
| **AWS / Azure / GCP startup credits** [1][10][11] | Up to $200K (AWS Activate), $150K (Azure), $350K (GCP) over years | Each cloud's startup program page for eligibility | Need incorporated entity + often VC backing; not for solo $0 ops |

> **Third-party/unverified**: [1] aiforgeguide.com, [2] scriptrun.ai, [3] aiforgeguide.com (second article), [4] dev.to community post, [5] miniaitools.com, [6] freellmapi.co, [7] adral.ai, [8] Korean gov program (GVC), [9] Vercel X (requires SF residency), [10] starterperks.com, [11] pmfstack.com — all aggregate provider claims; treat as maps, not guarantees.

## Spend less with what you already have
**1. Cut Claude Code usage (owner's biggest cost) — move repeated repo tasks into a scheduled GitHub Action**  
The radar scan (`scout/scan.mjs`) already runs on cron with **zero AI tokens**. Any recurring analysis (e.g. "summarize this week's sales", "draft Pinterest pins") should be a Node script in `.github/workflows/` calling Gemini via Cloudflare AI Gateway (cached), not a Claude Code session.  
**Exact edit**: Create `.github/workflows/weekly-summary.yml` with `uses: actions/github-script` or a `node` step that POSTs to your Cloudflare Worker endpoint. Keep the prompt in a repo file (`prompts/weekly-summary.txt`) so it's versioned and reusable.

**2. Shrink the default context in this repo's CLAUDE.md (or root instructions)**  
Web sources [12][13][14][15][16] agree: a bloated CLAUDE.md loads every session.  
**Exact edit**: Open `CLAUDE.md` (or `.claude/CLAUDE.md` if you use that pattern). Delete any section not used in the last 5 sessions. Move "how to run the scout" and "repo layout" to `docs/onboarding.md` and reference it with `@docs/onboarding.md` only when needed. Target < 500 tokens.

**3. Enable prompt caching on the Cloudflare AI Gateway for repeated Gemini calls**  
Our backup chain already routes through the Gateway. Turn on caching for identical prompts (e.g. the "generate memorial text" prompt used daily).  
**Exact edit**: In Cloudflare Dashboard → AI Gateway → Settings → toggle **Cache Responses** for the Gemini endpoint. Set TTL 24h. Verify with `/logs` that `cf-aig-cache-status: HIT` appears.

## Ignore for now
- `anthropics/claude-plugins-official` / `modelcontextprotocol/python-sdk` / `google/skills` — Python SDKs, need server; we run Node on Actions 📵
- `obra/superpowers` / `agentes-chat/agentes-chat` / `erkamyaman/rust-anything` — self-hosted agent frameworks; no free hosting 📵
- Vercel X credits [9] — requires 6 weeks in San Francisco 🏠
- GVC Korean startup program [8] — requires Korean entity 🇰🇷
- Adral for Startups [7] — new provider, not in our backup chain 🔑
- LinkedIn quiz repo — wrong domain 🎯

## Do this now
Open the Cloudflare AI Gateway dashboard on your phone (dash.cloudflare.com → AI Gateway), toggle **Cache Responses** for the Gemini endpoint, set TTL 24h, then run one manual scout scan (`gh workflow run scout-scan.yml`) to confirm a `HIT` appears in logs. 10 minutes, saves tokens every daily run.
