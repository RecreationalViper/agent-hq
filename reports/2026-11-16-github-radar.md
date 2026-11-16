# GitHub Radar - 2026-11-16

### Adopt today

Nothing to adopt today.

---

### Free tokens worth checking

* **Cloudflare Workers AI Free Tier** [6]
  * **Claim:** 10,000 free Neurons/day across 39 models (Qwen 3.8, Gemma 4, GLM-4.7) via an OpenAI-compatible endpoint.
  * **Verify on site:** Check your daily neuron counter in the [Cloudflare Dashboard](https://dash.cloudflare.com/).
  * **Risk:** Soft daily cap; requests fail over to next backup model once 10k neurons are hit.
* **AMD Token Lab (via AMD AI Developer Program)** [11]
  * **Claim:** Free API access to DeepSeek V4, Qwen 3.8, and Gemma 4 powered by AMD GPUs plus $100 cloud credits. *(Note: Third-party unverified listing from aifree.dev)* [11].
  * **Verify on site:** Check token allocation on the [AMD Developer Portal](https://aifree.dev/news/amd-token-lab-free-api-deepseek-v4-qwen3-8-gemma-4).
  * **Risk:** Unverified third-party offer; point limits and trial duration are unpublished and subject to instant change.

---

### Spend less with what you already have

* **Cut Claude Code background context (Save owner tokens):**
  * benchmark testing shows a large `CLAUDE.md` file sends full token history on every turn (costing up to ~8,800 tokens per message vs ~60 tokens when loaded on demand as a skill) [15].
  * **Exact edit:** Audit `CLAUDE.md` in the repo root to keep it under 200 lines [13]. Move step-by-step agent instructions into `.claude/skills/` so they only load when requested.
* **Use `/clear` instead of `/compact` between tasks:**
  * Running `/compact` sends a large compaction request, whereas `/clear` drops session history for $0 [13].
  * **Exact edit:** Type `/clear` in Claude Code on your phone before starting any unrelated fix.
* **Enable Cloudflare AI Gateway Caching on scanner calls:**
  * Avoid spending Gemini/Groq tokens on repeated queries during manual re-runs.
  * **Exact edit:** Add `'cf-aig-cache-ttl': '86400'` to fetch headers in `scout/scan.mjs` to cache daily LLM calls at the gateway level.

---

### Ignore for now

* **FareedKhan-dev/all-agentic-architectures:** Requires Python environment and frameworks.
* **Zoom AI Launchpad ($150k credits)** [8]: Requires enterprise startup application process.
* **Morph Startup Credits ($1k)** [10]: Requires accelerator approval and credit card.
* **Parallel for Startups** [7]: Requires active venture accelerator membership.

---

### Do this now:

Open `CLAUDE.md` in your GitHub mobile web editor and move repetitive task instructions into separate files under `.claude/skills/` to instantly lower every Claude Code prompt's context bill.
