# GitHub Radar - 2026-11-18

# GitHub Radar Report — 2026-11-18

## 1. Adopt today
**Nothing to adopt today.**
*   *GetStream/Agents*: Needs self-hosted Go backend.
*   *day-trader-skill*: Financial trading; irrelevant to memorial prints.

## 2. Free tokens worth checking
*   **Cloudflare Workers AI**: Claims 10,000 neurons/day free [4].
    *   *Verify*: Login to Cloudflare dashboard > AI > Check if "Granite 4.0 micro" is available on your free plan without a card.
    *   *Risk*: Some models (glm-5.3, deepseek) now require a billing method [4].
*   **Groq Free Plan**: Claims 1,000 req/day free [2].
    *   *Verify*: Login to console.groq.com > Check current rate limits for `gpt-oss-120b`.
    *   *Risk*: Rate limits may fluctuate; this is already in your backup chain.
*   **RightNow AI Startup Program**: Claims $200 free credits + 20% bonus [8].
    *   *Verify*: Visit parallel.ai/startups [7] or RightNow docs to confirm eligibility for "bootstrapped" vs formal startups.
    *   *Risk*: Third-party aggregator source [8]; unverified by us. Requires company details/approval.

## 3. Spend less with what you already have
*   **Claude Code Savings**:
    *   *Problem*: Repeated context in `scout/scan.mjs` or agent prompts.
    *   *Fix*: Add `/clear` command logic or use "focused compaction" [11] in your Claude Code workflows. If you re-run the same scan, ensure the context window is cleared before the next task to avoid token bloat.
*   **Repo Optimization**:
    *   *Edit*: `scout/scan.mjs`
    *   *Change*: Reduce the number of saved searches from 33 to only the ones returning data. The scan showed 12 of 33 returned data. Removing 21 empty searches saves API calls and processing time, reducing the chance of hitting rate limits on your main AI.
    *   *Edit*: `github-actions/workflows`
    *   *Change*: If the Gemini API free tier is working, route the "analysis" step of the scout to Groq/Cloudflare (free tiers) instead of Gemini/Claude, saving your paid/limited Claude tokens for complex coding only.

## 4. Ignore for now
*   **Vercel X Accelerator**: Requires SF HQ presence.
*   **Parallel for Startups**: Requires accelerator affiliation.
*   **Morph Startup Credits**: Requires formal startup status.
*   **GetStream/Agents**: Needs self-hosted server.

## Do this now:
Open `scout/scan.mjs` on your phone (via GitHub web editor or Claude Code mobile). Comment out 5 of the 21 empty searches to reduce noise and API load. Takes 5 minutes.
