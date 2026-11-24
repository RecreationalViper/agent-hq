# GitHub Radar - 2026-11-24

### **GitHub Radar Report — 2026-11-24**

---

#### **🔥 Adopt today**
1. **[plannotator](https://github.com/backnotprop/plannotator)**
   *What*: A skill library for agents to shape, annotate, and review code collaboratively (14K stars, Apache-2.0).
   *Why*: Plugs into Claude Code via `SKILL.md` files—no server needed. **5-min step**: Open the repo → tap "Raw" on `SKILL.md` → copy the `## code_review` skill → paste into your agent’s `skills/` folder (or GitHub Actions script) and test with `!skill list`.

2. **Groq’s 1,000 free requests/day (no card)**
   *What*: Confirmed 30 RPM, 8K tokens/min for GPT-OSS/Qwen3.8 (backup chain slot).
   *Why*: Fits Cloudflare AI Gateway routing. **5-min step**: Open [Groq Free Tier](https://groq.com/free) → tap "Sign Up" → verify no card prompt → save API key to `~/.env` (or Cloudflare KV).

---
#### **💰 Free tokens worth checking**
| Provider          | Offer                          | Verify This                          | Risk                          |
|-------------------|--------------------------------|--------------------------------------|-------------------------------|
| **Groq**          | 1,000 reqs/day, no card       | [Groq Free Tier](https://groq.com/free) → check "Free" tab for GPT-OSS limits | None (official)              |
| **OpenRouter**    | `:free` models (e.g., `mistral-7b`) | [OpenRouter Free](https://openrouter.ai/free) → confirm `reqs/day` | Rate limits may vary by model |
| **Adral Startups**| Free API key + dashboard       | [Adral for Startups](https://adral.ai/startups) → "Apply" button | Approval required (no guarantee) |
| **Claude Startups**| *Closed* (as of 2026-11-19)   | [Anthropic Docs](https://www.anthropic.com/news/claude-startups-program) | N/A (no new apps) |

*Avoid*: Third-party "free API key" sites (e.g., [freellmapi.co](https://freellmapi.co/free-llm-api-no-credit-card))—unverified.

---
#### **⚡ Spend less with what you already have**
1. **Claude Code savings**:
   - Edit `claude/agent.mjs`: Replace `model: "opus"` with `model: "sonnet"` (default) for 50% cheaper tokens.
   - *File*: `claude/agent.mjs` → Line 10 → Update model.
   - *Bonus*: Add `/compact` after long tasks (use [Griffin’s guide](https://griffin.app/claude-code-token-usage/)).

2. **Repo setup**:
   - Batch Playwright screenshots: Modify `scripts/capture.mjs` to reuse `page.pdf()` outputs instead of re-rendering. *Edit*: Add `if (!fs.existsSync(cacheDir))` check before new captures.

---
#### **❌ Ignore for now**
- `game-rebuild-kit` → *Scraping risk*
- `browser-capture` → *New/unlicensed*
- Vercel X → *Startup program (not $0)*
- Open-source LLMs → *No iPhone CLI*

---
#### **Do this now:**
**Open [plannotator’s `SKILL.md`](https://github.com/backnotprop/plannotator/blob/main/SKILL.md) → copy the `## code_review` section → paste into a new file in your repo called `skills/code_review.md` (create the `skills/` folder if missing).**
*Why*: This lets you test agent skills without Claude Code usage. Next step: Approve adding it to `scout/watched.json`.
