# Deep Researcher - 2026-11-11

## TL;DR
- **Google released A2UI 1.0**, a stable open protocol for generative UI that lets agents render native, interactive screens across web, iOS, and Android [4].
- **Atuin Threads launched** to sync, search, and resume terminal agent sessions (Claude Code, Codex, OpenCode) across machines with E2E encryption [5].
- **Ollama Cloud eliminated its free plan**, requiring pay-as-you-go credits for cloud-hosted models while leaving local execution free [8].

## New Models & Platform Integrations
- **Gemini 4 Carbon in GitHub Copilot**: Google's Gemini 4 Carbon is now GA in Copilot for Pro+, Max, Business, and Enterprise tiers under usage-based billing [1].
- **Kimi K3.1 Pro Highspeed on AWS Bedrock**: Moonshot AI launched Kimi K3.1 Pro Highspeed on Bedrock (`global.moonshotai.kimi-k3.1`). It features a 1M-token context, 3T-class architecture, and 2–3× faster token generation compared to K3.1 Pro [2].
- **ERNIE 5.5 Flash Preview**: Baidu announced a preview model on the Qianfan platform featuring 280B total / 14B active parameters and a 1M context window, optimized for long-horizon agent tasks [3].

## Developer Tooling & Agent Protocols
- **A2UI 1.0 Protocol**: Google's open generative UI framework reached version 1.0 stability with renderers for React, Angular, Flutter, SwiftUI, and Jetpack Compose [4]. It supports bidirectional function calling and works inside MCP apps on Claude and Gemini [4].
- **Atuin Threads (v18.24)**: Synchronizes agent history across machines using end-to-end encrypted logs, allowing developers to start a task in Claude Code and resume it in Codex or OpenCode [5]. Includes MCP support via `atuin mcp` [5].
- **GitHub Updates**: Repositories owned by personal accounts can now create up to 25 custom issue types and 25 custom issue fields [6]. Starting December 8, 2026, GitHub will pause Dependabot alerts on repositories inactive for over a year [7].

## API Pricing, Free Tiers & Local Inference
- **Ollama Cloud Free Tier Sunset**: Ollama dropped its free cloud tier; cloud requests now require purchasing credits (starting at $20/mo for Pro), returning a `402 Payment Required` error without balance [8]. Running models locally on your own machine remains free and unlimited [8].
- **API Cost Dynamics**: Analysis of open-weight API pricing shows output tokens cost 3–5× more than input tokens, while batch endpoints provide an exact 50% discount [9].
- **Precision on Demand**: Inference research demonstrated a strategy storing 8-bit weights but decoding with top 4-bit weights, escalating back to 8-bit execution only when step entropy signals high uncertainty [10].

## Agent Workflows, RL & Evaluation Research
- **Workflow Distillation**: *ReTrace* distills multi-step, tool-using LLM agents following natural language SOPs into planner-free, deterministic workflows to eliminate repeated LLM call latency [11].
- **RL Training**: *AutoScaffold* introduces AI-guided training-time prompt scaffolds to improve reinforcement learning with verifiable rewards (RLVR) beyond simple outcome metrics [12].
- **Agent Evaluation**: AWS outlined an evaluation architecture for Amazon Bedrock AgentCore integrating built-in evaluators with DeepEval and AutoEval for trace and session metrics [13].

## Try this
- **Sync agent sessions**: Update to Atuin 18.24+ and run `atuin resume` to back up and sync your Claude Code or OpenCode terminal context across devices [5].
- **Customize GitHub issues**: Navigate to your GitHub personal account settings under "Planning" to define custom issue types and fields [6].

## Confidence & gaps
- **Ollama Cloud details**: Relies on Internet Archive snapshots, community GitHub issues, and tracker reports because Ollama did not publish an official blog post detailing the free plan sunset [8].
- **Research papers**: Findings for papers [10], [11], and [12] are based on abstract releases; full methodology details were limited in the primary text.

## Citation check
- 13 sources cited, 13 read; every citation matches a source that was read.
- All cited sources are primary (official, paper or repository) or link straight to one.

## Sources
- [1] [Gemini 4 Carbon in GitHub Copilot](https://github.blog/changelog/2026-11-10-gemini-4-carbon-in-github-copilot) — GitHub Changelog
- [2] [Introducing Kimi K3.1 Pro on Amazon Bedrock](https://aws.amazon.com/blogs/machine-learning/introducing-kimi-k3-1-pro-on-amazon-bedrock/) — AWS Machine Learning
- [3] [Introducing ERNIE 5.5 Flash Preview · ERNIE](https://ernie.baidu.com/release/ernie-5-5-flash-preview/) — Exa web search
- [4] [A2UI 1.0: Build delightful, fast, reliable, agentic experiences
            
            
            - Google Developer](https://developers.googleblog.com/en/a2ui-10-build-delightful-fast-reliable-agentic-experiences/) — Exa web search
- [5] [Atuin Threads: All your agent sessions on every machine](https://blog.atuin.sh/threads-agent-sessions/) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50453637)
- [6] [Issue types and fields are available for personal accounts](https://github.blog/changelog/2026-11-11-issue-types-and-fields-are-available-for-personal-accounts) — GitHub Changelog
- [7] [Dependabot alerts will pause on inactive repositories](https://github.blog/changelog/2026-11-10-dependabot-alerts-will-pause-on-inactive-repositories) — GitHub Changelog
- [8] [Ollama drops the free plan from its cloud - MACCUS](https://maccus.fr/en/ollama-cloud-free-plan-ends/) — Exa web search
- [9] [What an LLM call actually costs in November 2026: open models per 1M tokens](https://dev.to/synap402/what-an-llm-call-actually-costs-in-november-2026-open-models-per-1m-tokens-3poc) — Exa web search
- [10] [Precision on Demand: Escalating Weight Bits at Uncertain Decoding Steps in a Small Local Model](https://arxiv.org/abs/2611.14418v1) — arXiv (paper, abstract read)
- [11] [ReTrace: Distilling Tool-Using Agents into Planner-Free Workflows](https://arxiv.org/abs/2611.14492v1) — arXiv (paper, abstract read)
- [12] [AutoScaffold: AI-Guided Scaffolding for Reinforcement Learning of Language Models](https://arxiv.org/abs/2611.14515v1) — arXiv (paper, abstract read)
- [13] [The agent evaluation playbook: Built-in, DeepEval, and AutoEval on Amazon Bedrock AgentCore Evaluations](https://aws.amazon.com/blogs/machine-learning/the-agent-evaluation-playbook-built-in-deepeval-and-autoeval-on-agentcore/) — AWS Machine Learning
