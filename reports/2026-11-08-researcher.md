# Deep Researcher - 2026-11-08

## TL;DR
- **Anthropic files S-1 for IPO** under symbol "ANT" [6] and donates its "Agent Skills" standard (`SKILL.md`) to the Linux Foundation's Agentic AI Foundation [2].
- **Benchmaxxing exposed**: MaxxBench evaluation shows coding agents overfit to benchmarks; Gemini 3.8 Flash drops from 73.8% on DeepSWE to 53.4% when tasks undergo minor instruction mutations [4].
- **Tech shifts & market corrections**: Microsoft's AI Frontiers research team disbands over scaling-versus-research leadership clashes [10], Discord's Rust rebuild slashes RAM by 70% over Electron [8], and US chip stocks slide 35.8% [11].

## Security, Standards, and Policy
- **Open Agent Standards**: Anthropic has donated Agent Skills (`SKILL.md`)—an open standard for giving agents procedural knowledge—to the Agentic AI Foundation (AAIF) under the Linux Foundation [2]. Maintenance will be led independently by David Soria Parra and Mahesh Murag [2]. Anthropic reports over 1 million published skills and 280 million installs across 70+ platforms [2].
- **Usage Policy Refresh**: Effective November 12, Anthropic updated its Usage Policy [3]. Updates consolidate rules into a dedicated "Do Not Engage in Deceptive Campaigns or Artificial Activity" section [3], redefine election rules under "Do Not Undermine Democratic Processes" (removing blanket bans on personalized civic outreach) [3], explicitly ban guidance/control software for weapons and drone arming [3], and prohibit non-consensual surveillance and AI recommendations for law enforcement charges [3].
- **Claude Code Leak Vulnerability**: A report titled "Claude Code's 'Don't Ask Again' exposes passwords in 1,122 public GitHub files" highlighted potential secrets exposure [1].

## Architectural Concepts, Benchmarks, and Anthropic
- **Anthropic IPO Filing**: Anthropic has filed a Form S-1 with the SEC for a proposed Nasdaq IPO under ticker "ANT" [6].
- **Agent Memory & "Dreaming"**: Anthropic outlined an agent memory framework utilizing "dreaming" (sleep-time compute during offline periods) to reprocess logs, fix errors, and generate persistent memory notes/rules for future sessions [5].
- **MaxxBench Evaluation**: MaxxBench tests whether coding scores stem from "benchmaxxing" (overfitting to test conventions) [4]. When applying minor mutations (median patch increase of 17 lines / 3.5%) to 89 DeepSWE tasks [4]:
  - **Claude Opus 5.5**: 74.2% → 76.4% [4]
  - **GPT-6 Astra**: 74.1% → 71.9% [4]
  - **Claude Opus 5**: 73.6% → 63.5% [4]
  - **DeepSeek V4.1 Flash**: 74.2% → 55.6% [4]
  - **Gemini 3.8 Flash**: 73.8% → 53.4% [4]

## Developer Tooling and Software Architecture
- **GitHub PR Overview Redesign**: GitHub launched a public preview redesign of the Pull Request Overview page, distilling the merge box into less than half the vertical space and adding reverse-chronological comment sorting and status filtering [7].
- **Discord Rebuilds in Rust**: Discord previewed "Discord Phoenix," a native Windows 11 Rust client replacing its Electron app [8]. The client launches cold almost instantly without a loading screen, auto-updates in the background, and idles at 290.2MB RAM while running two accounts concurrently (~70% below Electron's typical 1–2GB consumption) [8].

## Structural AI Shifts and Market Trends
- **MSR AI Frontiers Disbands**: Microsoft Research’s ~50-person AI Frontiers (AIF) group—creators of AutoGen and the Fara computer-use agent—disbanded after a reorg into Microsoft AI (MAI) [10]. Key researchers departed, citing an "incompatible" scaling-only mandate driven by ex-Inflection leadership that dismissed fundamental research in favor of data scaling [10].
- **AI Stock Drawdown**: Market metrics show the S&P 500 down 5.7% from its October 6 peak [11]. The Nasdaq is down 10.9%, while the PHLX Semiconductor index has fallen 35.8% from its June record, matching its peak drawdown during the 2020 Covid crash [11].

## Try this
1. **Adopt Open Skills**: Structure procedural instructions in agent workflows using the `SKILL.md` format now hosted under the Agentic AI Foundation at `agentskills.io` [2].
2. **Opt-in to GitHub's PR Redesign**: Test the compact merge box and comment filters by selecting "Try the Overview page" in the header of any public GitHub PR [7].

## Confidence & gaps
- **Inaccessible Source**: Source [1] returned an HTTP 403 error. Claims regarding Claude Code's "Don't Ask Again" password leak rest solely on the headline provided in metadata [1].
- **Unverified Benchmarks**: Discord client metrics [8] rely on social media demonstrations by employees rather than standardized third-party benchmarks.
- **High Credibility**: Direct SEC/company disclosures ([2], [3], [6]), GitHub release notes ([7]), and primary post-mortems from MSR leadership ([10]) provide concrete, reliable data.

## Citation check
- 10 sources cited, 11 read; every citation matches a source that was read.
- All cited sources are primary (official, paper or repository) or link straight to one.
- Couldn't load the full page for [1]; those claims rest on the title and summary only.

## Sources
- [1] [Claude Code's "Don't Ask Again" exposes passwords in 1,122 public GitHub files](https://apiiro.com/blog/coding-agents-leaking-secrets-github-dont-ask-again) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50407882)
- [2] [Donating Agent Skills to the Agentic AI Foundation](https://www.anthropic.com/news/donating-agent-skills-to-the-agentic-ai-foundation) — Anthropic
- [3] [2026 Usage Policy update](https://www.anthropic.com/news/2026-usage-policy-update) — Anthropic
- [4] [MaxxBench – "Nice DeepSWE score. But is it true?"](https://maxxbench.unlap.ai/research/why-maxxbench/) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50406222)
- [5] [The Components of Agent Memory](https://www.anthropic.com/research/components-of-agent-memory) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50402212)
- [6] [Anthropic files S-1 with the SEC for proposed initial public offering](https://www.anthropic.com/news/s1-sec) — Anthropic
- [7] [GitHub New pull request overview page in public preview](https://github.blog/changelog/2026-11-05-new-pull-request-overview-page-in-public-preview/) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50408931)
- [8] [Every Windows 11 app should kill Electron, and Discord just showed why](https://www.windowslatest.com/2026/11/06/every-windows-11-app-should-kill-electron-and-discord-just-showed-why-no-starting-screen-and-70-less-ram-even-with-two-accounts-signed-in/) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50403507)
- [10] [The end of Microsoft Research's AI Frontiers group](https://hunch.net/?p=13764006) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50406563)
- [11] [The AI sell-off compared to well-known stock market crashes](https://www.kadoa.com/companies/insights/ai-selloff-perspective) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50401029)
