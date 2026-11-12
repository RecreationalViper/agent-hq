# GitHub Radar - 2026-11-12

**Adopt today**  
1. **emilkowalski/skills** – a ready‑made library of `SKILL.md` prompt blocks you can drop into your repo and call from a GitHub Action (Node).  
   *5‑min step*: Open the repo page on GitHub, tap **Code → Download ZIP**, unzip on iPhone, copy the `skills/` folder into the root of your Forever‑Held repo, and add a single line `import "./skills/DesignPrompt.md"` to the existing `generate‑pdf.js`.  

2. **Google Gemini API free tier** – already in use, but the free “Flash” quota (≈500 k tokens/mo) is unlimited for text + 500 grounded searches/day.  
   *5‑min step*: Open the Google AI Studio console, tap **Create project → API key**, copy the key, and paste it into the existing `GEMINI_API_KEY` secret in your GitHub repo Settings → Secrets.  

3. **Cloudflare Workers AI free models** – 10 k Neurons/day across 39 models, reachable with a single OpenAI‑compatible key (no extra server).  
   *5‑min step*: In the Cloudflare dashboard, enable **Workers AI**, generate an **API Token** (choose “Workers AI → Edit”), copy it, and add it as `CF_AI_TOKEN` secret in the repo. Then change `model: "gemini-3.5-flash"` → `model: "@cf/qwen/qwen3.8-27b"` in `config.js`.  

---

**Free tokens worth checking**  

| Offer | What it claims | Verify | Risk / Note |
|------|----------------|--------|-------------|
| Google Gemini API free tier | Unlimited Flash text, 500 grounded searches/day | Docs page shows “Free tier, no card”【1†L1-L4】 | Limits may shrink; watch usage logs. |
| Groq free developer tier | 30 rpm / 1 k RPD / 8 k TPM for open‑weight models【1†L9-L11】 | Dashboard shows current limits. | Rate‑limit throttling; fallback needed. |
| Cloudflare Workers AI free models | 10 k Neurons/day across 39 models【5†L1-L4】 | Cloudflare “Free tier” page lists exact quotas. | Shared quota; other workers on account consume it. |
| OpenRouter free tier (listed in the blog) | Access to several open‑source LLMs, ~200 k tokens/mo【1†L12-L14】 | OpenRouter pricing page. | Occasionally requires credit‑card for verification; check. |
| Parallel for Startups credits (apply) | Unlimited credits for Parallel API if accepted【7†L1-L4】 | Application status page. | Requires approval; not immediate. *(skip until accepted)* |

---

**Spend less with what you already have**  

1. **Cache prompt‑skill output** – edit `scripts/generate-pdf.js`: add a check for `if (fs.existsSync("cached.md")) return fs.readFileSync("cached.md")`; write the markdown once per product run.  
2. **Swap Claude Code calls to Gemini/Cloudflare** – in `config.js` replace `model: "claude-3.5-sonnet"` with the free Gemini or Cloudflare model you added above.  
3. **Batch Discord slash‑command reports** – modify `workers/discord.js` to collect up to 5 product updates before sending a single embed (reduce API calls).  

---

**Ignore for now**  

- Codewhale (Rust compile) – needs build env.  
- Pinvou‑agent (desktop) – not server‑less.  
- Parallel startup credits – application required.  
- Zoom AI Launchpad – video‑focused, not relevant.  
- AMD GPU credits – needs GPU compute.  

---

**Do this now:**  
Open the GitHub mobile app, navigate to your repo, add the `skills/` folder from the downloaded ZIP, commit the change, and push – all in under 30 minutes.
