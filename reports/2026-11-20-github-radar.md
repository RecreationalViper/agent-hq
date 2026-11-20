# GitHub Radar - 2026-11-20

### Adopt today

Nothing to adopt today.

---

### Free tokens worth checking

- **Parallel for Startups** [7]: Claims $250 in API credits with no credit card required for direct applicants. Official page details via [Sulat AI News](https://news.sulat.com/2026/11/14/parallel-for-startups-credits/). Verify on Parallel's site whether solo bootstrapped micro-businesses qualify without pitching or funding docs. *Risk: Third-party startup application; approval is unverified.*
- **Groq & Cloudflare Workers AI Tiers** [1][4]: Re-verified standing free limits (Groq: 1,000 req/day [4]; Cloudflare: 10,000 neurons/day [4]). Note that GitHub Models was fully retired in July 2026 [2][6], so keep your backup chain pointing directly to Groq -> NVIDIA NIM -> Cloudflare Workers AI -> OpenRouter `:free`.

---

### Spend less with what you already have

- **Save Claude Code tokens (Subagent model override)** [12][13]: Claude Code subagents default to the main session's model, burning heavy tokens on simple lookups. Set `export CLAUDE_CODE_SUBAGENT_MODEL=haiku` in your iPhone terminal or environment before running subagents so search/file tasks run on Haiku context [13].
- **Repo change 1 (`CLAUDE.md`)**: Trim `CLAUDE.md` to under 200 lines [12]. Every session resends this file on every turn; removing redundant prose lowers your context tax permanently.
- **Repo change 2 (`scout/scan.mjs`)**: Ensure scout scripts restrict prompt inputs to new or modified diffs rather than full repo trees, keeping Gemini API free-tier input tokens low.

---

### Ignore for now

- `darkzOGx/youtube-automation-agent`: Requires dedicated server, not phone-only.
- `ikaijua/Awesome-AITools`: Curated link directory, not actionable.
- `google/skills` (GCP additions): Requires paid GCP enterprise setup.

---

**Do this now:** Open `CLAUDE.md` on GitHub Mobile, delete any non-essential background text or duplicate instructions to bring it under 200 lines, and commit the change.
