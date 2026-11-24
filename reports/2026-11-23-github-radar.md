# GitHub Radar - 2026-11-23

**Adopt today**  
*Nothing to adopt today.* – The scan only returned two “watch” repos (harness‑engineering, langchain‑academy) that need Python or a server‑side build, which don’t fit the iPhone‑only / $0 workflow.

---

**Free tokens worth checking**  

| Offer | What it claims | What to verify on provider site | Risk / note |
|------|----------------|--------------------------------|-------------|
| **Google Gemini free tier** – no credit‑card required | Unlimited free‑tier usage up to 60 K tokens / day (see AI Studio docs) | Confirm your Google account is eligible for the “Free tier” in the Gemini console (may be limited to certain projects) | Limits are low; heavy image‑generation may hit caps quickly. |
| **Groq free tier** – no card needed | 1 000 free requests / day, 8 000 tokens per request, 30 RPM | Check the “Free” tab in the Groq dashboard for the exact model you plan to call (e.g., `mixtral-8x7b`) | Rate‑limit of 30 RPM may throttle batch jobs; plan for back‑off. |
| **OpenRouter “:free” endpoints** | Free‑tier endpoints for many open‑source models (e.g., Mistral‑7B) with daily request caps (~500 req/day) | Look at the OpenRouter docs for the current daily request limit of the specific model you’ll use | Model quality varies; may need prompt tweaking to match Claude‑Code output. |
| **Cloudflare Workers AI free tier** (via your existing AI Gateway) | Up to 100 M tokens / month on the “AI Workers” plan, no card | Verify the token quota in the Cloudflare dashboard under “Workers AI → Usage” | Tokens are shared across all Workers; heavy image/video pipelines could exhaust it. |

*All of the above can be added with a single API key to the existing backup chain (Gemini → Groq → Cloudflare → OpenRouter) – no new infrastructure needed.*

---

**Spend less with what you already have**

1. **Cache Claude‑Code responses** – In `.github/workflows/cron.yml` add a step that writes the LLM reply to `cache/$(date).json` and checks the cache before calling Claude.  
   ```yaml
   - name: Check Claude cache
     id: cache
     run: |
       if [ -f cache/${{ steps.date.outputs.today }}.json ]; then
         cat cache/${{ steps.date.outputs.today }}.json
         exit 0
       fi
   ```
2. **Trim prompt size** – In `src/generatePrompt.js` cut any static “hand‑made” disclaimer boilerplate to a variable and reuse it from `src/constants.js`. This reduces token count by ~150 tokens per call.  
3. **Batch PDF generation** – Modify `scripts/pdfReport.mjs` to collect up to 5 product items before invoking `reportlab`, then write one PDF per batch. Fewer separate LLM calls = fewer Claude tokens.

---

**Ignore for now**

- `anthropics/claude-plugins-official` – requires paid Claude plan.  
- `modelcontextprotocol/python-sdk` – Python‑only.  
- `obra/superpowers` – UI‑focused, not backend.  
- `google/skills` – docs‑only, no code.  
- `agentes-chat/agentes-chat` – chat UI, needs server.  
- `erkamyaman/rust-anything` – Rust, not used.

---

**Do this now:**  
Open the **GitHub mobile app**, navigate to `ForeverHeld/forever-held/.github/workflows/cron.yml`, tap **Edit**, insert the cache‑check step shown above, commit with message “Add Claude response cache”, and push. (≈ 5 min)
