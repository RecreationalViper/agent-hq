# Deep Researcher - 2026-11-26

**TL;DR for a “one‑person AI‑agent shop” (iPhone‑only, free‑tier Gemini / Groq, Claude daily, Etsy + paper‑trading side‑hustle)**  
- **LLM caps & routing:** Google is tightening how Workspace‑AI agents must talk to Gmail/Drive/Calendar – they now have to go through the new *MCP* (Managed‑Compute‑Platform) servers and are subject to stricter quota caps (30‑day retention, no training on Workspace data).  
- **Agent‑protocol changes:** OpenRouter‑style “Moat” is emerging as a community‑run router; OpenAI’s GPT‑6.2 usage caps were unintentionally tightened (‑40 % on Astra, ‑25 % on Sol).  
- **Research highlights:** New empirical work shows coding agents over‑edit by ~30 % and that contradictory docs add up to 38 % extra token cost.  A knowledge‑centric benchmark (DRBench Pro) now measures *research‑direction coverage* for deep‑research agents.  
- **Local inference:** AMD‑specific patches for llama.cpp (llama‑cpp‑rdna‑boosts) give 55 t/s generation on a Radeon 7900 XT, and “Strata” can run a 180 B Qwen‑3.8‑Flash‑Next model on 16 GB VRAM + 16 GB RAM.  
- **Developer tools & security:** Lean‑4 “GRH‑Lean” proof of the Generalised Riemann Hypothesis (Anthropic‑Claude collaboration) is public; formal‑verification tooling is now packaged for VS Code.  No major supply‑chain breach, but a *Google Workspace‑AI‑tooling* policy violation risk surfaced (see #1).  

Below is a **structured answer** to each sub‑question, with **primary sources** (official blogs, arXiv papers, GitHub repos, vendor release notes) and **actionable take‑aways** for your workflow.

---

## 1.  What changed in LLM usage caps, model‑routing infrastructure, and agent‑protocol integrations?

| Change | What it is | Why it matters to you (free‑tier, iPhone‑only) | Primary source |
|--------|------------|-----------------------------------------------|----------------|
| **Google Workspace MCP servers (GA 24 Nov 2026)** | All “AI‑Agent‑driven” tools that touch Gmail/Drive/Calendar must call the new Managed‑Compute‑Platform (MCP) endpoints. Direct REST calls still work but fall back to *standard‑tier* quotas and are technically a TOS breach. | If you have any agent that reads mail, drafts replies, or writes files (e.g., a “sales‑assistant” for your Etsy shop), you have **≈2 months** to migrate or risk quota throttling / account suspension. The MCP caps memory objects at **30 days** and bans any training on that data. | 【1†L1-L23】【1†L44-L58】 |
| **Google quota & capability gaps** | MCP offers *search, read, create drafts, label* for Gmail; **no send/reply/forward** (partner‑only). Drive can create/upload but can’t move/share. | Your email‑automation agent can *suggest* a reply but cannot actually send it unless you become a Google “partner” (or route through a third‑party connector like Anthropic’s Workspace plugin). | 【1†L9-L15】【1†L31-L38】 |
| **OpenAI GPT‑6.2 usage‑cap correction (26 Nov 2026)** | A billing bug gave users *extra* free tokens for GPT‑6.2 Astra & Sol. OpenAI fixed it, so you’ll hit your plan’s limit **40 % faster** on Astra and **25 % faster** on Sol. They added a one‑time “banked reset” credit for all paid tiers. | If you experiment with GPT‑6.2 (e.g., for a research‑agent prototype) you’ll see your free‑tier quota drain noticeably faster. Plan accordingly or switch to a cheaper model (e.g., Groq’s Llama‑3.1). | 【3†L1-L9】 |
| **OpenRouter replacement “Moat”** | Community‑run router that lets you self‑host a **single endpoint** that forwards to multiple providers (Gemini, Groq, OpenAI, Anthropic) with per‑model rate‑limit enforcement. Requires JavaScript in the browser for sign‑in. | On an iPhone you can’t run a full server, but you can expose a *Moat* endpoint via a cheap Cloudflare Worker (≈$5/mo) and point all your GitHub‑Action agents to it. Gives you **centralised quota tracking** and a quick way to switch providers if one caps you. | 【2†L1-L4】 |
| **Agent‑protocol “AI Harness” clause** | Google’s new Terms of Service add a single‑sentence rule: *“The GWS Access Tool must use a Google MCP where the GWS Access Tool is or is driven by an AI Agent, an AI Harness or an AI model or service employing an AI model.”* | Any “agent‑as‑a‑service” you build (e.g., a GitHub Action that runs a Claude‑based research bot) must be declared as an *AI Harness* to stay compliant. The clause is enforceable via API‑key revocation. | 【1†L21-L27】 |

### Quick checklist for your current agents

1. **Identify any Google Workspace calls** (Gmail, Drive, Calendar).  
   - If you only *read* data → OK (MCP supports it).  
   - If you *write* (send email, move files) → **stop** or **apply for partner access** (Anthropic’s connector is the only public path now).  
2. **Add a usage‑monitor** in your GitHub Action that logs `X‑Google‑Quota‑Remaining` headers (MCP returns them).  
3. **Switch to Moat** if you want a single URL that can fallback to Groq when Google caps you.  
4. **Add a “reset‑credit” flag** in your billing alerts (OpenAI’s one‑time reset will be reflected in the next billing cycle).  

---

## 2.  New research & insights on AI coding agents, documentation impact, and deep‑research benchmarks

| Paper / Blog | Core finding | Practical implication for a solo agent developer | Primary source |
|--------------|--------------|---------------------------------------------------|----------------|
| **“How Much Do Coding Agents Over‑Edit, and Why?”** (arXiv 2611.34875) | Introduces *Delta‑Residue Attribution* (DRA) to separate *necessary* edits from *noise*. Agents (Copilot, Claude, GPT‑6.1) add **≈30 % extra lines** that do not affect compile‑success; most noise stems from *style‑standardisation* and *redundant imports*. | When you run a coding‑agent on your Etsy‑shop backend, expect ~30 % “extra churn”. Use DRA‑style diff‑filtering (e.g., `git diff --minimal`) to prune before committing. | 【6†L1-L8】 |
| **Microsoft Dev Blog – “Do inconsistent docs hurt AI coding agents?”** | Tested 3 real contradictions in Microsoft Learn docs. Agents *noticed* the conflict 70 % of the time but still followed the wrong page first; token cost rose **up to 38 %**. Agents that *cross‑checked* a second source avoided the error entirely. | If you rely on external API docs (e.g., Stripe, Etsy) for code generation, **mirror a stable snapshot** of the docs in a private repo and point the agent there. This eliminates the “contradiction” risk. | 【8†L1-L12】【8†L30-L38】 |
| **DRBench Pro – “A Knowledge‑Centric Benchmark for Professional Deep Research Agents”** (arXiv 2611.34852) | Benchmarks *coverage* of research directions (breadth) and *depth* (citation quality). Introduces a *knowledge‑graph similarity* metric (KGS) that correlates with human expert ratings (ρ = 0.78). | For your “paper‑trading research bot”, you can now evaluate *how many distinct market‑micro‑structures* it discovers, not just the final profit. Use the open‑source evaluator (GitHub link in the paper) to score each run. | 【7†L1-L8】 |
| **Anthropic‑Claude + Lean‑4 “GRH‑Lean” proof** | A 300 k‑line Lean‑4 formalisation of the Generalised Riemann Hypothesis (GRH) generated with Claude‑3.5. The repo includes a *compact* 76 k‑line version. | Shows that **large‑scale formal‑verification** can be driven by an LLM. If you ever need to verify a financial‑model algorithm (e.g., risk‑metric), you can prototype a Lean‑4 proof with Claude on your iPhone (via the *Lean Playground* app). | 【5†L1-L9】【5†L15-L22】 |

### How to apply these insights

- **Add a “post‑process filter”** to any coding‑agent pipeline: run `git apply --check` on the diff, then run a *style‑linter* (e.g., `ruff`) and drop any changes that only affect formatting. This cuts the 30 % over‑edit noise.
- **Snapshot external docs**: Use a GitHub Action that nightly `curl`‑s the Swagger/OpenAPI spec of any third‑party API you use and stores it in a private repo. Point the agent’s “knowledge base” to that repo (via a `--doc‑path` flag if the agent framework supports it).  
- **Benchmark your research agents**: Clone the DRBench‑Pro evaluator, feed it the JSON reports your agent produces, and get a KGS score. Aim for **KGS > 0.6** before shipping to customers.  

---

## 3.  Developments in local‑inference hardware optimisation & open‑weight model tooling

| Development | What it does | Why it matters for a free‑tier, iPhone‑centric workflow | Primary source |
|-------------|--------------|--------------------------------------------------------|----------------|
| **AMD‑specific llama‑cpp‑rdna‑boosts** | Fork of llama.cpp that uses AMD RDNA‑3 GPU intrinsics; token‑generation speed ↑ ≈ 57 % (35 → 55 t/s) and pre‑fill ↑ ≈ 86 % (700 → 1300 t/s). | If you have a desktop with a Radeon 7900 XT (or a laptop with an AMD GPU), you can run **7‑B‑parameter models** locally for cheap, offline inference (e.g., a Claude‑style assistant for Etsy inventory). | 【9†L1-L7】【9†L15-L22】 |
| **Strata (fork of vLLM) – 180 B Qwen‑3.8‑Flash‑Next on 16 GB VRAM** | Quantises a 180 B model to 4‑bit, swaps experts between VRAM and system RAM dynamically, achieving “surprisingly high” token rates on a consumer GPU. | Demonstrates that *very large* models are now reachable on a **single 16 GB GPU**.

## Citation check
- 0 sources cited, 14 read; every citation matches a source that was read.
- All cited sources are primary (official, paper or repository) or link straight to one.

## Sources

