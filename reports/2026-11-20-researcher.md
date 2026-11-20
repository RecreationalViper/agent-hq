# Deep Researcher - 2026-11-20

## TL;DR
- **Anthropic Market Debut**: Anthropic closed its initial public offering on Nasdaq ("ANT") at $83.00/share, raising $93.5B ($119.5B total including private tech placements) [4].
- **API & Tooling Launches**: Google added Gemini Tool Retrieval [1] ahead of a Dec 1 price double to $4/$20 per million tokens [5], while Moonshot's Kimi Code CLI v2.7.0 introduced native AWS Bedrock credential integration [3].
- **Model & Hardware Breakthroughs**: Researchers demonstrated open 27B models rewriting their own weights without backpropagation [11], and AI hardware co-design produced "Frostbite," a CPU delivering 4.59x performance-per-watt [12].

## New AI API Capabilities, Agent Infrastructure Frameworks, and Coding CLI Tools
Google launched Tool Retrieval in preview for the Gemini Interactions API. Developers add a `tool_search` tool and set `defer_loading: true` on candidate functions so the API loads parameter schemas on demand, cutting context token usage and latency [1]. AWS upgraded the Amazon Bedrock AgentCore harness to use the open-source Strands harness (Apache 2.0), introducing lifecycle hooks, prompt caching, proactive context management (~34% lower token costs), and built-in tools like `todo_write` and `subagent` [2]. Moonshot AI released Kimi Code CLI v2.7.0, introducing a native `bedrock` provider that authenticates via the standard AWS CLI credential chain (`AWS_PROFILE`, SSO) and generates short-lived bearer tokens via `@aws/bedrock-token-generator` valid for up to 12 hours [3].

## Model Pricing, Free Tiers, and Anthropic's Market Debut
Anthropic closed its IPO of 1,127,000,000 Class A common shares at $83.00 per share under ticker "ANT" on Nasdaq, yielding ~$93.5B gross proceeds ($91.6B to Anthropic) [4]. A concurrent Class N private placement to AMD, Broadcom, Google, Micron, Microsoft, NVIDIA, and TSMC raised $26.0B, bringing total proceeds to ~$119.5B [4]. 

In model pricing, Gemini 4 Carbon's current $2/M input and $10/M output token rates reflect a 20-day promotional window ending November 30; on December 1, standard pricing for Carbon and Argon doubles to $4/M input and $20/M output without grandfathering, and Carbon offers no free tier in Google AI Studio [5]. Perplexity announced it will keep its Decider-v1.3 and Flash models free on OpenRouter for 3 additional weeks [6].

## Developer Platform Features and Automated Engineering Practices
GitHub Desktop 3.7.0 introduced multi-account support per host (GitHub.com, GHE.com, GitHub Enterprise Server), enabling developers to bind repositories to specific signed-in accounts automatically [7]. GitHub also updated its Pull Request Overview public preview: failed optional checks no longer block pull request mergeability, force-push entries link directly to old and new commits, commit timestamps are explicitly displayed, and conversation locking can be toggled directly from the sidebar [8]. OpenAI's engineering post on ChatGPT performance infrastructure was unavailable due to access restrictions [9].

## Research Papers, Model Self-Modification, and Hardware Designs
Anthropic reported that Claude solved two open black hole physics problems, proving that the Hawking-Page phase transition persists when spacetime loses definite shape and establishing exact limits for 2D quantum gravity bootstrapping [10]. 

In self-modification research, Fan et al. demonstrated that an open 27B model given execution access can rewrite its own weights without backpropagation or training gradients, boosting accuracy by 6.6 points on unseen tasks and restoring a corrupted model copy to over 80% of its original performance [11]. 

Architect Labs introduced "Frostbite," an AI-discovered general-purpose CPU architecture based on interaction nets, achieving a "4.59x performance-per-watt multiple" compared to a modern dual-issue in-order superscalar CPU core across 25 workloads [12].

## Try this
1. **Free Reasoning Workloads**: Route experimental agent calls to Perplexity Decider-v1.3 or Flash on OpenRouter while they remain zero-cost over the next 3 weeks [6].
2. **Keyless AWS CLI Tooling**: Upgrade Kimi Code CLI to v2.7.0 and authenticate against Amazon Bedrock using `AWS_PROFILE` standard credential chains rather than managing static API keys [3].

## Confidence & gaps
- **Unloaded Sources**: OpenAI's technical breakdown of ChatGPT speed optimization [9] returned an HTTP 403 error and could not be evaluated.
- **Thin Abstract Coverage**: The ROGUE-AI agent security event paper [13] was limited to abstract text without full incident telemetry.
- **Pricing Source Credibility**: Primary source release notes confirmed Gemini Tool Retrieval [1] and Bedrock harness updates [2]. However, Gemini 4 Carbon's scheduled December 1 price doubling relies on secondary pricing aggregation reporting [5]; while detailed and internally consistent, it should be verified against official Google AI Studio billing dashboards before setting long-term API budgets.

## Citation check
- 13 sources cited, 13 read; every citation matches a source that was read.
- All cited sources are primary (official, paper or repository) or link straight to one.
- Couldn't load the full page for [9]; those claims rest on the title and summary only.

## Sources
- [1] [Introducing Tool Retrieval in the Gemini API](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-tool-retrieval/) — Google AI
- [2] [Amazon Bedrock AgentCore harness adds Strands harness defaults, built-in tools, and lifecycle hooks](https://aws.amazon.com/blogs/machine-learning/amazon-bedrock-agentcore-harness-adds-strands-harness-defaults-built-in-tools-and-lifecycle-hooks/) — AWS Machine Learning
- [3] [Use Kimi Code CLI with models on Amazon Bedrock](https://aws.amazon.com/blogs/machine-learning/use-kimi-code-cli-with-models-on-amazon-bedrock/) — AWS Machine Learning
- [4] [Anthropic announces closing of initial public offering, including full exercise of underwriters’ option to purchase addi](https://www.anthropic.com/news/ipo-close) — Anthropic
- [5] [Gemini $2 pricing masks a fast-approaching $4 reality](https://thedecoded.media/gemini-carbon-api-pricing-hike/) — Exa web search
- [6] [Perplexity keeps Decider-v1.3 and Flash free on OpenRouter for 3 more weeks](https://ai123.com/newshub/18748) — Exa web search
- [7] [GitHub Desktop now supports multiple accounts per host](https://github.blog/changelog/2026-11-19-github-desktop-now-supports-multiple-accounts-per-host) — GitHub Changelog
- [8] [Improvements on the pull request overview in public preview](https://github.blog/changelog/2026-11-19-improvements-on-the-pull-request-overview-in-public-preview) — GitHub Changelog
- [9] [How OpenAI’s Performance Factory keeps ChatGPT fast](https://openai.com/index/how-openai-performance-factory-keeps-chatgpt-fast) — OpenAI
- [10] [Claude solves two open problems in the physics of black holes](https://www.anthropic.com/research/claude-black-hole-physics) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50563148)
- [11] [Language Models Can Rewrite Their Own Weights](https://arxiv.org/abs/2611.21885) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50577265)
- [12] [Frostbite: A new CPU architecture discovered, designed and verified by AI](https://architectlabs.com/blog/frostbite) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50572503)
- [13] [Replication of Agentic Security Events: Audit and Investigation (ROGUE-AI)](https://arxiv.org/abs/2611.26553v1) — arXiv (paper, abstract read)
