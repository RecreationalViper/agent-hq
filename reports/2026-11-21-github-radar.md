# GitHub Radar - 2026-11-21

### 1. Adopt today

Nothing to adopt today.

---

### 2. Free tokens worth checking

- **Parallel for Startups** [[10](https://www.aipromonow.com/promos/parallel-startups-250-api-credits)]
  - **What it claims:** $250 in free API credits for real-time web search and research without requiring a credit card.
  - **Verify on site:** Check their startup application page to see if bootstrapped $0-budget projects qualify without institutional backing.
  - **Risk:** Unverified third-party promotional report; requires manual form review and credits expire after 6 months.

- **RightNow AI Startup Program** [[7](https://www.aipromonow.com/en/promos/rightnow-ai-startup-program-2700-credits)]
  - **What it claims:** $200 in upfront API credits for open-weight models (DeepSeek, Qwen, GLM).
  - **Verify on site:** Confirm eligibility rules for un-funded solo projects.
  - **Risk:** Unverified third-party listing; requires submitting company details.

---

### 3. Spend less with what you already have

**Cut Claude Code token usage:**
Claude Code re-sends your entire conversation history with every message, making long sessions and unoptimized subagents expensive [[12](https://www.getlockstep.dev/blog/reduce-claude-code-token-usage), [13](https://leanopstech.com/blog/reduce-claude-code-token-usage/)]. Subagents default to your main session's model unless explicitly configured [[16](https://leanopstech.com/blog/claude-code-subagents-tokens/)].

**Concrete changes for this repo:**
1. **Set subagents to a lightweight model:** Prevent background reads and file searches from consuming main-model tokens [[16](https://leanopstech.com/blog/claude-code-subagents-tokens/)].
   - *Exact edit:* Set `export CLAUDE_CODE_SUBAGENT_MODEL=haiku` in your environment or CLI config.
2. **Trim project context overhead:** System rules in `CLAUDE.md` append to every single prompt [[13](https://leanopstech.com/blog/reduce-claude-code-token-usage/)].
   - *Exact edit in `CLAUDE.md`:* Keep `CLAUDE.md` under 200 lines by moving procedural instructions into task-specific skill files [[13](https://leanopstech.com/blog/reduce-claude-code-token-usage/), [15](https://skillmanifest.co/blog/claude-code-skills-vs-subagents)].

---

### 4. Ignore for now

- **`rocketride-org/rocketride-server`**: Needs running server, not phone-only.
- **`JuneYaooo/rea-video`**: Unofficial video scraping, high risk.
- **`revfactory/harness`**: Complex framework, unnecessary project overhead.
- **`google/adk-recipes`**: Requires Google ADK framework.

---

### Do this now:

Open `CLAUDE.md` on GitHub using your phone browser, verify its line count, and move non-essential setup instructions out to keep context under 200 lines.
