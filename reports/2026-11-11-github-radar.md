# GitHub Radar - 2026-11-11

# GitHub Radar — 2026-11-11

## 1. Adopt today
Nothing to adopt today.

*(Note: `obsidianmd/obsidian-skills` appeared in the radar scan, but Obsidian is on our "do not use" list).*

---

## 2. Free tokens worth checking

- **Cloudflare Workers AI (10,000 free daily neurons)**
  - **Official URL:** https://dash.cloudflare.com/
  - **What it claims:** 10,000 free neurons per day across 39 models, including `@cf/qwen/qwen3.8-27b` and `@cf/zai-org/glm-4.7-flash` [5].
  - **Verify on site:** Check your daily neuron meter under Workers & Pages > Workers AI in Cloudflare Dashboard.
  - **Risk:** Daily neuron exhaustion will drop API calls to backup providers if failover isn't configured in AI Gateway.

- **Groq Free Developer Tier**
  - **Official URL:** https://console.groq.com/
  - **What it claims:** Free rate-limited API access (30 RPM, 200K tokens/day on models like `gpt-oss-120b`) without a credit card [3, 4].
  - **Verify on site:** Check the limits tab in Groq Console for `gpt-oss-120b` and Qwen models [3].
  - **Risk:** Strict daily token caps (200K TPD) can freeze cron workflows if a script loops unexpectedly.

---

## 3. Spend less with what you already have

- **Cut Claude Code token usage (Save Owner's Limit):**
  - Use `/clear` to reset the session before starting a new build task. Claude Code resends full conversation history on every turn, causing context bloat where 98%+ of usage goes to re-reading history [12, 14, 16].
- **Repo Change 1 (`CLAUDE.md`):**
  - **Edit:** Trim `CLAUDE.md` to under 80 lines, removing long boilerplate or prompt history. Claude Code injects `CLAUDE.md` into every single request, inflating context tokens automatically [12, 16].
- **Repo Change 2 (`scout/scan.mjs` or script prompts):**
  - **Edit:** Ensure Gemini API calls set explicit system instructions once and reuse cached context rather than embedding full repository text into prompt body calls [3, 14].

---

## 4. Ignore for now

- **obsidianmd/obsidian-skills:** We do not use Obsidian.
- **Zoom AI Launchpad ($150K):** Requires formal startup program application [7].
- **AMD & GMI Cloud Credits:** Requires dedicated GPU cloud setup [9, 10].

---

**Do this now:**
Open GitHub on your phone, edit `CLAUDE.md` to trim redundant instructions down to essential build rules, and run `/clear` in your next Claude Code session.
