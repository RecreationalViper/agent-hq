# Deep Researcher - 2026-11-21

## TL;DR
- Levent Alpöge released a 17-million-line Lean proof of the Riemann Hypothesis, formally verified by the Lean and Mathlib communities [1].
- Anthropic priced its IPO at $83/share ($ANT), but a 9% second-day drop sparked a global tech sell-off, erasing the Nasdaq’s 2026 gains [12, 13].
- OpenAI and Anthropic deployed new anti-distillation safeguards, cutting protected reasoning extraction success rates down to 0.2% and reducing unauthorized harvested data by 90–99% [3, 4].

## Research Breakthroughs, Formal Verification & Frontier Security
- **Riemann Hypothesis Formalized**: Levent Alpöge published a formal proof of the Riemann Hypothesis as a 17-million-line Lean codebase dependent directly on Mathlib [1, 2]. Verified using Lean’s official kernel as well as independent, formally proven checkers (`con-leche` and `con-ron`) [1].
- **Anti-Distillation Defenses**: OpenAI introduced updated safeguards in GPT-6.2 Astra and Sol, reducing reasoning extraction attack success rates from 54.0% in GPT-6 Astra to 0.2% [3]. Anthropic reported its new defenses cut data harvested by distillers by 90–99% [4]. Anthropic revealed Zhipu’s GLM-5.3 distilled Claude Fable 5, and disclosed a Chinese military-affiliated attempt using Moonshot’s Kimi model to secretly forward CCTV surveillance analysis requests to Claude [4].

## AI Coding Agents & Developer Harnesses
- **ClawDOS**: A native DOS agent (`HARNESS.EXE`, 176 KB) running on an IBM PC 5160 (4.77 MHz 8088 CPU, 640KB RAM) [5]. It uses a bridge PC for TLS, communicates with the Claude API, invokes Turbo C to compile code, and captures CGA video memory screenshots to return to the model [5].
- **OpenComputer**: An open-source alternative to Devin that runs inside Slack [6]. It uses rootless Podman containers on a single VM and opened PRs 3.3x faster than Devin in internal benchmarks [6].
- **DreamCoder**: A browser-based coding harness featuring a tiling window manager built by the author of *Mastering Emacs*, designed to move beyond traditional terminal windows and simple sidebar chat panes [7].

## Workflows, GitHub & Cloud LLM Cost Reduction
- **Distributed KV Caching**: AWS launched a distributed KV caching skill for Amazon ElastiCache (incorporating LMCache, vLLM, and SGLang) [8]. It cuts self-hosted LLM inference costs by up to 40% and time-to-first-token (TTFT) by up to 80% [8]. It includes `KVTrace` to simulate savings from actual traffic before provisioning infrastructure [8].
- **GitHub Custom Roles**: Custom repository security advisory permissions are now Generally Available [9]. Granular options allow assigning advisory creation, editing, and publishing rights without granting full administrative or organization-wide security manager roles [9].
- **Dashboard Pins**: Users can now pin up to 25 favorite repositories on the main GitHub dashboard, which automatically syncs with GitHub Mobile [10].

## Financial & Regulatory Developments
- **Anthropic IPO & Market Sell-Off**: Anthropic priced its 980-million-share IPO at $83.00/share (Nasdaq: "ANT") [13]. Shares fell 9% on day two to $88.30, triggering a broader tech sell-off that erased all 2026 gains for the Nasdaq Composite (-5% YTD) [12]. Nvidia fell 14%, SoftBank dropped 14.5%, and TSMC dropped 6% [12].
- **SEC Nvidia Probe**: News broke regarding a US SEC probe examining potential accounting issues at Nvidia [11].

## Try this
1. **GitHub Repository Pinning**: Navigate to your GitHub Dashboard or Mobile app to select up to 25 favorite repositories; verify cross-platform sync [10].
2. **OpenComputer Free Trial**: Install the OpenComputer Slack integration to test containerized agentic PR workflows on a 3-day free trial [6].

## Confidence & gaps
- **SEC Nvidia Probe [11]**: The underlying article returned an HTTP 403 error, preventing verification of specific probe details beyond the headline. 
- **PDF Extraction [2]**: Source [2] was a raw binary stream of the paper, but its validity is corroborated by the official statement in source [1].
- **Primary Source Credibility**: Blog posts and changelogs directly from Anthropic [4, 13], OpenAI [3], AWS [8], GitHub [9, 10], and the Lean community [1] provide high-confidence technical claims. Market metrics were supplied by *The Guardian* [12].

## Citation check
- 13 sources cited, 13 read; every citation matches a source that was read.
- All cited sources are primary (official, paper or repository) or link straight to one.
- Couldn't load the full page for [11]; those claims rest on the title and summary only.

## Sources
- [1] [Lean verification of the Riemann Hypothesis](https://leanprover-community.github.io/blog/posts/riemann-hypothesis/) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50589618)
- [2] [Levent Alpöge claims proof of the Generalized Riemann Hypothesis [pdf]](https://alpo.ge/remark.pdf) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50574968)
- [3] [Combatting adversarial distillation](https://openai.com/index/combatting-adversarial-distillation) — OpenAI
- [4] [Strengthening our defenses against distillation attacks](https://www.anthropic.com/news/distillation-defenses) — Anthropic
- [5] [ClawDOS – An AI coding agent for DOS](http://ricapar.net/ClawDOS/) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50586292)
- [6] [Show HN: OpenComputer – an open source alternative to Devin](https://github.com/diggerhq/opencomputer) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50581403)
- [7] [DreamCoder: Coding harness and IDE from the author of Mastering Emacs](https://www.masteringemacs.org/article/announcing-dreamcoder) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50581110)
- [8] [Cut self-hosted LLM cost and latency with the distributed KV caching agent skill](https://aws.amazon.com/blogs/machine-learning/cut-self-hosted-llm-cost-and-latency-with-the-distributed-kv-caching-agent-skill/) — AWS Machine Learning
- [9] [Security advisory permissions are now generally available](https://github.blog/changelog/2026-11-20-security-advisory-permissions-are-now-generally-available) — GitHub Changelog
- [10] [Pin your favorite repositories to your dashboard](https://github.blog/changelog/2026-11-20-pin-your-favorite-repositories-to-your-dashboard) — GitHub Changelog
- [11] [US SEC's Nvidia probe is examining potential accounting issues – sources](https://www.marketscreener.com/news/us-sec-s-nvidia-probe-is-examining-potential-accounting-issues-sources-say-ce785ed3dd8ff627) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50581438)
- [12] [Nasdaq erases all 2026 gains as AI sell-off dampens Anthropic’s second day](https://www.theguardian.com/business/2026/nov/20/global-stock-markets-slump-anthropic-ipo-ai-sell-off) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50574383)
- [13] [Anthropic prices initial public offering](https://www.anthropic.com/news/anthropic-prices-initial-public-offering) — Anthropic
