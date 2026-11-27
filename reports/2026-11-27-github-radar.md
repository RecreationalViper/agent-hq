# GitHub Radar - 2026-11-27

## 1) Adopt today (max 3)
- **Google “skills” repo (google/skills)** — Fits because it’s model-agnostic “skill” wiring we can reuse through our existing AI gateway; helps automate parts of agent work without new server work.  
  **5-min first step:** On your iPhone, open the GitHub link → tap **Code** → **Go to file “README.md”** → skim the **quickstart / install steps** and note what it needs (credentials?).  
- **Claude Code / MCP skill plumbing to standardize tool access (modelcontextprotocol/python-sdk)** — Fits because it can route tool calls cleanly into whatever model we use (Gemini/Groq/etc.) while keeping our orchestration centralized.  
  **5-min first step:** Open the repo link → open **README.md** → find the section that says **“MCP servers/clients”** → check whether it requires a running server (if yes, pause and get approval).  
- **Janus terminal agent (janus-sh/Janus)** — Fits *only if* it can run locally from GitHub Actions or scripted workflows we already use; otherwise it’s a third-party terminal agent claim—needs approval.  
  **5-min first step:** Open the link → open **README.md** → find **installation/run** → confirm whether it supports “remote/model via API key” (and whether it’s compatible with our no-cost setup).

## 2) Free tokens worth checking
- **Gemini free tier (Google AI Studio / Gemini API)** — Claims a **permanent free tier** (via Google AI Studio). This aligns with our Gemini-first path.  
  **Verify on provider site:** check the **current Free tier limits** inside Google’s own docs/pricing.  
  **Risk:** Limits can change; free tier may have model/rate caps only visible in-account. *(Third-party summary: unverified)* [5] https://freellmapi.co/best-free-llm-apis-2026
- **Groq free developer tier** — Claims a free plan with rate limits for fast inference. Fits our backup chain.  
  **Verify on provider site:** confirm exact **free plan rate limits** on Groq docs/account.  
  **Risk:** per-model caps; tokens/day varies. *(Third-party summary: unverified)* [5] https://freellmapi.co/best-free-llm-apis-2026  
- **OpenRouter “:free” models** — Claims free models (IDs ending in `:free`) with daily/monthly caps. Fits our “menu of models” backup chain.  
  **Verify on provider site:** check OpenRouter’s **limits page** for free model caps.  
  **Risk:** caps tighter than they look; availability/model IDs can change. *(Third-party summary: unverified)* [5] https://freellmapi.co/best-free-llm-apis-2026  
- **Cloudflare Workers AI (free/credit/day “Neurons” claim)** — Claims **10,000 daily Neurons** (per their Workers AI free usage). Fits directly because we already use Cloudflare AI Gateway.  
  **Verify on provider site:** confirm the **current free daily quota** and whether it’s tied to a specific product/region.  
  **Risk:** quota details can be account/billing dependent. *(Third-party summary: unverified)* [1] https://aiforgeguide.com/free-llm-api-free-tier/  

**Official signup URLs (need you to open and confirm the exact page text):**
- Gemini: https://ai.google.dev/ (then to API/Gemini API access)
- Groq: https://console.groq.com/  
- OpenRouter: https://openrouter.ai/  
- Cloudflare Workers AI: https://developers.cloudflare.com/  

## 3) Spend less with what you already have (Claude Code + repo edits)
### Reduce Claude Code usage (no extra tools)
- **Phone habit:** Before each new task in Claude Code, run **`/usage`** then **`/context`** and **`/clear`** when you switch topics—this prevents re-sending old context. (This is the biggest “daily burn” lever.)  
- **Skill/flow change:** turn repeated “setup/rewrite/report” tasks into a **single reusable prompt + smaller input** you paste each time, instead of re-explaining goals.

### 2 concrete repo changes (GitHub Actions / prompt size / caching)
I need the repo files to propose *exact* edits (the scan only shows the radar file—no repo tree). **Flag for approval:** if you paste your key workflow + agent prompt files, I’ll give exact diffs.

**In the meantime, the 2 best targets to change once you share files:**
1) **Workflow model/prompt trimming:** edit the **GitHub Action step** that calls Claude/Gemini to  
   - reduce system + examples,  
   - pass only the changed inputs (diff summary) not whole files.  
   **File to change (you’ll provide):** `/.github/workflows/*.yml`
2) **Cache reuse for generated reports:** edit the report-generation action to reuse an existing `scout/latest.md` (and other generated outputs) instead of re-asking model summaries every run.  
   **File to change (you’ll provide):** whichever workflow currently regenerates reports (again `/.github/workflows/*.yml`), plus the script that writes the report markdown.

## 4) Ignore for now
Nothing new appeared under **Agent skills / AI enhancements / Free tokens/credits / Spend less** in the scan results—only “Still on the watchlist” items plus Janus.

## Do this now:
Open the **google/skills** GitHub link → open **README.md** → confirm whether it’s “skill wiring” (no server required).
