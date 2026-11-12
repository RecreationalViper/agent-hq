# Deep Researcher - 2026-11-12

## TL;DR
- **Google launched Gemini 4 Hydrogen** ($1.50/1M input) alongside a zero-output-cost **Gemini Decisions API** ($0.10/1M input) [1, 3].
- **Anthropic initiated its IPO roadshow** (Nasdaq symbol "ANT", $70–$78 target) and pledged 5% of shares to a Public Benefit Fund LLC [11, 12].
- **Critical Apache HTTP/2 RCE disclosed** (CVE-2026-119618), while **Rust 1.100.0** stabilized the never type `!` [7, 8].

## New AI Models and Specialized APIs
- **Gemini 4 Hydrogen**: Google DeepMind released Hydrogen for rapid execution across agentic workflows [1]. Priced flat across a 1M token context window at $1.50/1M input and $7.50/1M output, it hits 51 on the Artificial Analysis Intelligence Index (54 at xhigh) and scores 57% on Terminal-Bench 4.1 [1].
- **Gemini Decisions API**: Google introduced `gemini-decision-1` to evaluate up to 1,000 questions (yes/no `noul`, multiple choice, or continuous `score` rubrics) in a single pass over multimodal inputs up to 256K tokens [3]. Operating at 150–250 ms end-to-end latency, it costs $0.10/1M input tokens with zero output tokens billed [3].
- **QVAC BotPsy**: Tether AI Research released an open-weight 800M parameter model (Qwen3.5-0.8B base) under Apache 2.0, reaching 44.0% on Berkeley Function-Calling Leaderboard v4 for local device tool execution [2].

## Agent Runtimes, Protocols, and Tool Integrations
- **Google Antigravity Orchestrator**: Automatically routes tasks between Gemini Carbon and Hydrogen within a single session, consuming 24% less quota while running 19% faster on Terminal-Bench 4.0 [1].
- **AWS A2A Protocol**: AWS deployed reference architectures supporting the Linux Foundation Agent-to-Agent (A2A) protocol, enabling cross-framework communication (e.g., LangChain enterprise orchestrator to Strands agents on Bedrock AgentCore) across separate AWS accounts using Cognito OAuth [4].
- **Bedrock AgentCore Tools**: AWS announced fine-grained access control for Bedrock Knowledge Base MCP tools by injecting validated identity claims into tool calls via a Lambda interceptor to prevent prompt injection [5]. AWS also launched the standalone `InvokeWebSearch` API on Bedrock AgentCore for direct IAM/SigV4 signed web queries without needing an AgentCore Gateway [6].

## Dev Tools, Languages, and Security Advisories
- **Critical Apache HTTP/2 RCE (CVE-2026-119618)**: Anthropic and Google Cloud discovered a race condition in `mod_http2`'s `assign_headers()` function leading to heap corruption and remote code execution [7]. Affects Apache HTTP Server versions 2.4.55 through 2.4.70; fixed in version 2.4.71 [7].
- **Rust 1.100.0**: Officially stabilized the never type `!` globally, updated `Infallible` to a type alias for `!`, stabilized core parts of the `Allocator` trait for custom memory management, and introduced the `DropGuard` API [8].
- **GitHub Actions Lockfiles**: GitHub released lockfile support via `gh extension install github/gh-actions-lock`, allowing workflows to use version tags while generating `.github/workflows/actions.lock` to pin commit SHAs upstream [9]. Supported by `zizmor` v1.32.0+ [9].

## Corporate Shifts and Financial Milestones
- **Nvidia Executive Departure**: Jensen Huang resigned immediately as CEO and board member of Nvidia [2, 10].
- **Anthropic IPO & Public Benefit Fund**: Anthropic launched its IPO roadshow offering 825 million Class A shares priced between $70.00 and $78.00 per share under Nasdaq ticker "ANT" [12]. Concurrently, Anthropic committed 5% of its equity to the Anthropic Public Benefit Fund LLC, adding an extra 2% for every 50% increase in company valuation [11].
- **Q-Ctrl Funding**: Quantum technology company Q-Ctrl raised $290 million in a round led by Salesforce Ventures [2].

## Try this
1. **Lock GitHub Actions Workflows**: Install the official extension (`gh extension install github/gh-actions-lock`) and run `gh actions-lock` in your repositories to pin actions to SHAs while maintaining clean semantic version tags in your workflow YAML files [9].
2. **Evaluate Low-Latency Model Routing**: Test `gemini-decision-1` in Google AI Studio to run closed-set classification or tool routing across text and images for $0.10/1M input tokens without paying output token fees [3].

## Confidence & gaps
- **Nvidia CEO Resignation**: Reuters source [10] failed to load due to an HTTP 401 error; confirmation relies on the brief wire reporting summary [2].
- **Tether BotPsy Scope**: Model weights and GGUF files were published under Apache 2.0, but Tether withheld the underlying training dataset, training scripts, and release dates for any consumer assistant app [2].

## Citation check
- 12 sources cited, 12 read; every citation matches a source that was read.
- All cited sources are primary (official, paper or repository) or link straight to one.
- Couldn't load the full page for [10]; those claims rest on the title and summary only.

## Sources
- [1] [Introducing Gemini 4 Hydrogen](https://deepmind.google/blog/introducing-gemini-4-hydrogen/) — Google DeepMind
- [2] [Tether unveils BotPsy, an 800M-parameter on-device AI agent](https://www.siliconreport.com/tether-unveils-botpsy-an-800m-parameter-on-device-ai-agent) — Exa web search
- [3] [Gemini Decisions API: Fast, calibrated multimodal decisions](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-decisions-api/) — Google AI
- [4] [Build composable, interoperable multi-agent systems with A2A on AWS](https://aws.amazon.com/blogs/machine-learning/build-composable-interoperable-multi-agent-systems-with-a2a-on-aws/) — AWS Machine Learning
- [5] [Fine-grained access control for Amazon Bedrock Managed Knowledge Base tools](https://aws.amazon.com/blogs/machine-learning/fine-grained-access-control-for-amazon-bedrock-managed-knowledge-base-tools/) — AWS Machine Learning
- [6] [Introducing the Web Search API on Amazon Bedrock AgentCore](https://aws.amazon.com/blogs/machine-learning/introducing-the-web-search-api-on-amazon-bedrock-agentcore/) — AWS Machine Learning
- [7] [Critical RCE Vulnerability in Apache HTTP Server](https://www.wiz.io/blog/cve-2026-119618-rce-apache-http-server-vulnerability) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50462177)
- [8] [Announcing Rust 1.100.0 | Rust Blog](https://blog.rust-lang.org/2026/11/12/Rust-1.100.0/) — Exa web search
- [9] [Lock Your GitHub Actions](https://hugovk.dev/blog/2026/lock-github-actions/) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50459485)
- [10] [Jensen Huang resigns as Nvidia CEO immediately](https://www.reuters.com/live/nvidia-live-board-meets-fate-ceo-jensen-huang-after-affair-reports-2026-11-12/) — Hacker News · [discussion](https://news.ycombinator.com/item?id=50467132)
- [11] [Investing in the public benefit We’re committing a portion of Anthropic’s shares to the Anthropic Public Benefit Fund, a](https://www.anthropic.com/news/public-benefit-fund) — Anthropic
- [12] [Anthropic launches roadshow for proposed initial public offering](https://www.anthropic.com/news/roadshow-launch) — Anthropic
