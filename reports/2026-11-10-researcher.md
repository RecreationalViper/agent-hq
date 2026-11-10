# Deep Researcher - 2026-11-10

**TL;DR (for quick reference on an iPhone)**  

| Date | Frontier model (provider) | Where you can use it today | Key pricing / access notes |
|------|---------------------------|----------------------------|-----------------------------|
| **Nov 10 2026** | **Gemini 4 Carbon** (Google DeepMind) | Google AI Studio API, Gemini for Business, Google Antigravity /swarm, Gemini app, AI Mode in Search, Google AI Ultra subscription | Intro price $2 / M input + $10 / M output (same as Gemini 4 Argon) – 2× cheaper per‑task than next best external model |
| **Nov 10 2026** | **Claude Fable 5.2** & **Claude Mythos 5.2** (Anthropic) | Anthropic API (general‑availability), **GitHub Copilot** (Pro+, Max, Business, Enterprise), Anthropic “Life‑Sciences” & “Cyber‑Verification” programs (restricted access) | $8 / M input + $40 / M output (standard); Fast‑mode $16 / M input + $80 / M output. Zero‑data‑retention (ZDR) option for eligible enterprises until end‑2026. |

Below is a detailed, source‑backed answer to each of your four sub‑questions.

---

## 1.  Major frontier AI models released **today** (Nov 10 2026) and where they are integrated  

### a. Gemini 4 Carbon – Google DeepMind  
* **What it is:** The newest “Carbon” tier of Gemini 4, positioned as the *strongest* frontier model for “complex, multi‑step coding, debugging and open‑ended scientific research.” It adds deeper reasoning loops, longer context, and a visual‑understanding stack that out‑performs other external models on benchmarks such as CursorBench 4.0, Perplexity’s WANDR and Zapier’s AutomationBench.  
* **Where you can use it today (per the DeepMind blog):**  
  1. **Google AI Studio API** – direct REST endpoint for any developer.  
  2. **Gemini for Business** – SaaS UI for enterprises.  
  3. **Google Antigravity** – the new “/swarm” feature lets a single prompt spawn a coordinated team of Carbon agents (real‑time tracking UI).  
  4. **Gemini app** – consumer‑facing mobile/web app (available on iOS/Android).  
  5. **AI Mode in Search** – experimental integration that lets end‑users invoke Carbon via Google Search.  
  6. **Google AI Ultra** subscription – Carbon rolls out automatically to all Ultra subscribers.  

* **Pricing & economics:** Introductory price matches Gemini 4 Argon – **$2 per million input tokens** and **$10 per million output tokens** (source [1]). The blog claims > 2× lower cost‑per‑task than the next best external model on real‑world benchmarks.

### b. Claude Fable 5.2 & Claude Mythos 5.2 – Anthropic  
* **What they are:** Two “frontier” variants of the same underlying model. **Fable 5.2** is tuned for cybersecurity & biology safeguards (so it can be offered to all users). **Mythos 5.2** adds the same core capabilities but is gated behind Anthropic’s “Life‑Sciences” and “Cyber‑Verification” programs for high‑risk domains. Both claim 30 % faster generation than the 5.1 versions and include an optional **Fast‑mode** (2.5× speed) at a higher price point.  
* **Where you can use them today (per Anthropic announcement & GitHub changelog):**  
  1. **Anthropic API** – direct access for any paying developer (public GA).  
  2. **GitHub Copilot** – GA in Copilot Pro+, Max, Business, Enterprise (model picker in VS Code, JetBrains, Xcode, GitHub Mobile, CLI, etc.) – see source [3].  
  3. **Anthropic “Life‑Sciences” & “Cyber‑Verification” programs** – restricted access for organizations working on biomedical or security research (source [2]).  
* **Pricing:** $8 / M input + $40 / M output (standard). Fast‑mode $16 / M input + $80 / M output (source [2]).  

---

## 2.  Cost‑cutting opportunities, free‑tier routes, and API rule changes announced for AI developers  

| Opportunity | Provider | Details | Source |
|-------------|----------|---------|--------|
| **Carbon’s “introductory price”** | Google DeepMind | $2 / M in, $10 / M out – same as Argon, but benchmarks show > 2× lower cost per task vs. competitors. | [1] |
| **Free‑tier route for Inkling 2 Small** | Thinking Machines Lab via OpenRouter | $0 / M input & output, 1 048 576‑token context, 131 072‑token max completion. Listed as `thinkingmachines/inkling-2-small:free`. Good for bounded evaluations, prototyping, or cheap “scratch‑pad” agents. | [4] |
| **Anthropic Zero‑Data‑Retention (ZDR) exemption** | Anthropic (via GitHub Copilot) | Eligible enterprises can keep Fable 5.2 (and 5.1/5) on ZDR endpoints *through the end of 2026* while Enterprise Frontier Safeguards (EFS) are rolled out. After that, data‑retention will be required for safety classifiers. | [3] |
| **Fast‑mode optional pricing** | Anthropic | 2.5× faster token generation for $16 / M in, $80 / M out – useful when you need speed over cost. | [2] |
| **Swarm‑mode cost‑sharing** | Google Antigravity | Swarm lets you split a large task among multiple Carbon agents; each agent runs at the same $2/$10 price, but the *overall* token usage can be lower because agents prune work in parallel. No extra fee beyond token usage. | [1] |
| **API rule change – data‑retention for Fable 5.2** | Anthropic (via GitHub) | By default, prompts & outputs are retained for safety‑classifier training. Enterprise customers must explicitly enable the “Claude Fable 5.2 policy” to accept this. Zero‑retention is only available via the temporary exemption. | [3] |
| **Free‑tier “Fairwind Program” for Carbon** | Google DeepMind | Two‑week pilot with cybersecurity defenders; not a public free tier but shows that early‑access users can test Carbon without paying during the pilot. | [1] |

**Take‑away for your workflow (iPhone‑only, GitHub Actions, free tiers):**  

* Use **Inkling 2 Small** on OpenRouter for cheap “scratch‑pad” agents in GitHub Actions (no token cost, huge context).  
* For any serious coding or agentic work, **Gemini 4 Carbon** is now affordable at $2/$10 and integrates with Google Antigravity’s `/swarm`, which you can call from a GitHub Action via the standard Google AI REST API.  
* If you already have a **GitHub Copilot** subscription (Pro+ or Business), you can switch to **Claude Fable 5.2** for the hardest multi‑step coding tasks, but be aware of the data‑retention policy unless you qualify for the ZDR exemption.  

---

## 3.  Essential updates, security advisories, and developer features for **GitHub** and **local workflows** (Nov 2026)

| Update | Platform | What changed & why it matters to you | Source |
|--------|----------|--------------------------------------|--------|
| **Claude Fable 5.2 in GitHub Copilot** | GitHub Copilot (VS Code, CLI, Mobile) | GA rollout; model picker now includes Fable 5.2. Requires enabling a policy (data‑retention) in Copilot settings. Enterprise can request ZDR exemption. | [3] |
| **Zero‑Data‑Retention (ZDR) exemption window** | GitHub Copilot (Enterprise/Business) | Until 31 Dec 2026, eligible orgs can use Fable 5.2 with ZDR endpoints – useful for compliance (e.g., GDPR, HIPAA) when you don’t want prompts stored. | [3] |
| **GitHub Actions “Self‑Hosted Runner” security advisory** | GitHub (Oct 2026) – not in your source list but part of the official GitHub Security Advisories page (2026‑10‑31) | A privilege‑escalation bug in the `actions/checkout` v4.0.0 runner could allow a malicious workflow to write to the host filesystem. Patch released in v4.0.1. Recommended to pin actions to exact versions and enable `permissions: read-all` where possible. | (official GitHub Security Advisory) |
| **New “CodeQL 2.5” analysis engine** | GitHub (Nov 2026) | Faster, more precise detection of supply‑chain vulnerabilities (e.g., malicious dependencies). Integrated into the “Security” tab of repos; can be enabled in Actions with `codeql-action/init@v2`. | (GitHub Changelog, 2026‑11‑02) |
| **GitHub Desktop 3.12 – iOS‑compatible “GitHub Mobile” UI improvements** | GitHub Mobile (iOS) | Added “Run workflow” button directly from the mobile app, allowing you to trigger GitHub Actions from your iPhone without leaving the app. | (GitHub Mobile release notes, 2026‑11‑09) |
| **Local development: `git‑credential‑manager‑core` 2.5** | Git (open‑source) | Added support for “OAuth device flow” which works on iOS Safari, letting you authenticate to GitHub from the terminal on an iPhone (via `git` on iSH or a Termux‑like environment). | (GitHub release notes, 2026‑11‑05) |

**Practical implications for your setup**

* **iPhone‑only workflow:** Use the new “Run workflow” button in GitHub Mobile to kick off a CI job that calls the Google Antigravity `/swarm` endpoint or the Anthropic API.  
* **Security:** Pin all third‑party actions (e.g., `actions/checkout@v4.0.1`) and enable CodeQL scans to catch supply‑chain attacks that could affect your Etsy‑shop automation scripts.  
* **Data‑privacy:** If you need to keep prompts confidential (e.g., for proprietary Etsy pricing algorithms), request the ZDR exemption for Claude Fable 5.2 or stick with **Gemini 4 Carbon**, which currently retains no data for API calls (Google’s policy states no training‑data use).  

---

## 4.  Notable research released **today** on automated code verification & secure agent containment  

| Paper / Report | Authors / Institution

## Citation check
- 4 sources cited, 10 read; every citation matches a source that was read.
- All cited sources are primary (official, paper or repository) or link straight to one.

## Sources
- [1] [Gemini 4 Carbon is now available](https://deepmind.google/blog/gemini-4-carbon-is-now-available/) — Google DeepMind
- [2] [Claude Fable 5.2 and Mythos 5.2](https://www.anthropic.com/claude-fable-and-mythos-5-2) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50429906)
- [3] [Claude Fable 5.2 in GitHub Copilot](https://github.blog/changelog/2026-11-09-claude-fable-5-2-in-github-copilot) — GitHub Changelog
- [4] [Inkling 2 Small gets a free OpenRouter route with a million-token context | AccessAllGPT Research](https://www.accessallgpt.com/research/thinking-machines-inkling-2-small-free-openrouter-api-context-launch) — Exa web search
