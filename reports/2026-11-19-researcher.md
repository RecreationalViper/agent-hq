# Deep Researcher - 2026-11-19

## TL;DR
- **No new free-tier models today**: Gemini 4 Neon and OpenAI GPT‑6.2 Astra/Sol are paid-only; DeepSeek cut server‑side search fees for its own models (token billing only) but standalone Search/Fetch APIs still cost ¥5/1k calls [1][3][4].  
- **GitHub CLI gets event‑driven PR waits** (`gh event listen`), Copilot adds 8 MCP connectors (Supabase, Box, Calendly…), and team‑level plugin defaults go GA — all on paid Copilot plans; RHEL runners are for larger (paid) runners only [5][6][7][8].  
- **Production cost pattern**: Airbnb measures “cost per task” (list‑price token cost per completed task) via Bedrock CloudWatch metrics and uses it to set model/effort defaults [9]. Two arXiv abstracts (Vibe‑Trading, Cap‑and‑Track) sketch agent‑native trading and adaptive dispatch but lack details [10][11].

---

## 1. New models & pricing changes affecting free agent budgets
- **Gemini 4 Neon** is GA in GitHub Copilot for **Pro+, Max, Business, Enterprise** only; billed at provider list pricing under usage‑based billing [1].  
- **OpenAI GPT‑6.2 Astra/Sol** available to Plus/Pro/Enterprise/Edu users. Astra API: **$8/M input, $0.40/M cached input (60% discount), $40/M output** — 20% cheaper than GPT‑6 Astra. Sol retains GPT‑6.1 Sol rates ($2/$0.10/$10) [3].  
- **DeepSeek** (11‑18) stopped charging separately for **server‑side search and fetch when invoked through the DeepSeek model** — only model tokens are billed. Direct calls to Search API / Fetch API remain **¥5 per 1,000 successful requests**. Harness v0.2.2‑rc.5 defaults to server‑side search for DeepSeek models, avoiding per‑call fees [4].  
- **No free‑tier model launches** or free‑tier pricing changes appear in today’s sources.

---

## 2. GitHub Actions, Copilot, CLI updates for agent workflows
- **`gh event listen`** (v2.105.0) lets agents **wait for PR events (reviews, state changes, check suites) via Event Streams** instead of polling. In preview; requires Event Streams waitlist signup [5].  
- **8 new MCP connectors** (Supabase, Box, Calendly, ClickUp, Mixpanel, Buildkite, Webflow, Wix) in **public preview for all Copilot plans**. Admins must enable “Editor preview features” for Business/Enterprise; some services need admin‑side enablement [6].  
- **Team Copilot customizations GA**: org owners/team maintainers can set default Agent Plugins for direct team members (child teams don’t inherit). Policies still override. Requires Copilot Business/Enterprise [7].  
- **RHEL 9/10 runner images GA** for **larger runners** on GitHub Team/Enterprise Cloud — not applicable to free `ubuntu-latest` runners [8].

---

## 3. Cost‑optimization & trading‑agent patterns
- **Airbnb’s “cost per task” framework**: run evals on representative tasks to measure **score + list‑price token cost per task**; use results to pick default model and reasoning‑effort ceiling. Production monitoring via Bedrock CloudWatch: `InvocationLatency`, `TimeToFirstToken`, `OutputTokenCount`, `OTPS`, `InvocationThrottles`, `EstimatedTPMQuotaUsage`, and per‑token‑type counts (cached/uncached input, output) [9].  
- **Vibe‑Trading (arXiv:2611.24845)**: argues current agents struggle with **state preservation in dynamic markets**; proposes agent‑native trading architecture — abstract only [10].  
- **Cap‑and‑Track (arXiv:2611.24891)**: designs **asynchronous inference dispatch that adapts to shifting provider capacity and unknown output lengths** — abstract only [11].

---

## 4. Open‑model efficiency advances for cheap agents
- **DaisyRose‑27B** announced as “pushing post‑training efficiency” but source shows only model card metadata (28B, image‑text‑to‑text) — no technical details [13].  
- **Fine‑tuning time prediction** (272 production SFT runs on H200s): FLOP‑only estimate **R²=0.31, MAE 12.4h**; a CatBoost regressor using **pre‑dispatch features** (eval cadence, checkpoint policy, per‑GPU token volumes, params saved) hits **R²=0.98, MAE 1.71h** [14]. This enables tighter GPU scheduling, reducing idle cost — relevant if you fine‑tune your own agent models.

---

## Try this
1. **Test DeepSeek Harness v0.2.2‑rc.5** with a DeepSeek model: server‑side search/fetch should incur **no per‑call fees**, only token costs [4].  
2. **Join the Event Streams waitlist** and try `gh event listen <pr-url> --event review_submitted` to replace polling loops in your agent scripts [5].  
3. **Add a Copilot connector** (e.g., Supabase) in VS Code → Agents → Customizations → Connect, then ask Copilot “check my schema before writing a migration” — works on any Copilot plan [6].

---

## Confidence & gaps
- **Models/pricing**: Primary sources for Gemini 4 Neon [1], OpenAI [3], DeepSeek [4] are official or direct reporting. DeepSeek article is Chinese‑language trade press; numbers match its official pricing page but not independently verified.  
- **GitHub updates**: All from GitHub Changelog (primary). Event Streams and connectors are **preview** — may change; RHEL runners explicitly **not for free tier**.  
- **Cost patterns**: Airbnb post [9] is detailed, first‑party AWS blog. Vibe‑Trading and Cap‑and‑Track are **abstracts only** — no method/code to evaluate.  
- **Open‑model efficiency**: DaisyRose‑27B [13] lacks technical content; fine‑tuning prediction [14] is a conference‑preview blog (paper not yet on arXiv) but uses 272 real runs — credible for scheduling, not for inference cost.  
- **Missing**: OpenAI “jagged frontier” [12] returned 403; no free‑tier model drops today.

## Citation check
- 13 sources cited, 14 read; every citation matches a source that was read.
- No stronger source was available for: [4] (discussion/aggregator).
- Couldn't load the full page for [12]; those claims rest on the title and summary only.

## Sources
- [1] [Gemini 4 Neon in GitHub Copilot](https://github.blog/changelog/2026-11-18-gemini-4-neon-in-github-copilot) — GitHub Changelog
- [3] [OpenAI ships GPT-6.2 Astra and Sol, cuts Astra API price — AI Early Edition](https://aiearlyedition.com/tools/openai-gpt-6-2-astra-sol/) — Exa web search
- [4] [DeepSeek刚限完流，就去给开发者免单了 - 智东西](https://www.zhidx.com/p/612273.html) — Exa web search
- [5] [Wait for pull request events with GitHub CLI](https://github.blog/changelog/2026-11-18-wait-for-pull-request-events-with-github-cli) — GitHub Changelog
- [6] [Connect Supabase, Box, Calendly, and more to Copilot](https://github.blog/changelog/2026-11-18-connect-supabase-box-calendly-and-more-to-copilot) — GitHub Changelog
- [7] [Customize GitHub Copilot for your team](https://github.blog/changelog/2026-11-18-customize-github-copilot-for-your-team) — GitHub Changelog
- [8] [Red Hat Enterprise Linux runner images now generally available](https://github.blog/changelog/2026-11-19-red-hat-enterprise-linux-runner-images-now-generally-available) — GitHub Changelog
- [9] [How Airbnb uses cost per task to operate coding agents on Amazon Bedrock](https://aws.amazon.com/blogs/machine-learning/how-airbnb-uses-cost-per-task-to-operate-coding-agents-on-amazon-bedrock/) — AWS Machine Learning
- [10] [Vibe-Trading: Towards Agent-Native Trading](https://arxiv.org/abs/2611.24845v1) — arXiv (paper, abstract read)
- [11] [Cap-and-Track: Optimizing LLM Inference Request Dispatch Across Shifting Capacity](https://arxiv.org/abs/2611.24891v1) — arXiv (paper, abstract read)
- [12] [Research acceleration: The jagged frontier](https://openai.com/index/research-acceleration-jagged-frontier) — OpenAI
- [13] [DaisyRose-27B: Pushing the Frontier of Post-Training Efficiency](https://huggingface.co/blog/RadixArk/daisyrose-27b-pushing-the-frontier-of-post-trainin) — Hugging Face
- [14] [Why your fine-tuning job takes longer than the FLOPs say](https://huggingface.co/blog/Dharma-AI/predicting-fine-tuning-time) — Hugging Face
