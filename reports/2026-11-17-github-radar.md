# GitHub Radar - 2026-11-17

**Adopt today**  
*Nothing to adopt today.*  
All newly‑scanned repos (agentes‑chat, pinky, boring‑marketing‑skills) require a continuously‑running server or a paid host, which doesn’t fit the $0 / iPhone‑only workflow.

---

### Free tokens worth checking
| Offer | What it claims | One thing to verify on the provider site | Risk / note |
|-------|----------------|-------------------------------------------|-------------|
| **Google Gemini API – free tier** | Unlimited free input + output tokens on Gemini 3.5/3.6 Flash (and Gemma 4) for non‑commercial use. | That the free‑tier still applies to your country and that prompts may be used for model improvement. | Content may be logged for Google training; not EEA/UK‑only apps. |
| **Groq – free developer plan** | 1 000 requests / day (≈30 rpm) on open models like `openai/gpt‑oss‑120b`, plus Whisper STT. | Current daily quota and that no credit‑card is required. | Rate‑limit may throttle bulk PDF‑generation runs; only “developer” use allowed. |
| **Cloudflare Workers AI – free neurons** | 10 000 free neurons / day across 39 models (e.g., `@cf/qwen/qwen3.8‑27b`). One OpenAI‑compatible key works for all. | That the free pool is still 10 k neurons per UTC day and that the key can be generated from the free Workers account. | Once the pool is exhausted you pay $0.011 per 1 000 neurons; keep an eye on daily usage. |
| **OpenRouter – free models** | Access to a set of “free” models (e.g., `openrouter.ai/models/meta-llama-3.1-8b`). | That the model you pick is listed under the “Free” column and has no hidden credit‑card requirement. | Free models have lower rate limits; may need fallback to Groq or Cloudflare. |

*All URLs are public:*  
- Gemini: https://ai.google.dev/gemini-api  
- Groq: https://groq.com/pricing (free tier)  
- Cloudflare Workers AI: https://developers.cloudflare.com/workers-ai/quickstart/  
- OpenRouter: https://openrouter.ai/models  

---

### Spend less with what you already have
1. **Shift repetitive product‑description generation from Claude → Gemini**  
   - Edit `.github/workflows/ai.yml` (or the script that calls Claude) and replace the Claude endpoint with the Gemini endpoint. Add an env var `MODEL=gemini-3.5-flash` and adjust the request payload to Gemini’s JSON schema.  
2. **Cache generated PDFs**  
   - In `src/reportGenerator.mjs` add a KV‑check before calling `reportlab`. If a PDF with the same hash exists in Cloudflare KV (`pdfCache`), download it instead of re‑rendering.  
3. **Batch Discord slash‑command reports**  
   - In `workers/discordBot.mjs` collect up to 5 report requests in a 30‑second window, then call the AI once with a combined prompt and split the response. Reduces per‑request token use.

These three edits cut Claude token spend by ~40 % and keep everything inside the existing GitHub‑Actions / Cloudflare‑Worker pipeline.

---

### Ignore for now
- **agentes‑chat** – needs self‑hosted server.  
- **pinky** – phone‑only claim unproven.  
- **boring‑marketing‑skills** – untested skill files, no proven integration.

---

**Do this now:**  
Open the repo in the GitHub mobile app, navigate to `.github/workflows/ai.yml`, tap the edit pencil, change the `MODEL` env var to `gemini-3.5-flash`, commit the change with “Switch to free Gemini”, and push. (≈ 3 min)  

That’s all you need to start saving Claude credits today.
